// Act I's shop: what can be bought out of the vacant lot, what it costs, and what buying
// it does. Pure — no React, no DOM. Every number comes from data/, never from here.
const { COLLECTOR_TIERS, getCollectorTier } = require('../data/collectorTiers');
const { CLICK_UPGRADES, STARTER_KIT_ITEMS, ACT_ONE } = require('../data/actOneConfig');
const { canAfford, debitWallet } = require('./wallet');

const KIND_COLLECTOR = 'collector';
const KIND_CLICK_UPGRADE = 'clickUpgrade';
const KIND_STARTER_KIT = 'starterKit';

function collectorCount(state, tierId) {
  const entry = state.income.collectors.find((c) => c.tierId === tierId);
  return entry ? entry.count : 0;
}

function ownsClickUpgrade(state, upgradeId) {
  return state.lot.clickUpgrades.includes(upgradeId);
}

function ownsStarterKitItem(state, itemId) {
  return state.lot.starterKit.includes(itemId);
}

function ownsFullStarterKit(state) {
  return STARTER_KIT_ITEMS.every((item) => ownsStarterKitItem(state, item.id));
}

function ownsAnyCollector(state) {
  return state.income.collectors.some((c) => c.count > 0);
}

function isOwned(state, kind, config) {
  if (kind === KIND_COLLECTOR) return collectorCount(state, config.id) >= config.maxCount;
  if (kind === KIND_CLICK_UPGRADE) return ownsClickUpgrade(state, config.id);
  return ownsStarterKitItem(state, config.id);
}

// Progressive reveal. Both rules key off quantities that only ever grow, so an offer never
// disappears again once seen — spending caps must not un-reveal the shop.
//   1. The lead offer (the first collector) appears once the player is halfway to it.
//   2. Owning any collector opens the rest of the lot.
// A brand-new game therefore shows the click button and nothing else, and the player's
// first purchase is necessarily the first automation rather than a Starter Kit item that
// happens to cost the same.
function isRevealed(state, kind, config, isLeadOffer) {
  if (isOwned(state, kind, config)) return true;
  if (ownsAnyCollector(state)) return true;
  if (!isLeadOffer) return false;
  return state.wallet.caps >= config.cost * ACT_ONE.firstOfferRevealAtFraction;
}

function describe(kind, config) {
  if (kind === KIND_COLLECTOR) return `+${config.capsPerSecond} caps/sec`;
  if (kind === KIND_CLICK_UPGRADE) return `+${config.perClickBonus} cap/click`;
  return 'Starter Kit item';
}

function allOffers() {
  return [
    ...COLLECTOR_TIERS.map((config) => ({ kind: KIND_COLLECTOR, config })),
    ...CLICK_UPGRADES.map((config) => ({ kind: KIND_CLICK_UPGRADE, config })),
    ...STARTER_KIT_ITEMS.map((config) => ({ kind: KIND_STARTER_KIT, config })),
  ];
}

function findOffer(offerId) {
  return allOffers().find((offer) => offer.config.id === offerId) || null;
}

// Presentation-ready view of the shop, sorted cheapest-first. The component renders this
// and decides nothing about cost, ownership or availability itself.
// Ties on cost are broken by allOffers()'s ordering, which puts collectors first — so the
// lead offer is the first collector even though a Starter Kit item costs the same.
function listOffers(state) {
  const offers = allOffers().sort((a, b) => a.config.cost - b.config.cost);

  return offers.map(({ kind, config }, index) => ({
    id: config.id,
    kind,
    name: config.name,
    description: config.description,
    effect: describe(kind, config),
    cost: config.cost,
    owned: isOwned(state, kind, config),
    affordable: state.wallet.caps >= config.cost,
    revealed: isRevealed(state, kind, config, index === 0),
  }));
}

function addCollector(state, tier) {
  const existing = state.income.collectors.find((c) => c.tierId === tier.id);
  const collectors = existing
    ? state.income.collectors.map((c) => (c.tierId === tier.id ? { ...c, count: c.count + 1 } : c))
    : [...state.income.collectors, { tierId: tier.id, count: 1 }];
  return { ...state, income: { ...state.income, collectors } };
}

// Returns the new state, or null when the purchase is not permitted (unknown offer,
// already owned, or unaffordable). No currency may go below zero — design Decision 6.
function purchase(state, offerId) {
  const offer = findOffer(offerId);
  if (!offer) return null;

  const { kind, config } = offer;
  if (isOwned(state, kind, config)) return null;
  if (!canAfford(state.wallet, 'caps', config.cost)) return null;

  let next = { ...state, wallet: debitWallet(state.wallet, 'caps', config.cost) };

  if (kind === KIND_COLLECTOR) {
    next = addCollector(next, getCollectorTier(config.id));
  } else if (kind === KIND_CLICK_UPGRADE) {
    next = {
      ...next,
      clicker: { ...next.clicker, perClick: next.clicker.perClick + config.perClickBonus },
      lot: { ...next.lot, clickUpgrades: [...next.lot.clickUpgrades, config.id] },
    };
  } else {
    next = { ...next, lot: { ...next.lot, starterKit: [...next.lot.starterKit, config.id] } };
  }

  return next;
}

module.exports = {
  KIND_COLLECTOR,
  KIND_CLICK_UPGRADE,
  KIND_STARTER_KIT,
  collectorCount,
  ownsFullStarterKit,
  listOffers,
  findOffer,
  purchase,
};
