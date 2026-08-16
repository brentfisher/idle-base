// Act VII's site ladder and its launch pads — PRD §7.1, §7.2, §7.5 and ledger R1/R2.
//
// Five rungs, strictly ordered. A site is REACHED by a launch, COLONIZED with Salvage, and made
// into a launch platform by building a PAD on it. The pad's tier is the only input to how far the
// next launch can reach, and the pad imposes permanent upkeep on the shared network — which is what
// makes expanding a decision rather than a purchase.
//
// The fiction and the gating are the same sentence: you are rounding the bases, and you cannot skip
// second. Every name in this file is that mapping still paying out.
//
// ---------------------------------------------------------------------------------------------
// WHAT IS AUTHORED HERE AND WHAT IS DERIVED FROM IT
//
//   authored   rung, upkeepFactor, colony base upkeep, site production, colonize cost + window,
//              departingThreshold, the capability flags, the pad tier table
//   derived    fuelCapacityOnArrival  = OVERSHOOT_TANK_MULT x departingThreshold   (ledger R1)
//              a pad's effective upkeep = tier upkeep x the site's upkeepFactor    (§7.2)
//              which tier a site may build = the tier whose [minRung, maxRung] contains its rung
//
// The 1.6x tank rule is DERIVED RATHER THAN AUTHORED on purpose, and it is the one piece of
// arithmetic this data file is allowed to do. §7.3's whole argument is that the overshoot band must
// be STRUCTURAL rather than "a coincidence between two sections' tuning" — if a tank ceiling and a
// launch threshold are two hand-typed numbers, a retune moves one and not the other, and the
// launch-now-or-hold decision that is this act's answer to "can a launch fail?" silently stops
// existing. Authored once, multiplied here, it cannot drift.
//
// `departingThreshold` is the threshold of the launch DEPARTING FROM this site, not arriving at it.
// Home Plate carries L1's 1,200 because L1 leaves from Home Plate; the Warning Track carries L5's
// 42,000 because the swing leaves from there. The tank you fill is the tank at the place you are
// standing. engine/launch.js (STORY-028) owns the transit times, the overshoot grants and the
// commit path, and MUST read its thresholds from this field rather than restating them — two
// copies of a threshold is exactly the drift the paragraph above forecloses.
// ---------------------------------------------------------------------------------------------
//
// R2'S COST LADDER, RE-DERIVED AGAINST THE MEASUREMENT RATHER THAN COPIED (see the block at the
// foot of this file). Ledger R2 is a RECONCILIATION, not a measurement: it recomputed §7.5's
// estimate-derived costs against §5.2's authored bands, which are themselves an authored table.
// STORY-025 then measured the ladder and found `lifeSupport` earning 2.6x its §5.3 budget. Copying
// R2's numbers forward would inherit the exact class of error R2 was written to correct, one layer
// down. The design intent R2 states — MINUTES OF INCOME AT THAT BEAT — is what is held here, and
// the cost is recomputed from what the economy actually pays.
//
// PRESERVED DESIGN INTENT (§7.5's "minutes of income", which is the number that must survive every
// retune; R2 holds it, and so does this file):
//
//   Colonize On-Deck        3.3 min      The Mound (T2)        5.0 min
//   Colonize First Base     6.0 min      The Long Toss (T3)    8.0 min
//   Colonize Second Base    8.0 min      The Cutoff (T4)      10.0 min
//   Colonize Warning Track  6.0 min      The Swing (T5)       12.0 min
//
// Colonizing the Warning Track is deliberately CHEAP to establish and ruinous to sustain — 6.0
// minutes against a 6.0 upkeepFactor. That inversion is the site's whole character and §7.5 asks
// explicitly that it survive retuning. It has.

// §7.3's overshoot band. The tank at every site holds 1.6x the threshold of the launch leaving it,
// so a player may bank up to 60% over and spend the surplus on a shorter transit and an arrival
// grant. Committing dumps the ENTIRE tank, not the threshold — there is no change — which is what
// makes the extra 60% a decision instead of a rounding error.
const OVERSHOOT_TANK_MULT = 1.6;

