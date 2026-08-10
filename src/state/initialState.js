const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('../engine/playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('../engine/schedule');
const { FINAL_ACT_INDEX } = require('../engine/progression');

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
    reputation: balanceConfig.startingReputation,
    stadium: { level: 1, capacity: balanceConfig.startingCapacity, ticketPrice: balanceConfig.startingTicketPrice },
    roster: createStartingRoster(),
    powerups: { active: [], purchasedPermanentIds: [] },
    // Owned by STORY-004, which starts a fresh game in the first act. Until the acts
    // exist, a new game already contains the full league and stadium, so it sits at
    // the final act — every feature unlocked, which is what the game does today.
    // Note there is deliberately no `wallet` here: STORY-001 owns it, and a
    // wallet.cash that the tick engine never writes would freeze the header chip.
    progression: {
      act: FINAL_ACT_INDEX,
      actEnteredAtClock: 0,
      milestones: {},
      seenTabs: [],
      storyBeatsSeen: [],
    },
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
