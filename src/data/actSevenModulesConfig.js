// Act VII's module catalogue — PRD §5.4's ladder, COMPLETE: every producer, the whole storage
// ladder, and the two rows gated on a colonized site.
//
// STORY-024 shipped the four `aftermath` rungs against a deliberately empty later ladder; this file
// now carries all of it. Two rows — Solar Wing and Regolith Ice Harvester — are priced and present
// but unbuyable until STORY-027 lands colonization, because they require a site declaring a
// capability and no site exists yet. That is the honest state rather than a stub: the rows are real,
// their gate is real, and it currently evaluates to false.
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
// THE SABATIER SCRUBBER IS NO LONGER INERT — STORY-024's note that it bought the player nothing
// was true of the tier-1 set alone and is now superseded. The Hydroponics Bay eats 0.30 Oxygen/s,
// so from `lifeSupport` onward Oxygen has a real consumer and the Oxygen chain is load-bearing:
// starve it and Provisions throttle, which starves the Fission Piles, which starves Power. That
// three-step chain is what makes the solve a fixed point rather than a dependency walk.
//
// It remains true that an Oxygen producer buys nothing during `aftermath` itself.
// ---------------------------------------------------------------------------------------------
// THE FULL LADDER, MEASURED (STORY-025). Continuous run from a fresh Act VII save through the
// `aftermath` and `lifeSupport` phases, 1s steps, driving engine/colony.js, engine/clicker.js and
// this shop's own listOffers/purchase — so the buyer is subject to every gate a player is.
//
// THE BUYER IS AN OPTIMAL ONE: it always buys the best Salvage-per-Salvage-spent row the bus can
// feed, and buys the cheapest unblocking generator when it cannot. Every figure below is therefore
// an UPPER BOUND on pace, not an expected play-through. Read them as "no player is faster than
// this", which is the useful direction for a pacing control.
//
//   * THE PACING CONTROL HOLDS, and it is the number §5 and §7 share (§5.5, §7.5).
//       requires-gate (7 Fission Piles + 7 Hydroponics Bays) opens  38.1 min into `lifeSupport`
//       first Fuel Bladder actually bought                          39.4 min into `lifeSupport`
//     The requirement is "not affordable before ~minute 35". Measured 39.4 against an optimal
//     buyer, so a real player is later still — late is the safe direction here, because early
//     means the first launch threshold is crossed a third of a phase early and steals time from
//     `lunar`. Price alone could never have held this: 3,600 Salvage is ~90s of mid-phase income.
//     RE-MEASURE THIS FIRST if any tier-2 cost or exponent moves.
//
//   * PHASE DURATIONS RUN FAST AGAINST THE AUTHORED BANDS, under optimal play:
//       `aftermath`   exit (8 Drones) at 14.6 min   against the authored 20-30 min
//       `lifeSupport` exit             at 40.2 min   against the authored 45-60 min
//     Not retuned, and the reason is that these two facts have to be read together with the next
//     one: the ladder earns far more than §5.3 budgeted, so an optimal buyer walls off early. A
//     player who buys any of §8's elastic catalogue — which this buyer does not, because §8 does
//     not exist yet — spends that surplus and lands inside the band. The story that adds the
//     artifact/instrument sinks should re-measure before anyone moves a cost here.
//
//   * INTEGRATED EARN vs §5.3's budget (measure the integral, never threshold/rate — income ramps
//     while the player builds, and the quotient under-reports by 5-15%):
//       `aftermath`    10,613 earned   against a 15,400 budget / 13,904 compulsory
//       `lifeSupport` 285,218 earned   against a 108,200 budget /  97,560 compulsory
//     `aftermath` earns LESS than budget only because it exits early — the rate is ahead, the
//     window is shorter. `lifeSupport` earns 2.6x its budget, which is the single largest
//     discrepancy in the act and is consistent with STORY-024's finding that the measured band
//     already ran ~27% hot at the `aftermath` exit. THE LADDER IS MORE GENEROUS THAN §5.3
//     ASSUMED. §5.3's tables are a consistency check rather than a simulation and say so; this is
//     the simulation, and ledger R8 says later stories recompute against the measurement.
//
//   * THE SOLVE CONVERGES AGAINST THE REAL LADDER, not just synthetic fixtures:
//       worst passes observed across the whole run: 16 (= SOLVE_MAX_PASSES, i.e. it stops on the
//       cap rather than on SOLVE_EPSILON), first reached once the Fission Pile / Hydroponics Bay
//       pair is deep enough to be genuinely mutually recursive.
//     This is the same worst case engine/colony.js recorded against PRD §5.6's example B, now
//     confirmed against the shipped ladder. The cap is doing real work and is correctly sized.
//
//   * STARVATION THROTTLES AND RECOVERS; NOTHING IS DESTROYED. Fixture: 20 Fission Piles (8.0
//     Prov/s demand) against 2 Hydroponics Bays (1.8 Prov/s), which is mutual rather than one-way
//     because the Bays need the Power the starved Piles make.
//       drained to the floor:  provisions ration 0.200, Salvage 30.00 -> 6.00/s, net pinned to
//                              exactly 0, all four module entries intact after 1200s
//       add ONE Ration Printer: ration 0.200 -> 0.228, Salvage 6.00 -> 6.83   (strictly better)
//       add 29:                 ration 1.000, Salvage back to 30.00, silo refilled to 100
//     One generator ALWAYS improves the ration and never fails to; full recovery needs the deficit
//     actually covered, which is 29 printers here. No module is ever removed and no resource goes
//     negative — the colony is a throttle, never a ratchet.
//
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

  // =============================================================================================
  // TIER 2+ — the rest of PRD §5.4's ladder.
  //
  // THE INTERLOCK IS THE ACT, and it starts here. In `aftermath` the only loop is Power feeding
  // Drones. From `lifeSupport` on, the graph closes on itself: the Fission Pile eats Provisions,
  // the Hydroponics Bay eats Power AND Oxygen to make those Provisions, and the Cascade Scrubber
  // eats Power to make that Oxygen. There is no ordering of purchases that makes any one of them
  // self-sufficient — which is why engine/colony.js solves a FIXED POINT rather than evaluating a
  // dependency chain, and why the measured convergence bound below is a deliverable rather than
  // trivia.
  // =============================================================================================

  // --- Salvage chain, upper tiers ---
  {
    id: 'wreckCrawler',
    label: 'Wreck Crawler',
    description: 'Goes inside the hull sections the drones will not enter and comes back heavier.',
    phase: 'lifeSupport',
    baseCost: 6000,
    growth: 1.24,
    producesSalvage: 18,
    consumes: { power: 6.0, provisions: 0.35 },
  },
  {
    id: 'orbitalSieve',
    label: 'Orbital Sieve',
    description: 'Strains the debris belt on every pass and drops what it keeps down the well.',
    phase: 'lunar',
    baseCost: 22000,
    growth: 1.2,
    producesSalvage: 130,
    consumes: { power: 40, provisions: 2.0 },
  },

  // --- Power chain, upper tiers ---
  {
    id: 'fissionPile',
    label: 'Fission Pile',
    description: 'Wants watching. Somebody has to eat while they watch it.',
    phase: 'lifeSupport',
    baseCost: 2300,
    growth: 1.17,
    produces: { power: 12.0 },
    // 0.40 Provisions is the staffing cost, and it is the first consumer that makes the graph
    // mutual: Power now depends on Provisions, which already depended on Power.
    consumes: { provisions: 0.4 },
  },
  {
    id: 'solarWing',
    label: 'Solar Wing',
    description: 'Nothing between it and the sun. No weather, no night worth the name.',
    phase: 'lunar',
    baseCost: 1400,
    growth: 1.14,
    produces: { power: 14.0 },
    // The cheapest Power per copy in the act and it consumes NOTHING — which would break the
    // phase if it were simply buyable. It is not: §5.4 replaced the draft's per-site output
    // multiplier with a buildability gate, so a Solar Wing requires a colonized site that declares
    // `vacuumSolar` (On-Deck). Until STORY-027 lands sites, no site exists, so this row is never
    // offered. The beat survives and improves: the cheapest Power in the act is unbuyable until
    // you colonize, and then it is the best thing on the board.
    requiresSiteCapability: 'vacuumSolar',
  },
  {
    id: 'fusionRing',
    label: 'Fusion Ring',
    description: 'The first thing you have built out here that would look like industry from orbit.',
    phase: 'deepSpace',
    baseCost: 18000,
    growth: 1.1,
    produces: { power: 140 },
    consumes: { provisions: 2.5, oxygen: 4.0 },
  },

  // --- Oxygen chain, upper tiers ---
  {
    id: 'scrubberMkII',
    label: 'Cascade Scrubber',
    description: 'Four Sabatier stages in a row, each one eating the last one\'s disappointment.',
    phase: 'lifeSupport',
    baseCost: 2600,
    growth: 1.24,
    produces: { oxygen: 1.2 },
    consumes: { power: 3.0 },
  },
  {
    id: 'iceHarvester',
    label: 'Regolith Ice Harvester',
    description: 'Bakes the dust until it gives up the water it has been holding since before anyone.',
    phase: 'lunar',
    baseCost: 6400,
    growth: 1.12,
    produces: { oxygen: 6.0 },
    consumes: { power: 12, provisions: 0.6 },
    // Same mechanism as the Solar Wing: a site has to declare there is ice to harvest.
    requiresSiteCapability: 'iceAvailable',
  },

  // --- Provisions chain, upper tiers ---
  {
    id: 'hydroponicsBay',
    label: 'Hydroponics Bay',
    description: 'Lettuce under magenta light, on a rack, in a room that used to be a cargo bay.',
    phase: 'lifeSupport',
    baseCost: 1500,
    growth: 1.17,
    produces: { provisions: 0.9 },
    // Eats Power AND Oxygen to make Provisions, while the Fission Pile eats Provisions to make
    // Power. This pair is PRD §5.6's worked example B and the fixture that drives the solve to its
    // measured worst case.
    consumes: { power: 5.0, oxygen: 0.3 },
  },
  {
    id: 'algaeColumn',
    label: 'Algae Column',
    description: 'Green, lit from within, and it smells exactly as bad as it looks.',
    phase: 'lunar',
    baseCost: 7500,
    growth: 1.2,
    produces: { provisions: 4.5 },
    consumes: { power: 20, oxygen: 1.2 },
  },
  {
    id: 'drumFarm',
    label: 'Spun Drum Farm',
    description: 'A field bent into a cylinder and spun until the soil remembers which way is down.',
    phase: 'deepSpace',
    baseCost: 20000,
    growth: 1.14,
    produces: { provisions: 24.0 },
    // THE ONE MODULE PRICE COULD NOT AVOID (§5.4). Every other overrun in §5.3 closed by moving a
    // base cost or an exponent; Provisions could not. §7's pad and colony upkeep alone demands
    // ~110.9 Prov/s at act end, and 4.50 Prov/s per Algae Column is 27 copies at any base price —
    // copy-spam no exponent rescues.
    consumes: { power: 90 },
  },

  // --- Fuel chain ---
  // Fuel is not an economy resource: it is the launch threshold (§7.5), so this chain's job is a
  // RATE, not a stockpile. See the note on fuelBladder for the pacing control that keeps the first
  // launch from arriving a third of a phase early.
  {
    id: 'electrolysisStack',
    label: 'Electrolysis Stack',
    description: 'Splits meltwater and keeps the half that burns.',
    phase: 'lifeSupport',
    baseCost: 2100,
    growth: 1.19,
    produces: { fuel: 0.35 },
    consumes: { power: 6.0, provisions: 0.5 },
    requires: { fissionPile: 7, hydroponicsBay: 7 },
  },
  {
    id: 'crackingTower',
    label: 'Cracking Tower',
    description: 'Long, hot, and it runs all night because there is no reason to stop it.',
    phase: 'lunar',
    baseCost: 11000,
    growth: 1.2,
    produces: { fuel: 2.2 },
    consumes: { power: 30, provisions: 1.8 },
  },
  {
    id: 'isruPlant',
    label: 'ISRU Plant',
    description: 'Makes propellant out of the place itself, which is the only way anyone gets home.',
    phase: 'deepSpace',
    baseCost: 60000,
    growth: 1.18,
    produces: { fuel: 14.0 },
    consumes: { power: 150, provisions: 8.0 },
  },

  // =============================================================================================
  // STORAGE — capacity only, never a rate.
  //
  // A storage module declares `capacity` and neither `produces` nor `consumes`. engine/colony.js
  // derives every ceiling from base + the sum of these grants (ledger R1), so a tank is felt
  // entirely through the clamp: it does not change any rate, it changes how long a surplus can be
  // banked and how much runway a deficit has before it pins.
  //
  // Growth is steeper here (1.34-1.45) than on any producer, and deliberately. A producer bought
  // ten times is ten times the rate; a tank bought ten times is almost never worth it, because
  // what a tank buys is TIME, and time is only valuable up to the length of a session. The steep
  // exponent is what stops storage being a mindless sink for spare Salvage.
  // =============================================================================================
  {
    id: 'bufferCell',
    label: 'Buffer Cell',
    description: 'Somewhere to put the watts you are not spending yet.',
    phase: 'aftermath',
    baseCost: 60,
    growth: 1.4,
    capacity: { power: 250 },
  },
  {
    id: 'oxygenTank',
    label: 'Oxygen Tank',
    description: 'Steel, and a gauge you will learn to check without deciding to.',
    phase: 'aftermath',
    baseCost: 80,
    growth: 1.4,
    capacity: { oxygen: 200 },
  },
  {
    id: 'rationSilo',
    label: 'Ration Silo',
    description: 'Dry, dark, and larger than you expect to need.',
    phase: 'aftermath',
    baseCost: 80,
    growth: 1.4,
    capacity: { provisions: 200 },
  },
  {
    id: 'batteryBank',
    label: 'Battery Bank',
    description: 'Ten times the buffer and about ten times the mass. Both worth it.',
    phase: 'lifeSupport',
    baseCost: 2200,
    growth: 1.34,
    capacity: { power: 2500 },
  },
  {
    id: 'oxygenReservoir',
    label: 'Oxygen Reservoir',
    description: 'Enough air, banked, that a bad afternoon stops being an emergency.',
    phase: 'lifeSupport',
    baseCost: 2600,
    growth: 1.34,
    capacity: { oxygen: 2000 },
  },
  {
    id: 'deepSilo',
    label: 'Deep Silo',
    description: 'Cut into the regolith, where the temperature stopped arguing a long time ago.',
    phase: 'lifeSupport',
    baseCost: 2600,
    growth: 1.34,
    capacity: { provisions: 2000 },
  },

  // THE FIRST FUEL BLADDER IS A PACING CONTROL, NOT AN ECONOMY ROW (§5.5, ledger R1).
  //
  // Fuel's base capacity is 0, so until a tank exists Fuel cannot be banked AT ALL — the ceiling
  // clamp discards it. What 3,600 Salvage buys is therefore not 400 units of headroom; it is Fuel
  // accumulating at all, which is the gate on the whole launch system.
  //
  // §7.5 requires that not be affordable before ~minute 35 of `lifeSupport`, and PRICE ALONE
  // CANNOT HOLD IT: 3,600 is about ninety seconds of mid-phase income. So the real control is the
  // `requires` gate it shares with the Electrolysis Stack — seven Fission Piles and seven
  // Hydroponics Bays, which is ~63,700 Salvage of cumulative spend once everything bought
  // alongside is counted. That is a spend gate rather than a price gate, and a spend gate is the
  // only kind a player cannot skip by saving up.
  //
  // The measured crossing is recorded in the phase budget block at the top of this file. It is the
  // one minute-hand §5 and §7 share, so it is the number to re-measure first if anything here moves.
  {
    id: 'fuelBladder',
    label: 'Fuel Bladder',
    description: 'A soft tank in a hard frame. The first place the propellant has to go.',
    phase: 'lifeSupport',
    baseCost: 3600,
    growth: 1.45,
    capacity: { fuel: 400 },
    requires: { fissionPile: 7, hydroponicsBay: 7 },
    // `firstNote` — shown only while none are owned, and read by engine/actSevenModules.js, which
    // decides "none owned" because that is a fact about the save. THE ONLY ROW IN THE LADDER THAT
    // CARRIES ONE, and the reason is the paragraph above: this row's effect string reads
    // "+400 max fuel", which is true, complete, and completely fails to say what is actually being
    // bought. Every other capacity row raises a ceiling that already exists; this one raises it off
    // zero, so what 3,600 Salvage buys is Fuel EXISTING — the whole launch system switching on —
    // and a player who reads "+400" as headroom has misread the most important purchase in the act.
    // The sentence lives here beside the 0 it explains rather than in the panel, because it is the
    // number's meaning and not the screen's.
    firstNote: 'Nothing on the wreck can hold propellant yet, so Fuel is discarded as fast as it is made. This is the tank that lets it start counting.',
  },
  {
    id: 'cryoTank',
    label: 'Cryo Tank',
    description: 'Keeps it cold enough for long enough to be worth carrying somewhere else.',
    phase: 'lunar',
    baseCost: 26000,
    growth: 1.4,
    capacity: { fuel: 4000 },
  },
  {
    id: 'cryoFarm',
    label: 'Cryo Farm',
    description: 'A field of them, humming, at a temperature the sky out here provides for free.',
    phase: 'deepSpace',
    baseCost: 90000,
    growth: 1.35,
    capacity: { fuel: 40000 },
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
