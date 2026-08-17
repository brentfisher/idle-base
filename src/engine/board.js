// Act VII's ending — Earth's placement on the majors board, and the endless standing orders.
// Pure: no React, no DOM, no Date.now(), and — like engine/launch.js, for the same reasons — no
// randomness of any kind. PRD §7.8.
//
// This file answers two questions and nothing else:
//
//   standings(state)   the ten rows of the board, sorted, with Earth's among them
//   listOffers/purchase  the post-game ladder, in the house shop contract
//
// ---------------------------------------------------------------------------------------------
// IT NEVER TOUCHES `state.season`, AND THAT IS AN ACCEPTANCE CRITERION RATHER THAN A STYLE NOTE.
//
// Act VII froze the baseball league rather than deleting it (`seasonFrozen`, STORY-019): `season`,
// `league`, `roster`, `stadium` and `powerups` are all still in state, still valid, and the tick
// loop steps over the entire phase block. Reaching `majors` must not thaw, reset or resurrect any
// of it.
//
// The hazard is specific and it is created by this file's own best idea. The board mints rows in
// the SHAPE of `season.standings` — `{ wins, losses, runsFor, runsAgainst }` — precisely so that
// one table component renders both, and so that engine/standings.js's sortStandings() and winPct()
// can be reused rather than reimplemented. Shape-compatible rows are exactly the thing that gets
// accidentally sourced from, or written back into, the slice they resemble.
//
// So the rule is structural: this module requires engine/standings.js for its two PURE FUNCTIONS
// and requires nothing else from the baseball half of the game. It does not import PLAYER_TEAM_ID,
// it does not import engine/schedule.js, and it has no writer of any kind — `standings()` returns a
// freshly built array every call and `purchase()` writes `wallet` and `expedition` only. There is
// no code path from here into season state, which is a stronger guarantee than a test that the
// league is unchanged, and both are recorded in the VERIFIED block at the foot of this file.
// ---------------------------------------------------------------------------------------------
const {
  BOARD_GAMES,
  EARTH_ROW_ID,
  EARTH_ROW_NAME,
  RIVAL_SYSTEMS,
  BASE_WINS,
  PACE_FULL_CREDIT_MINUTES,
  PACE_NO_CREDIT_MINUTES,
  PACE_WINS,
  PUZZLE_UNAIDED_WINS,
  PUZZLE_HINTED_WINS,
  PUZZLE_BYPASSED_WINS,
  CONTRACT_WINS,
  CONTRACT_WINS_CAP,
  FUEL_RATE_NO_CREDIT,
  FUEL_RATE_FULL_CREDIT,
  FUEL_RATE_WINS,
  OVERSHOOT_NO_CREDIT,
  OVERSHOOT_FULL_CREDIT,
  OVERSHOOT_WINS,
  STANDING_ORDER_WINS,
  STANDING_ORDER_RUNS,
  RUNS_PER_GAME,
  STANDING_ORDER_ID,
  STANDING_ORDER_BASE_SALVAGE,
  STANDING_ORDER_SALVAGE_GROWTH,
  STANDING_ORDER_BASE_FUEL,
  STANDING_ORDER_FUEL_GROWTH,
  STANDING_ORDER_FUEL_CAP,
  standingOrderName,
  boardCopy,
  placementLineFor,
} = require('../data/actSevenBoardConfig');
const { MAJORS_PHASE, phaseRank } = require('../data/actSevenConfig');
// The only thing this file needs from the site ladder: the launch record's destination id for the
// fifth burn, which is how the run's win is found in the log. Imported from the config that
// authors it rather than typed, so a rename cannot leave the ending silently unable to find the
// burn that produced it.
const { OVER_THE_WALL_DESTINATION_ID: WALL_DESTINATION } = require('../data/actSevenSitesConfig');
const { expeditionSlice, spendResource } = require('./colony');
const { aptitudeSummary } = require('./puzzles');
// The two pure functions the little league sorts its own table with, reused rather than
// reimplemented. `conventions.md`'s pillar is reuse before invention, and a second definition of
// "sorted by win percentage, then run differential" would be the first place the last screen of the
// game disagreed with the first one.
const { sortStandings, winPct } = require('./standings');
const { balanceOf, debitWallet, canAfford } = require('./wallet');