// THE LADDER. `rung` is the ordering and it is load-bearing: the legal destination of a launch is
// always the lowest unreached rung, which is what makes "one launch in flight at a time" a
// consequence of the ladder rather than a rule anyone has to enforce (§7.3).
const ACT_SEVEN_SITES = [
  {
    id: 'homePlate',
    rung: 0,
    label: 'Home Plate',
    where: 'Earth surface — the lot behind the hardware store, still',
    description: 'The farm team kept working after you left. They are still shipping air.',
    // Reached and colonized before the act begins, and it is not a purchase because it is not a
    // place you went — it is the place you are from. A fresh save stores NO site record at all;
    // these two flags are what make Home Plate exist without one. See resolvedSites() in
    // engine/colony.js for why that matters more than it looks like it does.
    reachedAtStart: true,
    colonizedAtStart: true,
    // The Sandlot exists at act start (§7.2's tier-1 row), so Home Plate opens with a pad and the
    // player's first launch needs no pad purchase at all. The act's first Salvage sink is a module,
    // not a pad, which is what keeps `aftermath` a one-decision phase.
    startingPadTier: 1,
    upkeepFactor: 1.0,
    // Earth costs the network nothing. It is not being kept alive by the colony; the colony is
    // being kept alive by it.
    baseUpkeep: {},
    // THE ONLY FREE ATMOSPHERE IN THE GAME (§5.6, §7.1). This is the one site production term in
    // the act, and it is a flat 2.0 O2/s that does not load-follow and is not multiplied by any
    // output bonus — a planet does not throttle back because your tank is full. It makes Oxygen a
    // non-problem in `aftermath` and a real one the moment Hydroponics Bays start eating it.
    produces: { oxygen: 2.0 },
    departingThreshold: 1200,
    // HOME PLATE'S TANK IS GATED ON OWNING A TANK, and this flag is ledger R1's pacing control
    // rather than a quirk. Every other site's grant lands on arrival; Home Plate is reached at
    // t = 0, so an ungated grant would give the player 1,920 Fuel of ceiling from the first second
    // of the act. Fuel's base capacity is 0 precisely so that it cannot accumulate at all until a
    // tank exists (§5.5), and that zero is the gate that keeps L1 from being crossed a third of a
    // phase early and stealing the time from `lunar`. R1 grants Home Plate's 1,920 "on the first
    // tank purchase"; this flag is that sentence.
    fuelCapacityRequiresTank: true,
    colonizeCost: 0,
    colonizeSeconds: 0,
  },
  {
    id: 'onDeck',
    rung: 1,
    label: 'The On-Deck Circle',
    where: 'Low orbit — a debris ring 150 years thick',
    description: 'A hundred and fifty years of everything anyone ever left up here, going round.',
    upkeepFactor: 1.2,
    baseUpkeep: { power: 2, oxygen: 1.5, provisions: 1 },
    departingThreshold: 4200,
    colonizeCost: 9000,
    colonizeSeconds: 180,
    // §5.4's buildability gate, and the reason the cheapest Power row in the act is unbuyable for
    // the first two phases. A Solar Wing needs somewhere with nothing between it and the sun and no
    // night worth the name; low orbit is the first such place the player owns. The flag is read off
    // the DEFINITION and never off the stored record — see the note on capability flags below.
    vacuumSolar: true,
    // Reaching On-Deck is what `lunar` MEANS. The phase ladder in engine/sites.js reads this field
    // rather than naming a site id, so the phase boundaries are data and the writer is a loop.
    reachedPhase: 'lunar',
  },
  {
    id: 'firstBase',
    rung: 2,
    label: 'First Base',
    where: 'Luna, Mare Crisium',
    description: 'A fourteen-day day, and ice at the pole that has been waiting since before anyone.',
    upkeepFactor: 1.6,
    baseUpkeep: { power: 6, oxygen: 4, provisions: 3 },
    departingThreshold: 13500,
    colonizeCost: 47000,
    colonizeSeconds: 360,
    // The Regolith Ice Harvester's gate. Luna's polar ice is §7.1's "produces that nowhere else
    // does" for this rung, delivered as a module gate rather than a site production term, because
    // the one-pool ruling (§7.4) means the colony sums a list and cannot know which site a rate
    // came from. A gate says the same thing and composes with the shop the player already uses.
    iceAvailable: true,
  },
  {
    id: 'secondBase',
    rung: 3,
    label: 'Second Base',
    where: 'Ceres',
    description: 'Drums the size of weather, spun until the soil remembers which way is down.',
    upkeepFactor: 3.0,
    baseUpkeep: { power: 14, oxygen: 9, provisions: 6 },
    departingThreshold: 21000,
    colonizeCost: 134000,
    colonizeSeconds: 480,
    // `deepSpace` begins on the COMMIT of the launch to Ceres, not on its arrival (§7.6). The
    // asymmetry with `lunar` is deliberate and it is a pacing decision: the teardown beat IS the
    // burn, so the 8-minute dead transit belongs to the budget of the phase it opens rather than
    // to the one it closes. `lunar` would otherwise pay for eight minutes in which nothing about
    // `lunar` is happening.
    commitPhase: 'deepSpace',
  },
  {
    id: 'thirdBase',
    rung: 4,
    label: 'Third Base — the Warning Track',
    where: '~90 AU, the approach to the heliopause',
    description: 'Nothing out here makes anything. You will hold a pad open here anyway.',
    upkeepFactor: 6.0,
    baseUpkeep: { power: 30, oxygen: 20, provisions: 14 },
    departingThreshold: 42000,
    // DELIBERATELY THE CHEAPEST COLONIZATION PER MINUTE-OF-INCOME ON THE LADDER, at 6.0 minutes
    // against Ceres's 8.0, while carrying twice Ceres's upkeepFactor. Cheap to establish, ruinous
    // to sustain. §7.1: "The Warning Track producing nothing is the design, not an oversight" — it
    // is the act's thesis as a mechanic, and a player arriving here watches every rate in the
    // header go down and has to build anyway. If this ladder is ever retuned, THIS INVERSION IS
    // THE THING TO PRESERVE; the absolute numbers are not the point.
    colonizeCost: 223000,
    colonizeSeconds: 360,
    // No `produces` key at all, rather than an empty one, and the difference is documentation: an
    // empty object reads as "nobody filled this in yet". Its absence reads as what §7.1 says.
  },
];

