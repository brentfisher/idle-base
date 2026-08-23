// Act VII — the odyssey's colony. Pure: no React, no DOM, no Date.now(), no bare Math.random().
//
// This file will eventually own the whole colony simulation (PRD §5.8): colonyRates(),
// integrateColony(), nextColonyThresholdClock(), spendResource() — which is Fuel's debit path, since
// Fuel lives in state.expedition and engine/wallet.js is therefore NOT how it is spent — and the
// module shop's listOffers()/purchase(). Today it carries only the slice accessor, because the shape
// has to land before anything can be written against it. It is created here rather than somewhere
// more convenient so that no story has to move it later and every intervening import is already
// pointing at the right module.
//
// Nothing outside this file may reach into state.expedition directly.
const {
  INITIAL_PHASE,
  EXPEDITION_RESOURCES,
  EXPEDITION_RESOURCE_IDS,
  EXPEDITION_MODULES,
  SOLVE_MAX_PASSES,
  SOLVE_EPSILON,
  COLONY_MIN_STEP_SECONDS,
  OUTPUT_MULTIPLIER_KEYS,
  DRAW_MULTIPLIER_KEY,
} = require('../data/actSevenConfig');
const {
  ACT_SEVEN_SITES,
  padUpkeepAt,
  siteFuelCapacity,
} = require('../data/actSevenSitesConfig');
// THE CONTRACT DRAW ARRIVES AS A CONFIG TABLE AND NOT AS AN ENGINE IMPORT, AND THAT IS FORCED.
//
// engine/contracts.js needs expeditionSlice, colonyRates, spendResource and creditResource from
// this file — it cannot not. If this file required contracts.js back for the upkeep term, CommonJS
// would resolve the cycle by handing whichever module loaded second a half-built exports object:
// invisible at require time, an undefined function on the first tick. That is the identical hazard
// written up at length over resolvedSites() below, and it is resolved the identical way — the
// SHAPE lives with the gatekeeper, the TABLE lives in config, and contracts.js re-exports the
// result so its published surface is the one PRD §9.6 specifies.
const { createContractBoard, contractDrawFor } = require('../data/actSevenContractsConfig');
const { computeModifiers } = require('./modifiers');
const { getUnlockedFeatures } = require('./progression');

// One resource's stored record, normalized. Split out because the two fields default by DIFFERENT
// rules and that difference is the whole point.
//
// `capacity` uses Number.isFinite, not `|| base`. Fuel's base capacity is 0 and a stored capacity of
// 0 is a legitimate value for any of the four — the `||` idiom cannot tell "not stored" from
// "stored as zero", which is exactly the trap the odyssey design doc flags for act rules
// (`playoffTeams: 0` silently doing nothing). Today it would be invisible, because for fuel the
// stored 0 and the base 0 agree; the day a mechanic lowers a capacity, `||` would quietly restore
// the base ceiling and let the player over-fill a tank they no longer own.
//
// `amount` ALSO uses Number.isFinite, and it did not have to before this story. The absent-vs-zero
// trap above genuinely is inert for `amount` — 0 is its default, so `|| 0` cannot lose information
// — but `|| 0` is not only a defaulting idiom, it is also the thing that lets a non-number through.
// `('lots' || 0)` is `'lots'`, and `Math.max(0, 'lots')` is NaN.
//
// That was harmless while nothing read a stored amount into a rate. It is not harmless now. NaN
// flows amount -> net -> `distance / rate` -> the clock this file hands findNextEventClock(), and
// `advance()` then computes `step` as NaN, `remaining -= NaN` as NaN, and exits its loop on the
// first iteration because `NaN > 0` is false. The clock is NaN from then on and every subsequent
// tick does nothing: not a wrong number, a permanently frozen game. And it is unrepairable by play,
// because every comparison against a NaN stock is false, so the stock can never be filled, spent or
// clamped back into range.
//
// Measured: without this line, a save carrying `power.amount = 'lots'` returns a NaN threshold clock
// and a NaN clock out of an 8h advance(). With it, that save reads as an empty tank and plays.
// Coercing silently is the safe behaviour here rather than the sloppy one — the same argument
// engine/wallet.js's sanitizeAmount() makes, for the same reason.
function normalizeResource(stored, resource) {
  const record = stored || {};
  const amount = Number.isFinite(record.amount) ? record.amount : 0;
  const capacity = Number.isFinite(record.capacity) ? record.capacity : resource.baseCapacity;
  return { amount: Math.max(0, amount), capacity: Math.max(0, capacity) };
}

