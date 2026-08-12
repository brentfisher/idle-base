// Prestige advances the player through eras. Each era is a ruleset override, not just a
// bigger multiplier, so replaying feels different rather than only "numbers go up".
//
// `rules` overrides fields on data/balanceConfig.js directly (season length, league size, etc).
// `modifierBonuses` are additive percentage bonuses layered into engine/modifiers.js
// (on top of perks and active powerups) before being applied to economy/strength/etc formulas.
//
// `pill` is the era's colour, as { bg, ink }. A prestige changes almost everything about how
// the league behaves and almost nothing about how the screen looks, so players were sailing
// past the transition without noticing it; the header pill is the one element that is always
// on screen and always says which era you are in, so it carries the signal. It lives here
// because this file is what an era *is* — a component matching on era.name, or a CSS class per
// era, would both break the moment getEraConfig() starts synthesising eras past the authored
// five. The palette stays inside the ballpark world the rest of global.css builds (deep greens,
// #f4d35e gold, clay, outfield blue) rather than a generic rainbow, and every bg/ink pair below
// clears 4.7:1 — chips render at 0.78rem on a phone, which is normal-size text for contrast
// purposes, so anything under 4.5:1 is unreadable in sunlight on the bus.
const ERAS = [
  {
    id: 0,
    name: 'Sandlot Era',
    description: 'A fresh, standard league. Learn the ropes.',
    // Outfield grass — the starting era is the one that should look most like the game itself.
    pill: { bg: '#5aa03f', ink: '#0d1f14' },
    rules: {},
    modifierBonuses: {},
  },
  {
    id: 1,
    name: 'Dead Ball Era',
    description: 'Low-scoring, gritty baseball. Ticket prices don’t stretch as far, but loyal crowds still show up. AI teams play a little tougher.',
    // Newsprint sepia: the only era anybody alive has seen exclusively in grey box scores.
    pill: { bg: '#9a9182', ink: '#14210f' },
    rules: {},
    modifierBonuses: { revenueMult: -0.15, attendanceMult: 0.15, aiStrengthMult: 0.05 },
  },
  {
    id: 2,
    name: 'Expansion Era',
    description: 'The league grows to 16 teams and a 45-game season — a longer grind to the playoffs.',
    // Outfield-wall blue, the colour of a brand-new franchise's brand-new ballpark.
    pill: { bg: '#2a6591', ink: '#eef3ec' },
    rules: { leagueTeamCount: 16, gamesPerSeason: 45 },
    modifierBonuses: { aiStrengthMult: 0.05 },
  },
  {
    id: 3,
    name: 'Free Agency Era',
    description: 'Two trade windows per season sharpen roster building, but careers run shorter as players chase bigger, faster paydays.',
    // The game's own gold, spent here on the era that is about money.
    pill: { bg: '#f4d35e', ink: '#14210f' },
    rules: {
      tradeWindows: [
        { openFraction: 0.3, closeFraction: 0.38 },
        { openFraction: 0.68, closeFraction: 0.76 },
      ],
      retireAtSeasonsRange: [6, 10],
    },
    modifierBonuses: { aiStrengthMult: 0.1 },
  },
  {
    id: 4,
    name: 'Analytics Era',
    description: 'Data-driven player development makes upgrades cheaper, but the grind ages players out faster than ever.',
    // Warm brick — deliberately the furthest thing on the wheel from the gold beside it, since
    // this is the boundary a player crosses last and is most likely to miss.
    pill: { bg: '#b04a35', ink: '#eef3ec' },
    rules: { statUpgradeCostGrowth: 1.15, retireAtSeasonsRange: [5, 9] },
    modifierBonuses: { aiStrengthMult: 0.15 },
  },
];

const EXTRAPOLATED_AI_STRENGTH_STEP = 0.05;

// Extrapolated eras are unbounded, so their colour has to be a function of the index rather
// than an authored entry. The cycle is ordered so that consecutive picks are far apart on the
// wheel — the only thing this colour has to do is make "the era just changed" unmissable, and a
// teal that becomes a slightly different teal fails at exactly that. It starts on teal because
// the era immediately before the first extrapolated one is Analytics' brick.
const EXTRAPOLATED_PILLS = [
  { bg: '#39a68f', ink: '#0d1f14' }, // bullpen teal
  { bg: '#7d5ba6', ink: '#eef3ec' }, // dusk violet
  { bg: '#c9772e', ink: '#14210f' }, // burnt orange, the late-innings sun
  { bg: '#6b8dc4', ink: '#0d1f14' }, // stadium-light blue
];

function getEraConfig(eraIndex) {
  if (eraIndex < ERAS.length) return ERAS[eraIndex];
  const last = ERAS[ERAS.length - 1];
  const extraSteps = eraIndex - (ERAS.length - 1);
  // extraSteps is >= 1 on every real call, but a non-numeric era index would make it NaN and
  // hand the component an undefined pill — an era with no colour at all. The floor keeps the
  // lookup total: a broken index still gets a real, deterministic colour.
  const pillStep = Number.isFinite(extraSteps) ? Math.max(1, Math.round(extraSteps)) : 1;
  return {
    id: eraIndex,
    name: `${last.name} +${extraSteps}`,
    description: 'An extrapolated era beyond the authored league history — the grind continues, tougher each time.',
    pill: EXTRAPOLATED_PILLS[(pillStep - 1) % EXTRAPOLATED_PILLS.length],
    rules: last.rules,
    modifierBonuses: {
      ...last.modifierBonuses,
      aiStrengthMult: (last.modifierBonuses.aiStrengthMult || 0) + EXTRAPOLATED_AI_STRENGTH_STEP * extraSteps,
    },
  };
}

module.exports = { ERAS, getEraConfig };
