// Act VII's launches — commit, transit, arrival, and the overshoot decision.
// Pure: no React, no DOM, no Date.now(), and — see the section on rng below — no randomness at all.
//
// PRD §7.3, §7.5 and ledger R1. This file owns every RULE about a burn: where the next one may go,
// what it costs, how long it takes, what overshoot buys, and what happens when it lands. It owns
// none of the numbers (data/actSevenLaunchConfig.js and data/actSevenSitesConfig.js) and it writes
// no site record (engine/sites.js's markSiteReached does that, and is exported for exactly this).
//
// The house shop contract, the same shape engine/lotShop.js <-> components/lot/LotShop.js
// established and engine/sites.js follows:
//
//   listOffers(state)          presentation-ready rows, everything already resolved
//   purchase(state, offerId)   commits the burn; new state, or null for refused
//   resolveArrivals(state)     called from advance(); idempotent by construction
//   nextArrivalClock(state)    the transit wake boundary, on tickEngine's contributor list
const {
  OVERSHOOT_TANK_MULT,
  OVER_THE_WALL_RUNG,
  OVER_THE_WALL_DESTINATION_ID,
  getSiteDefinition,
  padTierForRung,
} = require('../data/actSevenSitesConfig');
const {
  LAUNCH_FUEL_RESOURCE,
  ARRIVAL_GRANT_CURRENCY,
  OVERSHOOT_FLOOR,
  OVERSHOOT_STEP,
  TRANSIT_REDUCTION_PER_STEP,
  ARRIVAL_GRANT_PER_STEP,
  OVER_THE_WALL_LABEL,
  transitSecondsFrom,
  launchCopy,
} = require('../data/actSevenLaunchConfig');
// The win condition's milestone key (PRD §7.8). Named in data/ rather than typed here, and read by
// engine/sites.js's phase ladder from the same constant, so the write below and the read there
// cannot drift apart into a run that has won and a phase that never notices.
const { OVER_THE_WALL_MILESTONE } = require('../data/actSevenConfig');
const { expeditionSlice, resolvedSites, spendResource } = require('./colony');
const { markSiteReached, siteReach } = require('./sites');
const { creditWallet } = require('./wallet');

// ---------------------------------------------------------------------------------------------
// NO RNG. ANYWHERE. A COMMITTED LAUNCH ALWAYS ARRIVES AND NEVER LOSES THE FUEL.
//
// conventions.md says randomness enters an engine as a defaulted `rng` parameter so behaviour is
// reproducible headlessly. This file's decision is stronger: it takes no rng at all, and the
// argument is architectural before it is philosophical.
//
// A random outcome resolved inside advance() is resolved DURING OFFLINE CATCH-UP, IN FRONT OF
// NOBODY. A player who commits a 42,000-Fuel burn — twenty-seven minutes of filling at the top of
// the ladder — closes the tab, and returns to "the burn was short" has been dealt a loss they did
// not see, could not influence, and cannot audit. There is no screen it could have happened on.
// Threading an rng through the tick loop to roll dice at a clock boundary would also change the
// engine's character: advance() is deterministic today outside game simulation, and every offline
// replay in this codebase is provably a replay because of it.
//
// The second argument is scale. A failed launch costs the full fill. Idle games punish with time
// and this act ALREADY punishes with time; a variance term on top of a half-hour wait is not risk,
// it is a tax on session length.
//
// So the risk lives at commit time, in front of the player, and it is not random at all — see the
// overshoot band below. Go now on the window that is open, or hold six more minutes and arrive
// with the margin that pays for half the colonization. No dice, no hidden state, no soft-lock.
// ---------------------------------------------------------------------------------------------

// An offer id is `launch@<destinationSiteId>`, which is engine/sites.js's `<what>@<where>` shape
// with the same separator, so the act has one offer-id vocabulary rather than two.
//
// IT IS ALSO THE STORED RECORD'S `id`, and that is not laziness — it is what makes the id unique
// across a whole run with no counter, no rng and no clock in it. A destination is reached exactly
// once and is never offered again (the ladder is strictly ordered and `listOffers` targets the
// lowest UNREACHED rung), so there can never be two launches carrying the same id. A record can
// therefore be traced back to the row that started it by reading the save, which is the same
// property engine/sites.js's offer id buys for builds.
const OFFER_SEPARATOR = '@';
const LAUNCH_OFFER_PREFIX = 'launch';

function offerIdFor(destinationSiteId) {
  return LAUNCH_OFFER_PREFIX + OFFER_SEPARATOR + destinationSiteId;
}

// ---------------------------------------------------------------------------------------------
// IN FLIGHT
// ---------------------------------------------------------------------------------------------

// The log and the in-flight state are ONE LIST (PRD §4, §7.3). A record with `resolved: false` is a
// burn under way; the same record with `resolved: true` is that burn afterwards. There is no second
// slot to reconcile, no "current launch" field that can disagree with the log, and the player reads
// it the same way the engine does.
//
// `resolved !== true` rather than `!resolved`, matching the `=== true` discipline
// engine/colony.js's resolveSiteRecord() applies to every save-borne boolean: these records come off
// disk and the truthy-but-not-true values are all corruption.
function isUnresolved(launch) {
  return !!launch && launch.resolved !== true;
}

