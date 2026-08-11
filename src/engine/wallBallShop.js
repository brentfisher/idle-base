// Act II's shop. Pure — no React, no DOM. Every number comes from
// data/wallBallShopConfig.js, and it follows the same contract engine/lotShop.js and
// engine/concessions.js have with their panels: listOffers() decides cost, ownership and
// affordability, and the component renders the answer without recomputing it.
const {
  GRIT_UPGRADES,
  CAP_HANDS,
  KIND_GRIT,
  KIND_HAND,
  getHand,
} = require('../data/wallBallShopConfig');
const { canAfford, debitWallet } = require('./wallet');

const CURRENCY = 'caps';

// A save written before this shop existed has neither key; absent slices are tolerated rather
// than migrated, as everywhere else in this codebase.
function shopSlice(state) {
  const slice = (state && state.wallBallShop) || {};
  return { grit: slice.grit || [], hands: slice.hands || [] };
}

function ownsGrit(state, gritId) {
  return shopSlice(state).grit.includes(gritId);
}

function handCount(state, handId) {
  const entry = shopSlice(state).hands.find((h) => h.handId === handId);
  return entry ? entry.count : 0;
}

function handCost(hand, owned) {
  return Math.round(hand.cost * hand.costGrowth ** owned);
}

// The caps rate every owned hand contributes. engine/income.js reads this.
function handsPerSecond(state) {
  return shopSlice(state).hands.reduce((sum, entry) => {
    const hand = getHand(entry.handId);
    return hand ? sum + hand.capsPerSecond * entry.count : sum;
  }, 0);
}

function costOf(state, kind, config) {
  return kind === KIND_HAND ? handCost(config, handCount(state, config.id)) : config.cost;
}

function isOwned(state, kind, config) {
  if (kind === KIND_HAND) return handCount(state, config.id) >= config.maxCount;
  return ownsGrit(state, config.id);
}

function describe(kind, config) {
  if (kind === KIND_HAND) return `+${config.capsPerSecond} caps/sec`;
  return `+${config.perClickBonus} per click, forever`;
}

function allOffers() {
  return [
    ...GRIT_UPGRADES.map((config) => ({ kind: KIND_GRIT, config })),
    ...CAP_HANDS.map((config) => ({ kind: KIND_HAND, config })),
  ];
}

function findOffer(offerId) {
  return allOffers().find((offer) => offer.config.id === offerId) || null;
}

function listOffers(state) {
  return allOffers().map(({ kind, config }) => {
    const cost = costOf(state, kind, config);
    return {
      id: config.id,
      kind,
      name: config.name,
      description: config.description,
      effect: describe(kind, config),
      cost,
      owned: isOwned(state, kind, config),
      affordable: canAfford(state.wallet, CURRENCY, cost),
      count: kind === KIND_HAND ? handCount(state, config.id) : 0,
      maxCount: kind === KIND_HAND ? config.maxCount : 1,
    };
  });
}

function addHand(slice, handId) {
  const existing = slice.hands.find((h) => h.handId === handId);
  const hands = existing
    ? slice.hands.map((h) => (h.handId === handId ? { ...h, count: h.count + 1 } : h))
    : [...slice.hands, { handId, count: 1 }];
  return { ...slice, hands };
}

// Returns the new state, or null when the purchase is not permitted. Mirrors
// engine/lotShop.js: null means refused, and the debit routes through engine/wallet.js so no
// balance can go below zero regardless.
function purchase(state, offerId) {
  const offer = findOffer(offerId);
  if (!offer) return null;

  const { kind, config } = offer;
  if (isOwned(state, kind, config)) return null;

  const cost = costOf(state, kind, config);
  if (!canAfford(state.wallet, CURRENCY, cost)) return null;

  const slice = shopSlice(state);
  const next = { ...state, wallet: debitWallet(state.wallet, CURRENCY, cost) };

  if (kind === KIND_HAND) {
    return { ...next, wallBallShop: addHand(slice, config.id) };
  }

  // Grit raises clicker.perClick, which every act's click reads — so this is worth something
  // in Act III's cash faucet too, not just here.
  return {
    ...next,
    clicker: { ...next.clicker, perClick: next.clicker.perClick + config.perClickBonus },
    wallBallShop: { ...slice, grit: [...slice.grit, config.id] },
  };
}

module.exports = { handsPerSecond, listOffers, findOffer, purchase, CURRENCY };