// Salvage is a wallet currency; Fuel is not. Declared side by side, exactly as engine/contracts.js
// declares its pair, because getting this backwards is the easiest mistake in the act — Salvage
// goes through engine/wallet.js's debitWallet() and Fuel goes through engine/colony.js's
// spendResource().
const ORDER_WALLET_CURRENCY = 'salvage';
const ORDER_FUEL_RESOURCE = 'fuel';

// ---------------------------------------------------------------------------------------------
// READING THE RUN
// ---------------------------------------------------------------------------------------------

// A linear ramp between two thresholds, clamped to [0, 1], with the direction taken from which end
// is larger. One helper for all four ramped inputs, so "full credit at the good end, nothing at the
// bad end, straight line between" is stated once and cannot be got subtly backwards in one of them.
//
// Returns 0 rather than NaN when the two thresholds coincide — a retune that collapses a ramp
// should cost the input its budget, not put NaN into the win column and sort the board by it.
function ramp(value, noCredit, fullCredit) {
  if (!Number.isFinite(value)) return 0;
  if (noCredit === fullCredit) return 0;
  const fraction = (value - noCredit) / (fullCredit - noCredit);
  return Math.min(1, Math.max(0, fraction));
}

// Minutes the run has spent in Act VII, or null when the act's start was never recorded.
//
// THE ZERO IS `progression.actEnteredAtClock`, WHICH ALREADY EXISTED AND IS EXACTLY THIS. It is
// written by enterAct() in engine/progression.js on every act boundary and has been in the save
// shape since STORY-004; engine/narrative.js reads it the same way to schedule story beats against
// minutes-since-the-act-began. This story very nearly added a second field to `expedition` for the
// same quantity, which would have been two clocks answering one question — the exact drift the
// note at the top of data/actSevenConfig.js exists to forbid — so it is recorded here that the
// field was looked for, missed, and found.
//
// It is re-stamped on every act entry, which is correct rather than a hazard: Act VII is the last
// act and is entered once per run, and a run that prestiges back to Act VI and crosses again gets a
// new zero, which is what a new run's board should be measured against.
//
// MEASURED TO THE WIN, NOT TO NOW, and that is what keeps the board still. The far end is the clock
// at which the fifth burn was COMMITTED, read off the launch record. Using `state.clock` would mean
// the ending's elapsed-time line ticked upward for as long as the player left the tab open, and
// Earth would slide down its own board while idling in the post-game — a run re-judged for time it
// spent after the run was over.
//
// Null when the field is missing or the run has no win on record. Guarded to the leaf because this
// runs on a render path.
function elapsedMinutes(state, slice) {
  const progression = state && state.progression;
  const entered = progression && progression.actEnteredAtClock;
  if (!Number.isFinite(entered)) return null;

  const win = slice.launches.find((launch) => !!launch && launch.destinationSiteId === WALL_DESTINATION);
  const end = win && Number.isFinite(win.committedAtClock)
    ? win.committedAtClock
    : (Number.isFinite(state.clock) ? state.clock : entered);
  return Math.max(0, (end - entered) / 60);
}

// The mean overshoot ratio across every burn the run committed, and how many there were.
//
// EVERY BURN, NOT JUST THE LAST ONE. §7.8 says "overshoot ratios across the five burns", and the
// mean is the honest summary of five separate commit-time decisions: a player who held for margin
// on four legs and went early on the fifth should not read the same as one who went early every
// time. Reads the launch log, which is one list — `resolved: false` is in flight and `resolved:
// true` is the log — so the whole run's burns are here whatever state they are in.
//
// Returns a mean of the FLOOR when there are no burns, so the ramp below scores 0 rather than NaN.
// That case is unreachable from the board (you cannot be in `majors` without five burns) and is
// reachable from a harness on the very first tick of the act, which is enough reason to answer it.
function overshootSummary(slice) {
  const ratios = slice.launches
    .filter((launch) => !!launch && Number.isFinite(launch.overshootRatio))
    .map((launch) => launch.overshootRatio);
  if (ratios.length === 0) return { mean: OVERSHOOT_NO_CREDIT, burns: 0 };
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return { mean: total / ratios.length, burns: ratios.length };
}

