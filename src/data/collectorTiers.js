// Config for the `collectors` income contributor (engine/income.js).
//
// A collector is a bought-once helper that pulls bottle caps out of the lot without the
// player clicking. `capsPerSecond` is a *rate*: engine/income.js sums it and advance()
// integrates it across the whole tick step, so an eight-hour offline return credits the
// full eight hours in a single iteration (see the odyssey design doc, Decision 1).
const COLLECTOR_TIERS = [
  {
    id: 'kidBrother',
    tier: 1,
    name: 'Kid Brother',
    description: 'He follows you everywhere anyway. Might as well put him to work.',
    cost: 25,
    capsPerSecond: 0.2,
    maxCount: 1,
  },
  {
    id: 'wagon',
    tier: 2,
    name: 'Wagon',
    description: 'Rusted red, one wobbly wheel. Hauls four times what your pockets hold.',
    cost: 120,
    capsPerSecond: 0.8,
    maxCount: 1,
  },
];

function getCollectorTier(tierId) {
  return COLLECTOR_TIERS.find((tier) => tier.id === tierId) || null;
}

module.exports = { COLLECTOR_TIERS, getCollectorTier };
