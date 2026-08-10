const { FIRST_NAMES, LAST_NAMES } = require('../data/playerNames');
const { STARTER_POSITIONS, BENCH_SLOTS } = require('../data/positions');
const { clamp } = require('../utils/statUtils');
const { generateId, randInt, pick, jitter } = require('../utils/randomUtils');

function randomStatsForPosition(position, qualityMult) {
  const talent = randInt(35, 65) * qualityMult;
  const isPitcher = position === 'P';
  return {
    power: clamp(Math.round(talent + jitter(20) - (isPitcher ? 15 : 0)), 5, 100),
    contact: clamp(Math.round(talent + jitter(20) - (isPitcher ? 15 : 0)), 5, 100),
    speed: clamp(Math.round(talent + jitter(20) - (isPitcher ? 10 : 0)), 5, 100),
    defense: clamp(Math.round(talent + jitter(20)), 5, 100),
    pitching: clamp(Math.round(isPitcher ? talent + 20 + jitter(15) : randInt(5, 20)), 5, 100),
  };
}

// options: { isStarter, qualityMult, ageRange, retireAtSeasonsRange, seasonsPlayed,
//            acquiredVia, simplified, visibleStat }
//
// `simplified: true` produces an Act II crew member: the *same* player entity, with one
// stat flagged for display. It is deliberately not a stripped-down parallel type — the
// full stats block means every engine function (playerOverall, teamStrength, camp,
// retirement) keeps working the moment a crew member is promoted onto the roster at the
// Act III boundary, instead of quietly producing NaN.
function createPlayer(position, options = {}) {
  const {
    isStarter = true,
    qualityMult = 1,
    ageRange = [22, 32],
    retireAtSeasonsRange = [8, 14],
    seasonsPlayed = 0,
    acquiredVia = 'draft',
    simplified = false,
    visibleStat = null,
  } = options;

  const stats = randomStatsForPosition(position, qualityMult);

  return {
    id: generateId('player'),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    position,
    isStarter,
    stats,
    age: randInt(ageRange[0], ageRange[1]),
    seasonsPlayed,
    retireAtSeasons: randInt(retireAtSeasonsRange[0], retireAtSeasonsRange[1]),
    campStatus: null,
    acquiredVia,
    simplified,
    // Which of `stats` the UI is allowed to show while the player is simplified.
    visibleStat: simplified ? visibleStat || bestStatKey(stats) : null,
  };
}

function bestStatKey(stats) {
  return Object.keys(stats).reduce((best, key) => (stats[key] > stats[best] ? key : best), 'contact');
}

// A fresh 15-man roster: one starter per field position, plus 5 bench players drawn
// from the starter position pool (extra depth/utility, not tied to a required slot).
function createStartingRoster() {
  const starters = STARTER_POSITIONS.map((position) => createPlayer(position, { isStarter: true }));
  const bench = Array.from({ length: BENCH_SLOTS }, () =>
    createPlayer(pick(STARTER_POSITIONS), { isStarter: false })
  );
  return [...starters, ...bench];
}

module.exports = { createPlayer, randomStatsForPosition, createStartingRoster };
