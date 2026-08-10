const { getEraConfig } = require('../data/eras');
const { PERKS } = require('../data/perksConfig');
const { clamp } = require('../utils/statUtils');

const BONUS_KEYS = [
  'revenueMult',
  'attendanceMult',
  'strengthMult',
  'campSpeedMult',
  'rookieQualityMult',
  'upgradeCostMult',
  'aiStrengthMult',
];

// [floor, ceiling] applied to the final (1 + bonusSum) multiplier for each key.
const CLAMPS = {
  revenueMult: [0.2, 5],
  attendanceMult: [0.2, 3],
  strengthMult: [0.3, 3],
  campSpeedMult: [0.3, 5],
  rookieQualityMult: [0.5, 3],
  upgradeCostMult: [0.3, 2],
  aiStrengthMult: [0.5, 4],
};

const PERKS_BY_ID = PERKS.reduce((map, perk) => {
  map[perk.id] = perk;
  return map;
}, {});

function zeroBonuses() {
  return BONUS_KEYS.reduce((bundle, key) => {
    bundle[key] = 0;
    return bundle;
  }, {});
}

// Composition order: balanceConfig defaults (implicit 0) <- era <- perks <- active powerups.
// Returns ready-to-multiply factors, e.g. modifiers.revenueMult === 1.08 means "+8%".
function computeModifiers(state) {
  const era = getEraConfig(state.prestige.era);
  const bonuses = zeroBonuses();

  Object.entries(era.modifierBonuses || {}).forEach(([key, value]) => {
    if (key in bonuses) bonuses[key] += value;
  });

  state.prestige.purchasedPerks.forEach((perkId) => {
    const perk = PERKS_BY_ID[perkId];
    if (perk && perk.effectType in bonuses) bonuses[perk.effectType] += perk.value;
  });

  state.powerups.active.forEach((powerup) => {
    if (powerup.type in bonuses) bonuses[powerup.type] += powerup.value;
  });

  const modifiers = {};
  BONUS_KEYS.forEach((key) => {
    const [floor, ceiling] = CLAMPS[key];
    modifiers[key] = clamp(1 + bonuses[key], floor, ceiling);
  });
  modifiers.era = era;
  return modifiers;
}

module.exports = { computeModifiers, BONUS_KEYS };
