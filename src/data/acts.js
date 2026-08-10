// PLACEHOLDER — the real six-act content is owned by STORY-004. This stub exists only so the
// progressive tab reveal has something to read; it deliberately authors no balance, no entry/exit
// thresholds and no modifier bonuses. Replace wholesale when the real acts land.
//
// Shape mirrors data/eras.js (see openspec/changes/odyssey-progression-architecture/design.md,
// Decision 3): { id, name, description, entry, exit, rules, modifierBonuses, unlocks }.
//
// `unlocks` is the cumulative-union source for engine/progression.js#getUnlockedFeatures.
const ACTS = [
  {
    id: 0,
    name: 'Act I',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['field'],
  },
  {
    id: 1,
    name: 'Act II',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['roster'],
  },
  {
    id: 2,
    name: 'Act III',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['league'],
  },
  {
    id: 3,
    name: 'Act IV',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['camp'],
  },
  {
    id: 4,
    name: 'Act V',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['ticketing', 'playoffs'],
  },
  {
    id: 5,
    name: 'Act VI',
    description: 'Placeholder act.',
    entry: null,
    exit: null,
    rules: {},
    modifierBonuses: {},
    unlocks: ['trade', 'prestige'],
  },
];

module.exports = { ACTS };
