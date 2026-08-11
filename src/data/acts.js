// The odyssey is six acts, played once per save. An act is a stage of the game the same way an
// era is (see data/eras.js) — a declarative ruleset override plus additive modifier bonuses —
// so acts deliberately reuse that shape rather than introducing a parallel config system.
//
// `rules` overrides fields on data/balanceConfig.js. Resolution order is
// `balanceConfig <- act.rules <- era.rules` (era last, so prestige eras still reshape the
// endgame baseline). Acts I-V always run at era 0, whose `rules` is `{}`, and Act VI declares
// `rules: {}` and defers entirely to the era — so the two axes never actually collide.
// NOTE: act rules stay inert until `resolveRules()` lands in engine/modifiers.js; several
// balanceConfig fields are still read directly today.
//
// `modifierBonuses` are additive percentage bonuses layered into engine/modifiers.js. Acts are
// the most general layer: `act <- era <- perks <- powerups`.
//
// `unlocks` are feature ids switched on when the act begins. Ids matching a key of AppShell's
// PANELS map gate a whole tab; the rest gate a mechanic within an already-visible panel.
// Unlocks are cumulative and DERIVED, never stored — see engine/progression.js.
//
// `exit` names the machine-checkable condition that ends the act. The engine owns the predicate
// (engine/progression.js); this file only names it. Act VI has no exit: its "exit" is the game's
// win condition, and prestige replays Act VI in place rather than advancing past it.
const ACTS = [
  {
    id: 0,
    name: 'Act I — The Vacant Lot',
    description:
      'You are nine years old. There is a vacant lot behind the hardware store, and there is money in the dirt if you know where to look.',
    entry: 'New game.',
    exit: { id: 'starterKitOwned', description: 'Buy the Starter Kit — glove, ball and bat (140 caps).' },
    rules: {},
    modifierBonuses: {},
    unlocks: ['lot', 'hustle', 'collectors'],
  },
  {
    id: 1,
    name: 'Act II — Off the Wall',
    description: 'A brick wall, a chalk strike zone, and every kid on the block wants a piece of you.',
    entry: 'Own the Starter Kit.',
    exit: { id: 'crewAssembled', description: 'Win 5 wall-ball challenges and recruit 3 crew members.' },
    // The manual click is never removed, but from here on it is the Hustle — the same button
    // under a name that fits a kid who has somewhere to be. engine/clicker.js reads this key
    // off act.rules directly (see actClickRules there), so it takes effect on entering the act.
    rules: { clickLabel: 'Hustle' },
    modifierBonuses: {},
    unlocks: ['wallBall', 'wagers', 'crew', 'respect'],
  },
  {
    id: 2,
    name: 'Act III — Little League',
    description: 'Real uniforms. Real umpires. Six games and a trophy nobody will remember but you.',
    entry: 'Five wall-ball wins and a crew of three.',
    exit: { id: 'littleLeagueTitleWon', description: 'Finish first in a six-game Little League season.' },
    // The existing schedule/standings simulation, switched on in miniature. `playoffTeams: 0`
    // means no bracket yet — the champion is simply the standings leader, which is exactly what
    // the `littleLeagueTitleWon` exit reads.
    //
    // `aiTeamStrengthRange` is not optional flavour: the player's side is a promoted wall-ball
    // crew plus kids of the same quality (data/actThreeConfig.js), rating ~25 overall. Against
    // the default [35, 65] band that is a ~2% win rate at eloK 15, and an act whose exit is
    // "finish first" would be unfinishable.
    rules: {
      leagueTeamCount: 4,
      gamesPerSeason: 6,
      secondsPerGame: 25,
      playoffTeams: 0,
      // Tuned by simulation, not by feel, and re-tuned once reputation became a strength
      // bonus and the shop gave the player something to spend on. 30 runs per band, measured
      // both with and without buying the boosters:
      //   [18, 28] -> 68% win, ~4.7 min ignoring the shop; 84% and ~3.3 min with boosters
      //   [22, 32] -> 50% win, ~11.8 min ignoring the shop; 68% and ~4.7 min with boosters
      //   [26, 36] -> 46% win, ~14.6 min ignoring the shop; 55% and ~9.2 min with boosters
      // [22, 32] is chosen because it is the band where the shop is the difference: engaging
      // with it is a 2.5x speedup, where at [18, 28] the act is over before the economy can
      // matter and at [26, 36] buying everything still leaves a grind. The act should be
      // winnable by playing and *fast* by building.
      aiTeamStrengthRange: [22, 32],
      // The manual click becomes the act's cash faucet. Ticketing is gated on a stadium that
      // does not exist until Act V, so without this the only cash in Act III is the 500 the
      // game started with — barely two stat upgrades, and then nothing, ever.
      //
      // At clicker.perClick 2 (Sharper Eyes bought) this is 16 cash a click, so the first
      // booster is ~22 clicks. Clicking stays viable against the stands rather than being
      // token: it is the floor that guarantees recovery, and Act III is short enough that a
      // player who would rather click than wait should not be punished for it.
      clickCurrency: 'cash',
      clickLabel: 'Work the concession line',
      clickMultiplier: 8,
    },
    modifierBonuses: {},
    unlocks: ['field', 'roster', 'league', 'statUpgrades', 'concessions', 'cardPacks'],
  },
  {
    id: 3,
    name: 'Act IV — Travel Ball',
    description:
      "Weekend tournaments three towns over. Somebody's dad is keeping stats. Somebody's uncle is taking bets.",
    entry: 'The Little League title.',
    exit: { id: 'travelBallWinRateReached', description: 'Reach a 60% career win rate across two full travel seasons.' },
    rules: { leagueTeamCount: 8, gamesPerSeason: 15, secondsPerGame: 40, playoffTeams: 0 },
    modifierBonuses: {},
    unlocks: ['camp', 'trade', 'retirement', 'bookie', 'sponsorships'],
  },
  {
    id: 4,
    name: 'Act V — The Minors',
    description: 'A real stadium. A real payroll. The first time baseball is a business and not a game.',
    entry: 'A 60% career win rate over two travel seasons.',
    exit: { id: 'minorsPennantWon', description: 'Fill a 10,000-seat stadium and win the minor-league pennant.' },
    rules: { leagueTeamCount: 10, gamesPerSeason: 24, secondsPerGame: 50, playoffTeams: 0 },
    modifierBonuses: {},
    unlocks: ['ticketing', 'stadium', 'powerups', 'scouting'],
  },
  {
    id: 5,
    name: 'Act VI — The Big Leagues',
    description: 'Everything you have done was to get here.',
    entry: 'A full stadium and the minor-league pennant.',
    // Terminal act: winning the championship is the win condition, not a transition.
    exit: null,
    // Empty by design — Act VI defers entirely to the era config so today's prestige behaviour
    // is preserved exactly.
    rules: {},
    modifierBonuses: {},
    unlocks: ['playoffs', 'prestige'],
  },
];

const FINAL_ACT_INDEX = ACTS.length - 1;

// Unlike eras, the odyssey is a finite authored arc — prestige replays Act VI in place rather
// than extrapolating an Act VII. So this clamps instead of synthesising, and coerces garbage
// (a corrupt save, an undefined slice) to Act I rather than throwing.
function getActConfig(actIndex) {
  if (typeof actIndex !== 'number' || !Number.isFinite(actIndex) || actIndex < 0) return ACTS[0];
  if (actIndex > FINAL_ACT_INDEX) return ACTS[FINAL_ACT_INDEX];
  return ACTS[Math.floor(actIndex)];
}

module.exports = { ACTS, FINAL_ACT_INDEX, getActConfig };
