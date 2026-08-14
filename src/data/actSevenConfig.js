// Act VII — the Farm Team odyssey (docs/PRD-act-seven-farm-team.md). Shape only, for now.
//
// This file currently carries ONE thing: the base shape of `state.expedition`. It is deliberately
// not a tuning table yet — no module ladder, no site list, no Salvage costs. Those numbers are
// provisional until they have been simulated (PRD §3.7), and each belongs to the story that lands
// the mechanic it prices, with the measurement comment the house style requires.
//
// WHY THE SHAPE LIVES HERE AND NOT IN state/initialState.js. Two places construct an expedition:
// createInitialState() for a fresh game, and expeditionSlice() in engine/colony.js for every save
// that predates the slice. If each wrote its own literal they would drift, and drift in a slice
// accessor is not cosmetic — engine/concessions.js records the failure mode in full: a shop spreads
// the accessor's return value when it writes the slice back, so a key one copy forgets is a key
// every later write silently deletes. One base shape, two readers, no second copy.

// The odyssey's five phases, in order. `expedition.phase` is stored but self-healing: engine/sites.js
// will recompute it from a pure predicate ladder (PRD R4), and it is the SINGLE progression signal
// for the act — there are no parallel milestone flags mirroring it. Ordered because the gating rule
// is a rank comparison ("at least `lunar`"), never an equality test against one phase.
const EXPEDITION_PHASES = ['aftermath', 'lifeSupport', 'lunar', 'deepSpace', 'majors'];

// Where a fresh expedition starts. `aftermath` is the default phase in the predicate ladder — the
// player has landed in the wreck and owns no generator yet.
const INITIAL_PHASE = EXPEDITION_PHASES[0];

// The four consumables. These are NOT currencies and must never be added to data/currencies.js:
// a currency is monotonic, spendable and a header chip, whereas these fill and drain against a
// ceiling and carry signed net rates. Fuel is the clearest case — it is not a price, it is a
// threshold you fill and empty, and it must not sit in the header beside things you spend.
//
// FUEL'S BASE CAPACITY IS 0, AND THAT IS A REAL VALUE, NOT A PLACEHOLDER. The player has no tank
// until they build one, so Fuel cannot be stored at all in the early phases — that is the gate that
// makes the first tank purchase mean something. Every default that reads a capacity must therefore
// distinguish "absent" from "zero"; see the Number.isFinite note in engine/colony.js.
const EXPEDITION_RESOURCES = [
  { id: 'power', label: 'Power', baseCapacity: 100 },
  { id: 'oxygen', label: 'Oxygen', baseCapacity: 100 },
  { id: 'provisions', label: 'Provisions', baseCapacity: 100 },
  { id: 'fuel', label: 'Fuel', baseCapacity: 0 },
];

module.exports = { EXPEDITION_PHASES, INITIAL_PHASE, EXPEDITION_RESOURCES };