// LAUNCH PADS (§7.2). Every pad up to tier 4 is a THROW — the mound, the long toss, the cutoff
// relay that a way station literally is. The fifth is not a throw. It is the only launch in the act
// where the player is the batter rather than the pitcher, and the only one aimed at the wall.
//
// `upkeep` is the tier's BASE cost, before the site's `upkeepFactor`. §7.2's "pad upkeep at max
// tier" column is this table multiplied by that one — 40 Power/s of Swing on the Track's 6.0 factor
// is the 240 Power/s the whole network is sized against.
//
// [minRung, maxRung] IS NARROWER THAN §7.2's "buildable at" COLUMN, AND THE NARROWING IS WHAT MAKES
// THE REST OF §7.2 TRUE. That column reads "any reached site" for T2 and "rung >= 2" for T3, but
// the per-site table three paragraphs later pins each site to exactly one tier: On-Deck tops out at
// T2, First Base at T3, Second Base at T4, the Track at T5. Those two statements only agree if a
// pad of tier N is built on rung N-1, which is what is authored here.
//
// The loose reading is not merely redundant, it is a TRAP. Reach is a ceiling and the legal
// destination is always the lowest unreached rung, so a Mound built on Home Plate reaches a rung
// the player cannot legally fly to — it buys nothing at all and bills 1.5 Power/s forever. Decision
// 3.3 forbids mechanics that destroy what the player bought; a purchase whose only possible effect
// is permanent upkeep for no capability is that rule broken by omission. So each site is offered
// exactly one pad, and the offer is unambiguous.
//
// `reachesRung` is the pad's whole point and the ONLY input to reach. Never satisfaction, never
// stock, never anything that can move while the player is asleep — see the invariant on
// padReachOf() in engine/sites.js.
const LAUNCH_PAD_TIERS = [
  {
    tier: 1,
    id: 'padTier1',
    label: 'The Sandlot',
    description: 'Chalk, a scrap gantry, and the flattest part of the lot.',
    minRung: 0,
    maxRung: 0,
    // Not purchasable at any price: it is already there when the act starts, which is why Home
    // Plate carries `startingPadTier: 1` and this row carries no cost. It is in the table so that
    // reach is a single lookup for every rung including the one you start on.
    existsAtStart: true,
    salvageCost: 0,
    buildSeconds: 0,
    upkeep: {},
    reachesRung: 1,
  },
  {
    tier: 2,
    id: 'padTier2',
    label: 'The Mound',
    description: 'Sixty feet six inches of it, and the first thing you build that is not for staying alive.',
    minRung: 1,
    maxRung: 1,
    salvageCost: 21000,
    buildSeconds: 300,
    upkeep: { power: 1.5, provisions: 0.4 },
    reachesRung: 2,
  },
  {
    tier: 3,
    id: 'padTier3',
    label: 'The Long Toss',
    description: 'Warm it up properly. Nothing about this one is a flick of the wrist.',
    minRung: 2,
    maxRung: 2,
    salvageCost: 86000,
    buildSeconds: 480,
    upkeep: { power: 5, provisions: 1.5 },
    reachesRung: 3,
  },
  {
    tier: 4,
    id: 'padTier4',
    label: 'The Cutoff',
    description: 'You do not throw it all the way home. You throw it to the one who can.',
    minRung: 3,
    maxRung: 3,
    salvageCost: 216000,
    buildSeconds: 600,
    upkeep: { power: 14, provisions: 4 },
    reachesRung: 4,
  },
  {
    tier: 5,
    id: 'padTier5',
    label: 'The Swing',
    description: 'Six acts of pitching. One swing.',
    minRung: 4,
    maxRung: 4,
    salvageCost: 560000,
    buildSeconds: 720,
    upkeep: { power: 40, provisions: 12 },
    // There is no rung 5. `reachesRung` past the top of the ladder is what "over the wall" means,
    // and §7.1 is explicit that beyond the wall is NOT a site: no rung, no colonization cost, no
    // production. engine/launch.js resolves a destination rung with no site as the win condition
    // (STORY-032), which is why this is a number and not a `reachesWall: true` flag — a flag would
    // be a second kind of reach, and reach is meant to be one comparison.
    reachesRung: 5,
  },
];

