const {
  ACT_SEVEN_PUZZLES,
  PUZZLE_ITEMS,
  FEEDBACK_LINES,
  HINT_COSTS,
  PUZZLE_CURRENCY,
  getPuzzleDefinition,
  getPuzzleItemDefinition,
} = require('../data/actSevenPuzzlesConfig');
const { EXPEDITION_PHASES } = require('../data/actSevenConfig');
const { expeditionSlice } = require('./colony');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// Act VII's artifact puzzles, hint ladder and instrument shop — PRD §8.8.
//
// PURE. No React, no DOM, no Date.now(), no Math.random() — nothing here is random, which is why
// this file takes no `rng` parameter where engine/wallBall.js does. Follows the house shop contract
// exactly (engine/actSevenModules.js is the reference pair): the engine resolves availability, cost,
// ownership and affordability, and the component renders rows and decides nothing.
//
// THE THREE WAYS PAST EVERY PUZZLE, which is the structural form of design.md Decision 6's
// anti-soft-lock guarantee:
//   1. Solve it.
//   2. Buy the hint ladder — three tiers, the third near-explicit by design.
//   3. OPERATE MANUALLY: attempt on a cooldown until the panel gives up (`attemptsToBypass`).
// Route 3 needs no Salvage, no correct answer and no item, so it cannot be locked out by a poor,
// stuck or simply puzzle-averse player. No puzzle gates the only path forward and no phase
// transition in the act is gated on a puzzle — §5 and §7 own the phase gates and they are resource
// and site conditions.
//
// NOTHING IN advance() WRITES `expedition.puzzles`. `attempts` advances only inside submitAnswer(),
// which is reachable only from a player dispatch, so an eight-hour offline catch-up cannot bypass a
// puzzle, fire a solve toast or change the artifact tab. nextPuzzleCooldownClock() READS the
// boundary and never writes through it. That is what makes this system trivially storm-safe rather
// than idempotent-by-careful-construction.

// The five codes, §8.2. Exported because they are the vocabulary of every caller — a component
// switching on the string 'SOLVED' is a typo away from silently never matching.
const FEEDBACK_CODES = {
  SOLVED: 'SOLVED',
  NEAR: 'NEAR',
  WRONG_KIND: 'WRONG_KIND',
  OUT_OF_BAND: 'OUT_OF_BAND',
  NULL: 'NULL',
};

const HINT_TIERS = [1, 2, 3];

// Colon-namespaced keys in the flat `progression.milestones` map read by isExitSatisfied()
// (engine/progression.js). No new state shape, and the namespacing is what keeps three unrelated
// flags from colliding with an act's exit id.
const MILESTONE_RESOLVED = 'puzzle:';
const MILESTONE_SOLVED = 'puzzleSolved:';
const MILESTONE_ITEM = 'puzzleItem:';

// ---------------------------------------------------------------------------------------------
// Defaulting accessors. THE MOST IMPORTANT PATTERN IN THIS REPO: saves are never migrated
// (persistence/saveLoad.js DISCARDS a save whose meta.version differs and there is no migration
// function), so a slice added today is only safe if absent reads as empty. Every save in existence
// reaches this function with `state.expedition` undefined, and an in-flight Act IV save always will.
//
// Tolerates `state.expedition` being absent ENTIRELY, not merely `.puzzles`.
function puzzleState(state, puzzleId) {
  const stored = expeditionSlice(state).puzzles[puzzleId] || {};
  return {
    attempts: countOf(stored.attempts),
    hintsBought: countOf(stored.hintsBought),
    solved: !!stored.solved,
    bypassed: !!stored.bypassed,
    // ABSENT MUST READ AS READY. 0 is in the past against any clock, so a puzzle with no record is
    // attemptable immediately — which is the only defaulting that keeps a fresh save from opening
    // with nine live governors.
    nextAttemptAtClock: numberOf(stored.nextAttemptAtClock),
    nextSimulateAtClock: numberOf(stored.nextSimulateAtClock),
    // null rather than false: "not simulated yet" and "simulated and it failed" are different
    // things to render, and a boolean cannot hold three states.
    simulatePass: typeof stored.simulatePass === 'boolean' ? stored.simulatePass : null,
  };
}

