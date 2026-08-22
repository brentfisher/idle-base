const { PERKS } = require('../../data/perksConfig');
const { resetForPrestige, calculateLegacyPoints } = require('../../engine/prestige');

// REFUSES A PRESTIGE THAT WOULD EARN NOTHING, returning the identical state object the way every
// other refused purchase in this codebase does.
//
// The panel already disables the button at zero, so reaching this is a stale render or a replayed
// dispatch — but the gate belongs here as well, because this action had NO gate of any kind and
// that is what made the exploit reachable at all: `resetForPrestige` was called unconditionally,
// so the reset ran, the roster was rebuilt, and one tick later there were ~50 more points to
// collect. See calculateLegacyPoints() for the payout half of the fix.
//
// It also protects something the payout fix does not. `prestige.era` only ever increments — nothing
// in the codebase decrements it — and data/eras.js synthesises eras past the authored five with
// `aiStrengthMult` climbing each step. So a prestige is an IRREVERSIBLE difficulty increase, and
// one that banks nothing is pure loss. Refusing it means a mis-click cannot cost a player a run.
function prestigeResetAction(state) {
  if (calculateLegacyPoints(state) <= 0) return state;
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
