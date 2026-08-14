const { ACTS, FINAL_ACT_INDEX, PRESTIGE_ACT_INDEX, getActConfig } = require('../data/acts');
const { STARTER_KIT_ITEMS } = require('../data/actOneConfig');
const { isCrewAssembled } = require('./wallBall');
const {
  LITTLE_LEAGUE_ACT_INDEX,
  openLittleLeague,
  repairMissingSeason,
  hasWonLittleLeagueTitle,
} = require('./littleLeague');
const {
  TRAVEL_BALL_ACT_INDEX,
  openTravelBall,
  repairTravelBall,
  hasReachedTravelWinRate,
} = require('./travelBall');
const { CHALLENGERS, REPUTATION_PER_RESPECT } = require('../data/wallBallConfig');

// Which features are unlocked is DERIVED from the act index on every read and is never stored.
// That makes it self-healing: retuning which act unlocks a feature takes effect immediately on
// an existing save with no migration. Only *intra-act* triggers are persisted, in
// `progression.milestones`, alongside presentation state (`seenTabs`, `storyBeatsSeen`).
//
// `hides` (optional, see data/acts.js) is the same thing in reverse: an act that RETIRES a
// feature. It is config resolved on read for exactly the reason above — a stored "hidden" flag
// would freeze one edit of acts.js into every existing save and need a migration to undo.
//
// Resolution is UNION-THEN-SUBTRACT, not per-act. The whole `unlocks` union for acts 0..actIndex
// is built first, and only then is every id named by any of those acts' `hides` removed. The
// consequence is the rule worth stating outright: **`hides` wins over a later `unlocks` of the
// same id.** Per-act interleaving would give the opposite — a later act's `unlocks` would
// silently resurrect what an earlier act retired.
//
// That choice is deliberate, and the reason is how these arrays are authored. Every `unlocks`
// array lists only what its act ADDS; ids are never restated, because unlocks are cumulative.
// So an id reappearing in a later act's `unlocks` after an earlier act hid it is much more
// likely two config edits colliding than an author intending to bring the feature back.
// Union-then-subtract makes that collision inert: restoring a retired feature has to be a new
// decision someone types out (drop the `hides` entry), never a side effect of edit ordering.
// The same rule settles the degenerate case of one act naming an id in both arrays — hidden.
//
// Note the subtraction reads `hides` only from acts 0..actIndex, exactly as the union does. A
// teardown authored into a late act is invisible to a player who has not reached it yet.
function getUnlockedFeatures(actIndex) {
  const current = getActConfig(actIndex);
  const features = [];
  const hidden = [];
  for (let i = 0; i <= current.id; i += 1) {
    ACTS[i].unlocks.forEach((feature) => {
      if (!features.includes(feature)) features.push(feature);
    });
    // Optional key: an act that declares no `hides` contributes nothing here, which is why
    // adding this key is a no-op for every act authored before it existed.
    (ACTS[i].hides || []).forEach((feature) => {
      if (!hidden.includes(feature)) hidden.push(feature);
    });
  }
  // filter() rather than a rebuild, so the surviving ids keep the order the union produced them
  // in — AppShell derives tab order from PANELS, but HeaderStats and the mechanic gates read
  // this array directly, and with no act declaring `hides` this must return what it always did,
  // element for element and in the same order.
  return features.filter((feature) => !hidden.includes(feature));
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
  // Act IV: the first exit in the game that is accumulated rather than achieved in a moment —
  // a 60% win rate over at least two completed travel seasons, counted from the act's own
  // record so the little-league title cannot be spent twice. See engine/travelBall.js.
  travelBallWinRateReached: (state) => hasReachedTravelWinRate(state),
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

  // Entering Act IV rebuilds the league at travel-ball scale: eight clubs, fifteen games,
  // and a fresh record for the act's win-rate exit to accumulate into.
  //
  // Note what this initializer does NOT guard on. Act III's guards on `state.season` being
  // absent, because a season is the thing it creates. By the time Act IV is entered a season
  // always exists — runOffseasonTransition() built one moments earlier, at Act III's rules —
  // so the same guard here would silently skip the entire act. It guards on the Act IV slice
  // instead, which is content only this initializer creates. See engine/travelBall.js.
  [TRAVEL_BALL_ACT_INDEX]: function openTheTravelCircuit(state) {
    return state.travelBall ? state : openTravelBall(state);
  },

  // Entering the prestige floor zeroes runStats. addRevenue() accumulates totalRevenue and
  // calculateLegacyPoints() divides it by 100,000, so without this the entire odyssey's
  // earnings would inflate the very first legacy payout exactly once.
  //
  // Keyed on PRESTIGE_ACT_INDEX rather than FINAL_ACT_INDEX, which it used to read. The two are
  // equal today so nothing moves, but they are equal by coincidence and this belongs to the
  // prestige floor, not to the end of the arc: runStats measure one prestige run, and a run
  // starts where prestige drops the player (engine/prestige.js) and is cashed out by the
  // `prestige` unlock Act VI carries. Under a seventh act, keying this on FINAL_ACT_INDEX would
  // have zeroed runStats at Act VII while prestige still returned to Act VI — so the first
  // payout after each prestige would have been inflated by everything earned in Act VI, which
  // is precisely the bug the zeroing was written to prevent.
  [PRESTIGE_ACT_INDEX]: function zeroRunStatsAtPrestigeFloor(state) {
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
// conditions past the boundary would otherwise be stranded mid-odyssey.
//
// What stops the loop is not the act count: it is that EVERY advance is player-gated. The loop
// breaks the first time isExitSatisfied() is false, and an exit is satisfied only by something
// the player did — buying the starter kit, assembling a crew, winning a title. Looping can
// therefore only ever collapse boundaries the player has *already* earned into one iteration;
// it can never hand out an act nobody paid for, however long the catch-up was. And the last
// transition is player-gated in the strongest form there is: the terminal act declares
// `exit: null`, so isExitSatisfied() returns false there structurally — because of what that
// act IS, not because of which index it sits at. That still holds when the terminal act stops
// being Act VI.
//
// `steps < FINAL_ACT_INDEX` is a belt-and-braces iteration cap, not the thing preventing
// overshoot; the previous version of this comment conflated the two. Note also that both
// FINAL_ACT_INDEX uses below are correct as FINAL_ACT_INDEX: this loop walks the authored arc
// to its end, which is a different question from where prestige drops the player
// (PRESTIGE_ACT_INDEX, used by the initializer above). Both constants now live in data/acts.js
// and they are equal today — do not let one be substituted for the other here.
function checkActTransition(state) {
  // Tolerate a save written before the progression slice existed rather than throwing.
  if (!state.progression) return state;

  // Before checking whether the act can be *left*, make sure it was properly entered. A save
  // that crossed a boundary before that act had an initializer is missing the content the act
  // owns, and no amount of playing will produce it. See engine/littleLeague.js.
  //
  // Ordered, and the order is the dependency: repairMissingSeason() builds the season Act III
  // owns, and repairTravelBall() reshapes that season to Act IV's scale. Each is keyed on its
  // own act's content being absent, so both are no-ops on a save that was never stranded.
  let working = repairTravelBall(repairMissingSeason(state));
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