// `puzzles` is the one field keyed by id rather than listed, so it needs its own guard. Array.isArray
// is excluded explicitly because `typeof [] === 'object'` — an array here is a corrupt save, and
// letting one through would give every `puzzles[puzzleId]` lookup an undefined instead of a default.
function isPuzzleMap(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// The contract board, normalized against the ONE base literal in data/actSevenContractsConfig.js.
// The literal is called rather than spread from a shared constant because the two ids arrays are
// mutable: a shared constant would give a brand new game and a defaulted old save the same array
// object, and one stray push would write one run's ledger into another's slice.
function normalizeContractBoard(stored) {
  const base = createContractBoard();
  const record = stored || {};
  return {
    nextOfferAtClock: Number.isFinite(record.nextOfferAtClock)
      ? record.nextOfferAtClock
      : base.nextOfferAtClock,
    completedIds: Array.isArray(record.completedIds) ? record.completedIds : base.completedIds,
    missedIds: Array.isArray(record.missedIds) ? record.missedIds : base.missedIds,
  };
}

// Every read of the Act VII slice goes through this. It is the pattern engine/concessions.js,
// engine/wallBall.js and engine/walkupSongs.js all use, and it is what makes this codebase's
// no-migration rule survivable: persistence/saveLoad.js DISCARDS a save whose meta.version differs
// and there is no migration function, so a slice added today is only safe if absent reads as empty.
// This story shipped no version bump, which means every save in existence reaches this function with
// `state.expedition` undefined.
//
// LOAD-BEARING BEYOND DEFAULTING, and worth reading before editing: the house shop contract spreads
// this function's return value when it writes the slice back (engine/concessions.js's purchase() is
// the worked example, and its comment records the near-miss). A key this function forgets is
// therefore not merely undefined at the read — it is a key that every later write to the slice
// silently DELETES. Any field added to state.expedition must be added here in the same edit.
//
// The resources map is rebuilt from the configured list rather than adopted from the save, for two
// reasons. A save carrying only some of the four — one written between the story that adds a
// resource and the save after it — still yields all four, so no caller has to guard a lookup. And
// because every nested object returned is fresh, the result shares no reference with `state`: a
// caller that mutates what it gets back cannot reach into the store through it.
function expeditionSlice(state) {
  const slice = (state && state.expedition) || {};
  const storedResources = slice.resources || {};
  const resources = EXPEDITION_RESOURCES.reduce((acc, resource) => {
    acc[resource.id] = normalizeResource(storedResources[resource.id], resource);
    return acc;
  }, {});

  return {
    phase: slice.phase || INITIAL_PHASE,
    resources,
    modules: Array.isArray(slice.modules) ? slice.modules : [],
    sites: Array.isArray(slice.sites) ? slice.sites : [],
    // An object, not an array: keyed by puzzle id, so an absent puzzle is simply an absent key.
    puzzles: isPuzzleMap(slice.puzzles) ? slice.puzzles : {},
    contracts: Array.isArray(slice.contracts) ? slice.contracts : [],
    // The board's bookkeeping (PRD §9.3): when a refresh may next place an offer, the payout-once
    // ledger, and the lapsed ids eligible to return as Makeup Games.
    //
    // DEFAULTED FIELD BY FIELD, NEVER AS `slice.contractBoard || {}`. The whole-object form leaves
    // `completedIds` undefined on a save written one version before this shipped, and the first
    // `completedIds.indexOf(...)` in engine/contracts.js throws inside advance() — which is the tick
    // loop, so the game stops rather than misbehaves.
    //
    // `nextOfferAtClock` uses Number.isFinite and NOT `|| 0`, and 0 is exactly why: a fresh board
    // stores 0 to mean "a refresh may happen now", so the `||` idiom cannot tell a legitimate zero
    // from an absent key. It is also what keeps a corrupt `nextOfferAtClock: 'soon'` out of the
    // event-clock contributor — a non-numeric boundary becomes a NaN step and a NaN step freezes
    // the game permanently. See normalizeResource() above for the full account of that failure.
    contractBoard: normalizeContractBoard(slice.contractBoard),
    // In-flight AND completed launches share one list (PRD §4). An in-flight record is one with
    // `resolved: false` and an `arrivesAtClock`, which is what makes arrival resolution idempotent
    // by construction rather than needing a separate slot to reconcile.
    launches: Array.isArray(slice.launches) ? slice.launches : [],
    // ---------------------------------------------------------------------------------------
    // THE RUN RECORD (PRD §7.8, STORY-032). Two scalars the ending reads and nothing else does.
    //
    // Earth's placement on the majors board is computed from the run, deterministically, and one of
    // its inputs is a quantity no other part of the act had a reason to remember: THE BEST NET FUEL
    // RATE THE NETWORK EVER REACHED, written by integrateColony() below. `standingOrders` is the
    // post-game ladder's counter.
    //
    // NOTE WHAT IS DELIBERATELY *NOT* HERE. The board also needs the clock at which Act VII began,
    // and this story nearly added a third field for it before finding that
    // `progression.actEnteredAtClock` has carried exactly that since STORY-004 — written by
    // enterAct() on every act boundary and already read by engine/narrative.js for the same kind of
    // question. Two clocks answering one question is the drift the header of
    // data/actSevenConfig.js exists to forbid, so engine/board.js reads the one that exists.
    //
    // BOTH DEFAULT WITH Number.isFinite AND NEVER WITH `|| default`, which is the rule this whole
    // accessor exists to hold and it bites on each. `peakFuelRate: 0` is the correct reading of a
    // colony that has never made a drop of Fuel and `standingOrders: 0` is every run that has not
    // won — the `||` idiom cannot tell either from an absent key.
    peakFuelRate: Number.isFinite(slice.peakFuelRate) && slice.peakFuelRate > 0 ? slice.peakFuelRate : 0,
    standingOrders: Number.isFinite(slice.standingOrders) && slice.standingOrders > 0
      ? Math.floor(slice.standingOrders)
      : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// THE SITE RECORDS, RESOLVED — and why this lives in colony.js rather than in engine/sites.js.
//
// engine/sites.js owns every RULE about sites: what may be colonized, what a pad costs, when a
// build completes, and the phase ladder. It does not own the record SHAPE, because three separate
// modules need a resolved site and only one of them is sites.js — engine/colony.js needs the
// production, upkeep and Fuel-capacity terms for its solve, and engine/actSevenModules.js needs the
// capability flags for its buildability gate. If sites.js owned the shape, both of those would have
// to import it while it imports expeditionSlice from here, and CommonJS resolves that cycle by
// handing whichever module loads second a half-built exports object. That failure is invisible at
// require time and shows up as an undefined function on the first tick.
//
// Putting the resolution beside expeditionSlice() is also just the truthful place for it. This file
// already declares itself the slice's gatekeeper — "nothing outside this file may reach into
// state.expedition directly" — and turning a stored record into a usable one is exactly that job.
// sites.js consumes this the same way every other caller does.
//
// ---------------------------------------------------------------------------------------------
// THE STORED RECORD IS DELIBERATELY TINY, AND EVERYTHING ELSE IS DERIVED FROM CONFIG EVERY READ.
//
//   stored    { id, reached, colonized, launchPadTier, buildingId, readyAtClock }
//   derived   rung, upkeepFactor, baseUpkeep, produces, fuelCapacityOnArrival, the capability
//             flags, the phase this site grants, its colonize cost and window
//
// That split is the no-migration rule doing real work. Saves are never migrated in this codebase —
// persistence/saveLoad.js DISCARDS a save whose meta.version differs and there is no migration
// function — so anything denormalized into a save record is frozen at the value it had the day it
// was written. Copy `vacuumSolar` or a Fuel grant into the record and a balance edit silently
// applies to new games only, which is the worst possible shape for a bug: it is invisible to the
// person who made the edit and permanent for the player who has been playing longest.
//
// It also means HOME PLATE NEEDS NO STORED RECORD AT ALL. It is reached and colonized before the
// act begins, and a fresh save's `sites: []` already says so correctly once `reachedAtStart` is
// what answers the question. A save only grows a site record when the player DOES something to a
// site, which keeps the persisted slice proportional to what has actually happened.
// ---------------------------------------------------------------------------------------------

// The feature id the site terms are gated on, and the gate exists because Home Plate's 2.0 O2/s is
// otherwise live in Act I.
//
// GATED ON ITS OWN UNLOCK RATHER THAN THE ACT INDEX, which is the argument engine/income.js makes
// for the Salvage faucet and it is the same feature id for the same reason: `ops` is the one Act
// VII tab with no `unlockedBy` entry, so it is live from the act boundary — exactly when the
// expedition starts existing. An act-index check would be a second place that knows the arc's
// shape, and derived-never-stored means a retune of the boundary should take effect on an existing
// save with no migration.
//
// THIS IS WHAT KEEPS "advance() IS BYTE-FOR-BYTE UNCHANGED FOR EVERY PRE-ACT-VII SAVE" TRUE, and
// that guarantee got harder to hold with this story rather than easier. Before it, the colony was
// inert because the module list was empty and an empty list sums to zero — a structural fact that
// needed no gate. Home Plate is not empty: it is reached, colonized and producing from the first
// second the expedition exists. Without this gate every Act I save would accrue Oxygen, materialise
// an `expedition` slice through integrateColony(), and hand findNextEventClock() a boundary 50
// seconds out, chopping every step in the first six acts into 50-second pieces. Nothing in the
// build catches any of that, and the last symptom is the one a player would notice.
const EXPEDITION_SITE_FEATURE = 'ops';

function isExpeditionLive(state, phase) {
  const progression = state && state.progression;
  if (!progression) return false;
  const features = getUnlockedFeatures(progression.act, phase);
  return features.indexOf(EXPEDITION_SITE_FEATURE) !== -1;
}

// One resolved record per CONFIGURED site, in ladder order, joined to whatever the save holds.
// Config order rather than save order, so a hand-edited or reordered `sites` array cannot change
// the rung ordering that the whole ladder's strictness rests on.
//
// Returns [] outside Act VII — see the gate above. Every caller therefore iterates an empty list
// for six acts and needs no act check of its own.
function resolvedSites(state, slice) {
  const resolved = slice || expeditionSlice(state);
  if (!isExpeditionLive(state, resolved.phase)) return [];
  return ACT_SEVEN_SITES.map((definition) => {
    const stored = resolved.sites.find((site) => site && site.id === definition.id);
    return resolveSiteRecord(definition, stored);
  });
}

// `=== true` throughout rather than truthiness, because these three fields arrive from a save file
// and the truthy values that are not `true` are all corruption: a stored `reached: 'yes'` should
// read as reached, but a stored `reached: {}` from a mangled write should not silently colonize a
// site the player never flew to. Explicit is cheap here and the failure it prevents is unrecoverable
// by play — nothing in the act can UN-reach a site.
//
// A build with no finite `readyAtClock` is treated as no build at all, and that pairing is
// load-bearing rather than tidy. `buildingId` is what makes a site busy (one build per site, §7.7);
// `readyAtClock` is what makes it finish. A record carrying the first without the second is a site
// that is permanently occupied and can never complete — a soft-lock on that rung, and on the whole
// ladder above it, that no amount of play repairs. Reading the pair as idle turns a corrupt save
// into a lost build instead of a dead run.
function resolveSiteRecord(definition, stored) {
  const record = stored || {};
  const reached = definition.reachedAtStart === true || record.reached === true;
  const colonized = reached && (definition.colonizedAtStart === true || record.colonized === true);

  const storedTier = Number.isFinite(record.launchPadTier) ? record.launchPadTier : 0;
  const startingTier = reached && Number.isFinite(definition.startingPadTier) ? definition.startingPadTier : 0;

  const readyAtClock = Number.isFinite(record.readyAtClock) ? record.readyAtClock : null;
  const building = typeof record.buildingId === 'string' && readyAtClock !== null;

  return {
    ...definition,
    reached,
    colonized,
    launchPadTier: Math.max(0, storedTier, startingTier),
    buildingId: building ? record.buildingId : null,
    readyAtClock: building ? readyAtClock : null,
    // Ledger R1's tank floor, recomputed from the site's departing threshold on every read so it
    // cannot be stale in a save. Whether it is GRANTED is a separate question the capacity sum
    // answers — see colonyCapacity().
    fuelCapacityOnArrival: siteFuelCapacity(definition),
  };
}

// Adds a `{ resourceId: perSecond }` bundle into an accumulator, dropping anything non-finite or
// non-positive. Shared by the site upkeep and site production sums because both are flat per-site
// rate tables and both must reject a corrupt one identically: a NaN reaching a rate poisons every
// comparison downstream, and a poisoned rate cannot be repaired by play (see normalizeResource).
function addRates(accumulator, rates) {
  Object.keys(rates || {}).forEach((resourceId) => {
    const rate = rates[resourceId];
    if (!Number.isFinite(rate) || rate <= 0) return;
    if (accumulator[resourceId] === undefined) return;
    accumulator[resourceId] += rate;
  });
}

// THE NETWORK'S FLAT LIFE-SUPPORT DRAW: each colonized site's colony base upkeep, plus its pad's
// upkeep scaled by that site's `upkeepFactor` (§7.2). Constant in time within a step, like every
// other term in this file, which is what keeps nextColonyThresholdClock a closed-form solve.
//
// GATED ON `colonized`, NOT ON `reached`. A site you have flown to but not paid for has no colony
// on it and therefore nothing to keep alive — which is what makes colonization a decision with a
// running cost rather than a one-off fee, and what lets a player arrive at the Warning Track and
// look at the number before committing to it.
//
// The pad term rides on the same flag because a pad can only be built on a colonized site. Home
// Plate is the one site holding a pad without ever having been colonized by the player, and its
// tier-1 Sandlot has an upkeep of exactly nothing — Earth is not being kept alive by this network.
function siteUpkeepPerSecond(sites) {
  const upkeep = zeroedByResource();
  sites.forEach((site) => {
    if (!site.colonized) return;
    addRates(upkeep, site.baseUpkeep);
    if (site.launchPadTier > 0) addRates(upkeep, padUpkeepAt(site, site.launchPadTier));
  });
  return upkeep;
}

// The free half of §5.6's gross: production that belongs to a PLACE rather than to a machine.
// Home Plate's 2.0 O2/s is the only entry in the act.
//
// IT IS OUTSIDE BOTH THROTTLES, AND THAT IS THE WHOLE REASON IT IS SUMMED SEPARATELY FROM THE
// MODULE LOOP RATHER THAN FOLDED INTO IT. A planet does not ration itself when the colony is short
// of Power, and it does not back off when your tank is full — there is nobody out there deciding.
// So it takes neither `throughput` (the rationing term) nor `extraThrottle` (the load-follow term).
//
// It also takes NO OUTPUT MULTIPLIER, and the asymmetry with site upkeep is deliberate rather than
// an oversight: §5.6 puts `drawMult` on the site draw term and no `outMult` on the site production
// term. A powerup that makes your scrubbers work harder is a statement about your equipment; there
// is no equipment here. Getting this backwards would be invisible until §5.9's powerups land and
// would then read as Earth's atmosphere responding to a battery upgrade.
//
// The consequence at the full end is handled by the pin in colonyRates(): a resource at capacity
// whose surplus comes from here cannot be load-followed away, so its net is assigned exactly 0
// rather than computed — otherwise it would report a boundary it is already standing on, every
// iteration, forever.
function siteProductionPerSecond(sites) {
  const gross = zeroedByResource();
  sites.forEach((site) => {
    if (!site.colonized) return;
    addRates(gross, site.produces);
  });
  return gross;
}

// ---------------------------------------------------------------------------------------------
// The consumption model (PRD §5.6 / §5.7, odyssey design.md Decision 3.3).
//
// The rest of the game's income is monotonic and additive: totalIncomePerSecond() returns a
// per-currency bundle that is always >= 0 and creditWallet() structurally refuses a negative. The
// consumables cannot go through that path. They have capacities, they carry SIGNED net rates, and
// their rates are the output of a fixed-point solve rather than a sum — so they get this sibling
// path, and advance() runs the two side by side sharing nothing but the step.
//
// THE INVARIANT THIS FILE EXISTS TO HOLD (design.md Decision 6, restated for consumables):
// nothing here destroys anything. A starved colony is THROTTLED, never broken. No module is
// removed, no colonist dies, no stock is zeroed, no currency goes below zero and no affordable
// purchase is refused. A player who walks away and comes back to a colony that ran out of Power
// finds it idling at a reduced ration with everything they bought still there. That is the whole
// promise of an idle game and it is not a balance target — it is a structural property of this
// file, which is why the recovery path (buy another generator) is monotone: every RTG raises the
// numerator of a fixed point whose denominator is fixed.
//
// THE THREE RULES THAT MAKE THE OFFLINE PATH EXACT RATHER THAN APPROXIMATE:
//
//   1. Rates are LINEAR IN TIME within a step. Everything below is computed once at the start of
//      a step from the stocks at that instant and held constant for its duration. No compounding,
//      no rate-depends-on-stock term inside the step. That is what turns "when does this resource
//      hit its boundary" into a division instead of a numerical search.
//   2. The only instants a rate can change are the boundaries nextColonyThresholdClock() returns,
//      plus the instants the player acts — and no player acts while offline. So a piecewise
//      constant model that steps TO each boundary is not an approximation of the continuous
//      answer, it IS the continuous answer.
//   3. demand[r] is computed at FULL OUTPUT, never from actual throttled draw. See the long note
//      on demandAtFullOutput() — this is the one line an implementer is most likely to "improve"
//      and it is what makes a pinned resource absorbing instead of chattering.
// ---------------------------------------------------------------------------------------------

// PRD §5.9's multipliers, read defensively. The keys are not registered in BONUS_KEYS yet, so
// computeModifiers() does not emit them and every read here lands on the `1` default — the solve
// is arithmetically identical to having no multiplier at all. Number.isFinite rather than
// `|| 1` for the same reason the capacity default uses it: a legitimate 0 must be distinguishable
// from absent, and a `lifeSupportDrawMult` of 0 (a colony that draws nothing) is a value a future
// permanent could plausibly reach through the clamp floor.
function multiplierOf(modifiers, key) {
  const value = modifiers && modifiers[key];
  return Number.isFinite(value) ? value : 1;
}

function outputMultiplier(modifiers, resourceId) {
  return multiplierOf(modifiers, OUTPUT_MULTIPLIER_KEYS[resourceId]);
}

// The owned catalogue entries, joined to their counts.
//
// EXPEDITION_MODULES is indexed HERE, on every call, rather than into a module-level by-id map
// built once at load. That looks wasteful and it is deliberate: `FINAL_ACT_INDEX` in data/acts.js
// is `ACTS.length - 1` captured at module load, and it has twice caused a test that appended to
// ACTS to pass for the wrong reason because the appended entry was clamped away invisibly. A
// load-time map here would do exactly that to every synthetic colony a `node` harness injects —
// the injection would be invisible, every rate would solve to zero, and an offline-safety suite
// would go green having simulated nothing. The catalogue is four to twenty entries and this runs
// a handful of times per advance() iteration; the cost is not measurable against simulateGame().
//
// A count that is not a positive finite number is dropped rather than coerced, and an id with no
// catalogue entry is dropped too: a save carrying a module from a version where it existed must
// not be able to inject a NaN into a rate, because a NaN rate poisons every comparison downstream
// and a poisoned rate cannot be repaired by play.
function ownedModules(slice) {
  const owned = [];
  slice.modules.forEach((entry) => {
    if (!entry || typeof entry.id !== 'string') return;
    const count = entry.count;
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return;
    const definition = EXPEDITION_MODULES.find((module) => module.id === entry.id);
    if (!definition) return;
    owned.push({ definition, count });
  });
  return owned;
}

function zeroedByResource() {
  return EXPEDITION_RESOURCE_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});
}

// A module's rationing throughput: the minimum satisfaction across everything it eats. A module
// with no inputs (the RTG) runs at full output always, which is not a special case in the code but
// IS the structural guard that keeps the fixed point off zero — see the note on solveSatisfaction.
function throughputOf(definition, satisfaction) {
  const consumes = definition.consumes || {};
  let throughput = 1;
  Object.keys(consumes).forEach((resourceId) => {
    const factor = satisfaction[resourceId];
    if (Number.isFinite(factor) && factor < throughput) throughput = factor;
  });
  return throughput;
}

// demand[r] AT FULL OUTPUT. Constant across the whole solve, which is why it is computed once
// outside the iteration rather than recomputed per pass.
//
// DO NOT "IMPROVE" THIS BY RECOMPUTING IT FROM ACTUAL THROTTLED DRAW. It reads like an obvious
// inconsistency — the colony plainly is not drawing this much — and repairing it breaks the
// offline path. Recomputed from actual draw, a resource pinned at zero whose consumers happen to
// be throttled harder by some OTHER input ends up with a small positive net rate. It lifts off
// zero, which un-throttles it next step, which drains it back to zero, which pins it again: an
// unbounded sequence of microscopic boundary crossings, each one an advance() iteration, burning
// balanceConfig.safetyCapIterations on an offline return and silently discarding the rest of the
// player's eight hours. Demand at full output makes the pinned state ABSORBING, and the price is
// stated openly in §5.6: surplus arising from a consumer throttled elsewhere is discarded. That is
// a small, explicit loss of conservation bought in exchange for exactness at the boundary.
//
// A pinned resource un-pins on an EVENT — the player buys a generator, or a downstream module
// load-follows off — never on continuous drift.
//
// THE SITE TERM IS HERE, AND SO — AS OF THIS STORY — IS THE CONTRACT TERM. STORY-027 named this
// landing site in advance and the reason it gave is the reason it is honoured: a contract drawing 3
// Power/s is a consumer like any other, and folded in AFTER the solve it can push a resource
// through zero inside a step, which is the precise failure this whole file prevents. Ledger R5
// states the same rule from the other end — "an expedition contract that draws 3 Power/sec is a
// consumer like any other; if it is added after the solve, a contract can push a resource through
// zero inside a step."
//
// Concretely, what folding it in later would cost: the ration would be solved against a demand the
// colony does not actually face, `net` would be computed from that wrong ration, and
// nextColonyThresholdClock() would report the resource's boundary at the wrong instant — or not at
// all. During an eight-hour catch-up that means the pre-crossing rate applied across the whole
// absence, with nothing thrown and nobody told.
//
// Site upkeep AND contract upkeep are both multiplied by `drawMult` (§5.6), unlike site production
// which takes no output multiplier. Life support is life support wherever it is being drawn — a
// permanent that makes the colony frugal makes the whole network frugal, including the pads and
// including a crew that is currently off the board.
function demandAtFullOutput(owned, drawMult, sites, contractDraw) {
  const demand = zeroedByResource();
  owned.forEach(({ definition, count }) => {
    const consumes = definition.consumes || {};
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      const rate = consumes[resourceId];
      if (Number.isFinite(rate) && rate > 0) demand[resourceId] += drawMult * count * rate;
    });
  });

  const upkeep = siteUpkeepPerSecond(sites);
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    demand[resourceId] += drawMult * upkeep[resourceId];
    const contracted = contractDraw ? contractDraw[resourceId] : 0;
    if (Number.isFinite(contracted) && contracted > 0) demand[resourceId] += drawMult * contracted;
  });
  return demand;
}

