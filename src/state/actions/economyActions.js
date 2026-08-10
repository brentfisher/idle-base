const { POWERUPS } = require('../../data/powerupsConfig');
const { computeModifiers } = require('../../engine/modifiers');
const { stadiumUpgradeCost, stadiumCapacityGain } = require('../../engine/economy');
const { debitWallet } = require('../../engine/wallet');

function setTicketPrice(state, action) {
  const price = Math.max(1, Math.round(action.price));
  return { ...state, stadium: { ...state.stadium, ticketPrice: price } };
}

function buyPowerup(state, action) {
  const powerup = POWERUPS.find((p) => p.id === action.powerupId);
  if (!powerup) return state;
  if (state.wallet.cash < powerup.cost) return state;

  const isPermanent = powerup.durationSeconds === null;
  if (isPermanent && state.powerups.purchasedPermanentIds.includes(powerup.id)) return state;

  const activeWithoutThis = state.powerups.active.filter((p) => p.id !== powerup.id);
  const instance = {
    id: powerup.id,
    expiresAtClock: isPermanent ? null : state.clock + powerup.durationSeconds,
    type: powerup.effectType,
    value: powerup.value,
  };

  return {
    ...debitWallet(state, 'cash', powerup.cost),
    powerups: {
      active: [...activeWithoutThis, instance],
      purchasedPermanentIds: isPermanent
        ? [...state.powerups.purchasedPermanentIds, powerup.id]
        : state.powerups.purchasedPermanentIds,
    },
  };
}

function upgradeStadium(state) {
  const modifiers = computeModifiers(state);
  const cost = stadiumUpgradeCost(state.stadium.level, modifiers);
  if (state.wallet.cash < cost) return state;
  const capacityGain = stadiumCapacityGain(state.stadium.level);
  return {
    ...debitWallet(state, 'cash', cost),
    stadium: { ...state.stadium, level: state.stadium.level + 1, capacity: state.stadium.capacity + capacityGain },
  };
}

module.exports = { setTicketPrice, buyPowerup, upgradeStadium };
