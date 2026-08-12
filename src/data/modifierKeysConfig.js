// The vocabulary of engine/modifiers.js: every additive bonus key the game recognises, and
// the [floor, ceiling] each one's final `1 + bonusSum` multiplier is clamped to.
//
// This lived inside engine/modifiers.js until a second *seller* of bonuses appeared. Acts,
// eras, perks and powerups are all read BY modifiers, so modifiers could own the list; the
// caps shop (engine/capsShop.js) instead needs to validate an upgrade's key BEFORE selling it,
// which made engine/capsShop.js require engine/modifiers.js while modifiers required capsShop
// back. Extracting the table breaks that cycle and puts the tuning where the house rule says
// tuning goes. engine/modifiers.js re-exports BONUS_KEYS, so every existing importer is
// unaffected.
const BONUS_KEYS = [
  'revenueMult',
  'attendanceMult',
  'strengthMult',
  'campSpeedMult',
  'rookieQualityMult',
  'upgradeCostMult',
  'aiStrengthMult',
  // How fast the simulation runs: the wait between games, and the on-field replay sized from
  // it (engine/pacing.js). Higher is faster, so it DIVIDES a duration rather than multiplying
  // it — the only key here that does, which is why every consumer goes through pacing.js
  // instead of applying it by hand.
  'gameSpeedMult',
];

// [floor, ceiling] applied to the final (1 + bonusSum) multiplier for each key.
const CLAMPS = {
  revenueMult: [0.2, 5],
  attendanceMult: [0.2, 3],
  strengthMult: [0.3, 3],
  campSpeedMult: [0.3, 5],
  rookieQualityMult: [0.5, 3],
  upgradeCostMult: [0.3, 2],
  aiStrengthMult: [0.5, 4],
  // Floored at 1: nothing in the game sells a SLOWER simulation, and a bug that produced a
  // negative bonus would otherwise stretch a 24-game season into an unplayable crawl rather
  // than merely failing to speed it up. Ceilinged at 2 because past that the box scores stop
  // being readable — see the pace ladder's comment in data/capsShopConfig.js, which is
  // authored to reach 1.75 at most and so never touches this clamp on its own.
  gameSpeedMult: [1, 2],
};

module.exports = { BONUS_KEYS, CLAMPS };
