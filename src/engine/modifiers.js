const balanceConfig = require('../data/balanceConfig');
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

// `data/acts.js` is authored by the act-system story and may not exist yet. The path is built
// from an expression on purpose: webpack then resolves `../data/` as a directory context, so a
// missing acts.js is a runtime miss this try/catch absorbs rather than a build failure. A plain
// static `require('../data/acts')` would fail the bundle outright while the file is absent.
const ACTS_MODULE = 'acts';
let actsModule; // undefined = not looked up yet, null = looked up and absent
function getActsModule() {
  if (actsModule !== undefined) return actsModule;
  try {
    actsModule = require(`../data/${ACTS_MODULE}`);
  } catch (err) {
    actsModule = null;
  }
  return actsModule;
}

// Rules the current act declares, or {} when there is no act system / no act rules yet.
function actRules(state) {
  const progression = state && state.progression;
  if (!progression || progression.act == null) return {};
  const acts = getActsModule();
  if (!acts || typeof acts.getActConfig !== 'function') return {};
  const act = acts.getActConfig(progression.act);
  return (act && act.rules) || {};
}

// The additive bonuses the current act declares — the second of the two axes data/acts.js
// documents, and the one that was never wired up. `resolveRules()` below has always layered
// `act.rules`, but `act.modifierBonuses` was read by nothing, so an act declaring one got no
// effect and no error: Act IV asked for 0.6-quality rookies and was handed full-strength
// adults, which is a thirteen-year-old with a 94 stat block and a free strength boost every
// time somebody ages out.
//
// Acts I-III, V and VI declare `{}`, so wiring this changes Act IV and nothing else.
function actModifierBonuses(state) {
  const progression = state && state.progression;
  if (!progression || progression.act == null) return {};
  const acts = getActsModule();
  if (!acts || typeof acts.getActConfig !== 'function') return {};
  const act = acts.getActConfig(progression.act);
  return (act && act.modifierBonuses) || {};
}

// Rules the current era declares. Era 0's is `{}`, which is why today's resolved values are
// identical to balanceConfig.
function eraRules(state) {
  const era = getEraConfig(state && state.prestige ? state.prestige.era : 0);
  return era.rules || {};
}

// An explicit `undefined` in a rules object must not clobber the layer beneath it; only keys
// with a real value count as an override.
function definedOnly(rules) {
  return Object.entries(rules).reduce((kept, [key, value]) => {
    if (value !== undefined) kept[key] = value;
    return kept;
  }, {});
}

// The *rules* axis: what shape the league/season takes (team count, games, pacing, playoff
// size). Distinct from the additive `modifierBonuses` axis in computeModifiers below — rules
// replace a balanceConfig value, bonuses accumulate into a multiplier.
//
// Precedence: balanceConfig <- act.rules <- era.rules, era last/highest. Acts I-V run at era 0
// (rules `{}`), so era-last preserves today's behavior where prestige eras reshape the endgame.
//
// Layering is by spread, never by `||`: the old `era.rules.x || balanceConfig.x` idiom treats a
// legitimate 0 as absent, and `playoffTeams: 0` (a league with no playoffs) is a real value.
// "Not overridden" is key-absent; "overridden to 0" is key-present-with-0, and they differ here.
function resolveRules(state) {
  return {
    ...balanceConfig,
    ...definedOnly(actRules(state)),
    ...definedOnly(eraRules(state)),
  };
}

function zeroBonuses() {
  return BONUS_KEYS.reduce((bundle, key) => {
    bundle[key] = 0;
    return bundle;
  }, {});
}

// Composition order: balanceConfig defaults (implicit 0) <- era <- perks <- active powerups.
// Returns ready-to-multiply factors, e.g. modifiers.revenueMult === 1.08 means "+8%".
// Reputation as a strength bonus, measured from the starting value so a fresh run is exactly
// neutral. Floored at zero: reputation never falls today, and a negative here would quietly
// turn a setback into a spiral. This is the one bonus sourced from live state rather than from
// a config layer, which is why it is added explicitly rather than through modifierBonuses.
function reputationBonus(state, rules) {
  const reputation = typeof state.reputation === 'number' ? state.reputation : rules.startingReputation;
  return Math.max(0, (reputation - rules.startingReputation) * rules.reputationStrengthPerPoint);
}

function computeModifiers(state) {
  const era = getEraConfig(state.prestige.era);
  const bonuses = zeroBonuses();
  const rules = resolveRules(state);

  bonuses.strengthMult += reputationBonus(state, rules);

  // Composition order is the one data/acts.js states: act <- era <- perks <- powerups, acts
  // being the most general layer. Additive, so an act and an era both declaring a key sum
  // rather than one silently winning — which is the difference between this axis and `rules`,
  // where the later layer replaces the earlier one outright.
  Object.entries(actModifierBonuses(state)).forEach(([key, value]) => {
    if (key in bonuses) bonuses[key] += value;
  });

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
  // Carried on the modifiers bundle so every consumer that already receives `modifiers` reads
  // resolved rules without a signature change. Call resolveRules(state) directly elsewhere.
  modifiers.rules = rules;
  return modifiers;
}

module.exports = { computeModifiers, resolveRules, BONUS_KEYS };
