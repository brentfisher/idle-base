// Act VII's module catalogue — PRD §5.4's ladder. THE TIER-1 (`aftermath`) ROWS ONLY.
//
// The later rungs (Wreck Crawler, Fission Pile, the Mk II scrubbers, hydroponics, the Fuel chain)
// and the whole storage ladder land with the story that prices them, each carrying its own
// measurement comment. Shipping the phase that is playable rather than the table that is authored
// keeps a balance edit from arriving as an unmeasured correctness change — the argument
// data/actSevenConfig.js makes at length for shipping the consumption engine against an empty
// catalogue is the same one, one rung up.
//
// `cost(n) = baseCost x growth^n`, n = copies already owned. That is `stadiumUpgradeCostGrowth`'s
// shape in data/balanceConfig.js, deliberately, so the act's economy is priced in the vocabulary
// the rest of the game already uses.
//
// SALVAGE IS MANUFACTURED, NOT FOUND, and that is the load-bearing decision in this file. The
// Reclaimer Drone is the act's income and it is also a Power AND Provisions consumer, so buying
// one makes the next one more expensive AND raises the colony's draw. Without that second cost the
// act degenerates into "buy drones, buy everything": drones would be a pure multiplier on a
// resource nothing competes for, and the satisfaction solve engine/colony.js exists to run would
// never have anything to ration. The interlock IS the game.
//
// ---------------------------------------------------------------------------------------------
// MEASURED, under `node`, driving this config through engine/colony.js and engine/clicker.js with
// a greedy-affordable buyer at 1s resolution. These are the numbers later stories recompute
// against; §5.2's income table is authoritative (ledger R8) and this is what the ladder actually
// produces against it.
//
//   * Seconds of pure clicking to the first Reclaimer Drone: 118s. TARGET 90-130s, MET.
//     320 Salvage at a flat 8 per press on a 3s cooldown = 2.667/s, so this figure is IDENTICAL
//     for every player — which is the entire reason clickFlatValue exists (see data/acts.js and
//     the note on clickValue() in engine/clicker.js). §5.2 predicts 120s; the 2s is rounding on
//     the cooldown grid.
//
//   * Salvage/sec: 15.0/s at minute 10, 33.0/s at minute 25 (the `aftermath` exit), against
//     §5.2's authoritative 2.7 -> 26 band for the phase. The exit figure runs ~27% hot and is
//     deliberately NOT retuned down. §5.3's compulsory spend for the phase includes the storage
//     rungs and the scrubbers this story does not ship, so the simulated colony is buying strictly
//     fewer things than the budget assumes and therefore banks more. THE STORY THAT LANDS STORAGE
//     MUST RE-MEASURE rather than trust this line — ledger R8 says later stories recompute against
//     the measurement, and this measurement is of a deliberately partial ladder.
//
//   * Click share of Salvage income: 100% for the first ~2 minutes, 15.1% at minute 10, 7.5% at
//     the `aftermath` exit.
//
//     THE STORY ASKED FOR <5% AT MINUTE 10 AND THAT TARGET IS UNREACHABLE — not because the ladder
//     is mistuned, but because it contradicts §5.2, which ledger R8 makes authoritative. <5% at
//     minute 10 requires passive income above 50/s there; §5.2 puts the whole phase's EXIT rate at
//     26/s, twenty-plus minutes later. The two cannot both hold. §5.2's own prose gives the figure
//     this ladder should be judged against — the click is "~10% at that phase's exit" — and the
//     measured 7.5% at minute 25 sits just inside it. Retuning to hit <5% at minute 10 would mean
//     roughly doubling the phase's income against an authoritative table, so it was not done. The
//     shape the target was reaching for does hold: the click teaches the loop, then gets out of
//     the way, and it is never upgraded — every improvement in this act is a module.
//
//   * The `aftermath` flat point, measured as the longest gap between two Drone purchases:
//     1173s -> 1364s, i.e. 191 seconds (~3.2 min) around minute 20. It is a Power wall — the
//     Drone's 1.5 Pwr/s outruns the RTG rung, so the run stalls buying generators. The relieving
//     unlock is the RTG itself: 90 base at growth 1.18, the cheapest row on the board and the
//     shallowest exponent, so the answer to the wall is always affordable inside ~90 seconds of
//     hitting it. PRD §5.10 asks for a relieving unlock within ~5 minutes of each flat point;
//     this one is inside four.
//
// THE SABATIER SCRUBBER IS INERT IN THIS STORY, and shipping it anyway is deliberate rather than
// sloppy. Nothing in the tier-1 set consumes Oxygen — the crew draw and the Hydroponics Bay that
// eats O2 are both later rungs — so an Oxygen producer buys the player nothing today and the
// simulated buyer above never purchases one. It ships now because §5.3 lists it as compulsory
// spend for the phase and because the alternative, an Oxygen chain that appears from nowhere one
// story later, is worse. It is priced, it is visible, and it is honestly useless until Oxygen has
// a consumer. Do not "fix" it by giving it a fake benefit.
// ---------------------------------------------------------------------------------------------
//
// `producesSalvage` IS A SEPARATE KEY FROM `produces`, ON PURPOSE. Salvage is a wallet currency
// (data/currencies.js), not one of the four consumables — it is monotonic and spendable, where the
// consumables fill and drain against a ceiling. actSevenConfig.js states that separation as a rule
// and it must not be quietly broken here: putting `salvage` inside `produces` would work today
// only because engine/colony.js iterates EXPEDITION_RESOURCE_IDS and would silently ignore it, and
// would break loudly the moment anything iterated `produces` directly. A distinct key cannot be
// mistaken for a resource by any future reader.
//
// The Salvage rate is still throttled by the same satisfaction the colony solve produces — see
// colonySalvagePerSecond() in engine/colony.js. A starved drone must not pay full income; if it
// did, the Power interlock above would be decorative.
const ACT_SEVEN_MODULES = [
  // --- Salvage chain ---
  {
    id: 'reclaimerDrone',
    label: 'Reclaimer Drone',
    description: 'Picks the wreck apart on a slow orbit and brings back what it can carry.',
    phase: 'aftermath',
    baseCost: 320,
    growth: 1.34,
    producesSalvage: 3.0,
    consumes: { power: 1.5, provisions: 0.1 },
  },

  // --- Power chain ---
  // The cheapest row in the act, at the shallowest growth of the four. Both are deliberate: the
  // RTG is the answer to every flat point in `aftermath`, and an answer the player cannot afford
  // is not an answer. It consumes nothing, which is also what keeps the satisfaction solve off
  // zero — a colony whose only generator needed an input would have no fixed point above zero to
  // walk down to (engine/colony.js's note on solveSatisfaction).
  {
    id: 'rtg',
    label: 'Radiothermal Slug',
    description: 'A lump of something that was never meant to cool down. It simply works.',
    phase: 'aftermath',
    baseCost: 90,
    growth: 1.18,
    produces: { power: 3.0 },
  },

  // --- Oxygen chain ---
  {
    id: 'scrubberMkI',
    label: 'Sabatier Scrubber',
    description: 'Runs the cabin air back over a hot catalyst and gives most of the oxygen back.',
    phase: 'aftermath',
    baseCost: 120,
    growth: 1.28,
    produces: { oxygen: 0.35 },
    consumes: { power: 1.0 },
  },

  // --- Provisions chain ---
  // The other half of the drone's draw, and the reason Provisions is a real constraint in
  // `aftermath` rather than a number on a chip. At 0.25/s against a drone's 0.10/s, one printer
  // carries two and a half drones — so the ladder is Power first, then a printer, then Power
  // again, which is the rhythm §5.10 wants from the phase.
  {
    id: 'rationPrinter',
    label: 'Ration Printer',
    description: 'Extrudes something with the calories of a meal and the texture of a decision.',
    phase: 'aftermath',
    baseCost: 150,
    growth: 1.28,
    produces: { provisions: 0.25 },
    consumes: { power: 1.2 },
  },
];

// cost(n) = baseCost x growth^n, rounded. Rounded at the boundary rather than at the call site so
// every reader — the shop row, the affordability check, the debit — sees the identical integer. A
// price that is 319.9997 in one place and 320 in another is a purchase that refuses itself.
function moduleCost(definition, owned) {
  const count = Number.isFinite(owned) && owned > 0 ? owned : 0;
  return Math.round(definition.baseCost * Math.pow(definition.growth, count));
}

function getModuleDefinition(moduleId) {
  return ACT_SEVEN_MODULES.find((module) => module.id === moduleId) || null;
}

module.exports = { ACT_SEVEN_MODULES, moduleCost, getModuleDefinition };