// An instance is drawing only while it is `active`. An offer sitting on the board costs nothing and
// a claimable one has already finished — the crew is home, the drill is over.
//
// `=== 'active'` rather than a truthiness test on some flag, matching the `=== true` discipline
// resolveSiteRecord() applies to every save-borne field: these records come off disk and the values
// that are not the authored ones are all corruption.
function isActiveContract(instance) {
  return !!instance && instance.status === 'active';
}

// Which row in data/actSevenContractsConfig.js's draw table an instance answers to. The config id
// for the eleven authored contracts; the drawn template id for a rotating `majors` one, so
// Organizational Depth's crew template draws the same crew Waiver Claim does without either row
// restating the numbers.
function contractDrawSourceId(instance) {
  return (instance && instance.templateId) || (instance && instance.id) || null;
}

// THE SUM OVER ACTIVE CONTRACTS, in the same shape and with the same guards as siteUpkeepPerSecond.
// It lives here rather than in engine/contracts.js because of the cycle argued at the top of this
// file, and because this file is the slice's declared gatekeeper — "nothing outside this file may
// reach into state.expedition directly", and a contract's draw is a read of state.expedition.
//
// TWO KINDS OF DRAW, and the second is the interesting one.
//
//   flat           a constant per-second bundle. Waiver Claim's crew: 3 Power, 1 Provision.
//   grossFraction  a fraction of production AT FULL OUTPUT. Rain Delay's 40% Power drill.
//
// The fraction is evaluated against `grossProduction(owned, ALL_SATISFIED, ...)` and NOT against
// the solved gross, and that distinction is what keeps this safe to put inside `demand`. Gross at
// full output depends only on owned modules, sites and modifiers — every one of them constant
// within a step — so `demand` stays constant across the whole solve exactly as solveSatisfaction()
// requires, and the monotonicity argument the convergence proof rests on is untouched. Evaluated
// against the SOLVED gross it would be a term that moves as the ration moves, the fixed point would
// no longer be monotone, and the iteration could oscillate forever.
//
// The full-output gross is computed LAZILY and at most once, because the overwhelmingly common case
// is no proportional draw at all: eleven of the twelve contracts have none, and for every act
// before Act VII the active list is empty and this function returns on its first line.
function contractDrawPerSecond(slice, owned, modifiers, sites) {
  const draw = zeroedByResource();
  const active = slice.contracts.filter(isActiveContract);
  if (active.length === 0) return draw;

  let fullOutput = null;
  active.forEach((instance) => {
    const spec = contractDrawFor(contractDrawSourceId(instance));
    if (!spec) return;
    addRates(draw, spec.flat);
    if (!spec.grossFraction) return;
    if (!fullOutput) {
      const allSatisfied = EXPEDITION_RESOURCE_IDS.reduce((acc, id) => {
        acc[id] = 1;
        return acc;
      }, {});
      fullOutput = grossProduction(owned, allSatisfied, modifiers, null, sites);
    }
    Object.keys(spec.grossFraction).forEach((resourceId) => {
      const fraction = spec.grossFraction[resourceId];
      if (!Number.isFinite(fraction) || fraction <= 0) return;
      if (draw[resourceId] === undefined) return;
      const produced = fullOutput[resourceId];
      if (!Number.isFinite(produced) || produced <= 0) return;
      draw[resourceId] += fraction * produced;
    });
  });
  return draw;
}

