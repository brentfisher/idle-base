// Act I — The Vacant Lot, plus the Hustle, which outlives it.
//
// The Hustle is the manual income action. It is available in every act, is never disabled,
// and its yield floor is above zero — the mechanical half of the anti-softlock guarantee
// (design.md Decision 6). Nothing here may gate it on act, cooldown, or balance.

const { COLLECTOR_TIERS, CLICK_UPGRADES, collectorCost } = require('../../data/lotConfig');
const { getKitItem } = require('../../data/kitConfig');
const { creditWallet, debitWallet, canAfford } = require('../../engine/wallet');
const { checkActTransition } = require('../../engine/progression');

function hustle(state) {
  const gain = Math.max(1, state.clicker.perClick);
  return {
    ...creditWallet(state, { caps: gain }),
    clicker: { ...state.clicker, totalClicks: state.clicker.totalClicks + 1 },
  };
}

function ownedCollectorCount(state, tierId) {
  const entry = state.income.collectors.find((c) => c.tierId === tierId);
  return entry ? entry.count : 0;
}

function buyCollector(state, action) {
  const tier = COLLECTOR_TIERS.find((t) => t.id === action.tierId);
  if (!tier) return state;
  const owned = ownedCollectorCount(state, tier.id);
  const cost = collectorCost(tier, owned);
  if (!canAfford(state, 'caps', cost)) return state;

  const exists = state.income.collectors.some((c) => c.tierId === tier.id);
  const collectors = exists
    ? state.income.collectors.map((c) => (c.tierId === tier.id ? { ...c, count: c.count + 1 } : c))
    : [...state.income.collectors, { tierId: tier.id, count: 1 }];

  return {
    ...debitWallet(state, 'caps', cost),
    income: { ...state.income, collectors },
    progression: { ...state.progression, milestones: { ...state.progression.milestones, firstCollector: true } },
  };
}

function buyClickUpgrade(state, action) {
  const upgrade = CLICK_UPGRADES.find((u) => u.id === action.upgradeId);
  if (!upgrade) return state;
  if (state.kit.purchasedClickUpgradeIds.includes(upgrade.id)) return state;
  if (!canAfford(state, 'caps', upgrade.cost)) return state;

  return {
    ...debitWallet(state, 'caps', upgrade.cost),
    clicker: { ...state.clicker, perClick: state.clicker.perClick + upgrade.perClickBonus },
    kit: { ...state.kit, purchasedClickUpgradeIds: [...state.kit.purchasedClickUpgradeIds, upgrade.id] },
  };
}

// Kit items span Act I (the Starter Kit, which is Act I's exit gate) and Act II (gear that
// raises wall-ball kit quality), so one handler covers both.
function buyKitItem(state, action) {
  const item = getKitItem(action.itemId);
  if (!item) return state;
  if (state.kit.ownedItemIds.includes(item.id)) return state;
  if (item.act > state.progression.act) return state;
  if (!canAfford(state, 'caps', item.cost)) return state;

  const next = {
    ...debitWallet(state, 'caps', item.cost),
    kit: { ...state.kit, ownedItemIds: [...state.kit.ownedItemIds, item.id] },
  };
  // Buying the last Starter Kit item is what ends Act I; resolve it immediately rather
  // than waiting up to a second for the next tick.
  return checkActTransition(next);
}

module.exports = { hustle, buyCollector, buyClickUpgrade, buyKitItem, ownedCollectorCount };
