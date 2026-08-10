// A fresh game constructs only what Act I needs (design.md Decision 2).
//
// Player-visible content is null until its act creates it: stadium, league, season.
// Tick-loop collections are present-and-empty from t=0: roster, powerups, prestige.runStats
// — iterating an empty array is free and correct; guarding every call site is neither.

function createInitialState() {
  const now = Date.now();

  return {
    clock: 0,
    meta: { version: 2, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },

    progression: { act: 0, actEnteredAtClock: 0, milestones: {}, seenTabs: [], storyBeatsSeen: [] },
    wallet: { caps: 0, coins: 0, cash: 0 },
    clicker: { totalClicks: 0, perClick: 1 },
    income: { collectors: [], sponsorships: [] },
    // Capped ring buffer of tick events; written by the live-feed story.
    feed: [],

    // Everything you own that helps you play — see data/kitConfig.js.
    kit: { ownedItemIds: [], purchasedClickUpgradeIds: [] },

    // Act II. Constructed by engine/progression.js: enterAct(state, 1).
    wallBall: null,
    crew: [],

    reputation: 0,
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
