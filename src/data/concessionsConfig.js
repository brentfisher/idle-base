// Act III's shop, which Act IV keeps (unlocks are cumulative — see data/acts.js). It began as
// two kinds of thing, because Act III had two separate dead ends. It is now five, because the
// first two ran out: see the STAND_UPGRADES and per-click ladder notes further down for why a
// shop that finishes halfway through the act it serves is a shop with a hole in it.
//
// STANDS are the cash faucet. Before this, cash income in Act III was exactly zero —
// engine/income.js's ticketing contributor is gated on `state.stadium`, which does not exist
// until Act V — so a player arrived with the 500 they started the game with, bought one stat
// upgrade at 223-736, and was finished. Stands are rates, like data/collectorTiers.js, so
// advance() integrates them across an offline return in a single iteration.
//
// BOOSTERS buy reputation, which before this did nothing whatsoever in Act III: its only
// consumer was attendanceFraction(), which also needs a stadium. Reputation now feeds
// strengthMult through engine/modifiers.js, so a booster is the one thing a player can buy
// that makes the team on the field actually better.
//
// Together they are the act's loop: hustle or sell for cash, spend cash on reputation, win
// more games. Stat upgrades remain the third sink and are deliberately the least efficient —
// one upgrade moves team strength by ~0.06.

// Rates are scaled to the act, not to intuition: Act III runs ~12 minutes for a player who
// ignores the shop, so a stand that pays for itself in five minutes is a stand nobody ever
// buys. At these rates the first lemonade table returns its 120 in a minute, and the full
// shop is reachable inside the act — which is the only way spending can be the lever that
// makes the act shorter.
//
// Repeatable up to `maxCount`, priced per copy with `costGrowth` applied per copy owned.
const CONCESSION_STANDS = [
  {
    id: 'lemonade',
    name: 'Lemonade Table',
    description: 'A card table, a hand-lettered sign, and your sister making change.',
    cost: 120,
    costGrowth: 1.6,
    cashPerSecond: 2,
    maxCount: 3,
  },
  {
    id: 'sunflowerSeeds',
    name: 'Seed Bucket',
    description: 'Sold by the cupful to a dugout that goes through nine cups a game.',
    cost: 400,
    costGrowth: 1.6,
    cashPerSecond: 8,
    maxCount: 3,
  },
  {
    id: 'snowCone',
    name: 'Snow Cone Cart',
    description: 'Borrowed from the church picnic. Nobody has asked for it back yet.',
    cost: 1400,
    costGrowth: 1.6,
    cashPerSecond: 25,
    maxCount: 3,
  },
];

// Bought once each. `reputation` is added straight to state.reputation, which is a permanent
// team-strength bonus (balanceConfig.reputationStrengthPerPoint).
const BOOSTERS = [
  {
    id: 'uniforms',
    name: 'Matching Uniforms',
    description: 'Nine shirts the same colour. It should not matter as much as it does.',
    cost: 350,
    reputation: 12,
  },
  {
    id: 'banner',
    name: 'Outfield Banner',
    description: "Painted by somebody's mother across two bedsheets. Visible from the road.",
    cost: 900,
    reputation: 18,
  },
  {
    id: 'teamPhoto',
    name: 'Team Photo in the Window',
    description: 'The hardware store puts it up front, by the register, where everyone lines up.',
    cost: 2200,
    reputation: 25,
  },
];

