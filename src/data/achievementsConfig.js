// The thirteen achievements: their copy, their points, and the thresholds their predicates test
// against. No logic — engine/achievements.js owns every rule, and the split is the same one every
// other config in this directory keeps (conventions: magic numbers in src/data/, rules in
// src/engine/).
//
// POINTS ARE FLAT AND INDEPENDENT OF TIME, which is what stops the score from being a pure
// speedrun (PRD §6): `called-shot` and `notebook` reward taking the greedy line, and the greedy
// line costs time. The two halves of the score are meant to pull against each other.
//
// Nothing here pays out. An achievement is a record, not a currency (PRD §8) — the moment one
// grants Salvage or caps, the evaluator becomes balance-critical and every predicate becomes an
// exploit surface.

// The streak thresholds. Three, ten and three: `wall-runner` is the one the player trips over on
// the way through Act II, `own-the-wall` is the one they have to want, and `called-shot` is
// `wall-runner`'s length at the approach that loses 35-41% of the time.
const WALL_RUNNER_STREAK = 3;
const OWN_THE_WALL_STREAK = 10;
const CALLED_SHOT_STREAK = 3;

// The odds thresholds, tested against the `payoutMult` engine/bookie.js FROZE onto the wager at
// placement. Implied probability is 1/mult before the house edge, so 3.0x is roughly a 1-in-3 shot
// and 5.0x a 1-in-5.
//
// TWO NUMBERS AND NOT ONE, because the moneyline and the prop board draw from different ranges.
// propPayoutMultFor() quotes a much wider spread than payoutMultFor() does, so a single threshold
// set for the moneyline would be farmable off the other page in an afternoon — which is exactly
// what PRD §5.4 says these must not share.
const LONG_SHOT_MULT = 3.0;
const NOTEBOOK_MULT = 5.0;

// `sifter`'s window, in seconds from entering Act VII. See the predicate for why this is a TIME
// and never a press count: the act declares no click cooldown (data/acts.js), so a press count
// measures thumb speed and nothing else. 40 presses fund the first Reclaimer Drone, so 60 seconds
// is about 1.5 presses a second — comfortably reachable by anyone actually pressing, and
// unreachable by a player who is waiting for the act to happen to them.
const SIFTER_WINDOW_SECONDS = 60;

const ACHIEVEMENTS = [
  {
    id: 'first-collector',
    name: 'Somebody Else’s Hands',
    description: 'Buy your first collector, and stop being the only thing earning.',
    points: 5,
  },
  {
    id: 'wall-runner',
    name: 'Three Straight',
    description: 'Win three wall-ball challenges in a row.',
    points: 15,
  },
  {
    id: 'own-the-wall',
    name: 'Nobody Else Gets a Turn',
    description: 'Win ten in a row. The line stops forming.',
    points: 40,
  },
  {
    id: 'called-shot',
    name: 'Called It',
    description: 'Win three in a row showboating, where the odds are worst and the crowd is loudest.',
    points: 35,
  },
  {
    id: 'long-shot',
    name: 'The Long Shot',
    description: 'Collect on a moneyline nobody else would have written down.',
    points: 30,
  },
  {
    id: 'notebook',
    name: 'The Other Page',
    description: 'Take the Bookie’s prop board for a number he did not expect to pay.',
    points: 35,
  },
  {
    id: 'undefeated',
    name: 'Nobody Beat Us',
    description: 'Finish a Little League season without losing a game.',
    points: 25,
  },
  {
    id: 'pennant',
    name: 'The Pennant',
    description: 'Finish first in the minors and take the pennant.',
    points: 20,
  },
  {
    id: 'call-up',
    name: 'You Said Yes',
    description: 'Accept the call-up, knowing it was one-way.',
    points: 20,
  },
  {
    id: 'sifter',
    name: 'Hands in the Wreck',
    description: 'Fund the first Reclaimer Drone inside a minute of the wreck going quiet.',
    points: 15,
  },
  {
    id: 'fifth-burn',
    name: 'The Fifth Burn',
    description: 'Commit the fifth burn. Go over the wall.',
    points: 60,
  },
  {
    id: 'odyssey',
    name: 'The Whole Way',
    description: 'Clear all seven acts in a single run, from the vacant lot to the far side.',
    points: 80,
  },
  {
    // WORTH ZERO, AND IT TAKES NOTHING AWAY (PRD §5.3). No currency is removed, no run is deleted,
    // no score is zeroed, and the run is still submittable. Punishing an edited save is
    // unenforceable — the client is the player's own machine — and pretending otherwise starts an
    // arms race the game cannot win. What this does instead is make it VISIBLE, on a board that
    // already says it is not a verified ranking.
    id: 'cheater',
    name: 'Nice Try',
    description: 'Reach a state the game cannot produce. No hard feelings; the wall remembers.',
    points: 0,
  },
];

const ACHIEVEMENTS_BY_ID = ACHIEVEMENTS.reduce((map, achievement) => {
  map[achievement.id] = achievement;
  return map;
}, {});

function getAchievement(id) {
  return ACHIEVEMENTS_BY_ID[id] || null;
}

// The feed line. One sentence, the name in it, and nothing about points — the Records tab is where
// a total belongs, and a feed entry that reads like a scoreboard update stops reading like a story.
const achievementsCopy = {
  unlocked: (name) => `${name} — one for the record.`,
};

module.exports = {
  ACHIEVEMENTS,
  getAchievement,
  achievementsCopy,
  WALL_RUNNER_STREAK,
  OWN_THE_WALL_STREAK,
  CALLED_SHOT_STREAK,
  LONG_SHOT_MULT,
  NOTEBOOK_MULT,
  SIFTER_WINDOW_SECONDS,
};
