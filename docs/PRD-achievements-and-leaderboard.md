# PRD — Achievements, Records & the Score

**Status:** Draft for slicing
**Author:** Generated with Claude Code, 2026-08-23
**Target repo:** `idle-base` (React 18 + CommonJS, client-only, localStorage)
**Depends on:** `docs/PRD-incremental-odyssey.md` (the seven acts), `docs/PRD-act-seven-farm-team.md`

---

## 1. Problem

The odyssey has seven acts and no memory of how you got through them. `progression.actEnteredAtClock`
is overwritten at every transition, so the moment you leave Act III the game forgets it ever
happened. Nothing records that you took the wall three times running, or that you had money on a
5.5x line and it came in. A run that went brilliantly and a run that limped produce the same save
file and the same screens.

Three consequences:

1. **No reason for a second run.** Prestige replays Act VI; nothing replays the odyssey. There is
   no figure a returning player is trying to beat.
2. **The good moments go unwitnessed.** Wall ball and the Bookie are the two systems in the game
   that can go *spectacularly* right, and both resolve into a number in the wallet and a feed line
   that scrolls away.
3. **Nothing to compare.** Two players who both "finished" have no shared vocabulary for how.

## 2. Vision

Every run keeps a **record card**: how long each act took, what happened along the way, and a single
**score** derived from both. Achievements are the named things that happened; the score is what they
add up to. Finished runs stack up on your own board, so the game you already finished becomes the
opponent for the next one — and, if you choose to post it, on a **shared board carrying everybody
else's runs too**, served by a third-party API that we do not host and do not operate (§3.1).

Nothing here changes how the game is played, and nothing here requires the network. It is a layer
that watches, with two optional requests at the end of it (§3.1) and no consequence if either fails.

---

## 3. Binding decisions

### 3.1 DECISION: The board is SHARED, and WE HOST NOTHING — ever, in any tier, as a fallback

The board ranks every player's completed runs against each other, and it is served by a
**third-party leaderboard API called from the browser**. This is a hard constraint on the whole
feature, not a starting preference: there is no server to write, no container to run, no database to
back up, no domain to point and no bill to watch. The game stays a webpack bundle on static hosting
and gains two `fetch` calls. **Any proposal whose failure mode is "then we stand up a small
service" is out of scope by definition** — see the non-goals in §8, where it is the first entry.

