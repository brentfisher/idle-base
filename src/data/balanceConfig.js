// Base tunables for a fresh run. Eras (data/eras.js) may override any of these.
module.exports = {
  leagueTeamCount: 12, // player + 11 AI
  gamesPerSeason: 33, // 11 opponents x 3 games
  secondsPerGame: 60, // simulated seconds per regular-season game slot
  // Strength range new AI teams are rolled in. An act may override it, and Act III must:
  // little-league kids rate ~25 overall, and against the default band they would win about 2%
  // of games at eloK 15 — an act whose exit is "finish first" that cannot be finished.
  aiTeamStrengthRange: [35, 65],
  // Fractions of the season (by games played) during which a trade window is open.
  // Eras may override with multiple windows (e.g. Free Agency era).
  tradeWindows: [{ openFraction: 0.5, closeFraction: 0.61 }],
  playoffTeams: 4,
  secondsPerPlayoffRound: 90,
  offlineCapSeconds: 8 * 3600,
  tickIntervalMs: 1000,
  autosaveIntervalMs: 30000,
  eloK: 15,

  startingCash: 500,
  startingReputation: 20,
  startingCapacity: 5000,
  startingTicketPrice: 10,

  fairPrice: 15, // ticket price above which attendance starts to suffer
  baseSaleRatePerSecond: 0.0006, // tuned in Phase 7 playtesting

  retireAtSeasonsRange: [8, 14],
  rookieAgeRange: [20, 22],
  campSlots: 1,

  safetyCapIterations: 2000,

  stadiumUpgradeBaseCost: 2000,
  stadiumUpgradeCostGrowth: 1.6,
  stadiumUpgradeCapacityStep: 1500,

  statUpgradeBaseCost: 150,
  statUpgradeCostGrowth: 1.22,
  statUpgradeAmount: 2,
  statCap: 100,
};
