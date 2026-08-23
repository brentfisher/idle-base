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
    manualSalvageEarned: 0,
    moduleSalvageEarned: 0,
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

  const best = slice.actSeconds[leavingActIndex];
  if (typeof best === 'number' && Number.isFinite(best) && best <= elapsed) return state;

  return {
    ...state,
    record: {
      ...slice,
      actSeconds: { ...slice.actSeconds, [leavingActIndex]: elapsed },
    },
  };
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

module.exports = { emptyCounters, recordSlice, achievementsSlice, recordActSplit, flagIntegrityViolation };
