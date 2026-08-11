// Act II — Off the Wall. A wall-ball challenge is a STAKED STRENGTH CHECK, not a twitch
// mini-game: the player stakes caps, picks an approach, and the rally resolves at once.
//
// BOUNDED-LOSS INVARIANT (PRD §6.4, design Decision 6, conventions.md "Hard Invariants").
// Three properties, all of them structural rather than tuning:
//   1. A stake is capped at STAKE_MAX_FRACTION of CURRENT caps — a percentage of holdings,
//      never a flat amount — so absolute losses shrink toward zero as the balance does.
//      clampStake() is the only way a stake is computed and the reducer re-clamps whatever
//      the UI sent, unconditionally. The stake slider is convenience, never the guarantee.
//   2. No currency goes below zero: every wallet write here is engine/wallet.js, and Respect
//      only ever increases.
//   3. The Hustle click (engine/clicker.js) is untouched by anything in this file. It is what
//      makes a broke player's position recoverable in bounded time, so under MIN_STAKE caps
//      the challenge is simply unavailable rather than free — a free challenge would be an
//      unbounded Respect faucet, and the Hustle button is right there.
//
// Pure — no React, no DOM. Every number comes from data/wallBallConfig.js. `rng` is a
// parameter, defaulted, so the invariants above can be driven headlessly with an
// always-lose generator.
const balanceConfig = require('../data/balanceConfig');
const { winProbability } = require('./gameSim');
const { creditWallet, debitWallet, balanceOf } = require('./wallet');
const { createPlayer } = require('./playerFactory');
const { clamp } = require('../utils/statUtils');
const {
  KIT_BASE_STRENGTH,
  KIT_ITEM_STRENGTH,
  CREW_STRENGTH_PER_MEMBER,
  GAP_BAND,
  MIN_WIN_PROBABILITY,
  MAX_WIN_PROBABILITY,
  APPROACHES,
  DEFAULT_APPROACH_ID,
  CHALLENGERS,
  STAKE_MAX_FRACTION,
  MIN_STAKE,
  CHALLENGE_COOLDOWN_SECONDS,
  RESPECT_THRESHOLDS,
  RESPECT_CAPS_BONUS_PER_POINT,
  CREW_QUALITY_MULT,
  CREW_AGE_RANGE,
  CREW_POSITIONS,
  CREW_SIGNATURE_STATS,
  CREW_DEFAULT_SIGNATURE_STAT,
  EXIT_WINS_REQUIRED,
  EXIT_CREW_REQUIRED,
} = require('../data/wallBallConfig');
const { STARTER_KIT_ITEMS } = require('../data/actOneConfig');

// Every read of the two Act II slices goes through these. A save written before Act II
// existed has neither, and this codebase tolerates an absent slice rather than migrating
// (engine/feed.js, engine/progression.js do the same).
function wallBallSlice(state) {
  const slice = (state && state.wallBall) || {};
  return {
    wins: slice.wins || 0,
    losses: slice.losses || 0,
    respect: Math.max(0, slice.respect || 0),
    challengerId: slice.challengerId || CHALLENGERS[0].id,
    nextChallengeAtClock: slice.nextChallengeAtClock || 0,
    lastResult: slice.lastResult || null,
  };
}

function crewList(state) {
  return (state && state.crew) || [];
}

// Kit quality IS the player's strength in the check — derived from what Act I actually
// bought (state.lot.starterKit) rather than stored, so it cannot drift from the inventory
// that produced it. The crew adds a little on top: they are shagging your foul balls.
function kitQuality(state) {
  const owned = (state && state.lot && state.lot.starterKit) || [];
  const kitItems = owned.filter((id) => STARTER_KIT_ITEMS.some((item) => item.id === id)).length;
  return KIT_BASE_STRENGTH + kitItems * KIT_ITEM_STRENGTH + crewList(state).length * CREW_STRENGTH_PER_MEMBER;
}

function getApproach(approachId) {
  return APPROACHES.find((a) => a.id === approachId) || APPROACHES.find((a) => a.id === DEFAULT_APPROACH_ID);
}

function getChallenger(challengerId) {
  return CHALLENGERS.find((c) => c.id === challengerId) || CHALLENGERS[0];
}

