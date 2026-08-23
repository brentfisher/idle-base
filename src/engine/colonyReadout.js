const { EXPEDITION_RESOURCES } = require('../data/actSevenConfig');
const { RESOURCE_WARNING_SECONDS, RESOURCE_FULL_EPSILON } = require('../data/colonyReadoutConfig');
const { colonyRates, expeditionSlice } = require('./colony');
const { computeModifiers } = require('./modifiers');

// THE READOUT'S BOUNDARY HELPERS — one solve per helper, one helper per surface (PRD ledger R5).
//
// TWO OF THEM NOW: listResources() for the header chips (§6.6) and opsReadout() for the Ops panel
// (§6.4, STORY-035). They are siblings rather than one function with a flag because they want
// different SHAPES — the header wants four rows, the panel wants four rows and the three scalars
// beside them — and a single function returning the union would hand the header a ration it has no
// slot for. What they emphatically do not each get is a solve of their own per surface per tick:
// both take exactly one, and both build their rows through resourceRows() below, so the chip and
// the panel are reshapings of the same numbers and cannot disagree.
//
// It lives in a file of its own rather than in engine/colony.js for one reason: colony.js is the
// SIMULATION and this is a PRESENTATION shape. Everything below is a reshaping of numbers
// colonyRates() already returned; nothing here computes a rate, and nothing here may ever start.
//
// WHY THAT RULE IS NOT PEDANTRY. The header's job in Act VII is to tell the player when a resource
// is about to bottom out. If it derived its own rate — even "the same" arithmetic, written twice —
// the two would drift the first time either changed, and a header that says 40 seconds while the
// engine crosses the boundary in 4 is worse than no warning at all. There is exactly one solve
// (colonyRates), it happens once per call, and every field below is arithmetic ON its output.
//
// Deliberately NOT a second solve, and it would be easy to write one by accident: `net` is already
// pinned to exactly 0 against a boundary the resource cannot cross (colony.js's THE PIN comment),
// so "seconds until empty" must be computed from that pinned net and must therefore report
// Infinity — not 0 — for a resource that is already sitting on the floor. A resource pinned at
// empty is not "about to run out"; it has run out, and it is stable there until the player buys
// something. Those are different states and the chip shows them differently.

// `modifiers` is optional and defaults internally, exactly as colonyRates() does. A required
// second argument would force the caller — a component — to decide which modifier set the readout
// is computed against, and components decide nothing about rules. A caller that already has the
// solved modifiers (the tick loop, a future panel) may still pass them to avoid recomputing.
function listResources(state, modifiers) {
  const resolved = modifiers || computeModifiers(state);
  return resourceRows(expeditionSlice(state), colonyRates(state, resolved));
}

// The one condition under which a surface prints `unclamped` instead of `net`: the resource is at
// its ceiling and the colony is making more than it is banking.
//
// `> net` rather than `> 0` is the whole test. A full tank whose colony is running a deficit has
// `unclamped` below `net` — it is draining off the top, `net` is already negative and already true
// — and swapping in a smaller number there would be inventing a worse reading than the real one.
// The swap only ever moves the display UP, toward the supply the ceiling is hiding.
//
// The `capacity > 0` guard is the same one `full` carries and it is load-bearing for the same
// reason: Fuel before the first tank is 0 amount against 0 capacity, which is unbuilt rather than
// full, and an Electrolysis Stack bought before a tank would otherwise report a cheerful +0.35/s
// on a resource that cannot store a single unit.
function showsUnclamped(slice, rates, id) {
  const capacity = rates.capacity[id];
  if (!(capacity > 0)) return false;
  if (slice.resources[id].amount < capacity - RESOURCE_FULL_EPSILON) return false;
  return rates.unclamped[id] > rates.net[id];
}