**Recommended vendor: [Talo](https://trytalo.com/)**, on its **managed cloud free tier**: 10,000
players with all features included, no credit card, and paid tiers only if the game ever needs them
($24.99/mo at 100k players, $79.99/mo at 1M). We sign up and read a key out of their dashboard;
that is the entire operational surface. Three properties decided it over the alternatives:

1. **Its free tier is the most generous of the ones that are actually free.** 10,000 *players* with
   every feature, against LEADR's 10,000 *submissions per month* with vendor branding, against
   LootLocker's 1,000-MAU 30-day trial. On a game of this size the ceiling is never reached.
2. **It has a player/alias model.** Identity is an alias record rather than a name field retyped on
   every submit, which is what makes "one row per player" enforceable rather than aspirational.
3. **It is a game backend, not a scoreboard widget.** Leaderboards, players and stats are one
   product, so per-act boards (§9.5) or anything else later are configuration rather than a second
   vendor.

**On the "open source, self-hostable" line in their marketing: we are not using it and it is not a
reason we picked them.** It appears in the comparison below only as a tie-breaker on the day the
vendor disappears — and even then the answer is to **swap vendors**, not to run one. §3.2 is what
makes that cheap: the records key on the player's own machine is the source of truth, the board is a
projection, and repointing a projection at a different free tier is an afternoon.

#### The integration is TWO calls, not one

`POST .../entries` requires an `x-talo-alias` header, so the alias has to exist **before** the first
submission. Posting a run is therefore:

```
1. GET  https://api.trytalo.com/v1/players/identify?service=username&identifier=<local uuid>
        header: x-talo-access-key
        -> creates the player if that alias does not exist, and returns the alias (id, displayName)
2. POST https://api.trytalo.com/v1/leaderboards/idle-base-runs/entries
        headers: x-talo-access-key, x-talo-alias: <alias id>
        body:    { score, props: { …the record card's facts… } }
```

Both calls need the access key; the scopes are **`read:players`, `write:players`,
`read:leaderboards` and `write:leaderboards`** — `write:players` is not optional, because it is what
lets `identify` create a player rather than 404 on a first-time poster.

**`identifier` is a locally generated UUID, not the typed name.** The name is mutable and collides;
the alias `displayName` carries what is shown while the UUID stays the stable identity. Storing that
UUID with the posting profile (§4) is what makes a returning player update their own row instead of
minting a second one, and it is why re-identifying costs nothing on later runs.

#### The candidates, and why the others lost

Every row is judged on its **managed free tier**, because that is the only tier we will ever be on.
The last column is what happens if the vendor dies, and "self-hostable" earns a row nothing except a
slightly cheaper migration — it is never the plan.

| Service | Browser path | Managed free tier | Why not | If it dies |
|---|---|---|---|---|
| **Talo** | REST, no JS SDK | 10,000 players, all features, no card | **chosen** | Swap vendor; open source if anyone ever wants it |
| **LEADR** | REST (Unity/Godot SDKs only) | 10,000 submissions/mo, "Powered by LEADR" branding | Strong second: it claims tiered moderation and rate limiting, which Talo does not. Loses on a monthly *submission* cap and a thinner identity model | Swap vendor |
| **LootLocker** | REST; no JS/web SDK published | 1,000 MAU, 30-day **trial** | A trial is not a free tier, and it is engine-first (Unity/Unreal/Godot/GameMaker) | Paid or nothing |
| **Dreamlo** | REST + community `dreamlo.js` | Free, no signup, $5 for HTTPS | The write URL is a **private key the docs tell you to compile into your code** — anyone who opens the bundle can wipe the board | Nothing to recover |
| **Leaderboarded** | REST, `access-control-allow-origin: *` | 25 participants | A general-purpose scoreboard maker, not a game API; one token does read *and* write, and 25 players is not a public board | Swap vendor |
| **horizOn** | REST + SDK, `X-API-Key` | Unspecified | Undocumented limits and no anti-cheat claim at all | Unknown |


**Supabase and Firebase are not on this list.** They come up in every "leaderboard without a
backend" search result, and they are the wrong shape: a Postgres instance with a schema, row-level
security policies and a table to design is a **database we would own**, and owning a database is
the thing §8 forbids. A scoreboard needs two verbs — post a row, read the top rows — and neither
justifies an RDBMS. They are recorded here only so nobody re-proposes them in three months.

#### It is a shared wall, not a canonical ranking — say so on the screen

Every option above puts a **writable key inside a JavaScript bundle**. Talo included: the access key
ships in the client and `x-talo-alias` *identifies* a player without *authenticating* one. There is
no client-side arrangement in which submitted scores are trustworthy, and any PRD that implies
otherwise is lying to its implementer.

So the feature is designed as a **shared wall**: a place where runs are posted, not a canonical
ranking anything depends on. Four consequences, all binding:

* **Plausibility clamp before submit, not a flag after.** §6 already defines `SPEED_CAP` and `FLOOR`;
  a record card that violates either describes an impossible run and is **not submitted**. Refusing
  is cheaper and more honest than posting a row with an asterisk.
* **One row per player** — Talo's `unique` leaderboard mode updates the existing entry on
  resubmission rather than appending, so a board cannot be flooded from one client.
* **Submit the record card's FACTS, not just the total.** §3.3 makes the score derived; a stored
  total can never be re-checked, whereas stored per-act seconds and achievement ids can be re-scored
  when §6 is retuned, and can be sanity-checked against each other.
* **A failed submission is a no-op the player never sees.** This is the first network dependency in
  the codebase and the game is fully playable offline today. Nothing waits on the response, nothing
  blocks on it, and a rejected or timed-out POST leaves the local record exactly as it was.

#### The name

No accounts means a player-typed **display name**, capped at 24 characters, stored locally with the
records (§3.2) and reused on every submit so it is typed once. We do **not** filter it: a profanity
list is a losing arms race on a board this size, and the board is small enough to moderate by hand
through the vendor dashboard. The name is the only user-generated text that leaves the machine, and
the submission carries **no other identifier** — no email, no persistent device fingerprint beyond
the alias the vendor issues.

### 3.2 DECISION: Records live OUTSIDE the save, in their own localStorage key

`persistence/saveLoad.js` holds one key (`idle-base-save-v1`) and `clearSave()` deletes it. A career
record that lives in the save is erased by the first hard reset — which is precisely the act that
*completes* a run and creates the record worth keeping.

So: a second key, `idle-base-records-v1`, with its own reader/writer alongside `saveLoad.js` and its
own version number. It holds the completed-run history and the career achievement set. The
in-progress run's counters stay in game state (§4), because they are gameplay state that has to
survive a reload with everything else; they are *promoted* into the records key when a run ends.

**Corollary:** achievements are **career-scoped**, not run-scoped. `prestige.runStats` is the
existing precedent for the opposite; this is not that. Once earned, an achievement stays earned.

**And this key is the source of truth, not the remote board.** The vendor's board (§3.1) is a
*projection* of `idle-base-records-v1`, never the other way round. The game never reads its own
history back from the vendor, so a dead vendor, a lapsed free tier, a blocked request or an offline
player costs the shared wall and costs nothing else. Everything in §4-§7 works with the network
unplugged.

### 3.3 DECISION: The score is DERIVED, never accumulated

One pure `scoreRun(record)` in `engine/score.js`, recomputable from the record card at any time —
the same contract `engine/bookie.js` has with its prop board ("derived, never stored"). An
incrementally-accumulated score cannot be audited, cannot be re-tuned after the fact, and drifts.

The record card stores **facts** (seconds per act, counts, the achievement ids). The number is
computed on render. Retuning §6 retunes every historical run at once, which is the point.

### 3.4 DECISION: One evaluation site, inside `advance()`

Pillar 5 of the odyssey PRD: new simulation goes through `engine/tickEngine.js: advance()`, never a
second timer and never sprinkled through action handlers. A single pure
`evaluateAchievements(state)` returns the ids newly satisfied this tick; the reducer applies them.

Actions that are *instants* (a settled wager, a resolved rally) write a **counter** into state and
let the evaluator read it on the next tick. No handler unlocks an achievement directly, or the rules
end up in twelve files.

Unlocks announce themselves through `engine/feed.js` — the existing capped ring buffer — in a new
`achievement` category. No new notification channel.

### 3.5 DECISION: Time is measured in `state.clock`, and offline time counts

Every clock in the game is `state.clock` seconds, and `engine/offlineProgress.js` advances it
through the same `advance()` on return, capped at `balanceConfig.offlineCapSeconds`. Per-act
durations are clock deltas.

This means **idling counts against your time**, bounded by the offline cap. That is the correct
reading for a speed score: the fast run is the one that was *played*, and the cap stops an overnight
absence from being unbounded damage. An `activeSeconds`-only clock is listed as an open question,
not shipped — a second notion of elapsed time is a second thing to keep in sync with the first.

### 3.6 DECISION: An era sits inside one run, but it RESTARTS THE CLOCK

`engine/prestige.js: resetForPrestige()` re-enters at `PRESTIGE_ACT_INDEX` (Act VI) rather than Act
I and never touches `progression.milestones` — prestige is an Act VI replay axis, not a new game. So
a prestige does **not** close a record card and does not clear achievements.

**It does restart `state.clock` at 0.** An era is a fresh attempt at the last act, so it is timed
like one: act durations are clock deltas (§3.5), and a clock that kept running across the boundary
would make every post-prestige traversal look longer than the first by exactly however long the
first one took — which would mean the timing half of the score could only ever get worse by playing
more. Restarting it makes each era a comparably-timed attempt, and §3.8's best-time rule keeps the
fastest of them.

Everything that schedules off the clock has to restart with it. `season` is rebuilt outright and
`powerups.active` is emptied by the existing reset, so the two forward-looking gates that survive —
`clicker.nextClickAtClock` and `wallBall.nextChallengeAtClock` — are cleared explicitly rather than
left to another module's clamp. Historical stamps (`bookie`'s `placedAtClock`, the feed's entry
clocks) are deliberately left alone: they record when something happened in an era that is over, and
nothing schedules off them.