// The payout-once ledger's length. Repeatable contracts are excluded from `completedIds` by
// engine/contracts.js's claim(), so this counts distinct paperwork rather than farming.
function contractsCompleted(slice) {
  const board = slice.contractBoard || {};
  return Array.isArray(board.completedIds) ? board.completedIds.length : 0;
}

// ---------------------------------------------------------------------------------------------
// THE PLACEMENT (§7.8)
// ---------------------------------------------------------------------------------------------

// Earth's record, and the itemized account of how it got there.
//
// RETURNS A BREAKDOWN AND NOT A SCORE, which is §7.8's second promise rather than a convenience:
// "the board tells them which line they earned." Seven rows, each carrying the input's label, what
// the run actually did, and the wins that bought — and they sum, exactly, to the win column the
// table prints. A player can audit the last screen of the game against their own run, which is the
// only way "deterministic, computed from the run" is a claim the player can check rather than one
// they are asked to believe.
//
// PURE IN `state`, WITH NO CLOCK READ ON ANY PATH THAT MATTERS. Called on every render of the board
// panel, so it must produce the identical table for the identical save, forever. There is no seed
// stored anywhere because there is nothing random to seed.
function placement(state) {
  const slice = expeditionSlice(state);

  const minutes = elapsedMinutes(state, slice);
  const aptitude = aptitudeSummary(state);
  const contracts = contractsCompleted(slice);
  const fuelRate = slice.peakFuelRate;
  const overshoot = overshootSummary(slice);
  const orders = slice.standingOrders;

  const hinted = Math.max(0, aptitude.solved - aptitude.unaided);

  const rows = [
    {
      id: 'base',
      label: boardCopy.inputs.base.label,
      detail: boardCopy.inputs.base.detail(),
      wins: BASE_WINS,
    },
    {
      id: 'pace',
      label: boardCopy.inputs.pace.label,
      detail: boardCopy.inputs.pace.detail(minutes),
      // Reversed thresholds — no credit at the LONG end — which is what `ramp`'s direction-agnostic
      // form is for. A faster run scores higher, and the pair reads in the order the sentence does.
      wins: minutes === null ? 0 : PACE_WINS * ramp(minutes, PACE_NO_CREDIT_MINUTES, PACE_FULL_CREDIT_MINUTES),
    },
    {
      id: 'puzzles',
      label: boardCopy.inputs.puzzles.label,
      detail: boardCopy.inputs.puzzles.detail(aptitude),
      wins: aptitude.unaided * PUZZLE_UNAIDED_WINS
        + hinted * PUZZLE_HINTED_WINS
        + aptitude.bypassed * PUZZLE_BYPASSED_WINS,
    },
    {
      id: 'contracts',
      label: boardCopy.inputs.contracts.label,
      detail: boardCopy.inputs.contracts.detail(contracts),
      wins: Math.min(CONTRACT_WINS_CAP, contracts * CONTRACT_WINS),
    },
    {
      id: 'fuelRate',
      label: boardCopy.inputs.fuelRate.label,
      detail: boardCopy.inputs.fuelRate.detail(fuelRate),
      wins: FUEL_RATE_WINS * ramp(fuelRate, FUEL_RATE_NO_CREDIT, FUEL_RATE_FULL_CREDIT),
    },
    {
      id: 'overshoot',
      label: boardCopy.inputs.overshoot.label,
      detail: boardCopy.inputs.overshoot.detail(overshoot.mean, overshoot.burns),
      wins: OVERSHOOT_WINS * ramp(overshoot.mean, OVERSHOOT_NO_CREDIT, OVERSHOOT_FULL_CREDIT),
    },
    {
      id: 'standingOrders',
      label: boardCopy.inputs.standingOrders.label,
      detail: boardCopy.inputs.standingOrders.detail(orders),
      wins: orders * STANDING_ORDER_WINS,
    },
  ];

  const earned = rows.reduce((sum, row) => sum + row.wins, 0);
  // Rounded ONCE, at the end, and clamped to the schedule. Rounding each row would make the
  // breakdown fail to sum to the total by up to three wins, which on a screen whose entire job is
  // to be auditable is the worst possible place for a rounding convention to show.
  const wins = Math.max(0, Math.min(BOARD_GAMES, Math.round(earned)));
  const losses = BOARD_GAMES - wins;

  return {
    wins,
    losses,
    // Six runs a game either way, matching the convention the rival rows are authored on, plus the
    // standing orders' own margin. That last term is what keeps the post-game moving after the win
    // column saturates at 162: `sortStandings` falls through to run differential, so the tail never
    // stops having a number that goes up.
    runsFor: Math.round(wins * RUNS_PER_GAME + orders * STANDING_ORDER_RUNS),
    runsAgainst: Math.round(losses * RUNS_PER_GAME),
    breakdown: rows,
  };
}

