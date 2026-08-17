// Act VII's ending — the majors standings board, Earth's placement, and the endless standing
// orders. PRD §7.8 and §14 item 6.
//
// This is the last screen of the game and it is a LEAGUE TABLE, which is pillar 4 (reuse before
// invention) and pillar 5 (the mapping pays out) collecting at the same time. The player learned
// this component in Act III, in a six-game little league season behind a hardware store. It is the
// same component. Earth is one row.
//
// ---------------------------------------------------------------------------------------------
// WHAT IS AUTHORED HERE AND WHAT IS NOT
//
//   authored here    the nine other farm systems and their records
//                    every weight, threshold and budget in the placement formula
//                    the standing-order ladder's prices and growth
//                    every player-facing string the board emits
//
//   NOT here         the arithmetic. engine/board.js multiplies; this file says by what. Data files
//                    in this codebase carry lookups and at most a derivation that exists to stop a
//                    number being typed twice — they do not carry the rules.
//
//   NOT here         anything about the baseball league. The board mints rows in the SHAPE of
//                    `season.standings` so that one table component renders both, and it reads
//                    `state.season` never. See the note on that shape below; it is the sharpest
//                    hazard in this file.
// ---------------------------------------------------------------------------------------------

const { formatNumber } = require('../utils/formatNumber');

// The Warning Track's Fuel tank, imported rather than restated, because the standing orders' Fuel
// price is capped against it and a cap that drifted from the tank it is a fraction of would either
// stop being payable or stop being felt. Same argument data/actSevenLaunchConfig.js makes for
// importing OVERSHOOT_TANK_MULT rather than typing 1.6 a second time.
const { getSiteDefinition, siteFuelCapacity } = require('./actSevenSitesConfig');

// ---------------------------------------------------------------------------------------------
// THE BOARD
// ---------------------------------------------------------------------------------------------

// A full season, in the sense every North American sport means it. 162 rather than Act III's six,
// and the jump is the point: the little league played six games behind a hardware store and this
// is the schedule the affiliates keep. It is also what makes the placement formula legible — a
// budget of "22 wins for pace" is a sentence a player can read off the breakdown, where a budget of
// "0.136 of the schedule" is not.
const BOARD_GAMES = 162;

// EARTH'S ROW ID. Not a `teamId` and deliberately not PLAYER_TEAM_ID from engine/schedule.js: this
// row is not a baseball team, it is a farm system, and the highlight prop that renders it as `me`
// takes an id rather than reaching for the league's constant. That separation is what keeps AC #6
// structural — the board cannot accidentally read or write season state, because it does not know
// any of season state's identifiers.
const EARTH_ROW_ID = 'earth';

// Earth's name on the board. The Office does not call it Earth in a standings table any more than a
// baseball standings table says "the city of Baltimore" — it prints the affiliate.
const EARTH_ROW_NAME = 'Earth';

