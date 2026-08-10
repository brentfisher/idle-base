# PRD — Idle Base: The Odyssey

**Status:** Draft for slicing
**Author:** Generated with Claude Code, 2026-08-09
**Target repo:** `idle-base` (React 18 + CommonJS, client-only, localStorage)

---

## 1. Problem

Idle Base currently opens with the entire game unlocked: a full 15-man professional roster,
a 12-team league, a 33-game season, stadium economics, training camp, the trade deadline,
playoffs, and prestige eras — all visible on eight tabs from the first frame. The only
objective is "win the league."

Three consequences:

1. **No onboarding ramp.** A new player is handed a franchise-management sim with no idea
   which of eight tabs matters. Everything is available, so nothing feels earned.
2. **No progression arc.** Because every system is unlocked at t=0, there is no moment where
   the game becomes *new again*. The only novelty axis is prestige eras, which arrive after
   the entire game has already been seen.
3. **The game does not feel alive.** The simulation ticks once per second and resolves a game
   every 60 seconds, but the UI surfaces almost none of it. `HeaderStats` shows static totals;
   `RevenueTicker` shows a rate but no motion. Nothing pulses, counts down, or narrates. A
   player watching the screen cannot tell the game is running.

## 2. Vision

Turn Idle Base into an **odyssey in six acts** — starting as a bare-bones clicker in a vacant
lot and ending at the existing professional league simulation, which becomes the final act
rather than the whole game.

You begin by clicking to pick bottle caps out of the dirt. You buy a glove. You play stickball
off a wall. You get invited to a neighborhood league, then Little League, then travel ball,
then the minors, and finally the big leagues — where winning the championship is the ultimate
win. Each act introduces a genuinely new mechanic at the precise moment the previous one starts
to flatten out.

### 2.1 The central design insight

**Nearly every system the game needs already exists — it is just all switched on at once.**

The odyssey is built primarily by *rationing existing subsystems out over time* rather than by
writing six games' worth of new mechanics. The mapping is close to one-to-one:

| Act | Existing subsystem it unlocks |
|---|---|
| III — Little League | `engine/schedule.js`, `engine/standings.js` (in miniature) |
| IV — Travel Ball | `engine/trainingCamp.js`, `engine/tradeDeadline.js`, `engine/retirement.js` |
| V — The Minors | `engine/economy.js` (stadium/ticketing/attendance), `data/powerupsConfig.js` |
| VI — The Big Leagues | `engine/playoffs.js`, `engine/prestige.js`, `data/eras.js`, `data/perksConfig.js` |

Acts I and II are the only ones that require substantially new simulation code. Everything from
Act III onward is mostly **gating, scaling, and presentation** applied to code already in `src/engine/`.

### 2.2 Design pillars

1. **Every act ends by opening a door, not by raising a number.** The exit condition of an act
   is always "a new system unlocks," never "reach 10x the cash."
2. **Flat points are designed, not accidental.** Each act has an identified moment where the
   loop goes stale, and a specific unlock scheduled to land there.
3. **Risk is real but bounded.** Gambling mechanics can genuinely set you back. They can never
   soft-lock you (see §6.4).
4. **The game must visibly tick.** Cross-cutting requirement, shipped in Phase 1 (see §7).
5. **Reuse before invention.** New config follows the shape of `data/eras.js`; new simulation
   goes through `engine/tickEngine.js: advance()`, never a second timer.

---

## 3. Three architectural decisions (binding)

These three answers are load-bearing. Every downstream story depends on them, so they are
settled here rather than left to individual implementers.

### 3.1 DECISION: Early income flows through a generalized income-source list

**The problem.** `advance()` cannot produce Act I income as written:

```js
// engine/tickEngine.js — current
if (working.season.phase !== 'offseason' && step > 0) {
  const revenue = revenuePerSecond(working, modifiers) * step;
  working = addRevenue(working, revenue);
}
```

`revenuePerSecond()` reads `state.stadium.capacity` and `state.stadium.ticketPrice`, and
`attendanceFraction()` reads `state.season.schedule` and `state.reputation`. In Act I there is
no stadium and no schedule. Additionally, `findNextEventClock()` returns `Infinity` when no
season exists (it only considers `season.nextGameAtClock`, `playoffs.nextRoundAtClock`, powerup
expiry, and camp completion), so the loop takes one big step — mechanically fine, but it will
still try to price tickets for a stadium that does not exist.

