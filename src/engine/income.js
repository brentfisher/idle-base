const { getCollectorTier } = require('../data/collectorTiers');
const { revenuePerSecond } = require('./economy');
const { CREW_DUES_PER_SECOND } = require('../data/wallBallConfig');
const { concessionsPerSecond } = require('./concessions');

// Act I: each owned collector tier contributes its authored caps/second.
function collectorsPerSecond(state) {
  const collectors = (state.income && state.income.collectors) || [];
  return collectors.reduce((sum, entry) => {
    const tier = getCollectorTier(entry.tierId);
    return tier ? sum + tier.capsPerSecond * entry.count : sum;
  }, 0);
}

// Act II: the crew kick in dues. A rate like any other contributor's, so it integrates
// across an offline catch-up with everything else rather than being paid per event.
function wallBallDuesPerSecond(state) {
  const crew = (state && state.crew) || [];
  return crew.length * CREW_DUES_PER_SECOND;
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
    caps: collectorsPerSecond(state) + wallBallDuesPerSecond(state),
    coins: 0,
    // Act III's stands are the only cash source before the stadium exists: ticketing is gated
    // on state.stadium, which Act V creates, so without concessions cash income in Act III is
    // exactly zero and the stat-upgrade sink has nothing feeding it.
    cash: ticketingPerSecond(state, modifiers) + concessionsPerSecond(state),
  };
}

// collectorsPerSecond is exported for display: Act I's panel shows the caps rate
// on its own, rather than re-deriving it from the whole bundle.
module.exports = { totalIncomePerSecond, collectorsPerSecond, wallBallDuesPerSecond, concessionsPerSecond };