// PRD §9.6's `contractUpkeepPerSecond(state)`, and the function ledger R5 names. Re-exported by
// engine/contracts.js so that module's published surface is the one §9.6 specifies; implemented
// here because of the cycle argued at the top of this file.
//
// Returns all four resource ids rather than §9.6's `{ power, oxygen, provisions }`. A superset is
// the safe direction — every caller indexes by id — and it means a future contract that draws Fuel
// needs no signature change and no second guard at the one call site that matters.
//
// `modifiers` is optional for the same reason colonyRates()'s is: the display path and a headless
// harness can call this with state alone, and when it is absent they are computed here rather than
// defaulted to an empty object, so two callers cannot disagree about a multiplier.
function contractUpkeepPerSecond(state, modifiers) {
  const slice = expeditionSlice(state);
  if (!slice.contracts.some(isActiveContract)) return zeroedByResource();
  const resolved = modifiers || computeModifiers(state);
  return contractDrawPerSecond(slice, ownedModules(slice), resolved, resolvedSites(state, slice));
}

// gross[r] at a given ration. The only quantity in the solve that depends on `satisfaction`, which
// is what makes gross and satisfaction mutually recursive and the ration a fixed point.
//
// `extraThrottle` is the load-follow pass, applied on the second call only (it is `null` during the
// solve). Keeping it out of the iteration is deliberate and is explained on applyLoadFollow().
//
// `+ Σ_sites site.produces[r]` is added AFTER the module loop and outside both throttle terms —
// Home Plate's 2.0 O2/s, the only free atmosphere in the game. See siteProductionPerSecond() for
// the full argument; the short version is that a planet neither rations nor load-follows.
//
// EVERY CALLER GETS THE SITE TERM, INCLUDING THE ONE INSIDE THE SOLVE, and that is required rather
// than convenient. colonyRates() calls this three times — once per solve pass, once at the solved
// ration, once with load-follow applied — and the load-follow ratio is `demand / gross`. If the
// site term were added by only some callers, the ration would be solved against one gross and the
// throttle computed against another, and the two would disagree about how starved the colony is at
// exactly the moment it matters most.
function grossProduction(owned, satisfaction, modifiers, extraThrottle, sites) {
  const gross = zeroedByResource();
  owned.forEach(({ definition, count }) => {
    const produces = definition.produces || {};
    const throughput = throughputOf(definition, satisfaction);
    const followed = extraThrottle ? throughput * extraThrottle(definition) : throughput;
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      const rate = produces[resourceId];
      if (Number.isFinite(rate) && rate > 0) {
        gross[resourceId] += outputMultiplier(modifiers, resourceId) * count * rate * followed;
      }
    });
  });

  const fromSites = siteProductionPerSecond(sites);
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    gross[resourceId] += fromSites[resourceId];
  });
  return gross;
}

// THE RATIONING SOLVE, and the reason it converges instead of oscillating.
//
// gross is monotone non-decreasing in satisfaction (more ration, more output) and satisfaction is
// monotone non-decreasing in gross (more output, bigger ration), so the composed operator is
// monotone. Kleene iteration from the TOP element — everything fully satisfied — therefore walks
// downward toward the greatest fixed point.
//
// The `Math.min(previous, raw)` is not defensive clamping, it is the mechanism. It forces the
// sequence to be monotone DECREASING; bounded below by 0, a monotone decreasing sequence
// converges. Without it the Power/Provisions loop (reactors eat the Provisions that the
// hydroponics grow using Power) alternates forever between two values and never settles, and an
// oscillating ration means an oscillating net rate, which means a boundary clock that moves every
// time it is asked. A ration may never RISE inside the solve; it rises between steps, when a
// boundary is crossed or the player buys something.
//
// MEASURED CONVERGENCE BOUND (driven under `node` while building this story; the harness lives in
// /tmp and is deliberately not committed — there is no test runner in this repo and adding one is
// its own change):
//   * empty colony — everything this story actually ships:                          1 pass
//   * healthy end-of-lifeSupport colony (PRD §5.7's 8h trace fixture):               1 pass
//   * one bus starved: Power at 0, Provisions still in the silo:                     2 passes
//   * mutual collapse: Power AND Provisions both at 0, reactors fed by the
//     hydroponics those reactors power (PRD §5.6 example B):                        16 passes
//   * WORST CASE ACROSS EVERY FIXTURE: 16 passes, i.e. the mutual-collapse case exhausts
//     SOLVE_MAX_PASSES and stops on the cap rather than on SOLVE_EPSILON. Nothing else gets
//     anywhere near it — the cap costs nothing on the live path and bounds the offline one.
//
// ACCURACY AT THE CAP: the collapse fixture lands at s.power = 0.343323 against a closed-form
// fixed point of 21 / (89.6 - 36 x 4.5/5.7) = 0.343254. That is 0.02% high, comfortably inside
// §5.6's stated 2% budget, so 16 passes is more than the model needs rather than barely enough.
//
// NO OSCILLATION, ASSERTED RATHER THAN INFERRED: the harness checked that the satisfaction vector
// was non-increasing on EVERY pass of every fixture, which is what the Math.min above guarantees.
// Measured per-pass contraction on the collapse fixture is 0.573, against an analytic
// sqrt((36/89.6) x (4.5/5.7)) = 0.563 for that system's two-pass error decay.
//
// TWO CORRECTIONS TO PRD §5.6, both arithmetic in the prose rather than errors in the model.
// Passes 1-3 of its published trace reproduce EXACTLY (0.636/0.789, 0.551/0.502, 0.436/0.435), so
// the recurrence implemented here is the one it specified. Its pass 8 (0.351) and pass 16 (0.3488)
// are not on that trajectory: the same recurrence gives 0.3499 and 0.3433, and a monotone sequence
// converging to 0.3433 cannot read 0.3488 at pass 16 having read 0.436 at pass 3. Its stated
// per-pass contraction of 0.63 is likewise 0.563 analytically. Neither correction changes the
// conclusion the PRD drew from those numbers — 8 passes really would leave a ~1.9% over-estimate,
// so SOLVE_MAX_PASSES stays at 16.
function solveSatisfaction(owned, stocks, demand, modifiers, sites) {
  let satisfaction = EXPEDITION_RESOURCE_IDS.reduce((acc, id) => {
    acc[id] = 1;
    return acc;
  }, {});
  let passes = 0;

  for (let pass = 0; pass < SOLVE_MAX_PASSES; pass += 1) {
    passes = pass + 1;
    const gross = grossProduction(owned, satisfaction, modifiers, null, sites);
    const next = {};
    let delta = 0;
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      // A resource with stock in the tank is fully satisfied whatever its net rate: it is drawing
      // down a buffer, and the instant that buffer empties is a boundary this file reports rather
      // than a rate that decays inside the step. `demand === 0` is fully satisfied too — dividing
      // by it is the one division here that can be zero-over-zero.
      const raw =
        stocks[resourceId] > 0 || gross[resourceId] >= demand[resourceId]
          ? 1
          : demand[resourceId] > 0
            ? gross[resourceId] / demand[resourceId]
            : 1;
      next[resourceId] = Math.min(satisfaction[resourceId], raw);
      delta = Math.max(delta, satisfaction[resourceId] - next[resourceId]);
    });
    satisfaction = next;
    if (delta < SOLVE_EPSILON) break;
  }

  return { satisfaction, passes };
}

// LOAD-FOLLOW: the full end of the clamp, mirroring rationing at the empty end. A resource sitting
// at its capacity with surplus production does not overflow and does not waste — its producers
// throttle back to match demand, and their own input draw falls with them. That falling draw is
// what PRD §5.7's 8h trace calls a cascade: reactors backing off stop eating Provisions, which
// pushes Provisions into surplus, which is a new boundary.
//
// DELIBERATELY A SINGLE NON-ITERATED PASS, RUN AFTER THE RATIONING SOLVE. Lowering gross RAISES the
// load-follow ratio (demand/gross), so folding this into the loop above would break the
// monotonicity that the whole convergence argument rests on. The cascade it leaves unresolved is
// not lost — it is a boundary event, resolved by the NEXT advance() iteration, which is exactly
// why the iteration bound below is derived with a cascade allowance per capacity pin rather than
// assuming load-following terminates in one pass.
function loadFollowThrottles(gross, demand, stocks, capacity) {
  const throttles = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const full = stocks[resourceId] >= capacity[resourceId];
    const surplus = gross[resourceId] > demand[resourceId];
    // The division is guarded by `surplus`: demand is never negative, so gross > demand implies
    // gross > 0. This is live from turn one rather than theoretical — Fuel's base capacity is 0, so
    // `stocks >= capacity` is true for Fuel on a brand new game, and the first Electrolysis Stack
    // bought before a tank is a producer with a demand of exactly 0 hitting this line.
    throttles[resourceId] = full && surplus ? demand[resourceId] / gross[resourceId] : 1;
  });
  return throttles;
}