**The decision.** Introduce `src/engine/income.js` exporting
`totalIncomePerSecond(state, modifiers)`, which sums the contributions of every *currently
unlocked* income source and returns a per-currency bundle:

```js
// returns e.g. { caps: 0.4, coins: 0, cash: 0 }
function totalIncomePerSecond(state, modifiers)
```

Contributors, each gated on its own unlock flag:

| Source | Currency | Unlocked | Notes |
|---|---|---|---|
| `collectors` | caps | Act I | count × rate per collector tier |
| `wallBallDues` | caps | Act II | small trickle from neighborhood games |
| `concessions` | coins | Act III | lemonade stand / snack table — proto-ticketing |
| `sponsorships` | coins | Act IV | flat per-second from sponsor deals |
| `ticketing` | cash | Act V | **wraps the existing `revenuePerSecond()` unchanged** |

`advance()` calls `totalIncomePerSecond()` instead of `revenuePerSecond()`. The
`phase !== 'offseason'` gate **moves inside the `ticketing` contributor** — it is a property of
ticket sales, not of income in general (bottle caps do not stop existing during an offseason).

**Why this and not act-branching in `advance()`:** the same path serves offline catch-up via
`engine/offlineProgress.js`, so branching by act would need duplicating there. A source list
keeps one code path and means each act's story adds a contributor rather than editing a
conditional every other act touches.

**Act I and II income must be rate-integrated, not event-driven.** `advance()` is bounded by
`balanceConfig.safetyCapIterations` (2,000) while `offlineCapSeconds` allows 8 hours (28,800
seconds). If early income were modelled as a per-second event, `findNextEventClock()` would
force ~28,800 iterations, hit the 2,000 cap, and **silently discard roughly seven hours of the
player's offline caps.**

So `findNextEventClock()` returning `Infinity` during Acts I–II is the *correct* behavior: with
no discrete events pending, the loop takes one large step and integrates
`totalIncomePerSecond() × step` in a single pass. Only genuinely discrete early events
(a wall-ball cooldown expiring) should register a clock target, and those are sparse.

Any future mechanic that adds frequent early events must revisit `safetyCapIterations` at the
same time.

### 3.2 DECISION: Locked content does not yet exist (it is not merely hidden)

`createInitialState()` currently builds everything eagerly — `createLeagueTeams()`,
`generateSeasonSchedule()`, `resetStandings()`, `buildTradeWindows()`, `createStartingRoster()`.

**The decision: act transitions are the initializer boundary.** A fresh game constructs only
what Act I needs. Entering Act III is what calls `generateSeasonSchedule()` for the first time.
Entering Act V is what creates `state.stadium`.

**Rationale.** Hiding is cheaper up front, but it means a 15-man professional roster and a
12-team league sit in state during the bottle-cap phase — semantically wrong, bloats every save
file from the first second, and `HeaderStats` / `RevenueTicker` / `FieldView` need
absent-value guards regardless. Since the guards are unavoidable either way, take the honest
data model.

**Critical carve-out — this rule applies to content, not to the tick loop's collections.**
Applied bluntly, "does not yet exist" breaks six separate lines in `advance()`, because the loop
body unconditionally dereferences slices that would be absent in Act I:

```js
expirePowerups(working)                                  // working.powerups.active
processCampCompletions(working.roster, working.clock)    // working.roster
updatePeakRating(working)                                // working.roster.filter
addRevenue(working, revenue)                             // working.prestige.runStats.totalRevenue
findNextEventClock(working)                              // working.season.phase / .nextGameAtClock
if (working.season.phase === 'regular') { ... }          // x3 phase branches
```

So the rule splits:

- **Player-visible content does not yet exist:** `stadium`, `league`, `season`, `playoffs`.
  These are `null` until their act's initializer creates them.
- **Tick-loop collection slices are present-and-empty from t=0:** `roster: []`,
  `powerups: { active: [], purchasedPermanentIds: [] }`, `prestige.runStats` zeroed. Iterating
  an empty array is free and correct; guarding every call site is neither.
- `season: null` gets **one** guard at the top of the phase-handling block in `advance()`, not a
  check per line.

