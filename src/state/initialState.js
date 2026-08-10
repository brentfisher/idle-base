const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('../engine/playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('../engine/schedule');

function createInitialState() {
  const leagueTeams = createLeagueTeams(balanceConfig.leagueTeamCount - 1);
  const standings = resetStandings(leagueTeams);
  const schedule = generateSeasonSchedule(leagueTeams, balanceConfig.gamesPerSeason);
  const tradeWindows = buildTradeWindows(balanceConfig.gamesPerSeason).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));
  const now = Date.now();

  return {
    clock: 0,
    meta: { version: 1, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },
    cash: balanceConfig.startingCash,
    // Per-currency purse for the income bundle engine/income.js returns. STORY-001 owns
    // this field and will fold `cash` above into `wallet.cash`; until then `state.cash`
    // stays the single source of truth for cash and `wallet.cash` is left at 0.
    wallet: { caps: 0, coins: 0, cash: 0 },
    reputation: balanceConfig.startingReputation,
    stadium: { level: 1, capacity: balanceConfig.startingCapacity, ticketPrice: balanceConfig.startingTicketPrice },
    roster: createStartingRoster(),
    powerups: { active: [], purchasedPermanentIds: [] },
    league: { teams: leagueTeams },
    season: {
      seasonNumber: 1,
      phase: 'regular',
      gamesPerSeason: balanceConfig.gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      secondsPerGame: balanceConfig.secondsPerGame,
      nextGameAtClock: balanceConfig.secondsPerGame,
      standings,
      tradeWindows,
      playoffs: null,
      offseasonSummaryPending: false,
      lastOffseasonSummary: null,
    },
    prestige: {
      legacyPoints: 0,
      totalLegacyEarned: 0,
      era: 0,
      purchasedPerks: [],
      runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0 },
      // How many of this run's championships have been shown to the player via the
      // victory modal — compared against runStats.championships (see AppShell.js).
      // Sticky across season rollovers so a title won during offline catch-up can't
      // be silently overwritten by a later season's offseason summary.
      victoryAcknowledgedCount: 0,
    },
    hasWonLeagueThisRun: false,
  };
}

module.exports = { createInitialState };
