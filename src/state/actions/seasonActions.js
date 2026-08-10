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

module.exports = { tick, applyOfflineProgressAction, dismissOffseasonSummary };