**Consequence for story authors:** every act's story explicitly owns *creating* its content
fields. Components must treat pre-act content as absent (`state.stadium == null`), not as zero.
A shared `src/utils/guards.js` or consistent optional-chaining convention should be established
in Phase 1 so this does not get solved eight different ways.

### 3.3 DECISION: Acts reuse the era config shape; prestige resets to the Act VI floor

**Acts are configured like eras.** `data/eras.js` already implements exactly the abstraction
needed — a declarative stage with `rules` overriding `balanceConfig` plus additive
`modifierBonuses`, with `getEraConfig()` extrapolating past authored content. New file
`src/data/acts.js` mirrors that shape:

```js
{
  id, name, description,
  entry,            // human-readable entry condition
  exit,             // machine-checkable exit predicate id
  rules: {},        // overrides balanceConfig, same semantics as era.rules
  modifierBonuses: {},
  unlocks: [],      // feature flags switched on when this act begins
}
```

**Rules resolution order:** `balanceConfig ← act.rules ← era.rules`.

Note that `era.rules` is **not** processed by `computeModifiers()` today — only
`era.modifierBonuses` is. `rules` is read ad-hoc by consumers (`tickEngine.js:157`
`modifiers.era.rules`, `prestige.js:29-35` `era.rules.leagueTeamCount` / `gamesPerSeason` /
`tradeWindows`). Phase 1 should introduce a single `resolveRules(state)` helper in
`engine/modifiers.js` and route every existing ad-hoc read through it, so acts do not add a
third scattered override mechanism.

**This is not theoretical — it is already load-bearing for Act III.** Several `balanceConfig`
values are read *directly*, bypassing the override mechanism entirely. The clearest case:

```js
// engine/tickEngine.js:119 — reads balanceConfig, not era.rules
const top = sorted.slice(0, balanceConfig.playoffTeams).map((r) => r.teamId);
```

Act III's proposed `rules: { playoffTeams: 0 }` (a league with no playoffs) **would silently do
nothing** against this line.

`secondsPerGame` is the same bug and costs more. `runOffseasonTransition()` routes
`gamesPerSeason` through the era override but **not** `secondsPerGame`:

```js
// engine/tickEngine.js — inside runOffseasonTransition
const gamesPerSeason = eraRules.gamesPerSeason || balanceConfig.gamesPerSeason;  // overridable
...
secondsPerGame: balanceConfig.secondsPerGame,                                    // NOT overridable
nextGameAtClock: working.clock + balanceConfig.secondsPerGame,                   // NOT overridable
```

Acts III/IV/V specify 25s/40s/50s per game. All three would apply on entering the act and then
**silently revert to 60s at the first offseason transition** — quietly destroying the pacing
curve that most of §5 depends on.

Any `balanceConfig` field an act needs to override must be routed through `resolveRules()`
first. The Phase 1 story should audit every direct `balanceConfig.*` read in `src/engine/` and
convert the overridable ones — `playoffTeams` and `secondsPerGame` are the two known cases, and
there may be more. **This is a prerequisite for Acts III–V, not cleanup.**

The two axes do not actually collide in practice: Acts I–V always run at era 0, whose `rules` is
`{}`; Act VI declares `rules: {}` itself and defers entirely to the era. Era-last precedence is
chosen so prestige eras can still reshape the Act VI baseline as they do today.

**Modifier bonuses order:** `act ← era ← perks ← powerups`, extending the chain documented in
`engine/modifiers.js`. Acts are inserted first (most general).

**Prestige.** `resetForPrestige()` currently rebuilds the full professional roster, league, and
season and advances the era. Under an act system this would otherwise dump a prestiging player
back into the vacant lot.

**The decision: prestige resets to the Act VI floor, never below it.** Concretely,
`resetForPrestige()` additionally sets `progression.act = 5` (Act VI) and leaves all Act I–V
unlock flags permanently on. The odyssey is played exactly once per save; prestige is an Act VI
replay axis, as today.

**Legacy perks are not purchasable before Act VI.** The Prestige tab does not appear until Act
VI. `calculateLegacyPoints()` reads `runStats.championships / peakOverallRating / totalRevenue`,
all of which are Act VI-scale quantities; exposing perks earlier would require rebalancing the
entire perk tree against bottle-cap economics for no design benefit.

