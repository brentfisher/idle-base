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
const { INITIAL_PHASE, EXPEDITION_RESOURCES } = require('../data/actSevenConfig');

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

module.exports = { expeditionSlice };
