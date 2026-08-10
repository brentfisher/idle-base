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

// options: { isStarter, qualityMult, ageRange, retireAtSeasonsRange, seasonsPlayed, acquiredVia }
function createPlayer(position, options = {}) {
  const {
    isStarter = true,
    qualityMult = 1,
    ageRange = [22, 32],
    retireAtSeasonsRange = [8, 14],
    seasonsPlayed = 0,
    acquiredVia = 'draft',
  } = options;

  return {
    id: generateId('player'),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    position,
    isStarter,
    stats: randomStatsForPosition(position, qualityMult),
    age: randInt(ageRange[0], ageRange[1]),
    seasonsPlayed,
    retireAtSeasons: randInt(retireAtSeasonsRange[0], retireAtSeasonsRange[1]),
    campStatus: null,
    acquiredVia,
  };
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
