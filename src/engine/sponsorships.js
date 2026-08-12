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
const { travelBallSlice, TRAVEL_BALL_ACT_INDEX } = require('./travelBall');

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

// ---------------------------------------------------------------------------
// Announcing a sponsor the moment it comes off the lock
// ---------------------------------------------------------------------------
// A sponsor unlocks when reputation crosses its `minReputation`, which happens inside a
// purchase — a reducer, not a tick — and until now the board simply changed while nobody was
// looking. The player found out by opening the tab, which means the loop the act is built on
// (buy reputation, unlock a bigger sponsor, buy that) was invisible unless you already knew it
// was there. engine/tickEngine.js narrates the transition; this half decides what happened.
//
// A LEDGER, NOT A DIFF. The obvious implementation compares this tick's board against last
// tick's, and it is wrong here for the same reason it is wrong everywhere else in this engine:
// advance() runs many iterations in one 8-hour catch-up and exactly one iteration when nothing
// is pending, so a tick-to-tick diff both misses transitions and repeats them. Instead the ids
// already announced are stored, and "new" is whatever is unlocked and not in that list — the
// same idiom as progression.storyBeatsSeen and prestige.victoryAcknowledgedCount. Announcing
// is then idempotent by construction: an id can only leave the unannounced set, never re-enter
// it, so no number of iterations can produce a second entry for the same sponsor.
//
// Lives in its own top-level slice rather than in `state.travelBall`, because travelBallSlice()
// above returns a FIXED shape — an extra key written into that slice is silently dropped the
// next time purchase() rebuilds it from the accessor.
function sponsorBoardSlice(state) {
  const slice = (state && state.sponsorBoard) || {};
  return {
    announcedOfferIds: slice.announcedOfferIds || [],
  };
}

function actIndexOf(state) {
  const act = state && state.progression && state.progression.act;
  return typeof act === 'number' && Number.isFinite(act) ? act : 0;
}

// Pure. The sponsors that have become available since the last announcement, in board order.
//
// Gated on the act because listOffers() is act-blind by design: Dorsey's needs 0 reputation and
// the player starts with 20, so from Act I onward he is technically "available" — announcing
// him to a nine-year-old digging bottle caps out of a vacant lot would be the first the player
// ever heard of sponsorship, two acts before the tab exists. The gate reads the act index
// rather than engine/progression.js's feature list to avoid making this module depend on the
// progression engine, which already depends transitively on this one's neighbours.
//
// Owned sponsors are excluded rather than announced-and-skipped. Only a save written before
// this feature existed can hold a sponsor that was never announced, and telling that player
// about a deal they signed weeks ago is worse than telling them nothing. Reputation-deal
// offers are never locked (see isLocked), so they have no transition to announce and are not
// considered here at all — which also keeps entering Act IV to a single feed entry rather than
// four.
function newlyAvailableSponsors(state) {
  if (actIndexOf(state) < TRAVEL_BALL_ACT_INDEX) return [];
  const announced = sponsorBoardSlice(state).announcedOfferIds;
  return SPONSORS.filter(
    (sponsor) =>
      !announced.includes(sponsor.id) &&
      !isLocked(state, KIND_SPONSOR, sponsor) &&
      !isOwned(state, KIND_SPONSOR, sponsor)
  );
}

// Writes ids into the ledger. Returns the same object when there is nothing to add, so the
// tick loop can call it unconditionally every second without churning state or the autosave.
function markSponsorsAnnounced(state, sponsorIdList) {
  if (!sponsorIdList || sponsorIdList.length === 0) return state;
  const announced = sponsorBoardSlice(state).announcedOfferIds;
  const added = sponsorIdList.filter((id) => !announced.includes(id));
  if (added.length === 0) return state;
  return { ...state, sponsorBoard: { ...sponsorBoardSlice(state), announcedOfferIds: [...announced, ...added] } };
}

// The most recently announced sponsor still sitting unsigned — what the panel badges as new.
//
// Derived from the ledger rather than from a "seen" flag the panel would have to write on
// every render: a badge that clears on merely LOOKING needs an action, a reducer and a write
// this module does not own, and it would clear itself for a player who opened the tab to check
// something else. Reading the ledger instead means the badge costs nothing, survives a reload,
// and clears on the only event that actually means the player dealt with it — signing. It then
// falls back to the next-newest unsigned deal, because that is now the news.
function newestUnsignedSponsorId(state) {
  const announced = sponsorBoardSlice(state).announcedOfferIds;
  for (let i = announced.length - 1; i >= 0; i -= 1) {
    const sponsor = getSponsor(announced[i]);
    if (sponsor && !isOwned(state, KIND_SPONSOR, sponsor)) return sponsor.id;
  }
  return null;
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

  // Computed once for the whole list rather than per card: it is a scan of the ledger, and the
  // panel renders six cards from one call.
  const newestId = newestUnsignedSponsorId(state);

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
    isNew: kind === KIND_SPONSOR && config.id === newestId,
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
  sponsorBoardSlice,
  newlyAvailableSponsors,
  markSponsorsAnnounced,
  newestUnsignedSponsorId,
};
