// Act I — The Vacant Lot. Costs are PRD §5 (Act I) verbatim; the first collector at
// 25 caps puts the first automation squarely in the "click 10-50 times" window.
//
// Kit items are the Act I exit gate (140 caps total) and are also the base of the
// wall-ball kit quality used as player strength in Act II — see data/wallBallConfig.js.

const COLLECTOR_TIERS = [
  {
    id: 'kidBrother',
    name: 'Kid Brother',
    description: 'He works for candy. Mostly.',
    cost: 25,
    costGrowth: 1.18,
    capsPerSecond: 0.2,
  },
  {
    id: 'wagon',
    name: 'Wagon',
    description: 'Twice the caps per trip across the lot.',
    cost: 120,
    costGrowth: 1.18,
    capsPerSecond: 0.8,
  },
];

const CLICK_UPGRADES = [
  {
    id: 'sharperEyes',
    name: 'Sharper Eyes',
    description: 'You start seeing caps in the gravel.',
    cost: 60,
    perClickBonus: 1,
  },
  {
    id: 'workGloves',
    name: 'Work Gloves',
    description: 'Dig faster without shredding your hands.',
    cost: 260,
    perClickBonus: 2,
  },
];

// Purchase price of the Nth copy of a collector tier.
function collectorCost(tier, ownedCount) {
  return Math.round(tier.cost * tier.costGrowth ** ownedCount);
}

module.exports = { COLLECTOR_TIERS, CLICK_UPGRADES, collectorCost };
