// Act VII's contract board — the twelve fuel side quests (PRD §9, ledger R3 and R5).
//
// Config and prose only. Every number engine/contracts.js reads and every string the panel renders
// is here; there is no arithmetic in this file beyond the table lookups at the foot, which are the
// same shape data/actSevenSitesConfig.js's padUpkeepAt() and data/actSevenLaunchConfig.js's
// transitSecondsFrom() already established.
//
// ---------------------------------------------------------------------------------------------
// WHY CONTRACTS EXIST, IN ONE PARAGRAPH, BECAUSE IT IS WHAT EVERY NUMBER BELOW IS TUNED AGAINST.
//
// Each of Act VII's graded phases ends on a LUMP: a launch threshold that has to be filled before
// the door opens. The player builds the colony out over the first third of a phase, reaches the net
// rate the phase was designed around, and then watches a bar fill for the remaining two thirds.
// Acts I-VI never had this problem because a season is a stream of events; a threshold is not.
//
// A contract is the thing on the other side of that stretch, and it is the first PER-PLAYER pacing
// lever this codebase has. `rules` and modifiers move a phase for everyone; a contract moves it only
// for the player who runs it. Shortening the phase for the engaged player without shortening it for
// the one who checks in twice a day is the whole point, and it is why the ceiling below is an
// authored constant rather than an emergent one.
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// THE PAYOUT LADDER (§9.2, superseded in ONE respect by ledger R3)
//
// Every Fuel payout is a PERCENTAGE, never an absolute. §9.2's own instruction, restated because it
// is the single easiest thing to get wrong here: "declare `payoutPct` and let engine/contracts.js
// resolve it against the threshold, so the two files can never drift."
//
// WHAT THE PERCENTAGE MULTIPLIES IS LEDGER R3'S RULING AND NOT §9.2'S. §9.2 assumed one threshold
// per phase (1,200 / 4,000 / 12,000). §7 shipped FIVE launches across three Fuel-paying phases at
// 1,200 / 4,200 / 13,500 / 21,000 / 42,000, so the percentage multiplies THE THRESHOLD OF THE
// LAUNCH CURRENTLY BEING FILLED — engine/launch.js's currentLaunchThreshold() — and not a per-phase
// constant. §9's escalating ladder survives; §7's flat 8% is superseded; §7's 40% ceiling stands.
//
// Three contracts per Fuel-paying phase, so a player who runs every one of them skips 23.5% of the
// threshold they are filling:
//
//   Launch  Threshold   5%      7.5%    11%     three-contract total
//   L1        1,200       60       90     132    282  (23.5%)
//   L2        4,200      210      315     462    987  (23.5%)
//   L3       13,500      675    1,013   1,485  3,173  (23.5%)
//   L4       21,000    1,050    1,575   2,310  4,935  (23.5%)
//   L5       42,000    2,100    3,150   4,620  9,870  (23.5%)
//
// MEASURED AGAINST THE 40% CEILING (driven under `node` while building this story; the harness
// lives in /tmp and is deliberately not committed — there is no test runner in this repo and adding
// one is its own change). The worst case is NOT the row above: `deepSpace`'s Player To Be Named
// Later can draw up to PTBNL_ROLL_BAND[1] = 1.5x its nominal 5% rung, which turns 5 / 7.5 / 11 into
// 7.5 / 7.5 / 11 = 26.0%. Every phase, every rung, largest possible draw:
//
//   aftermath    0.0%   (pays Salvage — there is no tank yet, see below)
//   lifeSupport 23.5%
//   lunar       23.5%
//   deepSpace   26.0%   <- worst case among the AUTHORED phases, PTBNL at its ceiling
//   majors       8.0% PER CLAIM, and the per-threshold total is UNBOUNDED — see below
//
// 26.0% against a ceiling of 40%. The margin is 14 points, which is deliberate headroom rather than
// slack: it is what lets a later story add a fourth contract to a phase, or widen PTBNL's band,
// without reopening §7's pacing tables.
//
// ---------------------------------------------------------------------------------------------
// THE CEILING IS A STATEMENT ABOUT FOUR PHASES, NOT FIVE, AND SAYING SO IS THE POINT.
//
// The four authored phases hold the ceiling STRUCTURALLY rather than arithmetically: the pool is a
// fixed trio, and `contractBoard.completedIds` is a payout-once ledger, so "the most Fuel this
// phase can pay" is a number somebody chose and cannot be exceeded by playing well.
//
// `majors` has neither. Organizational Depth is `repeatable` (below), so its id never enters the
// ledger, and nothing here bounds how many times it may be completed against ONE threshold.
// MEASURED: at the top of the ladder (42,000), claiming it six times in succession pays
// 8 / 16 / 24 / 32 / 40 / 48% of that threshold — the ceiling is crossed on the fifth claim and
// exceeded on the sixth.
//
// That is NOT capped here, and the omission is deliberate rather than an oversight. §7.8's endless
// ladder is the thing that decides how fast a `majors` threshold arrives and how many 300-600
// second assignments fit inside one, and it does not exist yet — STORY-032 owns it. Adding
// claims-per-threshold bookkeeping now would mean inventing state for a phase whose pacing is
// undecided, and it would be the wrong lever anyway: the ladder's rung spacing is what bounds this,
// not a counter on the board.
//
// So the constraint is recorded rather than enforced, and it is recorded HERE because this is the
// file whoever ships that ladder will open. If a `majors` rung ever gets short enough that five
// assignments fit inside it, MAJORS_PAYOUT_PCT is the knob, and it must come down.
// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------

