const balanceConfig = require('../data/balanceConfig');
const { computeModifiers } = require('./modifiers');
const { totalIncomePerSecond, scaleBundle } = require('./income');
const { checkActTransition } = require('./progression');
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

function getTeamStrength(working, modifiers, teamId) {
  if (teamId === PLAYER_TEAM_ID) return teamStrength(working.roster, modifiers);
  const team = working.league.teams.find((t) => t.id === teamId);
  return team ? team.baseStrength * modifiers.aiStrengthMult : 30 * modifiers.aiStrengthMult;
}

// Credits one integrated income bundle. `bundle` is already rate x step — never a
// per-second event; see engine/income.js for why that distinction matters offline.
function addIncome(working, bundle) {
  let next = working;

  if (bundle.caps > 0 || bundle.coins > 0) {
    next = {
      ...next,
      wallet: {
        ...next.wallet,
        caps: next.wallet.caps + bundle.caps,
        coins: next.wallet.coins + bundle.coins,
      },
    };
  }

  if (bundle.cash > 0) {
    // SCAFFOLDING: cash still lands in the legacy top-level field that economyActions,
    // rosterActions and HeaderStats read. STORY-001 repoints this at wallet.cash.
    next = {
      ...next,
      cash: next.cash + bundle.cash,
      prestige: {
        ...next.prestige,
        runStats: { ...next.prestige.runStats, totalRevenue: next.prestige.runStats.totalRevenue + bundle.cash },
      },
    };
  }

  return next;
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

// Returning Infinity when nothing discrete is pending is load-bearing, not a fallback: it
// lets the loop take one large step and integrate rate x step in a single pass. Early acts
// have no season at all, and must never register a recurring event here.
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
    const top = sorted.slice(0, balanceConfig.playoffTeams).map((r) => r.teamId);
    if (top.includes(PLAYER_TEAM_ID)) {
      season.phase = 'playoffs';
      season.playoffs = {
        ...generateBracket(top),
        nextRoundAtClock: working.clock + balanceConfig.secondsPerPlayoffRound,
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
    season.playoffs.nextRoundAtClock = working.clock + balanceConfig.secondsPerPlayoffRound;
  }

  return { ...working, season, prestige, hasWonLeagueThisRun };
}

function runOffseasonTransition(working, modifiers) {
  const eraRules = modifiers.era.rules;
  const retireAtSeasonsRange = eraRules.retireAtSeasonsRange || balanceConfig.retireAtSeasonsRange;
  const { roster, retired, rookies } = checkRetirements(working.roster, modifiers, retireAtSeasonsRange);

  const wonChampionship = !!(working.season.playoffs && working.season.playoffs.champion === PLAYER_TEAM_ID);
  const playerRow = working.season.standings.find((s) => s.teamId === PLAYER_TEAM_ID);

  const leagueTeams = driftLeagueStrength(working.league.teams);
  const gamesPerSeason = eraRules.gamesPerSeason || balanceConfig.gamesPerSeason;
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const standings = resetStandings(leagueTeams);
  const tradeWindows = buildTradeWindows(gamesPerSeason, eraRules.tradeWindows).map((w) => ({
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
      secondsPerGame: balanceConfig.secondsPerGame,
      nextGameAtClock: working.clock + balanceConfig.secondsPerGame,
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

    if (step > 0) {
      working = addIncome(working, scaleBundle(totalIncomePerSecond(working, modifiers), step));
    }
    working = { ...working, clock: working.clock + step };
    remaining -= step;

    working = expirePowerups(working);
    working = { ...working, roster: processCampCompletions(working.roster, working.clock) };

    // One guard for the whole phase-handling block: acts before Little League have no
    // season at all (design doc, Decision 2).
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
    // After phase handling (PRD §6.1) so an act boundary crossed mid-catch-up still fires.
    working = checkActTransition(working);
  }

  return working;
}

module.exports = { advance, getTeamStrength };
