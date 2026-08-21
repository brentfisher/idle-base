// Act VII's site ladder — colonization, launch pads, and the single writer of `expedition.phase`.
// Pure: no React, no DOM, no Date.now(), no bare Math.random().
//
// PRD §7.1, §7.2, §7.7 and ledger R4. This file owns every RULE about a site: what may be
// colonized, what a pad costs, when a build completes, how far a pad reaches, and which phase the
// run is in. It does not own the record shape — engine/colony.js's resolvedSites() does, and the
// long note there explains why (three modules need a resolved site and only one of them is this
// one, so shape-here would be a require cycle).
//
// The act's spine, stated once: to launch further you must colonize, and a colony is what lets you
// build the places you launch from. Five rungs, strictly ordered. You cannot skip second base, and
// the fiction and the gating are the same sentence.
const {
  INITIAL_PHASE,
  EXPEDITION_PHASES,
  LIFE_SUPPORT_PHASE,
  MAJORS_PHASE,
  OVER_THE_WALL_MILESTONE,
  EXPEDITION_RESOURCES,
} = require('../data/actSevenConfig');
const {
  LAUNCH_PAD_TIERS,
  COLONIZE_BUILD_ID,
  OVER_THE_WALL_DESTINATION_ID,
  getSiteDefinition,
  getPadTier,
  padTierForRung,
  padUpkeepAt,
} = require('../data/actSevenSitesConfig');
const { expeditionSlice, resolvedSites, isLifeSupportPhase } = require('./colony');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// Salvage for every row, like the fabrication shop. Colonizing and building pads draw on the same
// pool as §5's modules, which is ledger R2's open risk and the reason the cost ladder in
// data/actSevenSitesConfig.js was re-derived against a measurement of BOTH ladders rather than
// against §5's income band in isolation.
const SITE_CURRENCY = 'salvage';

// An offer id is `<buildingId>@<siteId>` — 'colonize@onDeck', 'padTier3@firstBase'.
//
// THE PREFIX IS THE `buildingId` THAT GETS STORED, deliberately, rather than a separate offer
// vocabulary that has to be mapped onto one. §7.7 specifies `buildingId` as 'colonize' or
// 'padTier3', so making the offer id carry it means purchase() writes the value it parsed instead
// of translating, and a build in progress can be traced back to the row that started it by reading
// the save. One vocabulary, no mapping table, nothing to keep in sync.
const OFFER_SEPARATOR = '@';

function offerIdFor(buildingId, siteId) {
  return buildingId + OFFER_SEPARATOR + siteId;
}

// Returns null rather than a partial parse for anything malformed. purchase() is reachable from a
// dispatch, so this is real input validation and not a formality — a `split()` that returns one
// element would otherwise hand an undefined site id to a lookup that answers "no such site" for the
// right reason by accident.
function parseOfferId(offerId) {
  if (typeof offerId !== 'string') return null;
  const parts = offerId.split(OFFER_SEPARATOR);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { buildingId: parts[0], siteId: parts[1] };
}

// ---------------------------------------------------------------------------------------------
// REACH
// ---------------------------------------------------------------------------------------------

// How far a site can throw: the reach of the pad tier actually BUILT on it, or 0 for a site with no
// pad. engine/launch.js (STORY-028) compares this against a destination's rung.
//
// THE INVARIANT THIS FUNCTION EXISTS TO HOLD (§7.2, and it is the sharpest rule in the section):
// REACH IS A FUNCTION OF BUILT PAD TIER ALONE, NEVER OF CURRENT SATISFACTION. A starved network
// launches LATER, never SHORTER.
//
// This is not a simplification, it is Decision 3.3 applied to a capability. A pad whose reach
// degrades when the colony is short of Power is destruction with extra steps — and worse, it is
// destruction that happens while the player is asleep, because starvation arrives during an
// offline catch-up as readily as during play. A player who returns to find that the burn they
// spent forty minutes filling for is no longer legal has been punished for closing the tab, which
// is the one thing an idle game may never do. Starvation costs RATE. It never costs a CAPABILITY.
//
// The practical payoff is that this is a pure function of one stored integer, which forecloses an
// entire class of "why can't I launch, I could yesterday" bug by construction rather than by
// testing for it.
function siteReach(site) {
  const pad = site && getPadTier(site.launchPadTier);
  return pad ? pad.reachesRung : 0;
}

