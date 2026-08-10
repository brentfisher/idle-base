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
    // Must match CURRENT_VERSION in persistence/saveLoad.js — a fresh state stamped with an
    // older version would be discarded by loadGame() on the very next reload.
    meta: { version: 2, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },
    // caps and coins are the early-act currencies; they exist from t=0 so nothing has to
    // guard for their absence, but no mechanic touches them yet.
    wallet: { caps: 0, coins: 0, cash: balanceConfig.startingCash },
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