// The three rungs, named so no contract row contains a bare decimal. An escalating shape rather
// than §7's flat one because a board of three identical payouts asks the player to sort by
// difficulty alone, and two of the three hard contracts (Rain Delay, Waiver Claim) are hard in ways
// that are not obvious until they are running.
const PAYOUT_RUNGS = {
  small: 0.05,
  mid: 0.075,
  large: 0.11,
};

// §7's ceiling on how much of any one threshold the board may pay (ledger R3: "§7's 40% ceiling
// stands"). Not read by the engine on the hot path — it is the invariant the measurement above is
// taken against, and it is exported so a harness can re-take that measurement after a retune
// instead of re-deriving the intent from a comment.
const PAYOUT_CEILING_PCT = 0.4;

// `majors` is endless (§7.8, §9.5 #12), so it gets one rolling contract at a time rather than an
// authored trio. 8% is §7's original flat figure, kept for exactly the case ledger R3 did not
// supersede: a rung with no authored pool has no ladder to escalate along.
const MAJORS_PAYOUT_PCT = 0.08;

// ---------------------------------------------------------------------------------------------
// THE BOARD (§9.4)
// ---------------------------------------------------------------------------------------------

// Three slots. Offers the player is not interested in SIT THERE — the board only churns when a slot
// empties. That is what makes "which offers appear" a low-frequency question and is why the seed
// below is a coarse clock epoch rather than anything finer.
const BOARD_SLOTS = 3;

// AT MOST TWO ACTIVE AT ONCE, and this is the real ceiling on contract income rather than a comfort
// limit. It is what makes the per-launch arithmetic above an AUTHORED constant: the pool is three
// authored contracts, not an infinite rotation, so "the most Fuel a phase can pay" is a number
// somebody chose. data/concessionsConfig.js sizes its stand upgrades by the same reasoning — "every
// upgrade owned at once" has to be a stated figure or the balance table is fiction.
const MAX_ACTIVE_CONTRACTS = 2;

// How often a refresh may fill an empty slot.
//
// IT IS A COOLDOWN, NOT A SCHEDULE, and engine/contracts.js's refreshBoard() depends on the
// difference. A refresh only ever FILLS empty slots; it never churns an offer the player has not
// seen. So `nextOfferAtClock` is pushed forward only when a refresh actually places something, and
// a due-but-full board simply leaves it in the past. Treated as a schedule instead — advanced every
// time it came due, full board or not — an untouched board would propose an event boundary every
// 300 seconds and an idle eight-hour return would burn ~96 advance() iterations resolving nothing.
//
// 300 seconds is §9.4's starting figure and its intent is stated there: the THIRD offer of a phase
// should arrive around the moment the colony finishes building out, which is the flat point §7
// names. It is NOT retuned here and the figure carries no measurement, which is a deliberate
// omission rather than an oversight: the quantity it is aimed at — the instant a colony "finishes"
// building out — is a judgement about how a player spends Salvage, not a boundary the engine can
// report, so there is nothing for a headless run to measure. Giving a fuzzy target a precise-looking
// value would be worse than leaving §9.4's number where it is.
//
// WHAT WAS MEASURED IS ITS COST, which is the part that can go wrong silently. An eight-hour return
// on an untouched `lunar` board costs 29 advance() iterations and on an `aftermath` one 32, against
// balanceConfig.safetyCapIterations of 2,000 — a margin of ~60x. The churn is bounded by the three
// contracts that carry an offer deadline at all (below): a board of undeadlined offers simply sits,
// and the cooldown rule means a full board proposes no boundary whatsoever. See the full table in
// engine/contracts.js.
const OFFER_ROTATION_SECONDS = 300;

// A Makeup Game is the same contract at the same payout with a doubled offer window (§9.4). The
// doubling is the whole apology — the Office's line is "Same terms. Longer window. Weather is not
// counted against anybody" — and it is why a missed offer is a scheduling matter rather than a loss.
const MAKEUP_WINDOW_MULTIPLIER = 2;

// ---------------------------------------------------------------------------------------------
// WHICH THREE CONTRACTS CARRY AN OFFER DEADLINE, AND WHY IT IS ONLY THREE
//
// §9.4: "only three of the twelve contracts have one at all." §9 does not say which, so the choice
// is made here and argued rather than left to look arbitrary.
//
// A deadline is only honest on an offer whose VALUE is tied to a moment. The three that carry one
// are the two deliveries and the expedition — Bus Trip, Player To Be Named Later, Waiver Claim —
// because each is an errand somebody else is waiting on: provisions wanted at a site, a
// consideration owed against a transfer, salvage sitting in your vicinity that another organisation
// may also be looking at. Everything else on the board is a statement about how you run your own
// colony, and there is no coherent fiction in which "hold a positive power rate" expires.
//
// It is also the safe direction mechanically. A deadline is the only thing on this board that can
// take an opportunity away from a player who is asleep, and the three that carry one are precisely
// the three that a returning player can act on IMMEDIATELY — the stock is either in the silo or it
// is not. A lapsed sustain contract would be a punishment for being away during a stretch the
// player could not have shortened.
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// THE FIVE KINDS
//
// Named here rather than typed as string literals into engine/contracts.js, for the reason
// data/actSevenConfig.js names LIFE_SUPPORT_PHASE: a kind that appears in the engine and nowhere in
// the config is a kind whose behaviour cannot be found from the row that declares it.
//
//   state       reach a condition. No window, no accumulator. Claimable the moment it is true.
//   sustain     hold a rate for a duration. `progress` accumulates; a break resets it to 0.
//   delivery    hand over a lump. Debited atomically inside claim(), never at accept.
//   window      survive a timed window under a constraint. Breaking the constraint VOIDS it.
//   expedition  runs for a duration and draws upkeep the whole time.
//
// `rotating` is the twelfth contract's kind and is a wrapper rather than a shape: it resolves to one
// of the five above, re-seeded per offer. See ORGANIZATIONAL_DEPTH_TEMPLATES.
// ---------------------------------------------------------------------------------------------
const CONTRACT_KINDS = {
  state: 'state',
  sustain: 'sustain',
  delivery: 'delivery',
  window: 'window',
  expedition: 'expedition',
  rotating: 'rotating',
};

