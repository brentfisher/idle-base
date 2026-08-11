const balanceConfig = require('../data/balanceConfig');
const { CHALLENGERS } = require('../data/wallBallConfig');

// A fresh game constructs only what Act I needs. Act transitions are the initializer boundary:
// entering Act III is what first calls generateSeasonSchedule(), entering Act V is what first
// creates the stadium (see engine/progression.js).
//
// The split below is deliberate and is not the same rule twice:
//   * Player-visible CONTENT is `null` until its act creates it — `stadium`, `league`, `season`
//     (and `season.playoffs` with it). Components must treat these as absent, not as zero.
//   * Tick-loop COLLECTIONS are present-and-empty from t=0 — `roster`, `powerups`,
//     `prestige.runStats`. advance() dereferences all three unconditionally on every iteration;
//     iterating an empty array is free and correct, whereas guarding every call site is neither.
function createInitialState() {
  const now = Date.now();

  return {
    clock: 0,
    meta: { version: 2, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },
    wallet: { caps: 0, coins: 0, cash: balanceConfig.startingCash },
    // Act I state: the manual click, its owned automation, and what has been bought
    // out of the lot. `income.collectors` is what engine/income.js sums into caps.
    clicker: { totalClicks: 0, perClick: 1 },
    income: { collectors: [], sponsorships: [] },
    lot: { clickUpgrades: [], starterKit: [] },
    // Act II state. Present-and-empty from t=0 rather than null: `crew` is iterated by the
    // wallBallDues income contributor on every tick, and `wallBall` is a bag of counters
    // with no "absent" reading — a challenge not yet played is zero wins, not no wins.
    // `challengerId` is who is at the wall next; engine/wallBall.js re-picks after each rally.
    wallBall: {
      wins: 0,
      losses: 0,
      respect: 0,
      challengerId: CHALLENGERS[0].id,
      nextChallengeAtClock: 0,
      lastResult: null,
    },
    crew: [],
    // Act II shop purchases (engine/wallBallShop.js). Present-and-empty: the hands are an
    // income contributor summed every tick.
    wallBallShop: { grit: [], hands: [] },
    // Act III state: what has been bought out of the concessions shop. Present-and-empty from
    // t=0 rather than null because engine/income.js sums the stands on every tick.
    concessions: { stands: [], boosters: [], capsUpgrades: [] },
    progression: {
      act: 0,
      actEnteredAtClock: 0,
      milestones: {},
      seenTabs: [],
      storyBeatsSeen: [],
    },
    reputation: balanceConfig.startingReputation,
    stadium: null,
    roster: [],
    powerups: { active: [], purchasedPermanentIds: [] },
    league: null,
    season: null,
    prestige: {
      legacyPoints: 0,
      totalLegacyEarned: 0,
      era: 0,
      purchasedPerks: [],
      runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0 },
      // How many of this run's championships have been shown to the player via the
      // victory modal — compared against runStats.championships (see AppShell.js).
      // Sticky across season rollovers so a title won during offline catch-up can't
      // be silently overwritten by a later season's offseason summary.
      victoryAcknowledgedCount: 0,
    },
    // Capped ring buffer of narrated simulation events, appended by engine/tickEngine.js
    // via engine/feed.js, which enforces FEED_CAP on every write. Persisted with the rest of
    // state so the feed survives a reload and can act as the offline-progress summary.
    feed: [],
    hasWonLeagueThisRun: false,
  };
}

module.exports = { createInitialState };