// A producer throttles to the tightest of the buses it feeds. A module producing only Power reads
// Power's load-follow; one producing Power and Fuel backs off to whichever is more full.
function loadFollowOf(definition, throttles) {
  const produces = definition.produces || {};
  let factor = 1;
  Object.keys(produces).forEach((resourceId) => {
    const throttle = throttles[resourceId];
    if (Number.isFinite(throttle) && throttle < factor) factor = throttle;
  });
  return factor;
}

// The actual draw after load-following. NOT the same quantity as `demand` above and the difference
// is load-bearing: `demand` is the full-output figure the ration is solved against and is what the
// UI should show as "required", while this is what the colony is really pulling off the bus now
// that its producers have backed off. Rationing throughput is deliberately NOT applied here — a
// throttled consumer still demands its full share, and that unmet demand is exactly what holds a
// starved resource pinned at zero.
//
// ---------------------------------------------------------------------------------------------
// THE SITE TERM WAS MISSING HERE UNTIL STORY-031, AND ITS ABSENCE WAS A REAL DEFECT RATHER THAN A
// MODELLING CHOICE. STORY-027 added `siteUpkeepPerSecond()` to demandAtFullOutput() and stopped
// there, so from that story until this one a colonized site RAISED THE RATION PRESSURE WITHOUT EVER
// DRAWING A SINGLE UNIT. `demand` went up, `satisfaction` went down, and `net` was untouched —
// which is not "upkeep is free", it is worse: the colony was billed in the denominator of the
// ration and refunded in the numerator of the stock.
//
// MEASURED BY STORY-030, and quoted because it is the shortest statement of the bug: 10 RTGs plus a
// colonized On-Deck plus a tier-2 pad reported `demand.power 3.8` against `net.power 30.0`, and
// 30.0 is exactly `gross` — the draw was identically zero. PRD §5.7's own eight-hour trace debits
// site upkeep from the stocks, so the intent was never in doubt; the two halves of one term had
// simply been written a story apart.
//
// IT IS FIXED HERE RATHER THAN IN ITS OWN STORY BECAUSE THIS STORY'S CENTRAL MEASUREMENT IS
// MEANINGLESS WITHOUT IT. STORY-031 has to prove the network can sustain The Swing's 240 Power/s
// and 72 Provisions/s at the moment it becomes buildable. An upkeep ladder tuned against a colony
// that never pays site upkeep is tuned against a fiction, and every number it shipped would have
// been measured on the wrong engine. See the delta block at the foot of this file for what the
// correction did to the phases whose tuning predates it.
//
// TWO PROPERTIES, MATCHED DELIBERATELY TO HOW demandAtFullOutput() ALREADY TREATS THE SAME TERM:
//
//   * MULTIPLIED BY `drawMult` (§5.6). Life support is life support wherever it is drawn — a
//     permanent that makes the colony frugal makes the pads frugal too. This is the asymmetry with
//     site PRODUCTION, which takes no output multiplier because a planet has no equipment to
//     upgrade (see siteProductionPerSecond).
//   * NOT LOAD-FOLLOWED, and this is the one an implementer is likely to "fix". `loadFollowOf()`
//     reads a definition's `produces` map; a site record has no such shape and a pad is not a
//     producer at all. More to the point, load-follow is the rule that stops a PRODUCER overfilling
//     a ceiling by backing off. A pad does not back off because the Provisions silo is full — it is
//     a machine being kept alive, and it draws the same rate at every stock level. Applying a
//     throttle here would make the network cheapest exactly when it is richest, which is backwards.
//
// THE CONTRACT TERM (STORY-030) IS ADDED HERE AS WELL AS TO `demand`, AND IT TAKES NO LOAD-FOLLOW,
// for the same reason the site term above does not. A crew in the field and a Power drill are not
// producers; there is no output for them to back off. So the term goes in flat, scaled only by
// `drawMult`, and it is what actually moves the stock: `demand` decides the RATION, `draw` decides
// the NET RATE, and a contract that appeared in only the first of those would cost the player
// nothing at all. That is the whole mechanical content of §9.5's Waiver Claim and Rain Delay.
//
// MERGE NOTE, RESOLVED. STORY-030 (PR #34) and STORY-031 widened this function concurrently — #34
// for `contractDraw`, 031 for `sites` — and both wrote the resolution down in advance because
// neither supersedes the other: a contract drawing Power and a pad drawing Power are both real
// consumers, and their sum is the draw. BOTH TERMS WERE TAKEN. The signature carries both, each is
// scaled by `drawMult`, and neither is load-followed. Same class of conflict MERGE-NOTES records
// for the tickEngine.js event-clock contributors (029 vs 027), resolved the same way: two
// contributors to one sum.
//
// STORY-030's block here previously recorded the missing site term as a suspected defect it was
// leaving alone, since fixing it was a balance change it could not re-measure. That block is gone
// rather than preserved: 031 fixed it and re-took the measurements, so keeping a note that says
// site upkeep is not in this sum would now be describing the opposite of what the code does.
// ---------------------------------------------------------------------------------------------
function actualDraw(owned, drawMult, throttles, sites, contractDraw) {
  const draw = zeroedByResource();
  owned.forEach(({ definition, count }) => {
    const consumes = definition.consumes || {};
    const followed = loadFollowOf(definition, throttles);
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      const rate = consumes[resourceId];
      if (Number.isFinite(rate) && rate > 0) draw[resourceId] += drawMult * count * rate * followed;
    });
  });

  const upkeep = siteUpkeepPerSecond(sites || []);
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    draw[resourceId] += drawMult * upkeep[resourceId];
  });

  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const contracted = contractDraw ? contractDraw[resourceId] : 0;
    if (Number.isFinite(contracted) && contracted > 0) draw[resourceId] += drawMult * contracted;
  });
  return draw;
}

// ONE CALL, ONE SOLVE. Every consumer of a colony rate — the tick loop, the boundary contributor,
// §6's header panel, the module shop's affordability preview — goes through this function and
// through nothing else. §6's listResources() is a thin presentation wrapper over this return value
// and must never compute a rate itself: a header that runs its own arithmetic will eventually
// disagree with the engine about a time-to-empty, and time-to-empty is the entire Act VII UI.
//
// `modifiers` is optional so the display path and the event-clock contributor can call this with
// state alone (findNextEventClock() passes only state — see engine/tickEngine.js). When it is
// absent the modifiers are computed here rather than defaulted to an empty object, so the two
// callers cannot disagree about a multiplier.
//
// Returns, per resource id:
//   satisfaction   the ration [0,1]. 1 means "getting everything it asked for".
//   supplyThrottle the load-follow factor [0,1]. 1 means "producing everything it can".
//   gross          production per second, after both throttles and the output multipliers.
//   demand         required draw per second at FULL output. Constant, and not what is being drawn.
//   net            signed rate per second, pinned to exactly 0 against a boundary it cannot cross.
//   unclamped      the same rate with the ceiling taken away — what the bus would run at if there
//                  were somewhere to put the output. Equal to `net` whenever nothing is clamped.
//                  DISPLAY ONLY; the simulation moves stock with `net`. See the long note below.
//   capacity       the ceiling, from the slice.
//   pinned         'empty' | 'capacity' | null — WHICH end that pin was taken against, if any.
//                  Part of the contract, not a diagnostic: it is unrecoverable from the other
//                  fields (see THE PIN below) and §6.4's Ops panel is built on the distinction.
//   passes         diagnostic only: how many solve passes this took. Not part of the contract;
//                  it exists because the convergence bound above is a deliverable, not a claim.
// EVERY CEILING IS DERIVED, NEVER STORED (ledger R1). This replaces reading
// `slice.resources[id].capacity`, and the change is not a refactor — it is the difference between
// a ceiling that can drift from the modules that justify it and one that cannot.
//
//   capacity[r] = base[r]  +  Σ owned storage grants  ( + Σ sites[].fuelCapacityOnArrival, for fuel )
//
// It is the rule getUnlockedFeatures() follows, for the same reason: a stored ceiling is a second
// source of truth, and retuning a tank's grant would then require a migration on a save format
// that has none. Derived, a balance edit takes effect on every existing save the next tick.
//
// THE STORED CAPACITY IS NOW IGNORED, and that is safe in the one direction that matters. A save
// written before this change carries whatever ceiling it had; recomputing it can only ever produce
// the same number (nobody owned storage, so the sum is base) or a larger one (they did). It cannot
// silently shrink a ceiling under a stock that is already above it — and even if a hand-edited
// save managed that, integrateColony() clamps to [0, capacity] unconditionally, so the surplus is
// discarded rather than becoming an impossible state.
//
// THE FUEL SITE TERM IS LIVE AS OF THIS STORY, and it is the larger of the two sources by an order
// of magnitude. Each reached site grants a Fuel floor of 1.6x the threshold of the launch DEPARTING
// from it (§7.3), so the ceiling is always exactly the overshoot band of the burn the player is
// currently filling for. §5's storage ladder becomes optional headroom for banking past 1.6x —
// which is what beat L-5's tank farms are for — rather than the gate on whether a launch is
// reachable at all. That inversion is ledger R1, and under the overruled reading the opening launch
// of the act needed three Fuel Bladders before it was even possible.
//
// GRANTED ON `reached`, NOT ON `colonized`. The tank is the vehicle's, not the colony's: you
// arrive, and what you arrived in is what holds the propellant for the next leg. A player who flies
// to a site and decides not to pay for it still gets to fill up and go on.
//
// HOME PLATE'S GRANT IS GATED ON OWNING A TANK, and this is the one conditional in the sum. Every
// other site's grant lands on an arrival, which is an event partway through the act. Home Plate is
// reached at t = 0, so an unconditional grant would hand the player 1,920 Fuel of ceiling in the
// first second — and Fuel's base capacity of 0 is not an accounting convenience, it is the pacing
// control for the entire launch system (§5.5, ledger R1). Fuel that cannot be stored cannot
// accumulate, the clamp discards it, and L1 is therefore gated on the first tank purchase rather
// than on the Fuel rate. Ungate this and the first launch threshold is crossed roughly a third of a
// phase early, stealing that time from `lunar`. What 3,600 Salvage buys is not 400 units of
// headroom; it is Fuel existing.
function colonyCapacity(sites, owned) {
  const capacity = {};
  EXPEDITION_RESOURCES.forEach((resource) => {
    capacity[resource.id] = resource.baseCapacity;
  });

  let hasFuelTank = false;
  owned.forEach(({ definition, count }) => {
    const grants = definition.capacity || {};
    if (Number.isFinite(grants.fuel) && grants.fuel > 0) hasFuelTank = true;
    Object.keys(grants).forEach((resourceId) => {
      const grant = grants[resourceId];
      if (!Number.isFinite(grant) || grant <= 0) return;
      if (capacity[resourceId] === undefined) return;
      capacity[resourceId] += grant * count;
    });
  });

  sites.forEach((site) => {
    if (!site.reached) return;
    if (site.fuelCapacityRequiresTank && !hasFuelTank) return;
    const granted = site.fuelCapacityOnArrival;
    if (Number.isFinite(granted) && granted > 0) capacity.fuel += granted;
  });

  return capacity;
}