// ---------------------------------------------------------------------------------------------
// THE SHOP
// ---------------------------------------------------------------------------------------------

// Every site, resolved, in ladder order — for §6's Sites panel. Not the same thing as listOffers():
// this is "where am I", including sites with a build already running and sites finished with, while
// listOffers() is "what can I buy right now". A panel needs both and computing either from the
// other loses information the player is looking at.
//
// WHAT STORY-037 ADDED, AND WHY IT WENT HERE RATHER THAN INTO THE PANEL. The Sites panel's whole
// point (§7.2) is that expanding is a DECISION, and the thing that makes it one is the permanent
// draw — so the panel has to print, per colonized site, the colony's base upkeep, the PAD's upkeep
// after that site's `upkeepFactor`, and Home Plate's free production. Only the first of those was
// on this row. The other two are one multiplication and one lookup away, and a component doing
// either would be a second implementation of what the colony actually bills.
//
// That is not a style objection. engine/colony.js's siteUpkeepPerSecond() bills the pad through
// padUpkeepAt() and nothing else, so calling the same function here means the screen and the solve
// cannot disagree about what a pad costs. A `pad.upkeep[id] * site.upkeepFactor` written in JSX
// would agree today and drift the first time §7.2's factor grew a rule — and the drift would be a
// panel quoting a price the network is not charging, which is the one thing this screen exists to
// get right.
//
// `buildSecondsRemaining` is here for a narrower reason: the clock. Every other clock reader in
// this file guards with `Number.isFinite(state.clock) ? state.clock : 0` because a save is a file
// on somebody's disk, and `readyAtClock - state.clock` written in a component skips that guard and
// renders NaN for the rest of the run.
function listSites(state) {
  const clock = Number.isFinite(state && state.clock) ? state.clock : 0;

  return resolvedSites(state).map((site) => ({
    id: site.id,
    name: site.label,
    where: site.where,
    description: site.description,
    rung: site.rung,
    reached: site.reached,
    colonized: site.colonized,
    launchPadTier: site.launchPadTier,
    padName: site.launchPadTier > 0 ? (getPadTier(site.launchPadTier) || {}).label : null,
    reachesRung: siteReach(site),
    buildingId: site.buildingId,
    readyAtClock: site.readyAtClock,
    // The pending build, named and counted down. Null on an idle site rather than 0, so the panel
    // tests one field and never has to tell "finishing this instant" from "nothing running".
    buildLabel: pendingBuildLabel(site),
    buildSecondsRemaining: site.buildingId ? Math.max(0, site.readyAtClock - clock) : null,
    upkeepFactor: site.upkeepFactor,
    fuelCapacityOnArrival: site.fuelCapacityOnArrival,
    // THE THREE RATE LISTS, KEPT APART BECAUSE THEY ARE THREE DIFFERENT FACTS. `upkeep` is what the
    // colony on this rock eats and it is NOT scaled by `upkeepFactor` (colony.js says why: a colony
    // feeds itself, a pad has to be fed from the network). `padUpkeep` IS scaled, and is the whole
    // mechanical content of the factor. `produces` is Home Plate's 2.0 O2/s and is the only entry
    // in the act — a panel that summed the three would delete the distinction §7.2 is built on.
    upkeep: describeRateList(site.baseUpkeep),
    padUpkeep: describeRateList(padUpkeepAt(site, site.launchPadTier)),
    produces: describeRateList(site.produces),
  }));
}