// ---------------------------------------------------------------------------
// Raising the passive rate without buying another table
// ---------------------------------------------------------------------------
// STAND_UPGRADES multiply what every owned stand pays. They exist because the stands run out:
// three copies each of three stands is 105 cash/sec and then the passive half of this shop is
// finished, in an act (III) that can still have minutes left and an act (IV) that runs 20-31.
// A player who liked building the stand had nothing further to build.
//
// `rateBonus` is ADDITIVE among themselves and MULTIPLICATIVE against the stands, so the
// ceiling is a single stated number rather than an emergent one: 1 + 0.20 + 0.25 + 0.30 =
// 1.75x, and a fully bought stand line pays 105 * 1.75 = 183.75 cash/sec. That number is the
// design, not a side effect — see the sizing argument below.
//
// WHY 1.75 AND NOT MORE. Act IV's own faucet, the sponsor board, is 295 cash/sec base and
// ~410 once reputation has scaled it (data/actFourConfig.js). Holding the concessions ceiling
// at 184 keeps Act III's faucet plainly the smaller one — about 31% of a fully built Act IV
// economy — so signing sponsors is still the thing that changes the act. At 2.5x or 3x the
// stands would match the sponsor board, and a 41,500-cash board that buys what a 16,800-cash
// upgrade line already gave you is a board nobody signs.
//
// WHY THEY ARE THE WORST CASH-PER-RATE PURCHASE IN THE GAME, ON PURPOSE. 16,800 cash for
// +78.75/sec is 213 cash per point of rate, against sponsor #1's 100 and sponsor #3's 150.
// Three things make them worth buying anyway, and none of them is efficiency:
//   1. They are available in Act III, where sponsors do not exist at all.
//   2. Sponsors are bought once each and gated on reputation. Once all three are signed there
//      is no other lever on passive cash before the stadium, two acts away.
//   3. Their value self-gates on how much stand you own. At one Lemonade Table (2/sec) the
//      Chest Freezer returns 0.4/sec and takes 75 minutes to repay; at a full line it repays
//      in 86 seconds. They are correctly worthless to a player who has not built the stands,
//      which is why they can sit in the shop from Act III without being a trap.
//
// Payback at a fully built stand line (105 cash/sec base), which is the only state in which
// buying these is sensible: 86 seconds, 190 seconds, 317 seconds. Escalating, and the capstone
// still repays five times over inside Act IV's budget.
const STAND_UPGRADES = [
  {
    id: 'chestFreezer',
    name: 'A Chest Freezer',
    description: 'Cold stays cold through a doubleheader. Nothing has to go back in the truck.',
    cost: 1800,
    rateBonus: 0.2,
  },
  {
    id: 'priceBoard',
    name: 'A Painted Price Board',
    description: 'People decide while they are in line instead of at the window. The line moves.',
    cost: 5000,
    rateBonus: 0.25,
  },
  {
    id: 'boosterClub',
    name: 'The Booster Club',
    description: 'Nine mothers, a schedule on the fridge, and a float of ones. You are not the only one selling now.',
    cost: 10000,
    rateBonus: 0.3,
  },
];

// ---------------------------------------------------------------------------
// The per-click ladder
// ---------------------------------------------------------------------------
// Both arrays below do the same mechanical thing — add `perClickBonus` to clicker.perClick,
// which engine/clicker.js multiplies by the act's clickMultiplier — and they are split only by
// what they cost. Read them as one ladder.
//
// THE EXCHANGE RATE, which every number here is derived from. data/acts.js pairs Act III's
// clickMultiplier 8 with clickCooldownSeconds 2, and Act IV's 12 with 3. Both work out to
// FOUR CASH PER SECOND PER POINT of perClick, for a player who presses every time the button
// comes back — that identity is deliberate over there ("crossing the act boundary does not
// quietly change how fast the faucet runs"), and it is what makes this ladder pricable at all:
// a rung worth +N perClick is worth +4N cash/sec, in either act, and cost/(4N) is its payback
// in seconds. If a later change moves either cooldown, every payback figure below moves with
// it and these prices are the dial.
//
// WHERE THE LADDER STARTS. A player entering Act IV having bought everything that raises
// perClick is at 18: 1 at new game, +1 Sharper Eyes (data/actOneConfig.js), +6 Act II grit
// (data/wallBallShopConfig.js), +10 the three original caps rungs below. That is 216 a press,
// 72 cash/sec. (data/acts.js quotes "132 a press fully upgraded" — 11 perClick. That figure
// counts the three caps rungs and the starting 1 and misses Sharper Eyes and the grit; the
// real ceiling before this ladder existed was 18. Noting it so a reader diffing the two files
// does not conclude one of them is lying.)
//
// WHY IT DOES NOT TRIVIALISE ACT IV, which matters more than the payback tables: the click
// ladder buys no strength whatsoever, and Act IV's exit is a 60% win rate. Every cash a player
// sinks into pressing harder is cash not spent on stat upgrades or reputation deals, which are
// the only two things that actually end the act. A maxed ladder makes the act richer and not
// one game easier — and it costs 32,500 cash to reach, which is +8 team strength in reputation
// deals foregone.
//
// WHERE THE LADDER ENDS. Every rung bought is perClick 77 (18 + 6 + 9 + 8 + 14 + 22): 616 a
// press in Act III, 924 in Act IV, and 308 cash/sec in both — but only while the player is
// actually there pressing it, where the 184/sec from a full stand line and the ~410/sec from a
// full sponsor board arrive whether or not the tab is open. That is the shape the whole feature
// is aiming at: at maximum investment in both, ACTIVE play is worth about the same as IDLE
// play and never more, so the click is a choice about how you want to spend the act rather
// than a tax on your thumb. It also costs more to get there — 32,500 for the cash rungs
// against 41,500 for the sponsor board, plus 25,000 caps — so neither route is the trap.

