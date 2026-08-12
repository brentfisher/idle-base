const { CAMP_PROGRAMS } = require('../../data/campProgramsConfig');
const { clamp } = require('../../utils/statUtils');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost } = require('../../engine/economy');
const { sendToCamp } = require('../../engine/trainingCamp');
const { executeTrade } = require('../../engine/tradeDeadline');
const { canAfford, debitWallet } = require('../../engine/wallet');

function buyStatUpgrade(state, action) {
  const { playerId, stat } = action;
  const player = state.roster.find((p) => p.id === playerId);
  if (!player || player.stats[stat] == null) return state;
  const current = player.stats[stat];

  // Resolved rather than read off balanceConfig, the same way engine/economy.js resolves the
  // cost curve: an act or era is allowed to move the ceiling, and the roster screen now prints
  // "74 / 100" from the resolved value. A button that says one cap while the reducer enforces
  // another is the exact confusion this change is fixing.
  const modifiers = computeModifiers(state);
  const { statCap, statUpgradeAmount } = modifiers.rules;
  if (current >= statCap) return state;

  const cost = statUpgradeCost(current, modifiers);
  if (!canAfford(state.wallet, 'cash', cost)) return state;

  const newValue = clamp(current + statUpgradeAmount, 5, statCap);
  const roster = state.roster.map((p) =>
    p.id === playerId ? { ...p, stats: { ...p.stats, [stat]: newValue } } : p
  );
  return { ...state, wallet: debitWallet(state.wallet, 'cash', cost), roster };
}

// Only one player can be in training camp at a time (balanceConfig.campSlots).
//
// Sending a STARTER now also pulls their replacement off the bench — engine/trainingCamp.js owns
// both halves of that, because the swap has to be undone precisely when the camp completes and
// completion can happen deep inside an offline catch-up with no reducer in sight.
//
// The wallet is only debited if the roster actually changed. sendToCamp refuses a starter who has
// nobody to cover for them, and charging 300 for a camp that did not start would be the worst
// possible version of this bug.
function startCampAction(state, action) {
  const { playerId, programId } = action;
  const player = state.roster.find((p) => p.id === playerId);
  const program = CAMP_PROGRAMS.find((p) => p.id === programId);
  if (!player || !program || player.campStatus) return state;
  if (!canAfford(state.wallet, 'cash', program.cost)) return state;
  if (state.roster.some((p) => p.campStatus)) return state;

  const modifiers = computeModifiers(state);
  const roster = sendToCamp(state.roster, playerId, programId, state.clock, modifiers);
  if (roster === state.roster) return state;
  return { ...state, wallet: debitWallet(state.wallet, 'cash', program.cost), roster };
}

function executeTradeAction(state, action) {
  const { windowIndex, candidateId } = action;
  const window = state.season.tradeWindows[windowIndex];
  if (!window || !window.open || window.used) return state;
  const candidate = window.candidates.find((c) => c.id === candidateId);
  if (!candidate || !canAfford(state.wallet, 'cash', candidate.cost)) return state;

  const roster = executeTrade(state.roster, candidate);
  const tradeWindows = state.season.tradeWindows.map((w, i) =>
    i === windowIndex ? { ...w, used: true, open: false, candidates: [] } : w
  );
  return {
    ...state,
    wallet: debitWallet(state.wallet, 'cash', candidate.cost),
    roster,
    season: { ...state.season, tradeWindows },
  };
}

module.exports = { buyStatUpgrade, startCampAction, executeTradeAction };
