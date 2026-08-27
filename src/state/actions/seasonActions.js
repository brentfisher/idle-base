const { advance } = require('../../engine/tickEngine');
const { applyOfflineProgress } = require('../../engine/offlineProgress');

function tick(state, action) {
  const now = action.now;
  const deltaSeconds = Math.max(0, (now - state.meta.lastTickTimestamp) / 1000);
  const next = advance(state, deltaSeconds);
  return { ...next, meta: { ...next.meta, lastTickTimestamp: now } };
}

function applyOfflineProgressAction(state, action) {
  const { state: next } = applyOfflineProgress(state, action.now);
  return next;
}

function dismissOffseasonSummary(state) {
  return { ...state, season: { ...state.season, offseasonSummaryPending: false } };
}

// Closes the welcome-back screen. The ONLY thing in the game that clears `returnSummary` — the
// offline catch-up carries an existing one forward rather than overwriting it (see the idempotence
// note in engine/offlineProgress.js), so if this did not clear it nothing would.
//
// Returns `state` BY IDENTITY when there is nothing to dismiss, rather than spreading a fresh
// object with the same null in it. A new object reference out of the reducer re-renders every
// consumer of the context, and this action is dispatched from a close button that a double-click,
// a keyboard Escape and a backdrop click can all fire in the same frame.
function dismissReturnSummary(state) {
  if (!state.returnSummary) return state;
  return { ...state, returnSummary: null };
}

module.exports = { tick, applyOfflineProgressAction, dismissOffseasonSummary, dismissReturnSummary };