A **new game** (`clearSave()`) is still what ends a run; see §3.8.

### 3.7 DECISION: An act's recorded time is the BEST time, not the first

`record.actSeconds[act]` is a record in the sporting sense: a traversal that beats the standing entry
overwrites it, one that does not leaves it alone. Combined with §3.6's restarted clock, that makes
the era loop a real speedrun axis — each prestige is another timed attempt at Act VI, and the card
keeps the fastest.

The alternative (first traversal wins) makes the number a diary entry: true, unbeatable, and
worthless as a target. A player who gets faster should be able to see it.

### 3.8 DECISION: A run ends when Act VII is won OR the save is cleared, and promotion comes FIRST

Two shipped behaviours need this settled rather than deferred: §7.5's post prompt fires "when a run
ends", and §3.2's promotion moves `state.achievements.earned` into the career set — which
`clearSave()` would otherwise delete on its way past.

* **Winning Act VII** ends a run and promotes a **complete** record card.
* **`clearSave()`** ends a run and promotes a **partial** one, flagged as such and never ranked
  against a complete card. The alternative silently destroys the only evidence the run happened, at
  the exact moment the player is most likely to want it kept.
* **The ordering is promote-then-clear, and it is a hard sequencing constraint.** The run-scoped set
  lives in game state; the career set lives in the records key. A `clearSave()` that runs first has
  already thrown away what promotion was for.