// PTBNL's band, as a multiplier on its own nominal rung rather than as a pair of absolutes.
// §9.5 quotes "450-900 Fuel, nominal 600" against §9.2's assumed 12,000 `deepSpace` threshold, and
// 600 is exactly 5% of 12,000 — so the band is [0.75, 1.5] of the small rung, and stating it that
// way is what lets ledger R3 move the threshold underneath it without anybody re-deriving 450.
const PTBNL_ROLL_BAND = [0.75, 1.5];

// ---------------------------------------------------------------------------------------------
// THE TWELVE
//
// Prose is the Office's, in the register §10.1 fixes: administrative, unhurried, and entirely
// uninterested in whether you succeed. `brief` is what the Office says; `terms` is the one-line
// objective the panel puts under it. Both live here because a string literal in a component is the
// same bug as a number literal in an engine.
//
// `objective` is read by exactly one dispatch in engine/contracts.js. The predicate NAMES live
// here so a reader of this row can find the behaviour; the predicate BODIES live in the engine
// because they are logic.
// ---------------------------------------------------------------------------------------------
const ACT_SEVEN_CONTRACTS = [
  // -------------------------------------------------------------------------------------------
  // `aftermath` — PAYS SALVAGE, BECAUSE THE FUEL TANK DOES NOT EXIST YET.
  //
  // This is the phase's one genuinely distinctive economic fact and §9.5 leans on it deliberately:
  // the board opens before the thing it is nominally for. Fuel's base capacity is 0 (data/
  // actSevenConfig.js) and stays 0 until the first tank is bought, so a Fuel payout in `aftermath`
  // would be refused by the overflow rule on every single claim — a board of three permanently
  // unclaimable rows, which is a worse first impression than no board at all.
  //
  // The Salvage figures are absolutes rather than percentages, and that is not an inconsistency
  // with the ladder above: there is no threshold to take a percentage OF. They are sized against
  // §5's `aftermath` income — MEASURED at 3-6 Salvage/sec for a colony that owns a few Reclaimer
  // Drones, so 90 is ~20-30 seconds of income and 140 is ~30-45. Small on purpose. These two rows
  // are onboarding paperwork whose job is to teach the board's verbs (accept, hold, claim) before
  // anything on it is worth arguing about.
  // -------------------------------------------------------------------------------------------
  {
    id: 'spring-invitation',
    name: 'Spring Invitation',
    phase: 'aftermath',
    kind: CONTRACT_KINDS.state,
    payoutPct: 0,
    payoutSalvage: 90,
    offerWindowSeconds: null,
    objective: { predicate: 'modulesOnline', target: 3 },
    brief:
      'You are invited to camp. Camp is the surface you are standing on. Bring three systems up '
      + 'and hold them up; the Office will consider that an arrival.',
    terms: 'Have any three modules online simultaneously.',
  },
  {
    id: 'backfield-work',
    name: 'Backfield Work',
    phase: 'aftermath',
    kind: CONTRACT_KINDS.sustain,
    payoutPct: 0,
    payoutSalvage: 140,
    offerWindowSeconds: null,
    // 180 seconds is §9.5's figure and it is the shortest hold in the act on purpose: it is the
    // row that teaches what `progress` means, and a first lesson that takes ten minutes is not a
    // lesson.
    objective: { predicate: 'netRate', resource: 'power', minimum: 0, exclusive: true, holdSeconds: 180 },
    brief:
      'Nobody watches the backfields. That is what they are for. Keep your power positive for '
      + 'three minutes and file the result. Nobody will comment on it. It will be read.',
    terms: 'Hold a positive net Power rate for 180 consecutive seconds.',
  },

  // -------------------------------------------------------------------------------------------
  // `lifeSupport` — the first phase with a tank, and therefore the first with a Fuel payout.
  // -------------------------------------------------------------------------------------------
  {
    id: 'bus-trip',
    name: 'Bus Trip',
    phase: 'lifeSupport',
    kind: CONTRACT_KINDS.delivery,
    payoutPct: PAYOUT_RUNGS.small,
    payoutSalvage: 0,
    // One of the three deadlines. 480s: long enough that a player who has a Ration Silo can simply
    // wait for the stock, short enough that it is a decision rather than a formality.
    offerWindowSeconds: 480,
    // 150 Provisions against a base capacity of 100 means this row is UNCLAIMABLE without a Ration
    // Silo (data/actSevenModulesConfig.js, +200, an `aftermath` module). That is deliberate and it
    // is the cleanest tradeoff on the board: 150 units is a real bite out of the buffer that keeps
    // §5's satisfaction factor at 1.0, so the payout costs a measurable dip in every other rate.
    // A player without the silo sees `refusal: 'stock'` and learns what the silo is for.
    objective: { predicate: 'deliverResource', resource: 'provisions', amount: 150 },
    brief:
      'Provisions are wanted at a site you have not been told about. Load 150 units. They will not '
      + 'be returned and you will not be told what they were for.',
    terms: 'Hand over 150 Provisions in one transfer.',
  },
  {
    id: 'innings-limit',
    name: 'Innings Limit',
    phase: 'lifeSupport',
    kind: CONTRACT_KINDS.window,
    payoutPct: PAYOUT_RUNGS.mid,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // DETECTION IS A STORED `clicker.totalClicks` COMPARED AT THE BOUNDARY, which is a counter that
    // already exists (state/initialState.js) — so no new bookkeeping and, crucially, NO REDUCER
    // HOOK. A contract that needed the click action to notify it would be a second writer of the
    // contract slice reachable from a dispatch, and this file's whole safety argument is that
    // advance() is the only thing that advances a contract.
    //
    // Reviewed against engine/clicker.js's anti-softlock guarantee and compatible with it: the
    // click is never GATED, the player merely declines it, and voiding costs nothing but a reissue.
    objective: { predicate: 'noManualClicks', windowSeconds: 600 },
    brief:
      'You are on a limit. For ten minutes, do not reach for it. Everything you have built will '
      + 'keep running without your hand on it — that was the entire point of building it. If you '
      + 'reach for it anyway the assignment is void and will be reissued. There is no other penalty.',
    terms: '600 seconds with no manual click.',
  },
  {
    id: 'rehab-assignment',
    name: 'Rehab Assignment',
    phase: 'lifeSupport',
    kind: CONTRACT_KINDS.window,
    payoutPct: PAYOUT_RUNGS.large,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // THE ONE STAGED OBJECTIVE, and the one instance field §9.3 did not anticipate. "Has the Oxygen
    // already been below 20%?" is not a fact about the present, so it cannot be recomputed from a
    // snapshot the way every other objective on this board can — which is the identical argument
    // §9.3 used to justify storing `progress`. The instance carries `stage`; see engine/contracts.js.
    objective: {
      predicate: 'stagedFraction',
      resource: 'oxygen',
      lowFraction: 0.2,
      highFraction: 0.9,
      windowSeconds: 300,
    },
    brief:
      'Take the scrubber off the field. Run it down past twenty percent, service it, and have it '
      + 'back above ninety inside five minutes. A system nobody has ever seen fail is a system '
      + 'nobody has ever seen recover, and we do not promote those.',
    terms: 'Take Oxygen below 20% of capacity, then back to 90% or above, within 300 seconds.',
  },

  // -------------------------------------------------------------------------------------------
  // `lunar` — the phase where a contract starts costing something while it runs.
  // -------------------------------------------------------------------------------------------
  {
    id: 'doubleheader',
    name: 'Doubleheader',
    phase: 'lunar',
    kind: CONTRACT_KINDS.sustain,
    payoutPct: PAYOUT_RUNGS.small,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // SEGMENTED, AND THE SEGMENTS ARE CONTRIBUTED TO nextContractEventClock(). `progress` is
    // seconds since the last reset and the segment is derived from it, so no extra field is stored
    // — but a single advance() step must never SPAN two segments, or the closed-form
    // "condition held at step start, therefore it held for the whole step" add stops being exact.
    // Registering the segment ends as event boundaries is what keeps it exact.
    //
    // 1.5 Fuel/sec is §9.5's figure. MEASURED against the shipped ladder: one Cracking Tower
    // (data/actSevenModulesConfig.js, `lunar`, 2.2 Fuel/s gross) clears it alone provided its 30
    // Power and 1.8 Provisions are actually being supplied — which is the point. The contract does
    // not measure the ceiling, it measures whether the ceiling is still there the second time.
    objective: {
      predicate: 'netRate',
      resource: 'fuel',
      minimum: 1.5,
      exclusive: false,
      segments: [
        { hold: true, seconds: 240 },
        { hold: false, seconds: 120 },
        { hold: true, seconds: 240 },
      ],
    },
    brief:
      'Two games, one day, one crew. Hold one and a half units of fuel per second for four '
      + 'minutes. Stand down for two. Hold it again. We are not measuring your ceiling. We are '
      + 'measuring whether your ceiling is there the second time.',
    terms: 'Hold net Fuel at 1.5/sec or better across two 240s windows, 120s apart.',
  },
  {
    id: 'rain-delay',
    name: 'Rain Delay',
    phase: 'lunar',
    kind: CONTRACT_KINDS.window,
    payoutPct: PAYOUT_RUNGS.mid,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    objective: { predicate: 'resourceFloor', resource: 'oxygen', fraction: 0.5, windowSeconds: 300 },
    brief:
      'The Office is going to take forty percent of your power away for five minutes. This is not '
      + 'a malfunction and you will not be told why. Keep the air above half. Every affiliate runs '
      + 'this drill. Most of them run it once.',
    terms: '300 seconds at 40% less Power. Keep Oxygen above 50% of capacity throughout.',
  },
  {
    id: 'waiver-claim',
    name: 'Waiver Claim',
    phase: 'lunar',
    kind: CONTRACT_KINDS.expedition,
    payoutPct: PAYOUT_RUNGS.large,
    // The act's only contract paying BOTH, and the two go through different doors: Fuel is not a
    // wallet currency and is credited through engine/colony.js's creditResource(), while Salvage is
    // an ordinary wallet currency and goes through engine/wallet.js's creditWallet(). One returned
    // object, two ledgers. Getting this backwards is the easiest mistake in this section.
    payoutSalvage: 200,
    // One of the three deadlines: somebody else's derelict is also in somebody else's vicinity.
    offerWindowSeconds: 600,
    objective: { predicate: 'elapsed', windowSeconds: 600 },
    brief:
      'Something was left in your vicinity by an organization that no longer files. It is yours if '
      + 'you go and get it. Your crew will be off the board for ten minutes and will draw power and '
      + 'provisions the entire time. Recall them whenever you like; a recalled claim is simply not '
      + 'a claim.',
    terms: 'Dispatch a crew for 600 seconds. Draws 3 Power/sec and 1 Provision/sec throughout.',
  },

  // -------------------------------------------------------------------------------------------
  // `deepSpace` — the three that are about how well you play rather than how much you have.
  // -------------------------------------------------------------------------------------------
  {
    id: 'ptbnl',
    name: 'Player To Be Named Later',
    phase: 'deepSpace',
    kind: CONTRACT_KINDS.delivery,
    payoutPct: PAYOUT_RUNGS.small,
    payoutSalvage: 0,
    // One of the three deadlines.
    offerWindowSeconds: 600,
    // THE MODULE'S ONE USE OF `rng`, drawn ONCE at accept and written onto the instance — so the
    // payout cannot be re-rolled by reloading and a headless run with an injected generator is
    // deterministic. The band is displayed on the board; the draw is not revealed until claim.
    //
    // 300 SALVAGE IS A WALLET DEBIT, not a colony one. Salvage IS an ordinary wallet currency and
    // goes out through engine/wallet.js; the Fuel that comes back does not.
    objective: { predicate: 'deliverCurrency', currency: 'salvage', amount: 300 },
    rollBand: PTBNL_ROLL_BAND,
    brief:
      'Three hundred salvage now. Consideration to follow. The consideration has been decided; it '
      + 'has not been written down where you can read it. This is a normal instrument and it is '
      + 'executed several thousand times a season.',
    terms: 'Hand over 300 Salvage. Consideration to follow, within the stated band.',
  },
  {
    id: 'pitch-count',
    name: 'Pitch Count',
    phase: 'deepSpace',
    kind: CONTRACT_KINDS.state,
    payoutPct: PAYOUT_RUNGS.mid,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // READS THE LAUNCH LOG'S `overshootRatio` DIRECTLY (engine/launch.js writes it onto every
    // record). §9.5 flagged this as needing "either a field on the launches[] log entry or a
    // predicate §7 exports"; STORY-028 shipped the field, so no new export and no second
    // definition of what "overfilled" means. A ratio of exactly 1.0 is the threshold met to the
    // unit, which counts — the margin is an upper bound, not a band with a floor.
    objective: { predicate: 'tightLaunch', maxOvershoot: 1.05 },
    brief:
      'Anyone can get there with a full tank. Get there with the tank nearly empty. Leave with '
      + 'less than five percent over the requirement and the Office will note that you know what '
      + 'the requirement was.',
    terms: 'Complete any launch having overfilled its threshold by less than 5%.',
  },
  {
    id: 'rule-five',
    name: 'Rule 5 Draft',
    phase: 'deepSpace',
    kind: CONTRACT_KINDS.state,
    payoutPct: PAYOUT_RUNGS.large,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // engine/puzzles.js's solvedUnaided() was written FOR this contract — its comment says so by
    // name. No second definition of "solved without buying a hint".
    //
    // OPTIONAL BY CONSTRUCTION (Decision 3.6): a player who never solves a puzzle forgoes 11% of
    // one threshold, which the baseline duration already assumes, because the baseline assumes
    // zero contracts.
    objective: { predicate: 'unaidedSolve' },
    brief:
      'There is an instrument in your possession that you have not understood and have not paid to '
      + 'have explained. Understand it. Unassisted. If you would rather buy the explanation, buy it '
      + '— this assignment will simply not be credited, and nothing else changes.',
    terms: 'Solve any one artifact without buying a hint for it.',
  },

  // -------------------------------------------------------------------------------------------
  // `majors` — endless.
  // -------------------------------------------------------------------------------------------
  {
    id: 'organizational-depth',
    name: 'Organizational Depth',
    phase: 'majors',
    kind: CONTRACT_KINDS.rotating,
    payoutPct: MAJORS_PAYOUT_PCT,
    payoutSalvage: 0,
    offerWindowSeconds: null,
    // THE ONLY ROW THAT SKIPS THE PAYOUT-ONCE LEDGER, and the act depends on it doing so. Every
    // other contract's id is written into `contractBoard.completedIds` when it is claimed and can
    // never be offered again — that ledger is what makes §9.2's per-launch ceiling an authored
    // constant. `majors` has no authored pool and no end, so writing this id into a payout-once
    // list would give the endless act exactly one assignment. It is never written there rather than
    // being filtered back out of it, so there is one rule and not two.
    repeatable: true,
    // No `objective` of its own: the objective is drawn from the templates below, seeded per offer,
    // and the drawn template id is stored on the instance. See ORGANIZATIONAL_DEPTH_TEMPLATES.
    brief:
      'The Office has no further assignments specific to you. It has a great many assignments. You '
      + 'will be given one at a time, indefinitely, for as long as you keep filing. Several of your '
      + 'colleagues have been doing this for a hundred and forty years and consider it a career.',
    terms: 'One assignment at a time, drawn from the standing list.',
  },
];

