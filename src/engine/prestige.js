const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('./playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { computeModifiers } = require('./modifiers');
const { PRESTIGE_ACT_INDEX } = require('../data/acts');
const { enterAct } = require('./progression');

function calculateLegacyPoints(state) {
  const { championships, peakOverallRating, totalRevenue } = state.prestige.runStats;
  return Math.floor(championships * 50 + peakOverallRating + totalRevenue / 100000);
}

// Resets the run (roster, wallet, season, league) but keeps everything permanent:
// legacyPoints, purchasedPerks, and the era counter (which is what makes the next
// run feel different, per data/eras.js).
//
// Prestige resets to the PRESTIGE FLOOR, never below it: the odyssey is played once per save
// and prestige stays what it is today, an Act VI replay axis. Every earlier act's unlocks stay
// on, because unlocks are derived from the act index (engine/progression.js) and the index
// never moves backwards.
//
// The floor is PRESTIGE_ACT_INDEX and emphatically not FINAL_ACT_INDEX, which this used to
// read. They are equal today, so this is not a behaviour change — but the day ACTS grows a
// seventh entry, FINAL_ACT_INDEX becomes 6 and this line would have started dropping every
// prestiging player into Act VII, past the crossing rather than at it. See data/acts.js for
// the two meanings.
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
    // `salvage` is listed for that reason and not because it does anything yet: it is zero at every
    // point in the game that can reach prestige today, so listing it and omitting it are
    // indistinguishable at runtime (balanceOf() reads an absent key as 0). It is here so the comment
    // above stays true, which is what stops the next currency from being the one that gets missed.
    wallet: { caps: 0, coins: 0, cash: balanceConfig.startingCash, salvage: 0 },
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
  }, PRESTIGE_ACT_INDEX);
}

module.exports = { calculateLegacyPoints, resetForPrestige };