// ---------------------------------------------------------------------------------------------
// THE OTHER FARM SYSTEMS (§7.8)
//
// "The other rows are other farm systems, each with the game *they* were taught — a species that
// learned the same control problem through something with a net, something with a track, something
// with no ball at all."
//
// THAT SENTENCE IS THE ENTIRE BRIEF AND IT IS A JOKE WITH A STRAIGHT FACE. Every one of these is a
// civilisation that got told the same lie the player got told in Act I — that the thing they were
// doing was a game — and every one of them built an interstellar logistics network out of it. The
// Office runs a scouting pipeline across nine of them and files the results in a table. Nobody in
// the fiction finds this remarkable, which is the only register in which it lands.
//
// RECORDS ARE AUTHORED, NOT GENERATED, and there is no rng anywhere in this file or its engine. A
// board whose rivals rolled each session would make the same run finish 3rd and then 6th, which is
// the exact failure §7.8's "deterministic, computed from the run" is written against — and it would
// do it at the one moment the game is telling the player what their run was worth.
//
// THE SPREAD IS TUNED SO THAT A PERFECT RUN LANDS SECOND. The placement budgets below total 137.6
// wins at their maxima, against The Fold's 141. That is deliberate and it is what makes AC #5's
// endless ladder mean something: the top of the board is reachable only by the post-game, so
// `majors` has somewhere to go rather than being a screen you read once. A player who does
// everything right in the act arrives as the best rookie in the league and still has to play the
// season. Run differentials carry the same convention throughout — roughly six runs a game, with
// authored variation so the tiebreak column reads like a table somebody kept rather than a
// multiplication.
const RIVAL_SYSTEMS = [
  {
    id: 'theFold',
    name: 'The Fold',
    note: 'No ball. A membrane, and the problem of putting a crease in exactly the right place from exactly this far away.',
    wins: 141,
    losses: 21,
    runsFor: 902,
    runsAgainst: 214,
  },
  {
    id: 'seventeenBells',
    name: 'Seventeen Bells',
    note: 'A ladder of tuned resonators. You are out when you can no longer hear the one you are aiming at.',
    wins: 128,
    losses: 34,
    runsFor: 811,
    runsAgainst: 297,
  },
  {
    id: 'longTrack',
    name: 'The Long Track',
    note: 'Something with a track. Two hundred kilometres of it, and the whole sport is the handover.',
    wins: 119,
    losses: 43,
    runsFor: 744,
    runsAgainst: 351,
  },
  {
    id: 'netAndCounterNet',
    name: 'Net and Counter-Net',
    note: 'Something with a net. Then somebody brought a second net, and it has been that way for nine thousand years.',
    wins: 110,
    losses: 52,
    runsFor: 690,
    runsAgainst: 408,
  },
  {
    id: 'quietGarden',
    name: 'The Quiet Garden',
    note: 'The whole match is played in the interval between two agreed instants. Spectators are told the result.',
    wins: 98,
    losses: 64,
    runsFor: 615,
    runsAgainst: 470,
  },
  {
    id: 'threeRivers',
    name: 'Three Rivers Confluence',
    note: 'Water, and where you put the stone, and how long the ring survives the current. Scored downstream.',
    wins: 84,
    losses: 78,
    runsFor: 533,
    runsAgainst: 511,
  },
  {
    id: 'hollowDrum',
    name: 'The Hollow Drum',
    note: 'A hoop, a drop, and a single permitted touch. They are certain it is the simplest game anyone plays.',
    wins: 71,
    losses: 91,
    runsFor: 449,
    runsAgainst: 588,
  },
  {
    id: 'saltFlats',
    name: 'Salt Flats Extension',
    note: 'Distance only. No target, no opponent, no net. You throw, and then everyone walks out to it together.',
    wins: 57,
    losses: 105,
    runsFor: 362,
    runsAgainst: 671,
  },
  {
    id: 'lastLight',
    name: 'Last Light',
    note: 'Played once per lifetime, by one member of each household. The Office finds them very hard to schedule.',
    wins: 43,
    losses: 119,
    runsFor: 281,
    runsAgainst: 749,
  },
];

