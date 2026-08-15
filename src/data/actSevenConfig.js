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
const { ACT_SEVEN_MODULES } = require('./actSevenModulesConfig');

const EXPEDITION_PHASES = ['aftermath', 'lifeSupport', 'lunar', 'deepSpace', 'majors'];

// Where a fresh expedition starts. `aftermath` is the default phase in the predicate ladder — the
// player has landed in the wreck and owns no generator yet.
const INITIAL_PHASE = EXPEDITION_PHASES[0];

// The rank of a phase in that ladder, and the ONLY way anything in the act should compare two
// phases. Gating is "has the run reached at least `lunar`", never "is the run in `lunar`" — an
// equality test against a phase is a rung that disappears from under a returning player the moment
// they progress past it, which is how a ladder becomes unclimbable.
//
// -1 for an unrecognized phase, and every caller so far treats that as FAILING OPEN — the same
// convention getUnlockedFeatures() uses against `unlockedBy` in engine/progression.js. That is the
// safe direction here specifically because `expedition.phase` is self-healing: engine/sites.js
// recomputes it from a pure predicate ladder every advance(), so an unrecognized value is a corrupt
// save one tick from repair, and failing closed would hide the act's only Salvage sink for that
// tick. Failing open shows a row early; failing closed can strand a save.
//
// Lives here rather than in each consumer because engine/actSevenModules.js, engine/sites.js and
// §6's tab reveal all ask the same question, and three private copies of one indexOf is three
// places for that convention to be got subtly wrong.
function phaseRank(phaseId) {
  return EXPEDITION_PHASES.indexOf(phaseId);
}

// THE TWO PHASES WHOSE PREDICATE IS NOT A FACT ABOUT A SITE, named here so engine/sites.js's phase
// ladder contains no phase-id literals.
//
// Three of the five phases are answered entirely by data: `aftermath` is the default, and `lunar`
// and `deepSpace` are declared by the site rows that grant them (`reachedPhase` on On-Deck,
// `commitPhase` on Second Base). These two cannot be, because neither is about a place. Owning a
// generator is §5's condition and the milestone at the end is §7.8's, so they are named rather than
// derived, and the phase writer asks about them by name.
//
// Both MUST appear in EXPEDITION_PHASES above. If one does not, its predicate can never be reached
// and the ladder silently tops out one rung early — which is why they are declared beside the list
// rather than typed into the engine that compares them.
const LIFE_SUPPORT_PHASE = 'lifeSupport';
const MAJORS_PHASE = 'majors';

// The milestone that ends the act (PRD §7.8): committing the fifth burn, over the wall. Set by
// STORY-032's win condition, read here so the phase ladder has a top rung the day that lands and
// reads `false` — harmlessly, through a defaulted lookup — until then.
const OVER_THE_WALL_MILESTONE = 'overTheWall';

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

// The order every solve, every clamp and every boundary scan iterates in. Derived from the list
// above rather than written out a second time, so adding a fifth consumable is one edit.
const EXPEDITION_RESOURCE_IDS = EXPEDITION_RESOURCES.map((resource) => resource.id);

// THE MODULE CATALOGUE, AND IT IS DELIBERATELY EMPTY. PRD §8 has the authored ladder (Reclaimer
// Drone, RTG, Fission Pile, scrubbers, hydroponics, Electrolysis Stack, the storage tiers), and
// every one of those rows lands with the story that prices it, carrying the measurement comment
// the house style requires. The consumption engine ships first and ships against nothing.
//
// That is not caution, it is the proof strategy. With no modules owned the colony produces
// nothing, consumes nothing, `colonyRates()` returns all-zero rates, `nextColonyThresholdClock()`
// returns Infinity and `integrateColony()` returns the state object it was handed — so `advance()`
// is provably byte-for-byte what it was before this change, on every save in existence, while the
// offline-safety behaviour is proven against a synthetic colony injected at test time. Content and
// correctness are separated so a balance edit can never silently become a correctness regression.
//
// Shape of an entry, for the story that fills this in:
//   { id, label, phase, produces: { [resourceId]: perSecond }, consumes: { [resourceId]: perSecond },
//     capacity: { [resourceId]: units } }
// `produces`/`consumes` are per-copy rates at FULL output; `capacity` is a flat per-copy grant. An
// owned entry in `state.expedition.modules` is `{ id, count }`.
//
// READ AT CALL TIME, NEVER MEMOIZED INTO A MODULE-LOAD LOOKUP MAP in engine/colony.js. The acts
// table has burned this project twice — `FINAL_ACT_INDEX` is `ACTS.length - 1` captured at load, so
// a test that appends an act is silently clamped away and passes for the wrong reason. A by-id map
// built once at load here would do the identical thing to every synthetic colony a harness injects:
// the mutation would be invisible, every rate would solve to zero, and an offline-safety suite
// would go green having simulated nothing at all.
// Populated from data/actSevenModulesConfig.js, which owns the rows and their measurement
// comments. The indirection is not ceremony: this file is the act's SHAPE and is required by
// engine/colony.js on every solve, whereas the ladder is a tuning table that will be edited by
// every content story in the act. Keeping them apart means a balance edit never touches the file
// that defines what a resource IS.
//
// Still deliberately partial — `aftermath` rows only. Everything the header note below says about
// shipping against an empty catalogue applies unchanged to shipping against a one-phase one: the
// phases with no rows produce nothing, solve to zero, and are provably unaffected.
const EXPEDITION_MODULES = ACT_SEVEN_MODULES;

