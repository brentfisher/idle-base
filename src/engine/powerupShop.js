const { POWERUPS } = require('../data/powerupsConfig');
const { ACT_SEVEN_POWERUPS } = require('../data/actSevenPowerupsConfig');
const { resolveRules } = require('./modifiers');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// THE POWERUP SHOP, RETRO-FITTED ONTO THE HOUSE SHOP CONTRACT — the one shop in the game that
// never got it. PRD §5.9 names this as the blocker that has to clear before any Act VII powerup
// content can ship, and it is two concrete bugs rather than a style preference:
//
//   1. `buyPowerup()` in state/actions/economyActions.js hardcoded `'cash'` on BOTH the canAfford
//      and the debitWallet. Act VII's powerups are priced in Salvage, so appending them to the
//      catalogue without this would have made every one of them either free or unbuyable
//      depending on the player's cash balance — a currency confusion, silently.
//   2. components/ticketing/PowerupShop.js mapped POWERUPS with NO FILTER, so appending Act VII
//      entries would have leaked them into Act V's shop: ten Salvage-priced rows in a cash shop,
//      in an act where Salvage does not exist yet.
//
// The fix is the same one the rest of the game already uses: the engine resolves cost, currency,
// ownership and affordability, and the panel renders rows verbatim. engine/lotShop.js <->
// components/lot/LotShop.js is the reference pair; engine/actSevenModules.js is the freshest.

// WHICH CATALOGUE IS ON OFFER, decided from the act's own rules rather than from its index.
//
// `seasonFrozen` is the rule that retires the baseball simulation (data/acts.js), so it is exactly
// the line between "the franchise shop" and "the expedition shop" — the two catalogues are never
// both on offer, because they belong to two games that are never both being played. Reading the
// rule rather than the act index means an era or a later act that freezes the league inherits this
// for free, and it is the only sanctioned way to read an overridable value (conventions.md).
//
// This is also the fix for leak (2) above, and it fixes it in BOTH directions: Act VII cannot see
// the cash powerups either, which matters because half of them boost a league that has stopped
// playing.
function catalogueFor(state) {
  return resolveRules(state).seasonFrozen ? ACT_SEVEN_POWERUPS : POWERUPS;
}

// `powerup.currency || 'cash'` — the legacy catalogue declares no currency and must keep meaning
// cash, so the default is load-bearing rather than defensive. A powerup that forgot its currency
// key would be priced in cash, which is the old behaviour and the safe direction.
function currencyOf(powerup) {
  return powerup.currency || 'cash';
}

function isOwned(state, powerup) {
  return powerup.durationSeconds === null
    && state.powerups.purchasedPermanentIds.indexOf(powerup.id) !== -1;
}

// Presentation-ready rows. `active` carries the live instance so the panel can show a countdown
// without going back to state for it.
function listOffers(state) {
  return catalogueFor(state).map((powerup) => {
    const currency = currencyOf(powerup);
    const owned = isOwned(state, powerup);
    return {
      id: powerup.id,
      name: powerup.name,
      description: powerup.description,
      effectType: powerup.effectType,
      value: powerup.value,
      durationSeconds: powerup.durationSeconds,
      permanent: powerup.durationSeconds === null,
      cost: powerup.cost,
      currency,
      owned,
      // A permanent already owned is not "unaffordable", it is bought — the two refusal reasons are
      // kept separate so the panel can say which one applies without inferring it.
      affordable: balanceOf(state.wallet, currency) >= powerup.cost,
      active: state.powerups.active.find((p) => p.id === powerup.id) || null,
    };
  });
}

// Returns new state, or null for refused: an unknown id, a powerup from the other catalogue, a
// permanent already owned, or one the player cannot afford.
//
// RETURNS null RATHER THAN THE STATE, unlike the buyPowerup() it replaces, which returned `state`
// unchanged. That is the house engine contract — refusal is null from the engine and an unchanged
// state from the reducer — and the delegation in economyActions.js converts one to the other, so
// the reducer's observable behaviour is identical.
function purchase(state, powerupId) {
  const powerup = catalogueFor(state).find((p) => p.id === powerupId);
  if (!powerup) return null;

  const currency = currencyOf(powerup);
  if (!canAfford(state.wallet, currency, powerup.cost)) return null;

  const permanent = powerup.durationSeconds === null;
  if (permanent && state.powerups.purchasedPermanentIds.indexOf(powerup.id) !== -1) return null;

  // Buying a timed powerup that is already running REFRESHES it rather than stacking a second
  // instance — the old entry is filtered out and replaced. Preserved exactly from buyPowerup();
  // stacking would multiply a bonus the clamps are sized against.
  const activeWithoutThis = state.powerups.active.filter((p) => p.id !== powerup.id);
  const instance = {
    id: powerup.id,
    expiresAtClock: permanent ? null : state.clock + powerup.durationSeconds,
    type: powerup.effectType,
    value: powerup.value,
  };

  return {
    ...state,
    wallet: debitWallet(state.wallet, currency, powerup.cost),
    powerups: {
      active: [...activeWithoutThis, instance],
      purchasedPermanentIds: permanent
        ? [...state.powerups.purchasedPermanentIds, powerup.id]
        : state.powerups.purchasedPermanentIds,
    },
  };
}

module.exports = { listOffers, purchase };
