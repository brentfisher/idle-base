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
const { createFeedEntry, appendFeedEntries } = require('./feed');
const {
  feedMessages,
  powerupDisplayName,
  campProgramDisplayName,
  playoffRoundLabel,
} = require('../data/feedMessages');

function teamDisplayName(working, teamId) {
  if (teamId === PLAYER_TEAM_ID) return 'home side';
  const team = working.league.teams.find((t) => t.id === teamId);
  return team ? team.name : 'unknown club';
}

function getTeamStrength(working, modifiers, teamId) {
  if (teamId === PLAYER_TEAM_ID) return teamStrength(working.roster, modifiers);
  const team = working.league.teams.find((t) => t.id === teamId);
  return team ? team.baseStrength * modifiers.aiStrengthMult : 30 * modifiers.aiStrengthMult;
}

function addRevenue(working, revenue) {
  return {
    ...working,
    cash: working.cash + revenue,
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
  const expired = before.filter((p) => !active.includes(p));
  return appendFeedEntries(
    { ...working, powerups: { ...working.powerups, active } },
    expired.map((p) => createFeedEntry(working.clock, 'powerup', feedMessages.powerupExpired(powerupDisplayName(p.id))))
  );
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
  if (working.season.phase === 'regular') candidates.push(working.season.nextGameAtClock);
  if (working.season.phase === 'playoffs' && working.season.playoffs) {
    candidates.push(working.season.playoffs.nextRoundAtClock);
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

  const entries = [
    createFeedEntry(
      working.clock,
      'game',
      feedMessages.gameResult(
        teamDisplayName(working, slot.opponentTeamId),
        slot.isHome,
        result.aWins,
        result.scoreA,
        result.scoreB
      )
    ),
  ];

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
    entries.push(
      createFeedEntry(
        working.clock,
        'season',
        feedMessages.regularSeasonComplete(season.seasonNumber, season.phase === 'playoffs')
      )
    );
  }

  return appendFeedEntries({ ...working, season }, entries);
}

function resolvePlayoffRound(working, modifiers) {
  const playedRoundIndex = working.season.playoffs.currentRoundIndex;
  const resolved = resolveCurrentRound(working.season.playoffs, (teamId) => getTeamStrength(working, modifiers, teamId));
  let season = { ...working.season, playoffs: { ...working.season.playoffs, ...resolved } };
  let prestige = working.prestige;
  let hasWonLeagueThisRun = working.hasWonLeagueThisRun;

  const roundLabel = playoffRoundLabel(playedRoundIndex, resolved.rounds.length);
  // The bracket keeps resolving after the player is eliminated, so a player match may not exist.
  const playerMatch = resolved.rounds[playedRoundIndex].find(
    (m) => m.teamA === PLAYER_TEAM_ID || m.teamB === PLAYER_TEAM_ID
  );
  const entries = [];
  if (playerMatch) {
    const playerIsA = playerMatch.teamA === PLAYER_TEAM_ID;
    entries.push(
      createFeedEntry(
        working.clock,
        'playoffs',
        feedMessages.playoffGameResult(
          roundLabel,
          teamDisplayName(working, playerIsA ? playerMatch.teamB : playerMatch.teamA),
          playerMatch.winner === PLAYER_TEAM_ID,
          playerIsA ? playerMatch.scoreA : playerMatch.scoreB,
          playerIsA ? playerMatch.scoreB : playerMatch.scoreA
        )
      )
    );
  } else {
    entries.push(createFeedEntry(working.clock, 'playoffs', feedMessages.playoffRoundElsewhere(roundLabel)));
  }

  if (resolved.champion) {
    season.phase = 'offseason';
    if (resolved.champion === PLAYER_TEAM_ID) {
      prestige = {
        ...prestige,
        runStats: { ...prestige.runStats, championships: prestige.runStats.championships + 1 },
      };
      hasWonLeagueThisRun = true;
      entries.push(
        createFeedEntry(working.clock, 'championship', feedMessages.championshipWon(season.seasonNumber))
      );
    } else {
      entries.push(
        createFeedEntry(
          working.clock,
          'championship',
          feedMessages.championshipLost(teamDisplayName(working, resolved.champion))
        )
      );
    }
  } else {
    season.playoffs.nextRoundAtClock = working.clock + balanceConfig.secondsPerPlayoffRound;
  }

  return appendFeedEntries({ ...working, season, prestige, hasWonLeagueThisRun }, entries);
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

  const entries = [];
  retired.forEach((p) => {
    entries.push(createFeedEntry(working.clock, 'roster', feedMessages.playerRetired(p.name, p.position)));
  });
  rookies.forEach((p) => {
    entries.push(createFeedEntry(working.clock, 'roster', feedMessages.rookieSigned(p.name, p.position)));
  });
  entries.push(
    createFeedEntry(
      working.clock,
      'season',
      feedMessages.seasonRollover(summary.seasonNumber, summary.wins, summary.losses)
    )
  );

  return appendFeedEntries({
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
  }, entries);
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

    if (working.season.phase !== 'offseason' && step > 0) {
      const revenue = revenuePerSecond(working, modifiers) * step;
      working = addRevenue(working, revenue);
    }
    working = { ...working, clock: working.clock + step };
    remaining -= step;

    working = expirePowerups(working);
    const completingCamps = working.roster.filter(
      (p) => p.campStatus && p.campStatus.completesAtClock <= working.clock
    );
    working = { ...working, roster: processCampCompletions(working.roster, working.clock) };
    if (completingCamps.length > 0) {
      working = appendFeedEntries(
        working,
        completingCamps.map((p) =>
          createFeedEntry(
            working.clock,
            'camp',
            feedMessages.campCompleted(p.name, campProgramDisplayName(p.campStatus.programId))
          )
        )
      );
    }

    if (working.season.phase === 'regular' && working.clock >= working.season.nextGameAtClock) {
      working = resolveGameSlot(working, modifiers);
    }
    if (working.season.phase === 'playoffs' && working.season.playoffs && working.clock >= working.season.playoffs.nextRoundAtClock) {
      working = resolvePlayoffRound(working, computeModifiers(working));
    }
    if (working.season.phase === 'offseason') {
      working = runOffseasonTransition(working, computeModifiers(working));
    }

    working = updatePeakRating(working);
  }

  return working;
}

module.exports = { advance, getTeamStrength };
