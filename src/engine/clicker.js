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
  return chargedValue(state, baseClickValue(state));
}

// The press at FULL value, before any charge is applied.
function baseClickValue(state) {
  const flat = actClickRules(state).clickFlatValue;
  if (typeof flat === 'number' && Number.isFinite(flat) && flat > 0) return flat;
  const multiplier = actClickRules(state).clickMultiplier;
  const scale = typeof multiplier === 'number' ? multiplier : 1;
  return Math.max(1, clickerSlice(state).perClick * scale);
}

// What the press is worth RIGHT NOW under a charging act: the base times the fraction of the window
// that has elapsed. An identity on every act that does not charge, which is all six before Act VII.
//
// THE CLOCK IS THE GRANULARITY, AND THAT IS DELIBERATE RATHER THAN A LIMITATION. `state.clock`
// advances once a second, in advance(), so two presses inside the same tick see the same clock and
// the second is worth nothing. No second clock is introduced to make it finer — engine/tickEngine.js
// is the only clock in the game, and a Date.now() here would be a second one to keep in sync.
// The consequence is the one the design wants: the yield is capped at base-per-window however fast
// the button is hit, so a player pressing ten times a second earns exactly what a player pressing
// once every three seconds earns, and neither is punished for their habit.
//
// Rounded to two decimals so the wallet does not accumulate float dust across thousands of presses.
// It rounds DOWN, because a rounding rule that pays a fraction of a unit more than it should is a
// faucet, and this is the one faucet the act's whole economy is priced against.
function chargedValue(state, base) {
  const window = clickChargeSeconds(state);
  if (window === 0) return base;
  return Math.floor(base * clickCooldownProgress(state) * 100) / 100;
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

// THE CHARGE WINDOW — the third thing an act can do with the press, and the one Act VII does.
//
// A COOLDOWN SAYS NO AND A CHARGE SAYS NOT YET ALL OF IT. Under `clickCooldownSeconds` the button
// is disabled until the wait elapses and then pays in full. Under `clickChargeSeconds` the button
// is NEVER disabled and pays the fraction of the window that has actually elapsed: press at once
// and take a third, wait the whole window and take all of it. The two are mutually exclusive by
// construction — an act declaring both would be declaring that the press is both refused and
// partially allowed, so the charge wins and clickCooldownSeconds() is not consulted (see
// clickWindowSeconds below).
//
// WHY THE MIDDLE THING EXISTS. A hard cooldown told a player who wanted to keep pressing that the
// game was not interested; removing it outright made pressing strictly better than waiting, without
// bound, and quietly deleted the pacing every module price in Act VII was tuned against. A linear
// charge is the one arrangement where NEITHER habit is punished: the yield per second is identical
// whether the player presses once every three seconds or ten times a second, so waiting stays worth
// it and clicking stays allowed. The floor the act was balanced on comes back with it.
function clickChargeSeconds(state) {
  const seconds = actClickRules(state).clickChargeSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds;
}

// The window the fill bar and the countdown are measured against, whichever kind this act declares.
// Charge first: an act with both is a config mistake, and the safe reading of it is the one that
// never disables the button.
function clickWindowSeconds(state) {
  return clickChargeSeconds(state) || clickCooldownSeconds(state);
}

// Mirrors cooldownRemaining() in engine/wallBall.js, with the clamp that makes the wait
// bounded by the act rather than by whatever is in the save. See properties 1-3 in the header.
//
// Measured against clickWindowSeconds(), so a charge act reports how much of its window is left to
// fill. That number is not a WAIT there — nothing is being refused — which is why canClick() below
// stops consulting it once an act charges rather than cools.
function clickCooldownRemaining(state) {
  const seconds = clickWindowSeconds(state);
  if (seconds === 0) return 0;
  const elapsedTarget = clickerSlice(state).nextClickAtClock - ((state && state.clock) || 0);
  return Math.max(0, Math.min(seconds, elapsedTarget));
}

// A charging act ALWAYS answers yes. That is the whole difference, and it is what keeps the
// anti-softlock guarantee (PRD §6.4, design Decision 6) trivially intact: the press is never
// removed and never disabled, and its yield reaches full value in a fixed, small, always-elapsing
// number of seconds. A player who presses at the wrong moment is not blocked, merely early.
function canClick(state) {
  if (clickChargeSeconds(state) > 0) return true;
  return clickCooldownRemaining(state) === 0;
}

// 0 -> 1 refill, for the button's progress fill. The divide is guarded rather than merely
// avoided in practice: an uncooled act must answer 1 (ready), never NaN, or the fill silently
// becomes an invalid transform and the button looks broken in exactly the act — Act I — where
// it is the entire game.
function clickCooldownProgress(state) {
  const seconds = clickWindowSeconds(state);
  if (seconds === 0) return 1;
  return 1 - clickCooldownRemaining(state) / seconds;
}

// Returns the state unchanged when the click is not ready, rather than throwing or crediting a
// smaller amount. The UI disables the button, but this is what actually holds the rate limit:
// a queued dispatch, a replayed action or a second tab cannot beat it.
function applyClick(state) {
  if (!canClick(state)) return state;

  const slice = clickerSlice(state);
  const seconds = clickWindowSeconds(state);
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
      // The window restarts on every press under BOTH kinds of act, and under a charge that is what
      // spends the charge: taking a third of the window's worth resets it to empty, so the value is
      // never banked twice.
      nextClickAtClock: seconds > 0 ? ((state && state.clock) || 0) + seconds : slice.nextClickAtClock,
    },
  };
}

module.exports = {
  clickCurrency,
  clickLabel,
  clickValue,
  baseClickValue,
  clickChargeSeconds,
  clickWindowSeconds,
  clickCooldownSeconds,
  clickCooldownRemaining,
  clickCooldownProgress,
  canClick,
  applyClick,
};
