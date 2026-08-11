// Act III's shop: what can be bought, what it costs, and what buying it does. Pure — no
// React, no DOM. Every number comes from data/concessionsConfig.js, never from here.
//
// Same contract components/lot/LotShop.js has with engine/lotShop.js: listOffers() returns a
// presentation-ready list with cost, ownership and affordability already decided, and the
// component renders it without recomputing any of them.
const {
  CONCESSION_STANDS,
  BOOSTERS,
  KIND_STAND,
  KIND_BOOSTER,
  getStand,
  getBooster,
} = require('../data/concessionsConfig');
const { canAfford, debitWallet } = require('./wallet');

const CURRENCY = 'cash';

// Every read of the Act III slice goes through this. A save written before the shop existed
// has neither key, and this codebase tolerates an absent slice rather than migrating (see
// engine/wallBall.js, engine/feed.js).
function concessionsSlice(state) {
  const slice = (state && state.concessions) || {};
  return { stands: slice.stands || [], boosters: slice.boosters || [] };
}

function standCount(state, standId) {
  const entry = concessionsSlice(state).stands.find((s) => s.standId === standId);
  return entry ? entry.count : 0;
}

function ownsBooster(state, boosterId) {
  return concessionsSlice(state).boosters.includes(boosterId);
}

// Cost rises per copy already owned, so the second Lemonade Table is dearer than the first.
// Rounded once, here, so the number the shop prints is exactly the number debited.
function standCost(stand, owned) {
  return Math.round(stand.cost * stand.costGrowth ** owned);
}

// The cash rate every owned stand contributes, summed. engine/income.js reads this.
function concessionsPerSecond(state) {
  return concessionsSlice(state).stands.reduce((sum, entry) => {
    const stand = getStand(entry.standId);
    return stand ? sum + stand.cashPerSecond * entry.count : sum;
  }, 0);
}

function costOf(state, kind, config) {
  return kind === KIND_STAND ? standCost(config, standCount(state, config.id)) : config.cost;
}

function isOwned(state, kind, config) {
  if (kind === KIND_STAND) return standCount(state, config.id) >= config.maxCount;
  return ownsBooster(state, config.id);
}

function describe(kind, config) {
  if (kind === KIND_STAND) return `+$${config.cashPerSecond}/sec`;
  return `+${config.reputation} reputation`;
}

function allOffers() {
  return [
    ...CONCESSION_STANDS.map((config) => ({ kind: KIND_STAND, config })),
    ...BOOSTERS.map((config) => ({ kind: KIND_BOOSTER, config })),
  ];
}

function findOffer(offerId) {
  return allOffers().find((offer) => offer.config.id === offerId) || null;
}

// Presentation-ready view, cheapest-first within each kind. Unlike Act I's lot there is no
// progressive reveal: by Act III the player has seen two shops and does not need teaching.
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
      count: kind === KIND_STAND ? standCount(state, config.id) : 0,
      maxCount: kind === KIND_STAND ? config.maxCount : 1,
    };
  });
}

function addStand(slice, standId) {
  const existing = slice.stands.find((s) => s.standId === standId);
  const stands = existing
    ? slice.stands.map((s) => (s.standId === standId ? { ...s, count: s.count + 1 } : s))
    : [...slice.stands, { standId, count: 1 }];
  return { ...slice, stands };
}

// Returns the new state, or null when the purchase is not permitted (unknown offer, already
// owned/maxed, or unaffordable). Mirrors engine/lotShop.js: null means "refused", and no
// currency may go below zero — the debit itself goes through engine/wallet.js regardless.
function purchase(state, offerId) {
  const offer = findOffer(offerId);
  if (!offer) return null;

  const { kind, config } = offer;
  if (isOwned(state, kind, config)) return null;

  const cost = costOf(state, kind, config);
  if (!canAfford(state.wallet, CURRENCY, cost)) return null;

  const slice = concessionsSlice(state);
  const next = { ...state, wallet: debitWallet(state.wallet, CURRENCY, cost) };

  if (kind === KIND_STAND) {
    return { ...next, concessions: addStand(slice, config.id) };
  }

  return {
    ...next,
    reputation: state.reputation + config.reputation,
    concessions: { ...slice, boosters: [...slice.boosters, config.id] },
  };
}

module.exports = { concessionsPerSecond, listOffers, findOffer, purchase, standCost, CURRENCY };
