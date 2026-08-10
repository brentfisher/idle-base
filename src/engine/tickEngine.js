const balanceConfig = require('../data/balanceConfig');
const { computeModifiers } = require('./modifiers');
const { revenuePerSecond } = require('./economy');
const { simulateGame } = require('./gameSim');
const { playerOverall, teamStrength } = require('./strength');
const {
  PLAYER_TEAM_ID,
  driftLeagueStrength,
  resetStandings,
  generateSeasonSchedule,
  pickAiPairingsForSlot,
  buildTradeWindows,
} = require('./schedule');
const { applyGameResult, sortStandings } = require('./standings');
const { generateBracket, resolveCurrentRound } = require('./playoffs');
const { generateTradeCandidates } = require('./tradeDeadline');
const { processCampCompletions } = require('./trainingCamp');
const { checkRetirements } = require('./retirement');
const { checkActTransition } = require('./progression');

// generateBracket() halves each round down to a single final, so it requires a power-of-2
// field. `playoffTeams` was hardcoded to balanceConfig's 4 before rules resolution made it
// authorable, and an odd size (6 teams, or 8 declared in a 6-team little league) builds a
// bracket whose final match never gets both slots filled — leaving the season stuck in the
// playoffs phase forever. Round down to the nearest power of 2; anything under 2 means no
// postseason at all, which is what `playoffTeams: 0` declares.
function playoffFieldSize(declared, availableTeams) {
  const n = Math.min(declared || 0, availableTeams);
  if (n < 2) return 0;
  return 2 ** Math.floor(Math.log2(n));
}

function getTeamStrength(working, modifiers, teamId) {
  if (teamId === PLAYER_TEAM_ID) return teamStrength(working.roster, modifiers);
  const team = working.league.teams.find((t) => t.id === teamId);
  return team ? team.baseStrength * modifiers.aiStrengthMult : 30 * modifiers.aiStrengthMult;
}

function addRevenue(working, revenue) {
  return {
    ...working,
    wallet: { ...working.wallet, cash: working.wallet.cash + revenue },
    prestige: {
      ...working.prestige,
      runStats: { ...working.prestige.runStats, totalRevenue: working.prestige.runStats.totalRevenue + revenue },
    },
  };
}

function expirePowerups(working) {
  const before = working.powerups.active;
  const active = before.filter((p) => p.expiresAtClock == null || p.expiresAtClock > working.clock);
  if (active.length === before.length) return working;
  return { ...working, powerups: { ...working.powerups, active } };
}

function updatePeakRating(working) {
  const starters = working.roster.filter((p) => p.isStarter);
  if (starters.length === 0) return working;
  const rating = starters.reduce((sum, p) => sum + playerOverall(p), 0) / starters.length;
  if (rating <= working.prestige.runStats.peakOverallRating) return working;
  return {
    ...working,
    prestige: { ...working.prestige, runStats: { ...working.prestige.runStats, peakOverallRating: rating } },
  };
}

function findNextEventClock(working) {
  const candidates = [];
  if (working.season) {
    if (working.season.phase === 'regular') candidates.push(working.season.nextGameAtClock);
    if (working.season.phase === 'playoffs' && working.season.playoffs) {
      candidates.push(working.season.playoffs.nextRoundAtClock);
    }
  }
  working.powerups.active.forEach((p) => {
    if (p.expiresAtClock != null) candidates.push(p.expiresAtClock);
  });
  working.roster.forEach((p) => {
    if (p.campStatus) candidates.push(p.campStatus.completesAtClock);
  });
  return candidates.length ? Math.min(...candidates) : Infinity;
}

function resolveGameSlot(working, modifiers) {
  const slot = working.season.schedule[working.season.scheduleIndex];
  const playerStrength = getTeamStrength(working, modifiers, PLAYER_TEAM_ID);
  const oppStrength = getTeamStrength(working, modifiers, slot.opponentTeamId);
  const result = simulateGame(playerStrength, oppStrength);

  let standings = applyGameResult(working.season.standings, PLAYER_TEAM_ID, result.aWins, result.scoreA, result.scoreB);
  standings = applyGameResult(standings, slot.opponentTeamId, !result.aWins, result.scoreB, result.scoreA);

  const remainingAiIds = working.league.teams.map((t) => t.id).filter((id) => id !== slot.opponentTeamId);
  const { pairs } = pickAiPairingsForSlot(remainingAiIds, standings);
  pairs.forEach(([teamA, teamB]) => {
    const r = simulateGame(getTeamStrength(working, modifiers, teamA), getTeamStrength(working, modifiers, teamB));
    standings = applyGameResult(standings, teamA, r.aWins, r.scoreA, r.scoreB);
    standings = applyGameResult(standings, teamB, !r.aWins, r.scoreB, r.scoreA);
  });

  const schedule = working.season.schedule.map((g, i) =>
    i === working.season.scheduleIndex
      ? { ...g, played: true, result: result.aWins ? 'win' : 'loss', score: `${result.scoreA}-${result.scoreB}` }
      : g
  );
  const scheduleIndex = working.season.scheduleIndex + 1;

  let tradeWindows = working.season.tradeWindows.map((w) => ({
    ...w,
    open: !w.used && scheduleIndex >= w.openAtGame && scheduleIndex < w.closeAtGame,
  }));
  tradeWindows = tradeWindows.map((w) => {
    if (w.open && w.candidates.length === 0) {
      return { ...w, candidates: generateTradeCandidates(working, modifiers) };
    }
    if (!w.open && w.candidates.length > 0 && !w.used) {
      return { ...w, candidates: [] };
    }
    return w;
  });

  let season = {
    ...working.season,
    schedule,
    standings,
    scheduleIndex,
    tradeWindows,
    nextGameAtClock: working.clock + working.season.secondsPerGame,
  };

  if (scheduleIndex >= season.gamesPerSeason) {
    const sorted = sortStandings(standings);
    // Resolved, not balanceConfig: an act may declare `playoffTeams: 0` for a league with no
    // postseason, in which case `top` is empty and the season rolls straight to offseason.
    // `season.gamesPerSeason`/`secondsPerGame` above stay as-is on purpose — those were fixed
    // when this season was built, so a mid-season act change must not reshape a season in flight.
    const top = sorted.slice(0, playoffFieldSize(modifiers.rules.playoffTeams, sorted.length)).map((r) => r.teamId);
    if (top.includes(PLAYER_TEAM_ID)) {
      season.phase = 'playoffs';
      season.playoffs = {
        ...generateBracket(top),
        nextRoundAtClock: working.clock + modifiers.rules.secondsPerPlayoffRound,
      };
    } else {
      season.phase = 'offseason';
    }
  }

  return { ...working, season };
}