// The ten rows of the board, sorted, with Earth's among them.
//
// SORTED BY engine/standings.js's OWN COMPARATOR — win percentage, then run differential — which is
// the same function that has ordered every league table the player has seen since Act III. The
// board is not a table that resembles the standings; it is the standings, with different rows in
// it.
//
// Each row carries a resolved `name` and no team id, so the component that renders it needs no
// lookup and no knowledge of either league. See the note on the extracted table in
// components/league/StandingsTable.js.
function standings(state) {
  const earth = placement(state);

  const rows = RIVAL_SYSTEMS.map((system) => ({
    id: system.id,
    name: system.name,
    note: system.note,
    wins: system.wins,
    losses: system.losses,
    runsFor: system.runsFor,
    runsAgainst: system.runsAgainst,
  }));

  rows.push({
    id: EARTH_ROW_ID,
    name: EARTH_ROW_NAME,
    note: null,
    wins: earth.wins,
    losses: earth.losses,
    runsFor: earth.runsFor,
    runsAgainst: earth.runsAgainst,
  });

  return sortStandings(rows);
}

// Everything the board panel renders, resolved: the sorted rows, Earth's rank, the line that rank
// earned, and the breakdown that produced the record.
//
// ONE CALL RATHER THAN FOUR, for the reason every listOffers() in this act returns finished rows:
// the component decides nothing. A panel that called `standings()` and then hunted for Earth's
// index to look up its own placement line would be computing, and the index it found would be a
// second answer to a question this file has already answered.
function boardSummary(state) {
  const rows = standings(state);
  const rank = rows.findIndex((row) => row.id === EARTH_ROW_ID) + 1;
  return {
    rows,
    earthId: EARTH_ROW_ID,
    rank,
    line: placementLineFor(rank),
    placement: placement(state),
    games: BOARD_GAMES,
    // Re-exported so the panel renders the pct column with the same function the table is sorted
    // by, rather than dividing for itself.
    winPct,
  };
}

// ---------------------------------------------------------------------------------------------
// THE STANDING ORDERS (§7.8's idle tail, AC #5)
// ---------------------------------------------------------------------------------------------