// A `{ resourceId: perSecond }` bundle as an ordered, LABELLED list.
//
// ORDERED BY EXPEDITION_RESOURCES rather than by key iteration, so the same three rates always
// print in the same order on every row — Power, Oxygen, Provisions, Fuel — and a config edit that
// reorders one site's `baseUpkeep` object cannot reshuffle a column the player reads down.
//
// THE FILTER IS THE BILLER'S FILTER, deliberately: colony.js's addRates() drops anything
// non-finite or non-positive before it charges it, so dropping the same rows here is what keeps
// the screen showing exactly what the network pays. A corrupt rate that the solve ignores must not
// appear on a row as a cost the player thinks they are carrying.
//
// The label comes from config rather than from the resource id, because the ids are the engine's
// vocabulary ('provisions') and the labels are the game's ('Provisions'). engine/colonyReadout.js
// resolves the same field the same way for the header chips and the Ops rows.
function describeRateList(rates) {
  return EXPEDITION_RESOURCES.reduce((rows, resource) => {
    const perSecond = rates && rates[resource.id];
    if (!Number.isFinite(perSecond) || perSecond <= 0) return rows;
    rows.push({ resourceId: resource.id, label: resource.label, perSecond });
    return rows;
  }, []);
}

// The word for a colonize build, in ONE place. candidateBuildFor() names the shop OFFER with it and
// pendingBuildLabel() names the RUNNING BUILD with it, and those are the same sentence at two
// moments — the row the player pressed, and the row that is now under way on the ladder. Two
// literals would let a future edit rename one and leave the Sites panel calling a build something
// the shop never offered.
function colonizeLabel(site) {
  return 'Colonize ' + site.label;
}

// What the site is building, in words, or null when it is idle.
//
// Returns null for an UNRECOGNIZED `buildingId` rather than echoing the id, and that pairs with
// applyCompletedBuild(), which grants nothing for one. A retired or hand-edited build id is a real
// case in a codebase that never migrates a save; the honest reading is that the site is busy with
// something this build does not have a name for, and the panel's copy owns that sentence. Putting
// the raw id on screen would be the one failure worse than saying nothing.
function pendingBuildLabel(site) {
  if (typeof site.buildingId !== 'string') return null;
  if (site.buildingId === COLONIZE_BUILD_ID) return colonizeLabel(site);
  const pad = LAUNCH_PAD_BY_ID[site.buildingId];
  return pad ? pad.label : null;
}

// The one thing a site could be doing next, or null. At most one row per site, which is the whole
// content of "one build per site at a time" (§7.7) expressed where the player meets it.
//
// A site's crew can only do one thing. That is a design constraint as much as a simplification:
// owning four sites means four builds can run in parallel, so the network's build throughput is
// itself a reason to colonize — and colonization windows and pad windows collapse into a single
// `readyAtClock` per site, which is one findNextEventClock contributor instead of two.
function candidateBuildFor(site) {
  // Busy. Not "unavailable" — the player is already doing the thing.
  if (site.buildingId) return null;

  if (site.reached && !site.colonized) {
    return {
      buildingId: COLONIZE_BUILD_ID,
      name: colonizeLabel(site),
      description: site.description,
      effect: describeColonizeEffect(site),
      cost: site.colonizeCost,
      seconds: site.colonizeSeconds,
    };
  }

  if (!site.colonized) return null;

  // Exactly one pad tier is legal at a given rung — see the [minRung, maxRung] note in
  // data/actSevenSitesConfig.js for why the loose reading of §7.2 is a trap rather than a freedom.
  const pad = padTierForRung(site.rung);
  if (!pad || pad.existsAtStart) return null;
  if (site.launchPadTier >= pad.tier) return null;

  return {
    buildingId: pad.id,
    name: pad.label,
    description: pad.description,
    effect: describePadEffect(site, pad),
    cost: pad.salvageCost,
    seconds: pad.buildSeconds,
  };
}

