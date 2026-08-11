// Act IV's shop: who is paying for the season, and what a name is worth.
//
// Same contract components/lot/LotShop.js has with engine/lotShop.js and Act III's panel has
// with engine/concessions.js — listOffers() returns a presentation-ready list with cost,
// ownership, lock state and affordability already decided, and the component renders it
// without recomputing any of them.
//
// The two halves feed each other on purpose. Sponsors pay cash and their rate scales with
// reputation; reputation deals cost cash and raise reputation, which raises both the sponsor
// rate and team strength (balanceConfig.reputationStrengthPerPoint). Buying either makes the
// other better, and the act's exit — a 60% win rate — needs the strength half.
//
// Pure — no React, no DOM. Every number comes from data/actFourConfig.js.
const balanceConfig = require('../data/balanceConfig');
const {
  SPONSORS,
  REPUTATION_DEALS,
  SPONSOR_REPUTATION_SCALE,
  KIND_SPONSOR,
  KIND_REPUTATION,
  getSponsor,
  getReputationDeal,
} = require('../data/actFourConfig');
const { canAfford, debitWallet } = require('./wallet');
const { travelBallSlice } = require('./travelBall');

const CURRENCY = 'cash';

// Sponsor ids live in `state.income.sponsorships` rather than in the Act IV slice, because
// that array has existed since initialState.js was written and engine/income.js's contributor
// table names it. Reputation deals are one-off purchases with no income role, so they live
// with the rest of the act's own state in `state.travelBall`.
function sponsorIds(state) {
  return (state && state.income && state.income.sponsorships) || [];
}

function reputationDealIds(state) {
  return travelBallSlice(state).reputationDeals;
}

function reputationOf(state) {
  const reputation = state && typeof state.reputation === 'number' ? state.reputation : balanceConfig.startingReputation;
  return Math.max(0, reputation);
}

// What one sponsor pays right now. Reputation above the starting value is a multiplier, so
// the deal signed in the first minute of the act keeps getting better as the act is played —
// which is what stops the early sponsor from being a trap purchase.
function sponsorMultiplier(state) {
  return 1 + Math.max(0, reputationOf(state) - balanceConfig.startingReputation) * SPONSOR_REPUTATION_SCALE;
}

function sponsorRate(state, sponsor) {
  return sponsor.cashPerSecond * sponsorMultiplier(state);
}

// The cash rate every signed sponsor contributes, summed. engine/income.js reads this.
function sponsorshipsPerSecond(state) {
  const multiplier = sponsorMultiplier(state);
  return sponsorIds(state).reduce((sum, id) => {
    const sponsor = getSponsor(id);
    return sponsor ? sum + sponsor.cashPerSecond * multiplier : sum;
  }, 0);
}

function isOwned(state, kind, config) {
  return kind === KIND_SPONSOR
    ? sponsorIds(state).includes(config.id)
    : reputationDealIds(state).includes(config.id);
}

// Sponsors are gated on reputation; reputation deals never are. A locked sponsor is SHOWN —
// it is the thing the reputation deals are for, and hiding it would hide the loop.
function isLocked(state, kind, config) {
  return kind === KIND_SPONSOR && reputationOf(state) < config.minReputation;
}

function findOffer(offerId) {
  const sponsor = getSponsor(offerId);
  if (sponsor) return { kind: KIND_SPONSOR, config: sponsor };
  const deal = getReputationDeal(offerId);
  if (deal) return { kind: KIND_REPUTATION, config: deal };
  return null;
}

function describeEffect(state, kind, config) {
  if (kind === KIND_SPONSOR) return `+$${sponsorRate(state, config).toFixed(0)}/sec`;
  return `+${config.reputation} reputation`;
}

function listOffers(state) {
  const all = [
    ...SPONSORS.map((config) => ({ kind: KIND_SPONSOR, config })),
    ...REPUTATION_DEALS.map((config) => ({ kind: KIND_REPUTATION, config })),
  ];

  return all.map(({ kind, config }) => ({
    id: config.id,
    kind,
    name: config.name,
    description: config.description,
    effect: describeEffect(state, kind, config),
    cost: config.cost,
    currency: CURRENCY,
    owned: isOwned(state, kind, config),
    locked: isLocked(state, kind, config),
    minReputation: kind === KIND_SPONSOR ? config.minReputation : 0,
    affordable: canAfford(state.wallet, CURRENCY, config.cost),
  }));
}

// Returns the new state, or null when the purchase is not permitted (unknown offer, already
// owned, locked behind reputation, or unaffordable). Mirrors engine/concessions.js: null means
// "refused", and the debit itself goes through engine/wallet.js regardless, so no path here
// can drive a balance below zero.
function purchase(state, offerId) {
  const offer = findOffer(offerId);
  if (!offer) return null;

  const { kind, config } = offer;
  if (isOwned(state, kind, config)) return null;
  if (isLocked(state, kind, config)) return null;
  if (!canAfford(state.wallet, CURRENCY, config.cost)) return null;

  const next = { ...state, wallet: debitWallet(state.wallet, CURRENCY, config.cost) };

  if (kind === KIND_SPONSOR) {
    return {
      ...next,
      income: { ...next.income, sponsorships: [...sponsorIds(state), config.id] },
    };
  }

  return {
    ...next,
    reputation: reputationOf(state) + config.reputation,
    travelBall: { ...travelBallSlice(state), reputationDeals: [...reputationDealIds(state), config.id] },
  };
}

module.exports = {
  CURRENCY,
  sponsorMultiplier,
  sponsorRate,
  sponsorshipsPerSecond,
  listOffers,
  findOffer,
  purchase,
};