function colonyRates(state, modifiers) {
  const slice = expeditionSlice(state);
  const resolved = modifiers || computeModifiers(state);
  const owned = ownedModules(slice);
  const sites = resolvedSites(state, slice);
  const drawMult = multiplierOf(resolved, DRAW_MULTIPLIER_KEY);

  const stocks = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    stocks[resourceId] = slice.resources[resourceId].amount;
  });
  const capacity = colonyCapacity(sites, owned);

  // The contract draw is computed BEFORE the solve and folded into `demand`, which is ledger R5's
  // ordering requirement stated as code. See the note over demandAtFullOutput().
  const contractDraw = contractDrawPerSecond(slice, owned, resolved, sites);

  const demand = demandAtFullOutput(owned, drawMult, sites, contractDraw);
  const { satisfaction, passes } = solveSatisfaction(owned, stocks, demand, resolved, sites);

  const rationed = grossProduction(owned, satisfaction, resolved, null, sites);
  const supplyThrottle = loadFollowThrottles(rationed, demand, stocks, capacity);
  const gross = grossProduction(
    owned,
    satisfaction,
    resolved,
    (definition) => loadFollowOf(definition, supplyThrottle),
    sites
  );
  const draw = actualDraw(owned, drawMult, supplyThrottle, sites, contractDraw);

  // THE RATE WITH THE CEILING TAKEN AWAY — what this bus would run at if there were somewhere to
  // put the output. `rationed` is production at the solved ration BEFORE load-follow, `demand` is
  // draw at full output, so this is the signed rate of a colony whose tanks are all bottomless.
  //
  // IT EXISTS BECAUSE A FULL TANK MADE THE PLAYER'S REACTORS INVISIBLE, and `net` cannot be made to
  // answer for that without breaking the two things that depend on it. Buy five RTGs, fill Power,
  // and every number on the header goes quiet: load-follow drops the throttle to 0, `gross` falls
  // to `demand`, `gross - draw` lands on 0, and the chip reads `0/s` next to `100/100`. That is a
  // true statement about the STOCK and a false impression about the COLONY — 15 Power/s of
  // generation is running and being thrown away, and the screen shows the same thing it would show
  // for a player who owns nothing at all. The reading the player is owed is "+15.0/s, and none of
  // it is landing", which is two facts, so it takes two fields.
  //
  // NOT `gross - draw`, WHICH WAS THE FIRST DRAFT AND IS THE WRONG NUMBER. That is the surplus
  // being vented AFTER the producers back off, and load-follow is specifically the mechanism that
  // drives it to zero — it is nonzero only for production that cannot back off at all (a site's
  // atmosphere; siteProductionPerSecond() argues why a planet does not throttle). Measured under
  // `node`: five RTGs against a full Power tank report `gross - draw` = 0.00 and this field 15.00.
  // Shipping the first draft would have left the complaint that prompted this exactly as it was.
  //
  // ADDITIVE, AND `net` KEEPS EVERY EXISTING CALLER. integrateColony() moves the stock with `net`
  // and nextColonyThresholdClock() feeds the event clock with it; handing either an unclamped rate
  // resurrects precisely the boundary-at-distance-zero bug THE PIN below exists to kill. Nothing in
  // the simulation may read this. It is for the surfaces, and engine/colonyReadout.js is the only
  // thing that does.
  //
  // EQUAL TO `net` WHENEVER NOTHING IS CLAMPED, which is what makes it safe for a surface to print
  // either one: with every throttle at 1, `gross` IS `rationed` and `draw` IS `demand`, so the two
  // subtractions are the same subtraction. The fields diverge only where the ceiling is doing
  // something, which is the only case the readout swaps them.
  const unclamped = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    unclamped[resourceId] = rationed[resourceId] - demand[resourceId];
  });

  // THE PIN, AT BOTH ENDS. A resource held against a boundary it cannot cross has net exactly 0 BY
  // ASSIGNMENT, not by arithmetic. At the empty end this is §5.6's rule and it is what makes the
  // pinned state absorbing: `demand` is the full-output figure, so `gross - draw` for a starved
  // resource is some small negative number that the clamp would discard anyway — but leaving it
  // negative means nextColonyThresholdClock() keeps reporting a boundary on a resource that is
  // already sitting on it, and a boundary at distance zero is a zero-length advance() step. The
  // full end is the mirror image and is stated here rather than in the PRD because the same
  // argument applies verbatim: a resource at capacity with an unabsorbable surplus (a site
  // production term, which does not load-follow) would otherwise report a cap boundary it is
  // already standing on, every iteration, forever.
  //
  // `pinned` RECORDS WHICH BRANCH FIRED, AND IT IS ADDED HERE RATHER THAN RE-DERIVED BY A CALLER
  // (STORY-035). The Ops panel's whole reason to exist is to make Decision 3.3's
  // throttle-rather-than-fail visible: a resource reading 0/s because it is clamped against a
  // boundary is a completely different fact from one reading 0/s because nothing is happening to
  // it, and the player has to be able to tell them apart — the first is a colony being rationed,
  // the second is a colony at rest.
  //
  // NOTHING OUTSIDE THIS BLOCK CAN RECONSTRUCT IT. `raw` is `gross - draw`, and `draw` is not in
  // the return value — only `demand`, which is the full-output figure and deliberately not what is
  // being drawn (see actualDraw()). A caller handed `net` alone can see that a rate is 0; it cannot
  // see whether that 0 was computed or assigned. Returning `draw` instead would technically answer
  // it, but it would answer it by inviting every surface to re-run `stocks <= 0 && raw < 0` for
  // itself, which is the presentation layer deciding a simulation rule — exactly what the note over
  // colonyRates() and engine/colonyReadout.js's header forbid. The branch is already being taken
  // here; recording which one costs nothing and leaves one source of truth.
  //
  // KEYED FOR ALL FOUR RESOURCES ALWAYS, `null` WHEN UNPINNED, matching the discipline
  // expeditionSlice() states for its resources map: every caller indexes by id and no caller should
  // have to guard the lookup. `'empty'` and `'capacity'` are the two ends by name rather than a
  // boolean, because a surface that colours them the same still has to be able to word them
  // differently — "nothing left and not recovering" against "full, and the surplus is being thrown
  // away".
  const net = {};
  const pinned = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const raw = gross[resourceId] - draw[resourceId];
    if (stocks[resourceId] <= 0 && raw < 0) {
      net[resourceId] = 0;
      pinned[resourceId] = 'empty';
    } else if (stocks[resourceId] >= capacity[resourceId] && raw > 0) {
      net[resourceId] = 0;
      pinned[resourceId] = 'capacity';
    } else {
      net[resourceId] = raw;
      pinned[resourceId] = null;
    }
  });

  // SALVAGE COMES OUT OF THE SAME SOLVE, and that is the whole reason it is computed here rather
  // than in engine/income.js where it is spent.
  //
  // Salvage is a wallet currency, not one of the four consumables, so it is not in `gross`, `net`
  // or `capacity` above and it is not iterated by anything in this file's resource loops (see the
  // `producesSalvage` note in data/actSevenModulesConfig.js). But a Reclaimer Drone's OUTPUT has
  // to be throttled by the same `satisfaction` and the same load-follow as everything else it
  // shares a bus with. A starved drone that still paid full income would make the Power and
  // Provisions interlock decorative — the player could ignore the colony entirely and just buy
  // drones, which is precisely the degenerate act the interlock exists to prevent.
  //
  // Computing it from the already-solved `satisfaction` and `supplyThrottle` is what keeps it
  // honest: there is exactly one ration in play, so the header, the income and the colony can
  // never disagree about how starved the colony is.
  const salvage = salvageFromOwned(owned, satisfaction, supplyThrottle);

  return { satisfaction, supplyThrottle, gross, demand, net, unclamped, capacity, pinned, passes, salvage };
}

// Sum of every owned module's Salvage output at the solved ration. Split out rather than inlined
// so the arithmetic sits next to grossProduction(), which it deliberately mirrors: same throughput
// term, same load-follow term, different destination.
//
// Note it does NOT take an output multiplier. OUTPUT_MULTIPLIER_KEYS in data/actSevenConfig.js is
// keyed by resource id and Salvage is not a resource; a Salvage powerup, if the act ever wants
// one, is a wallet-side bonus in data/modifierKeysConfig.js like every other income multiplier in
// the game, not a term here.
//
// The load-follow term is 1 for every module that produces ONLY Salvage, and that falls out
// correctly rather than needing a special case: loadFollowOf() reads `produces`, a drone has none,
// so it never backs off. That is right — load-follow is what stops a producer overfilling a
// ceiling, and Salvage is a monotonic wallet currency with no ceiling to overfill. The term is
// kept in the expression anyway, because a later module that produces Salvage AND a capped
// resource must throttle on the capped one, and that case should not need this function reopened.
function salvageFromOwned(owned, satisfaction, supplyThrottle) {
  let total = 0;
  owned.forEach(({ definition, count }) => {
    const rate = definition.producesSalvage;
    if (!Number.isFinite(rate) || rate <= 0) return;
    const throughput = throughputOf(definition, satisfaction);
    total += count * rate * throughput * loadFollowOf(definition, supplyThrottle);
  });
  return total;
}

