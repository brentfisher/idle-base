const balanceConfig = require('../data/balanceConfig');
const { createStartingRoster } = require('./playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { computeModifiers } = require('./modifiers');
const { PRESTIGE_ACT_INDEX } = require('../data/acts');
const { enterAct } = require('./progression');

// What this run has EARNED, which is not the same as how good its roster is.
//
// THE RATING TERM IS A DELTA, and the absolute version of it was an exploit. resetForPrestige()
// below zeroes `peakOverallRating` and then builds a fresh roster averaging 47-54; one tick later
// engine/tickEngine.js's updatePeakRating() recorded that fresh average as the peak, so pressing
// Prestige twice in a row paid ~50 points the second time for a roster the game had just handed
// over. Measured before the fix: six presses, no play at all, 270 points banked.
//
// Paying on `peak - baseline` makes the term mean "how much better did you make this team", which
// is what it was always meant to measure — a run that improves a 48-rated roster to a 70 earns 22,
// and a run that improves nothing earns nothing however good the roster it started with.
//
// AN ABSENT BASELINE READS AS 0, WHICH IS DELIBERATELY THE OLD BEHAVIOUR. Saves are never migrated
// in this codebase, so a run already in progress has no baseline recorded and would otherwise have
// its legitimately earned rating gain wiped to nothing at the moment it cashes out. Reading absent
// as 0 pays that run exactly what it expected; the baseline is written on the very next tick, so
// the exploit closes for that save after one prestige rather than immediately. Punishing a
// mid-run save to close an exploit a tick sooner is the wrong trade.
function calculateLegacyPoints(state) {
  const { championships, peakOverallRating, totalRevenue, baselineOverallRating } = state.prestige.runStats;
  const baseline = Number.isFinite(baselineOverallRating) ? baselineOverallRating : 0;
  const ratingGain = Math.max(0, peakOverallRating - baseline);
  return Math.floor(championships * 50 + ratingGain + totalRevenue / 100000);
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
    // `baselineOverallRating` is cleared rather than set from the roster built below, so the ONE
    // writer stays engine/tickEngine.js's updatePeakRating() — it re-seeds from whatever roster is
    // actually on the team at the next tick. See the note there.
    runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0, baselineOverallRating: null },
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
    // THE CLOCK RESTARTS AT 0, AND EVERY FORWARD-LOOKING STAMP HAS TO RESTART WITH IT. An era is a
    // fresh attempt at the last act, so it is timed like one: engine/records.js records an act's
    // duration as a `state.clock` delta, and a clock that kept running across the boundary would
    // make every post-prestige traversal look longer than the first by however long the first
    // one took.
    //
    // The stamps below are gates, not history: `nextClickAtClock` and `nextChallengeAtClock` say
    // "not before clock N", and a clock rewound past them would leave both cooling for as long as
    // the previous era lasted. clickCooldownRemaining() clamps the click's wait to the act's own
    // cooldown so it could not lock out permanently, but the wall would simply be shut — and
    // relying on another module's clamp to keep this one correct is how that clamp gets removed
    // one day by someone who cannot see who depended on it.
    //
    // HISTORICAL stamps are deliberately left alone: `bookie`'s `placedAtClock` / `settledAtClock`
    // and the feed's entry clocks record when something happened in an era that is now over.
    // Rewriting them would be inventing a past, and nothing schedules off them. `season` below is
    // rebuilt outright, and `powerups.active` is emptied, so neither carries a stale clock.
    clock: 0,
    clicker: { ...state.clicker, nextClickAtClock: 0 },
    wallBall: { ...state.wallBall, nextChallengeAtClock: 0 },
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
      // Measured from the RESTARTED clock (0), not from the era that just ended.
      nextGameAtClock: rules.secondsPerGame,
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