**The evaluator dedupes against the RUN set, not the career set.** An achievement already in the
career collection can be earned again in a new run — it just does not appear twice in the
collection. Deduping against the career set would make run 2 score zero achievement points and would
quietly undo §6's run-scoped submitted score.

---

## 4. State model delta

Two new slices in game state, both **present-and-empty from t=0**, both read through a defaulting
accessor (`recordsSlice()`, matching `clickerSlice` / `bookieSlice` / `expeditionSlice`).

```js
// state.record — the run in progress. Promoted to the records key when the run ends.
record: {
  actSeconds: {},        // { [actId]: seconds } — appended at each transition, never overwritten
  startedAtClock: 0,
  counters: {            // instants, written by handlers, read by the evaluator
    bookieWins: 0, bestBookiePayoutMult: 0, bestPropPayoutMult: 0,
    wallBallStreak: 0, bestWallBallStreak: 0, showboatStreak: 0,
    undefeatedSeasons: 0, firstModuleAtClock: 0,
    bestShowboatStreak: 0,
    integrityViolations: 0,   // states that could not have been reached by playing — see `cheater`
  },
},
// state.achievements — ids earned THIS run. Merged into the career set on promotion.
achievements: { earned: [], seenIds: [] },
```

Plus one new field on the existing Act II slice: `wallBall.streak`, incremented on a win and reset
to 0 on a loss. `wallBall` has `wins`, `losses` and `lastResult` today and no streak — a streak is
not recoverable from a running total after the fact.

The records key (§3.2) carries three things game state does not: the completed-run history, the
career achievement set, and the **posting profile**.
The profile is `{ displayName, playerUuid, aliasId, postedRunIds }`: `playerUuid` is generated once
on this machine and is the `identifier` passed to `identify` (§3.1), `aliasId` is what that call
returns and what `x-talo-alias` needs, and `postedRunIds` is what makes "asked once per run" (§7.5)
survive a reload. A missing `aliasId` is not an error — it means identify has not run yet, and the
posting path runs it. None of it belongs in the save, because none of it belongs to a run.

**No `meta.version` bump.** Saves are never migrated in this repo; the precedent is the `salvage`
wallet key, which was added without a bump because every reader defaults an absent key. Same rule
here: an absent `record` reads as a run with no history.

**An existing save's earlier acts are UNRECORDED, not zero.** A player mid-Act-V when this ships has
no Act I-IV durations and never will. `actSeconds` omits them, the score skips them, and the record
card says "not recorded" rather than "0s" — which would otherwise be the best time in the game.

---

## 5. Achievements

Thirteen at launch. Each is `{ id, name, description, points, tier }` in `data/achievementsConfig.js`,
with the predicate in `engine/achievements.js`. Copy is data; rules are engine — the split every
other act config in this repo uses.

| id | Name | Trigger | Points |
|---|---|---|---|
| `first-collector` | Somebody Else's Hands | Buy your first collector in Act I | 5 |
| `wall-runner` | Three Straight | Win 3 wall-ball challenges in a row | 15 |
| `own-the-wall` | Nobody Else Gets a Turn | Win 10 in a row | 40 |
| `called-shot` | Called It | Win 3 in a row on **Showboat** | 35 |
| `long-shot` | The Long Shot | Settle a winning Bookie moneyline at `payoutMult >= 3.0` | 30 |
| `notebook` | The Other Page | Win a prop bet at `payoutMult >= 5.0` | 35 |
| `undefeated` | Nobody Beat Us | Finish a Little League season with zero losses | 25 |
| `pennant` | The Pennant | Win the minor-league pennant | 20 |
| `call-up` | You Said Yes | Accept the call-up into Act VII | 20 |
| `sifter` | Hands in the Wreck | Fund the first Reclaimer Drone within 60s of entering Act VII | 15 |
| `fifth-burn` | The Fifth Burn | Commit the fifth burn — win Act VII | 60 |
| `odyssey` | The Whole Way | Clear all seven acts in a single run | 80 |
| `cheater` | Nice Try | Reach a state the game cannot produce — see §5.3 | 0 |

