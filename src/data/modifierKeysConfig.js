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
  // ---------------------------------------------------------------------------------------
  // ACT VII (PRD §5.9). These six were declared in data/actSevenConfig.js and read defensively
  // by engine/colony.js and engine/income.js BEFORE they were registered here, precisely so
  // that registering them is this one edit. Until this line existed computeModifiers() did not
  // emit them, every read landed on its `1` default, and the colony solved as if they were not
  // there — the silent-inertness this list's whole contract is about (conventions.md, and
  // Act IV's rookieQualityMult, which shipped dead for exactly that reason).
  //
  // DIRECTION, STATED ONCE FOR ALL SIX, because gameSpeedMult above is the standing proof that
  // a modifier's direction is not inferable from its name and that nothing in the build catches
  // getting it backwards:
  //
  //   * The five *OutputMult keys MULTIPLY A RATE. Higher is better. A bonus of +0.25 means
  //     1.25x the output. They are applied to gross production BEFORE the satisfaction solve
  //     (engine/colony.js: grossProduction) so that a Power powerup raises the ration and
  //     un-throttles the whole colony, rather than merely making a starved colony's Power
  //     number bigger.
  //
  //   * lifeSupportDrawMult MULTIPLIES A DEMAND, and it is a REDUCTION. LOWER is better, so the
  //     powerups that sell it carry NEGATIVE bonus values (-0.12 means 0.88x draw). It is the
  //     only key in this table whose sold values are negative and whose clamp window sits
  //     entirely at or below 1. Get its sign backwards and you ship a "powerup" that starves the
  //     colony: draw goes up, satisfaction falls, every producer throttles, and the Salvage
  //     income the player just spent 90,000 on drops. Nothing in `npm run build` would notice.
  'powerOutputMult',
  'oxygenOutputMult',
  'provisionsOutputMult',
  'fuelOutputMult',
  'salvageOutputMult',
  'lifeSupportDrawMult',
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

  // ACT VII (PRD §5.9). FLOORED AT 1, on gameSpeedMult's reasoning verbatim: nothing in the game
  // sells a WORSE generator, and a sign bug producing a negative bonus would turn a setback into a
  // spiral in the one act where a spiral has a fixed point at zero. A starved colony throttles its
  // producers, which lowers output, which starves it further — the floor is what makes that
  // impossible to enter from the modifier side.
  //
  // Ceilinged at 4 because the satisfaction solve is only interesting while supply is scarce. Past
  // 4x output the interlock stops binding and the act becomes an accumulation curve, which is the
  // thing §5's whole design is arranged to avoid.
  powerOutputMult: [1, 4],
  oxygenOutputMult: [1, 4],
  provisionsOutputMult: [1, 4],
  fuelOutputMult: [1, 4],

  // 6 rather than 4, and the exception is deliberate: §8's hint ladder is the act's ELASTIC SINK
  // (ledger R6) and needs somewhere to run. Salvage is the only rate whose surplus has a designed
  // destination, so it is the only one given extra ceiling.
  salvageOutputMult: [1, 6],

  // THE ONLY KEY IN THIS TABLE THAT IS A REDUCTION, and the only one whose clamp window sits at or
  // below 1. LOWER IS BETTER: it multiplies demand, so the powerups selling it carry NEGATIVE
  // bonus values (-0.12 means 0.88x draw).
  //
  // Get the sign backwards and you ship a "powerup" that starves the colony — draw rises,
  // satisfaction falls, every producer throttles, and the Salvage income the player just spent
  // 90,000 on drops. `npm run build` would not notice, and neither would a reader who assumed the
  // direction from the name. gameSpeedMult above is the standing proof that direction is not
  // inferable from a name in this codebase.
  //
  // Ceilinged at 1 for the mirror of the floor-at-1 argument: nothing sells a colony that eats
  // more. Floored at 0.4 to leave room for the two permanents the act sells plus a third it does
  // not yet — a floor reached by the shipped catalogue is a floor that silently caps content.
  lifeSupportDrawMult: [0.4, 1],
};

module.exports = { BONUS_KEYS, CLAMPS };
