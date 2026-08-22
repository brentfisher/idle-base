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
  bookie: { label: 'The Bookie', icon: '🎲' },
  sponsor: { label: 'The Sponsor Board', icon: '📋' },
  // Act VII (PRD §10.4). `office` and `dispatch` are the two narrative rails and they are
  // deliberately separate categories: the Office is talking about what you are doing now, and
  // Earth is talking about a league you left. A player skimming the feed should be able to tell
  // those apart without reading them.
  colony: { label: 'Colony', icon: '🛠️' },
  transit: { label: 'Transit', icon: '🛰️' },
  contract: { label: 'Assignment', icon: '📄' },
  office: { label: 'The Office', icon: '📡' },
  dispatch: { label: 'Earth', icon: '📻' },
};

// The cash a win paid, as a clause tacked onto the result rather than a feed entry of its own.
// A second entry per game would halve the feed's effective depth (FEED_CAP is 50, and an
// 8-hour catch-up already overruns it many times over), and it would separate the money from
// the thing that earned it — which is the whole reason the player asked for this.
//
// An envelope because that is how this money actually arrives at every level of the game: the
// coach counting out the concession take in the parking lot, and, twenty years later, a line
// item somebody's accountant calls a win bonus. Same envelope, more zeroes.
function purseClause(purse) {
  return purse > 0 ? ` $${Math.round(purse)} in the envelope.` : '';
}

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
  // `purse` is optional and defaults to nothing: a loss pays none, and every caller written
  // before the purse existed passes five arguments and still reads correctly.
  gameResult: function gameResult(opponentName, isHome, won, scoreFor, scoreAgainst, purse) {
    const verb = won ? 'beat' : 'fell to';
    const venue = isHome ? 'at home' : 'on the road';
    return `${won ? 'W' : 'L'} ${scoreFor}-${scoreAgainst} — ${verb} the ${opponentName} ${venue}.${purseClause(purse)}`;
  },

  regularSeasonComplete: function regularSeasonComplete(seasonNumber, madePlayoffs) {
    return madePlayoffs
      ? `Season ${seasonNumber} regular season is done — you clinched a playoff berth.`
      : `Season ${seasonNumber} regular season is done — you missed the playoffs.`;
  },

  playoffGameResult: function playoffGameResult(roundLabel, opponentName, won, scoreFor, scoreAgainst, purse) {
    return won
      ? `${roundLabel}: won ${scoreFor}-${scoreAgainst} over the ${opponentName}.${purseClause(purse)}`
      : `${roundLabel}: lost ${scoreFor}-${scoreAgainst} to the ${opponentName} — your run is over.`;
  },

  playoffRoundElsewhere: function playoffRoundElsewhere(roundLabel) {
    return `${roundLabel} played out around the league without you.`;
  },

  // Topping the table in a league with no postseason, which in Acts III and V IS the trophy. Takes
  // the trophy's NAME from the act rather than spelling one, because the same fact is "the
  // little-league title" in one act and "the pennant" in another — and because an act that names no
  // trophy gets no line at all rather than a generic one.
  //
  // Separate from championshipWon() below, which belongs to Act VI's real bracket. The two never
  // both fire: the acts that set `titleName` are exactly the acts that have no playoffs.
  topOfTheTable: function topOfTheTable(seasonNumber, titleName) {
    return `First place. Season ${seasonNumber} ends with ${titleName}.`;
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

  // Act IV. The Bookie is never named as a person and never says anything encouraging: he is
  // a mechanism that pays or does not pay, and the copy stays as flat as he is.
  bookieSettled: function bookieSettled(result) {
    const backed = result.side === 'against' ? 'against your own team' : 'on your team';
    return result.won
      ? `The Bookie pays out $${result.payout} — you had $${result.amount} ${backed} against the ${result.opponentName}.`
      : `The Bookie keeps your $${result.amount}. You had it ${backed} against the ${result.opponentName}.`;
  },

  // Act IV. A sponsor coming off the board is the game telling the player that their NAME got
  // somewhere before they did — somebody three towns over has been hearing about this team all
  // summer. So the line is about being talked about, and the money is left for the panel to
  // state; a feed entry that led with a rate would read like a press release, and the sponsor
  // board is emphatically not a press release.
  sponsorOffered: function sponsorOffered(sponsorName) {
    return `${sponsorName} has been asking about you. There is an offer sitting on the sponsor board.`;
  },

  seasonRollover: function seasonRollover(finishedSeasonNumber, wins, losses) {
    return `Season ${finishedSeasonNumber} wrapped at ${wins}-${losses}. Season ${finishedSeasonNumber + 1} begins.`;
  },
};

// Act VII's lines. Named functions taking values the engine already holds, returning one string —
// never a string assembled in the engine (engine/feed.js's rule).
//
// THE REGISTER IS FLAT AND IT IS FLAT ON PURPOSE, most of all in the warnings. Nothing in this act
// can be lost: a starved colony throttles and recovers, no module is ever removed, no resource
// goes negative. An alarmed warning line would be lying about the stakes, and a player who learns
// the feed cries wolf stops reading it — which matters here because the feed is where the whole
// terminology reveal is delivered. "Nothing has been damaged" is the sentence doing that work.
const actSevenMessages = {
  moduleOnline: (name) => `${name} brought online.`,
  moduleIdle: (name) => `${name} is drawing more than the site is making. It is waiting.`,
  siteColonized: (name, klass) => `${name} entered in the register as a ${klass} affiliate.`,
  crewRotated: (count) => `${count} on the roster. No moves to report.`,

  resourceStarved: (name) => `${name} is at zero. Everything downstream of it has slowed to match. `
    + 'Nothing has been damaged.',
  resourceCapped: (name) => `${name} is at capacity and the overflow is going nowhere. `
    + 'Build a tank or spend it.',
  satisfactionThrottled: (pct) => `Site running at ${pct}% of rated output. `
    + 'This is a supply matter, not a fault.',

  launchArmed: (threshold) => `Requisition filled: ${threshold} units. `
    + 'The window is open and it does not close.',
  launchDeparted: (vehicle, dest) => `${vehicle} away, on four burns, for ${dest}.`,
  launchArrived: (dest) => `Rendezvous with ${dest}. Insertion inside tolerance.`,

  contractOffered: (name) => `Assignment posted: ${name}.`,
  contractCompleted: (name) => `${name} — terms met. Awaiting your claim.`,
  contractClaimed: (name, fuel) => `${name} credited: ${fuel} units against your requisition.`,
  contractLapsed: (name) => `${name} lapsed. It will be rescheduled. `
    + 'Weather is not counted against anybody.',
  contractMakeup: (name) => `Rescheduled: ${name}. Longer window, same terms.`,
};

module.exports = {
  FEED_CAP,
  FEED_CATEGORIES,
  feedMessages,
  actSevenMessages,
  powerupDisplayName,
  campProgramDisplayName,
  playoffRoundLabel,
};
