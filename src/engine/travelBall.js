// Act IV — Travel Ball. The act initializer that turns a four-team little league into a real
// circuit, plus the record-keeping its exit reads.
//
// Act III's boundary was structural: before it there was no `state.season` at all, so no
// franchise UI could render. Act IV's boundary is a change of SCALE — eight clubs, fifteen
// games, kids who age out — and its exit is the first one in the game that cannot be won in a
// single moment. "A 60% win rate across two full travel seasons" has to be accumulated, so
// this file owns a small record and nothing else does.
//
// Pure — no React, no DOM. Every number comes from data/, never from here.
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { resolveRules } = require('./modifiers');
const { randInt } = require('../utils/randomUtils');
const { TRAVEL_SEASONS_REQUIRED, TRAVEL_WIN_RATE_REQUIRED } = require('../data/actFourConfig');

// Act IV's index in data/acts.js. Named for the same two reasons Act III's is: the initializer
// registry keys off it, and the season record below must only accumulate while the act is live.
const TRAVEL_BALL_ACT_INDEX = 3;

// Every read of the Act IV slice goes through this. A save written before Act IV existed has
// no slice at all, and this codebase tolerates an absent slice rather than migrating it —
// engine/wallBall.js, engine/concessions.js and engine/feed.js all do the same.
function travelBallSlice(state) {
  const slice = (state && state.travelBall) || {};
  return {
    seasons: slice.seasons || [],
    seasonsCompleted: slice.seasonsCompleted || 0,
    careerWins: slice.careerWins || 0,
    careerLosses: slice.careerLosses || 0,
    reputationDeals: slice.reputationDeals || [],
  };
}

// The exit reads a ROLLING WINDOW of the last two completed seasons, not a running career
// average, and that is a design decision rather than an implementation convenience.
//
// A cumulative average has a memory. Measured over 15 runs, a player who lost their first
// travel season needed a long stretch of far-better-than-60% ball to drag the career figure
// back over the bar — the act ran 118 to 210 simulated minutes against a 25-35 minute budget,
// and at the widest band 60% of runs never got there at all. The player was not being asked to
// build a 60% team; they were being asked to pay off a debt. A window asks the question the
// act is actually about — is this team good enough NOW — and asks it again every season.
//
// "Across two full travel seasons" reads at least as naturally this way, and the seasons half
// of the exit is what stops a hot 15 games from ending the act on its own.
function windowRecord(state) {
  const recent = travelBallSlice(state).seasons.slice(-TRAVEL_SEASONS_REQUIRED);
  return recent.reduce(
    (total, season) => ({ wins: total.wins + season.wins, losses: total.losses + season.losses }),
    { wins: 0, losses: 0 }
  );
}

// The window as one number. Zero games played is a 0 win rate rather than a divide-by-zero:
// the exit also requires two completed seasons so the empty case can never satisfy it anyway,
// but a NaN here would poison the progress bar the panel draws from it — and would survive a
// save round trip as `null`.
function windowWinRate(state) {
  const { wins, losses } = windowRecord(state);
  const played = wins + losses;
  return played > 0 ? wins / played : 0;
}

// Act IV's exit, registered under `travelBallWinRateReached` in engine/progression.js. Reads
// the record the player can see on the panel, not a stored milestone.
function hasReachedTravelWinRate(state) {
  const slice = travelBallSlice(state);
  return slice.seasonsCompleted >= TRAVEL_SEASONS_REQUIRED && windowWinRate(state) >= TRAVEL_WIN_RATE_REQUIRED;
}

// Called from engine/tickEngine.js once per offseason transition, unconditionally — the act
// check lives HERE rather than in the tick loop so the tick loop never has to know which act
// owns which record. Outside Act IV this is a no-op returning the same object.
//
// Recording the season the offseason just closed is the only way this record moves: a season
// counts when it FINISHES, which is what "two full travel seasons" means.
// Only the last TRAVEL_SEASONS_REQUIRED seasons are kept: the window is all the exit reads,
// and an unbounded list would grow in the save forever for a player who lingers in the act.
// The career totals alongside it are for display and are cheap to keep exactly.
function recordTravelSeason(state, summary) {
  if (!state.progression || state.progression.act !== TRAVEL_BALL_ACT_INDEX) return state;
  const slice = travelBallSlice(state);
  const season = { wins: summary.wins || 0, losses: summary.losses || 0 };

  return {
    ...state,
    travelBall: {
      ...slice,
      seasons: [...slice.seasons, season].slice(-TRAVEL_SEASONS_REQUIRED),
      seasonsCompleted: slice.seasonsCompleted + 1,
      careerWins: slice.careerWins + season.wins,
      careerLosses: slice.careerLosses + season.losses,
    },
  };
}