// A hand-edited save, a NaN out of a bad arithmetic path, or a string where a number belongs must
// all read as zero rather than poison every comparison downstream. Same instinct as
// normalizeResource() in engine/colony.js.
function countOf(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function numberOf(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value;
}

function clockOf(state) {
  return numberOf(state && state.clock);
}

function milestonesOf(state) {
  const progression = (state && state.progression) || {};
  return progression.milestones || {};
}

// INSTRUMENTS LIVE IN `progression.milestones`, NOT IN `expedition.puzzles`, and the reason is
// structural rather than aesthetic. `expedition.puzzles` is keyed by PUZZLE ID and its guard in
// engine/colony.js (isPuzzleMap) only checks that the value is a non-array object — it would
// happily accept a stray `items` key and every `puzzles[puzzleId]` lookup would then have to
// tolerate a record that is not a puzzle. A flat namespaced milestone adds no state shape at all.
function ownsItem(state, itemId) {
  return !!milestonesOf(state)[MILESTONE_ITEM + itemId];
}

function ownedItems(state) {
  return PUZZLE_ITEMS.filter((item) => ownsItem(state, item.id));
}

// ---------------------------------------------------------------------------------------------
// Availability. Phase RANK, never equality — an `aftermath` artifact must stay readable in `lunar`.
// Both -1 cases FAIL OPEN, exactly as getUnlockedFeatures() and engine/actSevenModules.js do: a row
// with no phase, and a run whose phase is unrecognized, both reveal. `expedition.phase` is
// self-healing (recomputed from a pure predicate ladder every advance()), so an unrecognized value
// is a corrupt save one tick from repair. Revealing an artifact early is recoverable; hiding the
// anti-soft-lock path from a save that is about to heal is not.
function hasReachedPhase(currentPhase, requiredPhase) {
  if (!requiredPhase) return true;
  const required = EXPEDITION_PHASES.indexOf(requiredPhase);
  if (required === -1) return true;
  const reached = EXPEDITION_PHASES.indexOf(currentPhase);
  if (reached === -1) return true;
  return reached >= required;
}

function isRevealed(state, definition) {
  return hasReachedPhase(expeditionSlice(state).phase, definition.phase);
}

// ---------------------------------------------------------------------------------------------
// ANSWER NORMALISATION (§8.8). One function, applied to BOTH SIDES of every word and sequence
// comparison, so `3-2`, `3 2`, `3,2`, `three two`, `Full Count` and `the full count` all reach the
// same form or the same accept[] entry. The config carries the mapping; this file carries no
// literals about any particular puzzle.
function normalize(raw) {
  return String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')     // unicode dashes / minus -> hyphen
    .replace(/[.,;:!?'"()[\]]/g, ' ')           // punctuation -> space
    .replace(/\b(the|a|an|is|it)\b/g, ' ')      // articles and copulas
    .replace(/\s*(->|>|→)\s*/g, ' ')       // sequence separators collapse to space
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// NUMBERS GET THEIR OWN NORMALISER, AND THEY HAVE TO. normalize() above strips periods and commas
// to spaces, which is right for `full count.` and catastrophic for `4.0` — it would parse as 4 and
// 0, and `3,200` as 3 and 200. The two normalisers are not a duplication: one is preparing prose
// for a set membership test, the other is preparing a numeral for arithmetic, and the only thing
// they share is the unicode-dash fix (a minus sign pasted from a document is still a minus sign).
//
// Parses the FIRST numeric token, so `4.0 band units` and `about 30` both read. `+4`, `-4` and
// `−4` all parse; `3,200` parses as 3200 because a comma BETWEEN DIGITS is a thousands separator.
function parseNumber(raw) {
  const text = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/(\d),(\d)/g, '$1$2');
  const match = text.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

// A per-code line id, falling back through the candidates in order to the generic line for the
// code. Every id is checked against FEEDBACK_LINES rather than assumed present, so an override this
// file asks for and data/ has not written yet degrades to the generic line instead of rendering
// `undefined` at the player.
function resolveLineId(candidates, code) {
  const found = candidates.find((id) => id && Object.prototype.hasOwnProperty.call(FEEDBACK_LINES, id));
  return found || 'code.' + code;
}

function feedback(code, lineIdCandidates, detail) {
  return { code, lineId: resolveLineId(lineIdCandidates, code), detail: detail || {} };
}

// Does a near[]/wrongKind[] entry match this submission? Entries carry either a numeric `value` or a
// `match` list of strings; both forms are normalised on both sides.
function matchesEntry(entry, normalized, parsed, tolerance) {
  if (entry == null) return false;
  if (typeof entry.value === 'number') {
    if (parsed === null) return false;
    const band = typeof entry.tolerance === 'number' ? entry.tolerance : tolerance;
    return Math.abs(parsed - entry.value) <= band;
  }
  const list = Array.isArray(entry.match) ? entry.match : [entry.match];
  return list.some((candidate) => normalize(candidate) === normalized);
}

function findEntry(entries, normalized, parsed, tolerance) {
  return (entries || []).find((entry) => matchesEntry(entry, normalized, parsed, tolerance)) || null;
}

// --- the three comparators, selected by inputKind ---

// NUMBERS ALWAYS GIVE DIRECTION, at every distance, which makes them binary-searchable — and that
// is intended, not a leak. Binary search IS the brute-force path for a number and it is priced by
// the attempt cooldown rather than forbidden: a ten-step search at a 90s cooldown is fifteen
// minutes, which is the same order as attemptsToBypass x cooldown, so neither route dominates and
// there is no exploit to find.
function numberFeedback(definition, input) {
  const answer = definition.answer || {};
  const tolerance = numberOf(answer.tolerance);
  const parsed = parseNumber(input);
  if (parsed === null) {
    return feedback(FEEDBACK_CODES.NULL, ['number.NULL'], {});
  }

  const delta = parsed - answer.value;
  if (Math.abs(delta) <= tolerance) {
    return feedback(FEEDBACK_CODES.SOLVED, [prefixed(definition, 'SOLVED')], {});
  }

  const direction = delta < 0 ? 'LOW' : 'HIGH';
  const detail = { direction };

  // The empathy path first: an authored near[] entry beats the generic band, because it was written
  // for a player who understood MORE than was asked. "YOU ARE COUNTING ARRIVALS. THE PROGRAM DOES
  // NOT SCORE ARRIVALS." is a different sentence from "CLOSE. YOUR FIGURE IS HIGH." and it is the
  // difference between a game that respects the person playing it and one that doesn't.
  const entry = findEntry(definition.near, normalize(input), parsed, tolerance);
  if (entry) return feedback(FEEDBACK_CODES.NEAR, [entry.lineId], detail);

  // §8.2's generic band: NEAR out to 2x tolerance. Where tolerance is 0 this band is empty by
  // construction and the near[] table above is the only NEAR available — which is correct for a
  // puzzle whose answer is a count.
  if (Math.abs(delta) <= tolerance * 2) {
    return feedback(FEEDBACK_CODES.NEAR, ['number.NEAR.' + direction], detail);
  }
  return feedback(FEEDBACK_CODES.OUT_OF_BAND, ['number.OUT_OF_BAND.' + direction], detail);
}

// SEQUENCES GIVE POSITIONAL COUNTS, NOT "WARMER". `2 OF 4 IN POSITION` is real information and a
// careful player converges in three or four submissions; withholding it makes a 24-way permutation
// a lottery, and a lottery is not a puzzle.
function sequenceFeedback(definition, input) {
  const expected = definition.sequence || [];
  const synonyms = definition.tokenSynonyms || {};
  const normalized = normalize(input);
  const tokens = normalized.length ? normalized.split(' ').map((token) => synonyms[token] || token) : [];
  const detail = { inPosition: 0, of: expected.length };

  if (tokens.length < expected.length) {
    return feedback(FEEDBACK_CODES.NULL, ['sequence.NULL'], detail);
  }

  // A token that is not one of the bodies on the plate is a DIFFERENT MISTAKE from filing the right
  // four in the wrong order, and gets a different answer. Checked before the positional count so a
  // typo cannot be reported as "1 OF 4 IN POSITION", which would be worse than useless.
  const known = (definition.sequenceTokens || expected).map((token) => normalize(token));
  if (tokens.some((token) => known.indexOf(token) === -1)) {
    return feedback(FEEDBACK_CODES.WRONG_KIND, ['sequence.WRONG_KIND'], detail);
  }

  const inPosition = expected.reduce(
    (count, token, index) => count + (normalize(token) === tokens[index] ? 1 : 0),
    0
  );
  detail.inPosition = inPosition;

  if (inPosition === expected.length && tokens.length === expected.length) {
    return feedback(FEEDBACK_CODES.SOLVED, [prefixed(definition, 'SOLVED')], detail);
  }
  if (inPosition * 2 >= expected.length) {
    return feedback(FEEDBACK_CODES.NEAR, ['sequence.NEAR'], detail);
  }
  return feedback(FEEDBACK_CODES.OUT_OF_BAND, ['sequence.OUT_OF_BAND'], detail);
}

// WORDS: membership in a normalised accept[], then near[] (right kind of thing), then wrongKind[]
// (a real baseball term for the wrong event), before falling through to OUT_OF_BAND. NEAR and
// WRONG_KIND are the empathy codes and they are checked in that order because a near answer is a
// closer reading than a wrong-event one.
function wordFeedback(definition, input) {
  const normalized = normalize(input);
  if (!normalized.length) {
    return feedback(FEEDBACK_CODES.NULL, ['word.NULL'], {});
  }
  const accept = (definition.accept || []).map((candidate) => normalize(candidate));
  if (accept.indexOf(normalized) !== -1) {
    return feedback(FEEDBACK_CODES.SOLVED, [prefixed(definition, 'SOLVED')], {});
  }
  const near = findEntry(definition.near, normalized, null, 0);
  if (near) return feedback(FEEDBACK_CODES.NEAR, [near.lineId], {});

  const wrongKind = findEntry(definition.wrongKind, normalized, null, 0);
  if (wrongKind) return feedback(FEEDBACK_CODES.WRONG_KIND, [wrongKind.lineId], {});

  return feedback(FEEDBACK_CODES.OUT_OF_BAND, ['word.OUT_OF_BAND'], {});
}

// A puzzle may override any generic code line with its own, keyed `<id>.<CODE>` in FEEDBACK_LINES.
// resolveLineId falls through to the generic line when no override is authored, so this costs
// nothing until someone writes one.
function prefixed(definition, code) {
  return definition.id + '.' + code;
}

// { code, lineId, detail } — A CODE AND A KEY, NEVER A COMPOSED STRING. Prose is substituted by the
// renderer out of FEEDBACK_LINES. Stateless by design: it takes an id and an input and reads no
// state, which is what lets a component show feedback and dispatch the attempt from the same
// keystroke without the two disagreeing.
function answerFeedback(puzzleId, input) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return feedback(FEEDBACK_CODES.NULL, ['code.NULL'], {});
  if (definition.inputKind === 'number') return numberFeedback(definition, input);
  if (definition.inputKind === 'sequence') return sequenceFeedback(definition, input);
  return wordFeedback(definition, input);
}

// TAKES AN ID, NEVER AN ACCEPT LIST. No component ever receives one, which is the same rule that
// makes `text: null` a hard requirement on unbought hints below.
function checkAnswer(puzzleId, input) {
  return answerFeedback(puzzleId, input).code === FEEDBACK_CODES.SOLVED;
}

// ---------------------------------------------------------------------------------------------
// Cooldowns.
//
// Item effects are read as DECLARED KEYS rather than by item id — no item id appears anywhere in
// this file, so a seventh instrument is a row in data/ and nothing else. Multipliers compose by
// product, so two cooldown items would stack rather than one silently winning.
function attemptCooldownSeconds(state, puzzleId) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return 0;
  const base = numberOf(definition.attemptCooldownSeconds);
  if (base <= 0) return 0;
  const multiplier = ownedItems(state).reduce((product, item) => {
    const factor = item.cooldownMultiplier;
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) return product;
    return product * factor;
  }, 1);
  return base * multiplier;
}

// THE CLAMP IS LIFTED FROM engine/clicker.js FOR THE THREE REASONS ITS HEADER GIVES. The wait is
// clamped to what the CURRENT config declares, so a stale nextAttemptAtClock — a hand-edited save, a
// retune that shortened the cooldown, the Governor Bypass bought mid-wait — can never ask for a
// longer lockout than the puzzle in front of the player says it will. An absent field reads 0: in
// the past, therefore ready.
function attemptCooldownRemaining(state, puzzleId) {
  const seconds = attemptCooldownSeconds(state, puzzleId);
  if (seconds === 0) return 0;
  const target = puzzleState(state, puzzleId).nextAttemptAtClock - clockOf(state);
  return Math.max(0, Math.min(seconds, target));
}

// A UI-WAKE BOUNDARY, NOT A RATE BOUNDARY (ledger R5). It changes no rate, so Decision 3.3's
// linear-within-a-step requirement and the closed-form solve in nextColonyThresholdClock() are
// untouched. It exists only so an offline catch-up lands a step the moment a governor expires,
// rather than showing a stale OPERATE MANUALLY button on a panel that is actually still locked.
//
// RETURNS Infinity WHEN NOTHING IS PENDING — never 0, null or undefined. A 0 here pins advance()'s
// step at zero and burns all 2,000 safety iterations, and the trap is specific: puzzleState()
// defaults nextAttemptAtClock to 0, so a naive Math.min over the map returns 0 for every puzzle that
// has a record and no live cooldown. Deriving each candidate from attemptCooldownRemaining() and
// keeping only the strictly positive ones makes that unreachable — and it makes the boundary agree
// with the clamp, so a shortened cooldown wakes the loop at the time the panel promises rather than
// at the stale deadline in the save.
function nextPuzzleCooldownClock(state) {
  const clock = clockOf(state);
  return ACT_SEVEN_PUZZLES.reduce((soonest, definition) => {
    const remaining = attemptCooldownRemaining(state, definition.id);
    if (remaining <= 0) return soonest;
    return Math.min(soonest, clock + remaining);
  }, Infinity);
}

// ---------------------------------------------------------------------------------------------
// Hints.

// An item makes exactly the tier it names free, on the puzzles it names (an absent freeHintPuzzles
// means every puzzle; an EMPTY ARRAY means none, and the two are one keystroke apart). Exact tier
// rather than "this tier and below": the Recovered Scorecard is a tier-2 item, and letting it imply
// tier 1 would make the Flight Manual dead config the moment a player owned both.
function grantsFreeHint(state, puzzleId, tier) {
  return ownedItems(state).some((item) => {
    if (item.freeHintTier !== tier) return false;
    if (!Array.isArray(item.freeHintPuzzles)) return true;
    return item.freeHintPuzzles.indexOf(puzzleId) !== -1;
  });
}

// The baked §8.4 price, or 0 when an owned item makes that tier free. Reads the price out of data/;
// the formula that generated it is a comment beside it there, deliberately not a computation here.
function hintCost(state, puzzleId, tier) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return 0;
  if (HINT_TIERS.indexOf(tier) === -1) return 0;
  if (grantsFreeHint(state, puzzleId, tier)) return 0;
  const ladder = HINT_COSTS[definition.phase] || [];
  return numberOf(ladder[tier - 1]);
}

