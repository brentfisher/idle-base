// Act III — Little League. The act initializer that finally builds a franchise: a roster, a
// league, and a season for the existing simulation (engine/tickEngine.js) to run.
//
// This is the boundary the whole odyssey was waiting on. Before it, `state.season` was `null`
// from a fresh save through every act, so components/layout/AppShell.js always took its
// `!state.season` early return and no franchise panel could render however high
// `progression.act` climbed. Creating a season here is what opens the tab bar.
//
// Pure — no React, no DOM. Every number comes from data/, never from here.
const { STARTER_POSITIONS } = require('../data/positions');
const {
  LITTLE_LEAGUE_QUALITY_MULT,
  LITTLE_LEAGUE_AGE_RANGE,
  LITTLE_LEAGUE_BENCH_SLOTS,
  PROMOTED_ACQUIRED_VIA,
} = require('../data/actThreeConfig');
const { createPlayer } = require('./playerFactory');
const { createLeagueTeams, resetStandings, generateSeasonSchedule, buildTradeWindows } = require('./schedule');
const { finishedFirstLastSeason } = require('./standings');
const { resolveRules } = require('./modifiers');
const { pick } = require('../utils/randomUtils');

// Act III's index in data/acts.js. Named because two things key off it: the initializer
// registry, and the repair below.
const LITTLE_LEAGUE_ACT_INDEX = 2;

// Repair, not migration. A save written before Act III had an initializer can sit at
// `progression.act >= 2` with `state.season === null` — the act was entered, but nothing
// created the content it owns. Because unlocks are derived from the act index, such a save
// looks like it has progressed while AppShell keeps taking its `!state.season` early return,
// so the player is told they are in Act III and shown Act II. There is no way out by playing.
//
// This is deliberately narrower than "re-run the current act's initializer": those are not all
// safe to repeat (Act VI's zeroes prestige.runStats, which would erase championships). Every
// act from III on requires a season and only Act III creates one, so the missing season is the
// whole of the inconsistency, and building it is the whole of the fix.
function repairMissingSeason(state) {
  if (!state.progression || state.progression.act < LITTLE_LEAGUE_ACT_INDEX) return state;
  if (state.season) return state;
  return openLittleLeague(state);
}

function createLittleLeaguer(position, isStarter) {
  return createPlayer(position, {
    isStarter,
    qualityMult: LITTLE_LEAGUE_QUALITY_MULT,
    ageRange: LITTLE_LEAGUE_AGE_RANGE,
    acquiredVia: 'draft',
  });
}

// The crew are already ordinary player entities (engine/playerFactory.js) — that is the whole
// reason they were built that way rather than as a parallel type — so promotion sets flags and
// invents nothing. `simplified` is cleared because the roster screen draws a full PlayerCard;
// the stat block it needs has been there since the kid turned up at the wall.
function promoteCrewMember(member, isStarter) {
  return { ...member, isStarter, simplified: false, signatureStat: null, acquiredVia: PROMOTED_ACQUIRED_VIA };
}

// Builds the starting lineup out of the crew first, then fills what the crew doesn't cover.
//
// Crew positions are rolled randomly and may collide (two shortstops is entirely possible), so
// the first crew member claiming a position starts and any duplicate goes to the bench rather
// than being dropped. A player never loses a kid they earned off the wall.
function buildRoster(crew) {
  const available = [...crew];
  const starters = STARTER_POSITIONS.map((position) => {
    const index = available.findIndex((member) => member.position === position);
    if (index === -1) return createLittleLeaguer(position, true);
    const [member] = available.splice(index, 1);
    return promoteCrewMember(member, true);
  });

  const bench = [
    ...available.map((member) => promoteCrewMember(member, false)),
    ...Array.from({ length: LITTLE_LEAGUE_BENCH_SLOTS }, () => createLittleLeaguer(pick(STARTER_POSITIONS), false)),
  ];

  return [...starters, ...bench];
}

// Creates the league and the first season, at whatever scale the current act declares.
// Rules are resolved rather than read off balanceConfig, because Act III's whole point is that
// it is a *small* league (4 teams, 6 games, no postseason) — see data/acts.js.
function openLittleLeague(state) {
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

  return {
    ...state,
    roster: buildRoster(state.crew || []),
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
      // Nothing has been played yet, so there is no recap to raise. Explicitly false rather
      // than absent: AppShell reads this to decide whether to show the offseason modal.
      offseasonSummaryPending: false,
      lastOffseasonSummary: null,
    },
  };
}

// Act III's exit, read from the recap the player was just shown rather than from live standings —
// by the time this is checked the offseason transition has already reset them. See `finishedFirst`
// in engine/tickEngine.js: runOffseasonTransition().
//
// DELEGATES rather than re-reading the field. Act V's pennant is the same fact about a different
// league, so the read moved to engine/standings.js when that act's exit was fixed; this keeps its
// own name because "the little-league title" is what Act III calls it, and the act's exit id says
// so. The name is Act III's; the fact is shared.
function hasWonLittleLeagueTitle(state) {
  return finishedFirstLastSeason(state);
}

module.exports = {
  LITTLE_LEAGUE_ACT_INDEX,
  openLittleLeague,
  repairMissingSeason,
  hasWonLittleLeagueTitle,
  buildRoster,
};