// ---------------------------------------------------------------------------------------------
// THE PLACEMENT FORMULA (§7.8: "deterministic, computed from the run... No dice.")
//
// EVERY NUMBER BELOW IS A BUDGET OF WINS, and expressing them that way rather than as abstract
// points is what lets the board keep §7.8's second promise — "the board tells them which line they
// earned." A breakdown row that reads "Puzzles solved unaided · 7 of 9 · +16.8 wins" is an account
// of the run. A breakdown row that reads "aptitude score 0.78" is a number the player is asked to
// take on faith at the moment the game is summing them up.
//
// WHY DETERMINISM IS STRUCTURAL HERE AND NOT A PREFERENCE. engine/launch.js takes no `rng` at all
// and argues the case at length: an outcome resolved inside advance() is resolved during offline
// catch-up, in front of nobody. This formula has the stronger version of the same requirement — it
// is not resolved at a moment at all. It is a pure function of the save, recomputed on every render
// of the board, so a player who reloads must see the identical table or the ending is a lie. There
// is no seed to store because there is nothing to seed.
//
// THE BUDGETS, AND WHY THEY ARE THE SIZES THEY ARE:
//
//   base                40.0   A floor, not a participation trophy. A run that finishes has crossed
//                              90 AU; the board is a table of interstellar logistics networks and
//                              Earth is in it. 40-122 is a bad season, not an absence.
//   pace                22.0   §12's own ceiling as the full-credit mark. Time is the axis the act
//                              is most often criticised on and the one a good player most visibly
//                              controls.
//   puzzles             21.6   9 artifacts x 2.4 for an unaided solve. The largest single budget,
//                              because §8's whole thesis is that the panel has never had a manual.
//   contracts           18.0   12 rows x 1.5. Sized BELOW puzzles on purpose: §9's board is the
//                              act's one optional system (Decision 3.6) and a player who ignores it
//                              entirely must still be able to finish respectably.
//   fuel rate           20.0   How well the network was actually built, which is the act's central
//                              engineering problem and has no other representation on this screen.
//   overshoot           16.0   The five commit-time decisions, which is the only budget the player
//                              cannot grind — you either held for the margin or you went.
//                             ------
//   maximum            137.6   Against The Fold's 141. See the note on the rival spread above.
//
// THE ONE INPUT THAT IS NOT CAPPED IS THE POST-GAME LADDER, and that is AC #5 wired into the board
// rather than sitting beside it: standing orders are what carry Earth the last four wins, and after
// the win column saturates they keep moving the run differential, which is the tiebreak column and
// therefore still the thing the table is sorted on. The tail always has a number going up.
// ---------------------------------------------------------------------------------------------

const BASE_WINS = 40;

// PACE. Full credit at or under §12 criterion 8's five-hour ceiling, nothing at or over fifteen
// hours, linear between.
//
// THE FLOOR IS THE CEILING, WHICH IS THE POINT. §12 asks that the act be completable in five hours;
// a player who does that has met the design's own target and is paid the whole budget for it. The
// 900-minute zero is not a second opinion about how long the act takes — it is where the curve has
// to end, and it is set well past any measured run so that a slow player loses the budget gradually
// instead of falling off a cliff they cannot see.
//
// A RUN WITH NO RECORDED START SCORES ZERO AND IS LABELLED, NOT GUESSED. The zero is
// `progression.actEnteredAtClock`, and a save whose copy is missing or corrupt has no honest
// elapsed time — inventing a plausible one would be the only number on this screen that was not
// computed from the run.
const PACE_FULL_CREDIT_MINUTES = 300;
const PACE_NO_CREDIT_MINUTES = 900;
const PACE_WINS = 22;

// PUZZLES (§8). Three tiers, and the gaps between them are §8's design restated as arithmetic.
//
// An unaided solve is worth twice a hinted one, because the hint ladder is a real cost paid in
// Salvage and the player already paid it — charging them a second time on the board would be
// double jeopardy. A bypass is worth an eighth, not nothing, and that is Decision 3.6 showing up in
// the scoring: OPERATE MANUALLY is a legitimate route past every artifact and a board that scored
// it at zero would retroactively call it a failure. An unresolved artifact scores nothing, because
// it is the one outcome where the player simply did not engage.
const PUZZLE_UNAIDED_WINS = 2.4;
const PUZZLE_HINTED_WINS = 1.2;
const PUZZLE_BYPASSED_WINS = 0.3;

// CONTRACTS (§9). Per row on the payout-once ledger, capped so that the repeatable rows cannot
// farm the board — `completedIds` excludes them by design (engine/contracts.js), and the cap is the
// belt to that braces.
const CONTRACT_WINS = 1.5;
const CONTRACT_WINS_CAP = 18;

// PEAK NET FUEL RATE. Zero credit at half the reference and full credit at 1.5x it.
//
// THE REFERENCE IS MEASURED, NOT CHOSEN. 28.0 Fuel/s is what STORY-031 measured as the net rate of
// the minimum portfolio that sustains the network with The Swing built, at satisfaction 1.000 on
// all four resources — the figure recorded in the VERIFIED block at the foot of
// data/actSevenLaunchConfig.js, and the figure L5's 42,000 threshold was held against. So the
// midpoint of this curve is "you built exactly enough", the floor is "you got here on half of
// that", and the ceiling is "you built half again more than the act required".
const FUEL_RATE_REFERENCE = 28;
const FUEL_RATE_NO_CREDIT = 14;
const FUEL_RATE_FULL_CREDIT = 42;
const FUEL_RATE_WINS = 20;