// The twelfth contract's rotating body. Each template is an `objective` plus the `kind` and `terms`
// that go with it, merged over the Organizational Depth row at offer time.
//
// DELIBERATELY REUSES THE SHAPES ABOVE RATHER THAN INVENTING NEW ONES. §9.5 calls it "one of the
// shapes above, re-seeded per offer" — the fiction is a filing clerk pulling the next standing
// assignment off a stack, not a designer authoring an endless act. Every template is also
// phase-agnostic: none of them names a module, a site or a resource ceiling that only exists at one
// rung, because `majors` has no upper bound and a template that stopped being satisfiable would
// silently make the endless board finite.
const ORGANIZATIONAL_DEPTH_TEMPLATES = [
  {
    id: 'depth-hold-power',
    kind: CONTRACT_KINDS.sustain,
    objective: { predicate: 'netRate', resource: 'power', minimum: 0, exclusive: true, holdSeconds: 300 },
    terms: 'Hold a positive net Power rate for 300 consecutive seconds.',
  },
  {
    id: 'depth-hold-fuel',
    kind: CONTRACT_KINDS.sustain,
    objective: { predicate: 'netRate', resource: 'fuel', minimum: 0, exclusive: true, holdSeconds: 300 },
    terms: 'Hold a positive net Fuel rate for 300 consecutive seconds.',
  },
  {
    id: 'depth-air',
    kind: CONTRACT_KINDS.window,
    objective: { predicate: 'resourceFloor', resource: 'oxygen', fraction: 0.5, windowSeconds: 300 },
    terms: 'Keep Oxygen above 50% of capacity for 300 seconds.',
  },
  {
    id: 'depth-limit',
    kind: CONTRACT_KINDS.window,
    objective: { predicate: 'noManualClicks', windowSeconds: 600 },
    terms: '600 seconds with no manual click.',
  },
  {
    id: 'depth-crew',
    kind: CONTRACT_KINDS.expedition,
    objective: { predicate: 'elapsed', windowSeconds: 600 },
    terms: 'Dispatch a crew for 600 seconds. Draws 3 Power/sec and 1 Provision/sec throughout.',
  },
];

