const balanceConfig = require('../data/balanceConfig');

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
    hasWonLeagueThisRun: false,
  };
}

module.exports = { createInitialState };
