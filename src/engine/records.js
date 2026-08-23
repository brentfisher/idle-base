const { generateId } = require('../utils/randomUtils');
// FINAL_ACT_INDEX, not PRESTIGE_ACT_INDEX: this file cares about the act the odyssey ENDS in, which
// is a different question from where prestige drops a player. data/acts.js explains the trap.
const { FINAL_ACT_INDEX } = require('../data/acts');
// The record card — how the run in progress has gone so far. Pure: no React, no DOM, no storage.
//
// TWO SLICES, AND THE SPLIT BETWEEN THEM IS THE WHOLE DESIGN (PRD §3.2). What lives HERE, in game
// state, is the run in progress: the per-act durations, the counters instants write, and the
// achievements earned this run. What lives in persistence/recordsStore.js is the CAREER — finished
// runs and the achievements collected across all of them — and it lives there because
// persistence/saveLoad.js holds exactly one key and clearSave() deletes it. A career record kept
// in the save would be destroyed by the very act that completes a run.
//
// NEITHER SLICE BUMPS meta.version, and that is not an oversight. Saves are never migrated in this
// repo (persistence/saveLoad.js discards on mismatch), so the rule every new slice follows is the
// one salvage-currency-expedition-slice established: add the slice, add a defaulting accessor, and
// let a save written before it existed read as "this has no history" rather than as a crash or a
// wipe. Both accessors below exist for that and for nothing else.
// The counters instants write and the evaluator reads (PRD §4). A resolved rally and a settled
// wager cannot unlock anything themselves — that is STORY-042's single-evaluation-site rule — so
// they leave a number here and the tick loop reads it on its next pass.
//
// Present-and-empty rather than grown on demand: a bag whose keys appear one at a time is a bag
// every reader has to guard, and `(counters.bestBookiePayoutMult || 0) > 3` is the kind of guard
// that is correct until somebody forgets it once.
function emptyCounters() {
  return {
    bookieWins: 0,
    bestBookiePayoutMult: 0,
    bestPropPayoutMult: 0,
    // The live streak's mirror. engine/wallBall.js gets its own `streak` field in STORY-042 —
    // this is the copy the evaluator reads, so a predicate never reaches across into another
    // domain's slice for a number that is already a counter.
    wallBallStreak: 0,
    bestWallBallStreak: 0,
    showboatStreak: 0,
    undefeatedSeasons: 0,
    // THINGS THAT CANNOT HAPPEN, COUNTED RATHER THAN IGNORED. A clock that runs backwards across
    // an act boundary is not a bug the game can produce: `state.clock` only ever increases, in
    // advance(), by a non-negative delta. Seeing one means the save was edited or the state was
    // reached through the console, and the `cheater` achievement is what this counter feeds.
    //
    // It is a COUNT and not a boolean on purpose: an accidental one-off and a save being driven
    // by hand look different, and a number can tell them apart later. Nothing is ever taken away
    // from the player for it — see the note on the predicate in data/achievementsConfig.js.
    integrityViolations: 0,
    // Act II's Showboat streak, best-of. Kept beside the plain streak for the same reason
    // `bestWallBallStreak` is: a streak is destroyed by the loss that ends it, so a predicate that
    // only ever sees the live value can miss a run that happened between two ticks.
    bestShowboatStreak: 0,
    // The clock at which Act VII's FIRST module was bought, written once and never overwritten.
    // `sifter` subtracts the act's entry stamp from it; 0 means no module has been bought yet.
    firstModuleAtClock: 0,
  };
}

// One writer for the counters bag, so the immutable spread is written once rather than at every
// call site. `patch` receives the fully-defaulted counters and returns the fields it is changing —
// a caller that returns a whole bag would silently delete any key it had not heard of, which is the
// failure engine/concessions.js records in full.
function bumpCounters(state, patch) {
  const slice = recordSlice(state);
  const changes = patch(slice.counters);
  if (!changes) return state;
  return {
    ...state,
    record: { ...slice, counters: { ...slice.counters, ...changes } },
  };
}