### 5.1 On "3+ in a row in the first act"

Act I (`id: 0`, The Vacant Lot) has nothing winnable in it — it is one button and a shop. The first
contest in the game is **wall ball, in Act II**, so `wall-runner` is keyed there. The pattern
generalises as a per-act streak, and `own-the-wall` / `called-shot` are the same counter read at
different thresholds; adding a streak achievement to a later act costs a table row.

### 5.2 No achievement may count raw presses

`sifter` measures **how long the opening took**, not how many times the button was hit: the first
Reclaimer Drone, inside 60 seconds of entering Act VII. **Act VII declares no click cooldown**
(`data/acts.js`, which argues the case), so a press count is bounded by thumb speed rather than by
time and any threshold set against it is either trivial or a wrist injury.

The first draft read "funded from manual presses alone" and was **structurally always true**: before
the first module there is no other Salvage faucet in the act, so every player earns it by existing.
A time window is the same intent — did you actually work the opening? — expressed as something a
player can miss. 40 presses fund the Drone, so 60 seconds is about 1.5 presses a second: reachable
by anyone pressing, unreachable by anyone waiting.

The general rule: a predicate keyed on an **unthrottled player input** is not a record of anything.
Count outcomes, not inputs.

### 5.3 `cheater`, and why it is worth zero

An act cannot end before it began: `state.clock` only ever moves forward, in `advance()`, by a
non-negative delta. A negative act duration therefore means the save was hand-edited or the state
was driven from the console — so instead of silently discarding it (which is what a plausibility
clamp would do), the run's `integrityViolations` counter is incremented and `cheater` unlocks.

**It is worth 0 points and it takes nothing away.** No currency is removed, no run is deleted, no
score is zeroed, and the run is still submittable if it passes the §3.1 clamp. Punishing an edited
save is unenforceable — the client is the attacker's machine (§3.1) — and pretending otherwise
invites an arms race the game cannot win. What it does instead is make the thing *visible*: an
achievement named for what happened, on a wall that already admits it is not a verified ranking.

More detectors can be added to the same counter as they are found. The one that ships is the one
that is provably impossible rather than merely suspicious — a rule worth keeping, because a
false-positive `cheater` on an honest player is far more expensive than a missed real one.

### 5.4 On "beating the bookie at low odds"

`engine/bookie.js` freezes `payoutMult` onto the wager at placement, so it is on the record when the
wager settles — no re-derivation, and a player who buys reputation after placing does not retro-cheapen
their own achievement. Implied probability is `1 / payoutMult` before the house edge, so 3.0x is
roughly a 1-in-3 shot and 5.0x a 1-in-5.

Moneyline and props are **separate achievements at separate thresholds**, because the prop board's
odds are drawn from a wider range and lumping them together would make `long-shot` trivially
farmable from the other page. Wall ball's Showboat also carries a `payoutMult: 3` — it is a
different system and does not count toward either; `called-shot` is its equivalent.

---

## 6. The score

```
runScore(record) = Σ actPoints(act) + Σ achievementPoints(earned)

actPoints(act) = round(WEIGHT[act] × clamp(PAR[act] / max(seconds, FLOOR), 0, SPEED_CAP))
```

* `PAR[act]` — the authored target duration per act, in `data/scoreConfig.js`. Hitting par scores
  exactly `WEIGHT[act]`; half par scores double, subject to the cap.
* `WEIGHT[act]` — how much the act is worth at par. Later acts weigh more; the sum of weights at
  par is the round number the whole board is read against.
* `SPEED_CAP` (proposed 3.0) — the ceiling on the speed ratio. Bounded so a corrupt clock or a
  degenerate strategy cannot mint an unreachable score.
* `FLOOR` (proposed 30s) — a divide guard, and the same bound stated from the other side.
* An act that was not completed scores 0. An act that is **unrecorded** (§4) is skipped entirely,
  and the record card labels the run partial so it is never compared against a complete one.

Achievement points are flat and independent of time, which is what stops the score from being a pure
speedrun: `called-shot` and `notebook` reward taking the greedy line, and the greedy line costs
time. The two halves are meant to pull against each other.