// Buys the next unbought tier. New state, or null for refused — an unknown id, a puzzle already
// resolved, a ladder already exhausted, or a price the player cannot meet.
//
// A FREE TIER STILL GOES THROUGH engine/wallet.js. debitWallet(w, c, 0) is the identity write and
// canAfford(w, c, 0) is true at any balance including zero, so there is no branch here and no second
// path by which a currency could move. Every wallet write in this game goes through that module and
// an exception "because it is free" is how the second exception gets written.
function buyHint(state, puzzleId) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return null;

  const current = puzzleState(state, puzzleId);
  if (current.solved || current.bypassed) return null;

  const tier = current.hintsBought + 1;
  if (HINT_TIERS.indexOf(tier) === -1) return null;

  const cost = hintCost(state, puzzleId, tier);
  if (!canAfford(state.wallet, PUZZLE_CURRENCY, cost)) return null;

  const next = withPuzzleRecord(state, puzzleId, { ...current, hintsBought: tier });
  return { ...next, wallet: debitWallet(state.wallet, PUZZLE_CURRENCY, cost) };
}

// ---------------------------------------------------------------------------------------------
// Writes. Both accessors spread their own defaulted shape back, which engine/concessions.js records
// the reason for at length: a key one copy of the shape forgets is a key every later write silently
// deletes.
function withPuzzleRecord(state, puzzleId, record) {
  const slice = expeditionSlice(state);
  return {
    ...state,
    expedition: { ...slice, puzzles: { ...slice.puzzles, [puzzleId]: record } },
  };
}