// ---------------------------------------------------------------------------------------------
// THE DRAW TABLE — what an active contract costs while it runs (§9.5, ledger R5)
//
// A TABLE LOOKUP IN A DATA FILE, AND IT IS HERE RATHER THAN IN engine/contracts.js FOR A REASON
// THAT IS ARCHITECTURAL AND NOT STYLISTIC. engine/colony.js is what has to sum this — it is the
// slice's gatekeeper and the term belongs inside demandAtFullOutput(), before the solve — but
// engine/contracts.js needs expeditionSlice, colonyRates, spendResource and creditResource FROM
// colony.js. If colony.js required contracts.js back, CommonJS would hand whichever module loaded
// second a half-built exports object: invisible at require time, an undefined function on the first
// tick. colony.js already fought and documented exactly this, at length, over resolvedSites().
//
// So the table lives in config, the sum lives in colony.js, and engine/contracts.js re-exports the
// result so its published surface is the one §9.6 specifies. This is the same shape
// data/actSevenSitesConfig.js's padUpkeepAt() and data/actSevenLaunchConfig.js's
// transitSecondsFrom() already use: a lookup over authored rows is config, not logic.
//
// TWO KINDS OF DRAW, AND THE SECOND ONE IS A DELIBERATE DEVIATION FROM §9.5's WORDING.
//
//   flat          a constant per-second draw. Waiver Claim's crew: 3 Power, 1 Provision.
//   grossFraction a fraction of the colony's PRODUCTION AT FULL OUTPUT, added to demand.
//
// §9.5 words Rain Delay as "the contract suppresses Power production by 40%". Implemented literally
// that is a multiplier on `grossProduction()`, which is inside the fixed-point solve — a second
// hook into the file the whole act's correctness rests on, for one contract in one phase.
//
// Expressed as a DEMAND term computed from gross-at-full-output it needs no change to the solve at
// all: gross-at-full-output depends only on owned modules, sites and modifiers, all of which are
// constant within a step, so `demand` stays constant across the solve exactly as it must and the
// monotonicity argument in solveSatisfaction() is untouched. It also enters through the SAME term
// Waiver Claim does, so colony.js grows one hook and not two.
//
// A FLAT NUMBER WAS THE OBVIOUS ALTERNATIVE AND IT IS WRONG IN AN INSTRUCTIVE DIRECTION. Sized
// against the reference colony below it would be ~74 Power/sec, which CRUSHES a colony that has
// just entered `lunar` and is FREE for one about to leave it — the exact inverse of what §9.5
// wants, which is a drill that scales with the affiliate running it.
//
// MEASURED (driven under `node`, harness in /tmp, not committed — there is no test runner in this
// repo and adding one is its own change). Reference mid-`lunar` colony: 4 RTG, 9 Solar Wing,
// 4 Fission Pile, 6 Cascade Scrubber, 2 Ice Harvester, 6 Hydroponics Bay, 2 Algae Column,
// 4 Electrolysis Stack, 1 Cracking Tower, 8 Reclaimer Drone, storage, On-Deck colonized:
//
//   idle              gross.power 186.0   demand.power 180.0   net.power  +38.7   satisfaction 1.00
//   Rain Delay active gross.power 186.0   demand.power 254.4   net.power  -35.7
//
// and the trace of a 300-second run, sampled every 20s: the Power buffer empties inside the first
// 20 seconds, then the resource sits PINNED at 0 with satisfaction 0.73 for the whole window and
// recovers to 1.00 the instant it closes. That is Decision 3.3 working exactly as written — the
// colony is throttled, not broken: no module is removed, nothing is destroyed, and every rate
// returns to where it was. This reference colony holds Oxygen at 100% throughout and therefore
// PASSES the drill, which is the intended reading of "every affiliate runs this drill; most of them
// run it once" — the contract is a check on whether the Oxygen buffer was built, not a tax.
// -------------------------------------------------------------------------------------------
const CONTRACT_DRAW = {
  // §9.5's figures verbatim. Flat rather than proportional because it is a CREW, not a tariff:
  // three people and a truck cost the same wherever they are sent from, and the contract's whole
  // fiction is that they are off the board.
  'waiver-claim': { flat: { power: 3, provisions: 1 } },
  // The drill. See the long note above for why this is a fraction and not a constant.
  'rain-delay': { grossFraction: { power: 0.4 } },
  // The rotating majors template that reuses Waiver Claim's shape draws the same crew.
  'depth-crew': { flat: { power: 3, provisions: 1 } },
};

