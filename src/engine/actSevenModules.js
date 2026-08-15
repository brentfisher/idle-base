const { ACT_SEVEN_MODULES, moduleCost, getModuleDefinition } = require('../data/actSevenModulesConfig');
const { EXPEDITION_PHASES } = require('../data/actSevenConfig');
const { expeditionSlice } = require('./colony');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// Act VII's fabrication shop, in the house shop contract: listOffers(state) returns rows with
// cost, ownership and affordability ALREADY RESOLVED, and purchase(state, id) returns new state or
// null for refused. engine/lotShop.js <-> components/lot/LotShop.js is the reference pair and this
// is the same shape, so the panel renders rows verbatim and recomputes nothing.
//
// The currency is Salvage for every row, and it is read from the definition rather than assumed,
// so a later row priced in something else is a data edit and not a change here.
const MODULE_CURRENCY = 'salvage';

// Phase rank, not phase equality. `aftermath` rows must stay buyable in `lunar` — a ladder whose
// bottom rung disappears is a ladder a returning player cannot climb — so availability is
// "the run has reached at least this phase", the same rank comparison getUnlockedFeatures() makes
// against `unlockedBy` in engine/progression.js. Ordered lists exist for exactly this.
//
// An unrecognized phase FAILS OPEN (rank -1 for the required phase reads as "no requirement"),
// matching getUnlockedFeatures'. `expedition.phase` is self-healing — recomputed from a pure
// predicate ladder every advance() — so an unrecognized value is a corrupt save one tick from
// repair, and failing closed there would hide the only Salvage sink in the act for that tick.
function phaseRank(phaseId) {
  return EXPEDITION_PHASES.indexOf(phaseId);
}

function isAvailable(definition, currentPhase) {
  const required = phaseRank(definition.phase);
  if (required === -1) return true;
  // FAILS OPEN AT BOTH EDGES, exactly as getUnlockedFeatures() does: a row with no phase, and a
  // run whose phase is unrecognized, both reveal everything. Failing closed on an unrecognized
  // phase would empty the shop — the act's only Salvage sink — for a save that is one advance()
  // away from repairing itself, which is the one failure a presentation-only gate must never
  // cause. Showing a row early is recoverable; stranding a save is not.
  const current = phaseRank(currentPhase);
  if (current === -1) return true;
  return current >= required;
}

function ownedCount(slice, moduleId) {
  const entry = slice.modules.find((module) => module.id === moduleId);
  if (!entry || typeof entry.count !== 'number' || !Number.isFinite(entry.count)) return 0;
  return entry.count > 0 ? entry.count : 0;
}

// Presentation-ready rows. `count` rather than `owned: bool` — every module in this act is
// repeatable, unlike the lot shop's one-of-each items, so ownership here is a quantity. `owned` is
// still emitted (as count > 0) because the shop contract names it and a panel written against the
// reference pair will look for it.
//
// UNAVAILABLE ROWS ARE OMITTED, NOT DISABLED. Locked features are not rendered at all anywhere in
// this game — "the reveal is the reward" (AppShell.js) — and a greyed-out Fusion Ring in the
// aftermath would be a spoiler for three phases' worth of content.
function listOffers(state) {
  const slice = expeditionSlice(state);
  const balance = balanceOf(state.wallet, MODULE_CURRENCY);

  return ACT_SEVEN_MODULES.filter((definition) => isAvailable(definition, slice.phase)).map((definition) => {
    const count = ownedCount(slice, definition.id);
    const cost = moduleCost(definition, count);
    return {
      id: definition.id,
      name: definition.label,
      description: definition.description,
      effect: describeEffect(definition),
      cost,
      currency: MODULE_CURRENCY,
      count,
      owned: count > 0,
      affordable: balance >= cost,
    };
  });
}

// The row's one-line "what does it do", built from the same rates the solve reads so the shop can
// never advertise a number the engine does not honour. Prose assembly rather than prose: the
// module's own words live in its `description` in data/, and this is a rendering of its rates.
function describeEffect(definition) {
  const parts = [];
  if (Number.isFinite(definition.producesSalvage) && definition.producesSalvage > 0) {
    parts.push('+' + definition.producesSalvage + ' Salvage/s');
  }
  Object.keys(definition.produces || {}).forEach((resourceId) => {
    parts.push('+' + definition.produces[resourceId] + ' ' + resourceId + '/s');
  });
  Object.keys(definition.consumes || {}).forEach((resourceId) => {
    parts.push('-' + definition.consumes[resourceId] + ' ' + resourceId + '/s');
  });
  return parts.join(', ');
}

// Returns new state, or null when the purchase is not permitted — an unknown id, a module the run
// has not reached the phase for, or an unaffordable one. Refusal is null from the engine and an
// unchanged state from the reducer: an action the player could not have taken through the UI is a
// no-op, not an error.
//
// The debit goes through engine/wallet.js like every other wallet write in the game, so no
// currency can go below zero structurally rather than by a check here.
function purchase(state, moduleId) {
  const definition = getModuleDefinition(moduleId);
  if (!definition) return null;

  const slice = expeditionSlice(state);
  if (!isAvailable(definition, slice.phase)) return null;

  const count = ownedCount(slice, moduleId);
  const cost = moduleCost(definition, count);
  if (!canAfford(state.wallet, MODULE_CURRENCY, cost)) return null;

  // Spread the accessor's return value when writing the slice back — engine/concessions.js records
  // why in full: a key one copy of the shape forgets is a key every later write silently deletes.
  const existing = slice.modules.find((module) => module.id === moduleId);
  const modules = existing
    ? slice.modules.map((module) => (module.id === moduleId ? { ...module, count: module.count + 1 } : module))
    : [...slice.modules, { id: moduleId, count: 1 }];

  return {
    ...state,
    wallet: debitWallet(state.wallet, MODULE_CURRENCY, cost),
    expedition: { ...slice, modules },
  };
}

module.exports = { listOffers, purchase, MODULE_CURRENCY };