// Every read of the record slice goes through this, for the same reason clickerSlice() and
// bookieSlice() exist: a save written before the field existed has to LOAD AND BEHAVE, not be
// repaired. `actSeconds` is the field that matters — absent must mean "no act has been timed",
// which is a different statement from "every act took zero seconds" and is the one the surfaces
// are required to make (PRD §4).
//
// `startedAtClock` IS 0 BY CONSTRUCTION TODAY, and that is a fact rather than a placeholder. A run
// is a save: a fresh game starts at `clock: 0`, prestige does not begin a new one (PRD §3.6 — an
// era loop sits inside one record card), and clearing the save produces another createInitialState()
// at clock 0. The field is carried anyway because STORY-044 computes a run's total time from it,
// and the day something lets a run begin mid-clock the arithmetic there should not have to change.
function recordSlice(state) {
  const slice = (state && state.record) || {};
  return {
    actSeconds: slice.actSeconds || {},
    startedAtClock: slice.startedAtClock || 0,
    // Written when the run ENDS and never before: 0 means "still going". The pair is what makes
    // promotion idempotent and what tells a finished run from an abandoned one.
    endedAtClock: slice.endedAtClock || 0,
    complete: !!slice.complete,
    runId: slice.runId || null,
    counters: { ...emptyCounters(), ...(slice.counters || {}) },
  };
}

// The run's achievements, NOT the career's. The career set is in the records store and is merged
// there at promotion (STORY-044). Keeping the two apart is what lets the submitted score count
// only what this run earned (PRD §6) while the collection still keeps everything forever.
function achievementsSlice(state) {
  const slice = (state && state.achievements) || {};
  return {
    earned: slice.earned || [],
    seenIds: slice.seenIds || [],
  };
}

// Close out the act being LEFT by writing its duration, in the same `state.clock` seconds every
// other clock in this game is measured in (PRD §3.5 — offline catch-up advances that clock through
// the same advance(), capped by balanceConfig.offlineCapSeconds, so idling counts against a run's
// time by a bounded amount and that is the intended reading).
//
// CALLED BY enterAct() BEFORE `actEnteredAtClock` IS RESTAMPED, which is the only moment the
// duration is still recoverable — engine/progression.js overwrites that field on every boundary and
// keeps no history, which is the gap this whole story exists to close.
//
// THE BEST TIME WINS, which is what makes an act's entry a RECORD rather than a diary entry. A
// second traversal that beat the first overwrites it; one that did not leaves it alone. Prestige is
// what makes second traversals real: resetForPrestige() restarts `state.clock` at 0 and drops the
// player back at PRESTIGE_ACT_INDEX, so every era is a fresh, comparably-timed run at the last act
// and the card keeps the fastest of them.
//
// A same-index re-entry still records nothing — prestige re-enters the act it is already on, and
// nothing was crossed — so the guard above and this one answer different questions.
//
// A NON-FINITE OR NEGATIVE DELTA IS NEVER WRITTEN, AND IT IS COUNTED. `state.clock` only ever moves
// forward, in advance(), by a non-negative delta, so an act that ended before it began did not
// happen: the save was edited or the state was driven from the console. Writing it would hand the
// board an unbeatable record; writing 0 would be worse, because 0 is the best possible time in the
// game. So the split is refused and `integrityViolations` is incremented instead — that counter is
// what the `cheater` achievement reads (PRD §5).
function recordActSplit(state, enteringActIndex, nowClock) {
  const progression = (state && state.progression) || {};
  const leavingActIndex = progression.act;
  // A re-entry is not a traversal. This is the prestige guard: resetForPrestige() calls enterAct()
  // with the index it is already on, and nothing was crossed.
  if (typeof leavingActIndex !== 'number' || leavingActIndex === enteringActIndex) return state;

  const slice = recordSlice(state);
  const enteredAt = progression.actEnteredAtClock;
  // An absent stamp is a save that predates the field, not a violation: nothing to subtract from,
  // and the act stays unrecorded.
  if (typeof enteredAt !== 'number' || !Number.isFinite(enteredAt)) return state;

  const elapsed = nowClock - enteredAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return flagIntegrityViolation(state);

  return writeSplit(state, leavingActIndex, elapsed);
}

