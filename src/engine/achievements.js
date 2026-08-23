// The achievement rules. Pure — no React, no DOM, no storage. Copy and thresholds live in
// data/achievementsConfig.js; nothing here is tunable and nothing there is a rule.
//
// ONE EVALUATION SITE, AND IT IS engine/tickEngine.js: advance() (PRD §3.4). Nothing else in the
// codebase may unlock an achievement — not an action module, not a component, not a reducer case.
// The reason is the same one the whole engine layer answers to: advance() is called identically by
// the live tick and by engine/offlineProgress.js's catch-up, so a rule that fires anywhere else
// fires for a player who stayed and not for a player who came back. A predicate in an action
// handler is a rule the tick loop cannot see.
//
// SO INSTANTS WRITE COUNTERS, NOT ACHIEVEMENTS. A resolved rally, a settled wager, a purchased
// module: each leaves a number on `state.record.counters` (engine/records.js) and the evaluator
// reads it on the next pass. That indirection is what makes every predicate below a pure function
// of state rather than a function of what just happened, and it is why an eight-hour catch-up
// unlocks exactly what eight hours of watching would have.
const { createFeedEntry, appendFeedEntries } = require('./feed');
const {
  ACHIEVEMENTS,
  getAchievement,
  achievementsCopy,
  WALL_RUNNER_STREAK,
  OWN_THE_WALL_STREAK,
  CALLED_SHOT_STREAK,
  LONG_SHOT_MULT,
  NOTEBOOK_MULT,
  SIFTER_WINDOW_SECONDS,
} = require('../data/achievementsConfig');
const { recordSlice, achievementsSlice } = require('./records');
const { CALL_UP_MILESTONE } = require('./progression');
const { OVER_THE_WALL_MILESTONE } = require('../data/actSevenConfig');
const { LITTLE_LEAGUE_ACT_INDEX } = require('./littleLeague');

function milestones(state) {
  const progression = (state && state.progression) || {};
  return progression.milestones || {};
}

// Every act the player has finished, from the record card. `record.actSeconds` only ever gains a
// key when an act is LEFT (engine/records.js), so its keys are exactly the acts cleared — which is
// a different set from "acts unlocked" and the only one `odyssey` can honestly ask about.
function clearedActs(state) {
  return Object.keys(recordSlice(state).actSeconds).map(Number);
}

// THE PREDICATES. Each is a pure function of state and each answers only "is this true NOW" — none
// of them knows or cares whether it has already been unlocked, because dedupe is grantAchievements'
// job and doing it in two places is how the two disagree.
const PREDICATES = {
  // Act I. The first thing in the game that earns while the player is not touching it.
  'first-collector': (state) => (((state.income || {}).collectors) || []).length >= 1,

  // Act II, and PRD §5.1 records why these three are keyed there rather than at Act I: Act I is one
  // button and a shop, so wall ball is the first thing in the game that can be WON. All three read
  // the same counters at different thresholds — adding a streak achievement is a config row.
  'wall-runner': (state) => recordSlice(state).counters.bestWallBallStreak >= WALL_RUNNER_STREAK,
  'own-the-wall': (state) => recordSlice(state).counters.bestWallBallStreak >= OWN_THE_WALL_STREAK,
  // Keyed on the APPROACH ID rather than on the payout multiplier (engine/wallBall.js writes it),
  // because Showboat's `payoutMult: 3` collides with the Bookie's `long-shot` threshold and the two
  // are different systems entirely. See PRD §5.4.
  'called-shot': (state) => recordSlice(state).counters.bestShowboatStreak >= CALLED_SHOT_STREAK,

  // Act IV. Both read a multiplier that was frozen onto the wager at PLACEMENT and is only ever
  // written to a counter on a WIN — engine/bookie.js does the writing, so a losing wager at any
  // multiplier leaves both of these exactly where they were.
  'long-shot': (state) => recordSlice(state).counters.bestBookiePayoutMult >= LONG_SHOT_MULT,
  'notebook': (state) => recordSlice(state).counters.bestPropPayoutMult >= NOTEBOOK_MULT,

  // Act III. Counted at the offseason rollover, which is the last moment the season's standings
  // exist to be read.
  'undefeated': (state) => recordSlice(state).counters.undefeatedSeasons >= 1,

  // Acts V and VI, read straight off the milestones the exits already set. No new state: a
  // milestone IS the record that it happened, and duplicating it into a counter would give the
  // same fact two homes and eventually two answers.
  'pennant': (state) => !!milestones(state).minorsPennantWon,
  'call-up': (state) => !!milestones(state)[CALL_UP_MILESTONE],

  // Act VII's opening, and it is a TIME rather than a press count. PRD §5.2 forbids counting raw
  // presses: the act declares no `clickCooldownSeconds` (data/acts.js), so a press count is bounded
  // by thumb speed and any threshold set against it is either trivial or a wrist injury. What a
  // press count was reaching for — "did you actually work the opening?" — is measured directly by
  // how long the first module took, and a player who waits for the act to happen to them misses it.
  //
  // `firstModuleAtClock` is written once, by the purchase, and is never overwritten; the subtraction
  // is against the act's own entry stamp, so it survives an offline return that crosses the window.
  'sifter': (state) => {
    const at = recordSlice(state).counters.firstModuleAtClock;
    if (!(at > 0)) return false;
    const enteredAt = ((state && state.progression) || {}).actEnteredAtClock;
    if (typeof enteredAt !== 'number' || !Number.isFinite(enteredAt)) return false;
    return at - enteredAt <= SIFTER_WINDOW_SECONDS;
  },

  // The win. `overTheWall` is the fifth burn's milestone (data/actSevenConfig.js).
  'fifth-burn': (state) => !!milestones(state)[OVER_THE_WALL_MILESTONE],

  // Every act cleared in ONE run. Acts 0-5 have to have been left — which is what puts a key in
  // `actSeconds` — and Act VII has to have been won, because it is terminal and is therefore never
  // "left" at all. Asking for a seventh key would be asking for something the game cannot produce.
  'odyssey': (state) => {
    if (!milestones(state)[OVER_THE_WALL_MILESTONE]) return false;
    const cleared = clearedActs(state);
    for (let act = 0; act <= 5; act += 1) {
      if (cleared.indexOf(act) === -1) return false;
    }
    return true;
  },

  // A state the game cannot produce (PRD §5.3). engine/records.js counts them; this only reads.
  'cheater': (state) => recordSlice(state).counters.integrityViolations > 0,
};