function resolvePlayoffRound(working, modifiers) {
  const resolved = resolveCurrentRound(working.season.playoffs, (teamId) => getTeamStrength(working, modifiers, teamId));
  let season = { ...working.season, playoffs: { ...working.season.playoffs, ...resolved } };
  let prestige = working.prestige;
  let hasWonLeagueThisRun = working.hasWonLeagueThisRun;

  if (resolved.champion) {
    season.phase = 'offseason';
    if (resolved.champion === PLAYER_TEAM_ID) {
      prestige = {
        ...prestige,
        runStats: { ...prestige.runStats, championships: prestige.runStats.championships + 1 },
      };
      hasWonLeagueThisRun = true;
    }
  } else {
    season.playoffs.nextRoundAtClock = working.clock + modifiers.rules.secondsPerPlayoffRound;
  }

  return { ...working, season, prestige, hasWonLeagueThisRun };
}

function runOffseasonTransition(working, modifiers) {
  // The offseason transition is where the next season's shape is decided, so it is the one place
  // rules are re-resolved: balanceConfig <- act.rules <- era.rules (see engine/modifiers.js).
  const rules = modifiers.rules;
  const { roster, retired, rookies } = checkRetirements(working.roster, modifiers, rules.retireAtSeasonsRange);

  const wonChampionship = !!(working.season.playoffs && working.season.playoffs.champion === PLAYER_TEAM_ID);
  const playerRow = working.season.standings.find((s) => s.teamId === PLAYER_TEAM_ID);

  const leagueTeams = driftLeagueStrength(working.league.teams);
  const gamesPerSeason = rules.gamesPerSeason;
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const standings = resetStandings(leagueTeams);
  const tradeWindows = buildTradeWindows(gamesPerSeason, rules.tradeWindows).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  const summary = {
    seasonNumber: working.season.seasonNumber,
    wins: playerRow ? playerRow.wins : 0,
    losses: playerRow ? playerRow.losses : 0,
    madePlayoffs: !!working.season.playoffs,
    wonChampionship,
    retired,
    rookies: rookies.map((r) => ({ id: r.id, name: r.name, position: r.position })),
  };

  return {
    ...working,
    roster,
    league: { teams: leagueTeams },
    season: {
      seasonNumber: working.season.seasonNumber + 1,
      phase: 'regular',
      gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      // Resolved, not balanceConfig: hardcoding these reverted per-act/era pacing to 60s at the
      // first offseason transition, silently undoing the pacing applied when the act was entered.
      secondsPerGame: rules.secondsPerGame,
      nextGameAtClock: working.clock + rules.secondsPerGame,
      standings,
      tradeWindows,
      playoffs: null,
      offseasonSummaryPending: true,
      lastOffseasonSummary: summary,
    },
  };
}

// The single place simulation happens. Called identically by the live 1s timer and by
// offlineProgress.js's load-time catch-up — just with a different deltaSeconds.
function advance(state, deltaSeconds) {
  let working = state;
  let remaining = deltaSeconds;
  let iterations = 0;

  while (remaining > 0 && iterations < balanceConfig.safetyCapIterations) {
    iterations += 1;
    const modifiers = computeModifiers(working);
    const nextEventClock = findNextEventClock(working);
    const step = nextEventClock === Infinity ? remaining : Math.min(remaining, Math.max(0, nextEventClock - working.clock));

    // Ticket revenue dereferences the stadium and is suspended in the offseason, so it needs
    // both to exist. Acts before The Minors earn through other contributors entirely.
    if (working.stadium && working.season && working.season.phase !== 'offseason' && step > 0) {
      const revenue = revenuePerSecond(working, modifiers) * step;
      working = addRevenue(working, revenue);
    }
    working = { ...working, clock: working.clock + step };
    remaining -= step;

    working = expirePowerups(working);
    working = { ...working, roster: processCampCompletions(working.roster, working.clock) };

    // ONE guard for the whole phase block rather than a check per branch: there is no season
    // at all until Act III creates one, and every branch below is a season phase transition.
    if (working.season) {
      if (working.season.phase === 'regular' && working.clock >= working.season.nextGameAtClock) {
        working = resolveGameSlot(working, modifiers);
      }
      if (working.season.phase === 'playoffs' && working.season.playoffs && working.clock >= working.season.playoffs.nextRoundAtClock) {
        working = resolvePlayoffRound(working, computeModifiers(working));
      }
      if (working.season.phase === 'offseason') {
        working = runOffseasonTransition(working, computeModifiers(working));
      }
    }

    working = updatePeakRating(working);
    // Inside the loop, so act transitions fire during offline catch-up too — a player who
    // closes the tab mid-act returns having actually crossed the boundary.
    working = checkActTransition(working);
  }

  return working;
}

module.exports = { advance, getTeamStrength };
