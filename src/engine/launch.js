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
  transitSecondsFrom,
  launchCopy,
} = require('../data/actSevenLaunchConfig');
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
  const fuelSpent = Math.min(held, OVERSHOOT_TANK_MULT * threshold);
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

  return { fuelSpent, overshootRatio, transitSeconds, arrivalGrant };
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

// ---------------------------------------------------------------------------------------------
// THE SHOP
// ---------------------------------------------------------------------------------------------

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

  const destination = sites.find((site) => !site.reached);
  // EVERY RUNG REACHED IS NOT AN ERROR, IT IS THE ENDING. The fifth burn departs the Warning Track
  // for a place §7.1 refuses to call a site — no rung, no record, no arrival — so there is no
  // destination row for it here and STORY-032 owns the win condition instead. Returning null means
  // the launch shop correctly empties at the top of the ladder rather than offering a burn to
  // nowhere.
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
  return { ...spent, expedition: { ...slice, launches: [...slice.launches, record] } };
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
};