// Bought with CAPS, not cash. Caps keep arriving in Act III (collectors, the crew's dues, the
// Act II hands) and had nothing left to buy, so they piled up meaning nothing. These are the
// sink — and `perClickBonus` raises clicker.perClick, which engine/clicker.js multiplies by the
// act's clickMultiplier, so a caps purchase here makes Act III's cash click better. Spending
// the old currency to improve the new one is the point.
//
// THE LAST TWO RUNGS ARE NEW, and they are sized against the caps faucet rather than against a
// payback, because caps buy nothing else anywhere in the game after this shop. A player who
// built out Act I and Act II is drawing 1.0 (collectors) + 0.75 (a crew of three at
// CREW_DUES_PER_SECOND) + 6.9 (three copies of both cap hands) = 8.65 caps/sec base, times a
// respect multiplier that lands around 1.2-1.5 — call it 10-13 caps/sec. The three original
// rungs total 3,750 caps and are gone inside the first six minutes of Act III, after which the
// faucet runs for another half hour into a bucket with no bottom. 7,000 caps is about twelve
// minutes of that and 18,000 about thirty: one rung for the tail of Act III, one that is the
// act-IV caps capstone. They are gentler in perClick than the cash rungs below (+6, +9 against
// +8, +14, +22) precisely because they are paid for in a currency the player cannot otherwise
// spend, and a dead currency should not out-buy a live one.
const CAPS_UPGRADES = [
  {
    id: 'battingGloves',
    name: 'Batting Gloves',
    description: 'One size too big, but they were on the clearance peg and they are yours.',
    cost: 250,
    perClickBonus: 2,
  },
  {
    id: 'cleats',
    name: 'Hand-Me-Down Cleats',
    description: 'Three sizes of foot have been in these. Two of them were faster than you.',
    cost: 900,
    perClickBonus: 3,
  },
  {
    id: 'scorebook',
    name: 'A Real Scorebook',
    description: 'You keep every game in pencil. Coach starts asking you what the numbers say.',
    cost: 2600,
    perClickBonus: 5,
  },
  {
    id: 'changeApron',
    name: 'The Change Apron',
    description: 'Nickels in one pocket, dimes in the other. You stop counting and start feeling for it.',
    cost: 7000,
    perClickBonus: 6,
  },
  {
    id: 'ownKey',
    name: 'Your Own Key',
    description: 'Nobody meets you at the padlock any more. You open the stand yourself, before anyone else is up.',
    cost: 18000,
    perClickBonus: 9,
  },
];