// Guarded on both sides, not just the read. `state.progression` can be absent exactly as
// `state.expedition` can, and a spread of undefined is a silent empty object rather than a throw —
// which would quietly discard every milestone the player had earned.
function withMilestones(state, keys) {
  const progression = (state && state.progression) || {};
  const milestones = { ...(progression.milestones || {}) };
  keys.forEach((key) => {
    milestones[key] = true;
  });
  return { ...state, progression: { ...progression, milestones } };
}

// TWO FLAGS ON RESOLUTION, AND THE SPLIT IS THE ANTI-SOFT-LOCK GUARANTEE EXPRESSED AS A NAMING
// CONVENTION. `puzzle:<id>` is set on SOLVE OR BYPASS, and every downstream gate — §5's regulator
// override, §7's assist route — reads that one key and therefore CANNOT accidentally distinguish
// the two routes. `puzzleSolved:<id>` is set on solve only and is read by nothing except
// aptitudeSummary() and §10's ending text.
//
// Deliberately NOT a third `solvedUnaided` key: §9's Rule 5 Draft needs the hint count, which lives
// in the slice, so it goes through the export below instead of duplicating state that could drift.
function resolutionMilestones(puzzleId, solved) {
  const keys = [MILESTONE_RESOLVED + puzzleId];
  if (solved) keys.push(MILESTONE_SOLVED + puzzleId);
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Attempts.
//
// REFUSES RATHER THAN THROWS when the cooldown is live, matching applyClick() and
// resolveChallenge(), so a double-dispatch or a second browser tab cannot double-count an attempt.
// Returns new state or null; the feedback the player reads comes from answerFeedback(), which is
// stateless and can be called on the same keystroke.
//
// A null input is the OPERATE MANUALLY path: it grades as NULL, records an attempt like any other,
// and is the same code path with a different label. One path, two labels — a separate brute-force
// function would be a second place that has to remember to set the milestones.
function submitAnswer(state, puzzleId, input) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return null;

  const current = puzzleState(state, puzzleId);
  if (current.solved || current.bypassed) return null;
  if (attemptCooldownRemaining(state, puzzleId) > 0) return null;

  const attempts = current.attempts + 1;
  const solved = checkAnswer(puzzleId, input);
  // The panel gives up. `attemptsToBypass` is a CEILING ON THE WORST CASE, not a pace — a player who
  // deduces should beat it, and the counter exists so that one who does not is never stuck.
  const bypassed = !solved && attempts >= countOf(definition.attemptsToBypass);
  const resolved = solved || bypassed;

  const record = {
    ...current,
    attempts,
    solved,
    bypassed,
    // A resolved puzzle clears its governor rather than leaving a deadline nothing will ever read.
    nextAttemptAtClock: resolved ? 0 : clockOf(state) + attemptCooldownSeconds(state, puzzleId),
  };

  const next = withPuzzleRecord(state, puzzleId, record);
  return resolved ? withMilestones(next, resolutionMilestones(puzzleId, solved)) : next;
}

