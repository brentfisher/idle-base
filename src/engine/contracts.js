// Act VII's contract board — the twelve fuel side quests (PRD §9, ledger R3 and R5).
// Pure: no React, no DOM, no Date.now(), and no bare Math.random() — see the note on the board seed.
//
// The house shop contract, the same shape engine/lotShop.js <-> components/lot/LotShop.js
// established and engine/launch.js follows:
//
//   contractsSlice(state)                 defaulting accessor: { contracts, contractBoard }
//   listOffers(state)                     presentation-ready rows; the panel recomputes nothing
//   accept(state, id, rng = Math.random)  new state, or null for refused
//   claim(state, id)                      new state, or null for refused
//   abandon(state, id)                    new state, or null; never penalised
//   refreshBoard(state)                   seeded from state; called from advance()
//   advanceContracts(state, step, rates)  one step of progress, window and expiry resolution
//   contractUpkeepPerSecond(state)        RE-EXPORTED from engine/colony.js — see below
//   nextContractEventClock(state)         on engine/tickEngine.js's contributor list
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS FILE IS FOR, BECAUSE IT DETERMINES WHAT IT IS ALLOWED TO DO.
//
// Act VII's graded phases each end on a threshold that has to be filled. The colony builds out over
// the first third of a phase and the player then watches a bar fill for the remaining two thirds.
// A contract is the thing on the other side of that stretch, and it is a PACING LEVER rather than
// an economy: it shortens a phase for the player who runs it and changes nothing for the player who
// does not. §7's thresholds are sized against the IDLE rate and never against the contracted one.
//
// Which is why almost everything here refuses rather than punishes. Nothing on this board can
// debit a resource the player did not choose to hand over, nothing can expire once accepted, and
// nothing pays out while the player is not looking. Those are not politenesses; each of them is
// load-bearing against a specific failure recorded below.
// ---------------------------------------------------------------------------------------------
const {
  ACT_SEVEN_CONTRACTS,
  ORGANIZATIONAL_DEPTH_TEMPLATES,
  CONTRACT_KINDS,
  BOARD_SLOTS,
  MAX_ACTIVE_CONTRACTS,
  OFFER_ROTATION_SECONDS,
  MAKEUP_WINDOW_MULTIPLIER,
  getContractDefinition,
  getOrganizationalDepthTemplate,
  contractCopy,
} = require('../data/actSevenContractsConfig');
const { phaseRank } = require('../data/actSevenConfig');
const {
  expeditionSlice,
  colonyRates,
  spendResource,
  creditResource,
  contractUpkeepPerSecond,
  isExpeditionLive,
} = require('./colony');
const { currentLaunchThreshold } = require('./launch');
const { solvedUnaided } = require('./puzzles');
const { balanceOf, canAfford, debitWallet, creditWallet } = require('./wallet');

// The wallet currency a Salvage rider is paid in and a PTBNL delivery is debited in. Named rather
// than typed inline in four places, the same reason engine/sites.js names SITE_CURRENCY.
const CONTRACT_WALLET_CURRENCY = 'salvage';
// The consumable a Fuel payout is credited into. NOT a wallet currency — it lives in
// state.expedition and is credited through engine/colony.js's creditResource(). Getting this
// backwards is the easiest mistake in this section, so both names are declared side by side.
const CONTRACT_FUEL_RESOURCE = 'fuel';

const STATUS_OFFERED = 'offered';
const STATUS_ACTIVE = 'active';
const STATUS_CLAIMABLE = 'claimable';

// ---------------------------------------------------------------------------------------------
// READING STATE
// ---------------------------------------------------------------------------------------------

// PRD §9.6's accessor. A thin projection of expeditionSlice() rather than a second defaulting
// implementation, because engine/colony.js is the slice's declared gatekeeper — "nothing outside
// this file may reach into state.expedition directly" — and a second copy of the defaults is
// exactly the drift the note at the top of data/actSevenConfig.js exists to forbid.
function contractsSlice(state) {
  const slice = expeditionSlice(state);
  return { contracts: slice.contracts, contractBoard: slice.contractBoard };
}

function clockOf(state) {
  return state && Number.isFinite(state.clock) ? state.clock : 0;
}

// engine/clicker.js's counter, read defensively. Innings Limit compares it at the window boundary
// against the value stored at accept, which means the click detector needs NO reducer hook and no
// new bookkeeping — the counter already exists (state/initialState.js). That matters more than it
// looks: a contract that needed the click action to notify it would be a second writer of this
// slice reachable from a dispatch, and this file's entire safety argument is that advance() is the
// only thing that advances a contract.
function totalClicksOf(state) {
  const clicker = state && state.clicker;
  const total = clicker && clicker.totalClicks;
  return Number.isFinite(total) ? total : 0;
}

// THE GATE EVERY ENTRY POINT TAKES, and it is not defensive tidiness — it is what keeps this story
// from touching six acts that have never heard of a contract.
//
// `contractBoard.nextOfferAtClock` defaults to 0, which is the correct meaning ("a refresh may
// happen now") and a legitimate stored value. It is also, unguarded, a boundary in the PAST for
// every save in every act: nextContractEventClock() would propose it, advance() would step to it,
// refreshBoard() would run, and an `expedition` slice would be materialised into an Act I save that
// has none. engine/colony.js fought this exact fight over Home Plate's 2.0 O2/s and won it with
// this function, gated on the `ops` feature id rather than on an act index so a retune of the act
// boundary takes effect on an existing save with no migration.
function isLive(state, slice) {
  return isExpeditionLive(state, slice.phase);
}

// The definition an instance answers to. For eleven of the twelve that is simply the config row;
// for a rotating `majors` contract the drawn template's kind, objective and terms are merged over
// it, so Organizational Depth is one row in config and many objectives in play.
function definitionFor(instance) {
  if (!instance || typeof instance.id !== 'string') return null;
  const base = getContractDefinition(instance.id);
  if (!base) return null;
  if (typeof instance.templateId !== 'string') return base;
  const template = getOrganizationalDepthTemplate(instance.templateId);
  if (!template) return base;
  return { ...base, kind: template.kind, objective: template.objective, terms: template.terms };
}

