// Act III's shop. Two kinds of thing, because Act III had two separate dead ends.
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

const KIND_STAND = 'stand';
const KIND_BOOSTER = 'booster';

function getStand(standId) {
  return CONCESSION_STANDS.find((s) => s.id === standId) || null;
}

function getBooster(boosterId) {
  return BOOSTERS.find((b) => b.id === boosterId) || null;
}

module.exports = { CONCESSION_STANDS, BOOSTERS, KIND_STAND, KIND_BOOSTER, getStand, getBooster };