**`runStats` starts accumulating at Act VI, not at t=0.** `addRevenue()` accumulates into
`prestige.runStats.totalRevenue`, and `calculateLegacyPoints()` divides it by 100,000. If Acts
III–V revenue counted, the first prestige payout would be inflated by the entire odyssey's
earnings — a one-time windfall that distorts the perk tree exactly once, confusingly. Entering
Act VI zeroes `runStats`, making the first prestige run measure the same thing every later one
does.

### 3.4 Save compatibility

`persistence/saveLoad.js` **discards** any save whose `meta.version !== CURRENT_VERSION` and
starts fresh — there is no migration path. This work bumps `CURRENT_VERSION` to `2`, which is a
hard wipe of all existing `idle-base-save-v1` saves.

**Recommendation: accept the wipe.** Writing a migration that fabricates a plausible
progression state for an existing save is significant work whose only beneficiary is a save that
has, by definition, already seen all the content. Ship the wipe; optionally show a one-time
"the game has been rebuilt from the ground up" notice when a v1 save is discarded.

---

## 4. State model changes

New top-level slices (all created by Phase 1 unless noted):

```js
state.progression = {
  act: 0,                      // index into data/acts.js
  actEnteredAtClock: 0,
  milestones: {},              // intra-act boolean triggers, e.g. { firstCollector: true }
  seenTabs: [],                // drives the "NEW" badge on TabNav
  storyBeatsSeen: [],          // narrative cards already shown
}

state.wallet = { caps: 0, coins: 0, cash: 0 }

state.clicker = {
  totalClicks: 0,
  perClick: 1,                 // upgraded within Act I
}

state.income = {
  collectors: [],              // [{ tierId, count }]
  sponsorships: [],            // Act IV
}

state.feed = []                // capped ring buffer of tick events — see §7
```

**Unlock flags are derived, not stored.** `getUnlockedFeatures(actIndex)` returns the cumulative
union of `unlocks` arrays from acts `0..actIndex`. This is self-healing: retuning which act
unlocks a feature takes effect on existing saves without a migration. Only *intra-act* triggers
are stored, in `progression.milestones`.

**`state.cash` migrates to `state.wallet.cash`.** This is a mechanical rename touching
`economyActions.js`, `rosterActions.js`, `prestigeActions.js`, `HeaderStats.js`,
`PrestigePanel.js`, `Button.js` (the `cash` prop), and `initialState.js`. It should be its own
Phase 1 story, done before any act work, so later acts do not each special-case currency access.

**Currency progression:** caps (Acts I–II) → coins (Acts III–IV) → cash (Acts V–VI), plus the
existing legacy points (Act VI only). At each transition the old currency converts at a
documented rate and is retired from the header; it is never deleted from state.

---

## 5. The six acts

Summary table — full detail per act follows.

| Act | Name | Currency | Target duration | Core new thing | Exit opens |
|---|---|---|---|---|---|
| I | The Vacant Lot | caps | 3–5 min | Clicking, first automation | Wall ball |
| II | Off the Wall | caps | 8–12 min | Wall-ball subgame, crew, wagers | Organized play |
| III | Little League | coins | 15–20 min | Real seasons + standings, card packs | Roster depth |
| IV | Travel Ball | coins | 25–35 min | Camp, trades, retirement, the Bookie | Franchise economics |
| V | The Minors | cash | 30–45 min | Stadium, ticketing, powerups, scouting | The show |
| VI | The Big Leagues | cash | Open-ended | Playoffs, prestige, eras | **Win condition** |

Total first-playthrough target to reach Act VI: **~1.5–2 hours of active play**, materially less
with idle time between sessions.

---

### Act I — The Vacant Lot

> *You are nine years old. There is a vacant lot behind the hardware store, and there is money
> in the dirt if you know where to look.*

| | |
|---|---|
| **Entry** | New game |
| **Exit** | Purchase the Starter Kit (glove + ball + bat) — 140 caps total |
| **Currency** | Bottle caps. Scale: 1 to ~500 |
| **Duration** | 3–5 minutes |
| **Flat point** | Around click 30–40, raw clicking becomes tedious |
| **Relieving unlock** | The first auto-collector, affordable at 25 caps (~25 clicks) |

**Loop.** A single prominent button — *Search the lot* — yields `clicker.perClick` caps (base 1).
This is the entire game for the first ~30 seconds, by design.

