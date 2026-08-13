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
      // The first act where the click is worth spamming, and therefore the first where it has
      // to be rate-limited. Untimed at perClick 2, a comfortable four taps a second is 64
      // cash/sec: all three boosters (350 + 900 + 2200) and all three per-click upgrades
      // (250 + 900 + 2600) bought inside two minutes, in an act budgeted at six to fourteen.
      // The concessions stands — the sink this act's economy is actually built around — are
      // simply skipped, because a tapping thumb outpaces every rate they can pay.
      //
      // Two seconds throttles the click to what it is WORTH per press rather than to what a
      // thumb can manage. 16 cash every 2s is 8 cash/sec, measured against this act's own
      // yardsticks: the cheapest sink, the 120-cash Lemonade Table, is 8 presses and 14
      // seconds; the first booster at 350 is 22 presses and 42 seconds. A player who would
      // rather click than wait still gets there noticeably faster than one who waits — which
      // is the point of the faucet — but 8 cash/sec now sits below a single Seed Bucket, so
      // building the stand is the better move and clicking is the floor beneath it. It also
      // means the press improves by buying per-click upgrades rather than by tapping harder,
      // which is the shop being the lever again.
      //
      // engine/clicker.js reads this key off act.rules directly, the same way clickLabel and
      // clickMultiplier above are read; it is not a balanceConfig field. Absent means zero, so
      // Acts I and II are deliberately untimed — Act I's entire game is the click, and Act II's
      // broke player is clicking back up to a minimum wager with the wall waiting on them.
      clickCooldownSeconds: 2,
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
      //                 buys nothing        stat upgrades only    + the sponsor board
      //   [30, 48]      7.6 / 75.8 min      2.0 / 20.0 min        2.0 / 20.0 min
      //   [36, 54]     11.2 / 112.0 min     2.3 / 22.8 min        2.0 / 20.4 min
      //   [42, 60]      9.0 / 90.0 min      3.1 / 31.2 min        2.3 / 23.2 min
      //
      // Every run that spent anything finished, at every band. The "buys nothing" column did
      // not: 4% of its runs failed to finish at [30, 48] and 96% at [42, 60], and that is the
      // one number here that is a deliberate choice rather than an observation.
      //
      // A fifteen-game season judged over a rolling two-season window is 30 games, and 30
      // games is too many for luck to rescue a team that never improves — where Act III's
      // six-game season could be stolen by variance. So a player who buys literally nothing
      // does stall. That is acceptable because it is not a dead end: the click is a cash
      // faucet in this act (see the press ceiling noted below), the cheapest stat upgrade is ~300,
      // and the "stat upgrades only" column above is what a player who spends that gets —
      // 100% finished, every band, no exceptions. Nothing is ever lost, and the way out is
      // always one purchase away. What is gone is finishing the act by waiting.
      //
      // [42, 60] is chosen on the same rule Act III's band was: it is where the shop is the
      // difference. At [30, 48] the act is over before the economy can matter — sponsors buy
      // nothing the stat-upgrade sink was not already going to buy — and the player wins their
      // first travel season, which is the wrong story for an act about being nobody in a
      // bigger league. At [42, 60] the first season is genuinely contested (8-7, 6-9, 5-10 in
      // sampled runs), the sponsor board is a 26% speedup, and the roster-only path lands at
      // 31 minutes, in the middle of the PRD's 25-35 minute budget.
      //
      // RE-MEASURED once act `modifierBonuses` were actually wired into computeModifiers (see
      // engine/modifiers.js). Until then the rookieQualityMult below was dead config and every
      // replacement arrived at full adult quality, which handed a stalled player a free
      // upgrade every offseason. The engaged columns barely moved — 3.2 seasons became 3.1 —
      // because a team that is already spending does not need the charity. The "buys nothing"
      // column is where it all was.
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
      // Three seconds, on the same rule that set Act III's two: throttle the click to what it
      // is worth per press, not to what a thumb can manage. 24 cash every 3s at perClick 2 is
      // 8 cash/sec — exactly what Act III settles at — so crossing the act boundary does not
      // quietly change how fast the faucet runs. What changes is the press, which grows with
      // the per-click upgrades. That ceiling has moved twice and is deliberately NOT restated as
      // a number here: data/concessionsConfig.js owns the per-click ladder and states the
      // current ceiling (perClick 77, so 924 a press and 308 cash/sec at this act's 12x) in the
      // one place it can be kept true. An earlier revision of this comment quoted 132, which was
      // wrong when it was written — it counted the three Act III caps rungs but not Sharper Eyes
      // or the Act II grit — and the ladder has since grown from three rungs to eight. Pressing gets better
      // because you invested in it, never because you tapped harder.
      //
      // Measured against this act's own yardstick, the ~300 stat upgrade the tuning note above
      // calls "always one purchase away": 13 presses from a standing start with nothing bought,
      // which is 36 seconds of waiting, or 3 presses and 6 seconds fully upgraded. The
      // stalled-player escape hatch that whole paragraph rests on survives intact — it is now a
      // bounded 36-second wait instead of a ten-second one, in an act budgeted at 25-35
      // minutes. A rate limit can lengthen that wait; it can never remove the way out.
      clickCooldownSeconds: 3,
    },
    // Rookies arrive at 0.6 quality rather than 1.0. Without this, the first offseason after
    // retirement unlocks replaces a 0.5-quality little leaguer with a full-strength adult and
    // team strength jumps ~2x for free — which is exactly what the unverified Act III behaviour
    // was doing before retirement was gated (see engine/tickEngine.js).
    modifierBonuses: { rookieQualityMult: -0.4 },
    // `walkup` is the first act with a PA system and a man holding the microphone, which is why
    // the record crate lands here and not in Act III's little league. It gates a mechanic inside
    // the already-visible Roster panel rather than a tab of its own, and unlocks are cumulative,
    // so it stays on through Acts V and VI. See data/walkupSongsConfig.js.
    unlocks: ['camp', 'retirement', 'bookie', 'sponsorships', 'walkup'],
  },
  {
    id: 4,
    name: 'Act V — The Minors',
    description: 'A real stadium. A real payroll. The first time baseball is a business and not a game.',
    entry: 'A 60% career win rate over two travel seasons.',
    exit: { id: 'minorsPennantWon', description: 'Fill a 10,000-seat stadium and win the minor-league pennant.' },
    // The click goes back to paying CAPS here, deliberately, and this is the one act boundary
    // where it changes currency in the direction of the older one.
    //
    // Until the caps shop existed this was an accident: Act V simply declared no override, the
    // click silently reverted to the default (bottle caps at 1x, labelled "Search the lot" — a
    // minor-league GM searching a vacant lot), and since caps bought nothing after Act III's
    // upgrades the endgame click paid in a currency with no sink. Adding a cooldown on top of
    // that would have made a worthless button also a slow one.
    //
    // What changed is that data/capsShopConfig.js gives caps a real sink from this act on, so
    // the click becomes its faucet. Cash is no longer the thing the click is for: ticketing is
    // live from Act V and pays orders of magnitude more than any button could, so a cash click
    // here is a rounding error that still asks to be pressed. Caps are the opposite — they
    // trickle in at 8-16/sec from collectors, dues and hands, and the shop's first rung is
    // 2,000. At 3x and a three-second cooldown a fully-upgraded presser roughly doubles their
    // caps rate, which turns the ladder from a passive wait into something worth tapping for.
    // That is also the fiction the shop is written in: you never stopped picking them up.
    rules: {
      leagueTeamCount: 10,
      gamesPerSeason: 24,
      secondsPerGame: 50,
      playoffTeams: 0,
      tradeWindows: [],
      clickCurrency: 'caps',
      clickLabel: 'Walk the concourse',
      clickMultiplier: 3,
      clickCooldownSeconds: 3,
    },
    modifierBonuses: {},
    // `capsShop` is the sink that makes the caps click above worth pressing — see
    // data/capsShopConfig.js for why it lands here and not in Act IV.
    unlocks: ['ticketing', 'stadium', 'powerups', 'scouting', 'capsShop'],
  },
  {
    id: 5,
    name: 'Act VI — The Big Leagues',
    description: 'Everything you have done was to get here.',
    entry: 'A full stadium and the minor-league pennant.',
    // Terminal act: winning the championship is the win condition, not a transition.
    exit: null,
    // Otherwise empty by design — Act VI defers entirely to the era config so today's prestige
    // behaviour is preserved exactly. None of the four click keys below is a balanceConfig
    // field and no era declares one (engine/clicker.js reads them straight off act.rules), so
    // none of them can collide with that deferral.
    //
    // The click keeps the caps identity Act V gave it, one notch better. It is the last act,
    // the caps shop is still the only thing caps buy, and its ladders run past 45,000 apiece —
    // an endgame faucet should keep pace with an endgame sink. The cooldown is unchanged from
    // Act III's rule, so the throttle never silently lifts at the last act.
    rules: {
      clickCurrency: 'caps',
      clickLabel: 'Kids at the rail',
      clickMultiplier: 4,
      clickCooldownSeconds: 3,
    },
    modifierBonuses: {},
    // `trade` lives here and nowhere earlier: a deadline is a big-league institution, and
    // Acts III-V declare `tradeWindows: []` so no window ever opens before it.
    unlocks: ['playoffs', 'trade', 'prestige'],
  },
];

