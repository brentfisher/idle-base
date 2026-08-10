const { PERKS } = require('../../data/perksConfig');
const { resetForPrestige } = require('../../engine/prestige');

function prestigeResetAction(state) {
  return resetForPrestige(state);
}

function buyPerkAction(state, action) {
  const perk = PERKS.find((p) => p.id === action.perkId);
  if (!perk) return state;
  if (state.prestige.purchasedPerks.includes(perk.id)) return state;
  if (perk.prerequisite && !state.prestige.purchasedPerks.includes(perk.prerequisite)) return state;
  if (state.prestige.legacyPoints < perk.legacyCost) return state;

  return {
    ...state,
    prestige: {
      ...state.prestige,
      legacyPoints: state.prestige.legacyPoints - perk.legacyCost,
      purchasedPerks: [...state.prestige.purchasedPerks, perk.id],
    },
  };
}

function acknowledgeVictoryAction(state) {
  return {
    ...state,
    prestige: { ...state.prestige, victoryAcknowledgedCount: state.prestige.runStats.championships },
  };
}

module.exports = { prestigeResetAction, buyPerkAction, acknowledgeVictoryAction };
