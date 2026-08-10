// Generalized income-source list (odyssey design doc, Decision 1).
//
// advance() calls totalIncomePerSecond() once per loop iteration and integrates the
// returned rates across the step. Contributors are RATES ONLY — never schedule a
// per-second event for income. balanceConfig.safetyCapIterations (2,000) is far below
// offlineCapSeconds (28,800), so an event-driven trickle would burn the iteration cap and
// silently discard roughly seven hours of a returning player's earnings.
//
// Contributors, per act: collectors (caps, Act I), wallBallDues (caps, Act II),
// concessions (coins, Act III), sponsorships (coins, Act IV), ticketing (cash, Act V).
// Only the ones that exist today are wired up.
const { getCollectorTier } = require('../data/collectorTiers');
const { revenuePerSecond } = require('./economy');

function emptyBundle() {
  return { caps: 0, coins: 0, cash: 0 };
}

function collectorsPerSecond(state) {
  const collectors = (state.income && state.income.collectors) || [];
  return collectors.reduce((sum, entry) => {
    const tier = getCollectorTier(entry.tierId);
    return tier ? sum + tier.capsPerSecond * entry.count : sum;
  }, 0);
}

function sponsorshipsPerSecond(state) {
  const sponsorships = (state.income && state.income.sponsorships) || [];
  return sponsorships.reduce((sum, entry) => sum + (entry.coinsPerSecond || 0), 0);
}

// The `phase !== 'offseason'` suspension lives here rather than in advance(): a paused
// season suspends *ticket sales*, not income in general.
function ticketingPerSecond(state, modifiers) {
  if (!state.stadium || !state.season) return 0;
  if (state.season.phase === 'offseason') return 0;
  return revenuePerSecond(state, modifiers);
}

function totalIncomePerSecond(state, modifiers) {
  return {
    caps: collectorsPerSecond(state),
    coins: sponsorshipsPerSecond(state),
    cash: ticketingPerSecond(state, modifiers),
  };
}

function scaleBundle(bundle, seconds) {
  return {
    caps: bundle.caps * seconds,
    coins: bundle.coins * seconds,
    cash: bundle.cash * seconds,
  };
}

module.exports = {
  emptyBundle,
  collectorsPerSecond,
  sponsorshipsPerSecond,
  ticketingPerSecond,
  totalIncomePerSecond,
  scaleBundle,
};
