const balanceConfig = require('../../data/balanceConfig');
const { CAMP_PROGRAMS } = require('../../data/campProgramsConfig');
const { clamp } = require('../../utils/statUtils');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost } = require('../../engine/economy');
const { startCamp } = require('../../engine/trainingCamp');
const { executeTrade } = require('../../engine/tradeDeadline');

function buyStatUpgrade(state, action) {
  const { playerId, stat } = action;
  const player = state.roster.find((p) => p.id === playerId);
  if (!player || player.stats[stat] == null) return state;
  const current = player.stats[stat];
  if (current >= balanceConfig.statCap) return state;

  const modifiers = computeModifiers(state);
  const cost = statUpgradeCost(current, modifiers);
  if (state.cash < cost) return state;

  const newValue = clamp(current + balanceConfig.statUpgradeAmount, 5, balanceConfig.statCap);
  const roster = state.roster.map((p) =>
    p.id === playerId ? { ...p, stats: { ...p.stats, [stat]: newValue } } : p
  );
  return { ...state, cash: state.cash - cost, roster };
}

// Only one player can be in training camp at a time (balanceConfig.campSlots).
function startCampAction(state, action) {
  const { playerId, programId } = action;
  const player = state.roster.find((p) => p.id === playerId);
  const program = CAMP_PROGRAMS.find((p) => p.id === programId);
  if (!player || !program || player.campStatus) return state;
  if (state.cash < program.cost) return state;
  if (state.roster.some((p) => p.campStatus)) return state;

  const modifiers = computeModifiers(state);
  const updatedPlayer = startCamp(player, programId, state.clock, modifiers);
  const roster = state.roster.map((p) => (p.id === playerId ? updatedPlayer : p));
  return { ...state, cash: state.cash - program.cost, roster };
}

function executeTradeAction(state, action) {
  const { windowIndex, candidateId } = action;
  const window = state.season.tradeWindows[windowIndex];
  if (!window || !window.open || window.used) return state;
  const candidate = window.candidates.find((c) => c.id === candidateId);
  if (!candidate || state.cash < candidate.cost) return state;

  const roster = executeTrade(state.roster, candidate);
  const tradeWindows = state.season.tradeWindows.map((w, i) =>
    i === windowIndex ? { ...w, used: true, open: false, candidates: [] } : w
  );
  return {
    ...state,
    cash: state.cash - candidate.cost,
    roster,
    season: { ...state.season, tradeWindows },
  };
}

module.exports = { buyStatUpgrade, startCampAction, executeTradeAction };