// The ONE probability model in the game (engine/gameSim.js), fed a banded gap.
//
// Banding is what makes the approach mean something stable. eloK is 15, so an un-banded
// player-vs-challenger gap of ±9 (the actual spread of kit and challengers) would move
// Showboat between roughly a 10% and a 70% loss — the same button being nearly free for a
// geared player and nearly a coin-flip against for an ungeared one. Clamped to ±GAP_BAND,
// Showboat stays a 30-41% loss everywhere while gear still visibly helps.
function challengeWinProbability(state, approachId, challengerId) {
  const approach = getApproach(approachId);
  const challenger = getChallenger(challengerId);
  const rawGap = kitQuality(state) - challenger.strength;
  const bandedGap = clamp(rawGap, -GAP_BAND, GAP_BAND);
  const effectiveGap = bandedGap + approach.strengthDelta;
  const p = winProbability(effectiveGap, 0, balanceConfig.eloK);
  return clamp(p, MIN_WIN_PROBABILITY, MAX_WIN_PROBABILITY);
}

// The bounded-loss cap: a percentage of what is in the wallet right now.
function maxStakeFor(caps) {
  const balance = typeof caps === 'number' && Number.isFinite(caps) ? Math.max(0, caps) : 0;
  return Math.floor(balance * STAKE_MAX_FRACTION);
}

// The only place a stake is decided. Anything that is not a usable number becomes 0 — a
// string, a NaN, an Infinity, a negative. Strict `typeof` rather than Number() coercion, so
// the contract is one rule (the string '1e9' is not a number, and is refused) instead of two.
function clampStake(caps, requested) {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), maxStakeFor(caps)));
}

function maxStake(state) {
  return maxStakeFor(balanceOf(state.wallet, 'caps'));
}

function cooldownRemaining(state) {
  const { nextChallengeAtClock } = wallBallSlice(state);
  return Math.max(0, nextChallengeAtClock - (state.clock || 0));
}

// Crew size is COUNTED from Respect, never incremented. Recruitment is therefore idempotent:
// resolving the same challenge twice, or reloading a save, can never hand out a fourth crew
// member for the same Respect.
function crewSizeForRespect(respect) {
  return RESPECT_THRESHOLDS.filter((threshold) => respect >= threshold).length;
}

function nextCrewThreshold(respect) {
  return RESPECT_THRESHOLDS.find((threshold) => respect < threshold) || null;
}

// Progress toward the NEXT crew member, measured inside the current band so it runs 0 -> 1 and
// then starts again from zero. The panel used to print cumulative wins against the exit's
// requirement ("7/5"), which read as a broken progress bar: the exit's win half is satisfied
// long before the crew half, and cumulative respect against a rising threshold never resets.
// What the player is actually working toward, at every moment, is one more kid.
function crewProgress(respect) {
  const size = crewSizeForRespect(respect);
  const next = nextCrewThreshold(respect);
  if (next === null) return { done: true, from: 0, to: 0, have: 0, need: 0, fraction: 1, crewSize: size };
  const from = size === 0 ? 0 : RESPECT_THRESHOLDS[size - 1];
  return {
    done: false,
    from,
    to: next,
    have: Math.max(0, respect - from),
    need: next - from,
    fraction: Math.min(1, Math.max(0, (respect - from) / (next - from))),
    crewSize: size,
  };
}

function crewSignatureStat(position) {
  return CREW_SIGNATURE_STATS[position] || CREW_DEFAULT_SIGNATURE_STAT;
}

// A full player entity, just a simplified one — see playerFactory.js. Bench-flagged so that
// if Act III promotes them they cannot silently join the starting nine.
function createCrewMember(rng) {
  const position = CREW_POSITIONS[Math.floor(rng() * CREW_POSITIONS.length) % CREW_POSITIONS.length];
  return createPlayer(position, {
    isStarter: false,
    qualityMult: CREW_QUALITY_MULT,
    ageRange: CREW_AGE_RANGE,
    seasonsPlayed: 0,
    acquiredVia: 'wallBall',
    simplified: true,
    signatureStat: crewSignatureStat(position),
  });
}

// Brings state.crew up to the size Respect says it should be. Never removes anyone: Respect
// does not fall, and a crew member who has already turned up does not un-turn-up.
function syncCrew(state, respect, rng) {
  const crew = crewList(state);
  const target = crewSizeForRespect(respect);
  if (crew.length >= target) return crew;
  const recruits = [];
  for (let i = crew.length; i < target; i += 1) recruits.push(createCrewMember(rng));
  return [...crew, ...recruits];
}