// Due when its window has closed — AND when it has no window at all.
//
// The second half is the deliberate one. A record with a non-finite `arrivesAtClock` is corrupt:
// nothing this file writes can produce one. Treating it as never-due would leave it unresolved
// forever, which blocks the "one at a time" check below permanently and soft-locks the entire
// ladder above that rung, with the Fuel already spent. Treating it as due resolves it on the very
// next tick, marks the destination reached, and the run continues. That is engine/colony.js's
// reading of a `buildingId` with no `readyAtClock` applied to the mirror case, and it picks the
// same direction: a corrupt save loses a WINDOW, never a RUN.
function isDue(launch, clock) {
  if (!isUnresolved(launch)) return false;
  return !(Number.isFinite(launch.arrivesAtClock) && launch.arrivesAtClock > clock);
}

// ONE LAUNCH IN FLIGHT AT A TIME, as a single check.
//
// §7.3 is explicit that this is not a technical limit: the ladder is strictly ordered, so there is
// never a second legal destination to fly to. Stating it as an invariant anyway keeps listOffers()
// simple and makes the refusal one comparison instead of a rule scattered across three functions.
function inFlightLaunch(slice) {
  return slice.launches.find((launch) => isUnresolved(launch)) || null;
}

// ---------------------------------------------------------------------------------------------
// THE OVERSHOOT BAND (§7.3)
// ---------------------------------------------------------------------------------------------

// What committing right now would actually do, given the Fuel in the tank and the threshold of the
// burn leaving this site. Pure arithmetic over two numbers and a config slope — no stored state, no
// hidden term, and the same function feeds the listing and the commit so the row cannot advertise a
// transit the commit does not honour.
//
// THE SPEND IS CLAMPED TO THE LAUNCH TANK, AND THAT CLAMP IS THIS FUNCTION'S ONE REAL DECISION.
//
// §7.3 says two things. "The Fuel tank serving each launch has capacity 1.6x the threshold" — the
// launch tank IS the band. And "§5's tank modules become optional capacity stacked ON TOP of that
// floor... which is what beat L-5's tank farms are for: banking past 1.6x."
//
// Those two sentences only reconcile if a burn dumps AT MOST the band and leaves the rest behind.
// The PRD wrote them assuming the ceiling equals 1.6x the current threshold, which was true while
// one site was reached and stopped being true the moment a second was — engine/colony.js's
// colonyCapacity() SUMS `fuelCapacityOnArrival` over every reached site, so the real ceiling runs
// 1,920 -> 9,040 -> 30,640 -> 131,440 while the thresholds run 1,200 -> 4,200 -> 13,500 -> 42,000.
// MEASURED ON THIS BRANCH; it is the first branch on which a second site can be reached at all.
//
// Under the literal reading — dump everything held — every unit banked above the band is destroyed
// for no benefit, which makes the Cryo Tank and the Cryo Farm rows in
// data/actSevenModulesConfig.js actively punish the use the PRD names for them. A reading that
// turns a shipped module into a trap is not merely untidy, it is impossible, so the spend is
// clamped instead.
//
// The player-facing sentence is unchanged and still true: COMMITTING DUMPS THE WHOLE TANK. There is
// no change, no partial fill, and no way to hold some of the burn back. What is above the tank was
// never in it — it is in the storage the player bought to put it there, and it is waiting at the
// next rung as a head start on the next fill.
//
// Because the spend is clamped, the ratio is in [0, 1.6] by construction and needs no second guard.
// A ratio below 1.0 is a burn that cannot legally leave, and the caller refuses it on the threshold
// rather than here — this function answers "what would happen", not "may it happen".
function overshootFor(fuelHeld, threshold, baseTransitSeconds, colonizeCost) {
  const held = Number.isFinite(fuelHeld) && fuelHeld > 0 ? fuelHeld : 0;

  // THE CLAMP, NAMED, AND IT IS RETURNED BECAUSE STORY-039 NEEDS TO DRAW IT. The Launch panel
  // renders the overshoot as a BAND — threshold at one end, this ceiling at the other — because a
  // panel that showed only "threshold met / not met" would delete the act's central decision. That
  // band needs the ceiling as a number, and the one thing it must not do is multiply the threshold
  // by 1.6 itself: a second statement of the multiplier in a component is exactly the drift
  // data/actSevenSitesConfig.js's derivation was written to foreclose. So the ceiling ships out of
  // the same expression that CLAMPS the spend, and the screen cannot advertise a band the commit
  // does not honour.
  const tankCeiling = OVERSHOOT_TANK_MULT * threshold;
  const fuelSpent = Math.min(held, tankCeiling);
  const overshootRatio = fuelSpent / threshold;

  // How many tenths over the floor, as a continuous quantity. §7.5's table quotes a slope per +0.1
  // and this is that slope's argument; see the note in data/actSevenLaunchConfig.js for why the
  // table is read as a line rather than as a staircase.
  const steps = Math.max(0, overshootRatio - OVERSHOOT_FLOOR) / OVERSHOOT_STEP;

  // Rounded to whole seconds, and only here. The reduction is a percentage of a window authored in
  // whole minutes, so an unrounded `arrivesAtClock` would put the act's most-read countdown on a
  // fractional second forever after. Math.max(0, ...) is structural rather than defensive: at the
  // shipped slope the deepest possible cut is 24%, but a retune of TRANSIT_REDUCTION_PER_STEP must
  // not be able to produce a negative window, which would arrive before it departed.
  const reduction = Math.min(1, steps * TRANSIT_REDUCTION_PER_STEP);
  const transitSeconds = Math.max(0, Math.round(baseTransitSeconds * (1 - reduction)));

  const arrivalGrant = steps * ARRIVAL_GRANT_PER_STEP * (Number.isFinite(colonizeCost) ? colonizeCost : 0);

  return { fuelSpent, tankCeiling, overshootRatio, transitSeconds, arrivalGrant };
}

