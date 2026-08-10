const { createPlayer } = require('./playerFactory');
const { playerOverall } = require('./strength');
const { shuffle } = require('../utils/randomUtils');

// 3 candidates, each an upgrade offer for a distinct current starter position.
function generateTradeCandidates(state, modifiers) {
  const starterPositions = shuffle([...new Set(state.roster.filter((p) => p.isStarter).map((p) => p.position))]).slice(
    0,
    3
  );

  return starterPositions.map((position) => {
    const candidate = createPlayer(position, {
      qualityMult: 1.15,
      ageRange: [24, 30],
      // Resolved: eras 3-4 shorten careers, and a traded player must age out on the same
      // schedule as a drafted one (engine/retirement.js already uses the resolved range).
      retireAtSeasonsRange: modifiers.rules.retireAtSeasonsRange,
      acquiredVia: 'trade',
    });
    const overall = playerOverall(candidate);
    const cost = Math.round((600 + overall * 35) * modifiers.upgradeCostMult);
    return { ...candidate, cost, targetPosition: position };
  });
}

// Candidate replaces the current starter at its target position; the incumbent leaves the roster.
function executeTrade(roster, candidate) {
  const { cost, targetPosition, ...player } = candidate;
  const idx = roster.findIndex((p) => p.isStarter && p.position === targetPosition);
  if (idx === -1) return roster;
  const next = roster.slice();
  next[idx] = player;
  return next;
}

module.exports = { generateTradeCandidates, executeTrade };