// Someone else steps up to the wall after every rally.
function nextChallengerId(currentId, rng) {
  const others = CHALLENGERS.filter((c) => c.id !== currentId);
  const pool = others.length > 0 ? others : CHALLENGERS;
  return pool[Math.floor(rng() * pool.length) % pool.length].id;
}

function canChallenge(state) {
  return maxStake(state) >= MIN_STAKE && cooldownRemaining(state) === 0;
}

// Resolves one challenge and returns the new state; returns the state unchanged when the
// challenge is not currently permitted (cooling down, or nothing wagerable). The caller
// supplies neither the odds nor the stake ceiling — both are decided here.
function resolveChallenge(state, options = {}, rng = Math.random) {
  const slice = wallBallSlice(state);
  if (cooldownRemaining(state) > 0) return state;

  // Re-clamped unconditionally, whatever the caller asked for. This line is the invariant.
  const stake = clampStake(balanceOf(state.wallet, 'caps'), options.stake);
  if (stake < MIN_STAKE) return state;

  const approach = getApproach(options.approachId);
  const challenger = getChallenger(slice.challengerId);
  const p = challengeWinProbability(state, approach.id, challenger.id);
  const won = rng() < p;

  let wallet = debitWallet(state.wallet, 'caps', stake);
  const payout = won ? Math.floor(stake * approach.payoutMult) : 0;
  if (payout > 0) wallet = creditWallet(wallet, 'caps', payout);

  const respect = Math.max(0, slice.respect + (won ? approach.respect : 0));
  const crew = syncCrew(state, respect, rng);
  const recruited = crew.length - crewList(state).length;

  return {
    ...state,
    wallet,
    crew,
    wallBall: {
      wins: slice.wins + (won ? 1 : 0),
      losses: slice.losses + (won ? 0 : 1),
      respect,
      challengerId: nextChallengerId(challenger.id, rng),
      nextChallengeAtClock: (state.clock || 0) + CHALLENGE_COOLDOWN_SECONDS,
      lastResult: {
        won,
        stake,
        // Net caps swing, so the panel never has to re-derive it from the payout multiplier.
        delta: payout - stake,
        approachId: approach.id,
        challengerId: challenger.id,
        challengerName: challenger.name,
        respectGained: won ? approach.respect : 0,
        recruited,
      },
    },
  };
}

// Act II's exit, registered under `crewAssembled` in engine/progression.js. Reads what the
// player can see — the wins counter and the crew that actually turned up.
function isCrewAssembled(state) {
  return wallBallSlice(state).wins >= EXIT_WINS_REQUIRED && crewList(state).length >= EXIT_CREW_REQUIRED;
}

// Presentation-ready view of the wall. The panel renders this and decides nothing about
// odds, stake ceilings or availability itself (the same contract as engine/lotShop.js).
function challengeView(state, approachId) {
  const slice = wallBallSlice(state);
  const ceiling = maxStake(state);
  const challenger = getChallenger(slice.challengerId);

  return {
    challenger,
    maxStake: ceiling,
    minStake: MIN_STAKE,
    canWager: ceiling >= MIN_STAKE,
    cooldownRemaining: cooldownRemaining(state),
    wins: slice.wins,
    losses: slice.losses,
    respect: slice.respect,
    crewSize: crewList(state).length,
    nextCrewAt: nextCrewThreshold(slice.respect),
    crewProgress: crewProgress(slice.respect),
    // Whether the act can be left right now, as a single answer rather than two counters the
    // player has to combine in their head.
    canAdvance: isCrewAssembled(state),
    capsMultiplier: 1 + Math.max(0, slice.respect) * RESPECT_CAPS_BONUS_PER_POINT,
    lastResult: slice.lastResult,
    winsRequired: EXIT_WINS_REQUIRED,
    crewRequired: EXIT_CREW_REQUIRED,
    approaches: APPROACHES.map((approach) => ({
      id: approach.id,
      name: approach.name,
      description: approach.description,
      selected: approach.id === approachId,
      lossChance: 1 - challengeWinProbability(state, approach.id, challenger.id),
      payoutMult: approach.payoutMult,
      respect: approach.respect,
    })),
  };
}

module.exports = {
  kitQuality,
  getApproach,
  getChallenger,
  challengeWinProbability,
  clampStake,
  maxStakeFor,
  maxStake,
  cooldownRemaining,
  canChallenge,
  crewSizeForRespect,
  crewProgress,
  createCrewMember,
  resolveChallenge,
  isCrewAssembled,
  challengeView,
};
