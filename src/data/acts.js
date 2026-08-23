// The odyssey is seven acts, played once per save. An act is a stage of the game the same way an
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
// `hides` is the optional inverse: feature ids switched OFF from this act onward, drawn from the
// same id namespace as `unlocks` (a PANELS key retires a whole tab; anything else retires a
// mechanic). It exists because the arc eventually reaches an act that tears down what an earlier
// act built, and a cumulative-union-only config cannot express that at all. Omit the key for an
// act that retires nothing — that is every act today, which is why the key ships inert.
//
// `hides` beats `unlocks` when both name the same id, whatever order the acts sit in: the whole
// union is built first and the hidden ids are subtracted from it afterwards. engine/progression.js
// carries the reasoning; the practical consequence for an author editing this file is that
// re-listing an id in a later act's `unlocks` will NOT bring it back. Delete the `hides` entry.
//
// `unlockedBy` is the optional INTRA-act companion to `unlocks`: a map of feature id to the
// `expedition.phase` id (data/actSevenConfig.js EXPEDITION_PHASES) at which that feature actually
// appears. `unlocks` fires once, at the act boundary, and Act VII needs five of its six tabs to
// arrive over the two-plus hours that follow — so the ids sit in `unlocks` from the boundary and
// this map holds them back until the run has got far enough. The comparison is a RANK ("at least
// `lunar`"), never an equality test, and engine/progression.js owns it.
//
// It keys off `expedition.phase` and NOT off `progression.milestones`, which is where the PRD
// (§6.5) originally put it. Ledger R4 overruled that: engine/sites.js is the single writer of the
// phase field and it recomputes it from a pure predicate ladder every advance(), so a reveal keyed
// to it is self-healing for free. A parallel set of `phaseLunar`-style milestones would be a
// second source of truth for "how far into the act are we", and two writers on that question is a
// race that only ever shows up on somebody's real save.
//
// `exit` names the machine-checkable condition that ends the act. The engine owns the predicate
// (engine/progression.js); this file only names it. Act VII has no exit, because it is the end of
// the authored arc. Act VI's is the odd one in the table and worth keeping straight: winning the
// championship is the game's WIN CONDITION, not a transition, and prestige replays Act VI in place
// rather than advancing past it — so the thing that ends Act VI is not an achievement at all.
//
// It is `callUpAccepted`, a milestone exactly one player action sets and no engine path does (PRD
// Decision 3.2). There is deliberately no entry for it in EXIT_PREDICATES: isExitSatisfied() falls
// through to progression.milestones[id], and that fall-through IS the mechanism. A predicate would
// be a second way to satisfy the exit, and the whole point of this one is that there is exactly one
// — a player pressing a button in a modal that told them it was one-way.
//
// Opt-in on purpose. Act VII discards the ladder rather than being a rung on it, so a player who
// wants to keep managing the franchise declines and Act VI behaves as it always has, forever.
// `shortLabel` is the act's number as the header wears it — "Act IV" — and it is AUTHORED rather
// than derived, on the same rule `titleName` follows. `progression.act` is a 0-BASED INDEX, so a
// component rendering it would have to write `act + 1` and then map 5 to a Roman numeral; splitting
// `name` on its em-dash would be the same string-slicing one layer along. Both are a second place
// that knows how acts are numbered, and neither survives an act being inserted or renamed.
const ACTS = [
  {
    id: 0,
    name: 'Act I — The Vacant Lot',
    shortLabel: 'Act I',
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
    shortLabel: 'Act II',
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
    shortLabel: 'Act III',
    description: 'Real uniforms. Real umpires. Six games and a trophy nobody will remember but you.',
    entry: 'Five wall-ball wins and a crew of three.',
    exit: { id: 'littleLeagueTitleWon', description: 'Finish first in a six-game Little League season.' },
    // What topping the table is CALLED here. Set only on the acts that declare `playoffTeams: 0`
    // and end on the standings, which is Acts III and V — Act IV also has no postseason but ends on
    // an accumulated win rate, and Act VI has a real bracket and narrates its championship instead.
    // engine/tickEngine.js gates the offseason's trophy line on this field being present, so an act
    // that does not name a trophy does not claim one.
    titleName: 'the little-league title',
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
    shortLabel: 'Act IV',
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
    shortLabel: 'Act V',
    description: 'A real stadium. A real payroll. The first time baseball is a business and not a game.',
    entry: 'A 60% career win rate over two travel seasons.',
    // THE DESCRIPTION USED TO NAME A STADIUM AND A PENNANT, AND THE ACT COULD DELIVER NEITHER.
    // `playoffTeams: 0` below means this league has no postseason, so there was no bracket to win a
    // pennant in; and the capacity half was never read by anything. The exit is now the one thing
    // the act actually simulates and the player can see themselves do — finishing first, exactly as
    // Act III does. See the long note on the predicate in engine/progression.js.
    exit: { id: 'minorsPennantWon', description: 'Finish first in a minor-league season and take the pennant.' },
    titleName: 'the pennant',
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
    shortLabel: 'Act VI',
    description: 'Everything you have done was to get here.',
    entry: 'A full stadium and the minor-league pennant.',
    // NOT terminal any more, but not a rung either. Winning the championship remains the win
    // condition; this exit is what the player may choose to do AFTER winning it. `callUpAccepted`
    // is set by one action, from one modal, behind one confirmation — see the header comment above
    // for why it has no EXIT_PREDICATES entry, and data/storyBeats.js `act-7-offer` for the copy.
    exit: {
      id: 'callUpAccepted',
      description: 'Win the championship, then accept the call-up. This one is your choice.',
    },
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
  {
    id: 6,
    name: 'Act VII — The Farm Team',
    shortLabel: 'Act VII',
    description:
      'The trophy ceremony is interrupted. Baseball was an aptitude program, Earth is a farm team, and there is a call-up.',
    entry: 'Accept the call-up, after a championship.',
    // Terminal act, and the end of the authored arc — FINAL_ACT_INDEX is 6 and means it
    // literally. Winning is committing the fifth burn (PRD §7.8), which is a milestone the launch
    // story sets and not a transition, so there is nothing for an exit to name.
    exit: null,
    rules: {
      // The one rule that does the teardown's other half. `hides` retires the baseball TABS;
      // this retires the baseball SIMULATION, without deleting a byte of it (Decision 3.5).
      // engine/tickEngine.js gates the whole season-phase block on it, findNextEventClock() stops
      // proposing fixture and playoff clocks, and engine/income.js zeroes the ticketing
      // contributor — while `season`, `league`, `roster`, `stadium` and `powerups` stay in state,
      // valid and untouched. Nulling `season` instead would have been catastrophic rather than
      // merely wrong: AppShell early-returns a pre-season Lot shell when it is absent, so the act
      // that retires the ballpark would have rendered as Act I's vacant lot.
      seasonFrozen: true,
      // The click, per PRD §5.2. Salvage is an ordinary currency (data/currencies.js) and the
      // click is its faucet, which makes this act the one where the never-gated click matters
      // most: every shop in Act VII is Salvage-priced, so the button is the anti-softlock
      // guarantee for the whole act (engine/clicker.js's header, design Decision 6).
      clickCurrency: 'salvage',
      clickLabel: 'Sift the wreck',
      // A FLAT 8 Salvage per press, for every player, read by engine/clicker.js's clickValue().
      // It REPLACES the `perClick × clickMultiplier` calculation rather than scaling it, which is
      // why no clickMultiplier is declared here — declaring one would be dead config.
      //
      // The reason is `perClick`'s spread: it runs 2 to 77 across the eight concessions rungs (the
      // ceiling is recorded further up this file), so any multiplier leaves a 38x gap between two
      // players who reached the same act. Act VI tolerates that because caps are a side currency
      // there. Act VII cannot — it opens the way Act I opens, one button on one screen, and for
      // the first two minutes the click is 100% of the act's income. The gap between "two minutes
      // to your first Drone" and "three seconds" is the gap between an opening and a cutscene.
      //
      // MEASURED WHEN THE PRESS WAS THROTTLED: 8 / 3s = 2.667 Salvage/s put the first Reclaimer
      // Drone (320) at 118 seconds of pure clicking, against PRD §5.11's 90-130s target. That
      // target no longer binds the opening — see the deliberately absent cooldown below — but the
      // figure is kept, because it is the rate every module price in data/actSevenModulesConfig.js
      // was tuned against and it is still what a player pressing at the old pace gets.
      //
      // The click never gets better from here. Every improvement in this act is a module.
      clickFlatValue: 8,
      // NO clickCooldownSeconds, AND THE ABSENCE IS THE DECISION rather than an oversight. This
      // act declared three seconds, unchanged from every act since Act III. It now declares
      // nothing, which engine/clicker.js's clickCooldownSeconds() answers as 0: applyClick() leaves
      // `nextClickAtClock` untouched and the button renders the always-ready path Acts I and II
      // already use. Nothing in the engine or the UI needed changing to allow it, which is the
      // clearest evidence the throttle was config rather than mechanism.
      //
      // THE THROTTLE WAS PROTECTING A PACING TARGET, NOT AN ECONOMY. The click is Salvage's only
      // faucet, but it is a FLAT 8 that never improves for anybody (see above), so the fastest
      // possible presser still buys the same 320-Salvage Drone with the same 40 presses — they are
      // merely allowed to spend their own thumb instead of two minutes. A player who wants the
      // opening in forty seconds is not beating the act; they are doing the most laborious thing
      // in it. The idle path is untouched, because the idle path is modules.
      //
      // WHAT IT COSTS is the 90-130s opening above, knowingly. WHAT IT KEEPS is everything else
      // the click is: the anti-softlock guarantee for the whole act (engine/clicker.js's header,
      // design Decision 6), flat 8 for every player, and worth exactly as much per press as it was.
    },
    modifierBonuses: {},
    // Seven tabs replace twelve — §6.4's six, plus §7.8's `board` appended by STORY-032. All seven
    // are listed here because `unlocks` fires once, at the boundary; SIX of them are then held back
    // by `unlockedBy` below until the run reaches the phase that gives them something to show, and
    // `board` is held back the longest, until the act has been won. Declaration order here is not
    // tab order — AppShell's PANELS map owns that.
    //
    // Deliberately NOT listed: `salvage`. Currency ids are not feature ids anywhere in this file,
    // and adding one would not be cosmetic — HeaderStats.js:61 filters CURRENCIES by the unlocked
    // set and falls back to "whatever the player holds" only when that filter comes back empty,
    // which it always does today. Unlocking `salvage` would make Act VII the first act where the
    // filter matches, and the caps and cash chips would vanish from the header as a side effect of
    // a routing change. The Salvage chip appears on its own the moment the click credits any, and
    // the header's Act VII re-fit is PRD §6.7's story.
    unlocks: ['ops', 'fab', 'launch', 'sites', 'artifacts', 'contracts', 'board'],
    // The intra-act reveal. `ops` is absent on purpose: it is the act's fallback tab and the screen
    // the player reads for the first 20-30 minutes, which is the deliberate echo of Act I, where
    // the whole game was one button on one screen. One screen is not a punishment; it is the only
    // state a reveal can build from — but it must not be the only DOOR. See `fab` below, which was
    // held back for that same aesthetic and made the act unplayable.
    //
    // `launch` and `sites` key on `lifeSupport` rather than on PRD §7's `launchReady` capability
    // flag. R4 lets that flag stand as a design ruling, but nothing writes it yet — engine/sites.js
    // is a later story — and inventing a second gate KIND here to hold a flag that does not exist
    // would put two mechanisms in the shell for one question. The phase rank is never later than
    // the flag would be: the first Fuel tank is a `lifeSupport` purchase (PRD §5.3) and `lunar`
    // requires a completed launch, so both tabs must exist during `lifeSupport` regardless. The
    // cost of being early is a Launch tab that says you have no tank yet; the cost of being late
    // would be a player who cannot find the button that ends the phase. The sites story may
    // tighten these two entries to the flag once it owns a writer for it.
    unlockedBy: {
      // `fab` IS DELIBERATELY ABSENT, AND IT USED TO BE HERE AT `lifeSupport`. That was a hard
      // deadlock and it shipped: `lifeSupport` is reached by OWNING A MODULE
      // (engine/colony.js isLifeSupportPhase — "the first generator bought, deliberately the
      // crudest possible test"), and the only place in the game a module can be bought is the
      // fabrication tab. So the tab that ends the phase was gated behind the phase it ends. A
      // player who accepted the call-up got the Ops readout, the Salvage click, and no way
      // forward, ever — which is exactly how it was reported: "I can't do anything right after
      // the call up. I can sift the wreck but it's not clear what's next."
      //
      // The note under `launch` and `sites` below states the rule this violated, three lines
      // from the violation: "the cost of being late would be a player who cannot find the button
      // that ends the phase." Fab IS that button for the first rung, so it opens with the act.
      //
      // The act still opens on one SCREEN in the sense that mattered — Ops is the fallback tab and
      // the readout is what the player looks at — but the thing to do with the Salvage is now
      // reachable while it is being earned. A shop the act's own directive tells you to open
      // ("there is a generator design in the fabrication index") must be openable.
      launch: 'lifeSupport',
      sites: 'lifeSupport',
      artifacts: 'lunar',
      contracts: 'deepSpace',
      // The ending (PRD §7.8), and the only `unlockedBy` entry in the game that names the TOP rung
      // of a phase ladder. Everything above reveals a tab the player is about to need; this one
      // reveals the tab that says the act is over, and it must not appear a second early.
      //
      // `majors` is reached on the ARRIVAL of the fifth burn, not its commit — engine/sites.js's
      // overTheWallGrants() requires the milestone AND no wall record still in the air, and the
      // long note there explains why the two are twelve minutes apart. So this entry is also what
      // keeps that transit meaningful: during the burn the player has won and the board is not yet
      // there to look at, which is the last wait in the game and the one it has been earning.
      board: 'majors',
    },
    // The teardown. Twelve ids, every one of them a key of AppShell's PANELS map — that is the
    // whole ballpark, and nothing survives it.
    //
    // ONLY TAB IDS BELONG HERE, and the rule is not stylistic. Feature ids do double duty: an id
    // matching a PANELS key gates a tab, every other id gates a mechanic inside a panel. Three
    // mechanic ids would do real damage if they leaked into this list — `hustle` would remove the
    // manual click, which is never gated in any act and is this act's Salvage faucet; `retirement`
    // is read by tickEngine.js to decide whether checkRetirements() runs at all; `walkup` gates the
    // record crate in RosterPanel. `hustle` is the one that would be a project-invariant break
    // rather than a bug (design Decision 6): the click exists in every act, so that any state is
    // recoverable in bounded time.
    //
    // The near-miss worth recording: `concessions` and `sponsorships` are BOTH tab ids and income
    // contributor names, so hiding those two tabs looks like it switches off two income rails. It
    // does not. engine/income.js gates every contributor on its own slice contents — ticketing on
    // `state.stadium`, the rest on their arrays — and never on a feature id, so the caps and cash
    // trickles keep running in Act VII. That is correct: `seasonFrozen` freezes the SEASON, and the
    // only rail it takes down is ticketing, from inside that contributor.
    //
    // `lot` and `wallBall` are not listed even though Acts I-II unlocked them, because neither is a
    // PANELS key: they render only in AppShell's pre-season branch, which an act with a season can
    // never reach. Listing them would be inert config implying a teardown that does not happen.
    //
    // `prestige` is retired as a TAB and as nothing more (Decision 3.2, part 5): legacy points,
    // purchased perks and the era counter all stay in state and stay applied through
    // computeModifiers(), so a perk bought in Act VI still pays out here. What is gone is the
    // button, because prestige's reset is meaningless once the league it would reset is frozen.
    hides: [
      'field',
      'roster',
      'concessions',
      'sponsorships',
      'bookie',
      'ticketing',
      'capsShop',
      'league',
      'playoffs',
      'camp',
      'trade',
      'prestige',
    ],
  },
];

const FINAL_ACT_INDEX = ACTS.length - 1;

// PRESTIGE_ACT_INDEX is 5 and FINAL_ACT_INDEX is now 6. They HAVE diverged — the split below was
// authored while they still coincided, and appending Act VII is the edit it was written for. Every
// sentence of it survived the move unchanged, which is the point of having typed it out early.
//
// FINAL_ACT_INDEX means "the end of the authored arc" — it is derived, and it is supposed to
// move when ACTS grows. PRESTIGE_ACT_INDEX means "the act a prestiging player is returned to",
// which is Act VI because that is where the `prestige` unlock lives and where legacy points
// start being earnable at endgame scale (changes/odyssey-progression-architecture/design.md,
// Decision 4). That is an authored decision about the shape of the endgame, not a fact about
// how many acts happen to exist.
//
// They used to coincide, because Act VI used to be last. Before this split, resetForPrestige()
// read FINAL_ACT_INDEX and got the right answer by luck; Act VII has now made FINAL_ACT_INDEX 6,
// and under the old line every prestige would be teleporting the player into Act VII, skipping the
// crossing entirely and handing them a torn-down UI they never accepted. That is why this is a
// literal and deliberately not `ACTS.length - 1` — and it is no longer a hypothetical.
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