// OVERSHOOT. The mean ratio across every burn the run committed, mapped from the floor of the band
// to its ceiling.
//
// BOTH ENDPOINTS ARE IMPORTED FACTS RATHER THAN TUNING. 1.0 is OVERSHOOT_FLOOR — a burn that leaves
// on exactly its threshold — and 1.6 is OVERSHOOT_TANK_MULT, the most a launch tank can hold and
// therefore the most any burn can possibly overshoot by. So this curve spans exactly the decision
// §7.3 offers and cannot be scored outside it. They are restated as literals here ONLY because they
// are the ends of a scale and not a price; the arithmetic in engine/board.js clamps to [0, 1]
// regardless, so a retune of the band cannot push this out of range.
const OVERSHOOT_NO_CREDIT = 1.0;
const OVERSHOOT_FULL_CREDIT = 1.6;
const OVERSHOOT_WINS = 16;

// STANDING ORDERS, on the board rather than in the shop: what each filled order is worth in the
// win column, and what it is worth in the run differential after the win column saturates.
//
// HALF A WIN EACH IS DELIBERATELY SLOW. A perfect run needs eight orders to pass The Fold, and a
// mediocre one needs a hundred and ninety. That is the idle tail doing its job — the board is not
// a thing you finish, it is a thing you climb — and it is why the run-differential term exists: at
// 162 wins the pct column stops moving and the sort falls through to run diff, which never stops.
const STANDING_ORDER_WINS = 0.5;
const STANDING_ORDER_RUNS = 14;

// Earth's run differential, derived from its record. Six runs a game either way, matching the
// convention the rival rows are authored on, so the column is coherent across all ten rows rather
// than being one real table with a computed row bolted into it.
const RUNS_PER_GAME = 6;

// ---------------------------------------------------------------------------------------------
// THE STANDING ORDERS (§7.8: "an endless ladder of scaling long contracts consumes Salvage and
// Fuel to move Earth up the board")
//
// A REPEATABLE PURCHASE AND NOT A TIMED BUILD, which is the single most consequential decision in
// this file. §7.8 calls them "long contracts", and building them as timed rows would mean a new
// `readyAtClock`, a new EVENT_CLOCK_CONTRIBUTORS entry, a new resolver in the tick loop, and the
// whole idempotence burden that engine/sites.js's resolveBuilds() and engine/launch.js's
// resolveArrivals() each carry a page of comment about — all of it for a post-game sink whose
// entire design content is "it costs more each time". A purchase has none of that: it happens on a
// dispatch, in front of the player, and an eight-hour offline return cannot advance it by a single
// order. The fiction survives intact; the order is long, and the LADDER is the wait.
//
// TWO CURRENCIES, AND THEY ARE NOT THE SAME KIND OF THING. Salvage is an ordinary wallet currency
// and is debited through engine/wallet.js. Fuel is NOT — it lives in `expedition.resources` with a
// capacity and a signed net rate, and is spent through engine/colony.js's spendResource(). This is
// the easiest mistake in the act and engine/contracts.js declares both names side by side for the
// same reason.
//
// THE FUEL PRICE IS CAPPED AND THE SALVAGE PRICE IS NOT, and that asymmetry is a correctness
// requirement rather than a balance choice. Salvage has no ceiling, so a geometric Salvage price is
// always eventually payable and the ladder stays endless. FUEL HAS A CEILING — the sum of every
// reached site's tank — so a geometric Fuel price crosses it and the ladder becomes permanently
// unbuyable at a level nobody planned, which is a soft-lock on the only content in `majors`. Capped
// at half the Warning Track's own tank, the Fuel cost is a recurring drain the player feels forever
// and can always fill for.
const STANDING_ORDER_ID = 'standingOrder';

const STANDING_ORDER_BASE_SALVAGE = 1200000;
const STANDING_ORDER_SALVAGE_GROWTH = 1.18;