// The best-time rule itself, shared by the transition path above and by the WIN path below. Two
// copies of "is this faster than the standing entry" is two places for the comparison to drift.
function writeSplit(state, actIndex, elapsed) {
  const slice = recordSlice(state);
  const best = slice.actSeconds[actIndex];
  if (typeof best === 'number' && Number.isFinite(best) && best <= elapsed) return state;
  return {
    ...state,
    record: { ...slice, actSeconds: { ...slice.actSeconds, [actIndex]: elapsed } },
  };
}

// THE TERMINAL ACT'S SPLIT, WHICH NO TRANSITION CAN EVER TAKE. recordActSplit() fires when an act is
// LEFT, and Act VII is never left — it declares `exit: null` and the odyssey ends inside it. So
// without this the last and longest act in the game contributes nothing at all to a score, and
// data/scoreConfig.js's PAR[6]/WEIGHT[6] — 300 of the 1,000 available act points — are unreachable
// by construction. Found by STORY-043 while building the score; recorded in PRD §6.
//
// Measured from the act's own entry stamp to the moment the run ended, under exactly the rules a
// transition split obeys: the best time wins, and a negative delta is refused and counted rather
// than written as an unbeatable zero.
function recordTerminalActSplit(state, actIndex, nowClock) {
  const progression = (state && state.progression) || {};
  const enteredAt = progression.actEnteredAtClock;
  if (typeof enteredAt !== 'number' || !Number.isFinite(enteredAt)) return state;
  const elapsed = nowClock - enteredAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return flagIntegrityViolation(state);
  return writeSplit(state, actIndex, elapsed);
}

// A state that could not have been reached by playing. Recorded on the run's card so the evaluator
// (STORY-042) can read it on its next tick — instants never unlock anything themselves, which is
// PRD §3.4's single-evaluation-site rule and the reason this returns state rather than an
// achievement id.
function flagIntegrityViolation(state) {
  const slice = recordSlice(state);
  return {
    ...state,
    record: {
      ...slice,
      counters: { ...slice.counters, integrityViolations: slice.counters.integrityViolations + 1 },
    },
  };
}

// A resolved wall-ball rally (engine/wallBall.js). Takes the streak the resolution just produced
// rather than re-deriving it, so this file and that one cannot disagree about what a streak is.
//
// The Showboat streak is keyed on the APPROACH ID and not on the payout multiplier: Showboat's
// `payoutMult: 3` is numerically the Bookie's `long-shot` threshold, and letting the two share a
// number would eventually let one system's tuning unlock the other system's achievement.
function recordRally(state, { won, approachId, streak }) {
  return bumpCounters(state, (counters) => {
    const showboat = won && approachId === 'showboat' ? counters.showboatStreak + 1 : 0;
    return {
      wallBallStreak: streak,
      bestWallBallStreak: Math.max(counters.bestWallBallStreak, streak),
      showboatStreak: showboat,
      bestShowboatStreak: Math.max(counters.bestShowboatStreak, showboat),
    };
  });
}

// A settled Bookie wager (engine/bookie.js). ONLY A WIN IS RECORDED, and only the multiplier that
// was frozen onto the wager at placement: a player who buys reputation after placing has already
// been quoted their line, and re-deriving it here would either cheapen or inflate an achievement
// against odds nobody was offered.
//
// The moneyline and the prop board write DIFFERENT counters, and neither may fall through to the
// other — the prop board quotes a far wider spread, so a shared counter would make `long-shot`
// farmable off the other page (PRD §5.4).
function recordWagerSettled(state, { won, payoutMult, prop }) {
  if (!won) return state;
  const mult = typeof payoutMult === 'number' && Number.isFinite(payoutMult) ? payoutMult : 0;
  return bumpCounters(state, (counters) => (prop
    ? { bestPropPayoutMult: Math.max(counters.bestPropPayoutMult, mult) }
    : {
      bookieWins: counters.bookieWins + 1,
      bestBookiePayoutMult: Math.max(counters.bestBookiePayoutMult, mult),
    }));
}

// A season that ended with the player unbeaten. Counted at the offseason rollover, which is the
// last moment the standings exist to be read — engine/tickEngine.js nulls them a few lines later.
function recordUndefeatedSeason(state) {
  return bumpCounters(state, (counters) => ({ undefeatedSeasons: counters.undefeatedSeasons + 1 }));
}

