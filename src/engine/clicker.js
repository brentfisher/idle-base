// The manual income action. Pure — no React, no DOM.
//
// This action exists in every act and is never removed: it is Act I's entire game, and from
// Act II onward it persists as Hustle, a manual action whose absolute value scales per act
// while its relative value declines. Because its yield has a floor above zero, any state is
// recoverable in bounded time — the anti-softlock guarantee of PRD §6.4 and design Decision 6.
//
// THE COOLDOWN IS A RATE LIMIT, NOT A GATE, and the difference is the invariant. A gate asks
// the player to satisfy a condition they may be unable to satisfy; a rate limit asks them to
// wait a fixed, small, always-elapsing number of seconds. Recovery stays bounded — it is
// merely bounded by a larger number. Three properties keep it that way, all structural rather
// than tuning, and all of them live in clickCooldownRemaining() below:
//   1. The wait is CLAMPED to the current act's own clickCooldownSeconds. Whatever
//      nextClickAtClock says — a corrupt save, a hand-edited localStorage, a value written by
//      an act with a longer cooldown that the player has since left — the player can never be
//      asked to wait longer than the act in front of them declares.
//   2. An act with no clickCooldownSeconds clamps to zero, so Acts I, II and VII are untimed
//      no matter what is in the save. Act I's whole game is the click; Act II's broke player is
//      clicking back up to a minimum wager; Act VII's is a player who would rather press forty
//      times than wait two minutes for the same Drone (data/acts.js argues that one at length).
//   3. An absent nextClickAtClock (every save written before this existed) reads as 0, which
//      is in the past, which is ready. `undefined` must never read as a lockout.
// applyClick() refuses rather than throws when the click is not ready — same contract as
// engine/wallBall.js resolveChallenge() — so a double-dispatch cannot double-credit either.
const { getActConfig } = require('../data/acts');
const { creditWallet } = require('./wallet');

function actClickRules(state) {
  const act = getActConfig(state.progression ? state.progression.act : 0);
  return act.rules || {};
}

// Every read of the clicker slice goes through this, for the same reason wallBallSlice() exists
// in engine/wallBall.js: saves are never migrated, so a save written before a field existed has
// to load and behave sanely rather than be repaired. nextClickAtClock is the field that matters
// here — absent must mean "ready now".
function clickerSlice(state) {
  const slice = (state && state.clicker) || {};
  return {
    totalClicks: slice.totalClicks || 0,
    perClick: slice.perClick || 1,
    nextClickAtClock: slice.nextClickAtClock || 0,
  };
}

function clickCurrency(state) {
  return actClickRules(state).clickCurrency || 'caps';
}

function clickLabel(state) {
  return actClickRules(state).clickLabel || 'Search the lot';
}

// Act I is exactly clicker.perClick (multiplier 1), so the authored 25-clicks-to-first-
// collector pacing holds without adjustment.
//
// `clickFlatValue` REPLACES the whole calculation rather than scaling it, and PRD §5.2 argues the
// case at length. `perClick` spans 2 to 77 across the eight concessions rungs (the ceiling is
// recorded in data/acts.js), so at any multiplier the press is a 38x spread between two players
// who reached the same act. Act VI tolerates that because caps are a side currency there. Act VII
// cannot: it opens the way Act I opens — one button, one screen, nothing else — and for the first
// two minutes the click is 100% of the act's income. The gap between "two minutes to your first
// Drone" and "three seconds" is the gap between an opening and a cutscene.
//
// An absent key is today's behaviour EXACTLY, which is what keeps Acts I-VI untouched: the early
// return does not fire, and `perClick` is neither read nor written on that path. The guard is a
// strict typeof rather than a Number() coercion, matching clickCooldownSeconds() below and
// clampStake() in engine/wallBall.js — one rule for reading a config number, not three.
//
// `clicker.perClick` stays in state and would still apply if a later era wanted it back. The click
// itself never improves in Act VII; every improvement in that act is a module instead.
function clickValue(state) {
  const flat = actClickRules(state).clickFlatValue;
  if (typeof flat === 'number' && Number.isFinite(flat) && flat > 0) return flat;
  const multiplier = actClickRules(state).clickMultiplier;
  const scale = typeof multiplier === 'number' ? multiplier : 1;
  return Math.max(1, clickerSlice(state).perClick * scale);
}

// Seconds this act throttles the click by. Anything that is not a usable positive number — an
// absent key, a string, a NaN, a negative from a hand-edited config — is zero, i.e. no
// cooldown. Strict `typeof` rather than Number() coercion, matching clampStake() in
// engine/wallBall.js: one rule, not two.
function clickCooldownSeconds(state) {
  const seconds = actClickRules(state).clickCooldownSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds;
}

// Mirrors cooldownRemaining() in engine/wallBall.js, with the clamp that makes the wait
// bounded by the act rather than by whatever is in the save. See properties 1-3 in the header.
function clickCooldownRemaining(state) {
  const seconds = clickCooldownSeconds(state);
  if (seconds === 0) return 0;
  const elapsedTarget = clickerSlice(state).nextClickAtClock - ((state && state.clock) || 0);
  return Math.max(0, Math.min(seconds, elapsedTarget));
}

function canClick(state) {
  return clickCooldownRemaining(state) === 0;
}

// 0 -> 1 refill, for the button's progress fill. The divide is guarded rather than merely
// avoided in practice: an uncooled act must answer 1 (ready), never NaN, or the fill silently
// becomes an invalid transform and the button looks broken in exactly the act — Act I — where
// it is the entire game.
function clickCooldownProgress(state) {
  const seconds = clickCooldownSeconds(state);
  if (seconds === 0) return 1;
  return 1 - clickCooldownRemaining(state) / seconds;
}

// Returns the state unchanged when the click is not ready, rather than throwing or crediting a
// smaller amount. The UI disables the button, but this is what actually holds the rate limit:
// a queued dispatch, a replayed action or a second tab cannot beat it.
function applyClick(state) {
  if (clickCooldownRemaining(state) > 0) return state;

  const slice = clickerSlice(state);
  const seconds = clickCooldownSeconds(state);
  const currency = clickCurrency(state);
  const value = clickValue(state);
  return {
    ...state,
    wallet: creditWallet(state.wallet, currency, value),
    clicker: {
      ...state.clicker,
      totalClicks: slice.totalClicks + 1,
      // Left exactly as found in an act that declares no cooldown, which is the contract
      // state/initialState.js states beside the field. Writing `clock + 0` there would be
      // equivalent in behaviour and a lie in the save file: Acts I and II do not have a
      // cooldown that happens to be zero, they have no cooldown.
      nextClickAtClock: seconds > 0 ? ((state && state.clock) || 0) + seconds : slice.nextClickAtClock,
    },
  };
}

module.exports = {
  clickCurrency,
  clickLabel,
  clickValue,
  clickCooldownSeconds,
  clickCooldownRemaining,
  clickCooldownProgress,
  canClick,
  applyClick,
};