const STANDING_ORDER_BASE_FUEL = 8000;
const STANDING_ORDER_FUEL_GROWTH = 1.09;
const STANDING_ORDER_FUEL_CAP_FRACTION = 0.5;

// Derived from the Warning Track's tank so the cap cannot drift from the thing it is a fraction of.
// The Track is the top rung and its 67,200 is the largest single tank in the act, so half of it is
// a price a player standing anywhere on the finished ladder can meet from stock.
const STANDING_ORDER_FUEL_CAP = Math.round(
  siteFuelCapacity(getSiteDefinition('thirdBase')) * STANDING_ORDER_FUEL_CAP_FRACTION
);

// The ladder's names, cycled. Every one of them is a piece of ordinary organisational paperwork
// that happens to move a planet, which is §10.1's voice doing the last thing it will ever do.
//
// CYCLED RATHER THAN EXHAUSTED, because the ladder is endless and a list that ran out would leave
// the last name repeating forever with nothing to distinguish the hundredth order from the ninth.
// The cycle number is appended after the first pass, which is exactly how a real filing system
// would do it.
const STANDING_ORDER_NAMES = [
  'Standing Order — Bulk Consumables, Outbound',
  'Standing Order — Crew Rotation, Indefinite',
  'Standing Order — Cold Storage, Extended Term',
  'Standing Order — Route Survey, Recurring',
  'Standing Order — Affiliate Support, Open-Ended',
  'Standing Order — Deep Logistics, No Termination Date',
];

// ---------------------------------------------------------------------------------------------
// PROSE (conventions.md: a string literal in a component or an engine is the same bug as a number)
//
// Written as functions wherever a measured number is in the sentence, matching
// data/actSevenLaunchConfig.js's launchCopy, so no sentence is assembled half here and half in a
// panel.
//
// VOICE: the Office, flat and unimpressed, filing the largest thing that has ever happened to this
// species as a roster move. §10.1. It does not congratulate the player and it never says "you won."
// It prints the standings, because that is what it does with standings.
// ---------------------------------------------------------------------------------------------

// The line the run earned, by finishing rank. Read top-down, first match wins.
//
// THESE ARE THE "WHICH LINE THEY EARNED" OF §7.8, and they are placement lines rather than praise:
// each one describes what the Office does next about Earth, which is the only currency this
// narrator deals in. Ten rows, five bands — a band per two or three placements, because a line that
// changed at every rank would have to be ten variations on one sentence and none of them would mean
// anything.
const PLACEMENT_LINES = [
  {
    maxRank: 1,
    line: 'Top of the table. The Office has stopped describing Earth as a farm system in internal correspondence and has not announced that it has stopped.',
  },
  {
    maxRank: 3,
    line: 'Top three. There is a note in the file recommending that the next scout sent out be a good one, which is not a thing the file usually says.',
  },
  {
    maxRank: 6,
    line: 'Mid-table, first season. The Office considers this an entirely normal result for an affiliate that did not exist eighteen months ago and files it without comment.',
  },
  {
    maxRank: 9,
    line: 'Bottom third. The schedule for next season arrives anyway, on time, addressed to the club by name.',
  },
  {
    // The backstop. `maxRank` past the table's length so no run can fall through the list — a board
    // that printed nothing at the bottom would be the one placement the game had no words for.
    maxRank: 99,
    line: 'Last. Every system above this line took between four hundred and nine thousand years to get here. You are on the board.',
  },
];