// THE COLONIZE BUILD ID. `buildingId` on a site record is either this constant or a pad tier's id,
// because a site's crew can only do ONE thing at a time (§7.7) — which is a design constraint as
// much as a simplification. Owning four sites means four builds can run in parallel, so the
// network's build throughput is itself a reason to colonize, and colonization windows and pad
// windows collapse into a single `readyAtClock` per site: one findNextEventClock contributor
// instead of two.
const COLONIZE_BUILD_ID = 'colonize';

function getSiteDefinition(siteId) {
  return ACT_SEVEN_SITES.find((site) => site.id === siteId) || null;
}

function getPadTier(tier) {
  return LAUNCH_PAD_TIERS.find((pad) => pad.tier === tier) || null;
}

// The one pad a site of this rung may build, or null. See the [minRung, maxRung] note above for
// why this is a lookup returning at most one row rather than a filter returning several.
function padTierForRung(rung) {
  if (!Number.isFinite(rung)) return null;
  return LAUNCH_PAD_TIERS.find((pad) => rung >= pad.minRung && rung <= pad.maxRung) || null;
}

// Ledger R1's tank floor, derived so it cannot drift from the threshold it is 1.6x of. Returns 0
// for a definition with no departing launch, which is not a defensive default — it is the correct
// answer for a terminal site, and STORY-032's over-the-wall ending has no threshold after it.
function siteFuelCapacity(definition) {
  const threshold = definition && definition.departingThreshold;
  if (!Number.isFinite(threshold) || threshold <= 0) return 0;
  return Math.round(threshold * OVERSHOOT_TANK_MULT);
}

