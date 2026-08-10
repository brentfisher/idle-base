// The manual income action. Pure — no React, no DOM.
//
// This action exists in every act and is never removed or disabled: it is Act I's entire
// game, and from Act II onward it persists as Hustle, a manual action whose absolute value
// scales per act while its relative value declines. Because its yield has a floor above
// zero, any state is recoverable in bounded time — the anti-softlock guarantee of PRD §6.4
// and design Decision 6. Nothing here may ever gate it off.
const { getActConfig } = require('../data/acts');
const { creditWallet } = require('./wallet');

function actClickRules(state) {
  const act = getActConfig(state.progression ? state.progression.act : 0);
  return act.rules || {};
}

function clickCurrency(state) {
  return actClickRules(state).clickCurrency || 'caps';
}

function clickLabel(state) {
  return actClickRules(state).clickLabel || 'Search the lot';
}

// Act I is exactly clicker.perClick (multiplier 1), so the authored 25-clicks-to-first-
// collector pacing holds without adjustment.
function clickValue(state) {
  const multiplier = actClickRules(state).clickMultiplier;
  const scale = typeof multiplier === 'number' ? multiplier : 1;
  return Math.max(1, state.clicker.perClick * scale);
}

function applyClick(state) {
  const currency = clickCurrency(state);
  const value = clickValue(state);
  return {
    ...state,
    wallet: creditWallet(state.wallet, currency, value),
    clicker: { ...state.clicker, totalClicks: state.clicker.totalClicks + 1 },
  };
}

module.exports = { clickCurrency, clickLabel, clickValue, applyClick };