// The rows, given a slice and a solve that has ALREADY HAPPENED. Split out of listResources() by
// STORY-035 so that opsReadout() below can share it, and the split is the whole point rather than
// tidiness: the Ops panel needs the rows AND the three scalars beside them, and the obvious way to
// get both — call listResources() and colonyRates() — takes TWO 16-pass Kleene solves per render
// on the one screen in the act that is open continuously. That is precisely the drift this file's
// header forbids, in its most expensive form.
//
// Takes the resolved objects rather than `state` so it CANNOT solve. A function that received
// state could reach for colonyRates() itself, and the second solve would be back — invisible,
// because it would agree with the first one right up until a caller passed different modifiers.
function resourceRows(slice, rates) {
  return EXPEDITION_RESOURCES.map((resource) => {
    const id = resource.id;
    const amount = slice.resources[id].amount;
    const capacity = rates.capacity[id];
    const net = rates.net[id];

    return {
      id,
      label: resource.label,
      amount,
      capacity,
      // The fill fraction, for a meter. Capacity 0 is a REAL value, not missing — Fuel has no tank
      // until one is built.
      //
      // IT READS 0, NOT 1. The first version returned 1 on the theory that a resource with nowhere
      // to go is "full", which drew a completely filled bar next to the text "0/0" — the meter
      // saying full while the numbers said empty. Nothing is stored and nothing is storable, so
      // an empty bar is the honest picture. `full` is guarded separately on capacity > 0, so no
      // other state depends on this.
      fraction: capacity > 0 ? Math.max(0, Math.min(1, amount / capacity)) : 0,
      net,
      // THE RATE THE SURFACES ACTUALLY PRINT, and it is `net` in every case but one.
      //
      // A resource sitting on its ceiling reads `0/s` on `net` by construction — the engine either
      // pinned it there or load-follow backed its producers off until it landed there — and that is
      // an honest statement about the STOCK that leaves a false impression about the COLONY. Five
      // RTGs against a full Power tank put `net` at exactly 0, so the header shows a player who
      // owns 15 Power/s of generation the same reading it shows a player who owns nothing. The rate
      // is the one number on the chip that says whether the resource is worth anything, and going
      // blank at the ceiling is the moment it has the most to say.
      //
      // So at the full end the surfaces print `unclamped` — what the bus would run at with
      // headroom — and `venting` below tells them that is what they are printing. The stock, the
      // meter and the `full` flag are untouched: the tank still reads 100/100 with a full bar,
      // because it IS full. The rate says +15.0/s because that much is being made.
      //
      // ONLY THE FULL END. The empty end's `0/s` is a different statement with its own argument
      // (see `starved` below and the note at the head of this file): a starved resource is not
      // "producing 15/s that isn't landing", it is producing nothing, and the negative `unclamped`
      // there is unmet DRAW rather than discarded supply. Printing it would turn "this has run out"
      // into a countdown that never ticks.
      //
      // DECIDED HERE RATHER THAN IN THE TWO COMPONENTS, for the reason this file's header gives:
      // the header chip and the Ops panel must not each hold their own opinion about which of two
      // rates to show, or they will eventually disagree in front of the player.
      shownNet: showsUnclamped(slice, rates, id) ? rates.unclamped[id] : net,
      // Whether `shownNet` is supply being thrown away rather than supply being banked. The two
      // surfaces word it differently — a tooltip and a sentence — but neither may work it out, and
      // it deliberately does NOT key off `pinned === 'capacity'`, which is a narrower condition
      // than it looks: a bus filled by MODULES load-follows to a dead stop, `gross - draw` lands on
      // 0, the capacity branch never fires and `pinned` comes back null. That is the commonest full
      // tank in the act and it is exactly the one the player asked to be able to see.
      venting: showsUnclamped(slice, rates, id),
      // The SIGN, not the number, is what the chip colours on. Separated out so the component
      // never applies a threshold of its own: a component asking `net < 0` is a component deciding
      // what counts as falling, which is a rules question the moment a hysteresis band is wanted.
      trend: net > 0 ? 'rising' : net < 0 ? 'falling' : 'steady',
      secondsUntilEmpty: secondsUntilEmpty(amount, net),
      warning: isWarning(amount, net),
      full: capacity > 0 && amount >= capacity - RESOURCE_FULL_EPSILON,
      // A resource pinned at zero and stable there. Distinct from `warning`, which means "heading
      // for zero": this one has arrived, and the only thing that lifts it is a purchase. The chip
      // says so rather than showing a countdown that would never tick.
      //
      // `capacity > 0` IS LOAD-BEARING AND WAS A BUG WITHOUT IT. Fuel starts at 0 amount and 0
      // capacity — the player has no tank until they build one, which actSevenConfig.js is
      // explicit is a real value and not a placeholder. Without this clause every fresh Act VII
      // save opens with an alarm-red Fuel chip describing a crisis that is actually the normal
      // starting state. A resource with nowhere to put anything is not starved; it is unbuilt.
      starved: capacity > 0 && amount <= 0 && net <= 0,
      // WHICH END THE ENGINE PINNED THIS RATE AGAINST, passed straight through from colonyRates()
      // — 'empty', 'capacity' or null. Not computed here and not computable here: `net` is already
      // 0 by the time this file sees it, so a 0 that was ASSIGNED and a 0 that was calculated are
      // indistinguishable from anything in this scope. See THE PIN in engine/colony.js.
      //
      // DELIBERATELY NOT THE SAME FIELD AS `starved`, though they overlap at the empty end.
      // `starved` is a HEADER state and carries a `capacity > 0` guard, because a resource with
      // nowhere to store anything is unbuilt rather than in crisis and the chip must not open every
      // fresh Act VII save with an alarm about Fuel. `pinned` is the ENGINE's fact, ungated, and it
      // covers a case `starved` does not describe at all: the FULL end.
      //
      // WHICH RESOURCES CAN ACTUALLY PIN AT CAPACITY — MEASURED, because the intuitive answer is
      // wrong and this story's first draft of this comment gave it. A MODULE producing into a full
      // tank does NOT pin: loadFollowThrottles() sets its throttle to demand/gross, the producer
      // backs off, `raw` lands at exactly 0 and the pin branch never fires. Driven under `node`, an
      // Electrolysis Stack bought before a Fuel tank (capacity 0, amount 0) reports
      // `supplyThrottle.fuel = 0` and `pinned.fuel = null` — the stack simply stops.
      //
      // The capacity pin therefore fires on production that CANNOT be load-followed, which in this
      // act means SITE production: Home Plate's 2.0 O2/s takes neither throttle, because a planet
      // does not back off because your tank is full (siteProductionPerSecond() in colony.js argues
      // it at length). Measured: a fresh Act VII save with Oxygen at 100/100 reports
      // `pinned.oxygen = 'capacity'` and `net.oxygen = 0`. That is the real reading the panel has to
      // explain — free atmosphere being vented because there is nowhere to put it — and it is
      // reachable in the act's opening minutes.
      //
      // No guard is needed for the Fuel-at-0-capacity case either way: with no Fuel producer at all
      // `raw` is exactly 0, neither branch fires, and a genuinely fresh save reports no pin.
      pinned: rates.pinned[id],
      // §5.6's two throttles, per resource, kept apart for the same reason colonyRates() returns
      // them apart: `satisfaction` is how much of what this bus was ASKED for it could supply, and
      // `supplyThrottle` is how far its producers BACKED OFF because the tank is full. They are
      // near-opposite conditions — starving and glutted — and folding them into one "efficiency"
      // number would make the two failure modes of the act look identical.
      satisfaction: rates.satisfaction[id],
      supplyThrottle: rates.supplyThrottle[id],
      // The `< 1` tests, decided HERE. A component asking `satisfaction < 1` is a component
      // deciding what counts as rationed, which is the identical objection the `trend` note above
      // makes — and it is the line that would have to move the day either throttle grows a
      // deadband. Strict, because 1 is the un-throttled value both terms are initialised to.
      rationed: rates.satisfaction[id] < 1,
      backedOff: rates.supplyThrottle[id] < 1,
    };
  });
}