// Applies net x step and clamps every resource to [0, capacity]. The clamp is unconditional and
// belongs to the data path, not to its callers, for the same reason debitWallet() floors at zero
// rather than trusting each call site: a caller that gets the arithmetic wrong should produce a
// disappointing colony, never an impossible one.
//
// RETURNS THE STATE OBJECT IT WAS HANDED, BY IDENTITY, WHEN NOTHING MOVED. Two things depend on
// that and neither is micro-optimisation. First, it is what makes "with no modules owned, an 8h
// advance() produces state identical to before this change" provable by reference equality rather
// than by a deep compare that could paper over a reordered key. Second, and more important: a save
// written before the expedition slice existed has no `expedition` key at all, and materialising one
// on every tick of every pre-Act-VII game would write a slice into six acts that have no use for it
// — the slice accessor's whole design is that absent reads as empty.
function integrateColony(state, modifiers, step) {
  if (!Number.isFinite(step) || step <= 0) return state;

  const slice = expeditionSlice(state);
  const { net, capacity } = colonyRates(state, modifiers);

  let moved = false;
  const resources = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const before = slice.resources[resourceId].amount;
    const rate = net[resourceId];
    const applied = Number.isFinite(rate) ? before + rate * step : before;
    const after = Math.min(Math.max(0, applied), capacity[resourceId]);
    if (after !== before) moved = true;
    resources[resourceId] = { amount: after, capacity: capacity[resourceId] };
  });

  // THE PEAK NET FUEL RATE, SAMPLED WHERE THE SOLVE ALREADY HAPPENED (PRD §7.8's placement inputs).
  //
  // IT COSTS NOTHING, AND THAT IS THE ENTIRE REASON IT IS HERE RATHER THAN IN engine/board.js.
  // colonyRates() is a 16-pass Kleene fixed point, and the tick loop is careful enough about it
  // that advanceContracts() is handed the solve from the top of the iteration rather than being
  // allowed to take its own. Adding an unconditional second solve per tick to record one number for
  // one screen at the end of the act would be the most expensive line in the loop. `net` is four
  // lines above; the peak is a comparison.
  //
  // MONOTONE, WHICH IS WHAT MAKES IT REPLAY-SAFE. A maximum cannot be double-counted, so an
  // eight-hour offline catch-up that crosses the same rate regime forty times records it once and
  // the fortieth pass is a no-op. That is a stronger property than idempotence and it is why this
  // needs no boundary, no resolver and no entry on EVENT_CLOCK_CONTRIBUTORS.
  //
  // AND IT CANNOT MATERIALISE A SLICE INTO THE SIX ACTS BEFORE THIS ONE, by the same structural
  // argument the Home Plate note above makes rather than by an act check: the only thing in the
  // game that produces Fuel is an Act VII module, so `net.fuel` is 0 for every save that owns none,
  // 0 is never greater than the stored 0, and the write never fires. `> 0` on the stored side is
  // belt and braces on a corrupt negative.
  //
  // THE RATE, NOT THE STOCK. §7.8 asks for "peak network Fuel/sec" — what the network was capable
  // of at its best, which is a statement about how well it was built. The tank's high-water mark
  // would be a statement about the largest threshold the ladder happened to ask for.
  const netFuel = Number.isFinite(net.fuel) ? net.fuel : 0;
  const peakFuelRate = netFuel > slice.peakFuelRate ? netFuel : slice.peakFuelRate;

  if (!moved && peakFuelRate === slice.peakFuelRate) return state;

  // Spreads the FULL accessor return, never a partial object. engine/concessions.js records the
  // near-miss this convention exists to prevent: the accessor's result is what gets written back,
  // so a key the accessor forgets is a key every later write silently deletes.
  return { ...state, expedition: { ...slice, resources, peakFuelRate } };
}

// The earliest clock at which any resource reaches 0 or its capacity at the CURRENT net rate;
// Infinity when nothing is moving toward a boundary.
//
// This is the contributor registered on engine/tickEngine.js's EVENT_CLOCK_CONTRIBUTORS list, and
// it is the reason the piecewise-constant rate model is exact rather than approximate. Without it,
// findNextEventClock() returns Infinity on a quiet state, advance() takes the entire remaining span
// as ONE step, and a resource that crosses zero forty minutes into an eight-hour absence has the
// pre-crossing rate applied to the remaining seven hours and twenty minutes. The player is not
// told, nothing throws, and the numbers are simply wrong — the worst failure mode an idle game has,
// because nobody reports it.
//
// CONTRACT (see the block comment above the contributor list): pure, guards its own slice, and
// returns Infinity — never 0, null or undefined — when nothing is pending. Returning 0 here would
// pin advance()'s step at zero and burn all 2,000 safetyCapIterations without moving the clock.
//
// The early return on an empty colony is that guard, and it is also why this story's change is
// free for every act before Act VII: with no modules owned there is nothing to solve, so the
// contributor abstains before it computes any modifiers at all.
//
// MEASURED: CHUNKED VS STEPWISE. Two synthetic colonies were run across a full 8h span, once as a
// single advance() call with this contributor registered, and once with the contributor
// de-registered and the span walked in fixed increments. Both were also compared against the
// closed-form answer computed by hand outside the engine.
//
//   Fixture A, Power crossing ZERO at t = 55.5556s (Oxygen output drops 1.40/s -> 0.35/s as the
//   scrubbers lose their ration). Exact answer 10138.333333 Oxygen.
//     chunked, one call ............ 10138.333333   (exact to the last digit)
//     stepwise dt = 1s ............. 10138.800000   (+0.4667, one dt of the 1.05/s rate jump)
//     stepwise dt = 0.01s .......... 10138.338001   (+0.0047, 100x smaller for 100x smaller dt)
//     contributor DE-REGISTERED .... 40320.000000   (4x the true figure)
//
//   Fixture B, Fuel filling its 500 tank at t = 357.1429s, at which point nothing consumes Fuel so
//   the stacks idle completely and Power's net rises 36/s -> 60/s. Exact answer 1719428.571429.
//     chunked, one call ............ 1719428.571429 (exact)
//     stepwise dt = 1s ............. 1719408.000000 (-20.57, one dt of the 24/s rate jump)
//     stepwise dt = 0.01s .......... 1719428.400176 (-0.171)
//     contributor DE-REGISTERED .... 1036800.000000 (40% under-credit)
//
// Three things are established by those numbers. The chunked run is not merely close to the
// stepwise run, it is EXACT — which is what "the only instants a rate can change are the ones this
// function returns" means in practice. The stepwise residual is bounded a priori by one dt of the
// rate jump across the boundary and shrinks linearly with dt, which is what separates step-size
// error from a wrong rate model: a wrong rate leaves a residual that does not shrink. And the
// de-registered run is WRONG BY 4x AND BY 40% — that is this contributor's entire value, measured,
// and it is also the mutation test proving the comparison is not vacuous.
//
// MEASURED ITERATION BOUND FOR AN 8-HOUR RETURN. Counted by wrapping this function and running
// advance(state, 28800) to completion, so it is the real advance() loop count and not a model of
// one:
//   * empty colony — everything this story actually ships:                       1 iteration
//   * synthetic colony crossing ZERO inside the span:                            2 iterations
//   * synthetic colony crossing its CAP inside the span:                         2 iterations
//   * over-committed colony, net-negative on Power, Oxygen AND Provisions:       4 iterations
//   * the same colony rescued by adding generators:                              5 iterations
//   * PRD §5.7's healthy end-of-lifeSupport colony (Power, Provisions and Fuel
//     all fill to their caps, Oxygen drains to zero):                            5 iterations
//   * WORST CASE OBSERVED: 5 iterations, against balanceConfig.safetyCapIterations of 2,000 — a
//     margin of 400x.
//
// The PRD's a-priori ceiling was 21, stated as 25: three regime changes per resource (interior ->
// cap-pinned -> draining -> zero-pinned) x four resources, plus two cascade iterations per capacity
// pin, plus a terminal step. The measured figure is well under it because a real colony does not
// put every resource through every regime in one absence, and because each crossing removes a
// boundary rather than adding one — a pinned resource has net exactly 0 and abstains for the rest
// of the span, which is precisely what the absorbing-pin rule above buys.
//
// The number that matters is not 5 or 21 but the margin to 2,000. Silently hitting that cap would
// stop the loop with `remaining` still positive, under-crediting a returning player by however
// many hours were left, with no error raised anywhere. Every fixture above was additionally checked
// to carry the clock the full 28,800s.
//
// One caveat worth recording: the clock lands on 28800.000000000004 rather than 28800 on fixtures
// whose boundaries fall at non-representable instants, because advance() accumulates `clock + step`
// per iteration. That is pre-existing behaviour of the loop — a powerup expiring at a fractional
// clock does the same — and 4e-12 seconds is not a quantity any mechanic can observe.
// COLONY_MIN_STEP_SECONDS caps the pathological case independently of any of this: it drops
// boundaries closer than half a second, so even a colony contrived to chatter cannot produce a run
// of zero-length steps.
// THE ABSTAIN GUARD IS "NO MODULES AND NO SITES", AND THE SECOND HALF ARRIVED WITH THIS STORY.
// Until sites existed, "owns no modules" was a complete statement of "produces and consumes
// nothing", so abstaining on it was exact. Home Plate breaks that: it is colonized from the act
// boundary and makes 2.0 O2/s with zero modules owned, which fills the 100-unit base tank in
// fifty seconds — a real rate change at a real instant. Left as it was, this function would have
// abstained from a boundary it exists to report, advance() would have taken the whole remaining
// span as one step, and the clamp in integrateColony() would have quietly hidden the error by
// producing the right stock for the wrong reason. The day something consumes Oxygen in `aftermath`
// that stops being invisible.
//
// resolvedSites() returns [] for every act before Act VII, so the six acts that have no expedition
// still abstain on the cheapest possible test and their step sizes are unchanged.
function nextColonyThresholdClock(state, modifiers) {
  const slice = expeditionSlice(state);
  const sites = resolvedSites(state, slice);
  if (slice.modules.length === 0 && sites.length === 0) return Infinity;

  const { net, capacity } = colonyRates(state, modifiers);
  const clock = state && Number.isFinite(state.clock) ? state.clock : 0;
  let earliest = Infinity;

  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const { amount } = slice.resources[resourceId];
    const rate = net[resourceId];
    // Not moving, or pinned against a boundary (colonyRates assigns exactly 0 for a pin), or
    // poisoned by a corrupt save. None of the three is an event.
    if (!Number.isFinite(rate) || rate === 0) return;
    const distance = (rate > 0 ? capacity[resourceId] : 0) - amount;
    // Already standing on the boundary. Unreachable for a correctly-solved colony because the pin
    // above catches it, but a hand-edited save or a float landing exactly on a capacity can produce
    // it, and a zero-length step is an infinite advance() loop.
    if (distance === 0) return;
    const seconds = distance / rate;
    if (seconds < COLONY_MIN_STEP_SECONDS) return;
    earliest = Math.min(earliest, clock + seconds);
  });

  return earliest;
}

