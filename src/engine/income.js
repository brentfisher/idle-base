const { getCollectorTier } = require('../data/collectorTiers');
const { revenuePerSecond } = require('./economy');

// Act I: each owned collector tier contributes its authored caps/second.
function collectorsPerSecond(state) {
  const collectors = (state.income && state.income.collectors) || [];
  return collectors.reduce((sum, entry) => {
    const tier = getCollectorTier(entry.tierId);
    return tier ? sum + tier.capsPerSecond * entry.count : sum;
  }, 0);
}

// Per-currency income rates. STORY-003 owns this file and adds the early-act
// contributors (collectors, wall-ball dues, concessions, sponsorships); only the
// ticketing contributor exists today, so the caps and coins rates are structurally
// present and zero. The name, signature and returned bundle shape match the shared
// design so this implementation can be replaced wholesale.
//
// Per design Decision 1 the offseason suspension is a property of ticket sales, not
// of income in general, so the phase gate lives inside the contributor.
function ticketingPerSecond(state, modifiers) {
  if (!state.stadium || !state.season) return 0;
  if (state.season.phase === 'offseason') return 0;
  return revenuePerSecond(state, modifiers);
}

function totalIncomePerSecond(state, modifiers) {
  return {
    caps: collectorsPerSecond(state),
    coins: 0,
    cash: ticketingPerSecond(state, modifiers),
  };
}

module.exports = { totalIncomePerSecond };