**The SUBMITTED score counts only achievements earned in THAT run.** Achievements are career-scoped
(§3.2) and stay earned forever, which is right for a personal collection and wrong for a shared
board — a veteran's fresh run would otherwise open carrying forty points of other runs' history and
outscore a newcomer who played better. So `runScore()` takes the run's `achievements.earned`, not
the career set; the career set is what the Records tab displays and what never gets taken away.

---

## 7. Surfaces

1. **Records tab** — one screen, three blocks. The current run's card (per-act splits against par,
   live score, achievements earned); your own completed runs beneath it, best first; and the
   **shared board** beneath that, fetched from the vendor. Available from Act I; the odyssey PRD's
   rule that a screen appears when it has something to show means it stays empty-but-present rather
   than hidden.
2. **The shared board block** renders from `GET .../entries` and is **never** load-bearing: a
   pending fetch shows the two local blocks and a quiet line, and a failed one shows the two local
   blocks and a quieter line. It is refreshed when the tab is opened, not on a timer — one more
   reason there is no second clock (§3.4).
3. **Feed line on unlock** — `engine/feed.js`, category `achievement`. This is the whole
   notification design. No modal: an unlock lands mid-rally often enough that a modal would
   interrupt the thing being rewarded.
4. **Act transition split** — the existing act-transition beat gains one line: this act took
   *n*, par is *m*. It is where a split is meaningful and where the player is already reading.
5. **The post prompt**, and it is the only new interruption in the design. When a run ends the
   record card is written locally first, then the player is asked once whether to post it, with the
   name field (§3.1) inline. Declining is remembered for the session and never re-asked for that
   run — posting to the internet is a choice made per run, not a setting buried once.

---

## 8. Non-goals

* **Hosting anything, at any point, for any reason.** §3.1 is a hard constraint: no server, no
  container, no database, no serverless function, no self-hosted copy of the vendor's own open
  source, and no "just a tiny proxy to hide the key". If the answer to a leaderboard problem is
  "we could run a small service", the answer is no and the problem gets solved another way or gets
  dropped. A managed database counts: a schema and a policy set is a backend you maintain, wherever
  the machine happens to live.
* **Accounts, auth or profiles.** A display name and a vendor-issued alias, nothing more.
* **Verified or cheat-proof scores.** Impossible from a browser (§3.1). The clamp refuses nonsense;
  it does not make what remains trustworthy.
* **Moderation tooling.** Bad entries are removed by hand in the vendor dashboard in v1.
* **Save migration.** No `meta.version` bump, no backfill of unrecorded acts.
* **Achievement rewards.** These are records, not currency. The moment an achievement pays out, the
  evaluator becomes balance-critical and every predicate becomes an exploit surface.
* **Retroactive scoring of the current save.** A run already in progress scores from here forward.
* **A second timer.** §3.4.

## 9. Open questions

1. **`activeSeconds` vs `state.clock`.** §3.5 ships the clock. If offline catch-up turns out to
   dominate act durations in practice, an active-only counter becomes worth its cost — measure
   before deciding.
2. **One row per era?** §3.6 puts every era inside one record card. If the era loop turns out to be
   where the replay value actually lives, each era becoming its own row is the alternative — it needs
   a second notion of "run" and is not free.
3. **PAR values.** §6 defines the shape; the seven numbers need a play-through to set, and the Act
   VII opening figures in `data/acts.js` are the only measured pacing data in the repo today.
4. **Whose account?** Somebody signs up for the free tier and owns the dashboard login — that is
   the whole of the "operations" this feature has, and it is not hosting. The access key should
   reach the client through webpack `DefinePlugin` from an env var rather than being pasted into a
   source file — not for secrecy (it is public by construction, §3.1) but so rotating it is a
   build rather than an edit.
5. **One board or several?** A single all-time board is the simplest thing that works. Per-act
   boards ("fastest Act III") are the obvious follow-up and cost nothing but leaderboard names on
   the vendor side — worth deciding before the first one is created, since entries do not move
   between boards.
6. **Talo vs LEADR.** §3.1 picks Talo on free-tier headroom and the alias model. LEADR is the one
   candidate advertising rate limiting and tiered moderation out of the box, which is the single
   thing a shared wall actually wants and Talo does not claim. If junk entries turn up faster than
   they can be deleted by hand, that is the swap — and §3.2's "local is source of truth" is what
   keeps it an afternoon rather than a migration. Neither option involves running anything.
