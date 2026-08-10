// The odyssey's acts. Mirrors the shape of data/eras.js deliberately (odyssey design doc,
// Decision 3): { id, name, description, entry, exit, rules, modifierBonuses, unlocks }.
//
// `rules` overrides fields on data/balanceConfig.js for the duration of the act.
// `exit(state)` is the act's exit predicate, evaluated by engine/progression.js's
// checkActTransition() once per advance() iteration — so transitions also fire correctly
// mid-way through an offline catch-up.
// `initialize(state)` is optional: Decision 2 makes act entry the initializer boundary, so
// each act's own story owns creating the content that act introduces.
//
// SCAFFOLDING NOTE: only the acts that exist today are authored here. STORY-004 owns this
// table and fills in Acts III-VI.
const { STARTER_KIT_ITEMS } = require('./actOneConfig');

const ACTS = [
  {
    id: 0,
    name: 'The Vacant Lot',
    description: 'One button, one currency, and money in the dirt if you know where to look.',
    entry: 'New game',
    exit: function ownsStarterKit(state) {
      const owned = (state.lot && state.lot.starterKit) || [];
      return STARTER_KIT_ITEMS.every((item) => owned.includes(item.id));
    },
    rules: {
      clickLabel: 'Search the lot',
      clickCurrency: 'caps',
      clickMultiplier: 1,
    },
    modifierBonuses: {},
    unlocks: ['lot', 'clicker'],
  },
  {
    id: 1,
    name: 'Off the Wall',
    description: 'A brick wall, a chalk strike zone, and every kid on the block wants a piece of you.',
    entry: 'Own the Starter Kit',
    // Act II's real exit (5 wall-ball wins + 3 crew) lands with the wall-ball story.
    exit: null,
    rules: {
      // Clicking is never removed; from Act II it is reframed as Hustle and its absolute
      // value scales with the act. PRD §6.4 — this is the anti-softlock guarantee.
      clickLabel: 'Hustle',
      clickCurrency: 'caps',
      clickMultiplier: 3,
    },
    modifierBonuses: {},
    unlocks: ['wallBall'],
  },
];

// Extrapolation-safe like getEraConfig, but acts are authored content rather than an
// endless ladder, so an index past the end clamps to the last authored act.
function getActConfig(actIndex) {
  if (!Number.isFinite(actIndex) || actIndex < 0) return ACTS[0];
  if (actIndex < ACTS.length) return ACTS[actIndex];
  return ACTS[ACTS.length - 1];
}

module.exports = { ACTS, getActConfig };
