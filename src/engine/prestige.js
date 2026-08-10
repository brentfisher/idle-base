const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('./playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { computeModifiers } = require('./modifiers');
const { enterAct, FINAL_ACT_INDEX } = require('./progression');

function calculateLegacyPoints(state) {
  const { championships, peakOverallRating, totalRevenue } = state.prestige.runStats;
  return Math.floor(championships * 50 + peakOverallRating + totalRevenue / 100000);
}

// Resets the run (roster, cash, season, league) but keeps everything permanent:
// legacyPoints, purchasedPerks, and the era counter (which is what makes the next
// run feel different, per data/eras.js).
//
// Prestige resets to the FINAL-ACT FLOOR, never below it: the odyssey is played once per save
// and prestige stays what it is today, an Act VI replay axis. Every earlier act's unlocks stay
// on, because unlocks are derived from the act index (engine/progression.js) and the index
// never moves backwards.
function resetForPrestige(state) {
  const earned = calculateLegacyPoints(state);
  const nextEra = state.prestige.era + 1;

  const prestige = {
    legacyPoints: state.prestige.legacyPoints + earned,
    totalLegacyEarned: state.prestige.totalLegacyEarned + earned,
    era: nextEra,
    purchasedPerks: state.prestige.purchasedPerks,
    runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0 },
    victoryAcknowledgedCount: 0,
  };

  const modifiers = computeModifiers({ ...state, prestige });
  const era = modifiers.era;
  const leagueTeamCount = era.rules.leagueTeamCount || balanceConfig.leagueTeamCount;
  const gamesPerSeason = era.rules.gamesPerSeason || balanceConfig.gamesPerSeason;

  const leagueTeams = createLeagueTeams(leagueTeamCount - 1);
  const standings = resetStandings(leagueTeams);
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const tradeWindows = buildTradeWindows(gamesPerSeason, era.rules.tradeWindows).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  return enterAct({
    ...state,
    cash: balanceConfig.startingCash,
    reputation: balanceConfig.startingReputation,
    stadium: { level: 1, capacity: balanceConfig.startingCapacity, ticketPrice: balanceConfig.startingTicketPrice },
    roster: createStartingRoster(),
    powerups: { active: [], purchasedPermanentIds: [] },
    league: { teams: leagueTeams },
    season: {
      seasonNumber: 1,
      phase: 'regular',
      gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      secondsPerGame: balanceConfig.secondsPerGame,
      nextGameAtClock: state.clock + balanceConfig.secondsPerGame,
      standings,
      tradeWindows,
      playoffs: null,
      offseasonSummaryPending: false,
    },
    prestige,
    hasWonLeagueThisRun: false,
  }, FINAL_ACT_INDEX);
}

module.exports = { calculateLegacyPoints, resetForPrestige };