const boardCopy = {
  // The panel's furniture.
  title: 'Standings',
  subtitle: 'Farm systems, current season. The Office publishes these weekly and has done for some time.',

  // Above the table. Deliberately the same register as the little league's "First place takes the
  // title" caption in components/league/StandingsPanel.js — it is the same table, and the caption
  // is where the player is told what the table is for.
  seasonLine: (games) => games + '-game schedule · Placement is fixed by the record of your run',

  // The column heading that differs from the league's. Everything else — #, W, L, Pct, Run Diff —
  // is identical, which is the whole point of §7.8's last sentence.
  teamHeading: 'Farm system',

  // The breakdown table.
  breakdownTitle: 'How Earth finished where it finished',
  breakdownNote: 'Every line below was computed from your run. Nothing on this screen was rolled.',
  breakdownWins: (wins) => (wins > 0 ? '+' : '') + (Math.round(wins * 10) / 10) + ' W',

  // One per placement input. The label names the input, the detail states what the run actually
  // did, and engine/board.js pairs each with its win contribution.
  inputs: {
    base: {
      label: 'Reached the majors',
      detail: () => 'You committed the fifth burn.',
    },
    pace: {
      label: 'Elapsed time in the act',
      detail: (minutes) => (
        minutes === null
          ? 'Not recorded — this run crossed into the act before the clock was kept.'
          : formatNumber(Math.round(minutes)) + ' minutes, against a ' + PACE_FULL_CREDIT_MINUTES + '-minute par.'
      ),
    },
    puzzles: {
      label: 'Artifacts',
      detail: (summary) => (
        summary.unaided + ' solved unaided, '
        + (summary.solved - summary.unaided) + ' with hints, '
        + summary.bypassed + ' operated manually, '
        + summary.unresolved + ' left open.'
      ),
    },
    contracts: {
      label: 'Contracts completed',
      detail: (count) => count + ' filed and paid.',
    },
    fuelRate: {
      label: 'Peak network Fuel',
      detail: (rate) => (
        formatNumber(Math.round(rate * 10) / 10) + '/s at its best, against a ' + FUEL_RATE_REFERENCE + '/s reference.'
      ),
    },
    overshoot: {
      label: 'Overshoot across the burns',
      detail: (mean, burns) => (
        burns === 0
          ? 'No burns on record.'
          : (Math.round(mean * 100) / 100) + 'x mean across ' + burns + ' ' + (burns === 1 ? 'burn' : 'burns') + '.'
      ),
    },
    standingOrders: {
      label: 'Standing orders filled',
      detail: (count) => (
        count === 0
          ? 'None yet. The board is not finished with you.'
          : count + ' filled since arrival.'
      ),
    },
  },

  // The standing-order shop.
  ordersTitle: 'Standing orders',
  ordersNote: 'The season does not end. Neither does the paperwork, and each one costs more than the last.',
  orderEffect: (wins, runs) => (
    '+' + wins + ' W and +' + runs + ' run differential on the board, permanently'
  ),
  // The row's price, which is TWO currencies and says so. The shop contract's `cost`/`currency`
  // pair only carries one, so the second is a field of its own and the panel renders both — see
  // the note on `fuelCost` in engine/board.js.
  orderPrice: (salvage, fuel) => formatNumber(salvage) + ' Salvage + ' + formatNumber(fuel) + ' Fuel',
  orderUnaffordable: (salvage, fuel, heldSalvage, heldFuel) => {
    const missing = [];
    if (heldSalvage < salvage) missing.push(formatNumber(salvage - heldSalvage) + ' Salvage');
    if (heldFuel < fuel) missing.push(formatNumber(fuel - heldFuel) + ' Fuel');
    return missing.length === 0 ? '' : 'Short ' + missing.join(' and ') + '.';
  },
};

// The name of the order at a given level (0-based). Cycles, with the pass number appended after the
// first — see the note on STANDING_ORDER_NAMES.
function standingOrderName(level) {
  const index = level % STANDING_ORDER_NAMES.length;
  const cycle = Math.floor(level / STANDING_ORDER_NAMES.length);
  const name = STANDING_ORDER_NAMES[index];
  return cycle === 0 ? name : name + ' (' + (cycle + 1) + ')';
}

// The line a finishing rank earns. Ranks are 1-based, matching what the table prints in its `#`
// column, so nothing has to translate between the two.
function placementLineFor(rank) {
  const row = PLACEMENT_LINES.find((entry) => rank <= entry.maxRank);
  // The list ends on maxRank 99 so this cannot fire, and it returns the last line rather than ''
  // if it somehow does: an ending with no words is worse than an ending with the wrong ones.
  return row ? row.line : PLACEMENT_LINES[PLACEMENT_LINES.length - 1].line;
}

module.exports = {
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
  FUEL_RATE_REFERENCE,
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
};
