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
  const before = state.wallet;
  const beforeCash = state.cash;
  const next = advance(state, elapsedSeconds);

  // Currency-aware: early acts earn caps, not cash, so a cash-only diff would report zero
  // for a returning Act I player.
  const earned = {
    caps: next.wallet.caps - before.caps,
    coins: next.wallet.coins - before.coins,
    cash: next.cash - beforeCash,
  };

  return {
    state: {
      ...next,
      meta: { ...next.meta, lastSaveTimestamp: now, lastTickTimestamp: now },
    },
    summary: { elapsedSeconds, earned, revenueEarned: earned.cash },
  };
}

module.exports = { computeCappedElapsedSeconds, applyOfflineProgress };