// `=== 'active'` and `=== 'offered'` rather than truthiness tests, matching the `=== true`
// discipline engine/colony.js's resolveSiteRecord() applies to every save-borne field: these
// records come off disk and the values that are not the authored ones are all corruption. Kept in
// step with engine/colony.js's isActiveContract(), which is the same test on the other side of the
// cycle — the draw table is summed there and the status is written here, and the two must agree
// about what "drawing" means or a recalled crew keeps eating Power forever.
function isActive(instance) {
  return !!instance && instance.status === STATUS_ACTIVE;
}

function isOffered(instance) {
  return !!instance && instance.status === STATUS_OFFERED;
}

// Whether ANY contract is currently drawing. Exported for engine/tickEngine.js, which uses it to
// decide whether to pay for a colonyRates() solve before integrating — see the call site there.
function hasActiveContracts(state) {
  return expeditionSlice(state).contracts.some(isActive);
}

// ---------------------------------------------------------------------------------------------
// THE BOARD SEED
//
// A small deterministic generator (mulberry32). NOT `rng`, and deliberately not Math.random: the
// board is DERIVED rather than stored, so it is recomputed on every one of the ~20 renders a second
// the tick loop causes. A board built from Math.random would visibly reroll itself every frame —
// three different assignments faster than anyone can read them. Seeded from state, the same state
// produces the same board, so it holds still, survives a reload unchanged and reproduces exactly in
// a headless run. engine/bookie.js's propOfferSeed() is the template and the argument there is
// identical.
//
// A SECOND COPY OF bookie.js's EIGHT LINES RATHER THAN AN IMPORT, and the alternatives were both
// worse. bookie.js's copy is private, so exporting it would widen an Act IV betting module's
// surface for an Act VII consumer that shares nothing with it — a dependency edge with no meaning
// behind it. Extracting a shared engine/random.js is a refactor of two files this story otherwise
// has no reason to open, on a branch whose risk is already concentrated in engine/colony.js.
// Recorded rather than hidden: if a third caller ever wants one, that is the moment to extract it.
// ---------------------------------------------------------------------------------------------
function seededRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The seed is BOTH a clock epoch and the phase rank, and it needs both.
//
//   * The epoch (OFFER_ROTATION_SECONDS) is what stops the board being the same three assignments
//     for a whole phase, and it is what makes an offline return correct for free: advance() may
//     cross eight hours in one iteration, and when the player looks, the clock has moved and the
//     board is simply new. There is no catch-up to miss and no queue to drain.
//   * The phase rank is what keeps the board HONEST across a boundary. The pool is phase-keyed, so
//     a draw seeded on the clock alone would, at the instant the phase advanced, reshuffle the
//     surviving offers as a side effect of a change that has nothing to do with them.
//
// An offer already on the board is untouched by any of this: its payout, deadline and terms were
// resolved onto the instance when it was placed.
function boardSeed(state, slice) {
  const epoch = Math.floor(Math.max(0, clockOf(state)) / OFFER_ROTATION_SECONDS);
  // +1 so an unrecognized phase (rank -1) and `aftermath` (rank 0) do not collide on 0.
  const rank = phaseRank(slice.phase) + 1;
  return (Math.imul(epoch, 0x9e3779b1) ^ Math.imul(rank, 0x85ebca6b)) >>> 0;
}

// ---------------------------------------------------------------------------------------------
// OFFERING
// ---------------------------------------------------------------------------------------------

// A payout is a PERCENTAGE resolved against the threshold of the launch currently being filled
// (ledger R3), and it is resolved ONCE, at offer time, onto the instance — so the row the player
// accepted is the row that pays. Resolving at claim time instead would mean a contract accepted
// before a launch and claimed after it silently paid against the next rung, which is a payout that
// changes while the player is looking at it.
//
// engine/launch.js owns which burn is being filled and exports currentLaunchThreshold() for this.
// Rounded to whole units because Fuel is displayed and compared as a quantity, not a rate.
function resolvePayout(state, definition) {
  const threshold = currentLaunchThreshold(state);
  const pct = Number.isFinite(definition.payoutPct) ? definition.payoutPct : 0;
  const salvage = Number.isFinite(definition.payoutSalvage) ? definition.payoutSalvage : 0;
  return {
    payoutFuel: pct > 0 && threshold > 0 ? Math.round(pct * threshold) : 0,
    payoutSalvage: salvage,
  };
}

