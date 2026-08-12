// Act III's shop: what can be bought, what it costs, and what buying it does. Pure — no
// React, no DOM. Every number comes from data/concessionsConfig.js, never from here.
//
// Same contract components/lot/LotShop.js has with engine/lotShop.js: listOffers() returns a
// presentation-ready list with cost, ownership and affordability already decided, and the
// component renders it without recomputing any of them.
const {
  CONCESSION_STANDS,
  BOOSTERS,
  CAPS_UPGRADES,
  STAND_UPGRADES,
  CASH_CLICK_UPGRADES,
  KIND_STAND,
  KIND_BOOSTER,
  KIND_CAPS_UPGRADE,
  KIND_STAND_UPGRADE,
  KIND_CASH_CLICK_UPGRADE,
  getStand,
  getStandUpgrade,
} = require('../data/concessionsConfig');
const { canAfford, debitWallet } = require('./wallet');

const CURRENCY = 'cash';

// The shop is not single-currency: the caps upgrades are priced in the act's *previous*
// currency. Every affordability check and every debit reads this rather than assuming cash.
// Everything else — stands, boosters, stand upgrades and the cash half of the per-click
// ladder — is cash, so this stays a single exception rather than a table.
function currencyOf(kind) {
  return kind === KIND_CAPS_UPGRADE ? 'caps' : CURRENCY;
}

// Every read of the Act III slice goes through this. A save written before the shop existed
// has none of these keys, and this codebase tolerates an absent slice rather than migrating
// (see engine/wallBall.js, engine/feed.js).
//
// LOAD-BEARING BEYOND DEFAULTING: purchase() spreads the value returned here when it writes
// the slice back, so a key this function forgets is a key every purchase silently deletes.
// A save from before the stand upgrades shipped loads with `standUpgrades` absent, gets an
// empty array here, and keeps it — but if this returned only the three original arrays, an
// established player buying a lemonade table would lose their stand upgrades. Any array added
// to the slice must be added here in the same edit.
function concessionsSlice(state) {
  const slice = (state && state.concessions) || {};
  return {
    stands: slice.stands || [],
    boosters: slice.boosters || [],
    capsUpgrades: slice.capsUpgrades || [],
    standUpgrades: slice.standUpgrades || [],
    cashClickUpgrades: slice.cashClickUpgrades || [],
  };
}

function standCount(state, standId) {
  const entry = concessionsSlice(state).stands.find((s) => s.standId === standId);
  return entry ? entry.count : 0;
}

function ownsBooster(state, boosterId) {
  return concessionsSlice(state).boosters.includes(boosterId);
}

function ownsCapsUpgrade(state, id) {
  return concessionsSlice(state).capsUpgrades.includes(id);
}

function ownsStandUpgrade(state, id) {
  return concessionsSlice(state).standUpgrades.includes(id);
}

function ownsCashClickUpgrade(state, id) {
  return concessionsSlice(state).cashClickUpgrades.includes(id);
}

// Cost rises per copy already owned, so the second Lemonade Table is dearer than the first.
// Rounded once, here, so the number the shop prints is exactly the number debited.
function standCost(stand, owned) {
  return Math.round(stand.cost * stand.costGrowth ** owned);
}

// What the owned stand upgrades multiply the whole stand line by. Additive among themselves so
// the ceiling is a stated number and not an emergent one: every STAND_UPGRADES rateBonus owned
// at once is 1.75 (see the sizing argument in data/concessionsConfig.js). Returns exactly 1 for
// a save that has none, so this is invisible until something is bought.
function standRateMultiplier(state) {
  return concessionsSlice(state).standUpgrades.reduce((mult, id) => {
    const upgrade = getStandUpgrade(id);
    return upgrade ? mult + upgrade.rateBonus : mult;
  }, 1);
}

// The cash rate every owned stand contributes, summed, then scaled by the stand upgrades.
// engine/income.js reads this, and so does engine/bookie.js — the Bookie's minimum-bankroll
// floor is BOOKIE_FLOOR_SECONDS of passive income, so a player who buys the upgrades meets a
// proportionally higher floor. That is the intended reading of the floor ("the money a player
// gambles is always money they had spare"), not a side effect to be corrected for.
//
// The multiplier is applied here rather than in income.js so that every consumer of the
// concessions rate — income, the Bookie's floor, the panel's own readout — agrees on one
// number. Note it scales the STANDS only: sponsorshipsPerSecond() is a separate contributor
// and a concessions upgrade has no business inflating an Act IV sponsor's cheque.
function concessionsPerSecond(state) {
  const base = concessionsSlice(state).stands.reduce((sum, entry) => {
    const stand = getStand(entry.standId);
    return stand ? sum + stand.cashPerSecond * entry.count : sum;
  }, 0);
  return base * standRateMultiplier(state);
}

