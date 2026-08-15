const { STORY_BEATS } = require('../data/storyBeats');
const { EXPEDITION_PHASES } = require('../data/actSevenConfig');
const { expeditionSlice, colonyRates } = require('./colony');

// WHICH AUTHORED BEATS ARE DUE. Trigger evaluation is logic, so it lives here and not in
// data/storyBeats.js — that file names a trigger, this one owns what the name means.
//
// TRIGGERS ARE LEVEL PREDICATES, NEVER EDGES, and that is the single most important thing about
// this file. "Phase is at least `lunar`" — never "phase just became `lunar`". advance() runs live
// and on load with only deltaSeconds differing, and one iteration can span eight hours, so an
// edge-triggered beat either fires on a transition nobody was watching for or does not fire at
// all. A level predicate asked after the fact is simply true, and the storyBeatsSeen ledger is
// what stops it firing twice.
//
// This is engine/sponsorships.js's announcedOfferIds argument applied to prose, and it is the
// house idiom for "announce once": a persisted ledger diffed against the current set, never a
// stored flag written at the moment of the event.

// Rank, not equality — the ordered phase list exists for exactly this comparison. An unrecognized
// phase ranks -1 and therefore satisfies no phase predicate, which is the correct direction here:
// a corrupt phase is one advance() from self-repair and a beat fired against it could not be
// un-fired.
function phaseAtLeast(state, phaseId) {
  const current = EXPEDITION_PHASES.indexOf(expeditionSlice(state).phase);
  const required = EXPEDITION_PHASES.indexOf(phaseId);
  if (current === -1 || required === -1) return false;
  return current >= required;
}

// Minutes since the act was entered. `actEnteredAtClock` is written by enterAct() in
// engine/progression.js, so this is a real elapsed-time predicate rather than a wall clock — it
// counts play, not absence, and it survives an offline catch-up by simply being true afterwards.
function actMinutes(state, minutes) {
  const entered = state.progression && state.progression.actEnteredAtClock;
  if (!Number.isFinite(entered)) return false;
  return (state.clock - entered) >= minutes * 60;
}

function ownedModuleCount(state) {
  return expeditionSlice(state).modules.reduce((sum, entry) => {
    const count = entry && entry.count;
    return Number.isFinite(count) && count > 0 ? sum + count : sum;
  }, 0);
}

// Every predicate reads through a defaulting accessor and tolerates a slice that is empty or
// absent, because most of these fire against systems later stories own — launches, sites,
// contracts and puzzles are all `[]` or `{}` today. A beat whose subject does not exist yet is
// simply never due, which is why this file can ship ahead of them.
const TRIGGERS = {
  callUpAccepted: (state) => !!(state.progression && state.progression.milestones.callUpAccepted),

  phaseAtLeastLifeSupport: (state) => phaseAtLeast(state, 'lifeSupport'),
  phaseAtLeastLunar: (state) => phaseAtLeast(state, 'lunar'),
  phaseAtLeastDeepSpace: (state) => phaseAtLeast(state, 'deepSpace'),
  phaseAtLeastMajors: (state) => phaseAtLeast(state, 'majors'),

  // "First Salvage credited" as a LEVEL: the player holds some, or is making some. Written this
  // way rather than as "salvage went from 0 to positive" for the reason at the top of this file —
  // and it stays true after they spend it all, which is what makes it un-missable.
  anySalvageEarned: (state) => {
    const held = (state.wallet && state.wallet.salvage) || 0;
    if (held > 0) return true;
    return ownedModuleCount(state) > 0;
  },

  threeModulesOnline: (state) => ownedModuleCount(state) >= 3,
  sixModulesOnline: (state) => ownedModuleCount(state) >= 6,

  // Fuel's base capacity is 0 until a tank is built, so this is exactly "the player has bought
  // their first Fuel storage" without this file needing to know which module that is.
  fuelCapacityExists: (state) => {
    const capacity = colonyRates(state).capacity;
    return Number.isFinite(capacity.fuel) && capacity.fuel > 0;
  },

  anySiteColonized: (state) => expeditionSlice(state).sites.some((site) => site && site.colonized),
  anyLaunchDeparted: (state) => expeditionSlice(state).launches.length > 0,
  anyContractClaimed: (state) => expeditionSlice(state).contracts.some((c) => c && c.claimed),

  anyPuzzleSolvedUnaided: (state) => {
    const puzzles = expeditionSlice(state).puzzles;
    return Object.keys(puzzles).some((id) => puzzles[id] && puzzles[id].solved && !puzzles[id].hintsBought);
  },
  anyHintBought: (state) => {
    const puzzles = expeditionSlice(state).puzzles;
    return Object.keys(puzzles).some((id) => puzzles[id] && puzzles[id].hintsBought > 0);
  },

  actMinutes35: (state) => actMinutes(state, 35),
  actMinutes80: (state) => actMinutes(state, 80),
  actMinutes130: (state) => actMinutes(state, 130),
  actMinutes180: (state) => actMinutes(state, 180),
  actMinutes230: (state) => actMinutes(state, 230),
  actMinutes280: (state) => actMinutes(state, 280),
};

// The two beats with dedicated render paths. `act-7-offer` is drawn inside the championship modal
// and `act-7-teardown` inside the teardown overlay, so neither may also enter the card queue —
// they would appear twice, once in their own component and once as a StoryCard.
const SELF_RENDERED = ['act-7-offer', 'act-7-teardown'];

function isSeen(state, beatId) {
  const seen = (state.progression && state.progression.storyBeatsSeen) || [];
  return seen.indexOf(beatId) !== -1;
}

// A beat with no trigger is due whenever its act is current — that is how the existing actIntro
// beats have always worked, and adding a trigger to them would change six acts' behaviour to no
// purpose.
function isDue(state, beat) {
  const act = state.progression ? state.progression.act : 0;
  if (beat.actIndex !== act) return false;
  if (!beat.trigger) return true;
  const predicate = TRIGGERS[beat.trigger];
  // An unrecognized trigger id is never due. It is an authoring typo, and the failure it produces
  // — a beat that silently never fires — is strictly better than one that fires on every tick.
  return predicate ? !!predicate(state) : false;
}

// Unseen beats whose trigger is satisfied, IN AUTHORED ORDER. Order matters twice: the shell
// renders the first card and queues the rest, and the dispatches are an arc that reads wrong
// out of sequence.
function pendingStoryBeats(state) {
  if (!state || !state.progression) return [];
  return STORY_BEATS.filter((beat) => (
    SELF_RENDERED.indexOf(beat.id) === -1
    && !isSeen(state, beat.id)
    && isDue(state, beat)
  ));
}

function pendingCardBeats(state) {
  return pendingStoryBeats(state).filter((beat) => beat.mode !== 'feed');
}

// EVERY DUE FEED BEAT, NOT JUST THE NEWEST. The instinct elsewhere in this codebase is to collapse
// a burst — ToastHost turns fifteen catch-up games into one line, and is right to. Here it would
// be wrong: the dispatches are an arc about time passing, and delivering only the last one tells
// the player the league has moved on without ever showing it moving.
//
// Safe to emit them all, and not because of FEED_CAP: there are seven dispatches and nine other
// feed beats in an entire run, each firing at most once ever against the ledger, so the absolute
// ceiling across a whole playthrough is sixteen entries against a cap of 50.
function pendingFeedBeats(state) {
  return pendingStoryBeats(state).filter((beat) => beat.mode === 'feed');
}

module.exports = { pendingStoryBeats, pendingCardBeats, pendingFeedBeats, TRIGGERS };
