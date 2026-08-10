const balanceConfig = require('../data/balanceConfig');
const { getAiTeamName } = require('../data/teamNames');
const { generateId, randInt, shuffle, jitter } = require('../utils/randomUtils');
const { clamp } = require('../utils/statUtils');

const PLAYER_TEAM_ID = 'player';

function createLeagueTeams(aiTeamCount) {
  return Array.from({ length: aiTeamCount }, (_, i) => ({
    id: `ai_${i}`,
    name: getAiTeamName(i),
    baseStrength: randInt(35, 65),
  }));
}

// Small season-to-season drift so a long-running league doesn't feel perfectly static,
// without a full regeneration (teams only regenerate on prestige/era change).
function driftLeagueStrength(leagueTeams) {
  return leagueTeams.map((team) => ({
    ...team,
    baseStrength: clamp(Math.round(team.baseStrength + jitter(4)), 25, 90),
  }));
}

function resetStandings(leagueTeams) {
  const rows = [PLAYER_TEAM_ID, ...leagueTeams.map((t) => t.id)];
  return rows.map((teamId) => ({ teamId, wins: 0, losses: 0, runsFor: 0, runsAgainst: 0 }));
}

// Builds the player's own game slots against the AI opponents, evenly distributed.
function generateSeasonSchedule(leagueTeams, gamesPerSeason) {
  const opponentIds = leagueTeams.map((t) => t.id);
  if (opponentIds.length === 0) return [];
  const gamesPerOpponent = Math.max(1, Math.round(gamesPerSeason / opponentIds.length));

  let slots = [];
  opponentIds.forEach((opponentTeamId) => {
    for (let i = 0; i < gamesPerOpponent; i += 1) {
      slots.push({ opponentTeamId, isHome: i % 2 === 0 });
    }
  });

  slots = shuffle(slots).slice(0, gamesPerSeason);
  while (slots.length < gamesPerSeason) {
    const filler = opponentIds[slots.length % opponentIds.length];
    slots.push({ opponentTeamId: filler, isHome: slots.length % 2 === 0 });
  }

  return slots.map((slot, index) => ({
    gameIndex: index,
    opponentTeamId: slot.opponentTeamId,
    isHome: slot.isHome,
    played: false,
    result: null,
    score: null,
  }));
}

function gamesPlayed(standings, teamId) {
  const row = standings.find((s) => s.teamId === teamId);
  return row ? row.wins + row.losses : 0;
}

// Pairs up the AI teams not currently facing the player for this slot, so every team's
// games-played count stays roughly even (needed for meaningful standings/playoff seeding).
// If the AI pool is odd, the team with the fewest games played gets the bye.
function pickAiPairingsForSlot(aiTeamIds, standings) {
  const shuffled = shuffle(aiTeamIds);
  let byeTeamId = null;
  let pairable = shuffled;

  if (shuffled.length % 2 !== 0) {
    const sortedByGames = [...shuffled].sort((a, b) => gamesPlayed(standings, a) - gamesPlayed(standings, b));
    byeTeamId = sortedByGames[0];
    pairable = shuffled.filter((id) => id !== byeTeamId);
  }

  const pairs = [];
  for (let i = 0; i < pairable.length; i += 2) {
    pairs.push([pairable[i], pairable[i + 1]]);
  }
  return { pairs, byeTeamId };
}

function buildTradeWindows(gamesPerSeason, windowDefs = balanceConfig.tradeWindows) {
  return windowDefs.map((w) => ({
    openAtGame: Math.round(gamesPerSeason * w.openFraction),
    closeAtGame: Math.round(gamesPerSeason * w.closeFraction),
  }));
}

module.exports = {
  PLAYER_TEAM_ID,
  createLeagueTeams,
  driftLeagueStrength,
  resetStandings,
  generateSeasonSchedule,
  pickAiPairingsForSlot,
  buildTradeWindows,
  gamesPlayed,
  generateId,
};
