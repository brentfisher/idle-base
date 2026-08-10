const { ACTS, FINAL_ACT_INDEX, getActConfig } = require('../data/acts');

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
const EXIT_PREDICATES = {};

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

  let working = state;
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