// ---------------------------------------------------------------------------------------------
// THE BOARD'S BASE SHAPE — ONE LITERAL, TWO READERS
//
// state/initialState.js's createInitialState() and engine/colony.js's expeditionSlice() must
// produce the identical shape, and this is the file that owns it. data/actSevenConfig.js's header
// states the rule and engine/concessions.js records the failure it prevents in full: a shop spreads
// the accessor's return value when it writes the slice back, so a key ONE copy forgets is a key
// EVERY LATER WRITE SILENTLY DELETES.
//
// A FACTORY AND NOT A FROZEN LITERAL, because the two arrays inside it are mutable. A shared
// constant would give a brand new game and a defaulted old save the same `completedIds` array
// object, and a single stray push would write one player's ledger into another's slice.
//
//   nextOfferAtClock  0 means "a refresh may happen now", which is the correct state for a fresh
//                     board. It is a LEGITIMATE STORED VALUE, so the accessor defaults it with
//                     Number.isFinite and never with `|| OFFER_ROTATION_SECONDS` — see the
//                     normalizeResource() note in engine/colony.js for what `||` does to a rate.
//   completedIds      the payout-once ledger. An id here can never be offered or paid again.
//   missedIds         lapsed and voided offers, eligible to return as Makeup Games.
// ---------------------------------------------------------------------------------------------
function createContractBoard() {
  return { nextOfferAtClock: 0, completedIds: [], missedIds: [] };
}