// The same ladder, priced in CASH, because by Act IV the caps rungs above are the wrong
// currency for where the player is standing: caps arrive at 10-13 a second and cash arrives at
// hundreds, so a caps price cannot express "expensive" any more without becoming a half-hour
// wait. These are the rungs a cash-rich Act IV player buys with the money they are already
// making, and they are the reason the tournament gate stays worth pressing at travel-ball
// prices instead of being the thing you did in the last act.
//
// Payback, at the 4-cash-per-second-per-point exchange rate established above:
//   A Second Window   +8  for  2,500  ->  +32/sec,   78 seconds
//   The Griddle      +14  for  8,000  ->  +56/sec,  143 seconds
//   The Gate Contract +22 for 22,000  ->  +88/sec,  250 seconds
// Escalating cost, escalating benefit, escalating payback — a ladder, not three doors. The
// bundle is 32,500 for +176 cash/sec, repaying in 185 seconds and then eight to ten times over
// across the rest of a 20-31 minute act.
//
// THE PAYBACK HAS TO LAND INSIDE ACT IV AND IT DOES. Act V declares no clickCurrency and no
// clickMultiplier (data/acts.js), so from the minors the click reverts to bottle caps at 1x
// and every point of perClick bought here stops being worth cash. That is the constraint that
// set the top of this ladder: the capstone repays in a bit over four minutes, so even a player
// who buys it late in the fastest 20-minute run comes out ahead, and nobody is sold a
// permanent-sounding investment that expires at the act boundary. It is also why the ladder
// stops at three rungs and 32,500 rather than running to a 50,000 capstone — a rung that needs
// eight minutes to repay is a trap in an act that can end in twenty.
//
// A rung is only worth its payback to a player who actually presses the button every time it
// comes back. That is the whole point of the feature: this is the one part of the shop whose
// return is paid for by showing up, and it is the compensation for the click cooldown.
const CASH_CLICK_UPGRADES = [
  {
    id: 'secondWindow',
    name: 'A Second Window',
    description: 'Two lines instead of one, and the one you are working never stops moving.',
    cost: 2500,
    perClickBonus: 8,
  },
  {
    id: 'griddle',
    name: 'The Griddle',
    description: 'Hot dogs off the heat instead of out of the wrapper. People pay double and wait for it.',
    cost: 8000,
    perClickBonus: 14,
  },
  {
    id: 'gateContract',
    name: 'The Gate Contract',
    description: 'The tournament hands you the whole gate, not just the counter. Every car that comes through is yours.',
    cost: 22000,
    perClickBonus: 22,
  },
];

const KIND_STAND = 'stand';
const KIND_BOOSTER = 'booster';
const KIND_CAPS_UPGRADE = 'capsUpgrade';
const KIND_STAND_UPGRADE = 'standUpgrade';
const KIND_CASH_CLICK_UPGRADE = 'cashClickUpgrade';

function getStand(standId) {
  return CONCESSION_STANDS.find((s) => s.id === standId) || null;
}

function getBooster(boosterId) {
  return BOOSTERS.find((b) => b.id === boosterId) || null;
}

function getCapsUpgrade(id) {
  return CAPS_UPGRADES.find((u) => u.id === id) || null;
}

function getStandUpgrade(id) {
  return STAND_UPGRADES.find((u) => u.id === id) || null;
}

function getCashClickUpgrade(id) {
  return CASH_CLICK_UPGRADES.find((u) => u.id === id) || null;
}

module.exports = {
  CONCESSION_STANDS,
  BOOSTERS,
  CAPS_UPGRADES,
  STAND_UPGRADES,
  CASH_CLICK_UPGRADES,
  KIND_STAND,
  KIND_BOOSTER,
  KIND_CAPS_UPGRADE,
  KIND_STAND_UPGRADE,
  KIND_CASH_CLICK_UPGRADE,
  getStand,
  getBooster,
  getCapsUpgrade,
  getStandUpgrade,
  getCashClickUpgrade,
};