**Numbers:**

| Purchase | Cost | Effect |
|---|---|---|
| Kid Brother (collector tier 1) | 25 caps | +0.2 caps/sec |
| Sharper Eyes (click upgrade) | 60 caps | +1 cap/click |
| Wagon (collector tier 2) | 120 caps | +0.8 caps/sec |
| Glove | 40 caps | Starter Kit item |
| Ball | 25 caps | Starter Kit item |
| Bat | 75 caps | Starter Kit item |

The first collector at 25 caps places the first automation squarely in the user's requested
"click 10–50 times" window. Clicking remains available for the entire game (see §6.4) but stops
being the primary income source within ~90 seconds.

**Clicking's long-term role:** it never disappears. From Act II onward it is reframed as
*Hustle* — a manual action with a short cooldown whose absolute value scales with the act but
whose relative value steadily declines. It is the anti-softlock guarantee.

**New state:** `progression`, `wallet.caps`, `clicker`, `income.collectors`, `feed`
**Files touched:** `data/acts.js` (new), `engine/progression.js` (new), `engine/income.js` (new),
`state/actions/clickerActions.js` (new), `components/lot/` (new), `actionTypes.js`,
`gameReducer.js`, `initialState.js`, `AppShell.js`, `TabNav.js`

---

### Act II — Off the Wall

> *A brick wall, a chalk strike zone, and every kid on the block wants a piece of you.*

| | |
|---|---|
| **Entry** | Own the Starter Kit |
| **Exit** | Win 5 wall-ball challenges **and** recruit 3 crew members |
| **Currency** | Caps (~500 to ~5,000), plus **Respect** (the reputation precursor) |
| **Duration** | 8–12 minutes |
| **Flat point** | Wall-ball rallies become repetitive after ~6–8 attempts |
| **Relieving unlock** | Crew recruitment at 3 wins — the first roster-shaped mechanic |

**Wall Ball subgame.** A challenge is a short resolved rally, not a twitch mini-game: the player
stakes caps, picks an approach (*Safe / Normal / Showboat* — increasing variance and payout),
and the outcome resolves against a simple strength check. It reuses `engine/gameSim.js`'s
Elo-style `winProbability()` with the player's kit quality as strength.

**Wagering (first risk mechanic).** The stake is capped at **25% of current caps**, and a loss
never reduces caps below the cost of one Hustle click. *Showboat* has roughly a 35% loss rate
with a 3x payout — a genuinely bad decision when made greedily at low balances, always
recoverable through idle income.

**Crew.** Winning challenges attracts neighborhood kids. A crew member is a stripped-down
`createPlayer()` — a name, one position, one visible stat — establishing the roster concept
three acts before the full `RosterPanel` appears.

**Respect** accrues from wins and is the gate on the Little League invitation. It becomes
`state.reputation` at the Act III boundary.

**New state:** `wallBall`, `crew`, `wallet` respect field
**Files touched:** `engine/wallBall.js` (new), `components/wallBall/` (new),
`engine/playerFactory.js` (simplified-player option), `data/acts.js`

---

### Act III — Little League

> *Real uniforms. Real umpires. Six games and a trophy nobody will remember but you.*

| | |
|---|---|
| **Entry** | 5 wall-ball wins + 3 crew |
| **Exit** | Win the Little League title (finish 1st in a 6-game season) |
| **Currency** | Coins (caps convert at 10:1). Scale: ~500 to ~20,000 |
| **Duration** | 15–20 minutes |
| **Flat point** | The 3rd repeated 6-game season with no new lever |
| **Relieving unlock** | **Card packs** mid-act, then the Travel Ball invitation at the title |

**This is where the existing simulation switches on, in miniature.** Act III's `rules` configure
`engine/schedule.js` and `engine/standings.js` down to a 4-team league and a 6-game season with
`secondsPerGame` reduced to ~25s so a full season resolves in ~3 minutes:

```js
rules: { leagueTeamCount: 4, gamesPerSeason: 6, secondsPerGame: 25, playoffTeams: 0 }
```

No playoffs yet (`playoffTeams: 0` — the champion is simply the standings leader). This proves
out the schedule/standings machinery at a scale the player can read at a glance, and is exactly
the kind of reconfiguration `era.rules` was already built to express — **provided the
`resolveRules()` work in §3.3 has landed**, since `playoffTeams` is currently read directly from
`balanceConfig` and would ignore the override.

