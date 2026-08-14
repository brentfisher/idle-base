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
const { computeModifiers } = require('./modifiers');

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
// `amount` uses `|| 0` deliberately: 0 IS the default there, so absent and zero mean the same thing
// and the trap is inert.
function normalizeResource(stored, resource) {
  const record = stored || {};
  const amount = record.amount || 0;
  const capacity = Number.isFinite(record.capacity) ? record.capacity : resource.baseCapacity;
  return { amount: Math.max(0, amount), capacity: Math.max(0, capacity) };
}

// `puzzles` is the one field keyed by id rather than listed, so it needs its own guard. Array.isArray
// is excluded explicitly because `typeof [] === 'object'` — an array here is a corrupt save, and
// letting one through would give every `puzzles[puzzleId]` lookup an undefined instead of a default.
function isPuzzleMap(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
    // In-flight AND completed launches share one list (PRD §4). An in-flight record is one with
    // `resolved: false` and an `arrivesAtClock`, which is what makes arrival resolution idempotent
    // by construction rather than needing a separate slot to reconcile.
    launches: Array.isArray(slice.launches) ? slice.launches : [],
  };
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
// Where the site and contract terms go: engine/sites.js's story adds
// `+ drawMult * Σ_sites site.draw[r]` and engine/contracts.js's adds
// `+ drawMult * contractUpkeepPerSecond(state)[r]`, both HERE, before the solve. A contract
// drawing 3 Power/s is a consumer like any other; folded in after the solve it can push a resource
// through zero inside a step, which is the precise failure this whole file prevents.
function demandAtFullOutput(owned, drawMult) {
  const demand = zeroedByResource();
  owned.forEach(({ definition, count }) => {
    const consumes = definition.consumes || {};
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      const rate = consumes[resourceId];
      if (Number.isFinite(rate) && rate > 0) demand[resourceId] += drawMult * count * rate;
    });
  });
  return demand;
}

