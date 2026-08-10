// The act progression engine. Pure: no React, no DOM.
//
// Locked content does not exist, it is not merely hidden (design.md Decision 2). A fresh
// game constructs only what Act I needs; entering an act is the initializer boundary for
// that act's content. Tick-loop collections (roster, powerups, prestige.runStats) are
// present-and-empty from t=0 so advance() never has to guard them.
//
// checkActTransition() is called from advance() once per loop iteration, so transitions
// also fire correctly during offline catch-up.

const balanceConfig = require('../data/balanceConfig');
const { getActConfig, ACTS, FINAL_ACT_INDEX } = require('../data/acts');
const { createStartingRoster } = require('./playerFactory');
const {
  createLeagueTeams,
  resetStandings,
  generateSeasonSchedule,
  buildTradeWindows,
} = require('./schedule');

// Caps and coins are never deleted from state; they convert at a documented rate and are
// retired from the header. See PRD §4, "Currency progression".
const CAPS_TO_COINS = 0.1;
const RESPECT_TO_REPUTATION = 1;

function getUnlockedFeatures(actIndex) {
  const unlocked = [];
  for (let i = 0; i <= Math.min(actIndex, FINAL_ACT_INDEX); i += 1) {
    ACTS[i].unlocks.forEach((feature) => {
      if (!unlocked.includes(feature)) unlocked.push(feature);
    });
  }
  return unlocked;
}

function isFeatureUnlocked(state, feature) {
  return getUnlockedFeatures(state.progression.act).includes(feature);
}

// balanceConfig <- act.rules. (era.rules layers on top of this in engine/modifiers.js;
// distinguishing "not overridden" from "overridden to 0" is why this uses `in` rather
// than the `||` fallback idiom that treats a legitimate 0 as absent.)
function resolveActRules(state) {
  const act = getActConfig(state.progression.act);
  const resolved = { ...balanceConfig };
  Object.keys(act.rules || {}).forEach((key) => {
    resolved[key] = act.rules[key];
  });
  return resolved;
}

// --- Per-act initializers -------------------------------------------------------------
// Each act's implementing story owns creating its own content fields. Everything below
// beyond Act II is the minimum needed for the boundary not to dereference null.

function initWallBall(state) {
  if (state.wallBall) return state;
  return {
    ...state,
    wallBall: {
      wins: 0,
      losses: 0,
      attempts: 0,
      respect: 0,
      nextChallengeAtClock: 0,
      lastResult: null,
      history: [],
    },
  };
}

function initLittleLeague(state) {
  const rules = resolveActRules({ ...state, progression: { ...state.progression, act: 2 } });
  const leagueTeams = createLeagueTeams(rules.leagueTeamCount - 1);
  const standings = resetStandings(leagueTeams);
  const schedule = generateSeasonSchedule(leagueTeams, rules.gamesPerSeason);
  const tradeWindows = buildTradeWindows(rules.gamesPerSeason).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  // The crew you built in Act II is the bench of your first organized team — the payoff
  // for the roster-shaped mechanic three acts before RosterPanel appears.
  const promotedCrew = state.crew.map((member) => ({
    ...member,
    isStarter: false,
    simplified: false,
    acquiredVia: 'crew',
  }));
  const roster = state.roster.length > 0 ? state.roster : [...createStartingRoster(), ...promotedCrew];

  const respect = state.wallBall ? state.wallBall.respect : 0;

  return {
    ...state,
    roster,
    reputation: state.reputation + respect * RESPECT_TO_REPUTATION,
    wallet: {
      ...state.wallet,
      caps: 0,
      coins: state.wallet.coins + Math.floor(state.wallet.caps * CAPS_TO_COINS),
    },
    league: { teams: leagueTeams },
    season: {
      seasonNumber: 1,
      phase: 'regular',
      gamesPerSeason: rules.gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      secondsPerGame: rules.secondsPerGame,
      nextGameAtClock: state.clock + rules.secondsPerGame,
      standings,
      tradeWindows,
      playoffs: null,
      offseasonSummaryPending: false,
      lastOffseasonSummary: null,
    },
  };
}

function initStadium(state) {
  if (state.stadium) return state;
  return {
    ...state,
    stadium: {
      level: 1,
      capacity: balanceConfig.startingCapacity,
      ticketPrice: balanceConfig.startingTicketPrice,
    },
  };
}

// Entering the final act zeroes runStats: calculateLegacyPoints() divides totalRevenue by
// 100,000, and without this the whole odyssey's earnings inflate the first prestige payout
// exactly once (design.md Decision 4).
function initBigLeagues(state) {
  return {
    ...state,
    prestige: {
      ...state.prestige,
      runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0 },
    },
  };
}

const ACT_INITIALIZERS = {
  1: initWallBall,
  2: initLittleLeague,
  4: initStadium,
  5: initBigLeagues,
};

function enterAct(state, actIndex) {
  const target = Math.max(0, Math.min(actIndex, FINAL_ACT_INDEX));
  let working = state;
  // Run every initializer between here and there so a multi-act jump (prestige resets to
  // the final-act floor) never leaves a content field unconstructed.
  for (let i = working.progression.act + 1; i <= target; i += 1) {
    const init = ACT_INITIALIZERS[i];
    if (init) working = init(working);
  }
  return {
    ...working,
    progression: {
      ...working.progression,
      act: target,
      actEnteredAtClock: working.clock,
    },
  };
}

// Evaluates the current act's exit predicate; advances at most one act per call.
function checkActTransition(state) {
  if (state.progression.act >= FINAL_ACT_INDEX) return state;
  const act = getActConfig(state.progression.act);
  if (!act.exit || !act.exit.isMet(state)) return state;
  return enterAct(state, state.progression.act + 1);
}

module.exports = {
  getActConfig,
  getUnlockedFeatures,
  isFeatureUnlocked,
  resolveActRules,
  checkActTransition,
  enterAct,
  CAPS_TO_COINS,
  RESPECT_TO_REPUTATION,
};