// Alias. One code path, two labels — see submitAnswer().
function attemptBruteForce(state, puzzleId) {
  return submitAnswer(state, puzzleId, null);
}

// ---------------------------------------------------------------------------------------------
// SIMULATE (§8.5's Inertial Plot Table). Records no attempt and consumes no ATTEMPT cooldown; the
// bench's own 20-second run time is a separate deadline, which is why the field is
// `nextSimulateAtClock` and not a second use of the first.
//
// It reports PASS/FAIL and nothing else — no direction, no `n OF 4` — and that is what stops it
// from strictly dominating SUBMIT. A bare PASS/FAIL carries no ordering, so a simulate-driven search
// is LINEAR over the candidate set where a submit-driven one is logarithmic on direction. The
// measured crossover is in data/actSevenPuzzlesConfig.js's tuning block.
//
// Returns null when the item is not owned or the bench is still running: refusal is null, and a
// player who cannot see the button cannot reach this anyway.
function simulateSeconds(state) {
  return ownedItems(state).reduce((longest, item) => {
    if (!item.enablesSimulate) return longest;
    return Math.max(longest, numberOf(item.simulateSeconds));
  }, 0);
}

function canSimulate(state) {
  return ownedItems(state).some((item) => !!item.enablesSimulate);
}

function simulateAnswer(state, puzzleId, input) {
  const definition = getPuzzleDefinition(puzzleId);
  if (!definition) return null;
  if (!canSimulate(state)) return null;

  const current = puzzleState(state, puzzleId);
  if (current.solved || current.bypassed) return null;
  if (current.nextSimulateAtClock - clockOf(state) > 0) return null;

  return withPuzzleRecord(state, puzzleId, {
    ...current,
    simulatePass: checkAnswer(puzzleId, input),
    nextSimulateAtClock: clockOf(state) + simulateSeconds(state),
  });
}