const FINAL_ACT_INDEX = ACTS.length - 1;

// PRESTIGE_ACT_INDEX and FINAL_ACT_INDEX are both 5 today and they are NOT the same fact.
//
// FINAL_ACT_INDEX means "the end of the authored arc" — it is derived, and it is supposed to
// move when ACTS grows. PRESTIGE_ACT_INDEX means "the act a prestiging player is returned to",
// which is Act VI because that is where the `prestige` unlock lives and where legacy points
// start being earnable at endgame scale (changes/odyssey-progression-architecture/design.md,
// Decision 4). That is an authored decision about the shape of the endgame, not a fact about
// how many acts happen to exist.
//
// They coincide only because Act VI is currently last. Before this split, resetForPrestige()
// read FINAL_ACT_INDEX and got the right answer by luck: appending a seventh act would have
// made it 6, and every prestige would have teleported the player into Act VII, skipping the
// crossing entirely. That is why this is a literal and deliberately not `ACTS.length - 1`.
//
// It is also deliberately not derived from `unlocks.includes('prestige')`. A derivation would
// silently move the prestige floor the day someone edits an unlocks array, which is the exact
// class of accident this constant exists to prevent. Appending an act must not change this
// number; moving the prestige floor is a decision someone has to type out here.
//
// No assertion guards the literal on purpose: getActConfig() below clamps out-of-range indices
// to the last act, so a bad value degrades instead of throwing, and this repo has no test
// framework in which a throw from src/data/ would be caught before a player saw it.
const PRESTIGE_ACT_INDEX = 5;

// Unlike eras, the odyssey is a finite authored arc: there is no act N+1 to synthesise, so an
// index past the end has to be clamped rather than extrapolated. Act indices arrive from saves
// and from arithmetic on saves, so this also coerces garbage (a corrupt save, an undefined
// slice) to Act I rather than throwing.
//
// This clamp is about the ARC, not about prestige — it reads FINAL_ACT_INDEX and should keep
// reading it however many acts exist. The previous version of this comment explained the clamp
// by saying prestige replays Act VI in place, which fused two unrelated facts and is exactly
// the conflation PRESTIGE_ACT_INDEX above exists to undo.
function getActConfig(actIndex) {
  if (typeof actIndex !== 'number' || !Number.isFinite(actIndex) || actIndex < 0) return ACTS[0];
  if (actIndex > FINAL_ACT_INDEX) return ACTS[FINAL_ACT_INDEX];
  return ACTS[Math.floor(actIndex)];
}

module.exports = { ACTS, FINAL_ACT_INDEX, PRESTIGE_ACT_INDEX, getActConfig };
