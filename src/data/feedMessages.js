// Authored copy for the live event feed (state.feed). Engine code builds entries through
// these helpers so no display prose lives inside the simulation (see engine/feed.js).

const { POWERUPS } = require('./powerupsConfig');
const { CAMP_PROGRAMS } = require('./campProgramsConfig');

// Ring-buffer size, enforced on every write in engine/feed.js. An 8-hour offline
// catch-up resolves roughly 600 narrated events (28,800s / 60s per game slot, plus
// playoffs and offseasons), so the feed deliberately keeps only the most recent slice.
const FEED_CAP = 50;

// Presentation metadata for the renderer; the engine only ever writes the key.
const FEED_CATEGORIES = {
  game: { label: 'Game', icon: '⚾' },
  season: { label: 'Season', icon: '📅' },
  playoffs: { label: 'Playoffs', icon: '🎟️' },
  championship: { label: 'Championship', icon: '🏆' },
  roster: { label: 'Roster', icon: '👤' },
  camp: { label: 'Training Camp', icon: '🏋️' },
  powerup: { label: 'Promotion', icon: '✨' },
};

function powerupDisplayName(powerupId) {
  const powerup = POWERUPS.find((p) => p.id === powerupId);
  return powerup ? powerup.name : 'A promotion';
}

function campProgramDisplayName(programId) {
  const program = CAMP_PROGRAMS.find((p) => p.id === programId);
  return program ? program.name : 'training camp';
}

// 4-team bracket => ['Semifinal', 'Final']; larger brackets extend backwards.
function playoffRoundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Playoff round ${roundIndex + 1}`;
}

const feedMessages = {
  gameResult: function gameResult(opponentName, isHome, won, scoreFor, scoreAgainst) {
    const verb = won ? 'beat' : 'fell to';
    const venue = isHome ? 'at home' : 'on the road';
    return `${won ? 'W' : 'L'} ${scoreFor}-${scoreAgainst} — ${verb} the ${opponentName} ${venue}.`;
  },

  regularSeasonComplete: function regularSeasonComplete(seasonNumber, madePlayoffs) {
    return madePlayoffs
      ? `Season ${seasonNumber} regular season is done — you clinched a playoff berth.`
      : `Season ${seasonNumber} regular season is done — you missed the playoffs.`;
  },

  playoffGameResult: function playoffGameResult(roundLabel, opponentName, won, scoreFor, scoreAgainst) {
    return won
      ? `${roundLabel}: won ${scoreFor}-${scoreAgainst} over the ${opponentName}.`
      : `${roundLabel}: lost ${scoreFor}-${scoreAgainst} to the ${opponentName} — your run is over.`;
  },

  playoffRoundElsewhere: function playoffRoundElsewhere(roundLabel) {
    return `${roundLabel} played out around the league without you.`;
  },

  championshipWon: function championshipWon(seasonNumber) {
    return `Champions! Season ${seasonNumber} ends with the league title in the trophy case.`;
  },

  championshipLost: function championshipLost(championName) {
    return `The ${championName} took the league title this season.`;
  },

  campCompleted: function campCompleted(playerName, programName) {
    return `${playerName} finished ${programName}.`;
  },

  powerupExpired: function powerupExpired(powerupName) {
    return `${powerupName} has worn off.`;
  },

  playerRetired: function playerRetired(playerName, position) {
    return `${position} ${playerName} announced his retirement.`;
  },

  rookieSigned: function rookieSigned(playerName, position) {
    return `Signed rookie ${position} ${playerName}.`;
  },

  seasonRollover: function seasonRollover(finishedSeasonNumber, wins, losses) {
    return `Season ${finishedSeasonNumber} wrapped at ${wins}-${losses}. Season ${finishedSeasonNumber + 1} begins.`;
  },
};

module.exports = {
  FEED_CAP,
  FEED_CATEGORIES,
  feedMessages,
  powerupDisplayName,
  campProgramDisplayName,
  playoffRoundLabel,
};
