// Act II's shop — everything here is bought with CAPS, the currency the act already runs on.
//
// It exists because Act II's only cap sink was the wager itself, so a bad run left you with
// nothing to do but wait for the collectors to refill you. With MIN_STAKE raised to 8 you now
// need a bankroll before you can play at all, and these are how you build one: gear that makes
// each rally worth more, and hands that bring caps in while you are not clicking.
//
// GRIT items raise `clicker.perClick`, so they make the manual click better in every later act
// too (engine/clicker.js multiplies perClick by the act's clickMultiplier). They are the
// "search harder" upgrades — the direct descendants of Act I's Sharper Eyes.
const GRIT_UPGRADES = [
  {
    id: 'goodPockets',
    name: 'Deep Pockets',
    description: 'Cargo shorts, two sizes too big, four pockets that shut. You stop dropping things.',
    cost: 90,
    perClickBonus: 1,
  },
  {
    id: 'magnetOnString',
    name: 'Magnet on a String',
    description: "Off the back of somebody's screen door. Drag it through the dirt and listen.",
    cost: 260,
    perClickBonus: 2,
  },
  {
    id: 'flashlight',
    name: 'Dented Flashlight',
    description: 'Now the lot is open after supper, which is when the good ones turn up.',
    cost: 700,
    perClickBonus: 3,
  },
];

// Repeatable helpers, priced per copy. Rates, like data/collectorTiers.js, so advance()
// integrates them across an offline return in a single iteration.
const CAP_HANDS = [
  {
    id: 'paperRoute',
    name: 'Paper Route Cut',
    description: 'Micky takes the far streets and gives you a cut for the introduction.',
    cost: 140,
    costGrowth: 1.7,
    capsPerSecond: 0.5,
    maxCount: 3,
  },
  {
    id: 'returnsRun',
    name: 'Bottle Returns Run',
    description: 'Every Saturday, the whole block, one wagon. Two cents a bottle adds up.',
    cost: 520,
    costGrowth: 1.7,
    capsPerSecond: 1.8,
    maxCount: 3,
  },
];

const KIND_GRIT = 'grit';
const KIND_HAND = 'hand';

function getGrit(id) {
  return GRIT_UPGRADES.find((g) => g.id === id) || null;
}

function getHand(id) {
  return CAP_HANDS.find((h) => h.id === id) || null;
}

module.exports = { GRIT_UPGRADES, CAP_HANDS, KIND_GRIT, KIND_HAND, getGrit, getHand };
