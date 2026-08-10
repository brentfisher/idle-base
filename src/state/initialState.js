// A fresh game starts in Act I, behind the hardware store, with nothing but a patch of dirt.
//
// Locked content does not exist yet — it is not merely hidden (odyssey design doc,
// Decision 2). Player-visible content (`stadium`, `league`, `season`) is null until the act
// that introduces it runs its initializer; tick-loop collections (`roster`, `powerups`,
// `prestige.runStats`) are present-and-empty from t=0 so advance() can iterate them freely
// without a guard at every call site.
function createInitialState() {
  const now = Date.now();

  return {
    clock: 0,
    meta: { version: 2, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },

    wallet: { caps: 0, coins: 0, cash: 0 },
    // SCAFFOLDING: the legacy single-currency field. STORY-001 migrates state.cash into
    // state.wallet.cash and deletes this; until then everything downstream of Act V still
    // reads state.cash, so income keeps landing there rather than being double-counted.
    cash: 0,
    reputation: 0,

    clicker: { totalClicks: 0, perClick: 1 },
    income: { collectors: [], sponsorships: [] },
    lot: { clickUpgrades: [], starterKit: [] },
    progression: {
      act: 0,
      actEnteredAtClock: 0,
      milestones: {},
      seenTabs: [],
      storyBeatsSeen: [],
    },

    stadium: null,
    league: null,
    season: null,

    roster: [],
    powerups: { active: [], purchasedPermanentIds: [] },
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
