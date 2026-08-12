const { PLAYER_TEAM_ID } = require('./schedule');
const { getWalkupSong } = require('../data/walkupSongsConfig');

// The rating formula's coefficients, lifted out of playerOverall() so they can be READ as well as
// applied. They were inline arithmetic until the walk-up songs shipped, and a song has to know
// what a stat is worth to the player being offered it — a "+12% pitching" record sold to a
// shortstop would be a purchase with a mathematically guaranteed effect of zero, and this
// codebase does not sell no-ops (see data/capsShopConfig.js on unknown bonus keys).
// engine/walkupSongs.js filters the picker off this table, so the shop and the simulation are
// reading the same numbers and cannot drift apart.
//
// Each row sums to 1.0, which is what makes a rating comparable to a raw stat and therefore to
// balanceConfig.aiTeamStrengthRange. Anything added here has to keep that true.
//
// Pitching is absent from DEFAULT rather than set to 0, and the difference matters: it is what
// makes "which stats count for this position" answerable by looking at the keys. It is
// intentionally near-irrelevant for position players (see playerFactory.js, which rolls them
// 5-20), so including it at any weight would drag every non-pitcher's rating down.
const STAT_WEIGHTS = {
  P: { pitching: 0.5, defense: 0.2, contact: 0.15, power: 0.1, speed: 0.05 },
  DEFAULT: { power: 0.3, contact: 0.3, speed: 0.2, defense: 0.2 },
};

function statWeights(position) {
  return STAT_WEIGHTS[position] || STAT_WEIGHTS.DEFAULT;
}

// What a player's walk-up song multiplies one stat by, at READ TIME. Never written back into
// player.stats — see the long note in data/walkupSongsConfig.js for why that is the whole point
// of the mechanic. Returns exactly 1 for a player with no song, which is every player on a save
// written before this shipped and every player on the bench of a team that never bought a record,
// so this is invisible until something is assigned.
//
// Lives in this file rather than in engine/walkupSongs.js purely to keep the module graph a DAG:
// walkupSongs.js needs STAT_WEIGHTS above to filter its picker, so it requires this module, and a
// require back the other way would be a cycle. Both read the same config; neither owns a number.
function walkupStatMultiplier(player, stat) {
  const song = getWalkupSong(player && player.walkupSongId);
  if (!song || song.stat !== stat) return 1;
  return 1 + song.bonus;
}

// Identical arithmetic to the two hand-written expressions this replaced, in the same order, so a
// player with no walk-up song rates exactly what they rated before — `x * 1 * w` is `x * w` to the
// bit. A missing stat contributes nothing rather than NaN: a NaN rating would propagate through
// teamStrength() into the win probability and quietly break a season.
function playerOverall(player) {
  const weights = statWeights(player.position);
  return Object.keys(weights).reduce((sum, stat) => {
    const base = player.stats[stat];
    if (typeof base !== 'number' || !Number.isFinite(base)) return sum;
    return sum + base * walkupStatMultiplier(player, stat) * weights[stat];
  }, 0);
}

// Starters only — bench depth doesn't count toward on-field strength, which is what
// gives roster (trade/upgrade) decisions weight.
function teamStrength(roster, modifiers) {
  const starters = roster.filter((p) => p.isStarter);
  if (starters.length === 0) return 0;
  const avg = starters.reduce((sum, p) => sum + playerOverall(p), 0) / starters.length;
  const mult = modifiers ? modifiers.strengthMult : 1;
  return avg * mult;
}

// The strength either side of a fixture brings, whichever side that is. Lives here rather
// than in engine/tickEngine.js (which owned it, and still re-exports it) because Act IV's
// Bookie has to price a game the tick loop has not played yet: importing it from tickEngine
// would make engine/bookie.js and engine/tickEngine.js require each other.
//
// The 30 fallback is for a teamId that is in a schedule but not in the league — a shape that
// should not occur, and which must not throw in the middle of a season if it ever does.
function getTeamStrength(state, modifiers, teamId) {
  if (teamId === PLAYER_TEAM_ID) return teamStrength(state.roster, modifiers);
  const team = state.league ? state.league.teams.find((t) => t.id === teamId) : null;
  return team ? team.baseStrength * modifiers.aiStrengthMult : 30 * modifiers.aiStrengthMult;
}

module.exports = { STAT_WEIGHTS, statWeights, walkupStatMultiplier, playerOverall, teamStrength, getTeamStrength };