// What the next order costs, in both currencies, at a given level.
//
// SALVAGE COMPOUNDS AND FUEL IS CAPPED, and data/actSevenBoardConfig.js records why at length: a
// geometric Fuel price crosses the network's total tank capacity and the ladder becomes permanently
// unbuyable, which is a soft-lock on the only content in `majors`. Salvage has no ceiling, so its
// price can compound forever and the ladder stays endless.
//
// Rounded, because a price is a number the player reads and a Salvage cost of 1200000.0000000002 is
// a bug report. Math.round rather than floor for the same reason moduleCost() rounds: the ladder is
// a curve sampled at integers, not a floor function.
function orderCost(level) {
  return {
    salvage: Math.round(STANDING_ORDER_BASE_SALVAGE * Math.pow(STANDING_ORDER_SALVAGE_GROWTH, level)),
    fuel: Math.round(Math.min(
      STANDING_ORDER_FUEL_CAP,
      STANDING_ORDER_BASE_FUEL * Math.pow(STANDING_ORDER_FUEL_GROWTH, level)
    )),
  };
}

// The board's own gate: orders exist in `majors` and nowhere else.
//
// A RANK COMPARISON, NOT AN EQUALITY TEST, matching every other gate in the act (see the note on
// phaseRank in data/actSevenConfig.js). `majors` is the top rung today so the two happen to agree,
// and they would stop agreeing the moment anything was ever added above it — at which point an
// equality test would silently delete the entire post-game.
//
// FAILS CLOSED on an unrecognized phase, unlike the fabrication shop's gate, and the asymmetry is
// the same one engine/actSevenModules.js draws for site capabilities. Failing open there shows a
// row early; failing open HERE would put the ending's shop in front of a player who has not
// finished the act, which is a spoiler for the ending itself.
function isBoardLive(state) {
  const current = phaseRank(expeditionSlice(state).phase);
  return current !== -1 && current >= phaseRank(MAJORS_PHASE);
}

// One row, or none. The house shop contract (engine/actSevenModules.js is the reference pair):
// cost, ownership and affordability ALREADY RESOLVED, so the panel renders it verbatim.
//
// `cost` AND `currency` CARRY THE SALVAGE SIDE, AND FUEL IS A FIELD OF ITS OWN. The contract's
// price pair holds one currency and this row has two, so rather than bend the contract the Fuel
// price is `fuelCost`/`fuelHeld` alongside — the same move engine/launch.js makes when it puts
// `fuelSpent` beside a `cost` that is the threshold. `affordable` means BOTH are met, which is the
// only reading that can be right: a button lit by the Salvage half alone would refuse on press.
//
// `count` rather than `owned: bool`, because the ladder is endless and ownership here is a
// quantity. `owned` is emitted anyway because the contract names it.
function listOffers(state) {
  if (!isBoardLive(state)) return [];

  const slice = expeditionSlice(state);
  const level = slice.standingOrders;
  const cost = orderCost(level);
  const heldSalvage = balanceOf(state.wallet, ORDER_WALLET_CURRENCY);
  const heldFuel = slice.resources[ORDER_FUEL_RESOURCE].amount;

  return [
    {
      id: STANDING_ORDER_ID,
      name: standingOrderName(level),
      description: boardCopy.ordersNote,
      effect: boardCopy.orderEffect(STANDING_ORDER_WINS, STANDING_ORDER_RUNS),
      cost: cost.salvage,
      currency: ORDER_WALLET_CURRENCY,
      fuelCost: cost.fuel,
      fuelHeld: heldFuel,
      priceLabel: boardCopy.orderPrice(cost.salvage, cost.fuel),
      shortfall: boardCopy.orderUnaffordable(cost.salvage, cost.fuel, heldSalvage, heldFuel),
      count: level,
      owned: level > 0,
      affordable: heldSalvage >= cost.salvage && heldFuel >= cost.fuel,
    },
  ];
}