// Presentation-ready rows in the house shop contract, exactly as engine/actSevenModules.js emits
// them: cost, ownership and affordability ALREADY RESOLVED, so the panel renders them verbatim and
// recomputes nothing. `owned` is false on every row because neither colonization nor a pad is a
// repeatable purchase — the field is emitted anyway because the contract names it and a panel
// written against the reference pair will look for it.
//
// UNAVAILABLE ROWS ARE OMITTED, NOT DISABLED, which is how every shop in this game behaves: locked
// features are not rendered at all ("the reveal is the reward", AppShell.js). A greyed-out row for
// the Warning Track in `lifeSupport` would spoil three phases of the ladder in one screen.
function listOffers(state) {
  const balance = balanceOf(state.wallet, SITE_CURRENCY);

  return resolvedSites(state).reduce((rows, site) => {
    const candidate = candidateBuildFor(site);
    if (!candidate) return rows;
    rows.push({
      id: offerIdFor(candidate.buildingId, site.id),
      name: candidate.name,
      description: candidate.description,
      effect: candidate.effect,
      cost: candidate.cost,
      currency: SITE_CURRENCY,
      owned: false,
      affordable: balance >= candidate.cost,
      siteId: site.id,
      buildSeconds: candidate.seconds,
    });
    return rows;
  }, []);
}

// The row's "what does this actually do", assembled from the same config the solve reads, so the
// shop can never advertise a number the engine does not honour.
//
// IT LEADS WITH THE UPKEEP, and that ordering is the point rather than a formatting choice. §7.2's
// design is that expanding must be a DECISION and not a purchase, and the thing that makes it one
// is the permanent draw on the shared pool. A row that led with what a site unlocks and buried what
// it costs per second would be selling the player something; the Warning Track in particular is
// deliberately cheap to establish and ruinous to sustain, and a player who cannot see that before
// buying has not been given the decision the section is built around.
function describeColonizeEffect(site) {
  const parts = describeRates(site.baseUpkeep);
  if (site.produces) parts.unshift(...describeRates(site.produces, '+'));
  return parts.length > 0 ? parts.join(', ') : 'No upkeep, and nothing produced.';
}

function describePadEffect(site, pad) {
  const parts = [];
  const upkeep = Object.keys(pad.upkeep || {}).reduce((acc, resourceId) => {
    acc[resourceId] = pad.upkeep[resourceId] * site.upkeepFactor;
    return acc;
  }, {});
  parts.push(...describeRates(upkeep));
  // The whole reason to build it. Stated as a rung rather than a site name because the top pad
  // reaches past the end of the ladder — §7.1 is explicit that beyond the wall is not a site — and
  // a string that named a destination would have nothing to name there.
  parts.push('reaches rung ' + pad.reachesRung);
  return parts.join(', ');
}

function describeRates(rates, sign) {
  return Object.keys(rates || {}).map((resourceId) => (sign || '-') + rates[resourceId] + ' ' + resourceId + '/s');
}

// Returns new state, or null when the purchase is not permitted. Refusal is null from the engine
// and an unchanged state from the reducer: an action the player could not have taken through the UI
// is a no-op, not an error.
//
// EVERY GATE IS RE-CHECKED HERE RATHER THAN TRUSTED FROM THE LISTING, because purchase() is
// reachable from a dispatch and an engine that only enforces a rule in the function that DRAWS the
// button is not enforcing it at all. The re-check is free: candidateBuildFor() is the same function
// listOffers() used, so there is one definition of what is legal and no second copy to drift.
function purchase(state, offerId) {
  const parsed = parseOfferId(offerId);
  if (!parsed) return null;

  const slice = expeditionSlice(state);
  const site = resolvedSites(state, slice).find((entry) => entry.id === parsed.siteId);
  if (!site) return null;

  const candidate = candidateBuildFor(site);
  if (!candidate || candidate.buildingId !== parsed.buildingId) return null;
  if (!canAfford(state.wallet, SITE_CURRENCY, candidate.cost)) return null;

  const clock = Number.isFinite(state.clock) ? state.clock : 0;
  const sites = writeSiteRecord(slice, site.id, {
    buildingId: candidate.buildingId,
    // A window of zero would store a build that completes on the very next advance() rather than
    // instantly, which is the correct behaviour and not a rounding of it: resolveBuilds() is the
    // only thing that may complete a build, so there is exactly one completion path whatever the
    // window is. No row in the shipped ladder has a zero window.
    readyAtClock: clock + Math.max(0, candidate.seconds),
  });

  // The debit goes through engine/wallet.js like every other wallet write in the game, so no
  // currency can go below zero structurally rather than by a check here.
  return {
    ...state,
    wallet: debitWallet(state.wallet, SITE_CURRENCY, candidate.cost),
    // Spread the accessor's return value when writing the slice back — engine/concessions.js
    // records why in full: a key one copy of the shape forgets is a key every later write silently
    // deletes.
    expedition: { ...slice, sites },
  };
}