function getContractDefinition(contractId) {
  return ACT_SEVEN_CONTRACTS.find((contract) => contract.id === contractId) || null;
}

function getOrganizationalDepthTemplate(templateId) {
  return ORGANIZATIONAL_DEPTH_TEMPLATES.find((template) => template.id === templateId) || null;
}

// The draw a single active instance costs, or null. Keyed by the instance's OBJECTIVE source — the
// config id for the eleven authored contracts, the template id for a rotating one — so
// Organizational Depth's crew template draws the same crew Waiver Claim does without either row
// restating the numbers.
function contractDrawFor(sourceId) {
  return CONTRACT_DRAW[sourceId] || null;
}

// ---------------------------------------------------------------------------------------------
// PLAYER-FACING COPY THAT IS NOT ATTACHED TO A ROW
//
// The refusal lines, the wrapper, and the small phrases the panel needs. Here rather than in the
// component for the same reason everything else in this file is: a string literal in
// src/components/ is the same bug as a number literal in src/engine/.
// ---------------------------------------------------------------------------------------------
const contractCopy = {
  // §9.4's wrapper, which is not an authored objective — it is what a missed offer comes back as.
  makeupName: (originalName) => `Makeup Game: ${originalName}`,
  makeupBrief: (originalName) =>
    `Rescheduled: ${originalName}. Same terms. Longer window. Weather is not counted against `
    + 'anybody.',

  // §9.6's refusal vocabulary. Each is a sentence rather than a code, because the panel renders it
  // verbatim and a player reading "slots" learns nothing.
  refusal: {
    slots: 'Two assignments are already open. The Office does not issue a third.',
    stock: 'You do not have the goods on hand. The assignment will wait.',
    tank: 'The payout will not fit in the tank. Launch, or build storage, and it will be here.',
    active: 'Already accepted.',
    done: 'Already filed. The Office credits an assignment once.',
  },

  // The effect line, authored here the way engine/concessions.js authors its describe() output.
  effect: (fuel, salvage) => {
    const parts = [];
    if (fuel > 0) parts.push(`+${Math.round(fuel)} Fuel`);
    if (salvage > 0) parts.push(`+${Math.round(salvage)} Salvage`);
    return parts.length ? parts.join(' and ') : 'No consideration recorded.';
  },
  // PTBNL's band is shown, the draw is not — §9.5 is explicit that "the band is displayed on the
  // board; the draw is not revealed until claim."
  effectBand: (low, high) => `+${Math.round(low)}-${Math.round(high)} Fuel, consideration to follow`,

  // Progress labels. Time is formatted here and never in the panel.
  heldLabel: (heldSeconds, targetSeconds) =>
    `${formatClock(heldSeconds)} of ${formatClock(targetSeconds)} held`,
  standDownLabel: (remainingSeconds) => `standing down — ${formatClock(remainingSeconds)}`,
  remainingLabel: (remainingSeconds) => `${formatClock(remainingSeconds)} remaining`,
  stageLabel: (done, total) => `stage ${done} of ${total}`,
  // Clamped to the requirement, so a player holding 500 of a 150 delivery reads "150 of 150" rather
  // than "500 of 150" — the row is reporting progress toward a target, not an inventory.
  deliveryLabel: (held, amount, unit) =>
    `${Math.floor(Math.min(held, amount))} of ${amount} ${unit} on hand`,
  readyLabel: 'Complete. File it.',
  openLabel: 'Not yet met.',

  boardEmpty: 'No assignments outstanding. The Office will be in touch.',
  panelIntro:
    'Assignment issued. Terms below. Completion is credited against your transit requisition. '
    + 'Non-completion is not a mark against you; it is a scheduling matter.',

  // -------------------------------------------------------------------------------------------
  // THE PANEL'S OWN FURNITURE (STORY-040)
  //
  // Added HERE rather than in a new data/actSevenContractsPanelConfig.js, which is a deliberate
  // divergence from what Sites and Launch did. Those two split their panel copy out because their
  // engine configs carry hundreds of lines of measurement record, and a copy tweak had no business
  // landing in the file that holds the act's tuning. This file carries no such record — and the
  // block above already holds `boardEmpty`, `panelIntro`, the five refusal sentences and every
  // progress label, under a header stating in as many words that it holds "the small phrases the
  // panel needs". STORY-030 put panel prose here by design; a second file would be a second
  // authority for contract words.
  // -------------------------------------------------------------------------------------------

  // Duplicated from the `contracts` row in data/actSevenPanels.js for the reason every other Act VII
  // panel's copy states: that list is the TAB BAR's source, and a panel reaching into the tab
  // registry for its own <h2> would couple the two so that renaming a tab retitles a screen.
  title: 'Contracts',
  subtitle: 'Organisational paperwork, paid in Fuel.',

  // THE SENTENCE THIS WHOLE PANEL IS BUILT AROUND, and it is the reason the tab is last in the bar.
  // §6.4 makes `contracts` the only purely OPTIONAL tab in the act: a player who never opens it
  // still finishes, slowly, which is Decision 3.6 applied to the fuel economy. That is a design
  // constraint on the SCREEN and not a footnote — a board that read as a chore list would convert
  // an opportunity into an obligation, and would make every player who ignores it feel behind.
  //
  // Said at the top, once, in the Office's flat voice: this is work you may take, not work you owe.
  optionalNote: 'Nothing on this board is required. Every one of them is a shortcut, and the run finishes without any of them.',

  // The two-slot ceiling, stated where a player meets it rather than only in the refusal. §9.4:
  // three offers on the board, two open at a time. Knowing the cap in advance is what makes the
  // choice between two offers a choice; meeting it only as a refusal reads as a bug.
  // Takes the cap rather than spelling it, so a retune of MAX_ACTIVE_CONTRACTS moves the sentence
  // with it and cannot leave the screen promising two while the engine enforces three.
  slotsNote: (max) => max + ' open at a time. One more than that is refused until one is filed or dropped.',

  // The three states, as words. A FUNCTION rather than a map because the reading is ordered and the
  // `id` rides along so the stylesheet can key on it without the component mapping words to class
  // names — data/actSevenSitesPanelConfig.js's statusFor() is the pattern.
  //
  // "Offered" and not "Available": the Office issues assignments, it does not advertise them.
  statusFor: (row) => {
    if (row.status === 'claimable') return { id: 'claimable', label: 'Complete' };
    if (row.status === 'active') return { id: 'active', label: 'Accepted' };
    return { id: 'offered', label: 'Offered' };
  },

  // WHETHER A ROW GETS A BAR, and it is a rules question rather than a styling one, which is why it
  // is answered here and not by a conditional in JSX. progressFor() says it in its own comment: a
  // `state` contract "is a condition, not a quantity. It has no bar; it has an answer." Drawing a
  // half-full bar for "have any three modules online" would invent a middle where the engine has
  // none — the answer is yes or no, and the label says which.
  showsBar: (row) => row.kind !== 'state',

  // An offer's deadline. Null for the ones that have none, and the panel omits the line rather than
  // printing "no deadline" — an absent deadline is not a fact the player needs, it is the default.
  //
  // ACCEPTING DISCHARGES IT. §9.4: "An accepted contract never expires. It has no deadline to miss;
  // it has a window it is inside." engine/contracts.js sets `expiresInSeconds` to null the moment a
  // row goes active, so this line cannot survive acceptance and no guard here is needed.
  expiresLabel: (seconds) => 'Offer closes in ' + formatClock(seconds),

  // §9.4's rescheduled offer. A BADGE rather than a sentence, because `makeupBrief` above already
  // says the whole of it in the row's own prose and a second paragraph would be the same fact twice.
  makeupBadge: 'Rescheduled',

  // The three controls. "File it" rather than "Claim" because that is the Office's word for it and
  // `readyLabel` above already uses it — two verbs for one action on one row would read as two
  // different actions.
  acceptLabel: 'Accept',
  claimLabel: 'File it',
  abandonLabel: 'Drop',

  // Shown under an abandonable row. §9.4 makes dropping free and this says so, because a player who
  // suspects a penalty will hoard a slot on an assignment they cannot finish — which is the one way
  // this board can actually cost somebody something.
  abandonNote: 'Dropping costs nothing. The slot comes back.',
};

// m:ss, and it lives here rather than in the panel because it is the only place a duration becomes
// a string. Guards a non-finite input into '0:00' rather than 'NaN:aN' — these numbers come off a
// save file by way of a clock difference, and the one thing a corrupt save must not produce is a
// row that looks broken.
function formatClock(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

module.exports = {
  ACT_SEVEN_CONTRACTS,
  ORGANIZATIONAL_DEPTH_TEMPLATES,
  CONTRACT_KINDS,
  PAYOUT_RUNGS,
  PAYOUT_CEILING_PCT,
  MAJORS_PAYOUT_PCT,
  PTBNL_ROLL_BAND,
  BOARD_SLOTS,
  MAX_ACTIVE_CONTRACTS,
  OFFER_ROTATION_SECONDS,
  MAKEUP_WINDOW_MULTIPLIER,
  createContractBoard,
  getContractDefinition,
  getOrganizationalDepthTemplate,
  contractDrawFor,
  contractCopy,
  formatClock,
};