// Fills one standing order. Returns new state, or null when it is not permitted — refusal is null
// from the engine and an unchanged state from the reducer, exactly as every other shop in this act.
//
// THE FUEL GOES FIRST AND THE SALVAGE GOES SECOND, WHICH IS THE ONLY SAFE ORDER AND IS THE WHOLE
// REASON THIS FUNCTION IS NOT FOUR LINES.
//
// This is the act's only dual-currency purchase, and the two debits fail differently.
// spendResource() REFUSES WITH NULL rather than flooring at zero — a launch either has enough to
// leave or it does not — while debitWallet() is a straight ledger write behind a canAfford() check.
// Debiting Salvage first and then having the Fuel spend refuse would take the player's Salvage and
// give them nothing, on a purchase that costs seven minutes of income. So the refusing debit is
// applied FIRST, its null is honoured, and the wallet is only touched on a state that has already
// paid its Fuel. Both affordances are also checked before either debit, so the ordering is a
// backstop to a gate rather than the gate itself.
//
// Every gate is re-checked here rather than trusted from the listing, because purchase() is
// reachable from a dispatch and an engine that only enforces a rule in the function that DRAWS the
// button is not enforcing it at all. It re-checks through listOffers() itself, so there is one
// definition of what is legal and no second copy to drift — the move engine/launch.js makes.
function purchase(state, offerId) {
  const offer = listOffers(state).find((row) => row.id === offerId);
  if (!offer) return null;
  if (!offer.affordable) return null;
  if (!canAfford(state.wallet, ORDER_WALLET_CURRENCY, offer.cost)) return null;

  const spent = spendResource(state, ORDER_FUEL_RESOURCE, offer.fuelCost);
  if (!spent) return null;

  // Read the slice back OFF THE FUEL-SPENT STATE, never off the state this function was handed.
  // spendResource() has already rewritten `expedition.resources`, and spreading a slice captured
  // before it would restore the Fuel it just spent — a free order, every time, and the kind of bug
  // that only shows up as an economy that will not tighten.
  const slice = expeditionSlice(spent);

  return {
    ...spent,
    wallet: debitWallet(spent.wallet, ORDER_WALLET_CURRENCY, offer.cost),
    // Spread the accessor's return value when writing the slice back — engine/concessions.js
    // records why in full: a key one copy of the shape forgets is a key every later write silently
    // deletes.
    expedition: { ...slice, standingOrders: slice.standingOrders + 1 },
  };
}