// The arrival grant, RECOMPUTED FROM THE STORED RATIO rather than read off a stored grant.
//
// The record could perfectly well carry the Salvage figure, and deliberately does not. This
// codebase never migrates a save, so a denormalized grant would be frozen at the value it had the
// second the burn was committed — retuning a colonization cost would then pay the old grant to
// every launch already in flight, on every existing save, invisibly. The ratio IS the decision the
// player made and is the only part that must be remembered; the cost it is a percentage of is
// config and is looked up on arrival. Same rule engine/colony.js's resolveSiteRecord() follows for
// every derived field on a site.
function arrivalGrantFor(launch) {
  const ratio = launch && launch.overshootRatio;
  if (!Number.isFinite(ratio)) return 0;
  const definition = getSiteDefinition(launch.destinationSiteId);
  if (!definition || !Number.isFinite(definition.colonizeCost)) return 0;
  const steps = Math.max(0, ratio - OVERSHOOT_FLOOR) / OVERSHOOT_STEP;
  return steps * ARRIVAL_GRANT_PER_STEP * definition.colonizeCost;
}

// The destination's NAME, from the one place that authors it.
//
// Two sources rather than one because there are two kinds of destination and only one of them is a
// place. Four of the five burns land on a site, whose `label` lives on its row in
// data/actSevenSitesConfig.js; the fifth lands nowhere at all, and §7.1 is explicit that beyond the
// wall is not a site — so it has no definition to look up and its name is a display string in
// data/actSevenLaunchConfig.js. getSiteDefinition() answers null for it, which is correct rather
// than a miss, and this is the one function that has to know that.
function destinationLabelFor(destinationSiteId) {
  if (destinationSiteId === OVER_THE_WALL_DESTINATION_ID) return OVER_THE_WALL_LABEL;
  const definition = getSiteDefinition(destinationSiteId);
  return definition ? definition.label : '';
}