// The seconds an accepted instance's window runs for, or null when it has none.
//
// SUSTAIN CONTRACTS DELIBERATELY HAVE NO WINDOW. §9.4: "An accepted contract never expires." A hold
// that had to be completed inside a deadline would be the one thing on this board that punishes a
// player for being away during a stretch they could not have shortened. So a sustain runs until it
// is met or abandoned, however long that takes.
function windowSecondsOf(definition) {
  const objective = definition && definition.objective;
  const seconds = objective && objective.windowSeconds;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

// Total seconds a segmented sustain runs for; null when the objective is not segmented.
function segmentsOf(definition) {
  const objective = definition && definition.objective;
  return Array.isArray(objective && objective.segments) ? objective.segments : null;
}

function segmentTotalSeconds(segments) {
  return segments.reduce((total, segment) => total + (Number.isFinite(segment.seconds) ? segment.seconds : 0), 0);
}

// The seconds a simple sustain must hold for.
function holdSecondsOf(definition) {
  const objective = definition && definition.objective;
  const segments = segmentsOf(definition);
  if (segments) return segmentTotalSeconds(segments);
  const seconds = objective && objective.holdSeconds;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

// A fresh offer. Every field §9.3 names is written explicitly, including the ones that are null for
// this kind, because a shape assembled conditionally is a shape that differs between rows — and a
// row missing a key is a row whose later write deletes it, which is the failure
// engine/concessions.js records in full.
function makeOffer(state, definition, options) {
  const clock = clockOf(state);
  const { payoutFuel, payoutSalvage } = resolvePayout(state, definition);
  const makeup = !!(options && options.makeup);
  const window = Number.isFinite(definition.offerWindowSeconds) ? definition.offerWindowSeconds : null;
  return {
    id: definition.id,
    status: STATUS_OFFERED,
    progress: 0,
    stage: 0,
    // The OFFER deadline, and the only deadline in the system. Doubled for a Makeup Game, which is
    // the whole of the Office's apology: "Same terms. Longer window."
    expiresAtClock: window === null ? null : clock + window * (makeup ? MAKEUP_WINDOW_MULTIPLIER : 1),
    windowEndsAtClock: null,
    acceptedAtClock: null,
    payoutFuel,
    payoutSalvage,
    roll: null,
    makeup,
    templateId: (options && options.templateId) || null,
    clickCountAtAccept: null,
  };
}

// Which definitions could be placed on the board right now.
//
// THREE EXCLUSIONS, AND THE THIRD IS THE ONE WORTH READING. A definition is out if it belongs to
// another phase, if it is already an instance (offered, active or claimable), or if it is in
// `completedIds` — the payout-once ledger. `repeatable` rows skip the third: Organizational Depth
// is §9.5's endless assignment and is supposed to come back forever, so it is never written into
// the ledger at all rather than being filtered back out of it.
function eligibleDefinitions(state, slice) {
  const board = slice.contractBoard;
  const held = slice.contracts.map((instance) => instance && instance.id);
  return ACT_SEVEN_CONTRACTS.filter((definition) => {
    if (definition.phase !== slice.phase) return false;
    if (held.indexOf(definition.id) !== -1) return false;
    if (!definition.repeatable && board.completedIds.indexOf(definition.id) !== -1) return false;
    return true;
  });
}

// A seeded shuffle, drawing `count` without replacement. Fisher-Yates over a copy rather than a
// `sort(() => rng() - 0.5)`, which is not a uniform shuffle and which produces a visibly biased
// board on a three-element pool — the exact size this draws from.
function drawWithout(candidates, count, rng) {
  const pool = candidates.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }
  return pool.slice(0, Math.max(0, count));
}

// Fills empty slots. Never removes an offer the player has not seen churn off (§9.4).
//
// THE ROTATION CLOCK IS A COOLDOWN AND NOT A SCHEDULE, and refreshBoard() is where the difference
// lives. `nextOfferAtClock` is pushed forward only when a refresh actually PLACES something; a
// due-but-full board leaves it in the past and this function returns state by identity. Treated as
// a schedule instead — advanced every time it came due, board full or not — an untouched board
// would keep proposing an event boundary every 300 seconds and an idle eight-hour return would burn
// roughly 96 advance() iterations resolving nothing. Left in the past, the contributor abstains
// (see nextContractEventClock) and the slot is filled on the very iteration the player empties it.
//
// MAKEUP GAMES ARE PREFERRED, NOT GUARANTEED. A lapsed id is drawn ahead of a fresh one so the
// board does not repeat itself while an apology is outstanding, and it is taken OFF `missedIds`
// when it is re-offered — otherwise it would be preferred forever and the board would show nothing
// else. Missing it a second time puts it back.
function refreshBoard(state) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return state;

  const board = slice.contractBoard;
  const clock = clockOf(state);
  if (!(clock >= board.nextOfferAtClock)) return state;

  const openSlots = BOARD_SLOTS - slice.contracts.filter(isOffered).length;
  if (openSlots <= 0) return state;

  const eligible = eligibleDefinitions(state, slice);
  if (eligible.length === 0) return state;

  const makeups = eligible.filter((definition) => board.missedIds.indexOf(definition.id) !== -1);
  const fresh = eligible.filter((definition) => board.missedIds.indexOf(definition.id) === -1);

  const rng = seededRng(boardSeed(state, slice));
  const chosen = [
    ...drawWithout(makeups, openSlots, rng),
    ...drawWithout(fresh, openSlots - Math.min(openSlots, makeups.length), rng),
  ].slice(0, openSlots);
  if (chosen.length === 0) return state;

  const placed = chosen.map((definition) => {
    const makeup = board.missedIds.indexOf(definition.id) !== -1;
    // A rotating row draws its objective from the standing list, re-seeded per offer (§9.5 #12).
    const templateId =
      definition.kind === CONTRACT_KINDS.rotating && ORGANIZATIONAL_DEPTH_TEMPLATES.length > 0
        ? drawWithout(ORGANIZATIONAL_DEPTH_TEMPLATES, 1, rng)[0].id
        : null;
    return makeOffer(state, definition, { makeup, templateId });
  });
  const placedIds = placed.map((instance) => instance.id);

  return {
    ...state,
    // Spread the FULL accessor return, never a partial object — engine/concessions.js records the
    // near-miss this convention prevents: a key one copy of the shape forgets is a key every later
    // write silently deletes.
    expedition: {
      ...slice,
      contracts: [...slice.contracts, ...placed],
      contractBoard: {
        ...board,
        nextOfferAtClock: clock + OFFER_ROTATION_SECONDS,
        missedIds: board.missedIds.filter((id) => placedIds.indexOf(id) === -1),
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// THE OBJECTIVES
//
// One dispatch, over the predicate NAMES declared in data/actSevenContractsConfig.js. The names
// live in config so a reader of a contract row can find its behaviour; the bodies live here because
// they are logic and a data file that computes is a data file nobody can trust.
//
// EVERY PREDICATE IS A PURE FUNCTION OF (state, slice, rates) AND SAMPLES NOTHING IT IS NOT GIVEN.
// `rates` in particular is the colony solve taken BEFORE the step was integrated — see the note on
// advanceContracts() — so a predicate that reached for colonyRates(state) itself would silently
// read the post-step regime and answer a different question than the one it was asked.
// ---------------------------------------------------------------------------------------------
function fractionOf(rates, slice, resourceId) {
  const capacity = rates.capacity[resourceId];
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  const held = slice.resources[resourceId];
  const amount = held && Number.isFinite(held.amount) ? held.amount : 0;
  return amount / capacity;
}

function objectiveHolds(state, slice, instance, definition, rates) {
  const objective = definition.objective || {};
  switch (objective.predicate) {
    // A rate condition. `exclusive` distinguishes "positive" (Backfield Work: strictly above zero)
    // from "at least" (Doubleheader: 1.5/sec or better), because "hold a positive rate" and "hold
    // 1.5" are different sentences and a colony sitting at exactly zero satisfies only one of them.
    case 'netRate': {
      const net = rates.net[objective.resource];
      if (!Number.isFinite(net)) return false;
      return objective.exclusive ? net > objective.minimum : net >= objective.minimum;
    }
    // A stock floor as a FRACTION of the derived ceiling, never as an absolute. The ceiling grows
    // with the tanks the player buys and the sites they reach, so an absolute floor would silently
    // become trivial — "keep the air above half" has to mean half of whatever you have.
    case 'resourceFloor':
      return fractionOf(rates, slice, objective.resource) >= objective.fraction;
    case 'noManualClicks':
      return totalClicksOf(state) === instance.clickCountAtAccept;
    case 'modulesOnline':
      return (
        slice.modules.reduce(
          (total, module) => total + (module && Number.isFinite(module.count) ? module.count : 0),
          0
        ) >= objective.target
      );
    // Reads engine/launch.js's stored `overshootRatio` (fuelSpent / threshold) directly. §9.5
    // flagged this as needing a field or a predicate from §7; STORY-028 shipped the field, so there
    // is no second definition of what "overfilled" means anywhere in the act.
    case 'tightLaunch':
      return slice.launches.some(
        (launch) =>
          !!launch
          && launch.resolved === true
          && Number.isFinite(launch.overshootRatio)
          && launch.overshootRatio < objective.maxOvershoot
      );
    // engine/puzzles.js's solvedUnaided() was written for this contract; its comment says so by
    // name. Called with no puzzle id, which is its "any puzzle at all" form.
    case 'unaidedSolve':
      return solvedUnaided(state);
    case 'deliverResource': {
      const held = slice.resources[objective.resource];
      return !!held && held.amount >= objective.amount;
    }
    case 'deliverCurrency':
      return balanceOf(state.wallet, objective.currency) >= objective.amount;
    // An expedition's objective is the passage of time and nothing else. Always true; the window
    // is what finishes it.
    case 'elapsed':
      return true;
    // A staged objective is never answered by a single predicate — see advanceStaged(). Returning
    // false here rather than throwing means a corrupt instance stalls rather than crashing the tick
    // loop, which is the direction every other guard in the act picks.
    default:
      return false;
  }
}

// Which segment of a segmented sustain `progress` seconds lands in, and how far into it. Derived
// rather than stored, which is what keeps §9.3's "only `progress` and `roll` are stored" true for
// the Doubleheader.
function segmentAt(segments, progress) {
  let elapsed = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const seconds = Number.isFinite(segments[i].seconds) ? segments[i].seconds : 0;
    if (progress < elapsed + seconds) {
      return { index: i, segment: segments[i], into: progress - elapsed, endsAt: elapsed + seconds };
    }
    elapsed += seconds;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// ADVANCING
// ---------------------------------------------------------------------------------------------

// One instance, one step. Returns the instance UNCHANGED BY IDENTITY when nothing happened, a new
// instance when something did, or `null` when it lapsed or was voided — which the caller turns into
// a removal plus an entry in `missedIds`.
//
// SUSTAIN PROGRESS IS A CLOSED-FORM ADD, NOT A SAMPLING, and that is a consequence of
// engine/colony.js's model rather than an approximation of it. Rates are linear in time within a
// step and the only instants a rate can change are the boundaries findNextEventClock() returns. So
// if the condition holds at the START of a step and no boundary falls inside it, it held for the
// whole step: `progress += step`. If it does not hold at step start, `progress = 0`. No
// integration, no sampling error, and no dependence on `deltaSeconds` — an eight-hour return costs
// the same handful of iterations the income integration does.
function advanceInstance(state, slice, instance, step, clock, rates) {
  if (!instance || typeof instance.id !== 'string') return instance;

  // ONLY AN UNACCEPTED OFFER CAN LAPSE (§9.4). An accepted contract has no deadline to miss; it has
  // a window it is inside. Nothing is debited by a lapse and the id becomes eligible to return as a
  // Makeup Game at the same payout, so the phase's total available Fuel is unchanged by having
  // missed something. That is pillar 3 as a mechanism rather than as a promise.
  if (instance.status === STATUS_OFFERED) {
    if (Number.isFinite(instance.expiresAtClock) && instance.expiresAtClock <= clock) return null;
    return instance;
  }

  // Already finished. Nothing in advance() may touch a claimable contract — in particular nothing
  // may pay it. See the note on claim().
  if (instance.status !== STATUS_ACTIVE) return instance;

  const definition = definitionFor(instance);
  if (!definition) return instance;
  const objective = definition.objective || {};
  const elapsed = step > 0 && Number.isFinite(step) ? step : 0;

  // The staged window (Rehab Assignment). The one objective a snapshot genuinely cannot recover,
  // because "has the Oxygen ALREADY been below 20%?" is not a fact about the present — which is the
  // identical argument §9.3 used to justify storing `progress` at all.
  if (objective.predicate === 'stagedFraction') {
    const fraction = fractionOf(rates, slice, objective.resource);
    let stage = Number.isFinite(instance.stage) ? instance.stage : 0;
    if (stage === 0 && fraction <= objective.lowFraction) stage = 1;
    if (stage === 1 && fraction >= objective.highFraction) stage = 2;
    if (stage >= 2) return { ...instance, stage, status: STATUS_CLAIMABLE, windowEndsAtClock: null };
    // The window closing without the stages met VOIDS it, which costs nothing: the instance is
    // removed and the id joins `missedIds`, the same path a lapse takes. "There is no other
    // penalty" is implemented as: the same code as never having accepted it.
    if (Number.isFinite(instance.windowEndsAtClock) && instance.windowEndsAtClock <= clock) return null;
    return stage === instance.stage ? instance : { ...instance, stage };
  }

  // A window under a constraint. Breaking the constraint voids it at the instant it breaks, rather
  // than at the window's end, so the player is not left watching a run they have already lost.
  if (definition.kind === CONTRACT_KINDS.window) {
    if (!objectiveHolds(state, slice, instance, definition, rates)) return null;
    if (Number.isFinite(instance.windowEndsAtClock) && instance.windowEndsAtClock <= clock) {
      return { ...instance, status: STATUS_CLAIMABLE, windowEndsAtClock: null };
    }
    return instance;
  }

  // An expedition runs and draws; the only thing that finishes it is the clock. Its upkeep is
  // charged by engine/colony.js's demand term, which reads `status === 'active'` — so the draw
  // stops on exactly the step this line stops it.
  if (definition.kind === CONTRACT_KINDS.expedition) {
    if (Number.isFinite(instance.windowEndsAtClock) && instance.windowEndsAtClock <= clock) {
      return { ...instance, status: STATUS_CLAIMABLE, windowEndsAtClock: null };
    }
    return instance;
  }

  if (definition.kind === CONTRACT_KINDS.sustain) {
    const segments = segmentsOf(definition);
    const progress = Number.isFinite(instance.progress) ? instance.progress : 0;
    let next;
    if (segments) {
      const at = segmentAt(segments, progress);
      // Past the last segment: the whole assignment is done. Reached only when a step lands exactly
      // on the total, which the segment boundaries below make the normal case rather than a fluke.
      if (!at) next = progress + elapsed;
      // A STAND-DOWN SEGMENT ADVANCES UNCONDITIONALLY. "Stand down for two" is not a second thing
      // to hold — the Office is measuring whether the ceiling is there the SECOND time, and holding
      // through the gap would make the contract one 600-second hold with extra words.
      else if (!at.segment.hold) next = progress + elapsed;
      else if (objectiveHolds(state, slice, instance, definition, rates)) next = progress + elapsed;
      else next = 0;
    } else if (objectiveHolds(state, slice, instance, definition, rates)) {
      next = progress + elapsed;
    } else {
      next = 0;
    }

    const target = holdSecondsOf(definition);
    if (Number.isFinite(target) && next >= target) {
      return { ...instance, progress: target, status: STATUS_CLAIMABLE };
    }
    return next === progress ? instance : { ...instance, progress: next };
  }

  // `state` kind: a condition, checked every iteration. No window, no accumulator, and therefore
  // nothing that an eight-hour step can get wrong.
  if (objectiveHolds(state, slice, instance, definition, rates)) {
    return { ...instance, status: STATUS_CLAIMABLE };
  }
  return instance;
}

// One step of the whole board. Paired with nextContractEventClock() on engine/tickEngine.js's
// contributor list, the way resolveArrivals() is paired with nextArrivalClock(): a boundary with no
// resolver would step advance() to a contract's window end and then leave it unresolved, which is
// the failure this function exists to prevent rather than cause.
//
// `rates` IS THE COLONY SOLVE FROM BEFORE THE STEP WAS INTEGRATED, and the caller is responsible
// for that. Computing it here instead would read the regime that takes effect AT the boundary the
// step just landed on, and a hold would be credited or reset against a rate that was not in force
// for any of the seconds being credited. tickEngine.js samples it once, and only when there is an
// active contract to sample for.
//
// IDEMPOTENT ENOUGH TO REPLAY, BY CONSTRUCTION RATHER THAN BY BOOKKEEPING: nothing here credits
// anything (see claim()), a lapse removes the instance it lapsed, and a completion sets a status
// that is already set on a second pass. The worst a duplicated call can do is add `step` to a
// progress counter twice, which is why the caller passes the step it actually took.
//
// Returns the state object it was handed, BY IDENTITY, when nothing moved — which is every
// iteration of every act before Act VII, on the cheapest possible test.
//
// ---------------------------------------------------------------------------------------------
// MEASURED: THE EIGHT-HOUR OFFLINE RETURN (driven under `node` while building this story; the
// harness lives in /tmp and is deliberately not committed — there is no test runner in this repo
// and adding one is its own change). Every figure below is a real `advance(state, 28800)`, counted
// by wrapping this module's contributor, so it is the actual loop count and not a model of one.
//
//   ITERATION COST, against balanceConfig.safetyCapIterations of 2,000:
//     pre-Act-VII save (every save in six acts) ................  1 iteration
//     Act VII, board untouched for the whole absence ...........  29
//     Act VII `aftermath`, board untouched .....................  32
//     Act VII, two contracts active + the board rotating .......   9
//     Act VII `majors`, one rolling assignment .................   5
//     WORST OBSERVED: 32, a margin of ~60x. Every fixture was additionally checked to carry the
//     clock the full 28,800 seconds, because silently hitting the cap would stop the loop with
//     `remaining` still positive and under-credit a returning player with no error raised anywhere.
//
//   The untouched-board figure is the interesting one and it is bounded by design rather than by
//   luck: only three of the twelve contracts carry an offer deadline at all, so an undeadlined
//   board simply sits, and a FULL board proposes no rotation boundary whatsoever (see
//   nextContractEventClock). The 29 is one lapse-and-reissue cycle per ~1,000 seconds on the one
//   deadlined offer in the `lunar` pool.
//
//   CORRECTNESS ACROSS THE SPAN, which is what AC #7 actually asks:
//     * Doubleheader accepted at t=0 on a colony making 3.6 Fuel/s: after one 8h call its
//       `progress` is exactly 600 (its full 240 + 120 + 240) and its status is `claimable`. Walked
//       instead in seven 100-second calls it lands on the identical 600 — the segment boundaries
//       are what make the chunked and stepwise runs agree.
//     * Waiver Claim accepted at t=0: `claimable` after the span, its 3 Power / 1 Provision draw
//       charged for exactly its 600 seconds (demand.power 180.0 -> 183.0 while active, back after),
//       and NOTHING credited — the tank is untouched until the player presses the button.
//     * Innings Limit held across the span completes; the same fixture with one click at t=10 is
//       voided, removed, and its id is in `missedIds` with nothing debited.
//     * Rehab Assignment walks stage 0 -> 1 at 10% Oxygen and 1 -> 2 at 95%; the same fixture left
//       at 50% for 400 seconds voids at its window end rather than lingering.
//     * REPLAY: `advance(state, 28800)` run twice over the same starting state produces
//       byte-identical `expedition` slices, and a replayed `advanceContracts` returns the state
//       object by identity. That is the no-credit rule (see claim()) observed rather than asserted.
// ---------------------------------------------------------------------------------------------
function advanceContracts(state, step, rates) {
  const slice = expeditionSlice(state);
  if (slice.contracts.length === 0) return state;
  if (!isLive(state, slice)) return state;

  const clock = clockOf(state);
  // Solved here only when the caller did not supply it AND something actually needs it. Every
  // predicate that reads a rate belongs to an ACTIVE instance, so a board holding nothing but
  // offers — which is most of an Act VII run — resolves its expiries without paying for a
  // fixed-point solve. `null` never reaches a predicate, because the only paths that dereference
  // `resolved` are inside the `status === 'active'` branch of advanceInstance().
  const resolved = rates || (slice.contracts.some(isActive) ? colonyRates(state) : null);

  let changed = false;
  const kept = [];
  const missed = [];
  slice.contracts.forEach((instance) => {
    const outcome = advanceInstance(state, slice, instance, step, clock, resolved);
    if (outcome === instance) {
      kept.push(instance);
      return;
    }
    changed = true;
    if (outcome === null) {
      if (instance && typeof instance.id === 'string') missed.push(instance.id);
      return;
    }
    kept.push(outcome);
  });

  if (!changed) return state;

  const board = slice.contractBoard;
  const newlyMissed = missed.filter((id) => board.missedIds.indexOf(id) === -1);
  return {
    ...state,
    expedition: {
      ...slice,
      contracts: kept,
      contractBoard: newlyMissed.length
        ? { ...board, missedIds: [...board.missedIds, ...newlyMissed] }
        : board,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// THE WAKE BOUNDARY
// ---------------------------------------------------------------------------------------------

// The earliest instant at which something on this board changes; Infinity when nothing does.
//
// CONTRACT (engine/tickEngine.js's contributor list): pure, guards its OWN slice, and returns
// Infinity — never 0, null or undefined — when nothing is pending. Returning 0 pins advance()'s
// step at zero and burns all 2,000 safetyCapIterations without moving the clock, silently
// discarding the rest of a returning player's eight hours.
//
// FOUR CANDIDATE SOURCES, and the last two are not in §9.4's list of three:
//
//   1. Every unaccepted offer's `expiresAtClock`. Three of the twelve carry one.
//   2. Every active window's or expedition's `windowEndsAtClock`.
//   3. `contractBoard.nextOfferAtClock`, BUT ONLY WHEN A SLOT IS FREE. A refresh only fills empty
//      slots, so a full board has nothing for a rotation to do; proposing one anyway would put an
//      event every 300 seconds in front of an idle eight-hour return — ~96 iterations of nothing.
//   4. A segmented sustain's next SEGMENT end. §9.4 did not anticipate the Doubleheader needing
//      this, and it does: the rule for what advances `progress` differs between a hold segment and
//      a stand-down, so a single step spanning the join would credit hold-time for stand-down
//      seconds. Contributed only while `progress > 0` — an accumulator sitting at zero has no
//      scheduled next anything, and proposing one anyway would put a boundary every 240 seconds in
//      front of a player whose colony is simply not making enough Fuel.
//
// PAST-DUE BOUNDARIES ARE EXCLUDED, for the reason nextArrivalClock() states: a boundary already in
// the past is not a future event, and proposing it makes `step` zero for that iteration. The
// resolvers at the foot of the loop clear it anyway, but the loop has burned an iteration on a step
// of nothing. Every candidate is Number.isFinite-guarded for the reason normalizeResource() gives:
// a NaN reaching this return value becomes a NaN step, and a NaN step freezes the game permanently.
function nextContractEventClock(state) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return Infinity;

  const clock = clockOf(state);
  let soonest = Infinity;
  const consider = (candidate) => {
    if (!Number.isFinite(candidate) || candidate <= clock) return;
    if (candidate < soonest) soonest = candidate;
  };

  slice.contracts.forEach((instance) => {
    if (!instance) return;
    if (instance.status === STATUS_OFFERED) {
      consider(instance.expiresAtClock);
      return;
    }
    if (instance.status !== STATUS_ACTIVE) return;
    consider(instance.windowEndsAtClock);

    const segments = segmentsOf(definitionFor(instance));
    if (!segments) return;
    const progress = Number.isFinite(instance.progress) ? instance.progress : 0;
    if (progress <= 0) return;
    const at = segmentAt(segments, progress);
    if (at) consider(clock + (at.endsAt - progress));
  });

  if (slice.contracts.filter(isOffered).length < BOARD_SLOTS) {
    consider(slice.contractBoard.nextOfferAtClock);
  }

  return soonest;
}

// ---------------------------------------------------------------------------------------------
// THE SHOP
// ---------------------------------------------------------------------------------------------

// Why an offer cannot be accepted right now, as one of §9.6's refusal codes, or null.
function acceptRefusalFor(slice, instance) {
  if (instance.status === STATUS_ACTIVE || instance.status === STATUS_CLAIMABLE) return 'active';
  if (slice.contracts.filter(isActive).length >= MAX_ACTIVE_CONTRACTS) return 'slots';
  return null;
}

// Why a claimable contract cannot be filed right now, or null. Both cases are TEMPORARY and neither
// loses anything: the goods arrive, or the tank empties, and the same row becomes claimable.
function claimRefusalFor(state, slice, instance, definition, rates) {
  if (definition.kind === CONTRACT_KINDS.delivery) {
    if (!objectiveHolds(state, slice, instance, definition, rates)) return 'stock';
  }
  if (instance.payoutFuel > 0) {
    const held = slice.resources[CONTRACT_FUEL_RESOURCE];
    const headroom = rates.capacity[CONTRACT_FUEL_RESOURCE] - (held ? held.amount : 0);
    if (instance.payoutFuel > headroom) return 'tank';
  }
  return null;
}

// The progress block, fully resolved, so the panel renders a bar and a caption and computes
// neither. `null` for a contract with nothing to show.
function progressFor(state, instance, definition, clock, rates, slice) {
  const objective = definition.objective || {};

  if (definition.kind === CONTRACT_KINDS.sustain) {
    const target = holdSecondsOf(definition) || 0;
    const value = Number.isFinite(instance.progress) ? instance.progress : 0;
    const segments = segmentsOf(definition);
    const at = segments ? segmentAt(segments, value) : null;
    const label =
      at && !at.segment.hold
        ? contractCopy.standDownLabel(at.endsAt - value)
        : contractCopy.heldLabel(value, target);
    return { value, target, pct: target > 0 ? Math.min(1, value / target) : 0, label };
  }

  if (objective.predicate === 'stagedFraction') {
    const stage = Number.isFinite(instance.stage) ? instance.stage : 0;
    return { value: stage, target: 2, pct: stage / 2, label: contractCopy.stageLabel(stage, 2) };
  }

  if (definition.kind === CONTRACT_KINDS.window || definition.kind === CONTRACT_KINDS.expedition) {
    const total = windowSecondsOf(definition) || 0;
    if (instance.status !== STATUS_ACTIVE || !Number.isFinite(instance.windowEndsAtClock)) {
      return { value: 0, target: total, pct: 0, label: contractCopy.remainingLabel(total) };
    }
    const remaining = Math.max(0, instance.windowEndsAtClock - clock);
    return {
      value: total - remaining,
      target: total,
      pct: total > 0 ? Math.min(1, (total - remaining) / total) : 0,
      label: contractCopy.remainingLabel(remaining),
    };
  }

  if (definition.kind === CONTRACT_KINDS.delivery) {
    const held =
      objective.predicate === 'deliverCurrency'
        ? balanceOf(state.wallet, objective.currency)
        : (slice.resources[objective.resource] || { amount: 0 }).amount;
    const unit = objective.predicate === 'deliverCurrency' ? 'Salvage' : 'Provisions';
    return {
      value: Math.min(held, objective.amount),
      target: objective.amount,
      pct: objective.amount > 0 ? Math.min(1, held / objective.amount) : 0,
      label: contractCopy.deliveryLabel(held, objective.amount, unit),
    };
  }

  // A `state` contract is a condition, not a quantity. It has no bar; it has an answer.
  const met = objectiveHolds(state, slice, instance, definition, rates);
  return {
    value: met ? 1 : 0,
    target: 1,
    pct: met ? 1 : 0,
    label: met ? contractCopy.readyLabel : contractCopy.openLabel,
  };
}

// Presentation-ready rows, everything already resolved (PRD §9.6). The panel renders these verbatim
// and recomputes nothing — the reference pair is engine/lotShop.js <-> components/lot/LotShop.js,
// and the reason is the one §6's listResources() note gives: a surface that runs its own arithmetic
// will eventually disagree with the engine, and here it would disagree about whether a payout fits.
//
// ONE SOLVE FOR THE WHOLE BOARD. colonyRates() is called once and threaded into every row, rather
// than once per row: twelve rows would otherwise mean twelve fixed-point solves per render, and the
// board is re-rendered by every tick.
function listOffers(state) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return [];
  if (slice.contracts.length === 0) return [];

  const clock = clockOf(state);
  const rates = colonyRates(state);

  return slice.contracts
    .map((instance) => {
      const definition = definitionFor(instance);
      if (!definition) return null;

      const acceptRefusal = instance.status === STATUS_OFFERED ? acceptRefusalFor(slice, instance) : null;
      const claimRefusal =
        instance.status === STATUS_CLAIMABLE
          ? claimRefusalFor(state, slice, instance, definition, rates)
          : null;

      return {
        id: instance.id,
        name: instance.makeup ? contractCopy.makeupName(definition.name) : definition.name,
        brief: instance.makeup ? contractCopy.makeupBrief(definition.name) : definition.brief,
        terms: definition.terms,
        kind: definition.kind === CONTRACT_KINDS.rotating ? CONTRACT_KINDS.state : definition.kind,
        phase: definition.phase,
        status: instance.status,
        // Authored by the config the way engine/concessions.js authors its describe() output. An
        // unaccepted PTBNL shows its BAND and not its draw — §9.5 is explicit that "the band is
        // displayed on the board; the draw is not revealed until claim."
        effect:
          definition.rollBand && instance.status === STATUS_OFFERED
            ? contractCopy.effectBand(
                instance.payoutFuel * definition.rollBand[0],
                instance.payoutFuel * definition.rollBand[1]
              )
            : contractCopy.effect(instance.payoutFuel, instance.payoutSalvage),
        payoutFuel: instance.payoutFuel,
        payoutSalvage: instance.payoutSalvage,
        progress: progressFor(state, instance, definition, clock, rates, slice),
        expiresInSeconds:
          instance.status === STATUS_OFFERED && Number.isFinite(instance.expiresAtClock)
            ? Math.max(0, instance.expiresAtClock - clock)
            : null,
        makeup: !!instance.makeup,
        acceptable: instance.status === STATUS_OFFERED && !acceptRefusal,
        claimable: instance.status === STATUS_CLAIMABLE && !claimRefusal,
        abandonable: instance.status === STATUS_OFFERED || instance.status === STATUS_ACTIVE,
        refusal: acceptRefusal || claimRefusal,
        refusalReason: contractCopy.refusal[acceptRefusal || claimRefusal] || null,
      };
    })
    .filter((row) => row !== null);
}

function writeContracts(state, slice, contracts, board) {
  return {
    ...state,
    expedition: { ...slice, contracts, contractBoard: board || slice.contractBoard },
  };
}

// Accepts an offer. New state, or null when it is not permitted.
//
// `rng` ENTERS AS A DEFAULTED PARAMETER (conventions: engine/wallBall.js and engine/bookie.js are
// the templates) AND IS USED FOR EXACTLY ONE THING: Player To Be Named Later's consideration, drawn
// ONCE and written onto the instance. Drawn at accept rather than at claim so the payout cannot be
// re-rolled by reloading, and stored rather than re-derived so a headless run with an injected
// generator is deterministic. Nothing else in this file touches it — the BOARD is seeded from state
// instead, for the reason argued over seededRng().
function accept(state, contractId, rng = Math.random) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return null;

  const instance = slice.contracts.find((row) => row && row.id === contractId);
  if (!instance || instance.status !== STATUS_OFFERED) return null;
  if (acceptRefusalFor(slice, instance)) return null;

  const definition = definitionFor(instance);
  if (!definition) return null;

  const clock = clockOf(state);
  const windowSeconds = windowSecondsOf(definition);
  const accepted = {
    ...instance,
    status: STATUS_ACTIVE,
    acceptedAtClock: clock,
    // The offer deadline is discharged the instant it is accepted. §9.4: "An accepted contract
    // never expires. It has no deadline to miss; it has a window it is inside."
    expiresAtClock: null,
    windowEndsAtClock: windowSeconds === null ? null : clock + windowSeconds,
    progress: 0,
    stage: 0,
    // Sealed here so Innings Limit needs no reducer hook. See totalClicksOf().
    clickCountAtAccept: totalClicksOf(state),
  };

  if (Array.isArray(definition.rollBand) && instance.payoutFuel > 0) {
    const draw = rng();
    const roll = Number.isFinite(draw) ? Math.min(1, Math.max(0, draw)) : 0;
    const [low, high] = definition.rollBand;
    accepted.roll = roll;
    accepted.payoutFuel = Math.round(instance.payoutFuel * (low + roll * (high - low)));
  }

  return writeContracts(
    state,
    slice,
    slice.contracts.map((row) => (row === instance ? accepted : row))
  );
}

// Files a completed contract and pays it. New state, or null when it is refused.
//
// EVERYTHING IN ONE RETURNED OBJECT, WHICH IS WHAT MAKES A DELIVERY SAFE. §9.6: "the delivery's
// debit and the payout's credit happen atomically inside claim(), so a delivery can never take the
// goods and fail to pay." The debit is applied to a LOCAL `working` copy and every subsequent
// refusal returns `null` and discards it — so a refused claim has taken nothing, because there was
// never a moment at which the debit existed anywhere the caller could see.
//
// THE TANK REFUSAL IS THE LOAD-BEARING ONE (AC #5, ledger R3). engine/colony.js's creditResource()
// refuses rather than clamping, and that refusal is honoured here rather than swallowed: a
// 1,300-Fuel payout into a tank with 200 units of headroom would otherwise silently destroy 1,100
// Fuel at the exact moment the player earned it. Nothing is lost by refusing — the contract stays
// claimable forever and becomes claimable the instant the player launches or reaches another site.
//
// TWO LEDGERS, ONE OBJECT. Fuel is not a wallet currency and goes through creditResource(); Salvage
// is and goes through creditWallet(). Waiver Claim pays both.
//
// PAYOUT-ONCE IS STRUCTURAL. The id moves into `completedIds` and the instance is removed in the
// same returned object, so a replayed action finds no instance and returns null — the
// sponsorBoard.announcedOfferIds idiom (engine/sponsorships.js), the same ledger reasoning, for the
// same offline-catch-up reason. `repeatable` rows skip the ledger: §9.5's Organizational Depth is
// supposed to come back forever, and writing it into a payout-once list would end the endless act.
function claim(state, contractId) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return null;

  const instance = slice.contracts.find((row) => row && row.id === contractId);
  if (!instance || instance.status !== STATUS_CLAIMABLE) return null;

  const definition = definitionFor(instance);
  if (!definition) return null;

  const rates = colonyRates(state);
  if (claimRefusalFor(state, slice, instance, definition, rates)) return null;

  let working = state;

  if (definition.kind === CONTRACT_KINDS.delivery) {
    const objective = definition.objective || {};
    if (objective.predicate === 'deliverResource') {
      // Through engine/colony.js and NOT engine/wallet.js: Provisions live in expedition.resources,
      // so debitWallet() is structurally not how they are spent.
      working = spendResource(working, objective.resource, objective.amount);
      if (!working) return null;
    } else if (objective.predicate === 'deliverCurrency') {
      if (!canAfford(working.wallet, objective.currency, objective.amount)) return null;
      working = { ...working, wallet: debitWallet(working.wallet, objective.currency, objective.amount) };
    }
  }

  if (instance.payoutFuel > 0) {
    const credited = creditResource(working, CONTRACT_FUEL_RESOURCE, instance.payoutFuel);
    if (!credited) return null;
    working = credited;
  }

  if (instance.payoutSalvage > 0) {
    working = {
      ...working,
      wallet: creditWallet(working.wallet || {}, CONTRACT_WALLET_CURRENCY, instance.payoutSalvage),
    };
  }

  // Re-read the slice from `working` and not from `slice`: spendResource() and creditResource() have
  // each returned a NEW expedition object, and writing the stale one back would undo the debit or
  // the credit that was the whole point of this function.
  const settled = expeditionSlice(working);
  const board = settled.contractBoard;
  return writeContracts(
    working,
    settled,
    settled.contracts.filter((row) => !(row && row.id === contractId)),
    definition.repeatable
      ? board
      : { ...board, completedIds: [...board.completedIds, contractId] }
  );
}

// Gives an offer back, or recalls a crew. New state, or null when there is nothing to abandon.
//
// NEVER PENALISED, AND THE ID GOES INTO `missedIds` RATHER THAN `completedIds`. Abandoning is
// exactly a lapse the player chose: nothing is debited, nothing is consumed, and the assignment
// becomes eligible to come back as a Makeup Game on the same terms. §9.5's Waiver Claim says so in
// the Office's own words — "Recall them whenever you like; a recalled claim is simply not a claim."
//
// A CLAIMABLE contract cannot be abandoned. That is not a rule about tidiness: a completed
// assignment the player has not filed is the one state on this board where something is owed to
// them, and an "abandon" button next to it is an invitation to throw it away by mis-click. If they
// genuinely do not want it, the tank refusal already lets them leave it there indefinitely.
function abandon(state, contractId) {
  const slice = expeditionSlice(state);
  if (!isLive(state, slice)) return null;

  const instance = slice.contracts.find((row) => row && row.id === contractId);
  if (!instance) return null;
  if (instance.status !== STATUS_OFFERED && instance.status !== STATUS_ACTIVE) return null;

  const board = slice.contractBoard;
  return writeContracts(
    state,
    slice,
    slice.contracts.filter((row) => row !== instance),
    board.missedIds.indexOf(contractId) === -1
      ? { ...board, missedIds: [...board.missedIds, contractId] }
      : board
  );
}

module.exports = {
  contractsSlice,
  listOffers,
  accept,
  claim,
  abandon,
  refreshBoard,
  advanceContracts,
  nextContractEventClock,
  hasActiveContracts,
  // PRD §9.6 puts contractUpkeepPerSecond on THIS module's surface, and it is re-exported rather
  // than implemented because engine/colony.js cannot require this file back: contracts.js needs
  // expeditionSlice, colonyRates, spendResource and creditResource from it, and CommonJS resolves a
  // cycle by handing whichever module loads second a half-built exports object — invisible at
  // require time, an undefined function on the first tick. colony.js documents the identical hazard
  // over resolvedSites(), which lives there rather than in engine/sites.js for exactly this reason.
  contractUpkeepPerSecond,
};
