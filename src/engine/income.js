const { revenuePerSecond } = require('./economy');

// Every income source in the game, in one list. advance() sums this list instead of
// calling revenuePerSecond() directly, so each act adds a contributor here rather than
// editing a conditional every other act also touches.
//
// Two rules hold for everything in this file:
//
// 1. Contributors return a RATE (per second), never a lump sum. advance() integrates
//    rate x step, so an eight-hour offline catch-up costs one loop iteration. Never make
//    early income depend on a per-second event via findNextEventClock(): advance() stops
//    at balanceConfig.safetyCapIterations (2000) while offlineCapSeconds allows 28800s,
//    so a per-second event would hit the cap and silently discard ~7 hours of income.
// 2. A contributor must return a finite number always — never undefined. A missing return
//    would poison the currency bundle with NaN, and NaN cash makes every affordability
//    check (`state.cash < cost`) read false forever.

const CURRENCIES = ['caps', 'coins', 'cash'];

function zeroBundle() {
  return { caps: 0, coins: 0, cash: 0 };
}

// Whether a feature is available yet. Once engine/progression.js lands (STORY-004) the body
// of this function becomes `getUnlockedFeatures(state.progression.act).includes(feature)`;
// until then each feature is inferred from the state it needs, which is what the acts will
// create anyway. Deliberately the single place that knowledge lives.
function isUnlocked(state, feature) {
  switch (feature) {
    case 'collectors':
      return !!(state.income && state.income.collectors && state.income.collectors.length > 0);
    case 'wallBallDues':
      return !!(state.wallBall && state.wallBall.duesPerSecond > 0);
    case 'concessions':
      return !!(state.concessions && state.concessions.stands > 0);
    case 'sponsorships':
      return !!(state.income && state.income.sponsorships && state.income.sponsorships.length > 0);
    case 'ticketing':
      return state.stadium != null;
    default:
      return false;
  }
}

// Act I — bottle caps picked out of the dirt. Scaffold: state.income.collectors is created
// by the Act I story, which also owns the per-tier rate table.
function collectorsPerSecond() {
  return 0;
}

// Act II — a small trickle of dues from neighborhood wall-ball games.
function wallBallDuesPerSecond() {
  return 0;
}

// Act III — lemonade stand / snack table, proto-ticketing.
function concessionsPerSecond() {
  return 0;
}

// Act IV — flat per-second from sponsor deals.
function sponsorshipsPerSecond() {
  return 0;
}

// Act V+ — the existing stadium ticket economy, wrapped unchanged. The offseason gate lives
// here rather than in advance(): suspending sales is a property of ticket sales, not of
// income in general, and bottle caps must keep accruing between seasons.
function ticketingPerSecond(state, modifiers) {
  if (state.stadium == null) return 0;
  if (state.season == null || state.season.phase === 'offseason') return 0;
  return revenuePerSecond(state, modifiers);
}

const CONTRIBUTORS = [
  { id: 'collectors', currency: 'caps', perSecond: collectorsPerSecond },
  { id: 'wallBallDues', currency: 'caps', perSecond: wallBallDuesPerSecond },
  { id: 'concessions', currency: 'coins', perSecond: concessionsPerSecond },
  { id: 'sponsorships', currency: 'coins', perSecond: sponsorshipsPerSecond },
  { id: 'ticketing', currency: 'cash', perSecond: ticketingPerSecond },
];

// Sums every currently-unlocked contributor into a per-currency bundle,
// e.g. { caps: 0.4, coins: 0, cash: 0 }. All three keys are always present.
function totalIncomePerSecond(state, modifiers) {
  const bundle = zeroBundle();
  CONTRIBUTORS.forEach((contributor) => {
    if (!isUnlocked(state, contributor.id)) return;
    const rate = contributor.perSecond(state, modifiers);
    if (!Number.isFinite(rate) || rate === 0) return;
    bundle[contributor.currency] += rate;
  });
  return bundle;
}

module.exports = { totalIncomePerSecond, isUnlocked, zeroBundle, CURRENCIES, CONTRIBUTORS };
