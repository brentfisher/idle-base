// The generalized income-source list (design.md Decision 1). advance() calls
// totalIncomePerSecond() instead of revenuePerSecond(); each contributor declares the act
// that unlocks it and the currency it pays into.
//
// Income must be rate-integrated, not event-driven: advance() is bounded by
// safetyCapIterations (2,000) while offlineCapSeconds permits 28,800s, so a per-second
// event model would hit the cap and silently discard hours of a returning player's income.
//
// The `phase !== 'offseason'` gate lives inside the ticketing contributor — suspension is a
// property of ticket sales, not of income in general.

const { revenuePerSecond } = require('./economy');
const { COLLECTOR_TIERS } = require('../data/lotConfig');
const { WALL_BALL_DUES } = require('../data/wallBallConfig');

const TIERS_BY_ID = COLLECTOR_TIERS.reduce((map, tier) => {
  map[tier.id] = tier;
  return map;
}, {});

function collectorsRate(state) {
  return state.income.collectors.reduce((sum, entry) => {
    const tier = TIERS_BY_ID[entry.tierId];
    return tier ? sum + tier.capsPerSecond * entry.count : sum;
  }, 0);
}

// A small trickle: the block chips in for balls and chalk, and the crew brings their own.
function wallBallDuesRate(state) {
  if (!state.wallBall) return 0;
  return WALL_BALL_DUES.base + WALL_BALL_DUES.perCrewMember * state.crew.length;
}

const CONTRIBUTORS = [
  { id: 'collectors', currency: 'caps', unlockedAtAct: 0, rate: collectorsRate },
  { id: 'wallBallDues', currency: 'caps', unlockedAtAct: 1, rate: wallBallDuesRate },
  {
    id: 'concessions',
    currency: 'coins',
    unlockedAtAct: 2,
    rate: (state) => (state.season ? 0.35 + 0.05 * state.roster.length : 0),
  },
  {
    id: 'sponsorships',
    currency: 'coins',
    unlockedAtAct: 3,
    rate: (state) => state.income.sponsorships.reduce((sum, s) => sum + s.coinsPerSecond, 0),
  },
  {
    id: 'ticketing',
    currency: 'cash',
    unlockedAtAct: 4,
    rate: (state, modifiers) => {
      if (!state.stadium || !state.season || state.season.phase === 'offseason') return 0;
      return revenuePerSecond(state, modifiers);
    },
  },
];

// Returns a per-currency bundle summed from every unlocked contributor.
function totalIncomePerSecond(state, modifiers) {
  const bundle = { caps: 0, coins: 0, cash: 0 };
  CONTRIBUTORS.forEach((contributor) => {
    if (state.progression.act < contributor.unlockedAtAct) return;
    const rate = contributor.rate(state, modifiers);
    if (rate > 0) bundle[contributor.currency] += rate;
  });
  return bundle;
}

// Same shape, broken out per contributor — for the header's per-currency rate display.
function incomeBreakdown(state, modifiers) {
  return CONTRIBUTORS.filter((c) => state.progression.act >= c.unlockedAtAct).map((c) => ({
    id: c.id,
    currency: c.currency,
    rate: c.rate(state, modifiers),
  }));
}

module.exports = { totalIncomePerSecond, incomeBreakdown, CONTRIBUTORS };
