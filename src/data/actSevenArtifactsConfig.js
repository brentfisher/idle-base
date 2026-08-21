const { FEEDBACK_LINES } = require('./actSevenPuzzlesConfig');
const { formatNumber, formatDuration } = require('../utils/formatNumber');

// The Artifacts panel's furniture — every player-facing string the puzzle surface draws that is not
// already authored on an artifact, plus the two presentation mappings the screen needs (PRD §6.4,
// §8). data/actSevenFabConfig.js is the pattern, down to the function-valued fields for the lines
// that interpolate a number, and it states the rule this file also follows: a string literal in a
// component is a string nobody editing the act's voice will ever find.
//
// NOTHING HERE RESTATES AN ARTIFACT. No prompt, no hint, no feedback line, no unlocks sentence and
// no instrument description: all of those are authored in data/actSevenPuzzlesConfig.js beside the
// answers they belong to, and they reach the panel through engine/puzzles.js's listPuzzles() and
// listInstruments(). What is here is the screen's own words — the headings, the two button labels,
// the status chips and the sentences that explain the three ways past a panel.
//
// THE ONE THING THIS FILE IS ALLOWED TO KNOW ABOUT §8'S PROSE is how to finish a line: FEEDBACK_LINES
// carries `{n}` and `{of}` placeholders and its own comment says they "are substituted by the
// renderer", because the alternative — the engine composing the sentence — would put a
// player-facing string in src/engine/. feedbackLine() below is that renderer, and it lives here
// rather than in the component for the same reason costLabel() does.

// ---------------------------------------------------------------------------------------------
// THE TWO SUBSTITUTIONS, AND WHY THEY ARE NAMED EXPLICITLY RATHER THAN LOOPED OVER `detail`.
//
// `sequence.NEAR` reads '{n} OF {of} IN POSITION.' and sequenceFeedback() returns
// `{ inPosition, of }` — the placeholder is `{n}` and the field is `inPosition`, so the obvious
// construction (iterate the keys of `detail`, replace `{key}`) leaves a literal `{n}` on the
// screen and silently ships. Naming the pair here is the whole fix, and it is also the place a
// future placeholder gets added: one line, next to the one it is modelled on.
//
// `direction` (LOW / HIGH) is deliberately NOT substituted. The numeric lines bake it into the
// line id — `number.NEAR.LOW` is its own authored sentence — so there is nothing to fill in, and
// adding a `{direction}` substitution here would create a second way to say the same thing.
const SUBSTITUTIONS = [
  ['{n}', (detail) => detail.inPosition],
  ['{of}', (detail) => detail.of],
];

// A lineId and the engine's `detail`, rendered. Returns null for an id this file's own map does not
// carry, which the panel treats as "say nothing": engine/puzzles.js's resolveLineId() already falls
// back to the generic line for the code before it returns, so a null here means data drift rather
// than an ordinary miss, and printing `undefined` at the player is the one outcome worse than
// printing nothing.
function feedbackLine(lineId, detail) {
  const line = Object.prototype.hasOwnProperty.call(FEEDBACK_LINES, lineId) ? FEEDBACK_LINES[lineId] : null;
  if (line == null) return null;
  const values = detail || {};
  return SUBSTITUTIONS.reduce((text, [token, read]) => {
    const value = read(values);
    if (value == null) return text;
    return text.split(token).join(String(value));
  }, line);
}

// WHICH COLOUR A FEEDBACK CODE WEARS IS A READING OF THE RESULT, NOT FORMATTING, so it is decided
// here beside the act's other tone tables (data/colonyReadoutConfig.js's rateClass() is the pattern)
// and never as a conditional in the component.
//
// This is the mapping §8.1's binding rule — "the goal may be unclear; the FEEDBACK never is" —
// actually cashes out in. NEAR and WRONG_KIND are the empathy codes and they must not read alike:
// a near miss is a player who has the right kind of answer and the wrong value, and a wrong-kind
// answer is a player pointed at the wrong question entirely. If those two draw the same, the graded
// feedback the engine went to such lengths to produce arrives at the player as one undifferentiated
// "no", and the story's whole point is thrown away at the last inch.
//
//   SOLVED      --v7-good     the act's "this is fine" colour, shared with a fed resource meter
//   NEAR        --v7-accent   the amber. The act's ONE warm colour, reserved for what the player
//                             caused — and a near miss is the most player-caused thing on the
//                             screen. It says keep going, at the same temperature as a price.
//   WRONG_KIND  --v7-ink      full-strength text, undimmed: this is a real sentence about a real
//                             misreading and the player should read it. Deliberately not the alert
//                             colour — a wrong answer is not a fault condition, and the act reserves
//                             --v7-alert for a colony that is actually breaking.
//   OUT_OF_BAND / NULL        blue-grey. Nothing was learned; the line says so quietly.
const FEEDBACK_CLASSES = {
  SOLVED: 'is-solved',
  NEAR: 'is-near',
  WRONG_KIND: 'is-wrong-kind',
  OUT_OF_BAND: 'is-out-of-band',
  NULL: 'is-null',
};

function feedbackClass(code) {
  return FEEDBACK_CLASSES[code] || '';
}

