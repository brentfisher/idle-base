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
      // No trade deadline in little league. Nine-year-olds do not trade each other, and the
      // franchise code would otherwise open a window mid-season for a tab that should not
      // exist yet — see the `trade` unlock, which now belongs to Act VI.
      tradeWindows: [],
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
      //
      // RE-MEASURED when Act IV gated retirement to the act that unlocks it. Until then
      // checkRetirements() ran here too, replacing 0.5-quality little leaguers with
      // full-strength adult rookies every offseason — so a player who lost simply waited and
      // was handed a better team. Removing that free improvement lengthened the act by about a
      // fifth without changing which band is right: 30 runs each, now 5.6 seasons / 14.1 min
      // at 47% ignoring the shop, and 2.5 seasons / 6.3 min at 59% buying it. Every run
      // finished. The shop is still the lever; it is now a 2.2x speedup rather than 2.5x.
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
    // A rolling window over the last two completed seasons, not a running career average. The
    // PRD's sentence reads either way; only one of them is playable. See engine/travelBall.js.
    exit: {
      id: 'travelBallWinRateReached',
      description: 'Win 60% of your games across two full travel seasons.',
    },
    rules: {
      leagueTeamCount: 8,
      gamesPerSeason: 15,
      secondsPerGame: 40,
      playoffTeams: 0,
      // Still no deadline. See the `trade` unlock, which belongs to Act VI.
      tradeWindows: [],
      // Tuned by simulation against the act's own exit, which is the only way to tune a band
      // whose act ends on a WIN RATE rather than on a title — set it wrong and the act is not
      // slow, it is unfinishable. 30 runs per cell, each from a real Act III completion (the
      // little leaguers the player actually promoted, at whatever reputation their Act III
      // shopping left them: entry strength averages ~34.5), played to the exit. Seasons to
      // exit, and the simulated minutes they take:
      //                 buys nothing      stat upgrades only      + the sponsor board
      //   [30, 48]      9.9 / 98.7 min    2.1 / 21.0 min          2.0 / 20.0 min
      //   [36, 54]     11.6 / 116.3 min   2.4 / 23.7 min          2.1 / 20.7 min
      //   [42, 60]     13.0 / 130.3 min   3.2 / 32.0 min          2.2 / 22.0 min
      // No run at any band failed to finish.
      //
      // [42, 60] is chosen on the same rule Act III's band was: it is where the shop is the
      // difference. At [30, 48] the act is over before the economy can matter — sponsors buy
      // nothing the stat-upgrade sink was not already going to buy — and the player wins their
      // first travel season, which is the wrong story for an act about being nobody in a
      // bigger league. At [42, 60] the first season is genuinely contested (8-7, 6-9, 5-10 in
      // sampled runs), the sponsor board is a 31% speedup, and the disengaged path lands at 32
      // minutes, in the middle of the PRD's 25-35 minute budget.
      //
      // The "buys nothing" column is a strawman kept as a floor, not a target: it is a player
      // who never spends the cash Act III's stands are still producing. It is finite at every
      // band, which is the property that column exists to prove.
      aiTeamStrengthRange: [42, 60],
      // Retirement unlocks in THIS act, so this act is where it has to mean something. At
      // balanceConfig's [8, 14] nobody would age out inside a 2-4 season act and the unlock
      // would be invisible. Kids aging out of travel ball is also the honest fiction: three
      // to six summers is exactly how long you get before the next age bracket takes you.
      retireAtSeasonsRange: [3, 6],
      // A replacement is a twelve-year-old, not balanceConfig's 20-22 year old rookie. Paired
      // with the rookieQualityMult below: both halves are needed, or "retirement" reads as a
      // draft of grown men into a kids' league.
      rookieAgeRange: [12, 14],
      // The click stays the cash faucet it became in Act III — the act's sinks are all cash
      // and ticketing is still two acts away. 12 against Act III's 8 keeps it worth pressing
      // at travel-ball prices without letting a fast clicker outrun a full sponsor board.
      clickCurrency: 'cash',
      clickLabel: 'Work the tournament gate',
      clickMultiplier: 12,
    },
    // Rookies arrive at 0.6 quality rather than 1.0. Without this, the first offseason after
    // retirement unlocks replaces a 0.5-quality little leaguer with a full-strength adult and
    // team strength jumps ~2x for free — which is exactly what the unverified Act III behaviour
    // was doing before retirement was gated (see engine/tickEngine.js).
    modifierBonuses: { rookieQualityMult: -0.4 },
    unlocks: ['camp', 'retirement', 'bookie', 'sponsorships'],
  },
  {
    id: 4,
    name: 'Act V — The Minors',
    description: 'A real stadium. A real payroll. The first time baseball is a business and not a game.',
    entry: 'A 60% career win rate over two travel seasons.',
    exit: { id: 'minorsPennantWon', description: 'Fill a 10,000-seat stadium and win the minor-league pennant.' },
    rules: { leagueTeamCount: 10, gamesPerSeason: 24, secondsPerGame: 50, playoffTeams: 0, tradeWindows: [] },
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
    // `trade` lives here and nowhere earlier: a deadline is a big-league institution, and
    // Acts III-V declare `tradeWindows: []` so no window ever opens before it.
    unlocks: ['playoffs', 'trade', 'prestige'],
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
