// Ending a run, in the one order it is safe to end one.
//
// A run's achievements and per-act splits live in GAME STATE (engine/records.js); the career they
// are promoted into lives in `idle-base-records-v1` (persistence/recordsStore.js). Clearing the save
// destroys the first. So promotion is not merely "before" the clear as a matter of taste — a
// clearSave() that runs first has already thrown away the thing promotion exists to keep.
//
// THIS FUNCTION IS THE ORDER, EXPRESSED ONCE. `clearSave()` remains exported from
// persistence/saveLoad.js and is still the low-level primitive, but no caller that means "the
// player is starting over" should reach for it directly — that is the call that loses a run's only
// record, and a comment asking people to remember the sequence is not a mechanism.
//
// NOTE FOR WHOEVER ADDS THE RESET BUTTON: nothing calls this yet. There is no reset UI in the game
// today — `clearSave()` currently has no caller outside its own module — so this ships as the
// correct path waiting for its first user rather than as a change to an existing flow. The Records
// tab (STORY-045) is the natural home for it.
const { sealRun, runCard } = require('../engine/records');
const { promoteRun } = require('./recordsStore');
const { clearSave } = require('./saveLoad');

// Promote whatever the state's card holds, if it has been sealed. Returns the sealed state so a
// caller can persist it: sealing is a state change, and a win that is promoted but not saved would
// re-seal and re-promote on the next load.
//
// A run that has NOT ended is not promoted. `sealRun()` is what decides a run is over — the win
// does it inside advance(), and endRunAndClearSave() below does it for an abandonment — so this
// function never has to guess.
function promoteSealedRun(state) {
  const record = (state && state.record) || {};
  if (!(record.endedAtClock > 0)) return { state, promoted: false };
  promoteRun(runCard(state));
  return { state, promoted: true };
}

// The abandonment path: the player is starting over with a run still in progress. The card is
// sealed as INCOMPLETE, promoted, and only then is the save cleared.
//
// Promoted rather than discarded, deliberately. An unfinished run is still the only evidence that
// run happened, and the moment the player throws the save away is the moment they are least able to
// get it back. It is flagged `complete: false` so engine/score.js and the board can keep it out of
// the same column as a finished run rather than pretending it belongs there.
function endRunAndClearSave(state) {
  const sealed = sealRun(state, { complete: false });
  const card = runCard(sealed);
  // A run with nothing in it is not promoted. Starting over thirty seconds into Act I produces a
  // card with no splits and no achievements, and a board full of those rows is worse than no rows:
  // it buries the runs that meant something under the ones that were abandoned immediately.
  //
  // The test is what the card CONTAINS, not how long it lasted, so a short run that actually
  // cleared an act is kept.
  if (Object.keys(card.actSeconds).length > 0 || card.achievements.length > 0) {
    promoteRun(card);
  }
  clearSave();
  return sealed;
}

module.exports = { promoteSealedRun, endRunAndClearSave };