// THE BURN UNDER WAY, RESOLVED FOR A SCREEN — or null when none is. Added by STORY-039, and the
// reason it is a separate export rather than a field on the shop row is the finding that story
// opened with.
//
// listOffers() CANNOT CARRY THIS, and it fails in two different directions:
//
//   * AFTER THE FIFTH BURN IS COMMITTED IT RETURNS NOTHING AT ALL. Every rung is reached, so
//     currentLeg()'s `sites.find(s => !s.reached)` is undefined and beyondTheWall() has already
//     refused; the leg is null and the shop is empty. Measured on this branch. Without this
//     function the Launch panel would go blank for the twelve minutes of the last burn in the game
//     — the one beat of the act the player is most certainly watching.
//   * DURING ANY OTHER BURN IT RETURNS A ROW ABOUT THE WRONG FLIGHT. The leg still resolves (the
//     destination is still unreached), but every figure on it — `transitSeconds`, `overshootRatio`,
//     `arrivalGrant` — is recomputed from the Fuel held RIGHT NOW, which is a hypothetical next
//     burn and not the one in the air. A panel that rendered that row's effect string mid-transit
//     would be quoting a window nothing is flying.
//
// So the shop row answers "what would committing do" and this answers "what is happening", and the
// two are never derived from each other.
//
// THE CLOCK IS READ HERE AND NOWHERE ELSE. `secondsRemaining` is a subtraction against `state.clock`
// and it lives in the engine for the same reason engine/sites.js computes `buildSecondsRemaining`
// rather than handing a panel a `readyAtClock`: a save carries `clock` and a save can be corrupt, so
// the subtraction that must stay finite belongs where the guard already is. A component doing it
// would put NaN on screen for a `clock` that is not a number, and would be the second place in the
// app that knows how a transit is measured.
//
// nextArrivalClock() IS NOT THAT SUBTRACTION'S SOURCE, deliberately. It excludes overdue and
// window-less records by contract — it feeds advance()'s step and must never propose a boundary in
// the past — so it answers Infinity for exactly the corrupt record isDue() takes such care to
// resolve. `Infinity - clock` on a screen is the failure that guard exists to prevent.
function inFlightReadout(state) {
  const slice = expeditionSlice(state);
  const record = inFlightLaunch(slice);
  if (!record) return null;

  const clock = Number.isFinite(state.clock) ? state.clock : 0;
  // A missing `committedAtClock` falls back to now and a missing `arrivesAtClock` to the departure,
  // which between them make the window zero and the burn due. That is isDue()'s reading of the same
  // corruption rendered rather than resolved: the record lands on the next tick, and until it does
  // the screen says "landing" instead of counting down from a NaN.
  const committedAt = Number.isFinite(record.committedAtClock) ? record.committedAtClock : clock;
  const arrivesAt = Number.isFinite(record.arrivesAtClock) ? record.arrivesAtClock : committedAt;

  const transitSeconds = Math.max(0, arrivesAt - committedAt);
  const secondsRemaining = Math.max(0, arrivesAt - clock);
  const elapsed = Math.max(0, Math.min(transitSeconds, transitSeconds - secondsRemaining));

  const origin = getSiteDefinition(record.originSiteId);
  // The threshold this burn actually departed on, looked up rather than stored — the same rule
  // arrivalGrantFor() states just above. A record carries the RATIO because the ratio is the
  // decision the player made; what it is a ratio OF is config, and config is read on every render
  // so a retune moves the history with it.
  const threshold = origin && Number.isFinite(origin.departingThreshold) ? origin.departingThreshold : 0;
  const overshootRatio = Number.isFinite(record.overshootRatio) ? record.overshootRatio : 0;

  return {
    id: record.id,
    originSiteId: record.originSiteId,
    originLabel: origin ? origin.label : '',
    destinationSiteId: record.destinationSiteId,
    destinationLabel: destinationLabelFor(record.destinationSiteId),
    overshootRatio,
    fuelSpent: overshootRatio * threshold,
    arrivalGrant: arrivalGrantFor(record),
    transitSeconds,
    secondsRemaining,
    // A fraction for a meter, and 1 for a window of zero — a burn with no window has nothing left
    // to run, which is the honest reading and also avoids the division. Clamped at both ends
    // because `clock` can sit either side of a corrupt record's two boundaries.
    progress: transitSeconds > 0 ? elapsed / transitSeconds : 1,
    // NO `resolved` FIELD, DELIBERATELY. `resolved: false` is the whole of what "in flight" means
    // (§7.3, §4) — there is no second slot and no status flag — so a caller holding this object is
    // already looking at an unresolved burn and a field restating that would be one more thing that
    // could disagree with the record. THE RETURN BEING NON-NULL IS THE STATUS.
  };
}

// ---------------------------------------------------------------------------------------------
// THE SHOP
// ---------------------------------------------------------------------------------------------

// THE FIFTH BURN'S DESTINATION, AS A ROW SHAPED LIKE A SITE AND DELIBERATELY NOT ONE (§7.1, §7.8).
// Returns null once that burn has been committed, which is what ends the shop for good.
//
// FOUR FIELDS, AND EVERY ONE OF THEM IS THERE SO THAT NOTHING DOWNSTREAM NEEDS A BRANCH. The rest
// of this file asks a destination for exactly these: `rung` to find the origin one below it and to
// compare against reach, `id` for the offer id and the stored record, `label` for the row's name,
// and `colonizeCost` for the overshoot's arrival grant. Supply all four and currentLeg(),
// blockedReasonFor(), listOffers() and purchase() run the last burn in the game through the
// identical path as the first, with no `isWall` test anywhere. That is the payoff of
// data/actSevenSitesConfig.js's refusal of a `reachesWall: true` flag: reach stayed ONE COMPARISON,
// `siteReach(origin) < destination.rung`, and the top pad's `reachesRung: 5` satisfies it here for
// the same reason The Mound's 2 satisfies it at On-Deck.
//
// `colonizeCost: 0` IS THE CORRECT VALUE AND NOT A PLACEHOLDER. The arrival grant is a percentage
// of what it costs to colonize where you are going, and nobody colonizes the Wall — §7.1 is
// explicit that beyond it is not a place. So overshoot on the final burn buys the shorter transit
// and no Salvage, which is right twice over: there is no colony left to spend it on, and the
// overshoot ratio is instead read by engine/board.js as an input to Earth's placement. The last
// burn's margin is worth something; it is just not worth money.
//
// GUARDED ON THE LAUNCH LOG RATHER THAN ON THE MILESTONE, even though purchase() sets both in the
// same call. The log is this file's own state and the milestone is progression's, and a shop that
// asked progression whether it may still sell something would be a second place that knows what
// winning means. The record's id is unique by construction (see the offer-id note above), so "has
// this burn been committed" is a lookup with no counter and no clock in it.
function beyondTheWall(slice) {
  const committed = slice.launches.some((launch) => (
    !!launch && launch.destinationSiteId === OVER_THE_WALL_DESTINATION_ID
  ));
  if (committed) return null;

  return {
    id: OVER_THE_WALL_DESTINATION_ID,
    rung: OVER_THE_WALL_RUNG,
    label: OVER_THE_WALL_LABEL,
    colonizeCost: 0,
  };
}

