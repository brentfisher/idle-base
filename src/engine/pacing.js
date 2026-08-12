// How long the simulation takes to do things, after `gameSpeedMult` is applied. Pure — no
// React, no DOM.
//
// WHY THIS IS A MODULE AND NOT THREE DIVISIONS AT THE CALL SITES.
//
// `gameSpeedMult` is the only key in engine/modifiers.js that DIVIDES rather than multiplies:
// a 1.5 there means "half again as fast", so the duration it governs is `base / 1.5`. Every
// other key is applied by multiplying, and a single call site that got the direction wrong
// would slow the game down while the shop promised to speed it up — a bug that reads as a
// balance problem rather than as an inverted operator, which is the kind that survives.
// Routing all of it through two named functions means the direction is decided once.
//
// The other reason is that a game slot's length is read in two places that must agree:
// engine/tickEngine.js schedules the next game at `clock + secondsPerGame`, and
// components/field/FieldView.js sizes the on-field replay from the same number. If the
// scheduler speeds up and the replay does not, games start arriving before the previous one
// has finished playing out — the replay would be permanently behind the box score.
const { clamp } = require('../utils/statUtils');

// A season's `secondsPerGame` is FIXED when the season is built, on purpose: engine/tickEngine
// notes that a mid-season act change must not reshape a season in flight. The speed multiplier
// is deliberately different — the player just spent caps on it and expects the very next game
// to come sooner — so it is applied at read time, against whatever the season was built with,
// rather than baked into `season.secondsPerGame`.
//
// Floored at one second: `nextGameAtClock` must always be strictly ahead of `clock` or
// advance() would resolve games in an unbounded loop, and `balanceConfig.safetyCapIterations`
// is a backstop against a runaway, not a design.
const MIN_SECONDS_PER_GAME = 1;

function speedOf(modifiers) {
  const raw = modifiers && modifiers.gameSpeedMult;
  // A caller that resolved modifiers before `gameSpeedMult` existed — or a test bundle built
  // by hand — reads as 1x rather than as a division by undefined.
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

// The wait between one game and the next, and the length the replay is sized against.
function effectiveSecondsPerGame(baseSeconds, modifiers) {
  const base = typeof baseSeconds === 'number' && Number.isFinite(baseSeconds) ? baseSeconds : 0;
  return Math.max(MIN_SECONDS_PER_GAME, base / speedOf(modifiers));
}

// The gap between playoff rounds. Same multiplier: "in between" is exactly what the player
// asked to shorten, and a postseason that still crawls after the regular season was sped up
// would be the most conspicuous place the purchase failed to apply.
function effectiveSecondsPerPlayoffRound(baseSeconds, modifiers) {
  const base = typeof baseSeconds === 'number' && Number.isFinite(baseSeconds) ? baseSeconds : 0;
  return Math.max(MIN_SECONDS_PER_GAME, base / speedOf(modifiers));
}

// The on-field replay, in milliseconds, sized to finish inside the game slot it narrates.
// FieldView used to compute this itself as `Math.max(6000, (secondsPerGame - 6) * 1000)`; the
// 6-second headroom and the 6-second floor are preserved exactly, so an unmodified game plays
// identically. What changes is that a sped-up slot shortens the replay with it — and the floor
// is clamped so it can never exceed the slot, which at high speed it otherwise would.
const REPLAY_HEADROOM_SECONDS = 6;
const REPLAY_MIN_MS = 6000;

function replayDurationMs(baseSecondsPerGame, modifiers) {
  const slot = effectiveSecondsPerGame(baseSecondsPerGame, modifiers);
  const withHeadroom = (slot - REPLAY_HEADROOM_SECONDS) * 1000;
  // At 1x and the game's shortest slot (Act III's 25s) this is 19s, well above the floor. At
  // the pace ladder's maximum the floor is what binds, so it is clamped to the slot itself
  // rather than allowed to overrun it.
  return clamp(withHeadroom, Math.min(REPLAY_MIN_MS, slot * 1000), slot * 1000);
}

module.exports = {
  effectiveSecondsPerGame,
  effectiveSecondsPerPlayoffRound,
  replayDurationMs,
  MIN_SECONDS_PER_GAME,
};