const artifactsCopy = {
  // Duplicated from the `artifacts` row in data/actSevenPanels.js exactly as fabCopy.title is
  // duplicated from `fab`'s: that list is the TAB BAR's source, and a panel reaching into the tab
  // registry for its own <h2> would couple the two so that renaming a tab retitles a screen.
  title: 'Artifacts',
  subtitle: 'Recovered equipment from a program that was testing you before you knew it was. Read '
    + 'the panel, answer it, and it gives you what it was holding.',

  // THE ANTI-SOFT-LOCK GUARANTEE, IN WORDS, AT THE TOP OF THE SCREEN. Decision 3.6 makes it
  // structural — every artifact has three independent ways past and one of them needs no answer,
  // no Salvage and no purchase — and a guarantee the player cannot see does not reassure anyone.
  // It is stated once here rather than repeated on nine rows, and the controls that discharge it
  // are on every row underneath.
  guaranteeTitle: 'Three ways past every panel',
  guaranteeNote: 'Answer it. Or buy the hint ladder. Or operate it manually until it gives up and '
    + 'releases the equipment anyway. Nothing on this tab gates the crossing — an artifact you never '
    + 'open costs you a convenience, never the ending.',

  // Defensive, and it should be seen exactly once per run: no artifact is revealed before its own
  // phase, so the tab opens empty for a player who reaches it early through the tab bar.
  emptyNote: 'Nothing recovered yet. Artifacts turn up as the expedition moves out.',

  // The status chip. `bypassed` is the panel giving up, and it is worded as the panel's decision
  // rather than the player's failure — that is the register §8.7 asks the brute-force path to be
  // read in, and a chip that said FAILED would make the anti-soft-lock route feel like a penalty
  // for using it.
  statusLabel: {
    open: 'OPEN',
    solved: 'ACCEPTED',
    bypassed: 'RELEASED',
  },
  statusNote: {
    open: null,
    solved: 'The panel accepted your answer.',
    bypassed: 'The panel gave up and released the equipment.',
  },
  // Solved with no hint bought. The engine distinguishes it (solvedUnaided) because §9's Rule 5
  // Draft and §10's ending text both read it, so the panel distinguishes it too — otherwise the
  // one thing in the act that records how the player got there is invisible to the player.
  unaidedLabel: 'UNAIDED',

  unlocksLabel: 'Unlocks',
  ignoredLabel: 'If ignored',
  readoutLabel: 'Instrument readout',

  // The submission control. `inputLabel` comes off the row — BURNS, BAND UNITS, PAIR, ORDER — so
  // the field is labelled in the panel's own vocabulary rather than with a generic "Answer".
  answerLabel: (inputLabel) => 'STATE ' + inputLabel,
  submitLabel: 'SUBMIT',

  // THE BRUTE-FORCE PATH, LABELLED AS ITS OWN CONTROL AND NOT AS AN EMPTY SUBMIT. Mechanically it
  // is submitAnswer(state, id, null) and the engine says so — "one code path, two labels" — but the
  // two labels are the point: a player must be able to SEE the route that needs no answer, or the
  // guarantee is only true in the source code.
  manualLabel: 'OPERATE MANUALLY',
  manualNote: 'Records an attempt and nothing else. Enough of them and the panel releases the '
    + 'equipment without an answer.',
  // What the panel says back to a deliberate manual attempt. The engine grades it NULL and the
  // authored NULL line is "THE PANEL READS FIGURES. IT READ NONE." — correct for a fumbled submit
  // and wrong for a labelled control the player pressed on purpose, where it would read as a bug.
  // Same code, same recorded attempt, different sentence, because the two are different acts.
  manualLine: 'ATTEMPT LOGGED. NO ANSWER OFFERED.',

  // The governor. The number comes from attemptCooldownRemaining() and is live because `state.clock`
  // advances every tick — there is no timer in this panel and nextPuzzleCooldownClock() is already
  // on the event-clock contributor list so the boundary lands rather than being noticed late.
  cooldownLabel: (seconds) => 'PANEL BUSY — ' + formatDuration(seconds),
  readyLabel: 'PANEL READY',
  // How close the panel is to giving up. Both figures come off the row; nothing here multiplies
  // attempts by a cooldown to estimate a wall time, because the engine exports no such figure and
  // §8.7's published table is about one cooldown pessimistic (the first attempt is free).
  attemptsLabel: (attempts, toBypass) => attempts + ' of ' + toBypass + ' attempts',

  hintsTitle: 'Hint ladder',
  hintsNote: 'Three tiers. Each one is more explicit than the last, and the third is nearly the '
    + 'answer. Buying one is recorded — the program notices whether you needed help.',
  hintTierLabel: (tier) => 'TIER ' + tier,
  // A free tier still reads as a price rather than as an absence, because an owned instrument is
  // what made it free and the player should be able to see the instrument working.
  hintCostLabel: (cost) => (cost > 0 ? formatNumber(cost) + ' Salvage' : 'FREE'),
  // Tiers are bought in order — buyHint() always buys `hintsBought + 1` and takes no tier — so a
  // tier that is not next carries no control at all. A button that silently bought a different
  // thing than the one it sat on would be the worst kind of shop row.
  hintLockedLabel: 'LOCKED',

  instrumentsTitle: 'Instruments',
  instrumentsNote: 'Permanent equipment. An instrument changes how the rest of the act reads; a '
    + 'hint changes one panel.',
  instrumentOwnedLabel: 'OWNED',
  instrumentCostLabel: (cost) => formatNumber(cost) + ' Salvage',
  instrumentsEmptyNote: 'No instruments on offer yet.',

  // The Inertial Plot Table (§8.5). Only ever drawn when an owned instrument enables it, so the
  // sentence can assume the player just bought the bench.
  simulateLabel: 'SIMULATE',
  simulateNote: 'The bench runs your answer against the panel\'s own model. No attempt recorded, no '
    + 'governor consumed. It reports PASS or FAIL and nothing else.',
  simulateBusyLabel: (seconds) => 'BENCH RUNNING — ' + formatDuration(seconds),
  simulateResultLabel: (pass) => (pass ? 'BENCH: PASS' : 'BENCH: FAIL'),
};

module.exports = { artifactsCopy, feedbackLine, feedbackClass };
