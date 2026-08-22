const balanceConfig = require('../data/balanceConfig');
const { CHALLENGERS } = require('../data/wallBallConfig');
const { INITIAL_PHASE, EXPEDITION_RESOURCES } = require('../data/actSevenConfig');
const { createContractBoard } = require('../data/actSevenContractsConfig');

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
// Built from data/actSevenConfig.js rather than written out here, because engine/colony.js's
// expeditionSlice() has to produce the identical shape for the saves that predate the slice. Two
// hand-written copies of one shape drift, and drift in a slice accessor deletes player data — see
// the note at the top of actSevenConfig.js.
function createExpeditionResources() {
  return EXPEDITION_RESOURCES.reduce((resources, resource) => {
    resources[resource.id] = { amount: 0, capacity: resource.baseCapacity };
    return resources;
  }, {});
}

function createInitialState() {
  const now = Date.now();

  return {
    clock: 0,
    meta: { version: 2, createdAt: now, lastSaveTimestamp: now, lastTickTimestamp: now },
    // `salvage` is Act VII's currency and is zero for the whole game before it. It is declared here
    // anyway rather than sprung into existence by the first credit, so the wallet's shape is one
    // fact in one place. Adding it did NOT bump meta.version: a save written before it exists has
    // no `salvage` key, engine/wallet.js's balanceOf() reads an absent key as 0, and the save loads
    // and plays exactly as before. That is the whole reason a fourth currency is not a migration.
    wallet: { caps: 0, coins: 0, cash: balanceConfig.startingCash, salvage: 0 },
    // Act I state: the manual click, its owned automation, and what has been bought
    // out of the lot. `income.collectors` is what engine/income.js sums into caps.
    // `nextClickAtClock` is the click cooldown, in the same clock units as
    // wallBall.nextChallengeAtClock. Zero means "ready now", which is also what an old save
    // that predates the field reads as — so the cooldown can never lock out a returning
    // player. Acts that declare no cooldown (data/acts.js `clickCooldownSeconds`) never
    // advance it. See engine/clicker.js.
    clicker: { totalClicks: 0, perClick: 1, nextClickAtClock: 0 },
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
    // All five arrays are declared even though engine/concessions.js defaults every one of them
    // for old saves. purchase() spreads the normalized slice, so a key that is absent HERE but
    // present in the accessor still round-trips correctly — but a reader diffing this against
    // the accessor should not have to work that out.
    concessions: { stands: [], boosters: [], capsUpgrades: [], standUpgrades: [], cashClickUpgrades: [] },
    // What the player calls their own team. `null` is not a missing value to repair — it is
    // "never named", and every reader resolves it through a defaulting accessor that returns
    // the old hardcoded 'Your Team'. So a save written before naming existed reads exactly
    // as it did before, and nothing has to migrate.
    teamName: null,
    // Act IV+ walk-up songs (engine/walkupSongs.js): the records the TEAM owns. Which kid walks
    // up to which record is stored on the player, not here — see the ownership note in that file.
    // Present-and-empty rather than null to match the other shops, but nothing depends on that:
    // walkupSlice() defaults the array, so a save written before this shipped reads as an empty
    // crate, every player's `walkupSongId` is absent and reads as no song, and every rating in
    // the game comes out bit-for-bit what it did before.
    walkup: { owned: [] },
    // Act V+ caps sink (engine/capsShop.js). Present-and-empty rather than null for the same
    // reason concessions is: its contents are summed into the modifier bundle every tick.
    capsShop: { upgrades: [] },
    // Act VII — the odyssey (docs/PRD-act-seven-farm-team.md §4). Present-and-empty, not null, and
    // this is the split above applied rather than a new rule: `modules`, `sites`, `contracts` and
    // `launches` are TICK-LOOP COLLECTIONS. Once the act ships, advance() dereferences all four on
    // every iteration — integrateColony() sums the modules' production and draw, and
    // nextColonyThresholdClock() re-solves every resource boundary — so guarding each call site
    // would be the bad half of the trade a second time.
    //
    // `phase` is present-and-'aftermath' for the reason `wallBall` is a bag of counters rather than
    // null: a phase has no "absent" reading. It is also the act's SINGLE progression signal (PRD
    // R4) — no parallel milestone flags mirror it — and it is self-healing, recomputed by
    // engine/sites.js from a pure predicate ladder, so a stale stored value repairs itself on the
    // next tick rather than stranding a save.
    //
    // The four resources are NOT currencies (see data/currencies.js): they have capacity ceilings
    // and signed net rates. Fuel starts with capacity 0 — no tank until one is built — which is a
    // real value and not a placeholder, and is why every default that reads a capacity has to
    // distinguish absent from zero.
    //
    // Every reader goes through expeditionSlice() in engine/colony.js, so a save written before
    // this shipped has no `expedition` key, reads as exactly this empty expedition, and needs no
    // migration. Adding a key here means adding it there in the same edit, for the reason
    // engine/concessions.js's accessor comment spells out.
    expedition: {
      phase: INITIAL_PHASE,
      resources: createExpeditionResources(),
      modules: [],
      sites: [],
      puzzles: {},
      contracts: [],
      // The contract board's bookkeeping (PRD §9.3). Built from the ONE literal in
      // data/actSevenContractsConfig.js rather than written out here, for the reason stated above
      // and at the top of that file: engine/colony.js's expeditionSlice() has to produce the
      // identical shape for every save that predates the slice, and a key one copy forgets is a key
      // every later write silently deletes.
      contractBoard: createContractBoard(),
      launches: [],
      // The run record the ending reads (PRD §7.8). Two counters, both starting at zero, which is
      // what they mean rather than a placeholder: a colony that has made no Fuel has a peak rate of
      // 0, and a run that has not won has filled no standing orders. The act's START clock is
      // deliberately not here — `progression.actEnteredAtClock` above already carries it.
      //
      // Adding a key here means adding it to expeditionSlice() in engine/colony.js in the same
      // edit, for the reason the comment above spells out: a key one copy forgets is a key every
      // later write silently deletes.
      peakFuelRate: 0,
      standingOrders: 0,
    },
    // Act IV state, and both are CONTENT rather than tick-loop collections, so both are null
    // until engine/travelBall.js's initializer creates them: `travelBall` is the record the
    // act's win-rate exit accumulates into, and `bookie` is a table that does not exist until
    // somebody's uncle sets one up. Every reader of either goes through a defaulting accessor
    // (travelBallSlice, bookieSlice), so an absent slice is never a crash — which is also what
    // makes a save written before Act IV existed loadable.
    travelBall: null,
    bookie: null,
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
      // `null` rather than 0, and the distinction carries meaning: 0 would claim this run began
      // with a rating of zero, where null says nobody has looked yet. engine/tickEngine.js's
      // updatePeakRating() seeds it on first sight and is the only thing that writes it; see the
      // note there and in engine/prestige.js for what it is for.
      runStats: { championships: 0, peakOverallRating: 0, totalRevenue: 0, baselineOverallRating: null },
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
