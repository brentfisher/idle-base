const balanceConfig = require('../data/balanceConfig');
const { advance } = require('./tickEngine');

function computeCappedElapsedSeconds(lastSaveTimestamp, now) {
  const rawSeconds = Math.max(0, (now - lastSaveTimestamp) / 1000);
  return Math.min(rawSeconds, balanceConfig.offlineCapSeconds);
}

// Applies elapsed wall-clock time (since the last save) through the same advance()
// used for live ticking, then re-stamps save metadata. Idempotent: safe to call twice
// with increasing `now` values (e.g. React 18 dev double-invoke) — see hooks/useGameTick.js.
function applyOfflineProgress(state, now) {
  const elapsedSeconds = computeCappedElapsedSeconds(state.meta.lastSaveTimestamp, now);
  const before = state.cash;
  const next = advance(state, elapsedSeconds);
  const revenueEarned = next.cash - before;

  return {
    state: {
      ...next,
      meta: { ...next.meta, lastSaveTimestamp: now, lastTickTimestamp: now },
    },
    summary: { elapsedSeconds, revenueEarned },
  };
}

module.exports = { computeCappedElapsedSeconds, applyOfflineProgress };