// The one burn that could be committed next, fully resolved, or null. Everything listOffers() and
// purchase() both need to know, computed once so the two cannot disagree about a single field.
//
// THE DESTINATION IS THE LOWEST UNREACHED RUNG AND THE ORIGIN IS THE RUNG BELOW IT. Neither is
// stored anywhere and neither needs to be: the ladder is strictly ordered, so "where can I go" has
// exactly one answer at every instant of the run, and that is what makes one-in-flight a
// consequence of the ladder rather than a rule anyone enforces.
function currentLeg(state, slice) {
  const sites = resolvedSites(state, slice);
  // Empty for every act before Act VII, so this file abstains on the cheapest possible test and
  // needs no act check of its own.
  if (sites.length === 0) return null;

  // EVERY RUNG REACHED IS NOT AN ERROR, IT IS THE ENDING (§7.8, STORY-032). The fifth burn departs
  // the Warning Track for a place §7.1 refuses to call a site, so once the ladder is exhausted the
  // destination is the pseudo-row below rather than a site record — and `null` after that, which is
  // what keeps the launch shop from offering the last burn in the game twice.
  const destination = sites.find((site) => !site.reached) || beyondTheWall(slice);
  if (!destination) return null;

  const origin = sites.find((site) => site.rung === destination.rung - 1);
  if (!origin || !origin.reached) return null;

  const threshold = origin.departingThreshold;
  if (!Number.isFinite(threshold) || threshold <= 0) return null;

  const baseTransitSeconds = transitSecondsFrom(origin.id);
  if (baseTransitSeconds <= 0) return null;

  const fuelHeld = slice.resources[LAUNCH_FUEL_RESOURCE].amount;
  const band = overshootFor(fuelHeld, threshold, baseTransitSeconds, destination.colonizeCost);

  return { origin, destination, threshold, baseTransitSeconds, fuelHeld, ...band };
}

// Why this burn cannot be committed right now, as a sentence, or null when it can.
//
// ORDERED MOST-DOMINANT-FACT FIRST. A burn already under way is the whole state of the world and
// says nothing about the pad or the tank, so it wins. Reach comes next because it is the actionable
// one — "build the Mound" is a thing the player can go and do — and the tank is last because it is
// the one that fixes itself by waiting.
function blockedReasonFor(leg, slice) {
  if (inFlightLaunch(slice)) return launchCopy.blocked.inFlight;

  // REACH IS THE BUILT PAD TIER ALONE (engine/sites.js's siteReach, and the invariant stated at
  // length there). Never satisfaction, never stock, never anything that can move while the player
  // is asleep — a starved network launches LATER, never SHORTER.
  if (siteReach(leg.origin) < leg.destination.rung) {
    const pad = padTierForRung(leg.origin.rung);
    return pad ? launchCopy.blocked.reach(pad.label) : launchCopy.blocked.noPad;
  }

  if (leg.fuelHeld < leg.threshold) return launchCopy.blocked.fuel(leg.fuelHeld, leg.threshold);
  return null;
}

// One row, or none. The house contract's fields plus the launch-specific ones §7.3 names as "the
// panel needs and must not compute".
//
// UNLIKE EVERY OTHER SHOP IN THIS ACT, THE UNAVAILABLE ROW IS RETURNED WITH A REASON RATHER THAN
// OMITTED. engine/sites.js omits unavailable rows and states the rule; the argument for breaking it
// here is in data/actSevenLaunchConfig.js beside the prose, and the short version is that a shop
// with exactly one row has nothing left to render when it hides that row — the player is looking at
// the tab whose entire subject is the thing they are waiting for.
//
// `owned` is false always, because a burn is not a thing you own. The field is emitted anyway
// because the contract names it and a panel written against the reference pair will look for it —
// the same reason engine/sites.js emits it.
function listOffers(state) {
  const slice = expeditionSlice(state);
  const leg = currentLeg(state, slice);
  if (!leg) return [];

  const pad = padTierForRung(leg.origin.rung);
  return [
    {
      id: offerIdFor(leg.destination.id),
      name: launchCopy.offerName(leg.destination.label),
      description: launchCopy.description(leg.destination.id),
      effect: launchCopy.effect({
        transitSeconds: leg.transitSeconds,
        baseTransitSeconds: leg.baseTransitSeconds,
        overshootRatio: leg.overshootRatio,
        arrivalGrant: leg.arrivalGrant,
      }),
      // The threshold, not the spend. `cost` is what the row is priced at and what `affordable`
      // compares against; `fuelSpent` below is what committing actually dumps, and the gap between
      // the two IS the overshoot decision rather than a discrepancy.
      cost: leg.threshold,
      currency: LAUNCH_FUEL_RESOURCE,
      owned: false,
      affordable: leg.fuelHeld >= leg.threshold,
      originSiteId: leg.origin.id,
      destinationSiteId: leg.destination.id,
      requiredPadTier: pad ? pad.tier : 0,
      fuelHeld: leg.fuelHeld,
      fuelRequired: leg.threshold,
      fuelSpent: leg.fuelSpent,
      overshootRatio: leg.overshootRatio,
      transitSeconds: leg.transitSeconds,
      baseTransitSeconds: leg.baseTransitSeconds,
      arrivalGrant: leg.arrivalGrant,
      // WHAT SURVIVES THE COMMIT. Zero for every burn until §5's Cryo rows exist, and the reason it
      // is a field rather than a subtraction on a screen is that it is an ECONOMIC fact and not a
      // layout one: the spend is clamped to the band, so Fuel banked above it is not destroyed — it
      // is waiting at the next rung as a head start on the next fill. See the long note on the
      // clamp in overshootFor(); a panel that had to derive this would be the second place in the
      // app that knows the clamp exists.
      fuelLeftBehind: Math.max(0, leg.fuelHeld - leg.fuelSpent),
      // THE FAR END OF THE OVERSHOOT BAND, so the panel can draw it as a band rather than as a
      // binary. It comes out of overshootFor() — the same expression that clamps the spend — and
      // never from a component multiplying the threshold, which is the drift ledger R1's derivation
      // exists to foreclose.
      tankCeiling: leg.tankCeiling,
      // BOTH ENDS OF THE LEG AS NAMES. `name` above is a sentence with the destination inside it,
      // and a panel that wanted the bare label would otherwise string-slice one out of the other —
      // while the origin appears in no string on the row at all, though a confirm surface has to
      // name the place the burn leaves from.
      originLabel: leg.origin.label,
      destinationLabel: leg.destination.label,
      inFlight: !!inFlightLaunch(slice),
      blockedReason: blockedReasonFor(leg, slice),
    },
  ];
}

