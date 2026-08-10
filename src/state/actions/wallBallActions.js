// Act II — wall ball. Pure (state, action) => newState.
//
// This handler re-clamps the stake unconditionally through engine/wallBall.js. The stake
// slider in components/wallBall/ is convenience; the engine is the guarantee. A dispatch
// carrying an oversized or negative stake is clamped here, not trusted.

const { createPlayer } = require('../../engine/playerFactory');
const { creditWallet, debitWallet } = require('../../engine/wallet');
const { resolveChallenge, crewEarnedAtRespect } = require('../../engine/wallBall');
const { checkActTransition } = require('../../engine/progression');
const { CREW_POSITIONS, CREW_VISIBLE_STAT, CREW_QUALITY_MULT } = require('../../data/wallBallConfig');

const HISTORY_LIMIT = 6;

// Crew members are full player entities with one stat surfaced, created through the same
// createPlayer() as everyone else — not a parallel type. See engine/playerFactory.js.
function recruitCrewMember(existingCount) {
  const position = CREW_POSITIONS[existingCount % CREW_POSITIONS.length];
  return createPlayer(position, {
    isStarter: false,
    qualityMult: CREW_QUALITY_MULT,
    ageRange: [9, 12],
    acquiredVia: 'wallBall',
    simplified: true,
    visibleStat: CREW_VISIBLE_STAT[position],
  });
}

function resolveWallBallChallenge(state, action) {
  const result = resolveChallenge(state, {
    approachId: action.approachId,
    stake: action.stake,
    rng: action.rng,
  });
  // Null means the wager was not legal (cooldown, balance below the floor, unknown
  // approach). Rejecting is always safe: no state moves.
  if (!result) return state;

  let next = result.won
    ? creditWallet(state, { caps: result.capsDelta })
    : debitWallet(state, 'caps', result.stake);

  const respect = state.wallBall.respect + result.respectGained;

  // Crew is derived from Respect thresholds, so it can never double-recruit or drift out
  // of sync with the counter that earned it.
  const earned = crewEarnedAtRespect(respect);
  let crew = state.crew;
  const recruits = [];
  while (crew.length + recruits.length < earned) {
    recruits.push(recruitCrewMember(crew.length + recruits.length));
  }
  if (recruits.length > 0) crew = [...crew, ...recruits];

  const entry = {
    id: `${state.wallBall.attempts + 1}`,
    won: result.won,
    stake: result.stake,
    payout: result.payout,
    approachName: result.approachName,
    challengerName: result.challengerName,
    respectGained: result.respectGained,
    recruited: recruits.map((r) => r.name),
  };

  next = {
    ...next,
    crew,
    wallBall: {
      ...state.wallBall,
      wins: state.wallBall.wins + (result.won ? 1 : 0),
      losses: state.wallBall.losses + (result.won ? 0 : 1),
      attempts: state.wallBall.attempts + 1,
      respect,
      nextChallengeAtClock: result.nextChallengeAtClock,
      lastResult: entry,
      history: [entry, ...state.wallBall.history].slice(0, HISTORY_LIMIT),
    },
  };

  // 5 wins AND 3 crew ends the act; resolve on the winning rally rather than on the next
  // tick so the story card lands on the beat that earned it.
  return checkActTransition(next);
}

module.exports = { resolveWallBallChallenge };