// Merges a patch into one site's STORED record, creating it if the save has none.
//
// The created record carries the six fields §7.7 specifies and nothing else. Everything that can be
// looked up from config — rung, upkeep, production, capability flags, the Fuel grant — is
// deliberately absent, because this codebase never migrates a save and anything denormalized into
// one is frozen at the value it had the day it was written. See the resolution note in
// engine/colony.js.
//
// `reached` and `colonized` are seeded from the RESOLVED values rather than from `false`, so
// writing a record for a site that was reached-at-start cannot silently un-reach it.
function writeSiteRecord(slice, siteId, patch) {
  const existing = slice.sites.find((site) => site && site.id === siteId);
  if (existing) {
    return slice.sites.map((site) => (site && site.id === siteId ? { ...site, ...patch } : site));
  }

  const definition = getSiteDefinition(siteId);
  return [
    ...slice.sites,
    {
      id: siteId,
      reached: definition ? definition.reachedAtStart === true : false,
      colonized: definition ? definition.colonizedAtStart === true : false,
      launchPadTier: definition && Number.isFinite(definition.startingPadTier) ? definition.startingPadTier : 0,
      buildingId: null,
      readyAtClock: null,
      ...patch,
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// BUILDS
// ---------------------------------------------------------------------------------------------

// Completes every build whose window has closed, and clears the slot.
//
// IDEMPOTENT BY CONSTRUCTION, WHICH IS THE ONLY WAY THIS IS SAFE (§7.7). A completed build clears
// `buildingId` and `readyAtClock`, so a replayed step finds nothing to do and returns the state it
// was handed by identity. That matters far more than it looks: advance() runs identically live and
// on load, with only `deltaSeconds` differing, and one offline iteration can span eight hours. A
// completion path that fired per-elapsed-window instead of per-pending-record would colonize a site
// twice on a long return, or grant two pad tiers, or debit nothing and grant everything.
//
// Ordering within a single call does not matter and cannot: one build per site, and no build's
// completion is an input to another's. Two sites finishing inside the same step both complete in
// this one pass rather than one per iteration, which is what keeps the offline iteration count at
// O(sites) rather than O(builds).
//
// RETURNS THE STATE OBJECT IT WAS HANDED, BY IDENTITY, WHEN NOTHING COMPLETED — the same discipline
// integrateColony() follows, and for the same two reasons: it makes "an 8h advance() with no builds
// pending is byte-for-byte unchanged" provable by reference equality, and it keeps the tick loop
// from materialising an `expedition` slice into the six acts that have no use for one.
function resolveBuilds(state) {
  const slice = expeditionSlice(state);
  const clock = Number.isFinite(state.clock) ? state.clock : 0;

  let completed = false;
  const sites = slice.sites.map((site) => {
    if (!site || typeof site.buildingId !== 'string') return site;
    if (!Number.isFinite(site.readyAtClock) || site.readyAtClock > clock) return site;

    completed = true;
    return { ...applyCompletedBuild(site), buildingId: null, readyAtClock: null };
  });

  if (!completed) return state;
  return { ...state, expedition: { ...slice, sites } };
}

// What a finished build actually grants. Colonization flips one flag; a pad build raises the tier.
//
// The tier is taken from the pad definition the stored `buildingId` names, NOT from
// `launchPadTier + 1`. An increment would be a second statement of what was bought, and the two
// could disagree — a save whose tier was hand-edited, or a future story that grants a tier by some
// other route, would silently produce an off-by-one reach. The build record says what was built;
// this reads it.
//
// An unrecognized `buildingId` grants nothing and is simply cleared by the caller. That is the
// right failure: a corrupt or retired build id costs the player the Salvage they already spent,
// which is bad, against leaving the site permanently occupied, which is a soft-lock on that rung
// and every rung above it.
function applyCompletedBuild(site) {
  if (site.buildingId === COLONIZE_BUILD_ID) return { ...site, colonized: true };

  const pad = LAUNCH_PAD_BY_ID[site.buildingId];
  if (!pad) return site;
  const current = Number.isFinite(site.launchPadTier) ? site.launchPadTier : 0;
  return { ...site, launchPadTier: Math.max(current, pad.tier) };
}

// A by-id lookup built at module load, which is normally the thing this codebase refuses to do —
// data/actSevenConfig.js records that FINAL_ACT_INDEX's load-time capture has twice made a test
// pass for the wrong reason, and engine/colony.js scans its catalogue on every call for exactly
// that reason. The difference here is what the map is keyed on: the module catalogue is content a
// harness legitimately injects into, while the five pad tiers are the act's structure — there is no
// sixth pad and nothing appends one at runtime. If that ever stops being true, this becomes a scan.
const LAUNCH_PAD_BY_ID = LAUNCH_PAD_TIERS.reduce((acc, pad) => {
  acc[pad.id] = pad;
  return acc;
}, {});

// The earliest clock at which a build completes; Infinity when none is pending.
//
// CONTRACT (engine/tickEngine.js's contributor list): pure, guards its own slice, and returns
// Infinity — never 0, null or undefined — when nothing is pending. Returning 0 pins advance()'s
// step at zero and burns all 2,000 safetyCapIterations without moving the clock, silently
// discarding the rest of a returning player's eight hours.
//
// OVERDUE BUILDS ARE EXCLUDED, and that filter is the whole reason this is not a one-liner. A
// record whose `readyAtClock` is already in the past is not a future event — proposing it makes
// `step` zero for that iteration, and while resolveBuilds() at the foot of the same iteration does
// clear it, the loop has burned an iteration on a step of nothing. It costs one line to not do
// that, and the case is reachable for real: a build committed at the same instant a step boundary
// lands, or a hand-edited save.
//
// At most one boundary per site, so the whole ladder contributes at most five to an eight-hour
// catch-up against a safety cap of 2,000. §7.3's estimate of O(6) for this section holds.
function nextBuildClock(state) {
  const slice = expeditionSlice(state);
  if (slice.sites.length === 0) return Infinity;
  const clock = Number.isFinite(state.clock) ? state.clock : 0;

  return slice.sites.reduce((soonest, site) => {
    if (!site || typeof site.buildingId !== 'string') return soonest;
    if (!Number.isFinite(site.readyAtClock) || site.readyAtClock <= clock) return soonest;
    return Math.min(soonest, site.readyAtClock);
  }, Infinity);
}

// Marks a site reached. THE SINGLE WRITER OF `reached`, called by engine/launch.js (STORY-028) when
// a transit resolves — exported rather than letting that file write the record itself, so site
// records have one author and the shape note in engine/colony.js has one place to stay true.
//
// Idempotent, and returns state by identity when the site is already reached: arrival resolution is
// replayed on every offline catch-up, and a second call must be a no-op rather than a second write
// of the same fact.
function markSiteReached(state, siteId) {
  const slice = expeditionSlice(state);
  const site = resolvedSites(state, slice).find((entry) => entry.id === siteId);
  if (!site || site.reached) return state;
  return { ...state, expedition: { ...slice, sites: writeSiteRecord(slice, siteId, { reached: true }) } };
}

// ---------------------------------------------------------------------------------------------
// THE PHASE WRITER (PRD §7.7, ledger R4)
//
// `expedition.phase` is stored because §4 binds it, but it is RECOMPUTED FROM A PURE PREDICATE
// LADDER ON EVERY advance() AND WRITTEN ONLY WHEN IT DIFFERS. That is the house compromise between
// a stored field and "derived, never stored", and it buys something specific: an old save, a
// hand-edited save, or a save that crossed a boundary during an eight-hour catch-up all self-heal
// to the correct phase on the next tick.
//
// THIS FILE IS THE SINGLE WRITER. §5 supplies the two early predicates as pure functions and does
// not write the field; §6 reads it for the tab reveal and does not write it. Ledger R4 refused §6's
// request for parallel `phaseLifeSupport` / `phaseLunar` / `phaseDeepSpace` milestones for exactly
// this reason — two sources of truth for "how far into the act are we" is a race that shows up only
// on somebody's real save, and one of the two is always the one a given gate happens to read.
//
// EVERY GATE IN THE ACT IS A RANK COMPARISON, NEVER AN EQUALITY TEST. "At least `lunar`", not "is
// `lunar`". A rung that vanishes from under a returning player the moment they progress past it is
// a ladder nobody can climb, and the fabrication shop's `aftermath` rows are the case that makes it
// concrete: they must stay buyable forever.
// ---------------------------------------------------------------------------------------------

// A site whose `reachedPhase` is this phase has been reached. `lunar` is the only such rung today —
// it begins on L1's ARRIVAL at On-Deck, which is what the phase name means.
function siteArrivalGrants(phaseId, sites) {
  return sites.some((site) => site.reachedPhase === phaseId && site.reached);
}

// A launch to a site whose `commitPhase` is this phase has been COMMITTED — not arrived. `deepSpace`
// is the only such rung, and the asymmetry with `lunar` is deliberate (§7.6): the teardown beat is
// the burn itself, so the eight-minute dead transit belongs to the budget of the phase it opens
// rather than to the one it closes. `lunar` would otherwise pay for eight minutes in which nothing
// about `lunar` is happening.
//
// Reads the launch LOG, which is the same list in-flight launches live in (§7.3) — a record with
// `resolved: false` is a burn under way, and one with `resolved: true` is the same burn afterwards.
// Because the phase turns on the record EXISTING rather than on its state, this predicate is
// monotone: the phase cannot fall back when the launch resolves. A predicate that had to be told
// the difference would be a second place that knows what "in flight" means.
//
// Runs correctly against an empty list today: engine/launch.js is STORY-028, so nothing writes
// `launches` yet and this reads false. The rung is wired now rather than later because the ladder
// must be complete for the rank comparison above it to be meaningful.
function launchCommitGrants(phaseId, slice, sites) {
  const granting = sites.filter((site) => site.commitPhase === phaseId).map((site) => site.id);
  if (granting.length === 0) return false;
  return slice.launches.some((launch) => launch && granting.indexOf(launch.destinationSiteId) !== -1);
}

// PRD §7.8's ending, and the ONE predicate in this ladder with two clauses.
//
// THE ACT IS WON AT COMMIT AND THE PHASE TURNS OVER AT ARRIVAL, and those are deliberately not the
// same instant. §7.8 states both in consecutive sentences: "`launch.purchase` on the over-the-wall
// offer sets `progression.milestones.overTheWall`. That is the win condition" — and then "Twelve
// minutes later the transit resolves and `phase` becomes `majors`." Winning is the player's
// decision and belongs to the second they take it; being in the majors is a place the run arrives
// at. A predicate reading the milestone alone would collapse the two and delete the last transit in
// the game, which is the one the whole act has been building a pad for.
//
// SO THE SECOND CLAUSE IS "AND NOTHING IS STILL IN THE AIR", expressed as the ABSENCE of an
// unresolved wall record rather than the presence of a resolved one. That direction is the whole
// design of the clause and it is chosen to FAIL OPEN, matching every other defaulted read in the
// act:
//
//   commit          milestone set, record present and unresolved   ->  false, phase holds
//   arrival         the same record, now resolved                  ->  true,  phase promotes
//   hand-edited     milestone set, no record at all                ->  true,  promotes at once
//
// The third row is why. `resolved === true` would read a save carrying the milestone and no launch
// log as still in flight FOREVER — a run that has won and can never be told so, with no play that
// repairs it. Absence-of-in-flight strands nothing: the worst it can do is promote a corrupt save
// one transit early, and this ladder self-heals in the other direction anyway.
//
// THIS IS STILL ONE PHASE PATH. Ledger R4 forbids parallel milestone flags MIRRORING the phase —
// `phaseLunar`, `phaseDeepSpace` — because two sources of truth for how far the run has got is a
// race that surfaces on somebody's real save. A milestone the single writer READS is the opposite
// arrangement, and it is the same one `launchCommitGrants()` above makes against the launch log.
// `expedition.phase` still has exactly one author and is still recomputed from scratch every tick.
//
// Both lookups are defaulted because `progression.milestones` is a bag of ids rather than a fixed
// shape: an absent key is the normal case for every milestone a run has not hit.
function overTheWallGrants(state, slice) {
  const progression = state && state.progression;
  const milestones = (progression && progression.milestones) || {};
  if (milestones[OVER_THE_WALL_MILESTONE] !== true) return false;

  return !slice.launches.some((launch) => (
    !!launch
    && launch.destinationSiteId === OVER_THE_WALL_DESTINATION_ID
    && launch.resolved !== true
  ));
}

function isPhaseReached(phaseId, state, slice, sites) {
  if (phaseId === INITIAL_PHASE) return true;
  if (phaseId === LIFE_SUPPORT_PHASE) return isLifeSupportPhase(state);
  if (phaseId === MAJORS_PHASE) return overTheWallGrants(state, slice);
  return siteArrivalGrants(phaseId, sites) || launchCommitGrants(phaseId, slice, sites);
}

// The HIGHEST-RANKED phase whose predicate holds, scanning from the top down.
//
// Highest-satisfied rather than first-unsatisfied, and the difference is what makes the ladder
// self-healing rather than merely recomputed. The predicates are not guaranteed to be nested: a
// save could plausibly satisfy `lunar` and not `lifeSupport` if a player were handed a reached site
// with no modules, and a scan that stopped at the first failure would pin such a run at `aftermath`
// forever. Taking the highest satisfied rung means a save can only ever be under-reporting its
// progress for one tick, never permanently.
//
// Falls back to INITIAL_PHASE, which is also the `aftermath` predicate's answer — the default is
// not a condition, you are in the aftermath until you are not.
function expeditionPhaseFor(state, slice, sites) {
  for (let rank = EXPEDITION_PHASES.length - 1; rank >= 0; rank -= 1) {
    if (isPhaseReached(EXPEDITION_PHASES[rank], state, slice, sites)) return EXPEDITION_PHASES[rank];
  }
  return INITIAL_PHASE;
}

// Recompute, compare, write only on a difference. Called once per advance() iteration.
//
// THE EARLY RETURN IS NOT AN OPTIMISATION AND MUST NOT BE REMOVED. resolvedSites() returns [] for
// every act before Act VII, and abstaining there is what stops this function writing an
// `expedition` slice into six acts that have no use for one. Without it, an Act I save — which
// carries no expedition key at all, or one whose phase differs — would have a slice materialised
// into it on the very first tick of the very first act, on every save in existence. `npm run build`
// catches none of that, and it is the same failure integrateColony()'s identity-return comment
// exists to prevent.
function writeExpeditionPhase(state) {
  const slice = expeditionSlice(state);
  const sites = resolvedSites(state, slice);
  if (sites.length === 0) return state;

  const phase = expeditionPhaseFor(state, slice, sites);
  if (phase === slice.phase) return state;
  return { ...state, expedition: { ...slice, phase } };
}

module.exports = {
  listSites,
  listOffers,
  purchase,
  resolveBuilds,
  nextBuildClock,
  markSiteReached,
  siteReach,
  writeExpeditionPhase,
  expeditionPhaseFor,
  SITE_CURRENCY,
};
