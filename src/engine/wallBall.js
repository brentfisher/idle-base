// Act II — Off the Wall. Pure engine: no React, no DOM.
//
// ============================ HARD PROJECT INVARIANT =================================
// (design.md Decision 6 / PRD §6.4 — this is a structural property, not a balance target.)
//
//   1. No mechanic may reduce a currency below zero. Every wager settles through
//      engine/wallet.js, which floors at 0; clampStake() additionally refuses to build a
//      losable stake that could reach the floor in the first place.
//   2. No mechanic may remove the Hustle (manual click) action. It exists in every act,
//      is never disabled, and its yield floor is above zero — so any state is recoverable
//      in bounded time.
//   3. Every loss is capped as a *percentage of current holdings* (STAKE_FRACTION_CAP),
//      so absolute losses shrink toward zero as the balance does and can never cross it.
//
// The enforcement point is clampStake(), here in the engine — never the stake slider. The
// action handler re-clamps unconditionally, so a hand-crafted oversized dispatch is
// clamped rather than trusted.
// =====================================================================================
//
// A challenge is a resolved strength check, not a twitch mini-game. It reuses the Elo-style
// winProbability() from engine/gameSim.js with kit quality as the player's strength, so
// there is exactly one probability model in the game.

const { winProbability } = require('./gameSim');
const { getKitItem } = require('../data/kitConfig');
const { clamp } = require('../utils/statUtils');
const {
  APPROACHES,
  getChallenger,
  STRENGTH_GAP_BAND,
  CREW_STRENGTH_PER_MEMBER,
  LOSS_COOLDOWN_PENALTY_SECONDS,
  STAKE_FRACTION_CAP,
  MIN_STAKE,
  MIN_CAPS_TO_CHALLENGE,
  CREW_RESPECT_THRESHOLDS,
} = require('../data/wallBallConfig');

function getApproach(approachId) {
  return APPROACHES.find((a) => a.id === approachId) || null;
}

// The player's strength: everything in the kit, plus a little from the crew.
function kitQuality(state) {
  const fromKit = state.kit.ownedItemIds.reduce((sum, id) => {
    const item = getKitItem(id);
    return item ? sum + item.strength : sum;
  }, 0);
  return fromKit + state.crew.length * CREW_STRENGTH_PER_MEMBER;
}

// Challengers step up as you beat them, so the act has an arc rather than one repeated
// coin flip.
function currentChallenger(state) {
  return getChallenger(state.wallBall ? state.wallBall.wins : 0);
}

// The gap is banded before it reaches winProbability(). Un-banded, an un-geared player
// facing a late challenger would see Showboat lose ~70% of the time and a fully geared
// player facing an early one would see it lose ~10% — the approach's advertised risk
// profile would be a property of shopping, not of the approach.
function effectiveGap(state, approach) {
  const raw = kitQuality(state) - currentChallenger(state).strength;
  return clamp(raw, STRENGTH_GAP_BAND[0], STRENGTH_GAP_BAND[1]) + approach.strengthDelta;
}

function approachWinProbability(state, approachId) {
  const approach = getApproach(approachId);
  if (!approach) return 0;
  return winProbability(effectiveGap(state, approach), 0);
}

// --- Bounded wagering -----------------------------------------------------------------

// The largest stake the rules permit right now. Two independent ceilings:
//   * 25% of current caps (the percentage-of-holdings rule), and
//   * whatever leaves at least one Hustle click's worth of caps standing after a total
//     loss. Under a 25% cap this second ceiling is never the binding one, which is the
//     point — it is a guard rail behind a guard rail, not a balance knob.
function maxStake(state) {
  const caps = Math.floor(state.wallet.caps);
  const hustleFloor = Math.max(1, Math.ceil(state.clicker.perClick));
  const byFraction = Math.floor(caps * STAKE_FRACTION_CAP);
  const byFloor = caps - hustleFloor;
  return Math.max(0, Math.min(byFraction, byFloor));
}

function canChallenge(state) {
  if (!state.wallBall) return false;
  if (state.wallet.caps < MIN_CAPS_TO_CHALLENGE) return false;
  if (state.clock < state.wallBall.nextChallengeAtClock) return false;
  return maxStake(state) >= MIN_STAKE;
}

// Always call this on the way in. Returns 0 when no legal stake exists.
function clampStake(state, requested) {
  const ceiling = maxStake(state);
  if (ceiling < MIN_STAKE) return 0;
  const asInt = Math.floor(Number(requested) || 0);
  return clamp(asInt, MIN_STAKE, ceiling);
}

function cooldownRemaining(state) {
  if (!state.wallBall) return 0;
  return Math.max(0, state.wallBall.nextChallengeAtClock - state.clock);
}

// --- Resolution -----------------------------------------------------------------------

// Pure: returns a result description, never a new state. state/actions/wallBallActions.js
// applies it. `rng` is injectable so the invariant can be exercised against a generator
// that always loses.
function resolveChallenge(state, options = {}) {
  const approach = getApproach(options.approachId);
  if (!approach) return null;
  if (!canChallenge(state)) return null;

  const stake = clampStake(state, options.stake);
  if (stake < MIN_STAKE) return null;

  const rng = options.rng || Math.random;
  const challenger = currentChallenger(state);
  const probability = approachWinProbability(state, approach.id);
  const won = rng() < probability;

  const payout = won ? Math.round(stake * approach.payoutMult) : 0;
  // A loss costs the stake and nothing more. The sting is time, not a deeper debt:
  // deepening the cap loss is precisely what the invariant above forbids.
  const capsDelta = won ? payout : -stake;
  const respectGained = won ? approach.respectOnWin : 0;
  const cooldown = approach.cooldownSeconds + (won ? 0 : LOSS_COOLDOWN_PENALTY_SECONDS);

  return {
    won,
    stake,
    payout,
    capsDelta,
    respectGained,
    probability,
    approachId: approach.id,
    approachName: approach.name,
    challengerId: challenger.id,
    challengerName: challenger.name,
    cooldownSeconds: cooldown,
    nextChallengeAtClock: state.clock + cooldown,
  };
}

// How many crew members the given Respect total has earned, in total (not incrementally).
function crewEarnedAtRespect(respect) {
  return CREW_RESPECT_THRESHOLDS.filter((threshold) => respect >= threshold).length;
}

function nextCrewThreshold(state) {
  const respect = state.wallBall ? state.wallBall.respect : 0;
  return CREW_RESPECT_THRESHOLDS.find((threshold) => respect < threshold) || null;
}

module.exports = {
  getApproach,
  kitQuality,
  currentChallenger,
  effectiveGap,
  approachWinProbability,
  maxStake,
  clampStake,
  canChallenge,
  cooldownRemaining,
  resolveChallenge,
  crewEarnedAtRespect,
  nextCrewThreshold,
  MIN_STAKE,
  MIN_CAPS_TO_CHALLENGE,
  STAKE_FRACTION_CAP,
};
