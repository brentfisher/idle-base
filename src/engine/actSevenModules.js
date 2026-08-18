const { ACT_SEVEN_MODULES, moduleCost, getModuleDefinition } = require('../data/actSevenModulesConfig');
// Phase rank, not phase equality. `aftermath` rows must stay buyable in `lunar` — a ladder whose
// bottom rung disappears is a ladder a returning player cannot climb — so availability is "the run
// has reached at least this phase", the same rank comparison getUnlockedFeatures() makes against
// `unlockedBy` in engine/progression.js. Shared with engine/sites.js as of STORY-027 rather than
// reimplemented per consumer; the fail-open convention is documented at its definition.
const { phaseRank } = require('../data/actSevenConfig');
const { expeditionSlice, resolvedSites } = require('./colony');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// Act VII's fabrication shop, in the house shop contract: listOffers(state) returns rows with
// cost, ownership and affordability ALREADY RESOLVED, and purchase(state, id) returns new state or
// null for refused. engine/lotShop.js <-> components/lot/LotShop.js is the reference pair and this
// is the same shape, so the panel renders rows verbatim and recomputes nothing.
//
// listGoals(state) is a THIRD export and a later addition (STORY-036, the panel), not part of the
// house contract. It exists because the spend gate below removes rows from listOffers() entirely,
// and a panel that must show the player what the Fuel Bladder is still waiting on cannot get that
// from a list the row is missing from — and may not derive it, because counting owned modules is a
// fact about the save. The argument for a separate list rather than a flag is at its definition.
//
// The currency is Salvage for every row, and it is read from the definition rather than assumed,
// so a later row priced in something else is a data edit and not a change here.
const MODULE_CURRENCY = 'salvage';

// A prerequisite on OTHER modules, as `{ moduleId: count }`. This is a SPEND gate rather than a
// price gate, and the distinction is the whole point (PRD §5.5).
//
// The first Fuel Bladder is the pacing control for the entire launch system: Fuel's base capacity
// is 0, so until a tank exists Fuel cannot be banked at all. §7.5 requires it not be reachable
// before ~minute 35 of `lifeSupport`. Price alone cannot hold that — 3,600 Salvage is about ninety
// seconds of mid-phase income, so a player who simply waits arrives early no matter what the row
// costs. Requiring seven Fission Piles and seven Hydroponics Bays cannot be waited out: it is
// ~63,700 Salvage of cumulative spend on things that are individually worth buying.
function meetsRequirements(definition, slice) {
  const requires = definition.requires;
  if (!requires) return true;
  return Object.keys(requires).every((moduleId) => ownedCount(slice, moduleId) >= requires[moduleId]);
}