// The Kleene iteration in colonyRates(). `gross` and `satisfaction` are mutually recursive — a
// reactor that eats Provisions feeds the hydroponics that grow them — so the ration is a fixed
// point, solved by iterating from the top element (everything fully satisfied) downward.
//
// 16 passes is PRD §5.6's derivation and it is not a round number: the per-pass contraction is
// ≈0.63 because two rations lag each other by a pass, and its worked example B (a colony whose
// only Power source beyond the RTGs is fed by the Provisions that Power grows) needs 16 passes to
// land within 2% of the closed-form 0.3431. 8 passes leaves a 2.5% OVER-estimate, and an
// over-estimated ration is the dangerous direction: it credits production the colony cannot make.
//
// The measured worst case on the fixtures this story drives is recorded in engine/colony.js.
const SOLVE_MAX_PASSES = 16;
const SOLVE_EPSILON = 1e-4;

// Belt-and-braces on the boundary contributor, not the mechanism. Any resource boundary closer
// than this is not reported, so no accumulation of float error can hand advance() a run of
// zero-length steps — which would burn `balanceConfig.safetyCapIterations` (2,000) without moving
// the clock, and silently discard the rest of a returning player's eight hours.
//
// The cost is at most half a second of integration error per boundary crossed. Across an 8h replay
// that crosses a handful of boundaries this is invisible; it is also the dominant term in the
// chunked-vs-stepwise tolerance recorded in engine/colony.js, and it is why that comparison states
// a tolerance instead of asserting equality.
const COLONY_MIN_STEP_SECONDS = 0.5;

// PRD §5.9's generation multipliers, named here so engine/colony.js contains no key literals.
//
// INERT TODAY, ON PURPOSE. These are not in data/modifierKeysConfig.js's BONUS_KEYS yet — the
// story that lands Act VII's powerups registers them, with the clamps §5.9 specifies
// (output multipliers [1, 4], `lifeSupportDrawMult` [0.4, 1]). Until then computeModifiers()
// simply does not emit them, every read below defaults to 1, and the solve is unaffected.
//
// The reads exist now anyway because they must be applied BEFORE the satisfaction solve, not after
// it: a Power powerup has to raise the ration and un-throttle the whole colony, which is what makes
// it the right purchase in a crisis. Wiring them in later would mean re-opening the solve; wiring
// the defaulted reads in now makes that story a data change in modifierKeysConfig.js.
const OUTPUT_MULTIPLIER_KEYS = {
  power: 'powerOutputMult',
  oxygen: 'oxygenOutputMult',
  provisions: 'provisionsOutputMult',
  fuel: 'fuelOutputMult',
};
const DRAW_MULTIPLIER_KEY = 'lifeSupportDrawMult';

module.exports = {
  EXPEDITION_PHASES,
  INITIAL_PHASE,
  LIFE_SUPPORT_PHASE,
  MAJORS_PHASE,
  OVER_THE_WALL_MILESTONE,
  phaseRank,
  EXPEDITION_RESOURCES,
  EXPEDITION_RESOURCE_IDS,
  EXPEDITION_MODULES,
  SOLVE_MAX_PASSES,
  SOLVE_EPSILON,
  COLONY_MIN_STEP_SECONDS,
  OUTPUT_MULTIPLIER_KEYS,
  DRAW_MULTIPLIER_KEY,
};