// Commits the burn. Returns new state, or null when it is not permitted — refusal is null from the
// engine and an unchanged state from the reducer, exactly as engine/sites.js's purchase() does.
//
// EVERY GATE IS RE-CHECKED HERE THROUGH THE SAME listOffers() THAT DREW THE ROW, rather than
// trusted from it. purchase() is reachable from a dispatch, and an engine that only enforces a rule
// in the function that draws the button is not enforcing it at all. Calling listOffers() rather
// than re-deriving means there is one definition of what is legal and no second copy to drift —
// engine/sites.js makes the same move through candidateBuildFor().
function purchase(state, offerId) {
  const offer = listOffers(state).find((row) => row.id === offerId);
  if (!offer) return null;
  // One test covers in-flight, reach and the threshold, because blockedReasonFor() is the single
  // statement of all three.
  if (offer.blockedReason) return null;

  // THE FUEL DEBIT, THROUGH engine/colony.js AND NOT engine/wallet.js. Fuel lives in
  // `expedition.resources`, so debitWallet() is structurally not how it is spent (§7.3 says so in
  // those words). spendResource() refuses with null rather than flooring at zero — a launch either
  // has enough to leave or it does not, and half a launch is not a thing — and that refusal is
  // honoured here rather than swallowed. It is unreachable on this path, because `fuelSpent` is
  // `min(held, band)` and cannot exceed what is held; it is checked anyway because "unreachable"
  // and "checked" cost the same and only one of them survives a future edit.
  const spent = spendResource(state, LAUNCH_FUEL_RESOURCE, offer.fuelSpent);
  if (!spent) return null;

  const slice = expeditionSlice(spent);
  const clock = Number.isFinite(state.clock) ? state.clock : 0;

  // §7.3's record shape verbatim. `destinationSiteId` in particular is not optional: engine/sites.js
  // reads it in launchCommitGrants() to decide the `deepSpace` phase, and that predicate turns on
  // the record EXISTING rather than on its resolved state — so `deepSpace` opens on the COMMIT of
  // the burn to Ceres, not on its arrival. The eight-minute dead transit belongs to the budget of
  // the phase it opens rather than the one it closes (§7.6). Get this field's name wrong and the
  // phase ladder silently stops climbing.
  const record = {
    id: offer.id,
    originSiteId: offer.originSiteId,
    destinationSiteId: offer.destinationSiteId,
    committedAtClock: clock,
    arrivesAtClock: clock + offer.transitSeconds,
    overshootRatio: offer.overshootRatio,
    resolved: false,
  };

  // Spread the accessor's return value when writing the slice back — engine/concessions.js records
  // the near-miss in full: a key one copy of the shape forgets is a key every later write silently
  // deletes.
  const committed = { ...spent, expedition: { ...slice, launches: [...slice.launches, record] } };

  // THE WIN CONDITION (§7.8). Committing the fifth burn is winning Act VII — a COMMIT and not an
  // arrival, for the same reason the crossing into the act is offered rather than imposed (Decision
  // 3.2): the game's last act should be the player's, not a timer's. The last thing the player does
  // in this game is press a button, and the twelve minutes afterwards are the game's, not theirs.
  //
  // The milestone is set HERE, in the only function a player can reach it through, rather than by
  // anything inside advance(). That is the same argument the no-rng block at the top of this file
  // makes: a win resolved during an offline catch-up is a win resolved in front of nobody.
  return offer.destinationSiteId === OVER_THE_WALL_DESTINATION_ID
    ? withOverTheWallMilestone(committed)
    : committed;
}