function costOf(state, kind, config) {
  return kind === KIND_STAND ? standCost(config, standCount(state, config.id)) : config.cost;
}

function isOwned(state, kind, config) {
  if (kind === KIND_STAND) return standCount(state, config.id) >= config.maxCount;
  if (kind === KIND_CAPS_UPGRADE) return ownsCapsUpgrade(state, config.id);
  if (kind === KIND_STAND_UPGRADE) return ownsStandUpgrade(state, config.id);
  if (kind === KIND_CASH_CLICK_UPGRADE) return ownsCashClickUpgrade(state, config.id);
  return ownsBooster(state, config.id);
}

// One short line saying what the money does.
//
// The two per-click kinds read IDENTICALLY, and that is deliberate: they are the same mechanic
// and they sit next to each other in the panel, split only by which currency pays for them.
// The caps rungs used to promise "+N per click, forever" and the word came out when the cash
// rungs shipped beside them — it made the cheaper, weaker rung sound like the better deal on
// permanence, when both are equally permanent as `perClick` and both are equally subject to
// Act V dropping clickMultiplier back to 1x. Two adjacent groups selling one thing must make
// one promise, or the difference in wording reads as a difference in the goods.
function describe(kind, config) {
  if (kind === KIND_STAND) return `+$${config.cashPerSecond}/sec`;
  if (kind === KIND_CAPS_UPGRADE || kind === KIND_CASH_CLICK_UPGRADE) {
    return `+${config.perClickBonus} per click`;
  }
  if (kind === KIND_STAND_UPGRADE) return `+${Math.round(config.rateBonus * 100)}% from every stand`;
  return `+${config.reputation} reputation`;
}

// Grouped by kind, cheapest-first within a kind, and the panel renders the groups in this
// order. As before there is no progressive reveal — the 22,000 rungs are visible from the
// first minute of Act III, greyed out, because a ladder the player cannot see the top of is
// not a ladder they can plan against.
function allOffers() {
  return [
    ...CONCESSION_STANDS.map((config) => ({ kind: KIND_STAND, config })),
    ...STAND_UPGRADES.map((config) => ({ kind: KIND_STAND_UPGRADE, config })),
    ...CAPS_UPGRADES.map((config) => ({ kind: KIND_CAPS_UPGRADE, config })),
    ...CASH_CLICK_UPGRADES.map((config) => ({ kind: KIND_CASH_CLICK_UPGRADE, config })),
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
      currency: currencyOf(kind),
      affordable: canAfford(state.wallet, currencyOf(kind), cost),
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
  const currency = currencyOf(kind);
  if (!canAfford(state.wallet, currency, cost)) return null;

  const slice = concessionsSlice(state);
  const next = { ...state, wallet: debitWallet(state.wallet, currency, cost) };

  if (kind === KIND_STAND) {
    return { ...next, concessions: addStand(slice, config.id) };
  }

  // Both halves of the per-click ladder do exactly the same thing to state; they differ only
  // in which array records the purchase and which currency was already debited above.
  if (kind === KIND_CAPS_UPGRADE) {
    return {
      ...next,
      clicker: { ...next.clicker, perClick: next.clicker.perClick + config.perClickBonus },
      concessions: { ...slice, capsUpgrades: [...slice.capsUpgrades, config.id] },
    };
  }

  if (kind === KIND_CASH_CLICK_UPGRADE) {
    return {
      ...next,
      clicker: { ...next.clicker, perClick: next.clicker.perClick + config.perClickBonus },
      concessions: { ...slice, cashClickUpgrades: [...slice.cashClickUpgrades, config.id] },
    };
  }

  // Nothing outside the slice to write: concessionsPerSecond() derives the multiplier from the
  // owned list every time it is called, so the rate is never stored and can never drift out of
  // step with the config the way a cached number would.
  if (kind === KIND_STAND_UPGRADE) {
    return { ...next, concessions: { ...slice, standUpgrades: [...slice.standUpgrades, config.id] } };
  }

  return {
    ...next,
    reputation: state.reputation + config.reputation,
    concessions: { ...slice, boosters: [...slice.boosters, config.id] },
  };
}

module.exports = {
  concessionsPerSecond,
  standRateMultiplier,
  listOffers,
  findOffer,
  purchase,
  standCost,
  CURRENCY,
};