// ---------------------------------------------------------------------------------------------
// Presentation.

function statusOf(record) {
  if (record.solved) return 'solved';
  if (record.bypassed) return 'bypassed';
  return 'open';
}

// TEXT: NULL FOR UNBOUGHT HINTS IS A HARD RULE, NOT AN OPTIMISATION. Prose that reaches the row
// reaches the DOM, and a player who opens devtools out of idle curiosity is handed a spoiler they
// did not ask for. Same reasoning as `revealed` in engine/lotShop.js: what the component cannot see,
// it cannot leak. The answers themselves ship readable in dist/main.js and that is fine — tier 3 is
// near-explicit by design, so the bundle is at worst a free hint the player could have bought, and
// obfuscating would mean moving prose out of data/ for no gain.
function hintRows(state, definition, record) {
  return HINT_TIERS.map((tier) => {
    const bought = record.hintsBought >= tier;
    const cost = hintCost(state, definition.id, tier);
    return {
      tier,
      cost,
      bought,
      affordable: balanceOf(state.wallet, PUZZLE_CURRENCY) >= cost,
      text: bought ? definition.hints[tier - 1] : null,
    };
  });
}

// Presentation-ready rows, availability resolved — the same spirit and structure as
// engine/lotShop.js's listOffers(). The component renders these and recomputes nothing.
//
// UNREVEALED ROWS ARE OMITTED, NOT DISABLED, as everywhere else in this game: the reveal is the
// reward, and a greyed-out Final Certification in the aftermath is a spoiler for four phases.
function listPuzzles(state) {
  const translated = ownedItems(state).some((item) => !!item.translatesPrompts);
  const readoutIds = ownedItems(state).reduce(
    (ids, item) => (Array.isArray(item.readoutPuzzles) ? ids.concat(item.readoutPuzzles) : ids),
    []
  );

  return ACT_SEVEN_PUZZLES.filter((definition) => isRevealed(state, definition)).map((definition) => {
    const record = puzzleState(state, definition.id);
    return {
      id: definition.id,
      name: definition.name,
      artifact: definition.artifact,
      phase: definition.phase,
      inputKind: definition.inputKind,
      inputLabel: definition.inputLabel,
      unlocksLabel: definition.unlocksLabel,
      ignoredLabel: definition.ignoredLabel,
      // The Lexicon Core changes no answer and no number — it removes vocabulary friction so the
      // puzzle is the puzzle. A panel with no program vocabulary authors no translation and falls
      // back to its own prompt rather than being excluded from the item's effect.
      prompt: (translated && definition.promptTranslated) || definition.prompt,
      revealed: true,
      status: statusOf(record),
      attempts: record.attempts,
      attemptsToBypass: countOf(definition.attemptsToBypass),
      cooldownRemaining: attemptCooldownRemaining(state, definition.id),
      hints: hintRows(state, definition, record),
      instrumentReadout:
        readoutIds.indexOf(definition.id) !== -1 ? definition.instrumentReadout || null : null,
      canSimulate: canSimulate(state),
      simulatePass: record.simulatePass,
      simulateRemaining: Math.max(0, record.nextSimulateAtClock - clockOf(state)),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// The instrument shop, in the house shop contract — listOffers/purchase named for what they sell.
function listInstruments(state) {
  const slice = expeditionSlice(state);
  const balance = balanceOf(state.wallet, PUZZLE_CURRENCY);

  return PUZZLE_ITEMS.filter((item) => hasReachedPhase(slice.phase, item.availableFrom)).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    effect: item.effectLabel,
    cost: item.cost,
    currency: PUZZLE_CURRENCY,
    owned: ownsItem(state, item.id),
    affordable: balance >= item.cost,
  }));
}

// New state, or null when the purchase is not permitted — an unknown id, a phase the run has not
// reached, one already owned, or one the player cannot afford. Refusal is null from the engine and
// an unchanged state from the reducer.
function buyInstrument(state, itemId) {
  const item = getPuzzleItemDefinition(itemId);
  if (!item) return null;
  if (!hasReachedPhase(expeditionSlice(state).phase, item.availableFrom)) return null;
  if (ownsItem(state, itemId)) return null;
  if (!canAfford(state.wallet, PUZZLE_CURRENCY, item.cost)) return null;

  const next = withMilestones(state, [MILESTONE_ITEM + itemId]);
  return { ...next, wallet: debitWallet(state.wallet, PUZZLE_CURRENCY, item.cost) };
}

// ---------------------------------------------------------------------------------------------
// Predicates for other systems. BOTH OF THESE EXIST SO THAT NOTHING ELSE READS
// `state.expedition.puzzles` DIRECTLY — ledger R5's layer ruling, the same one applied to Fuel.
// §9's Rule 5 Draft contract and §10's `act-7-first-puzzle` feed trigger both call solvedUnaided().

// `solved && hintsBought === 0`. Omit the id to ask "any puzzle at all", which is the form the feed
// trigger wants: the first unaided solve is a moment, not a property of a particular artifact.
function solvedUnaided(state, puzzleId) {
  if (puzzleId == null) {
    return ACT_SEVEN_PUZZLES.some((definition) => solvedUnaided(state, definition.id));
  }
  const record = puzzleState(state, puzzleId);
  return record.solved && record.hintsBought === 0;
}

// For §10's ending text. `unresolved` counts artifacts the player left open, which is the figure
// that separates APTITUDE CONFIRMED from PERSISTENT — and both are §10's strings, not this file's.
function aptitudeSummary(state) {
  return ACT_SEVEN_PUZZLES.reduce(
    (summary, definition) => {
      const record = puzzleState(state, definition.id);
      if (record.solved) {
        summary.solved += 1;
        if (record.hintsBought === 0) summary.unaided += 1;
      } else if (record.bypassed) {
        summary.bypassed += 1;
      } else {
        summary.unresolved += 1;
      }
      return summary;
    },
    { solved: 0, bypassed: 0, unaided: 0, unresolved: 0 }
  );
}

module.exports = {
  FEEDBACK_CODES,
  PUZZLE_CURRENCY,
  listPuzzles,
  checkAnswer,
  answerFeedback,
  submitAnswer,
  attemptBruteForce,
  buyHint,
  hintCost,
  listInstruments,
  buyInstrument,
  simulateAnswer,
  attemptCooldownSeconds,
  attemptCooldownRemaining,
  nextPuzzleCooldownClock,
  solvedUnaided,
  aptitudeSummary,
};