// The initializer. Entering Act IV rebuilds the league at travel-ball scale and starts the
// season over at that scale.
//
// Rebuilding the season is deliberate and is NOT the destructive case it looks like. The act
// is entered from engine/progression.js's transition check, which runs immediately after
// runOffseasonTransition() has already built the NEXT season — at Act III's rules, because
// those were the rules in force when it ran. That season is at `scheduleIndex: 0` with nothing
// played, so replacing it costs the player nothing and is the only way the first travel season
// is actually a travel season. Without this, "two full travel seasons" would start by counting
// a six-game little-league schedule against three clubs.
//
// The clubs themselves are NEW rather than the little league carried forward, and that is the
// fiction as much as the balance: travel ball is played three towns over against teams the
// player has never seen. Reusing the old teams would also leave three sub-band clubs in an
// eight-team league — free wins in an act whose exit is a win-rate bar.
//
// `lastOffseasonSummary` is carried across untouched: it is the recap of the little-league
// title the player just won, and AppShell has not shown it yet.
// The kids the player brought from Act III were created with balanceConfig's [8, 14] career
// length, because nothing had overridden it when they were drafted. Act IV declares [3, 6] and
// runs two to four seasons, so without this re-roll not one player would ever age out and the
// act's own `retirement` unlock would be invisible — which is exactly what the first run of
// the verification suite found.
//
// Only the clock is re-rolled. Nothing else about a player changes, and `seasonsPlayed` is
// untouched, so a kid who has already played a summer is a summer closer to aging out.
function putRosterOnTheTravelClock(roster, retireAtSeasonsRange) {
  return roster.map((player) => ({
    ...player,
    retireAtSeasons: randInt(retireAtSeasonsRange[0], retireAtSeasonsRange[1]),
  }));
}

function openTravelBall(state) {
  const rules = resolveRules(state);
  const gamesPerSeason = rules.gamesPerSeason;

  const leagueTeams = createLeagueTeams(rules.leagueTeamCount - 1, rules.aiTeamStrengthRange);
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const standings = resetStandings(leagueTeams);
  const tradeWindows = buildTradeWindows(gamesPerSeason, rules.tradeWindows).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  const previousSeason = state.season || {};

  return {
    ...state,
    roster: putRosterOnTheTravelClock(state.roster || [], rules.retireAtSeasonsRange),
    league: { teams: leagueTeams },
    season: {
      ...previousSeason,
      // The player's career season count keeps running. This is the same kid's fifth summer,
      // not season 1 of a new game.
      seasonNumber: previousSeason.seasonNumber || 1,
      phase: 'regular',
      gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      secondsPerGame: rules.secondsPerGame,
      nextGameAtClock: state.clock + rules.secondsPerGame,
      standings,
      tradeWindows,
      playoffs: null,
    },
    travelBall: {
      seasons: [],
      seasonsCompleted: 0,
      careerWins: 0,
      careerLosses: 0,
      reputationDeals: [],
    },
  };
}

// Repair, not migration — the same problem engine/littleLeague.js's repairMissingSeason
// solves, one act later. A save written before this file existed can sit at
// `progression.act >= 3` with no `travelBall` slice, a four-team league and a six-game
// schedule: the act was entered, but nothing created the content it owns, and no amount of
// playing will produce it because checkActTransition() only runs an initializer when the act
// is ENTERED.
//
// Keyed on the slice being absent rather than on league size. A mid-act save has a slice and
// must never be rebuilt — that would wipe a season in progress and the record the exit reads.
// A stranded save has no slice, and rebuilding its season is the fix, not the damage.
function repairTravelBall(state) {
  if (!state.progression || state.progression.act < TRAVEL_BALL_ACT_INDEX) return state;
  if (state.travelBall) return state;
  return openTravelBall(state);
}

// Presentation-ready view of the act's progress. The panel renders this and decides nothing
// about thresholds itself (the same contract engine/wallBall.js's challengeView has).
function travelBallView(state) {
  const slice = travelBallSlice(state);
  const rate = windowWinRate(state);
  const window = windowRecord(state);
  const seasonsLeft = Math.max(0, TRAVEL_SEASONS_REQUIRED - slice.seasonsCompleted);

  return {
    wins: window.wins,
    losses: window.losses,
    careerWins: slice.careerWins,
    careerLosses: slice.careerLosses,
    winRate: rate,
    seasonsCompleted: slice.seasonsCompleted,
    seasonsRequired: TRAVEL_SEASONS_REQUIRED,
    seasonsLeft,
    winRateRequired: TRAVEL_WIN_RATE_REQUIRED,
    // Progress toward the bar the player is actually furthest from, so a single number means
    // something at every point in the act: seasons first, because a 100% record over one
    // season cannot end the act, then the rate.
    fraction:
      seasonsLeft > 0
        ? Math.min(1, slice.seasonsCompleted / TRAVEL_SEASONS_REQUIRED)
        : Math.min(1, rate / TRAVEL_WIN_RATE_REQUIRED),
    gate: seasonsLeft > 0 ? 'seasons' : 'rate',
    canAdvance: hasReachedTravelWinRate(state),
  };
}

module.exports = {
  TRAVEL_BALL_ACT_INDEX,
  travelBallSlice,
  windowRecord,
  windowWinRate,
  hasReachedTravelWinRate,
  recordTravelSeason,
  openTravelBall,
  repairTravelBall,
  travelBallView,
};
