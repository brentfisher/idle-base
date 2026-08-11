const { PLAYER_TEAM_ID } = require('./schedule');

function playerOverall(player) {
  const s = player.stats;
  if (player.position === 'P') {
    return s.pitching * 0.5 + s.defense * 0.2 + s.contact * 0.15 + s.power * 0.1 + s.speed * 0.05;
  }
  // Pitching is intentionally near-irrelevant for position players (see playerFactory.js),
  // so it's excluded here rather than dragging every non-pitcher's rating down.
  return s.power * 0.3 + s.contact * 0.3 + s.speed * 0.2 + s.defense * 0.2;
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

module.exports = { playerOverall, teamStrength, getTeamStrength };
