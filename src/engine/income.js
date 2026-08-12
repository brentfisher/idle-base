const { getCollectorTier } = require('../data/collectorTiers');
const { revenuePerSecond } = require('./economy');
const { CREW_DUES_PER_SECOND, RESPECT_CAPS_BONUS_PER_POINT } = require('../data/wallBallConfig');
const { handsPerSecond } = require('./wallBallShop');
const { concessionsPerSecond } = require('./concessions');
const { sponsorshipsPerSecond } = require('./sponsorships');

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

// Respect is worth something before it is worth anything on a field: it multiplies every caps
// contributor. Applied here rather than as a BONUS_KEY in engine/modifiers.js because, like
// reputation's strength bonus, it is sourced from live state rather than from a config layer —
// modifierBonuses compose act/era/perk/powerup, and Respect is none of those.
function respectCapsMultiplier(state) {
  const respect = (state && state.wallBall && state.wallBall.respect) || 0;
  return 1 + Math.max(0, respect) * RESPECT_CAPS_BONUS_PER_POINT;
}

function totalIncomePerSecond(state, modifiers) {
  return {
    caps: (collectorsPerSecond(state) + wallBallDuesPerSecond(state) + handsPerSecond(state))
      * respectCapsMultiplier(state),
    // Still structurally present and zero. The PRD gives Act IV coins; Act III shipped its
    // concessions in cash and every Act IV sink is cash-priced, so Act IV pays cash too and
    // the coins rail stays unused. See the currency note in data/actFourConfig.js.
    coins: 0,
    // Act III's stands and Act IV's sponsors are the only cash sources before the stadium
    // exists: ticketing is gated on state.stadium, which Act V creates, so without these two
    // cash income in Acts III-IV is exactly zero and the stat-upgrade sink has nothing feeding
    // it. Sponsors are still the tier above stands, but the gap has narrowed on purpose: the
    // stand line caps at 105/sec in copies and the concessions shop's STAND_UPGRADES multiply
    // that by up to 1.75, so concessionsPerSecond() now tops out at ~184/sec against the
    // sponsor board's 295 base (~410 once reputation has scaled it). Roughly one stat upgrade
    // every twenty seconds at travel-ball stat levels, where it used to be one a minute.
    // The 1.75 ceiling is sized in data/concessionsConfig.js precisely so that this line stays
    // the smaller of the two and signing sponsors remains the thing that changes Act IV.
    cash: ticketingPerSecond(state, modifiers) + concessionsPerSecond(state) + sponsorshipsPerSecond(state),
  };
}

// collectorsPerSecond is exported for display: Act I's panel shows the caps rate
// on its own, rather than re-deriving it from the whole bundle.
module.exports = {
  totalIncomePerSecond,
  collectorsPerSecond,
  wallBallDuesPerSecond,
  concessionsPerSecond,
  sponsorshipsPerSecond,
  respectCapsMultiplier,
};
