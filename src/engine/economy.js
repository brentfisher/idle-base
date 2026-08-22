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

// WHAT BUYING AS MANY UPGRADES AS THE WALLET ALLOWS WOULD ACTUALLY DO, priced one step at a time.
//
// STEP BY STEP AND NOT `floor(cash / cost)`, WHICH IS THE WHOLE REASON THIS IS A FUNCTION. The cost
// curve above is `base * growth ** ((value - 5) / 5)`, so every purchase makes the next one dearer.
// Dividing the wallet by the FIRST price overstates what is affordable — at Analytics-era growth it
// overshoots by several steps — and a button labelled from that number would promise upgrades the
// reducer then refuses, leaving the player looking at a button that did less than it said.
//
// Pure and read-only: it buys nothing and is safe to call on every render of every upgrade row. The
// reducer does not trust it either — state/actions/rosterActions.js re-runs the real purchase for
// each step — so this is what the LABEL is drawn from, never what the debit is computed from.
//
// Bounded by the cap as well as by the wallet, and the last step is clamped exactly as a single
// purchase is: at 99/100 with a +2 upgrade the player pays the full price for the 1 point left.
function planMaxStatUpgrades(currentStatValue, cash, modifiers) {
  const { statCap, statUpgradeAmount } = modifiers.rules;
  let value = currentStatValue;
  let remaining = cash;
  let steps = 0;
  let totalCost = 0;

  // The cap is the real bound — statUpgradeAmount is at least 1, so this cannot exceed the number
  // of points between here and the ceiling — and the guard is belt and braces on a retune that
  // makes the step zero or negative.
  const ceiling = Math.max(0, statCap - currentStatValue) + 1;
  while (value < statCap && steps < ceiling) {
    const cost = statUpgradeCost(value, modifiers);
    if (cost > remaining) break;
    remaining -= cost;
    totalCost += cost;
    value = Math.min(statCap, value + statUpgradeAmount);
    steps += 1;
  }

  return { steps, totalCost, endValue: value, gain: value - currentStatValue };
}

function stadiumUpgradeCost(currentLevel, modifiers) {
  const raw = balanceConfig.stadiumUpgradeBaseCost * balanceConfig.stadiumUpgradeCostGrowth ** (currentLevel - 1);
  return Math.round(raw * modifiers.upgradeCostMult);
}

function stadiumCapacityGain(currentLevel) {
  return Math.round(balanceConfig.stadiumUpgradeCapacityStep * (1 + 0.15 * (currentLevel - 1)));
}

module.exports = {
  planMaxStatUpgrades,
  computeRecentWinPct,
  attendanceFraction,
  revenuePerSecond,
  statUpgradeCost,
  stadiumUpgradeCost,
  stadiumCapacityGain,
};
