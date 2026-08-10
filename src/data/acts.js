// The six acts of the odyssey. Deliberately mirrors the shape of data/eras.js
// ({ id, name, description, entry, exit, rules, modifierBonuses, unlocks }) so the two
// progression axes compose instead of competing — see
// openspec/changes/odyssey-progression-architecture/design.md, Decision 3.
//
// `rules` overrides fields on data/balanceConfig.js; resolution order is
// balanceConfig <- act.rules <- era.rules (era highest).
// `unlocks` is the set of feature ids the act reveals; engine/progression.js unions
// acts 0..actIndex on read, so unlock state is never persisted (Decision 5).
//
// `entry` / `exit` are { label, isMet(state) }. Acts whose exit predicate is owned by a
// sibling story return false for now — that is a not-yet-implemented gate, not a design
// statement, and is the single line those stories replace.

const { STARTER_KIT_IDS } = require('./kitConfig');

const ACTS = [
  {
    id: 0,
    name: 'The Vacant Lot',
    description:
      'You are nine years old. There is a vacant lot behind the hardware store, and there is money in the dirt if you know where to look.',
    entry: { label: 'New game', isMet: () => true },
    exit: {
      label: 'Buy the Starter Kit — glove, ball and bat',
      isMet: (state) => STARTER_KIT_IDS.every((id) => state.kit.ownedItemIds.includes(id)),
    },
    rules: {},
    modifierBonuses: {},
    unlocks: ['lot'],
  },
  {
    id: 1,
    name: 'Off the Wall',
    description: 'A brick wall, a chalk strike zone, and every kid on the block wants a piece of you.',
    entry: { label: 'Own the Starter Kit', isMet: (state) => state.progression.act >= 1 },
    exit: {
      label: 'Win 5 wall-ball challenges and recruit 3 crew members',
      isMet: (state) => !!state.wallBall && state.wallBall.wins >= 5 && state.crew.length >= 3,
    },
    rules: {},
    modifierBonuses: {},
    unlocks: ['wallBall'],
  },
  {
    id: 2,
    name: 'Little League',
    description: 'Somebody’s dad has a clipboard and a set of matching jerseys. This is organized ball now.',
    entry: { label: 'Accept the Little League invitation', isMet: (state) => state.progression.act >= 2 },
    // Owned by the Act III story.
    exit: { label: 'Win a Little League title', isMet: () => false },
    rules: { leagueTeamCount: 4, gamesPerSeason: 6, secondsPerGame: 25, playoffTeams: 0 },
    modifierBonuses: {},
    unlocks: ['field', 'roster', 'league'],
  },
  {
    id: 3,
    name: 'Travel Ball',
    description: 'Hotel lobbies, gas money, and a coach who keeps a spreadsheet.',
    entry: { label: 'Get invited to a travel program', isMet: (state) => state.progression.act >= 3 },
    // Owned by the Act IV story.
    exit: { label: 'Build a program worth scouting', isMet: () => false },
    rules: { leagueTeamCount: 8, gamesPerSeason: 16, secondsPerGame: 35, playoffTeams: 2 },
    modifierBonuses: {},
    unlocks: ['camp', 'trade'],
  },
  {
    id: 4,
    name: 'The Minors',
    description: 'Bus leagues, a real gate, and a scoreboard that mostly works.',
    entry: { label: 'Sign a minor-league deal', isMet: (state) => state.progression.act >= 4 },
    // Owned by the Act V story.
    exit: { label: 'Earn the call-up', isMet: () => false },
    rules: { leagueTeamCount: 8, gamesPerSeason: 24, secondsPerGame: 45, playoffTeams: 2 },
    modifierBonuses: {},
    unlocks: ['ticketing'],
  },
  {
    id: 5,
    name: 'The Big Leagues',
    description: 'The show. Everything you built, at full scale, for as long as you want it.',
    entry: { label: 'Reach the majors', isMet: (state) => state.progression.act >= 5 },
    // Terminal act: the win condition lives inside it, not at its boundary.
    exit: { label: 'None — the odyssey ends here', isMet: () => false },
    rules: {},
    modifierBonuses: {},
    unlocks: ['playoffs', 'prestige'],
  },
];

// Extrapolation-safe like getEraConfig: an index past the authored list clamps to the
// terminal act rather than returning undefined.
function getActConfig(actIndex) {
  if (actIndex < 0) return ACTS[0];
  if (actIndex < ACTS.length) return ACTS[actIndex];
  return ACTS[ACTS.length - 1];
}

const FINAL_ACT_INDEX = ACTS.length - 1;

module.exports = { ACTS, getActConfig, FINAL_ACT_INDEX };