// THE TIGHTEST BUS. A single headline number for a per-resource quantity, and the reduction is a
// DECISION — which is why it is here and not in the panel that wants to print it.
//
// The minimum, and it has to be the minimum rather than an average: §5.6 solves the ration per
// resource, but throughputOf() then runs every module at the LOWEST satisfaction among its inputs.
// The worst bus is therefore not one input to how starved the colony is, it IS how starved the
// colony is — an average would report a comfortable 80% for a colony whose reactors have stopped.
//
// Returns the id alongside the value, because "68%" alone is a number the player cannot act on and
// "68%, Power" is an instruction. Ties go to the first in configured order, which is stable rather
// than arbitrary: EXPEDITION_RESOURCES is ordered and does not depend on object key iteration.
function tightest(byResource) {
  let worst = { id: null, value: 1 };
  EXPEDITION_RESOURCES.forEach((resource) => {
    const value = byResource[resource.id];
    if (!Number.isFinite(value) || value >= worst.value) return;
    worst = { id: resource.id, label: resource.label, value };
  });
  return worst;
}

// THE OPS PANEL'S BOUNDARY HELPER (PRD §6.4, STORY-035) — one solve, one helper, same as above.
//
// It exists so the panel can render the rows, the ration, the load-follow and Salvage/s from a
// SINGLE colonyRates() call. Every field below is a reshaping of that one solve; nothing here
// computes a rate, and the arithmetic that is here (the minimum, the `< 1` tests) is a reduction of
// the engine's output rather than a second model of it.
//
// SALVAGE IS PASSED THROUGH RATHER THAN RECOMPUTED, and that is the point of it being in the solve
// at all: engine/income.js reads the same `rates.salvage` for the header's per-second figure, so
// the panel and the header cannot disagree about how starved the colony is. Two surfaces summing
// drone output independently would drift the first time a module's throttle rule changed.
function opsReadout(state, modifiers) {
  const resolved = modifiers || computeModifiers(state);
  const slice = expeditionSlice(state);
  const rates = colonyRates(state, resolved);

  return {
    phase: slice.phase,
    rows: resourceRows(slice, rates),
    // The headline pair. `ration` is the empty end, `throttle` the full end; both read 1 (and a
    // null id) for a colony under no pressure at either, which is the honest reading of a colony
    // that is simply fine.
    ration: tightest(rates.satisfaction),
    throttle: tightest(rates.supplyThrottle),
    salvage: rates.salvage,
  };
}