// Sets `progression.milestones.overTheWall`, idempotently, returning state by identity when it is
// already set.
//
// GUARDED TO THE LEAF ON THE WAY IN, and the reason is not symmetry with the readers. This is a
// WRITE into `progression`, and a `{ ...state.progression }` over an absent slice would materialise
// a progression object with nothing in it but a milestones bag — which is not a crash today and is
// the kind of thing that becomes one the first time something reads `progression.act` off the
// result. Every save in existence has a progression slice; the guard costs nothing and states that
// this function does not create one.
//
// IT IS NOT A PARALLEL PHASE FLAG, which ledger R4 forbids. `expedition.phase` remains the act's
// single progression signal and this milestone is an INPUT to the predicate that computes it, in
// exactly the way `expedition.launches` is an input to the `deepSpace` predicate. The distinction
// R4 draws is between a second SOURCE OF TRUTH for how far the run has got and a fact the one
// source reads; this is the second kind, and engine/sites.js's overTheWallGrants() is where it is
// read.
function withOverTheWallMilestone(state) {
  const progression = state && state.progression;
  if (!progression) return state;
  const milestones = progression.milestones || {};
  if (milestones[OVER_THE_WALL_MILESTONE] === true) return state;
  return {
    ...state,
    progression: { ...progression, milestones: { ...milestones, [OVER_THE_WALL_MILESTONE]: true } },
  };
}

// THE THRESHOLD OF THE LAUNCH CURRENTLY BEING FILLED — ledger R3's multiplicand, exported for
// engine/contracts.js.
//
// R3 rules that a contract's `payoutPct` resolves against "the threshold of the launch currently
// being filled", superseding §9.2's per-phase table. That quantity is already computed here, by
// currentLeg(), and it is exported rather than reimplemented for the reason
// data/actSevenSitesConfig.js gives about thresholds generally: two copies of one number is a
// retune that moves one and not the other. Worse here than there, because the two copies would not
// even be of a number — they would be of the RULE for finding which burn is being filled, and a
// contract paying a percentage of the wrong launch would look like a balance problem rather than a
// bug.
//
// THE FALLBACK'S PREMISE MOVED WITH STORY-032 AND THE FALLBACK DID NOT, which is worth recording
// because the answer is unchanged and the route to it is not. This comment used to say that
// currentLeg() returns null at the top of the ladder; it now returns the over-the-wall leg instead,
// so between The Swing being built and the fifth burn being committed this function takes the FIRST
// branch and answers `leg.threshold`.
//
// That is the same number. The wall leg departs the Warning Track, so its threshold is the Track's
// `departingThreshold` — 42,000 — and the fallback below, "the departing threshold of the highest
// rung the player has reached", resolves to the Track's 42,000 as well. VERIFIED under `node` rather
// than reasoned about, because engine/contracts.js multiplies `payoutPct` against this value and a
// contract paying a percentage of the wrong burn would look like a balance problem rather than a
// bug.
//
// AFTER the fifth burn is committed, currentLeg() returns null for good and the fallback carries
// the whole of `majors`. That is not an error and must not read as a threshold of zero: `majors`
// still has contracts (§9.5 #12) and they still have to pay something. The last threshold the
// player actually filled is the honest answer to "what is a percentage of the current burn worth"
// for a run that has no burns left.
//
// Returns 0 outside Act VII, where resolvedSites() is empty. Every caller treats a zero threshold
// as "no Fuel payout can be sized yet", which is exactly right in `aftermath` too, where there is
// no tank to put one in.
function currentLaunchThreshold(state) {
  const slice = expeditionSlice(state);
  const leg = currentLeg(state, slice);
  if (leg) return leg.threshold;

  const sites = resolvedSites(state, slice);
  let highest = 0;
  sites.forEach((site) => {
    if (!site.reached) return;
    const threshold = site.departingThreshold;
    if (Number.isFinite(threshold) && threshold > highest) highest = threshold;
  });
  return highest;
}

// ---------------------------------------------------------------------------------------------
// ARRIVAL
// ---------------------------------------------------------------------------------------------