// Act VII's first module purchase, stamped once. WRITTEN ONCE AND NEVER OVERWRITTEN: `sifter` asks
// how fast the opening was worked, and a second module bought an hour later must not answer it.
function recordFirstModule(state, nowClock) {
  return bumpCounters(state, (counters) => {
    if (counters.firstModuleAtClock > 0) return null;
    if (typeof nowClock !== 'number' || !Number.isFinite(nowClock)) return null;
    // A first module at clock 0 is indistinguishable from "none yet" in a bag whose absent reading
    // is 0. It cannot happen in play — Act VII is entered thousands of seconds in — and a harness
    // that manufactures it gets the honest answer rather than a false unlock.
    return { firstModuleAtClock: Math.max(nowClock, Number.MIN_VALUE) };
  });
}

// SEALING A RUN: the pure half of ending one. It stamps the card and takes the terminal act's
// split; it does NOT write to localStorage, because engine/ does not do storage. The persistence
// half is promoteSealedRun() in persistence/recordsStore.js, and the split between them is the same
// one every other engine module keeps — a reducer must stay pure, and a tick that wrote to disk
// would write on every one of an eight-hour catch-up's iterations.
//
// IDEMPOTENT BY `endedAtClock`. A run seals once: the win seals it, and a later save-clear finds it
// already sealed and changes nothing. Without that, winning and then resetting would promote two
// rows for one run.
//
// `runId` IS STAMPED HERE RATHER THAN AT RUN START, and it is stamped lazily on purpose. Every save
// written before this shipped has no run id, and an accessor that minted one on read would be
// impure and would mint a different id every render. Sealing happens exactly once per run, which is
// the one moment an id can be generated and stay stable.
function sealRun(state, options = {}) {
  const slice = recordSlice(state);
  if (slice.endedAtClock > 0) return state;

  const nowClock = (state && state.clock) || 0;
  const complete = !!options.complete;
  // Only a COMPLETED run closes the terminal act. A save cleared mid-Act-VII did not finish it, and
  // writing a split there would put an abandoned run's time in the same column as a finished one's.
  const withSplit = complete && (state.progression || {}).act === FINAL_ACT_INDEX
    ? recordTerminalActSplit(state, FINAL_ACT_INDEX, nowClock)
    : state;
  const sealed = recordSlice(withSplit);

  return {
    ...withSplit,
    record: {
      ...sealed,
      runId: sealed.runId || generateId('run'),
      endedAtClock: nowClock,
      complete,
    },
  };
}

// The promotable card: the FACTS a finished run is remembered by, and never a score. PRD §3.3 makes
// the score derived, so storing a total would freeze one edit of data/scoreConfig.js into the
// player's history and make every later retune a lie about the rows already on the board. Everything
// runScore() needs is here; the number is computed on read, every read.
//
// `achievements` is the RUN's set and not the career's — that is what makes STORY-043's run-scoped
// scoring possible at all, and it is why promotion merges into the career set separately rather
// than copying it back.
function runCard(state) {
  const slice = recordSlice(state);
  const achievements = achievementsSlice(state).earned;
  return {
    runId: slice.runId || null,
    actSeconds: { ...slice.actSeconds },
    achievements: [...achievements],
    complete: !!slice.complete,
    startedAtClock: slice.startedAtClock,
    endedAtClock: slice.endedAtClock,
    // Simulated seconds the run lasted, which is what a leaderboard row means by "total time" —
    // the same clock every act split is measured in, so the parts and the whole agree.
    totalSeconds: Math.max(0, slice.endedAtClock - slice.startedAtClock),
    // Wall-clock, for sorting and display only. Read off `meta` rather than from Date.now(), so
    // this function stays pure and a card built twice from one state is identical twice.
    endedAtTimestamp: ((state && state.meta) || {}).lastTickTimestamp || null,
    counters: { ...slice.counters },
  };
}

module.exports = {
  emptyCounters,
  recordSlice,
  achievementsSlice,
  recordActSplit,
  flagIntegrityViolation,
  bumpCounters,
  recordRally,
  recordWagerSettled,
  recordUndefeatedSeason,
  recordFirstModule,
  recordTerminalActSplit,
  sealRun,
  runCard,
};