// THERE IS DELIBERATELY NO `quiet` FLAG HERE, AND THE ATTEMPT IS WORTH RECORDING BECAUSE IT LOOKS
// OBVIOUS. `aftermath` runs 20-30 minutes on this one screen, so a line saying "these zeros are
// correct, the site is not up yet" seems clearly worth having. It was written, driven, and removed:
// a fresh Act VII save is NOT quiet. Home Plate is reached and colonized from the first second and
// produces 2.0 O2/s, so `gross.oxygen` is 2 and any honest test of "nothing is happening" is false
// from t = 0 — the note would have been unreachable copy in the file that exists to hold the copy.
//
// The job it was going to do is done better by the per-phase `note` in data/actSevenOpsConfig.js,
// which always renders, is keyed by the same phase the directive is, and can say the true thing:
// the planet still makes its own air, and everything else reads zero until the player builds.

// Infinity whenever the resource is not actually falling, which includes the pinned-at-empty case
// described above. Callers format Infinity as an em dash; they must not treat it as a large
// number.
function secondsUntilEmpty(amount, net) {
  if (!Number.isFinite(net) || net >= 0) return Infinity;
  if (amount <= 0) return Infinity;
  return amount / -net;
}

// The warning state, decided HERE and not in the chip. It is a rules question — "is this about to
// hurt" — and conventions.md is explicit that components decide nothing about availability. The
// threshold is authored in data/colonyReadoutConfig.js, because a number inline in an engine is a
// bug just as much as one in a component.
//
// A resource already at zero is NOT a warning. It is a state (`starved`), and conflating the two
// would light the same colour for "you have ninety seconds to fix this" and "this has been broken
// for an hour", which are the two most different things the header can say.
function isWarning(amount, net) {
  if (amount <= 0) return false;
  const seconds = secondsUntilEmpty(amount, net);
  return Number.isFinite(seconds) && seconds <= RESOURCE_WARNING_SECONDS;
}

module.exports = { listResources, opsReadout };
