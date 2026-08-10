const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('./playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { computeModifiers } = require('./modifiers');
const { enterAct, FINAL_ACT_INDEX } = require('./progression');

function calculateLegacyPoints(state) {
  const { championships, peakOverallRating, totalRevenue } = state.prestige.runStats;
  return Math.floor(championships * 50 + peakOverallRating + totalRevenue / 100000);
}

// Resets the run (roster, wallet, season, league) but keeps everything permanent:
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

  // Resolved against the *next* era: balanceConfig <- act.rules <- era.rules. Spread layering,
  // not `||`, so a rule legitimately set to 0 survives (see engine/modifiers.js).
  const rules = computeModifiers({ ...state, prestige }).rules;
  const gamesPerSeason = rules.gamesPerSeason;

  const leagueTeams = createLeagueTeams(rules.leagueTeamCount - 1);
  const standings = resetStandings(leagueTeams);
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const tradeWindows = buildTradeWindows(gamesPerSeason, rules.tradeWindows).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  return enterAct({
    ...state,
    // Prestige clears every currency, not just cash — mirrors the wallet in createInitialState().
    wallet: { caps: 0, coins: 0, cash: balanceConfig.startingCash },
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
      secondsPerGame: rules.secondsPerGame,
      nextGameAtClock: state.clock + rules.secondsPerGame,
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