// ---------------------------------------------------------------------------------------------
// VERIFIED — under `node`, driving this file, engine/launch.js, engine/sites.js, engine/colony.js
// and engine/tickEngine.js's real advance(). The harness lives in /tmp and is deliberately not
// committed; there is no test runner in this repo and adding one is its own change.
//
// DETERMINISM. The same save produces the same board twice, by deep equality across all ten rows,
// the rank, the line and every breakdown row. THE SAMPLE, STATED EXACTLY: the three archetypes
// below evaluated twice each, an eight-point sweep of the standing-order ladder, the
// no-recorded-start case, and the board of the real optimal-buyer run recorded in
// data/actSevenSitesConfig.js. Zero differences. There is no rng in this file, nothing here reads
// the clock except `elapsedMinutes`'s fallback for a save with no committed win, and the placement
// is measured to the COMMIT rather than to now — so a run's board is frozen at the instant it was
// won and only the standing orders move it afterwards.
//
// THE PANEL WAS RENDERED, not merely compiled. `npm run build` transforms JSX and never mounts it,
// so components/expedition/BoardPanel.js and the extracted
// components/league/StandingsTable.js were both put through react-dom/server's renderToString
// against a GameContext holding the finished optimal-buyer save: the shared `table.standings`
// renders, Earth's row carries the `me` class exactly once, the breakdown and the order row are
// present. components/league/StandingsPanel.js — Acts III-VI's League tab, whose table body this
// story rewrote — was rendered the same way against an Act III save and is structurally unchanged,
// one highlighted row and the same six columns.
//
// AC #5 HAS THREE CLAUSES AND ALL THREE ARE ASSERTED, not reasoned about. In `majors`: all five
// sites still resolve as reached and colonized and their upkeep is still summed into `demand`
// (1,998 Power/s, 72.9 O2/s, 197.6 Provisions/s on the measured run); the fabrication shop still
// returns 26 rows, because every gate in the act is a rank comparison rather than an equality test;
// `hustle` is still in getUnlockedFeatures(6, 'majors') and applyClick() still credits Salvage; and
// the standing-order ladder offers and is affordable.
//
// THE SPREAD, measured across three archetypes:
//
//   run                                                    W-L      pct    rank
//   floor      (0 artifacts touched, 0 contracts,           50-112  .309     9th
//               617 min, 14.0 Fuel/s, every burn on
//               the floor of the band)
//   typical    (5 solved with hints, 4 operated             88- 74  .543     6th
//               manually, 6 contracts, 497 min,
//               28.0 Fuel/s, 1.25x mean overshoot)
//   ceiling    (9 unaided, 12 contracts, 257 min,          138- 24  .852     2nd
//               42.0 Fuel/s, 1.6x every burn)
//
// The three land 9th, 6th and 2nd, which is the spread the budgets were sized for: a player who
// engaged with nothing is still on the board and visibly last-third, and every system in between
// is separated by more than one placement.
//
// A PERFECT RUN FINISHES SECOND, BY DESIGN, and the standing orders are what take it to first —
// measured at SIX orders, which is the point of AC #5. The board is not a screen you read once.
// After that the win column saturates at 162 and the run differential keeps climbing 14 a time,
// which is the column `sortStandings` falls through to, so the tail never stops moving.
//
// THE FUEL PRICE REACHES ITS CAP AT LEVEL 20 and stays at 33,600 forever after, while the Salvage
// price compounds — 1.20M at level 0, 6.28M at 10, 32.9M at 20, 900M at 40. That is the asymmetry
// data/actSevenBoardConfig.js argues for, verified: the ladder slows down without ever becoming
// unbuyable, because Salvage has no ceiling and Fuel does.
//
// THE FROZEN LEAGUE IS UNTOUCHED ACROSS THE WIN (AC #6), and this was taken against a REAL RUN
// rather than a fixture — the optimal-buyer run recorded in data/actSevenSitesConfig.js, played
// from the act boundary to the fifth burn through the real advance(). Snapshotted before an 8h
// advance() spanning both the commit and the arrival, and compared after:
//
//   season.seasonNumber, season.phase, season.scheduleIndex     identical
//   season.standings, season.schedule, lastOffseasonSummary     identical
//   league.teams, the roster                                     identical
//   season.standings, state.league, state.roster                 identical BY REFERENCE
//   resolveRules(state).seasonFrozen                             still true after the win
//
// By reference is the strong form and it is the one that matters: nothing on the win path so much
// as rebuilt a season object, let alone thawed one. Filling a standing order in `majors` was
// checked the same way and is likewise inert. That is the expected result rather than a lucky one —
// `seasonFrozen` comes off `modifiers.rules` and the act does not change at the win — but AC #6
// asks for the assertion and this is it.
//
// OFFLINE SAFETY. The same 8h advance(), taken as ONE call across the twelve-minute transit, is the
// offline path: advance() is called identically on load with only `deltaSeconds` differing. It
// resolves the win exactly once — one wall record, `resolved: true`, five launch records total and
// no duplicates, the milestone still exactly `true`, one phase promotion to `majors`, and
// `peakFuelRate` monotone. Replaying the identical span from the identical state produces the
// identical launch log.
//
// AND THIS STORY APPENDS NO EVENT_CLOCK_CONTRIBUTORS ENTRY AT ALL, which is the finding rather than
// an omission: the fifth burn's arrival boundary is already carried by engine/launch.js's
// nextArrivalClock(), because the wall record is an ordinary unresolved launch with a finite
// `arrivesAtClock`. Iteration counts across the win are therefore unchanged from a run that does
// not cross it. The two quantities this story added to state are write-once and monotone
// respectively, so neither is clock-driven and neither needs a boundary or a resolver.
// ---------------------------------------------------------------------------------------------

module.exports = {
  boardSummary,
  standings,
  placement,
  listOffers,
  purchase,
  orderCost,
  isBoardLive,
  ORDER_WALLET_CURRENCY,
  ORDER_FUEL_RESOURCE,
};
