// Act IV — Travel Ball. Every Act IV number lives here; engine/travelBall.js,
// engine/bookie.js and engine/sponsorships.js contain the rules and none of the tuning.
//
// The league's *shape* (8 teams, 15 games, 40s pacing, how kids age out) is declared as act
// rules in data/acts.js, because those override balanceConfig through resolveRules(). What
// lives here is what has no balanceConfig equivalent: the act's exit bar, its shop, and the
// Bookie's bounds.
//
// CURRENCY NOTE. The PRD gives Act IV coins, on a caps -> coins -> cash ladder. Act III
// shipped its concessions in CASH, and every Act IV sink that already exists is cash-priced:
// camp programs (data/campProgramsConfig.js), stat upgrades (balanceConfig.statUpgradeBaseCost)
// and trade candidates (engine/tradeDeadline.js). Paying the act in coins would hand the
// player a currency nothing in the act can spend, so Act IV is cash too. `wallet.coins` stays
// present-and-zero, as it has been since STORY-001.

// ---------------------------------------------------------------------------
// The exit
// ---------------------------------------------------------------------------
// "Reach a 60% career win rate across two full travel seasons" (PRD §Act IV). Both halves are
// needed: the seasons requirement stops a 1-0 start from ending the act, and the rate is what
// makes the act about building a team rather than waiting.
//
// Counted from the moment the act is ENTERED, not from the player's whole career — the little
// league record was earned against 22-32 rated nine-year-olds and says nothing about travel
// ball. engine/travelBall.js opens a fresh record and only accumulates while the act is live.
const TRAVEL_SEASONS_REQUIRED = 2;
const TRAVEL_WIN_RATE_REQUIRED = 0.6;

// ---------------------------------------------------------------------------
// The shop: sponsors and reputation
// ---------------------------------------------------------------------------
// SPONSORS are the act's cash faucet, and they have to be, for the same structural reason
// Act III needed stands: engine/income.js's ticketing contributor is gated on `state.stadium`,
// which Act V creates. Act III's stands cap out at 105 cash/sec with every copy bought, which
// is roughly one stat upgrade a minute at Act IV stat levels — enough to keep the lights on,
// nowhere near enough to build a travel team. Sponsors are the next tier.
//
// Bought once each, and gated on reputation rather than on a timer, so the act's own loop
// paces them: cash buys reputation, reputation opens the bigger deal AND makes the team
// better (balanceConfig.reputationStrengthPerPoint). That is the whole act in one sentence.
//
// `cashPerSecond` is a BASE rate. Sponsors READ reputation, they never grant it — the boosters
// below do that, and a sponsor that also paid reputation would compound with itself.
const SPONSORS = [
  {
    id: 'hardwareStore',
    name: "Dorsey's Hardware",
    description: 'Your name on the back of the jersey, in the same paint he uses for the sale signs.',
    cost: 2500,
    cashPerSecond: 25,
    minReputation: 0,
  },
  {
    id: 'radioSpot',
    name: 'The AM Station',
    description: 'Thirty seconds between the swap meet and the weather. They read your record out loud.',
    cost: 9000,
    cashPerSecond: 70,
    minReputation: 60,
  },
  {
    id: 'busLettering',
    name: 'The Lettered Bus',
    description: 'A dealership pays for the paint. Three towns over, people know who got off it.',
    cost: 30000,
    cashPerSecond: 200,
    minReputation: 110,
  },
];

// What one point of reputation above balanceConfig.startingReputation adds to a sponsor's
// rate. Deliberately the same 0.004 as reputationStrengthPerPoint: a point of reputation is
// worth the same on the field and at the table, so the player never has to hold two exchange
// rates in their head.
const SPONSOR_REPUTATION_SCALE = 0.004;

// Reputation, bought outright — the Act III boosters one tier up. This is the sink that makes
// sponsor cash worth having, and it feeds strengthMult, so it is also how a travel team gets
// good enough to hold a 60% win rate.
const REPUTATION_DEALS = [
  {
    id: 'tournamentTrophy',
    name: 'The Tournament Trophy',
    description: 'Two feet of plastic gold from a weekend in Ashland. It sits on the mantel at home.',
    cost: 3000,
    reputation: 25,
  },
  {
    id: 'localPaper',
    name: 'The Sports Page',
    description: 'Four column inches under a photo where nobody is looking at the camera.',
    cost: 9000,
    reputation: 35,
  },
  {
    id: 'travelUniforms',
    name: 'Real Travel Uniforms',
    description: 'Double-knit, numbered, with your town across the chest. Kids from three towns want one.',
    cost: 25000,
    reputation: 50,
  },
];

const KIND_SPONSOR = 'sponsor';
const KIND_REPUTATION = 'reputation';

function getSponsor(sponsorId) {
  return SPONSORS.find((s) => s.id === sponsorId) || null;
}

function getReputationDeal(dealId) {
  return REPUTATION_DEALS.find((d) => d.id === dealId) || null;
}

// ---------------------------------------------------------------------------
// The Bookie
// ---------------------------------------------------------------------------
// Randomness #3, the punishing one (PRD §Act IV). Three bounds, all structural rather than
// tuning — the same shape as Act II's wall-ball stake (engine/wallBall.js):
//
//   1. A wager is capped at a FRACTION OF CURRENT CASH, never a flat amount, so the absolute
//      loss shrinks toward zero as the balance does.
//   2. One open wager at a time, so a bad run cannot compound inside a single game.
//   3. The Bookie refuses to deal below a floor of banked income, so the money a player
//      gambles is always money they had spare. Below it he is simply not there.
const WAGER_MAX_FRACTION = 0.2;
const MIN_WAGER = 100;

// The floor is "about two minutes of passive income", per the PRD, with an absolute minimum
// for a player who has bought no sponsors at all. Expressed in seconds so it tracks the act's
// economy instead of going stale the moment a sponsor is bought.
const BOOKIE_FLOOR_SECONDS = 120;
const BOOKIE_MIN_FLOOR_CASH = 500;

// The line is derived from the REAL matchup (engine/gameSim.js winProbability), then shaded by
// the house. So backing yourself against a weak club pays almost nothing, and the money is in
// the games you are supposed to lose — which is precisely the bet that hurts.
//
// Every wager is negative expected value by HOUSE_EDGE. That is the point: the Bookie is a
// tempo mechanic, not an income source. A player who never visits him finishes the act; a
// player who lives at his table finishes it slower on average and much faster sometimes.
const HOUSE_EDGE = 0.12;
const MIN_PAYOUT_MULT = 1.1;
const MAX_PAYOUT_MULT = 6;

const SIDE_FOR = 'for';
const SIDE_AGAINST = 'against';

module.exports = {
  TRAVEL_SEASONS_REQUIRED,
  TRAVEL_WIN_RATE_REQUIRED,
  SPONSORS,
  SPONSOR_REPUTATION_SCALE,
  REPUTATION_DEALS,
  KIND_SPONSOR,
  KIND_REPUTATION,
  getSponsor,
  getReputationDeal,
  WAGER_MAX_FRACTION,
  MIN_WAGER,
  BOOKIE_FLOOR_SECONDS,
  BOOKIE_MIN_FLOOR_CASH,
  HOUSE_EDGE,
  MIN_PAYOUT_MULT,
  MAX_PAYOUT_MULT,
  SIDE_FOR,
  SIDE_AGAINST,
};
