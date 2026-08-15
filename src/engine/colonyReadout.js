const { EXPEDITION_RESOURCES } = require('../data/actSevenConfig');
const { RESOURCE_WARNING_SECONDS, RESOURCE_FULL_EPSILON } = require('../data/colonyReadoutConfig');
const { colonyRates, expeditionSlice } = require('./colony');
const { computeModifiers } = require('./modifiers');

// THE HEADER'S BOUNDARY HELPER — one solve, one helper (PRD ledger R5).
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
  const slice = expeditionSlice(state);
  const rates = colonyRates(state, resolved);

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
      // until one is built — and a resource with nowhere to go reads as full rather than as a
      // division by zero.
      fraction: capacity > 0 ? Math.max(0, Math.min(1, amount / capacity)) : 1,
      net,
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
    };
  });
}

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

module.exports = { listResources };