// THE ONLY DEBIT PATH INTO expedition.resources. Fuel is the case that makes this necessary: it is
// stored in the expedition slice rather than in the wallet, so engine/wallet.js's debitWallet() is
// structurally not how it is spent, and a launch that costs Fuel has to go through here.
//
// DELIBERATELY DIFFERENT FROM debitWallet(), WHICH FLOORS AT ZERO AND ALWAYS SUCCEEDS. Returns
// `null` for a refused spend instead. The two are not inconsistent, they are answering different
// questions: a currency is a price you pay and flooring a bad call site at zero produces a poor
// game rather than a negative balance, whereas Fuel is a THRESHOLD you fill — a launch either has
// enough Fuel to leave or it does not, and half a launch is not a thing. A caller that silently
// took what was there would burn the player's tank and not go anywhere, which is destruction, which
// Decision 6 forbids.
//
// Refusing is not a failure state either: nothing is consumed, nothing is removed, and the player
// simply keeps filling. `amount <= 0` returns the state unchanged by identity rather than refusing,
// so a zero-cost spend is a no-op rather than an error.
function spendResource(state, resourceId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  const slice = expeditionSlice(state);
  const resource = slice.resources[resourceId];
  if (!resource) return null;
  if (resource.amount < amount) return null;

  return {
    ...state,
    expedition: {
      ...slice,
      resources: {
        ...slice.resources,
        [resourceId]: { ...resource, amount: resource.amount - amount },
      },
    },
  };
}

// THE ONLY CREDIT PATH INTO expedition.resources, and the mirror image of spendResource() above.
// Fuel is the case that makes it necessary for the same reason: it lives in the expedition slice
// rather than in the wallet, so engine/wallet.js's creditWallet() is structurally not how it is
// paid, and a contract that pays Fuel has to come through here.
//
// IT REFUSES WITH `null` RATHER THAN CLAMPING, WHICH IS THE OPPOSITE OF WHAT integrateColony() DOES
// TWENTY LINES ABOVE, AND THE ASYMMETRY IS THE POINT. integrateColony() is a RATE being integrated:
// production that overflows a full tank is production the colony simply did not need, and
// discarding it is the load-follow model working correctly. This is a LUMP being handed over. PRD
// §9.6 states the failure in terms: a 1,300-Fuel payout into a tank with 200 units of headroom
// would silently destroy 1,100 Fuel — "the single worst bug this section can ship" — at the exact
// moment the player earned it, invisibly, with nothing thrown and nobody told.
//
// Refusing is not punitive and nothing is lost: the caller's contract stays claimable forever and
// becomes claimable the instant the player launches (emptying the tank) or reaches another site
// (raising the ceiling). "You cannot bank a payout you have nowhere to put" is a real decision in a
// game whose entire economy is a threshold.
//
// THE CEILING COMPARED AGAINST IS THE DERIVED ONE, NEVER `resource.capacity`. This file states in
// terms that the stored ceiling is ignored — every capacity is recomputed from the modules and
// sites that justify it, every read (ledger R1). The stored figure is whatever it happened to be
// when the save was written, so comparing against it would refuse payouts that fit and admit
// payouts that do not.
//
// `amount <= 0` returns the state unchanged BY IDENTITY rather than refusing, matching
// spendResource(): a zero-value credit is a no-op, not an error, which is what lets a caller pay a
// Fuel-and-Salvage contract and a Salvage-only one through the same two lines.
function creditResource(state, resourceId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  const slice = expeditionSlice(state);
  const resource = slice.resources[resourceId];
  if (!resource) return null;

  const { capacity } = colonyRates(state);
  const ceiling = capacity[resourceId];
  if (!Number.isFinite(ceiling)) return null;
  if (resource.amount + amount > ceiling) return null;

  return {
    ...state,
    expedition: {
      ...slice,
      resources: {
        ...slice.resources,
        [resourceId]: { ...resource, amount: resource.amount + amount },
      },
    },
  };
}

// The two early phase predicates (PRD R4), as pure functions of state.
//
// THESE WRITE NOTHING. `expedition.phase` has exactly one writer — engine/sites.js — and this file
// supplies the predicates it composes into its ladder. Two writers of one progression signal is the
// parallel-milestone problem R4 exists to prevent: the moment a second place can set the phase, the
// two disagree on some save and the act's gating becomes a coin flip.
//
// `lifeSupport` is the first generator bought, which is deliberately the crudest possible test —
// owning any module at all. It is the moment the wreck stops being a wreck, and the player earns it
// by making one purchase, not by clearing a checklist.
function isLifeSupportPhase(state) {
  return expeditionSlice(state).modules.some((module) => module && module.count > 0);
}

// `aftermath` is the DEFAULT, not a condition — you are in the aftermath until you are not. Written
// as the negation rather than as its own test so the two predicates cannot both be true, which is
// the failure a hand-written pair of conditions eventually produces.
function isAftermathPhase(state) {
  return !isLifeSupportPhase(state);
}

// ---------------------------------------------------------------------------------------------
// THE AFFORDABILITY DELTA THE actualDraw() CORRECTION CAUSED — the block that function's comment
// forward-references. Measured under `node` by STORY-031, running the same competent buyer through
// the real advance() loop twice: once against this file, once against the pre-fix version.
//
// THE DELTA IS EXACTLY THE SITE UPKEEP TABLE, and that is provable rather than measured: the site
// term is `drawMult x siteUpkeepPerSecond(sites)`, and `drawMult` is 1 because
// `lifeSupportDrawMult` is not registered in BONUS_KEYS (PRD §7.0's decision C deliberately keeps
// the whole site ladder outside the modifier system). So the colony is now poorer by precisely
// what data/actSevenSitesConfig.js bills, which at full build-out is 343.8 Power/s, 34.5 O2/s and
// 110.9 Provisions/s.
//
// WHERE IT BITES IS OXYGEN, NOT POWER, which is not what the headline Power figure suggests.
// Oxygen appears in every site's `baseUpkeep` and the Oxygen ladder is the thinnest in the module
// catalogue — 0.35, then 1.2, then 6.0 per copy. As a share of gross at a minimum-sustaining
// portfolio: 10.7% at the L2 fill, 27.5% at L3, 45.3% at L4, and 61.6% once the Warning Track is
// colonized. It bites from the very first colonization, too — Home Plate's free 2.0 O2/s against
// On-Deck's 1.5 O2/s leaves +0.5, so the act's only free atmosphere is 75% smaller than any
// pre-fix tuning assumed. The full per-rung table is in data/actSevenSitesConfig.js beside the
// upkeep rows it is derived from.
//
// END TO END THE LADDER MOVES BY 0.4 MINUTES ACROSS 18.4 HOURS (padTier5@thirdBase at minute
// 1,106.5 fixed against 1,106.1 pre-fix; every earlier rung within 0.4 min likewise). That is a
// finding, not a null result, and the reason is the one worth carrying forward: a buyer that holds
// large generator margins keeps `satisfaction` at 1.000, and charging upkeep against a large
// margin changes nothing at all. The correction is nearly free for a colony with slack and it is
// the difference between playing and stalling for one without — with the pre-Track portfolio and
// The Swing built, Power runs -285.8/s against a 2.9-minute buffer where the pre-fix engine
// reported it comfortably positive.
//
// NOTHING WAS RETUNED IN RESPONSE. The phases whose tuning predates the fix (STORY-025's
// `aftermath`/`lifeSupport` work, STORY-027's cost ladder) are unaffected at the resolution their
// own measurements were taken at, and the one number the fix genuinely changes — the free Oxygen
// margin — is recorded here so the next story to tune Oxygen starts from 0.5 rather than 2.0.
// ---------------------------------------------------------------------------------------------

module.exports = {
  expeditionSlice,
  resolvedSites,
  colonyRates,
  integrateColony,
  nextColonyThresholdClock,
  spendResource,
  creditResource,
  // Exported for engine/contracts.js, which re-exports it under PRD §9.6's name. See the cycle
  // argument at the top of this file for why the arithmetic lives here rather than there.
  contractUpkeepPerSecond,
  // Exported for engine/contracts.js's act gate. The contract board's `nextOfferAtClock` defaults
  // to 0 — a legitimate value meaning "a refresh may happen now" — which is also, unguarded, a
  // boundary in the PAST for every save in every earlier act. Without this gate the event-clock
  // contributor would propose it, advance() would step to it, refreshBoard() would run, and an
  // `expedition` slice would be materialised into Act I saves. This is the identical failure the
  // Home Plate note above describes and it is refused by the identical test.
  isExpeditionLive,
  isAftermathPhase,
  isLifeSupportPhase,
};
