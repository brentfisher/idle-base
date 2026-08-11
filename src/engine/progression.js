const { ACTS, FINAL_ACT_INDEX, getActConfig } = require('../data/acts');
const { STARTER_KIT_ITEMS } = require('../data/actOneConfig');
const { isCrewAssembled } = require('./wallBall');
const {
  LITTLE_LEAGUE_ACT_INDEX,
  openLittleLeague,
  repairMissingSeason,
  hasWonLittleLeagueTitle,
} = require('./littleLeague');
const { CHALLENGERS, REPUTATION_PER_RESPECT } = require('../data/wallBallConfig');

// Which features are unlocked is DERIVED from the act index on every read and is never stored.
// That makes it self-healing: retuning which act unlocks a feature takes effect immediately on
// an existing save with no migration. Only *intra-act* triggers are persisted, in
// `progression.milestones`, alongside presentation state (`seenTabs`, `storyBeatsSeen`).
function getUnlockedFeatures(actIndex) {
  const current = getActConfig(actIndex);
  const features = [];
  for (let i = 0; i <= current.id; i += 1) {
    ACTS[i].unlocks.forEach((feature) => {
      if (!features.includes(feature)) features.push(feature);
    });
  }
  return features;
}

// Exit predicates live here, not in data/acts.js, because src/data/ is config with no logic.
// An act's story registers its real predicate under the `exit.id` its act declares; until then
// the default below reads a boolean of the same name out of `progression.milestones`, which is
// where intra-act triggers are stored anyway. Predicates must be pure reads of `state`.
// Each act's implementing story registers its exit predicate here. acts.js only NAMES the
// condition (Decision 3); the engine owns how it is evaluated. Anything unregistered falls
// back to progression.milestones[id] in isExitSatisfied().
const EXIT_PREDICATES = {
  // Act I: derived from what the player actually owns rather than a stored milestone, so it
  // cannot drift from the inventory that produced it.
  starterKitOwned: (state) => !!state.lot && state.lot.starterKit.length >= STARTER_KIT_ITEMS.length,
  // Act II: five wall-ball wins AND a crew of three. Both halves read what the player can
  // see (the wins counter, the crew that turned up) rather than a stored milestone.
  crewAssembled: (state) => isCrewAssembled(state),
  // Act III: finished first in a little-league season. Read from the season recap rather than
  // from standings, which the offseason transition has already reset by the time this runs.
  littleLeagueTitleWon: (state) => hasWonLittleLeagueTitle(state),
};

function isExitSatisfied(state, act) {
  if (!act.exit) return false;
  const predicate = EXIT_PREDICATES[act.exit.id];
  if (predicate) return !!predicate(state);
  return !!state.progression.milestones[act.exit.id];
}

// Initializers create the content their act owns — entering Act III is what first calls
// generateSeasonSchedule(), entering Act V is what first creates state.stadium. Each act's
// implementing story adds its own entry; only the Act VI rule below belongs to this story.
const ACT_INITIALIZERS = {
  // Entering Act II opens the wall: someone is waiting, and the first challenge is available
  // immediately rather than one cooldown after the act begins.
  1: function openTheWall(state) {
    const wallBall = state.wallBall || {};
    return {
      ...state,
      wallBall: {
        wins: 0,
        losses: 0,
        respect: 0,
        lastResult: null,
        ...wallBall,
        challengerId: wallBall.challengerId || CHALLENGERS[0].id,
        nextChallengeAtClock: state.clock,
      },
      crew: state.crew || [],
    };
  },

  // Entering Act III does two things, in this order.
  //
  // First it spends Act II's Respect: it becomes state.reputation, the currency the franchise
  // game already runs on. Zeroed as it converts, so the same Respect cannot be banked twice —
  // and because the odyssey is played once per save and prestige resets to the final act
  // (engine/prestige.js), this runs exactly once per run.
  //
  // Then it opens the little league, which is what promotes the crew out of state.crew into a
  // real roster and creates state.season. That second half is the boundary the whole odyssey
  // was waiting on: until a season exists, AppShell renders no franchise UI at all.
  //
  // Guarded on `state.season` being absent so that re-entering the act — a replayed action, a
  // future initializer rerun — cannot blow away a season in progress and its standings with it.
  [LITTLE_LEAGUE_ACT_INDEX]: function openLittleLeagueSeason(state) {
    const respect = (state.wallBall && state.wallBall.respect) || 0;
    const banked =
      respect > 0
        ? {
            ...state,
            reputation: state.reputation + respect * REPUTATION_PER_RESPECT,
            wallBall: { ...state.wallBall, respect: 0, reputationBanked: respect * REPUTATION_PER_RESPECT },
          }
        : state;

    return banked.season ? banked : openLittleLeague(banked);
  },

  // Entering the final act zeroes runStats. addRevenue() accumulates totalRevenue and
  // calculateLegacyPoints() divides it by 100,000, so without this the entire odyssey's
  // earnings would inflate the very first legacy payout exactly once.
  [FINAL_ACT_INDEX]: function zeroRunStatsForFinalAct(state) {
    return {
      ...state,
      prestige: {
        ...state.prestige,
        runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0 },
      },
    };
  },
};

function enterAct(state, actIndex) {
  const act = getActConfig(actIndex);
  const entered = {
    ...state,
    progression: { ...state.progression, act: act.id, actEnteredAtClock: state.clock },
  };
  const initializer = ACT_INITIALIZERS[act.id];
  return initializer ? initializer(entered) : entered;
}

// Called from advance() once per loop iteration, so transitions fire during offline catch-up
// exactly as they do live.
//
// This loops rather than advancing a single act, and that is load-bearing: with no discrete
// event pending, findNextEventClock() returns Infinity and advance() consumes an entire 8-hour
// catch-up in ONE iteration — so it calls this exactly once. A player who was two exit
// conditions past the boundary would otherwise be stranded mid-odyssey. Bounded by the number
// of acts, and Act VI declares no exit, so this can never run past the final act.
function checkActTransition(state) {
  // Tolerate a save written before the progression slice existed rather than throwing.
  if (!state.progression) return state;

  // Before checking whether the act can be *left*, make sure it was properly entered. A save
  // that crossed a boundary before that act had an initializer is missing the content the act
  // owns, and no amount of playing will produce it. See engine/littleLeague.js.
  let working = repairMissingSeason(state);
  let steps = 0;
  while (working.progression.act < FINAL_ACT_INDEX && steps < FINAL_ACT_INDEX) {
    steps += 1;
    const act = getActConfig(working.progression.act);
    if (!isExitSatisfied(working, act)) break;
    working = enterAct(working, working.progression.act + 1);
  }
  return working;
}

module.exports = {
  getActConfig,
  getUnlockedFeatures,
  checkActTransition,
  enterAct,
  EXIT_PREDICATES,
  FINAL_ACT_INDEX,
};
