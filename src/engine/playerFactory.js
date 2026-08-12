const { FIRST_NAMES, LAST_NAMES, LEGEND_NAMES, LEGEND_NAME_CHANCE } = require('../data/playerNames');
const { STARTER_POSITIONS, BENCH_SLOTS } = require('../data/positions');
const { clamp } = require('../utils/statUtils');
const { generateId, randInt, pick, jitter } = require('../utils/randomUtils');

// A generated name, or occasionally one of the legends (data/playerNames.js). Guarded on the
// list being non-empty so emptying LEGEND_NAMES turns the feature off cleanly rather than
// producing `undefined` as somebody's name.
function randomPlayerName() {
  if (LEGEND_NAMES.length > 0 && Math.random() < LEGEND_NAME_CHANCE) return pick(LEGEND_NAMES);
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

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

// options: { isStarter, qualityMult, ageRange, retireAtSeasonsRange, seasonsPlayed, acquiredVia,
//            simplified, signatureStat }
//
// `simplified` is a PRESENTATION flag, not a second kind of entity: Act II's crew are made
// here, with the same stat block and the same fields as anyone else, and are simply shown as
// a name, a position and one stat (`signatureStat`). Because they are ordinary players,
// promoting a crew member into the roster at the Act III boundary needs no conversion step
// and cannot produce an undefined stat — which is the whole reason they are not a parallel type.
function createPlayer(position, options = {}) {
  const {
    isStarter = true,
    qualityMult = 1,
    ageRange = [22, 32],
    retireAtSeasonsRange = [8, 14],
    seasonsPlayed = 0,
    acquiredVia = 'draft',
    simplified = false,
    signatureStat = null,
  } = options;

  return {
    id: generateId('player'),
    name: randomPlayerName(),
    position,
    isStarter,
    stats: randomStatsForPosition(position, qualityMult),
    age: randInt(ageRange[0], ageRange[1]),
    seasonsPlayed,
    retireAtSeasons: randInt(retireAtSeasonsRange[0], retireAtSeasonsRange[1]),
    campStatus: null,
    acquiredVia,
    simplified,
    signatureStat,
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
