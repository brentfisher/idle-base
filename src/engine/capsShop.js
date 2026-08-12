// The late-game caps sink: what can be bought with bottle caps once the franchise runs on
// cash, what it costs, and what buying it does. Pure — no React, no DOM. Every number comes
// from data/capsShopConfig.js, never from here.
//
// Same contract components/lot/LotShop.js has with engine/lotShop.js and
// components/concessions/ConcessionsPanel.js has with engine/concessions.js: listOffers()
// returns a presentation-ready list with cost, ownership and affordability already decided,
// and the component renders it without recomputing any of them.
const { CAPS_UPGRADES, CAPS_CURRENCY, getCapsUpgrade } = require('../data/capsShopConfig');
const { canAfford, debitWallet } = require('./wallet');
// From data/, not from engine/modifiers.js: modifiers requires THIS file to fold the shop's
// bonuses in, so importing it back would be a cycle. See the note in data/modifierKeysConfig.js.
const { BONUS_KEYS } = require('../data/modifierKeysConfig');

// Every read of the slice goes through this. A save written before the shop existed has no
// `capsShop` key at all, and this codebase tolerates an absent slice rather than migrating
// (engine/wallBall.js, engine/concessions.js, engine/feed.js all do the same).
function capsShopSlice(state) {
  const slice = (state && state.capsShop) || {};
  return { upgrades: Array.isArray(slice.upgrades) ? slice.upgrades : [] };
}

function ownedCount(state, upgradeId) {
  const entry = capsShopSlice(state).upgrades.find((u) => u.upgradeId === upgradeId);
  return entry ? entry.count : 0;
}

// Cost rises per copy already owned, so the fourth word with the grounds crew is dearer than
// the first. Rounded once, here, so the number the shop prints is exactly the number debited.
function upgradeCost(upgrade, owned) {
  return Math.round(upgrade.cost * upgrade.costGrowth ** owned);
}

// An upgrade naming a bonus key that engine/modifiers.js does not know about would take the
// player's caps and do nothing at all, silently — the exact failure data/acts.js's
// `modifierBonuses` had before they were wired up. Refusing to list it turns a silent
// no-op into a visible absence, which is the one of the two that gets noticed and fixed.
function isSellable(upgrade) {
  return BONUS_KEYS.indexOf(upgrade.bonusKey) !== -1;
}

function sellableUpgrades() {
  return CAPS_UPGRADES.filter(isSellable);
}

// The additive bonuses every owned copy contributes, keyed the way engine/modifiers.js's
// `bonuses` bundle is. computeModifiers() folds this in alongside the act, era, perk and
// powerup layers. Returns a plain object rather than mutating, so it is safe to call from
// anywhere.
function capsShopBonuses(state) {
  return capsShopSlice(state).upgrades.reduce((bonuses, entry) => {
    const upgrade = getCapsUpgrade(entry.upgradeId);
    if (!upgrade || !isSellable(upgrade)) return bonuses;
    const count = Math.max(0, entry.count || 0);
    bonuses[upgrade.bonusKey] = (bonuses[upgrade.bonusKey] || 0) + upgrade.bonus * count;
    return bonuses;
  }, {});
}

// What one more copy is worth, as a percentage, for the shop to print. The bonus is additive
// into a `1 + sum` multiplier, so a 0.15 bonus is always "+15%" regardless of how many are
// already owned — which is the honest way to state it and also the simplest.
function describe(upgrade) {
  return `+${Math.round(upgrade.bonus * 100)}% ${EFFECT_LABELS[upgrade.bonusKey] || upgrade.bonusKey}`;
}

// Player-facing names for the modifier keys. Kept here rather than in the config because they
// describe engine/modifiers.js's vocabulary, not this shop's contents — a second shop selling
// the same keys would want the same words.
const EFFECT_LABELS = {
  gameSpeedMult: 'game pace',
  revenueMult: 'all cash income',
  strengthMult: 'team strength',
  campSpeedMult: 'training camp speed',
  attendanceMult: 'attendance',
  rookieQualityMult: 'rookie quality',
  upgradeCostMult: 'upgrade cost',
};

// Presentation-ready view, in authored order. Like Act III's shop there is no progressive
// reveal: by Act V the player has seen four shops and does not need teaching.
function listOffers(state) {
  return sellableUpgrades().map((upgrade) => {
    const count = ownedCount(state, upgrade.id);
    const maxed = count >= upgrade.maxCount;
    const cost = upgradeCost(upgrade, count);
    return {
      id: upgrade.id,
      name: upgrade.name,
      description: upgrade.description,
      effect: describe(upgrade),
      cost,
      owned: maxed,
      currency: CAPS_CURRENCY,
      affordable: !maxed && canAfford(state.wallet, CAPS_CURRENCY, cost),
      count,
      maxCount: upgrade.maxCount,
      // The total this ladder is currently contributing, so the panel can show what the
      // player has already bought rather than only what is left to buy.
      totalBonus: upgrade.bonus * count,
    };
  });
}

function addUpgrade(slice, upgradeId) {
  const existing = slice.upgrades.find((u) => u.upgradeId === upgradeId);
  const upgrades = existing
    ? slice.upgrades.map((u) => (u.upgradeId === upgradeId ? { ...u, count: u.count + 1 } : u))
    : [...slice.upgrades, { upgradeId, count: 1 }];
  return { ...slice, upgrades };
}

// Returns the new state, or null when the purchase is not permitted (unknown upgrade, an
// upgrade whose bonus key does not exist, already maxed, or unaffordable). Mirrors
// engine/lotShop.js and engine/concessions.js: null means "refused", and no currency may go
// below zero — the debit itself goes through engine/wallet.js regardless.
function purchase(state, upgradeId) {
  const upgrade = getCapsUpgrade(upgradeId);
  if (!upgrade || !isSellable(upgrade)) return null;

  const slice = capsShopSlice(state);
  const count = ownedCount(state, upgradeId);
  if (count >= upgrade.maxCount) return null;

  const cost = upgradeCost(upgrade, count);
  if (!canAfford(state.wallet, CAPS_CURRENCY, cost)) return null;

  return {
    ...state,
    wallet: debitWallet(state.wallet, CAPS_CURRENCY, cost),
    capsShop: addUpgrade(slice, upgradeId),
  };
}

module.exports = { capsShopBonuses, listOffers, purchase, upgradeCost, capsShopSlice };
