const balanceConfig = require('../data/balanceConfig');
const { clamp } = require('../utils/statUtils');

function computeRecentWinPct(schedule) {
  const played = schedule.filter((g) => g.played);
  if (played.length === 0) return 0.5;
  const recent = played.slice(-10);
  const wins = recent.filter((g) => g.result === 'win').length;
  return wins / recent.length;
}

function attendanceFraction(state, modifiers) {
  const recentWinPct = computeRecentWinPct(state.season.schedule);
  const priceElasticityPenalty =
    Math.max(0, (state.stadium.ticketPrice - balanceConfig.fairPrice) / balanceConfig.fairPrice) * 0.4;
  let fraction = 0.2 + (state.reputation / 100) * 0.5 + recentWinPct * 0.2 - priceElasticityPenalty;
  fraction *= modifiers.attendanceMult;
  return clamp(fraction, 0.05, 1.0);
}

function revenuePerSecond(state, modifiers) {
  const fraction = attendanceFraction(state, modifiers);
  return (
    state.stadium.capacity *
    fraction *
    balanceConfig.baseSaleRatePerSecond *
    state.stadium.ticketPrice *
    modifiers.revenueMult
  );
}

function statUpgradeCost(currentStatValue, modifiers) {
  // Resolved: the Analytics era declares `statUpgradeCostGrowth: 1.15`, an override that read
  // straight from balanceConfig here and so never actually applied.
  const base = modifiers.rules.statUpgradeBaseCost;
  const growth = modifiers.rules.statUpgradeCostGrowth;
  const raw = base * growth ** ((currentStatValue - 5) / 5);
  return Math.round(raw * modifiers.upgradeCostMult);
}

function stadiumUpgradeCost(currentLevel, modifiers) {
  const raw = balanceConfig.stadiumUpgradeBaseCost * balanceConfig.stadiumUpgradeCostGrowth ** (currentLevel - 1);
  return Math.round(raw * modifiers.upgradeCostMult);
}

function stadiumCapacityGain(currentLevel) {
  return Math.round(balanceConfig.stadiumUpgradeCapacityStep * (1 + 0.15 * (currentLevel - 1)));
}

module.exports = {
  computeRecentWinPct,
  attendanceFraction,
  revenuePerSecond,
  statUpgradeCost,
  stadiumUpgradeCost,
  stadiumCapacityGain,
};
