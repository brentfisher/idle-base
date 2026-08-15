const { computeModifiers } = require('../../engine/modifiers');
const { purchase } = require('../../engine/powerupShop');
const { stadiumUpgradeCost, stadiumCapacityGain } = require('../../engine/economy');
const { canAfford, debitWallet } = require('../../engine/wallet');

function setTicketPrice(state, action) {
  const price = Math.max(1, Math.round(action.price));
  return { ...state, stadium: { ...state.stadium, ticketPrice: price } };
}

// Three-line delegation to engine/powerupShop.js. The logic that used to live here moved into
// the engine so the shop could follow the house contract — see that file's header for the two
// bugs the move fixes (a hardcoded 'cash' on both the affordability check and the debit, and an
// unfiltered catalogue that would have leaked Act VII's Salvage-priced rows into Act V's shop).
//
// The engine returns null for refused; a reducer returns the state it was handed. Returning the
// IDENTICAL object matters — several call sites detect "nothing happened" by reference equality.
function buyPowerup(state, action) {
  const next = purchase(state, action.powerupId);
  return next || state;
}

function upgradeStadium(state) {
  const modifiers = computeModifiers(state);
  const cost = stadiumUpgradeCost(state.stadium.level, modifiers);
  if (!canAfford(state.wallet, 'cash', cost)) return state;
  const capacityGain = stadiumCapacityGain(state.stadium.level);
  return {
    ...state,
    wallet: debitWallet(state.wallet, 'cash', cost),
    stadium: { ...state.stadium, level: state.stadium.level + 1, capacity: state.stadium.capacity + capacityGain },
  };
}

module.exports = { setTicketPrice, buyPowerup, upgradeStadium };
