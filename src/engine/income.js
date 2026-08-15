const { getCollectorTier } = require('../data/collectorTiers');
const { revenuePerSecond } = require('./economy');
const { CREW_DUES_PER_SECOND, RESPECT_CAPS_BONUS_PER_POINT } = require('../data/wallBallConfig');
const { handsPerSecond } = require('./wallBallShop');
const { concessionsPerSecond } = require('./concessions');
const { sponsorshipsPerSecond } = require('./sponsorships');
const { colonyRates, expeditionSlice } = require('./colony');
const { getUnlockedFeatures } = require('./progression');

// The feature id the Salvage faucet is gated on. `ops` rather than `fab`: `ops` is the one Act VII
// tab with no `unlockedBy` entry, so it is live from the act boundary — which is exactly when the
// colony can first own a module. Gating on `fab` would withhold income until `lifeSupport` and
// silently zero the whole `aftermath` economy.
const SALVAGE_INCOME_FEATURE = 'ops';

function isSalvageUnlocked(state) {
  if (!state || !state.progression) return false;
  const features = getUnlockedFeatures(state.progression.act, expeditionSlice(state).phase);
  return features.indexOf(SALVAGE_INCOME_FEATURE) !== -1;
}

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
//
// `seasonFrozen` is the second suspension condition on that same contributor and it is here for
// exactly the same reason, rather than as an act-level branch in advance(): a frozen league
// sells no tickets, but the act that froze it has income of its own, and suspending income as a
// whole would take that down with the turnstiles. Adding it here also means every consumer that
// already reads a rate — the header, the revenue ticker, the tick loop — agrees about it for
// free, with no second gate to keep in sync.
//
// Read off the RESOLVED rules rather than balanceConfig, because this is a value an act
// overrides (engine/modifiers.js: "never read balanceConfig directly for anything an act can
// override"). `modifiers.rules` is always present — computeModifiers() attaches it — which is
// why it is dereferenced as plainly as modifiers.rules.playoffTeams is in tickEngine.js.
//
// This is NOT the only place the freeze is enforced, and the other two are not redundant with
// it: engine/tickEngine.js gates the season phase block, and — far less obviously — gates
// findNextEventClock() as well. Read the comment there before concluding either can go.
function ticketingPerSecond(state, modifiers) {
  if (!state.stadium || !state.season) return 0;
  if (modifiers.rules.seasonFrozen) return 0;
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

// Act VII: the colony's Salvage output. A contributor like any other, which is the point — Salvage
// is an ordinary wallet currency and this is its passive faucet, sitting beside ticketing and
// concessions rather than in a parallel system of its own.
//
// GATED ON ITS OWN UNLOCK, not on the act index. `getUnlockedFeatures` recomputes the unlocked set
// from the act config on every read, so gating here on a feature id means a retune of when
// fabrication opens takes effect on an existing save with no migration — the rule this codebase
// calls derived-never-stored. An act-index check would be a second place that knows the arc's
// shape, and would also pay the solve on the tick after the boundary rather than when the player
// can actually build anything.
//
// The rate is read off colonyRates() rather than summed from the modules here, so the ration that
// throttles a starved drone's income is the SAME ration the colony is integrating against. Two
// sums would be two rations, and a header that says 26/s while the wallet fills at 9/s is a bug
// the player experiences as the game lying to them.
//
// The solve costs one pass on a healthy colony and this file already sits inside the same tick as
// integrateColony()'s call; see the measured convergence bound in engine/colony.js for why that is
// not the expensive thing in advance().
function salvagePerSecond(state, modifiers) {
  if (!isSalvageUnlocked(state)) return 0;
  const rates = colonyRates(state, modifiers);
  return Number.isFinite(rates.salvage) ? rates.salvage : 0;
}

function totalIncomePerSecond(state, modifiers) {
  return {
    salvage: salvagePerSecond(state, modifiers),
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