// A prerequisite on a colonized site declaring some capability — `vacuumSolar` for the Solar Wing,
// `iceAvailable` for the Ice Harvester. §5.4 replaced the draft's per-site output multiplier with
// this, because a multiplier was incoherent with the one-pool ruling: the colony sums a list and
// does not know how many sites exist.
//
// FAILS CLOSED, unlike the phase gate, and the asymmetry is deliberate. An unrecognized phase is a
// corrupt value one tick from self-repair, so revealing everything is the safe direction. A missing
// site is not corruption — it is the accurate statement that the player has not colonized anything
// yet. Failing open here would offer the cheapest Power in the act from minute one and delete the
// `lunar` phase's central beat.
//
// READS RESOLVED SITES RATHER THAN THE STORED LIST, which is the only change this story made to
// this file and is worth the sentence. The capability flags are CONFIG (`vacuumSolar` on On-Deck,
// `iceAvailable` on First Base — PRD §5.11 lists them as config additions), not save fields.
// Denormalizing them into the stored record would freeze them at the value they had the day the
// save was written, because this codebase never migrates a save, so retuning which site carries
// which capability would apply to new games only. resolvedSites() merges the definition over the
// record, so the site handed to this function carries the flag and the predicate below is unchanged.
//
// AND IT REQUIRES `colonized`, NOT MERELY `reached` (§5.4: "a colonized site that declares
// vacuumSolar"). Flying past a place does not let you build there. That gap is a real beat rather
// than a technicality: arriving at On-Deck opens `lunar`, and paying to colonize it is what puts
// the cheapest Power in the act on the board.
function meetsSiteCapability(definition, state) {
  const capability = definition.requiresSiteCapability;
  if (!capability) return true;
  return resolvedSites(state).some((site) => site.colonized && site[capability]);
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

// The two gates that decide whether a row EXISTS on the player's board at all, as opposed to
// whether it can be bought today. Extracted so listOffers() and listGoals() below cannot drift
// apart, and the drift that would matter is a live spoiler rather than a cosmetic one: both
// `requires` rows are `lifeSupport`, so a goal listing that filtered on the spend gate ALONE would
// tell an `aftermath` player about the Fuel Bladder — naming two modules that are themselves three
// phases from being revealed — which is precisely the reveal these gates exist to hold back.
//
// The spend gate is deliberately NOT in here. It is the one gate a row can fail while still being
// something the player should see, because it is a target they can work toward; the other two are
// facts about how far the run has got, and a row they withhold is not yet the player's business.
function isRevealed(definition, state, slice) {
  return isAvailable(definition, slice.phase) && meetsSiteCapability(definition, state);
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

  return ACT_SEVEN_MODULES.filter((definition) => (
    isRevealed(definition, state, slice)
    && meetsRequirements(definition, slice)
  )).map((definition) => {
    const count = ownedCount(slice, definition.id);
    const cost = moduleCost(definition, count);
    return {
      id: definition.id,
      name: definition.label,
      description: definition.description,
      effect: describeEffect(definition),
      // The one-off sentence a row needs the FIRST time only, and null forever after. `capacity`
      // rows are the reason it exists: a tank's effect string is honest about the number and silent
      // about the stakes, and for the Fuel Bladder the stakes are the whole launch system (Fuel's
      // base capacity is 0, so the first one buys Fuel EXISTING, not 400 units of headroom). The
      // sentence is authored in data/actSevenModulesConfig.js beside the number it explains, and
      // whether it applies is decided here, because "have they got one yet" is a fact about the
      // save and no component may answer it.
      note: count === 0 && definition.firstNote ? definition.firstNote : null,
      cost,
      currency: MODULE_CURRENCY,
      count,
      owned: count > 0,
      affordable: balance >= cost,
    };
  });
}

// The rows the SPEND gate is holding back, resolved into progress the player can read: for each
// prerequisite, the module's own label and how many of it they have against how many it wants.
//
// A SECOND EXPORT RATHER THAN A FLAG ON listOffers(), and the reason is what listOffers() means to
// everything that already reads it. It returns rows that can be ACTED ON — the measurement harness
// in data/actSevenModulesConfig.js drives a greedy buyer straight off it, and a row in that list
// carrying `affordable: true` that purchase() then refuses would corrupt every pacing figure in the
// act's tuning record. Keeping the two lists disjoint keeps that contract exactly as it was.
//
// THESE ROWS ARE NOT BUYABLE AND CARRY NO `affordable` FIELD, deliberately. There is nothing to
// press, so there is no refusal path, so there is no error surface — the row is a target, not an
// offer, and giving it a price button would be the one thing a shop row may never do: refuse on
// press. `cost` is still emitted, because knowing what it will cost is part of aiming at it.
//
// Why a spend gate deserves this at all, when an unavailable row is simply omitted: the phase and
// site gates are answered by PROGRESSING — the player cannot do anything about them today except
// keep playing, so naming them is a spoiler with no action attached. A `requires` gate names things
// that are already on the board and already worth buying, so stating it converts a locked row into
// a plan. §5.5's pacing control only reads as pacing rather than as an arbitrary wall if the player
// can see the seven-and-seven they are climbing toward.
function listGoals(state) {
  const slice = expeditionSlice(state);

  return ACT_SEVEN_MODULES.filter((definition) => (
    isRevealed(definition, state, slice)
    && definition.requires
    && !meetsRequirements(definition, slice)
  )).map((definition) => {
    const count = ownedCount(slice, definition.id);
    return {
      id: definition.id,
      name: definition.label,
      description: definition.description,
      effect: describeEffect(definition),
      note: count === 0 && definition.firstNote ? definition.firstNote : null,
      cost: moduleCost(definition, count),
      currency: MODULE_CURRENCY,
      count,
      // EVERY prerequisite, met ones included, each already marked. A list that dropped the
      // satisfied half would shrink as the player got closer, so the goal would look like it was
      // getting smaller and then vanish — the opposite of the progress it is there to show. The
      // required module's own label is resolved here rather than in the panel, because an id is not
      // a name and turning one into the other is a data lookup, not a rendering decision.
      requirements: Object.keys(definition.requires).map((moduleId) => {
        const required = getModuleDefinition(moduleId);
        const owned = ownedCount(slice, moduleId);
        const needed = definition.requires[moduleId];
        return {
          id: moduleId,
          // Falls back to the id for a prerequisite naming a module that no longer exists. That is
          // a config error rather than a save error, and the useful failure is a legible row with a
          // strange word in it, not a throw inside the act's only Salvage sink.
          name: required ? required.label : moduleId,
          owned,
          needed,
          met: owned >= needed,
        };
      }),
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
  // A storage grant is a flat capacity, not a rate, so it deliberately carries no "/s". A tank
  // that read "+250 power/s" would be the single most misleading string in the act.
  Object.keys(definition.capacity || {}).forEach((resourceId) => {
    parts.push('+' + definition.capacity[resourceId] + ' max ' + resourceId);
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
  // Re-checked here rather than trusted from the listing: purchase() is reachable from a dispatch,
  // and an engine that only enforces a gate in the function that DRAWS the button is not enforcing
  // it at all.
  if (!meetsRequirements(definition, slice)) return null;
  if (!meetsSiteCapability(definition, state)) return null;

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

module.exports = { listOffers, listGoals, purchase, MODULE_CURRENCY };
