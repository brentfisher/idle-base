const FIRST_NAMES = [
  'Jake', 'Miguel', 'Derek', 'Marcus', 'Tyler', 'Carlos', 'Jose', 'Andre',
  'Kenji', 'Trevor', 'Diego', 'Isaiah', 'Wyatt', 'Sam', 'Rico', 'Owen',
  'Hank', 'Julio', 'Bobby', 'Nate', 'Elijah', 'Frankie', 'Duke', 'Cole',
  'Rafael', 'Lonnie', 'Grady', 'Manny', 'Pete', 'Roy', 'Curt', 'Deion',
];

const LAST_NAMES = [
  'Hendricks', 'Ortega', 'Whitfield', 'Delgado', 'Reyes', 'Sullivan',
  'Kowalski', 'Marsh', 'Boone', 'Castillo', 'Fitzgerald', 'Nakamura',
  'Rourke', 'Vasquez', 'Sterling', 'Okafor', 'Mercer', 'Alvarado',
  'Doyle', 'Prescott', 'Landry', 'Guerrero', 'Holt', 'Ibarra',
  'Callahan', 'Suzuki', 'Beaumont', 'Trujillo', 'Winters', 'Pham',
];

// Whole names rather than first/last halves, because these are not names that recombine —
// "The Juggernaut Ortega" is not a thing, and splitting "Peeballin Boxer" across the two lists
// above would quietly seed "Peeballin Hendricks" through the whole league. They are drawn as
// complete names or not at all.
//
// Stefan and Brent share a surname on purpose: brothers on the same roster is exactly the kind
// of thing that happens in a league like this one.
const LEGEND_NAMES = [
  'Stefan Feesh',
  'Brent Feesh',
  'Jay Rock',
  'The Umpire',
  'The Juggernaut',
  'Peeballin Boxer',
];

// How often a generated player gets a legend name instead of a generated one.
//
// engine/playerFactory.js is stateless — it builds one player and has no idea who else is on
// the roster — so this is a per-player probability and NOT a draw without replacement. Two
// Juggernauts on one roster is therefore possible. It is left possible rather than solved,
// because the fix would mean threading an "already used" set through every caller that builds
// a roster (littleLeague.buildRoster, schedule.createLeagueTeams, the offseason rookie
// replacement in tickEngine, trade candidate generation), which is a lot of plumbing to
// prevent a collision that reads as a joke rather than as a bug.
//
// 0.2 is chosen against the roster sizes that actually occur: a twelve-man roster expects ~2.4
// legends and carries at least one about 93% of the time, so they reliably turn up without the
// league feeling like it is made of nothing else. The chance both Feesh brothers appear
// together on a twelve-man roster is around 20%.
const LEGEND_NAME_CHANCE = 0.2;

module.exports = { FIRST_NAMES, LAST_NAMES, LEGEND_NAMES, LEGEND_NAME_CHANCE };