// Which ids are satisfied but not yet earned THIS RUN. Pure, and the only function advance() calls.
//
// DEDUPED AGAINST THE RUN'S SET AND NOT THE CAREER'S, which is PRD §3.8's rule and matters more
// than it looks: the career set (persistence/recordsStore.js) keeps everything forever, so deduping
// against it would mean a second run scores zero achievement points and §6's run-scoped submitted
// score would quietly do nothing. An achievement already collected can be earned again in a new
// run; it simply does not appear in the collection twice.
//
// A predicate that throws would take the tick loop down with it, so each is guarded: an achievement
// is a footnote, and no footnote may stop the simulation.
function evaluateAchievements(state) {
  const earned = achievementsSlice(state).earned;
  const unlocked = [];
  ACHIEVEMENTS.forEach((achievement) => {
    if (earned.indexOf(achievement.id) !== -1) return;
    const predicate = PREDICATES[achievement.id];
    if (!predicate) return;
    let satisfied = false;
    try {
      satisfied = !!predicate(state);
    } catch (err) {
      satisfied = false;
    }
    if (satisfied) unlocked.push(achievement.id);
  });
  return unlocked;
}

// Apply what evaluateAchievements() found: onto the run's set, and one line each into the feed.
// Separated from the predicate pass so that advance() reads as one statement and so the pure half
// stays trivially drivable from a harness.
//
// THE FEED IS THE WHOLE NOTIFICATION DESIGN (PRD §7.3). No modal, no toast, no banner: an unlock
// lands mid-rally often enough that interrupting the thing being rewarded is the one way to make it
// feel worse. `appendFeedEntries` enforces FEED_CAP on every write, so a catch-up that unlocks six
// at once cannot outgrow the buffer.
//
// Returns state BY IDENTITY when nothing unlocked, which is every tick but a handful in a whole
// run — advance() calls this on each iteration of an eight-hour catch-up.
function grantAchievements(state, unlockedIds) {
  if (!unlockedIds || unlockedIds.length === 0) return state;
  const slice = achievementsSlice(state);
  const entries = unlockedIds.map((id) => {
    const achievement = getAchievement(id);
    return createFeedEntry(
      state.clock || 0,
      'achievement',
      achievementsCopy.unlocked(achievement ? achievement.name : id)
    );
  });
  return appendFeedEntries(
    {
      ...state,
      achievements: { ...slice, earned: [...slice.earned, ...unlockedIds] },
    },
    entries
  );
}

module.exports = { evaluateAchievements, grantAchievements, PREDICATES };
