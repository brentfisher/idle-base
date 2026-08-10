// Prestige advances the player through eras. Each era is a ruleset override, not just a
// bigger multiplier, so replaying feels different rather than only "numbers go up".
//
// `rules` overrides fields on data/balanceConfig.js directly (season length, league size, etc).
// `modifierBonuses` are additive percentage bonuses layered into engine/modifiers.js
// (on top of perks and active powerups) before being applied to economy/strength/etc formulas.
const ERAS = [
  {
    id: 0,
    name: 'Sandlot Era',
    description: 'A fresh, standard league. Learn the ropes.',
    rules: {},
    modifierBonuses: {},
  },
  {
    id: 1,
    name: 'Dead Ball Era',
    description: 'Low-scoring, gritty baseball. Ticket prices don’t stretch as far, but loyal crowds still show up. AI teams play a little tougher.',
    rules: {},
    modifierBonuses: { revenueMult: -0.15, attendanceMult: 0.15, aiStrengthMult: 0.05 },
  },
  {
    id: 2,
    name: 'Expansion Era',
    description: 'The league grows to 16 teams and a 45-game season — a longer grind to the playoffs.',
    rules: { leagueTeamCount: 16, gamesPerSeason: 45 },
    modifierBonuses: { aiStrengthMult: 0.05 },
  },
  {
    id: 3,
    name: 'Free Agency Era',
    description: 'Two trade windows per season sharpen roster building, but careers run shorter as players chase bigger, faster paydays.',
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
    rules: { statUpgradeCostGrowth: 1.15, retireAtSeasonsRange: [5, 9] },
    modifierBonuses: { aiStrengthMult: 0.15 },
  },
];

const EXTRAPOLATED_AI_STRENGTH_STEP = 0.05;

function getEraConfig(eraIndex) {
  if (eraIndex < ERAS.length) return ERAS[eraIndex];
  const last = ERAS[ERAS.length - 1];
  const extraSteps = eraIndex - (ERAS.length - 1);
  return {
    id: eraIndex,
    name: `${last.name} +${extraSteps}`,
    description: 'An extrapolated era beyond the authored league history — the grind continues, tougher each time.',
    rules: last.rules,
    modifierBonuses: {
      ...last.modifierBonuses,
      aiStrengthMult: (last.modifierBonuses.aiStrengthMult || 0) + EXTRAPOLATED_AI_STRENGTH_STEP * extraSteps,
    },
  };
}

module.exports = { ERAS, getEraConfig };