**Unlocks:** `StandingsPanel`, `SeasonSchedulePanel`, `RosterPanel`, and stat upgrades
(`BUY_STAT_UPGRADE`, already implemented in `rosterActions.js`).

**Concessions** — the first passive coin income (a snack table at the field). Mechanically a flat
`coins/sec` contributor, deliberately shaped like ticketing so Act V's real economy feels
familiar rather than foreign.

**Card packs (randomness #2).** Coins buy a pack that yields one random player. Packs **always**
yield a usable player — the variance is in quality, never total loss. This is the "safe"
gambling mechanic, introduced before the punishing one.

**New state:** `season` (created here, not at t=0), `league`, `roster` (promoted from `crew`),
`income.concessions`, `cardPacks`
**Files touched:** `engine/schedule.js`, `engine/standings.js`, `data/acts.js`,
`components/league/`, `components/roster/`, `engine/cardPacks.js` (new)

---

### Act IV — Travel Ball

> *Weekend tournaments three towns over. Somebody's dad is keeping stats. Somebody's uncle is
> taking bets.*

| | |
|---|---|
| **Entry** | Little League title |
| **Exit** | Reach a 60% career win rate across two full travel seasons |
| **Currency** | Coins (~20,000 to ~500,000) |
| **Duration** | 25–35 minutes |
| **Flat point** | Stat-upgrade grinding with a static roster around season 2 |
| **Relieving unlock** | The Bookie at mid-act, sponsorships at exit |

**Unlocks three existing subsystems at once** — this is the act where the game stops being
simple:

- `engine/trainingCamp.js` → the Training Camp tab, `START_CAMP`
- `engine/tradeDeadline.js` → the Trade tab, `EXECUTE_TRADE`, trade windows
- `engine/retirement.js` → players age and retire; rookies arrive each offseason

Scale: 8 teams, 15 games, `secondsPerGame: 40`.

**The Bookie (randomness #3 — the punishing one).** A recurring NPC offers odds on your own
upcoming games. Betting on yourself and winning accelerates the act meaningfully; betting wrong
sets you back a real amount of time.

Bounds (per pillar 3): a single wager is capped at **20% of current coins**, at most one open
wager at a time, and the Bookie is unavailable when coins are below a floor equal to ~2 minutes
of passive income. A player can lose an hour of progress to bad bets; they can never lose the
ability to recover.

**Sponsorships** unlock at act exit — flat `coins/sec` contributors that scale with reputation,
bridging to Act V's economics.

**New state:** `bookie`, `income.sponsorships`; `roster` gains camp/age/retirement fields
**Files touched:** `engine/trainingCamp.js`, `engine/tradeDeadline.js`, `engine/retirement.js`
(all mostly gating only), `engine/bookie.js` (new), `components/bookie/` (new)

---

### Act V — The Minors

> *A real stadium. A real payroll. The first time baseball is a business and not a game.*

| | |
|---|---|
| **Entry** | 60% career win rate over two travel seasons |
| **Exit** | Fill a 10,000-capacity stadium **and** win the minor-league pennant |
| **Currency** | Cash (coins convert at 100:1). Scale: ~5,000 to ~5,000,000 |
| **Duration** | 30–45 minutes |
| **Flat point** | Pure revenue-accumulation grind once the stadium loop is understood |
| **Relieving unlock** | Scouting mid-act; the call-up to the big leagues at exit |

**The economy act.** `state.stadium` is created here, switching on the entire existing
`engine/economy.js` surface: `attendanceFraction()`, `revenuePerSecond()`, `stadiumUpgradeCost()`,
ticket pricing, and the `TicketingPanel` / `RevenueTicker` components. The `ticketing` income
contributor from §3.1 activates, and cash becomes the primary currency.

**Powerups** unlock (`data/powerupsConfig.js`, `BUY_POWERUP`), giving the player timed boosts —
the first mechanic that rewards active attention during otherwise idle stretches.

Scale: 10 teams, 24 games, `secondsPerGame: 50`.

**Scouting (randomness #4).** Sign prospects with **hidden stats** revealed only after signing.
A bust costs its signing fee and occupies a roster slot for a documented number of seasons —
a real, bounded, time-recoverable cost. Reuses `createPlayer()` with a wide `qualityMult` range.

**New state:** `stadium`, `powerups`, `scouting`
**Files touched:** `engine/economy.js` (gating only), `components/ticketing/`,
`engine/scouting.js` (new), `data/acts.js`

---

### Act VI — The Big Leagues

> *Everything you have done was to get here.*

| | |
|---|---|
| **Entry** | Full stadium + minor-league pennant |
| **Exit** | **Win the championship — the game's win condition** |
| **Currency** | Cash, plus legacy points |
| **Duration** | Open-ended |
| **Flat point** | Post-championship, the loop has nothing left to prove |
| **Relieving unlock** | Prestige and the era system — the existing endless replay axis |

**This is the current game, essentially unchanged.** 12 teams, 33 games, playoffs
(`engine/playoffs.js`), the victory modal already implemented in `AppShell.js`, and prestige
with the five authored eras in `data/eras.js` plus extrapolation.

Act VI declares `rules: {}` and defers entirely to the era config, so the existing
era-override behavior works exactly as it does today.

**Changes required here are small:**
- Act VI's `unlocks` array switches on the playoff and prestige tabs.
- `resetForPrestige()` sets `progression.act = 5` (see §3.3) so prestige never replays the odyssey.
- The existing championship modal gains an epilogue framing that lands the odyssey — the payoff
  for the preceding five acts.

**Files touched:** `engine/prestige.js`, `components/prestige/`, `components/playoffs/`,
`AppShell.js`

---

## 6. Cross-cutting systems

### 6.1 The progression engine

New `src/engine/progression.js`:

```js
getActConfig(actIndex)            // mirrors getEraConfig, extrapolation-safe
getUnlockedFeatures(actIndex)     // cumulative union of unlocks[] for acts 0..actIndex
checkActTransition(state)         // evaluates the current act's exit predicate
enterAct(state, actIndex)         // runs the act's initializers (see §3.2)
```

`checkActTransition()` is called from `advance()` once per loop iteration, after the existing
phase handling. This guarantees act transitions also fire correctly during offline catch-up —
a player who closes the tab in Act I and returns an hour later should arrive in Act II with the
intervening story beats queued, not stuck at a boundary.

### 6.2 Progressive UI reveal

`AppShell.js`'s `PANELS` map is currently static and all eight tabs always render. It becomes
filtered by `getUnlockedFeatures(state.progression.act)`. `TabNav` shows a **NEW** badge for any
unlocked tab not yet in `progression.seenTabs`.

Locked tabs are **not rendered at all** — no greyed-out teasers. The reveal is the reward, and a
visible locked tab spoils it.

### 6.3 Narrative layer

Each act begins with a full-screen story card (reusing `components/common/Modal.js`) carrying the
act title, a short piece of prose, and the new objective. Intra-act beats — first collector,
first crew member, first championship — surface as feed entries (§7). Text lives in
`src/data/storyBeats.js` alongside the other config, keeping prose out of components.

### 6.4 Risk without soft-lock

The four randomness mechanics escalate deliberately: card packs (no downside, variance only) →
wall-ball wagers (small bounded loss) → scouting (bounded loss plus opportunity cost) → the
Bookie (real, painful, bounded loss).

**The anti-softlock guarantee is mechanical, not incidental: manual clicking is available in
every act and can never be lost.** Because click income has a floor above zero, any state is
recoverable in bounded time. Every gambling mechanic is additionally capped as a percentage of
current holdings, so losses scale down as the player approaches zero and can never cross it.

This is a **hard invariant** and should be stated in `conventions.md` once implemented: no
mechanic may reduce a currency below zero, and no mechanic may remove the Hustle action.

---

## 7. Making the game feel alive (Phase 1, cross-cutting)

The single most-requested fix. Four components, all reading existing state:

**1. Tick heartbeat.** A small pulsing indicator in `HeaderStats` that animates on every
`TICK`. Unmistakable proof the simulation is running. Pair it with a live game clock
(`state.clock` formatted via the existing `formatDuration()`).

**2. Live event feed.** A capped ring buffer (`state.feed`, ~50 entries) written by
`engine/tickEngine.js` at every meaningful event — game resolved, camp completed, powerup
expired, player retired, act milestone hit — rendered as a scrolling broadcast log. This is the
highest-value item on the list: it converts an invisible simulation into a narrated one, and
`advance()` already knows every one of these events.

Because `advance()` can resolve many events in one offline step, the feed doubles as the
offline-progress summary: returning after an hour shows exactly what happened while away.

**3. Next-event countdown.** A progress bar toward `season.nextGameAtClock` (or the act's next
scheduled event). `findNextEventClock()` already computes precisely this value and currently
discards it — expose it.

**4. Floating gain numbers.** `+3` drifting up from the click button and from currency chips on
income tick. Small, purely presentational, disproportionate impact on game-feel.

Additionally, every currency in `HeaderStats` gains a live per-second rate beneath it, extending
what `RevenueTicker` already does for cash to all currencies and all acts.

---

## 8. Phasing

Six acts plus four randomness subsystems is more new game than currently exists. Phase 1 is a
**vertical slice**: a complete, playable, shippable experience on its own, and it de-risks every
later phase by proving the framework.

| Phase | Contents | Outcome |
|---|---|---|
| **1 — Spine** | Progression engine (§6.1), wallet refactor, income generalization (§3.1), Act I, Act II, full tick-feedback layer (§7), progressive tab reveal, save v2 | Playable clicker → wall ball → the Act III door. **Ship this before anything else.** |
| **2 — First season** | Act III, card packs, concessions, mini schedule/standings config | The existing sim proven at miniature scale |
| **3 — Depth** | Act IV, the Bookie, gating for camp/trades/retirement | Roster management arrives |
| **4 — Business** | Act V, stadium/ticketing gating, powerups, scouting | The full economy |
| **5 — The show** | Act VI reframe, prestige→Act VI floor, epilogue, narrative polish | Complete odyssey |

**Phase 1 is the only phase that must be built in order.** Phases 2–5 are each mostly gating plus
one new mechanic and could be reordered if playtesting suggests a different sequence.

**Suggested Phase 1 story breakdown** (for `/slice-prd`): the wallet refactor and the
income-source generalization should each be their own story and land *before* the Act I story,
since every subsequent act depends on both.

---

## 9. Success criteria

1. A new player is never shown more than one new system at a time; tab count grows from 1 to 8
   across the odyssey.
2. First meaningful automation is purchasable within 25 clicks / ~45 seconds.
3. A player can tell the game is running within 2 seconds of looking at it, without interacting.
4. Every act has an identified flat point with a scheduled unlock landing within ~3 minutes of it.
5. No sequence of gambling losses can put the game in an unrecoverable state.
6. Reaching Act VI takes ~1.5–2 hours of active play; winning the championship remains the
   ultimate win.
7. Prestige never replays Acts I–V.

## 10. Non-goals

- Multiplayer, accounts, or any server component. The game stays client-only.
- Save migration from v1 (see §3.4).
- Replacing the existing Act VI simulation. It is the destination, not the problem.
- Real-money mechanics. "Gambling" here is entirely in-game currency.
- Introducing TypeScript, a test framework, or a state library as part of this work. (A test
  framework is genuinely worth adding — `src/engine/` is pure and highly testable — but it is
  separate scope, not a prerequisite.)
- **Six distinct subgames.** Deliberate tradeoff: Act II's wall ball is the only fully new
  subgame. Acts III–VI are the *existing* season simulation reconfigured to four different
  scales, with the Bookie, card packs, and scouting layered on as mechanics rather than
  standalone subgames. This is what makes the odyssey buildable in five phases instead of
  fifteen — the novelty per act comes from a new *system* switching on, not from a new engine.
  If playtesting shows an act reads as "the same game again, bigger," §11.3 identifies where to
  invest.

## 11. Open questions

1. **Act durations are estimates.** The 1.5–2 hour target to Act VI needs playtesting; the
   `secondsPerGame` values per act are the primary tuning lever.
2. **Currency count.** Three currencies plus legacy points may be one too many; caps and coins
   could merge if Act II–III conversion feels like bookkeeping rather than progression.
3. **Wall-ball depth.** Act II's subgame is specified as a resolved check rather than an
   interactive mini-game. If Act II tests as the weakest act, this is the place to invest.
4. **Feed persistence.** Whether `state.feed` is saved to localStorage or rebuilt empty each
   session — saving it makes the offline summary richer but grows every save file.