// Resolves every launch whose window has closed: flips `resolved`, marks the destination reached,
// and pays the overshoot's arrival grant.
//
// IDEMPOTENT BY CONSTRUCTION, WHICH IS THE ONLY WAY THIS IS SAFE. A resolved record is never
// resolved again — `isDue()` requires `resolved !== true` — so a second pass finds nothing and
// returns the state it was handed BY IDENTITY. That matters far more than it looks: advance() runs
// identically live and on load with only `deltaSeconds` differing, and one offline iteration can
// span eight hours. A path that fired per-elapsed-window instead of per-pending-record would mark a
// site reached twice, or pay the arrival grant once per iteration for the rest of the catch-up.
//
// markSiteReached() is idempotent for the same reason and returns identity for a site already
// reached, so even a hand-edited save that carries two records for one destination pays no double
// arrival — the second is a no-op on the site, though it would pay its own grant, which is the
// correct reading of a save that claims two burns landed.
//
// RESOLVED IN CLOCK ORDER. With one launch in flight at a time there can only be one due record, so
// the sort is defensive rather than load-bearing — but "defensive" is the wrong word for the case
// it covers: a save hand-edited, or a future story that ever allows two, would otherwise resolve
// arrivals in save order, which is commit order, which is NOT necessarily arrival order once
// overshoot can shorten a transit. Ordering by the clock costs a comparison and means the log reads
// in the order the player lived it.
//
// THE FIFTH BURN RESOLVES THROUGH THIS FUNCTION UNCHANGED, AND THAT IS THE FINDING RATHER THAN AN
// OMISSION (§7.8, STORY-032). Its record sits in `launches` like any other, so it is due at its own
// `arrivesAtClock`, it flips `resolved` in the same pass, and it is never resolved twice. The two
// grants it would otherwise pay both abstain on guards that already existed: markSiteReached()
// looks for a site with the id `beyondTheWall`, finds none, and returns state BY IDENTITY; and
// arrivalGrantFor() looks for a colonization cost it has no definition for and returns 0. Nothing
// was added here to make the win land on nothing — not being a site is already what that means.
//
// What the resolution DOES do is move `expedition.phase` to `majors`, and it does that from
// somewhere else entirely: engine/sites.js's overTheWallGrants() reads this same list for an
// unresolved wall record, so flipping `resolved` here is what lets the phase writer promote the run
// on the very next line of the tick loop. The milestone was set twelve minutes earlier at commit;
// this is the arrival the phase has been waiting on.
//
// The grant is a SALVAGE CREDIT through engine/wallet.js, and that is not in tension with the Fuel
// debit above refusing to go near the wallet. Fuel is not a wallet currency; Salvage is. Guarded on
// `> 0` for the same reason creditIncome() guards its Salvage line: crediting zero would write a
// key into the wallet of a save that has none, and shape churn on a path every tick travels breaks
// the by-identity return that lets an unchanged tick be proven unchanged.
function resolveArrivals(state) {
  const slice = expeditionSlice(state);
  if (slice.launches.length === 0) return state;
  const clock = Number.isFinite(state.clock) ? state.clock : 0;

  const due = slice.launches.filter((launch) => isDue(launch, clock));
  if (due.length === 0) return state;

  const inOrder = due
    .slice()
    .sort((a, b) => (Number.isFinite(a.arrivesAtClock) ? a.arrivesAtClock : 0) - (Number.isFinite(b.arrivesAtClock) ? b.arrivesAtClock : 0));

  let working = {
    ...state,
    expedition: {
      ...slice,
      launches: slice.launches.map((launch) => (isDue(launch, clock) ? { ...launch, resolved: true } : launch)),
    },
  };

  inOrder.forEach((launch) => {
    // THE SINGLE WRITER OF `reached` IS engine/sites.js, and this is the call it was exported for.
    // Writing the site record here instead would give site records two authors and the shape note
    // in engine/colony.js two places to stay true.
    working = markSiteReached(working, launch.destinationSiteId);
    const grant = arrivalGrantFor(launch);
    if (grant > 0) working = { ...working, wallet: creditWallet(working.wallet || {}, ARRIVAL_GRANT_CURRENCY, grant) };
  });

  return working;
}

// The clock at which the burn in flight lands; Infinity when none is.
//
// CONTRACT (engine/tickEngine.js's contributor list): pure, guards its own slice, and returns
// Infinity — never 0, null or undefined — when nothing is pending. Returning 0 pins advance()'s
// step at zero and burns all 2,000 safetyCapIterations without moving the clock, silently
// discarding the rest of a returning player's eight hours.
//
// OVERDUE RECORDS ARE EXCLUDED, for the same reason nextBuildClock() excludes them and it is the
// whole reason this is not a one-liner. A record whose `arrivesAtClock` is already in the past is
// not a future event — proposing it makes `step` zero for that iteration, and while resolveArrivals()
// at the foot of the same iteration does clear it, the loop has burned an iteration on a step of
// nothing. The case is reachable for real: a burn committed at the instant a step boundary lands,
// or a save hand-edited, or the corrupt no-window record isDue() deliberately treats as due.
//
// At most ONE boundary, ever, because at most one launch is in flight — so this section adds a
// single event to an eight-hour catch-up against a safety cap of 2,000. §7.3's O(6) estimate for
// the whole of §7 holds with room to spare.
function nextArrivalClock(state) {
  const slice = expeditionSlice(state);
  if (slice.launches.length === 0) return Infinity;
  const clock = Number.isFinite(state.clock) ? state.clock : 0;

  return slice.launches.reduce((soonest, launch) => {
    if (!isUnresolved(launch)) return soonest;
    if (!Number.isFinite(launch.arrivesAtClock) || launch.arrivesAtClock <= clock) return soonest;
    return Math.min(soonest, launch.arrivesAtClock);
  }, Infinity);
}

module.exports = {
  listOffers,
  purchase,
  resolveArrivals,
  nextArrivalClock,
  overshootFor,
  currentLaunchThreshold,
  // STORY-039's Launch panel. See the long note on the function for why the burn under way cannot
  // be read off a shop row.
  inFlightReadout,
};