// gross[r] at a given ration. The only quantity in the solve that depends on `satisfaction`, which
// is what makes gross and satisfaction mutually recursive and the ration a fixed point.
//
// `extraThrottle` is the load-follow pass, applied on the second call only (it is `null` during the
// solve). Keeping it out of the iteration is deliberate and is explained on applyLoadFollow().
//
// engine/sites.js's story adds `+ Σ_sites site.produces[r]` here — Home Plate's 2.0 O2/s, the only
// free atmosphere in the game — OUTSIDE the throughput term, because a planet does not load-follow.
function grossProduction(owned, satisfaction, modifiers, extraThrottle) {
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
// MEASURED CONVERGENCE BOUND (this story's harness, /tmp, not committed — there is no test runner
// in this repo):
//   * empty colony (everything this story ships): 1 pass. delta is 0 on the first pass.
//   * healthy end-of-lifeSupport colony (PRD §5.7's 8h trace fixture): 1 pass.
//   * over-committed colony, Power stock 0 (PRD §5.6 example A): 2 passes — the second pass
//     confirms delta 0 and exits. Matches the PRD's hand-worked "CONVERGED (2 passes)".
//   * fully collapsed colony, Power AND Provisions both at 0 with the reactors fed by the
//     hydroponics they power (PRD example B): 16 passes, i.e. it exhausts SOLVE_MAX_PASSES and
//     stops on the cap rather than on SOLVE_EPSILON. It lands at s.power = 0.3488 against a
//     closed-form 0.3431 — 1.7% high, inside §5.6's stated 2%. Per-pass contraction measured at
//     0.63, exactly the PRD's figure.
//   * WORST CASE OBSERVED ACROSS EVERY FIXTURE: 16 passes, and only ever on the mutually-recursive
//     collapse. Never more, because 16 is the cap; the point of the measurement is that nothing
//     except the deliberate collapse fixture gets anywhere near it, so the cap costs nothing on
//     the live path and buys a bounded worst case on the offline one.
//   * No fixture oscillated. The sequence was non-increasing on every pass of every fixture, which
//     is what the Math.min guarantees and what the harness asserted directly rather than inferred.
function solveSatisfaction(owned, stocks, demand, modifiers) {
  let satisfaction = EXPEDITION_RESOURCE_IDS.reduce((acc, id) => {
    acc[id] = 1;
    return acc;
  }, {});
  let passes = 0;

  for (let pass = 0; pass < SOLVE_MAX_PASSES; pass += 1) {
    passes = pass + 1;
    const gross = grossProduction(owned, satisfaction, modifiers, null);
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
function actualDraw(owned, drawMult, throttles) {
  const draw = zeroedByResource();
  owned.forEach(({ definition, count }) => {
    const consumes = definition.consumes || {};
    const followed = loadFollowOf(definition, throttles);
    EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
      const rate = consumes[resourceId];
      if (Number.isFinite(rate) && rate > 0) draw[resourceId] += drawMult * count * rate * followed;
    });
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
//   capacity       the ceiling, from the slice.
//   passes         diagnostic only: how many solve passes this took. Not part of the contract;
//                  it exists because the convergence bound above is a deliverable, not a claim.
function colonyRates(state, modifiers) {
  const slice = expeditionSlice(state);
  const resolved = modifiers || computeModifiers(state);
  const owned = ownedModules(slice);
  const drawMult = multiplierOf(resolved, DRAW_MULTIPLIER_KEY);

  const stocks = {};
  const capacity = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    stocks[resourceId] = slice.resources[resourceId].amount;
    capacity[resourceId] = slice.resources[resourceId].capacity;
  });

  const demand = demandAtFullOutput(owned, drawMult);
  const { satisfaction, passes } = solveSatisfaction(owned, stocks, demand, resolved);

  const rationed = grossProduction(owned, satisfaction, resolved, null);
  const supplyThrottle = loadFollowThrottles(rationed, demand, stocks, capacity);
  const gross = grossProduction(owned, satisfaction, resolved, (definition) =>
    loadFollowOf(definition, supplyThrottle)
  );
  const draw = actualDraw(owned, drawMult, supplyThrottle);

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
  const net = {};
  EXPEDITION_RESOURCE_IDS.forEach((resourceId) => {
    const raw = gross[resourceId] - draw[resourceId];
    if (stocks[resourceId] <= 0 && raw < 0) {
      net[resourceId] = 0;
    } else if (stocks[resourceId] >= capacity[resourceId] && raw > 0) {
      net[resourceId] = 0;
    } else {
      net[resourceId] = raw;
    }
  });

  return { satisfaction, supplyThrottle, gross, demand, net, capacity, passes };
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

  if (!moved) return state;

  // Spreads the FULL accessor return, never a partial object. engine/concessions.js records the
  // near-miss this convention exists to prevent: the accessor's result is what gets written back,
  // so a key the accessor forgets is a key every later write silently deletes.
  return { ...state, expedition: { ...slice, resources } };
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
// MEASURED ITERATION BOUND FOR AN 8-HOUR RETURN (this story's harness):
//   * empty colony: 1 advance() iteration for the full 28,800s — unchanged from before this story,
//     which is the whole point of shipping with the catalogue empty.
//   * PRD §5.7's healthy end-of-lifeSupport colony: 6 iterations. Four boundary steps (Power at
//     cap, Fuel at cap, Provisions at cap, Oxygen at cap), one cascade iteration behind the
//     Provisions pin, and the terminal step that credits the remaining 7h43m in one pass.
//   * over-committed colony (net-negative on Power, Oxygen AND Provisions): 4 iterations — three
//     resources cross zero, and the fourth iteration takes the entire remainder because every
//     crossed resource is then pinned and abstains.
//   * fully collapsed colony: 1 iteration. Everything is already pinned, so nothing has a boundary.
//   * WORST CASE OBSERVED: 6 iterations, against balanceConfig.safetyCapIterations of 2,000 — a
//     margin of 333x. The PRD's a-priori derivation was 21, stated as 25 (3 regime changes x 4
//     resources, plus 2 cascade iterations per capacity pin, plus a terminal step); the measured
//     figure is comfortably under it because real colonies do not put every resource through every
//     regime in one absence. The number that matters is that BOTH are far below 2,000: silently
//     hitting that cap would under-credit a returning player with no error raised anywhere, so the
//     margin is the deliverable, not the count.
// COLONY_MIN_STEP_SECONDS caps the pathological case independently of any of this: it drops
// boundaries closer than half a second, so even a colony contrived to chatter cannot produce a run
// of zero-length steps.
function nextColonyThresholdClock(state, modifiers) {
  const slice = expeditionSlice(state);
  if (slice.modules.length === 0) return Infinity;

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

module.exports = {
  expeditionSlice,
  colonyRates,
  integrateColony,
  nextColonyThresholdClock,
  spendResource,
  isAftermathPhase,
  isLifeSupportPhase,
};
