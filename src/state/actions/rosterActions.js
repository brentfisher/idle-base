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

// Buys as many upgrades as the wallet and the cap allow, by REPLAYING THE REAL PURCHASE ABOVE.
//
// LOOPS buyStatUpgrade() RATHER THAN REIMPLEMENTING IT, and terminates on IDENTITY. That function
// returns the state object it was handed, unchanged and by reference, on every one of its three
// refusals — no such player or stat, already at the cap, cannot afford it — so `next === held` is
// exactly "the engine declined" and needs no second copy of any gate here. Every step is therefore
// priced by the real cost curve as the stat climbs, and the debit is the sum of the actual
// escalating prices rather than a multiple of the first one.
//
// engine/economy.js's planMaxStatUpgrades() computes the same figures for the BUTTON'S LABEL, and
// is deliberately not trusted here: a stale render could hand this a count that no longer fits the
// wallet. The label predicts; this decides.
//
// The iteration cap is structural rather than defensive, on engine/tickEngine.js's
// safetyCapIterations precedent: the loop already cannot outrun the cap or the wallet, but a retune
// that made statUpgradeAmount zero would otherwise spin forever on a state that never changes.
const MAX_UPGRADE_STEPS = 1000;

function buyStatUpgradeMax(state, action) {
  let held = state;
  for (let step = 0; step < MAX_UPGRADE_STEPS; step += 1) {
    const next = buyStatUpgrade(held, action);
    if (next === held) break;
    held = next;
  }
  // Returns the ORIGINAL object when nothing was bought, so a press with no money and a press on a
  // capped stat are both no-ops by reference, exactly as a single refused purchase is.
  return held;
}

module.exports = { buyStatUpgrade, buyStatUpgradeMax, startCampAction, executeTradeAction };