// A pad tier's upkeep AT A SITE: the tier's base rates scaled by that site's `upkeepFactor`.
//
// NAMING TRAP, CALLED OUT BECAUSE §7.2 SAYS IT WILL OTHERWISE BE WALKED INTO. `upkeepFactor`
// deliberately does NOT end in `Mult`. That suffix is reserved for members of BONUS_KEYS in
// data/modifierKeysConfig.js, and a key ending in `Mult` that is not in that list is SILENTLY
// INERT — a balance bug no build catches. This is a plain config scalar on a site record, it is
// not modifier-affected, and it is named like what it is. §7.0's decision C puts the whole of this
// file outside the modifier system for the same reason: the fill-time arithmetic in §7.5 only stays
// honest if a threshold is a constant.
//
// COLONY BASE UPKEEP IS NOT SCALED BY IT. Only the pad is. A colony grows what it can and feeds
// itself; a pad is a machine that has to be fed FROM the network, and distance is what that costs.
// That asymmetry is the entire mechanical content of `upkeepFactor` and is what §7.4 bought instead
// of per-site resource pools.
function padUpkeepAt(definition, tier) {
  const pad = getPadTier(tier);
  if (!pad || !pad.upkeep) return {};
  const factor = Number.isFinite(definition && definition.upkeepFactor) ? definition.upkeepFactor : 1;
  return Object.keys(pad.upkeep).reduce((acc, resourceId) => {
    acc[resourceId] = pad.upkeep[resourceId] * factor;
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------------------------
// VERIFIED — under `node`, against this config and engine/sites.js. Below the config so the
// numbers sit next to nothing they could be mistaken for.
//
// WHAT IS NOT HERE, AND WHY: THE MINUTES-OF-INCOME FIGURES ARE NOT MEASURED ON THIS BRANCH, and
// that is a deferral with a reason rather than an omission. Every purchase this file prices happens
// in `lunar` or later — colonizing On-Deck needs On-Deck REACHED, and a site is reached only by a
// launch. engine/launch.js is STORY-028, so on this branch `listOffers()` correctly returns zero
// rows for the whole of `aftermath` and `lifeSupport` (verified). A run that measured the cost
// ladder here would have to synthesise the arrival times it was trying to price against, which is
// inventing the input and reporting it as a result.
//
// The costs therefore stand on the re-derivation the header describes: §7.5's minutes-of-income
// INTENT, recomputed against STORY-025's measurement of the module ladder (`lifeSupport` earning
// 2.6x its §5.3 budget) rather than copied from ledger R2's estimate-derived table. THE FIRST
// STORY THAT LANDS TRANSITS MUST RE-MEASURE — ledger R8 puts later stories on the measurement, and
// STORY-028 is the first branch on which this ladder can be played at all.
//
// STRUCTURAL RULES, verified exhaustively across all five sites:
//
//   * LEDGER R1's TANK FLOOR HOLDS EVERYWHERE: every site's Fuel tank is exactly
//     OVERSHOOT_TANK_MULT (1.6) x the threshold of the launch DEPARTING from it.
//
//       Home Plate            departs 1,200   tank  1,920
//       The On-Deck Circle    departs 4,200   tank  6,720
//       First Base            departs 13,500  tank 21,600
//       Second Base           departs 21,000  tank 33,600
//       The Warning Track     departs 42,000  tank 67,200
//
//     Derived, not authored, so §7.3's overshoot band cannot decay into a coincidence between two
//     hand-typed tables the day either one is retuned.
//
//   * ONE PAD TIER PER RUNG, no gaps and no overlaps — rung 0 -> The Sandlot (exists at start),
//     1 -> The Mound, 2 -> The Long Toss, 3 -> The Cutoff, 4 -> The Swing. Each tier reaches
//     exactly rung+1, so the top pad reaches rung 5, which is past the end of the ladder and is
//     §7.1's "beyond the wall is not a site".
//
//   * HOME PLATE'S FUEL GRANT IS WITHHELD UNTIL A TANK IS OWNED, which is R1's pacing control and
//     the thing an ungated grant would silently break. Measured at act start: Fuel capacity is 0
//     with no storage owned, and 2,320 the moment one 400-unit Fuel Bladder is bought — the
//     Bladder's 400 plus Home Plate's 1,920 arriving together, exactly once, on the purchase that
//     R1 says should carry it. Fuel cannot be banked at all before that, so L1's threshold cannot
//     be crossed early and `lunar` keeps the time §7.5 budgets it.
//
// ENGINE BEHAVIOUR, verified against a synthetic Act VII save:
//
//   * `resolveBuilds()` is IDEMPOTENT BY IDENTITY — a completed colonization clears `buildingId`
//     and `readyAtClock`, and a replayed call returns the same object by reference. This is the
//     property an eight-hour offline return depends on; without it a long catch-up colonizes twice.
//   * `nextBuildClock()` returns Infinity with nothing pending and on every pre-Act-VII save, and
//     the pending build's clock otherwise. It never returns 0, which would pin advance()'s step.
//   * THE PHASE WRITER SELF-HEALS: a save hand-edited to `majors` is rewritten to the highest
//     phase its predicates actually support (`lunar`, with On-Deck reached) on the next tick, and
//     returns state by identity when the stored phase is already right.
//   * It ABSTAINS ENTIRELY OUTSIDE ACT VII — a fresh Act I save is returned by identity and gets no
//     `expedition` slice materialised into it.
//   * REACH IS A PURE FUNCTION OF THE STORED PAD TIER: `siteReach()` reads one integer and takes no
//     resource, satisfaction or rate input, so a starved network cannot launch shorter.
//   * `purchase()` refuses a site that is already building, an offer id naming a tier the rung may
//     not build, and a malformed id — each with null rather than a partial write.
// ---------------------------------------------------------------------------------------------

module.exports = {
  ACT_SEVEN_SITES,
  LAUNCH_PAD_TIERS,
  COLONIZE_BUILD_ID,
  OVERSHOOT_TANK_MULT,
  getSiteDefinition,
  getPadTier,
  padTierForRung,
  siteFuelCapacity,
  padUpkeepAt,
};
