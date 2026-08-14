# PRD — Idle Base: Act VII — The Farm Team

**Status:** Draft for slicing
**Author:** Generated with Claude Code, 2026-08-12
**Target repo:** `idle-base` (React 18 + CommonJS, client-only, localStorage)
**Companion doc:** `docs/PRD-incremental-odyssey.md` (Acts I–VI). Read §3 of that document first —
every decision here is layered on top of its three binding decisions.

---

## 1. Problem

The odyssey ends correctly and then stops. Act VI is terminal: you win the championship, you
acknowledge the victory, and the only thing left is prestige — the same league, reshaped by
`data/eras.js` rules, played again. That is a good *replay* axis and a bad *ending*.

Three consequences:

1. **The last novelty arrives in Act V.** Acts I–VI each introduce a genuinely new mechanic at
   the moment the previous loop flattens (odyssey PRD §2.2, pillar 2). After the stadium and
   powerups land in Act V, the remaining unlocks — playoffs, trade, prestige — are all
   *baseball*. A player who has spent two hours climbing from a vacant lot to the big leagues
   reaches the top and finds the ladder was the whole game.
2. **Prestige is a numbers axis wearing a story hat.** An era changes `leagueTeamCount` and
   `retireAtSeasonsRange`. It does not change what the player *does*. The eras file even admits
   this in its own comment: "players were sailing past the transition without noticing it."
3. **The frame is never broken.** Every act so far has answered the question "what is the next
   rung of organized baseball?" That question has no seventh answer. Nothing in the game has
   ever surprised the player about what kind of game it is.

## 2. Vision

**Act VII is the game revealing that it was never a baseball game.**

You win the championship. The trophy ceremony is interrupted. Every screen the player has spent
hours learning — the field, the roster, the standings, the shops, the bracket — tears itself
apart and does not come back. What replaces it is a bare terminal on a dead-quiet frequency,
and a single button that does not say *Hustle*.

The pretext: baseball is an **aptitude program**. It was seeded on Earth roughly 150 years ago
by something that needed pilots and could not simply hand over the manual — a species that
learns a control system by being taught it as a *game* internalizes it in a way that a species
handed a manual does not. Every element of the sport maps onto something operational:

| Baseball | What it was actually teaching |
|---|---|
| The pitch | A burn — thrust along a vector, committed to before you can see the result |
| The catch | Rendezvous and docking with a body on a ballistic arc |
| The diamond | A four-burn transfer between stations, returning to origin |
| Rounding the bases | Gravity assists, taken in the only order that works |
| The outfield wall | The heliopause. Nobody has hit one over it |
| Stealing | Departing on a window the other side has not closed yet |
| The strike zone | Insertion tolerance |
| A home run | A trajectory that leaves and returns without a rendezvous |

The player was not managing a franchise. The player was the **farm system**. Earth is a farm
team. There is a call-up.

### 2.1 What the act actually is, mechanically

A **traditional incremental** in the strict sense — the genre Act I gestured at and then left
behind. No teams, no roster, no schedule, no opponents. Instead:

- **Generators and consumers.** Power, Oxygen, and Provisions are produced *and consumed*
  continuously; the interesting decision is a net-rate balancing act, not an accumulation curve.
- **A hard currency you accumulate:** Salvage. Everything is bought with it.
- **A soft currency you spend in lumps:** Fuel. Every launch costs a threshold amount.
- **A ladder of sites.** Earth → Moon → the outer launch sites. Each colonized site is both a
  new production base and a new launch platform reaching somewhere the previous one could not.
- **Puzzles that are not signposted.** Artifacts and control panels that must be *understood*,
  not merely afforded — every one of them a piece of orbital mechanics dressed as an alien
  instrument, and every one of them solvable by a player who paid attention to the baseball
  metaphor above.
- **Side quests as fuel contracts.** Small bounded objectives that pay out a fixed number of
  Fuel units toward the next launch threshold.

### 2.2 Design pillars

Inherited from the odyssey PRD, plus two of its own:

1. **Every phase ends by opening a door, not by raising a number.** (Inherited.)
2. **Flat points are designed, not accidental.** (Inherited.)
3. **Risk is real but bounded; nothing can soft-lock.** (Inherited, and load-bearing here —
   see Decision 6. A puzzle nobody solves is a soft-lock, and this act is full of puzzles.)
4. **Reuse before invention.** (Inherited. The UI teardown is a *config* mechanism, not a
   second shell; resource ticking goes through `advance()`, not a second timer.)
5. **The reveal is paid for by the previous six acts.** Every alien-tech element must map back
   onto something the player already spent hours doing. A generator is a *bullpen*. The launch
   window is a *pitch clock*. Nothing is generically sci-fi; everything is baseball, rotated.
6. **Nothing that was learned is discarded — it is reinterpreted.** The teardown removes tabs.
   It does not remove *state*. The league plays on without the player, and the game says so.

---

## 3. Binding decisions

These are settled here rather than left to individual implementers. Every downstream story
depends on them.

### 3.1 DECISION: Acts gain a `hides` array; unlocks stay derived

**The problem.** `getUnlockedFeatures(actIndex)` (`engine/progression.js:22`) is a cumulative
union over `ACTS[0..actIndex].unlocks`. It can only ever *add* feature ids. "The game blows up
the UI" is not expressible in the current config at all.

**The decision.** Act config gains an optional `hides: [...featureId]`. `getUnlockedFeatures`
builds the union exactly as today, then subtracts every `hides` entry from acts `0..actIndex`:

```js
function getUnlockedFeatures(actIndex) {
  const current = getActConfig(actIndex);
  const features = [];
  const hidden = [];
  for (let i = 0; i <= current.id; i += 1) {
    ACTS[i].unlocks.forEach((f) => { if (!features.includes(f)) features.push(f); });
    (ACTS[i].hides || []).forEach((f) => { if (!hidden.includes(f)) hidden.push(f); });
  }
  return features.filter((f) => !hidden.includes(f));
}
```

**Why this and not a replacement `PANELS` map per act:** the derived-never-stored property is
the thing worth protecting (odyssey PRD §4). Retuning which act hides which tab must keep taking
effect on an existing save with no migration. A second shell would also fork every cross-cutting
concern — the feed, the toast host, the story card, the sticky click button — into two places.

`AppShell` needs no structural change: it already falls back to the first visible tab when the
active one stops being unlocked (`AppShell.js:64`). It renders a *set* of panels, and Act VII
hands it a different set.

**The teardown moment itself is presentation, not state.** The glitch/interference sequence is
derived from the act transition the same way `ToastHost` and the act intro `StoryCard` are —
see Decision 7 on idempotence. It must be safe to re-derive after an 8-hour offline catch-up
that crosses the boundary.

### 3.2 DECISION: Act VII follows Act VI; prestige pins to Act VI and the crossing is opt-in

**The problem.** Three things are hardcoded to "the last act is the endgame":

- `engine/prestige.js:73` — `resetForPrestige` ends with `enterAct({...}, FINAL_ACT_INDEX)`.
  Append a seventh act and prestige dumps the player straight into it, past the entire odyssey.
- `data/acts.js` — Act VI declares `exit: null`, documented as "its exit is the game's win
  condition, and prestige replays Act VI in place rather than advancing past it."
- `getActConfig` clamps above `FINAL_ACT_INDEX` rather than synthesising, on the same premise.

**The decision, in four parts:**

1. `data/acts.js` exports a new `PRESTIGE_ACT_INDEX = 5` alongside `FINAL_ACT_INDEX` (now 6).
   `resetForPrestige` uses `PRESTIGE_ACT_INDEX`. Prestige remains exactly what it is today: an
   Act VI replay axis. `FINAL_ACT_INDEX` keeps its literal meaning (`ACTS.length - 1`) and stops
   being overloaded to mean "the prestige floor." **This rename is its own Phase 1 story, landed
   before any Act VII content**, because it is a live bug the moment a seventh act exists.
2. Act VI gains `exit: { id: 'callUpAccepted' }` — a stored milestone in
   `progression.milestones`, set by exactly one player action and no engine path.
3. **Crossing into Act VII is an explicit, confirmed, one-way choice**, offered only once the
   player has won at least one championship (`prestige.runStats.championships >= 1`). The
   championship is still the win condition; Act VII is what is on the other side of it. A player
   who wants the franchise game forever never has to leave, and prestige keeps working for them.
4. **`checkActTransition`'s loop bound must be re-read, not just re-typed.** It is
   `while (working.progression.act < FINAL_ACT_INDEX && steps < FINAL_ACT_INDEX)`
   (`engine/progression.js:169`), and its comment currently justifies itself with "Act VI declares
   no exit, so this can never run past the final act." Both halves of that sentence stop being
   true. The loop stays correct — Act VI's new exit is a milestone no engine path can set, so the
   loop still cannot cross the boundary on its own — but the comment is now load-bearing
   *documentation of a different invariant* ("the last transition is player-gated"), and must be
   rewritten to say so. This is exactly the class of stale-comment bug this codebase's commenting
   style exists to prevent.
5. Act VII `hides` the `prestige` tab. Legacy points, purchased perks and the era counter stay
   in state and stay applied through `computeModifiers` — nothing is deleted, and a perk bought
   in Act VI still pays out in Act VII. The tab is retired because prestige's *reset* is
   meaningless once the league is frozen (Decision 3.5).

**Why opt-in rather than automatic:** the odyssey's acts all end on machine-checkable conditions
because they are rungs on one ladder. This one is not a rung; it discards the ladder. Making it
automatic would mean a player who won the championship and wanted to keep managing a franchise
gets their game taken away by a cutscene. The confirmation modal is the act's first real choice
and its thematic hinge: you are being scouted, and you can say no.

### 3.3 DECISION: Consumables integrate as net rates, clamp at zero, and throttle rather than fail

**The problem.** The entire income model is monotonic and additive: `totalIncomePerSecond()`
returns a per-currency bundle that is always ≥ 0, integrated over a step. Power, Oxygen and
Provisions are *consumed*. Two hazards follow, and both are real:

- **Offline catch-up.** `advance()` is the same code path for the live 1-second tick and for an
  8-hour return (`engine/offlineProgress.js`). A colony with a negative net rate integrated
  across 8 hours in one step goes deeply, arbitrarily negative.
- **Step-size error.** `findNextEventClock()` only knows about games, playoff rounds, powerup
  expiry and camp completion. If a resource crosses zero (or hits its cap) *inside* a step, the
  rate that applied for the second half of that step was wrong, and the error scales with how
  long the player was away.

**The decision, in three parts:**

1. **Every resource is clamped to `[0, capacity]` on every integration**, and a resource at zero
   **throttles** its dependents rather than destroying anything. Each consumer declares what it
   needs; a *satisfaction factor* (`available / required`, clamped to `[0, 1]`) scales its
   output. A colony starved of Power does not die — it produces nothing and waits, exactly as a
   player who spent all their caps in Act I still has the click. **There is no failure state, no
   colonist death, and no destruction of anything purchased.** This is pillar 3, and it is not
   negotiable: the whole point of an idle game is that walking away is safe.
2. **`findNextEventClock()` gains a colony-threshold contributor.** `nextColonyThresholdClock(state)`
   returns the earliest clock at which any resource would hit `0` or `capacity` at the current
   net rate, or `Infinity`. `advance()` then steps *to* that boundary, recomputes, and continues.
   An 8-hour return still resolves in a handful of iterations.
3. **Resource formulas must be linear in time within a step** — no compounding, no
   rate-depends-on-stock terms. This is what makes (2) a closed-form solve rather than a
   numerical search. Any proposal that needs a non-linear curve is out of scope; get the shape
   from tiers and multipliers instead.

**Two facts from the current code that constrain this.** First, `findNextEventClock()`
(`tickEngine.js:117`) returns `Infinity` whenever no discrete event is pending, and `advance()`
then takes the entire remaining time as one step (`tickEngine.js:447`). Today that is a feature —
the loop's own comment notes an 8h return "never approaches `safetyCapIterations`" precisely
because income is rate-integrated. Adding a resource that crosses a boundary mid-step is the
first thing in the game that makes `Infinity` wrong. Second, that `safetyCapIterations` bound now
has real pressure on it: four resources × two boundaries each, re-solved every iteration, is a
bounded but no longer trivial iteration count. **The story that lands `nextColonyThresholdClock`
owns re-deriving that cap and recording the worst-case iteration count it measured** — an 8h
return that silently hits the safety cap would under-credit the player with no error anywhere.

### 3.4 DECISION: One new slice (`expedition`), one new wallet currency (`salvage`)

`state.wallet` is monotonic accumulation, rendered as header chips, ordered cheapest-first in
`data/currencies.js`. Resources with capacity ceilings and negative rates do not fit that shape.

- **Salvage** joins `CURRENCIES` as a fourth entry. It is a normal currency: monotonic, earned,
  spent, shown as a chip. It is what the click pays in Act VII and what every shop costs.
- **Power / Oxygen / Provisions / Fuel** live in a new top-level `state.expedition` slice, read
  through a defaulting accessor in the `concessionsSlice()` / `wallBallSlice()` shape
  (`conventions.md`, "the most important pattern in the repo"). Saves are never migrated, so the
  slice must be readable when totally absent — an in-flight Act IV save must keep working.
- **No `CURRENT_VERSION` bump.** Nothing about this work invalidates an existing save. A v2 save
  mid-odyssey loads, gets `expedition` defaulted to empty, and never touches it until Act VII.

Fuel is in `expedition` rather than the wallet deliberately: it is not a *price*, it is a
threshold you fill and empty, it has a tank capacity, and it must not appear as a header chip
alongside currencies you spend continuously.

### 3.5 DECISION: The baseball simulation freezes; it is never deleted

`advance()` dereferences `state.season` every iteration, and `AppShell` early-returns a
pre-season shell when `!state.season` (`AppShell.js`) — nulling the slice would take the *whole
app* down the Act I/II path, not just the tabs.

Act VII declares `rules: { seasonFrozen: true }`. `advance()` reads it off the resolved rules
and skips season-phase progression, game resolution, and the `ticketing` income contributor.
`season`, `league`, `roster`, `stadium` and `powerups` all stay in state, untouched, exactly as
the championship left them.

This is also the honest fiction, and pillar 6: the league did not stop existing because the
player left. One of the act's best narrative beats is a background feed line, hours in, reporting
that your former club finished third.

### 3.6 DECISION: A puzzle never gates the only path forward

Deliberately opaque puzzles that block progression are how an idle game becomes a walkthrough.
Every puzzle in this act carries **three** ways past it:

1. **Solve it.** Free, instant, and the intended experience.
2. **Buy the hint ladder.** Each puzzle has 2–3 escalating hints priced in Salvage, the last of
   which is close to explicit. This is the act's main Salvage sink beyond generators.
3. **Brute-force it.** Every puzzle can be attempted repeatedly on a cooldown; the failed
   attempts are not punished beyond time. A player who never understands a single puzzle still
   finishes the act, slowly. This is the anti-soft-lock guarantee, and it is the same guarantee
   the Hustle click has provided since Act II.

Puzzle prose lives in a new `data/actSevenPuzzlesConfig.js` (a string literal in a component is
a bug — `conventions.md`). Validation lives in a pure `engine/puzzles.js` exporting
`checkAnswer(puzzleId, input)`. Solved/attempted flags go in `progression.milestones`, which is
precisely what intra-act triggers are for.

### 3.7 DECISION: Every number in this document is provisional until simulated

`src/data/` carries 30-run measurements behind its tuning bands (`acts.js` Act III/IV comments
are the template) because this repo tunes by simulation, not by feel. There is no test runner;
the gate is `npm run build` plus driving the pure engines under `node` with an injected
deterministic `rng` (`conventions.md`, "Testing").

Every duration budget, cost, and rate below is a **starting point for measurement**. A story that
lands a band without a comment recording the runs behind it is not done. Act VII is the longest
act in the game and the one with the most interacting rates — it is the act where feel-tuning
will fail most expensively.

---

## 4. State model changes

```js
state.expedition = {
  phase: 'aftermath',        // aftermath | lifeSupport | lunar | deepSpace | majors
  resources: {               // each { amount, capacity }
    power:      { amount: 0, capacity: 100 },
    oxygen:     { amount: 0, capacity: 100 },
    provisions: { amount: 0, capacity: 100 },
    fuel:       { amount: 0, capacity: 0 },
  },
  modules: [],               // [{ id, count }] — generators, scrubbers, farms, tanks
  sites: [],                 // [{ id, reached, colonized, launchPadTier,
                             //    buildingId, readyAtClock }] — see §7.7
  puzzles: {},               // { [puzzleId]: { solved, attempts, hintsBought } }
  contracts: [],             // active side quests — [{ id, progress, expiresAtClock }]
  launches: [],              // launch records, in flight AND completed — see §7.3
}

state.wallet.salvage = 0     // fourth currency, monotonic
```

`state.progression.milestones` gains `callUpAccepted` (set by the Act VI confirmation),
`overTheWall` (the act's win condition, §7.8), and one flag per puzzle solved. Nothing else is
stored: unlocks stay derived (Decision 3.1), and the teardown sequence is derived from the act
transition (Decision 3.1, last paragraph).

**Two notes on the sketch above, settled during integration:**

- **`launches` holds in-flight records too.** §4 originally described it as a completed-launch log.
  §7.3 folds the two together — an in-flight launch is a record with `resolved: false` and an
  `arrivesAtClock` — which makes arrival resolution idempotent by construction and needs no new
  field. That is strictly better than a separate `inFlight` slot, which would need reconciling.
- **`phase` is stored but self-healing.** It is recomputed from a pure predicate ladder every
  `advance()` and written only when it differs (§7.7), so a save that crossed several phase
  boundaries during an 8-hour catch-up lands on the right one. `engine/sites.js` is its single
  writer. This is the compromise between §4 binding a stored field and the codebase's
  derived-never-stored preference, and it is only acceptable *because* the recompute is pure.

---

## 4.1 Integration ledger — where the sections disagreed, and the ruling

§§5–10 were drafted in parallel against §§1–4. That is why they are internally deep and why they
conflict at the seams. **Where a number below contradicts one inside a section, this ledger wins**
— the section text is left as its author wrote it, because the reasoning around each number is
worth more than the number, and an implementer needs to see what a value was *for* before changing
it.

### R1. Fuel capacity has two sources, and §7's site grants are one of them

**The conflict, and it is the one that would have stalled the act.** §5.3 derives
`resources.fuel.capacity` by summing owned storage modules onto a base of 0, and instructs §7 to
"size every launch threshold against the tank ladder." §5's first tank, the Fuel Bladder, adds
**+400**. §7's first launch threshold is **1,200**. Under §5's rule as written, the opening launch
of the act is unreachable until the player buys three Bladders (~6,800 Salvage, at a point in
`lifeSupport` where income is 12–40/sec), and every later threshold fails the same way.

**Ruling: capacity is the sum of a site floor and module headroom, both derived.**

```
resources.fuel.capacity = Σ sites[].fuelCapacityOnArrival  +  Σ owned storage modules
```

§7.3 already specified `fuelCapacityOnArrival` at 1.6× the threshold of the launch departing from
that site, with Home Plate's 1,920 granted on the first tank purchase. That makes the 1.6×
overshoot rule structural rather than a coincidence between two sections' tuning, and it keeps
§5's derived-never-stored discipline intact — the sum simply has two terms. §5's storage ladder
becomes **optional headroom for banking past 1.6×**, which is what beat L-5's tank farms are for,
rather than the gate on whether a launch is reachable at all.

§5's sentence "§7 must size every launch threshold against the tank ladder, not against the Fuel
rate" is **overruled**. Thresholds are sized against the Fuel rate (§7.5); the tank follows the
threshold, not the other way around.

### R2. §7's Salvage costs were computed against a Salvage rate ~4× too low

§7.5 priced the colonization and pad ladder against assumed Salvage income of 10–95/sec, and said
plainly those were its least-confident numbers. §5.2 lands the actual bands at **40 → 220/sec in
`lunar`** and **220 → 900/sec in `deepSpace`**. §7's costs would be paid off in seconds.

**Ruling: hold §7's minutes-of-income — which is the design intent — and recompute the cost from
§5's band at that beat.** This is §7's own stated contract for what to do when §5 moved.

| Purchase | Beat | §5 rate there | Minutes of income (held) | §7 as drafted | **Reconciled** |
|---|---|---|---|---|---|
| Colonize On-Deck | L-1 | ~45 | 3.3 | 2,000 | **9,000** |
| The Mound (T2) | L-2 | ~70 | 5.0 | 3,600 | **21,000** |
| Colonize First Base | L-4 | ~130 | 6.0 | 8,600 | **47,000** |
| The Long Toss (T3) | L-5 | ~180 | 8.0 | 12,500 | **86,000** |
| Colonize Second Base | D-2 | ~280 | 8.0 | 21,000 | **134,000** |
| The Cutoff (T4) | D-3 | ~360 | 10.0 | 33,000 | **216,000** |
| Colonize Warning Track | D-5 | ~620 | 6.0 | 27,000 | **223,000** |
| The Swing (T5) | D-6 | ~780 | 12.0 | 68,000 | **560,000** |

**The open risk this creates, and it must be simulated before these are trusted.** §7's ladder and
§5's module ladder are now drawing on the same Salvage income in the same phases — §5's tier-3
modules (Orbital Sieve 48k, Fusion Ring 85k, ISRU Plant 150k, Cryo Farm 200k) are *also*
`deepSpace` purchases. The reconciled costs above assume the player spends roughly half their
Salvage on §7's ladder and half on §5's modules. **The first simulation to run for this act is the
combined Salvage sink across `lunar` and `deepSpace`**, because if the two ladders together exceed
income, the act stalls in exactly the phase that has the least slack (§7.6 puts `deepSpace`'s
no-contract case one minute inside its ceiling). If they conflict, §5's module growth exponents are
the cheaper lever to move — they are internal to one section, where §7's costs are load-bearing for
the pacing tables.

### R3. Contract payouts resolve per launch, not per phase

§9 built a 5% / 7.5% / 11% payout ladder against one threshold per phase (assumed 1,200 / 4,000 /
12,000). §7 has **five** launches across three Fuel-paying phases, at 1,200 / 4,200 / 13,500 /
21,000 / 42,000, and set a flat 8% with a 40% ceiling.

**Ruling: keep §9's escalating 5 / 7.5 / 11 ladder — an escalating shape is better than a flat one
— and resolve `payoutPct` against the threshold of the launch currently being filled**, which is
§7's model. §9 already specified `payoutFuel` as resolved at offer time from `payoutPct`, so this is
a change to what the percentage multiplies, not to the engine.

Per launch that is 23.5% from three contracts, comfortably inside §7's 40% ceiling. §7's flat 8% is
**superseded**; §7's 40% ceiling **stands**.

| Launch | Threshold | 5% | 7.5% | 11% | Three-contract total |
|---|---|---|---|---|---|
| L1 | 1,200 | 60 | 90 | 130 | 280 (23.3%) |
| L2 | 4,200 | 210 | 315 | 460 | 985 (23.5%) |
| L3 | 13,500 | 675 | 1,010 | 1,485 | 3,170 (23.5%) |
| L4 | 21,000 | 1,050 | 1,575 | 2,310 | 4,935 (23.5%) |
| L5 | 42,000 | 2,100 | 3,150 | 4,620 | 9,870 (23.5%) |

§9's overflow rule (`claim()` refuses when the lump would exceed `fuel.capacity`, rather than
silently destroying the remainder) is **correct and adopted** — it was the sharpest catch in the
fan-out. It composes with R1: at a tank of 1.6× threshold, an 11% payout always fits unless the
player is already above 89% full, which is a real decision rather than a trap.

### R4. `expedition.phase` is the single progression signal — no parallel milestones

§6 asked §5 to set `phaseLifeSupport` / `phaseLunar` / `phaseDeepSpace` milestones to drive
progressive tab reveal. §7.7 makes `engine/sites.js` the single writer of `expedition.phase`.

**Ruling: §6's `unlockedBy` keys off a phase-rank comparison against `expedition.phase`, not off
new milestones.** Two sources of truth for "how far into the act are we" is exactly the race §7.7
was written to prevent, and it would show up only on a real save. `expedition.phase` is
self-healing (recomputed from a pure predicate ladder every `advance()`), so a tab reveal keyed to
it is self-healing too. §5 supplies the `aftermath` and `lifeSupport` predicates as pure functions;
§7 supplies the rest; `sites.js` writes.

§7's `launchReady` gate for §6's `launch` and `sites` tabs **stands** — it is a capability flag,
not a progression signal, and there is no second writer.

### R5. One solve, one boundary helper, one `findNextEventClock` refactor

Three overlapping requests, one ruling.

- §6's `listResources()` is a **thin presentation wrapper over §5's `colonyRates(state, modifiers)`**,
  never a second solve. §5's `colonyRates` already returns `{ satisfaction, supplyThrottle, gross,
  demand, net, capacity }` — everything the header renders. If the header computes a rate the
  engine did not hand it, the header will eventually lie about when a resource bottoms out.
- §7 needs `spendResource(state, 'fuel', amount)`; §5's `engine/colony.js` **exports it**. Fuel is
  in `state.expedition.resources`, so `engine/wallet.js` is not the debit path and nothing outside
  `colony.js` reaches into the slice.
- §9's `contractUpkeepPerSecond(state)` is summed into the **consumer side before**
  `nextColonyThresholdClock` solves. An expedition contract that draws 3 Power/sec is a consumer
  like any other; if it is added after the solve, a contract can push a resource through zero
  inside a step, which is the precise failure Decision 3.3 exists to prevent.
- **§5, §7, §8 and §9 all add candidates to `findNextEventClock()`** (`tickEngine.js:117–132`) — a
  twelve-line function with four sections editing it, the highest-risk merge in this fan-out.
  **Ruling: a Phase 0 story refactors it to a contributor list first**, in the shape
  `income.js` already uses for income sources, so each later story appends one registration instead
  of editing shared control flow. This is the same argument Decision 3.1 of the odyssey PRD made
  for income, and it was right there too.

### R6. Smaller rulings

- **§9's `StoryCard.js:21–24` guard** (`{beat.objective && …}`) is required — Act VII beats have no
  objective block. One line, flagged by §9, adopted.
- **§8's items and hints are priced against §5's scale** (cheap 60–200, mid 1,400–9,500, top
  48,000–200,000) and must be re-checked against R2's inflated §7 ladder, since all three now draw
  on one Salvage pool. §8's hint ladder is the act's *elastic* sink — it is the right place to
  absorb a rebalance, because no pacing table depends on it.
- **§6 owns Act VII's click presentation; §5 owns the values** (`clickFlatValue: 8`,
  `clickCooldownSeconds: 3`). §10 owns `clickLabel`.
- **Beat ids are §10's**: `act-7-offer`, `act-7-intro`, `act-7-teardown`. §6 references them and
  does not define them.

### R7. Provenance — §5 and §8 have both since been revised

Both sections were first drafts in the original assembly; both have been revised and re-integrated.

- **§5** was rebuilt around an explicit **affordability budget** (§5.3): four phases, one Salvage
  stream, three ladders drawing on it. Its verdict is that **the ladders fit** — all four phases land
  within ±3% of budget, and the stretched case (full §8 catalogue, both optional Cryo purchases, no
  §9 contracts) runs **≈3.85 h**, against §12 criterion 8's 3.5–5 h band. §7.6's independently
  derived no-contract figure of ~4.05 h is the same number by another route, which is the closest
  thing to corroboration this document has. §5 also absorbed R1 (two-source Fuel capacity) and R5
  (the exports, including `spendResource`).
- **§8** was compressed and, more importantly, **re-priced relatively**: hint and instrument costs
  are now generated by a formula keyed to §5's income table rather than pinned to absolute constants,
  so the section regenerates instead of silently going stale. It also corrected a real error in its
  own first draft — the brute-forcer's banked-Salvage offset had been citing the act total rather
  than the graded-phase earn.

**The rulings that follow (R8, R9) exist because the two revisions ran in parallel.** §5 moved the
income bands that §8's new formula reads from. That is the same seam failure this ledger was created
to catch, one level down, and it is why R8 is a recomputation rather than a rewrite.

### R8. §5's revised bands moved; §8's phase constants recompute from them

§5.2 now publishes the authoritative bands, and two of them changed — `aftermath` from 2.7→12 to
**2.7→26**, and `lifeSupport` from 12→40 to **26→45** — because the draft's tier-1 ladder could not
actually produce the old figures. §5's `lunar` and `deepSpace` rows are held, so **R2's reconciled §7
cost ladder stands unchanged.**

§8's pricing machine is `R(phase) = sqrt(entry × exit)`, with `hintCost = HINT_TIER_SECONDS[t] × R`
and only three authored constants (T1 8s / T2 26s / T3 80s). §5 endorsed that machine explicitly —
"the two-table formula in §8.5 is the right *machine*; only its phase column moves."

**Ruling: keep §8's formula and all three tier constants; recompute `R` from §5's final table.**

| Phase | §8 as revised | **Recomputed from §5's final bands** | Factor |
|---|---|---|---|
| `aftermath` | 5.7 | **8.4** (`√(2.7 × 26)`) | ×1.47 |
| `lifeSupport` | 21.9 | **34.2** (`√(26 × 45)`) | ×1.56 |
| `lunar` | 93.8 | **99.5** (`√(45 × 220)`) | ×1.06 |
| `deepSpace` | 445 | **445** (`√(220 × 900)`) | — |

Every absolute price in §8.5 and §8.4 is a derived column and must be regenerated at these values;
§8 labelled that column regenerate-don't-edit for exactly this reason. **§5's independent
cross-check** — full hint ladder at 3–5% of a phase's integrated Salvage, top instrument at 2–3% —
should be run against the regenerated numbers as a second opinion; where the two disagree, §8's
formula wins on shape and §5's percentage wins on magnitude, because §5 owns the income.

### R9. §8's brute-force multiplier must come down to ≤1.3, and the 1.5× clause is retired

§8.6 proves the act is finishable by a player who solves nothing and buys no hints, and bounds that
player's slowdown. Its argument leaned partly on the brute-forcer banking Salvage they would
otherwise have spent on hints — but against §5's measured lifetime earn of **≈2.81M**, that bank is
**0.7%**, so the offset it assumed is gone.

The arithmetic that matters: the stretched act is **3.85 h**. At §8.6's stated worst bound of 1.5×
that is **5.8 h**, which breaches §12 criterion 8's 5-hour ceiling. At 1.3× it is **5.0 h** — exactly
on it.

**Ruling: `attemptsToBypass` comes down until the *measured* ratio is ≤1.3, and §8.6's "never worse
than 1.5×" clause is retired.** This is a tuning obligation on the §8 implementing story, not a
redesign: the bypass counter was always specified as a ceiling on the worst case rather than a pace
(§8's own note on P5), so lowering it costs nothing a deducing player will notice. The measurement is
the acceptance criterion — a ratio asserted rather than measured does not discharge this.

---

## 5. The resource economy

> *The frequency is dead. The hull is intact. Everything else on this rock is somebody else's
> broken equipment, and it is all yours now.*

This section owns every rate and every module price in Act VII. §7 sizes launch thresholds against
the **Fuel rate** here (R1); §8 prices hints against the **Salvage bands** here; §9's contracts pay
into a Fuel tank whose capacity is the sum of §7's site grants and this section's storage (R1).

**What changed from the first draft.** The draft priced modules in isolation. Read against §7's
reconciled costs (R2) and §8's catalogue — all three drawing on **one** Salvage stream — the combined
sink exceeded income by ~4× in `lifeSupport` and ~2× in `deepSpace`. §5.3 is the affordability budget
that finds this; §5.4 is the repriced ladder. Per R2 the lever moved was **this section's base costs
and growth exponents**, never §7's ladder: §7's costs are load-bearing for its pacing tables and this
section's are not.

### 5.1 The shape of the economy, and why it is this shape

Five quantities, and each exists because it forces a **different** decision. Three resources that are
all "a number that goes up" is the failure mode this section is written to avoid.

| | What it is | The decision it creates |
|---|---|---|
| **Salvage** | Hard currency. Monotonic, spent, never consumed. | *What to buy next.* The ordinary incremental decision. |
| **Power** | The shared bus. Every module draws from it. | *Headroom before purchase.* Buying anything raises your draw; the question is always "generator first, or the thing I actually want?" |
| **Oxygen** | Flat per-site and per-pressurized-module drain, independent of output. | *How long you can walk away.* Oxygen capacity is literally your offline budget. |
| **Provisions** | Staffing. Consumed by the highest-output modules — reactors, refineries, sieves. | *What to keep running.* The only resource whose scarcity forces something to throttle. |
| **Fuel** | Lump-sum launch threshold, with a tank. | *When to leave.* You cannot bank a launch you have no tank for. |

The interlock — the act's actual game — is that **Power buys Provisions and Provisions buy Power**:

```
                 ┌──────────────── Fission Pile ◄─── Provisions
                 │                                        ▲
   RTG ──────────┼──► POWER ──► Hydroponics Bay ──────────┘
   Solar Wing ───┘      │  │
                        │  ├──► Scrubber ──────► OXYGEN
                        │  ├──► Reclaimer Drone ──► SALVAGE
                        │  └──► Electrolysis Stack ──► FUEL
                        │
   OXYGEN ◄── drained flat by each colonized site and each pressurized module
   PROVISIONS ◄── drained by each STAFFED module (Fission, Electrolysis, Reclaimer, Ice Harvester)
```

Every Power source above the first tier costs Provisions to staff; every Provisions source costs
Power to run. That loop makes the ladder a decision rather than a purchase order, and it is why
§5.6's satisfaction math has to be right rather than approximately right.

**The RTG has no inputs, and that is load-bearing.** It is the cheapest module in the act (90
Salvage) and the only generator that needs nothing. Without an input-free generator the
Power/Provisions loop has a stable fixed point at exactly zero — a colony that collapses and cannot
climb out (§5.6, Example B). The RTG is the colony's version of the Hustle click: structurally, not
by tuning, the thing that makes every state recoverable in bounded time.

**One correction to §7.** §7.1 calls On-Deck "the only passive Salvage income in the act," which is
incompatible with a Reclaimer Drone ladder running from minute two of `aftermath`. It should read:
*the only site that produces Salvage on its own, and the site that unlocks the Orbital Sieve.*

### 5.2 The click, and the authoritative Salvage bands

```js
// data/acts.js, Act VII rules
rules: { seasonFrozen: true, clickCurrency: 'salvage', clickLabel: 'Sift the wreck',
         clickFlatValue: 8, clickCooldownSeconds: 3 },   // clickFlatValue is a NEW key
```

**2.67 Salvage/sec, identically for every player.** `clickValue()` (`engine/clicker.js:53-59`) is
today `max(1, clicker.perClick × act.rules.clickMultiplier)`, and `perClick` spans **2 to 77** across
the eight concessions rungs (`data/acts.js:207` records the ceiling) — at any multiplier, a **38×
spread on the only income the act has for its first two minutes.** Act VI tolerates that because caps
are a side currency there; `aftermath` cannot, because it opens the way Act I opens (one button,
nothing else) and the gap between *two minutes to your first Drone* and *three seconds* is the gap
between an opening and a cutscene.

```js
// engine/clicker.js — clickValue(), prepended. An absent clickFlatValue is today's behaviour
// exactly, so Acts I-VI are untouched and perClick is neither read nor written here.
const flat = actClickRules(state).clickFlatValue;
if (typeof flat === 'number' && Number.isFinite(flat) && flat > 0) return flat;
```

`clicker.perClick` stays in state and would still apply if a later era wanted it — pillar 6,
reinterpreted rather than discarded. **The click never gets better:** every improvement in the act is
a module instead. It is 100% of `aftermath`'s opening income, ~10% at that phase's exit, 0.55% by the
end of `deepSpace`. The first Reclaimer Drone (320) is **120 seconds of pure clicking**, against
§5.11's 90–130 s target.

#### The bands — §7 and §8 derive from this table

**These are authoritative.** §7's reconciled cost ladder (R2) was computed from the `lunar` and
`deepSpace` rows and both are held unchanged. The `aftermath` and `lifeSupport` rows moved (from
2.7→12 and 12→40) because the draft's tier-1 ladder could not produce them — see §5.3.

| Phase | Duration | **Salvage/sec** | Integrated over the phase | Exit reached by |
|---|---|---|---|---|
| `aftermath` | 20–30 min | **2.7 → 26** | **15,400** | click + 8 Reclaimer Drones |
| `lifeSupport` | 45–60 min | **26 → 45** | **108,200** | + 1 Wreck Crawler |
| `lunar` | 60–80 min | **45 → 220** | **430,000** | + 3 Crawlers, 1 Orbital Sieve |
| `deepSpace` | 60–90 min | **220 → 900** | **2,259,000** | + 5 Orbital Sieves |
| `majors` | open-ended | **900+** | — | standing orders (§7.8) |
| | | **Lifetime earn** | **≈ 2,813,000** | |

**How the integral is computed, stated once.** Income in an incremental rises geometrically, not
linearly, because each purchase multiplies capacity. A phase's integral is therefore the **log-mean**
of its endpoints times its duration — `T × (r₁ − r₀) / ln(r₁/r₀)` — not `T × (r₀+r₁)/2`, which
over-credits by 15–25% at these ratios. `lunar`: `3900 × 175 / ln(4.889) = 3900 × 110.3 = 430,000`.

**This is a consistency check, not a simulation.** Each row's exit rate is produced by the spend in
§5.3's table for the same row, so the two columns are mutually determined. What the tables prove is
that the system has a solution with non-negative slack. What it *costs* is `node`-harness measurement
(Decision 3.7).

### 5.3 The affordability budget — the most important table in this section

Four phases; in each, one Salvage stream pays for three ladders. Rows split three ways because they
behave differently under retuning. **Compulsory** — the module set the phase's exit rate and §7's
next threshold require. **Structural** — §7's ladder at R2's reconciled figures, used verbatim, not
this section's to move. **Elastic** — §8's full catalogue for the phase; R6 makes this the shock
absorber, correctly, because no pacing table depends on it.

**`aftermath` — 25 min, income 15,400**

| | Detail | Salvage |
|---|---|---|
| **Compulsory §5** | Reclaimer Drone ×8 (320 base, g1.34) 11,485 · RTG ×7 (90, g1.18) 1,093 · Ration Printer ×4 (150, g1.28) + Sabatier ×1 (120) 1,022 · storage (2 Buffer Cell, Ration Silo, Oxygen Tank) 304 | **13,904** |
| **Structural §7** | nothing — On-Deck is colonized in `lunar` | **0** |
| **Elastic §8** | full hint ladder, P1 + P2 | **1,720** |
| **Committed / slack** | | **15,624 / −224 (−1.5%)** |

The row closes at −1.5%, which is the point: the eighth Drone costs 4,225 against a 23-minute
payback, so the tier-1 ladder walls off exactly where the phase ends.

**`lifeSupport` — 52 min, income 108,200**

| | Detail | Salvage |
|---|---|---|
| **Compulsory §5** | Fission Pile ×8 (2,300, g1.17) 33,971 · Hydroponics Bay ×8 (1,500, g1.17) 22,155 · **Electrolysis Stack ×6 (2,100, g1.19) 20,334 — the 2.10 Fuel/s anchor** · Wreck Crawler ×1 (6,000) + Cascade Scrubber ×1 (2,600) 8,600 · Fuel Bladder ×1 3,600 · storage tier 2 + tier-1 top-ups 8,900 | **97,560** |
| **Structural §7** | none — L1 fills here but commits in `lunar` | **0** |
| **Elastic §8** | hints P3+P4 3,010 · Flight Manual + Scorecard + Lexicon 5,400 | **8,410** |
| **Committed / slack** | | **105,970 / +2,230 (+2.1%)** |

**The tightest phase in the act, deliberately.** A player who buys nothing from §8 finishes in ~47 min
at +9.8% slack; one who buys the whole §8 catalogue finishes at ~51 min. Both sit inside the authored
45–60 band, and the difference between them is exactly the cost §8 should have.

**`lunar` — 65 min, income 430,000**

| | Detail | Salvage |
|---|---|---|
| **Compulsory §5** | Solar Wing ×14 (1,400, g1.14, needs On-Deck) 52,612 · Fission Pile copies 9–13 56,651 · Cracking Tower ×3 (11,000, g1.20 — Fuel to 8.7/s for §7's L3) 40,040 · Orbital Sieve ×1 22,000 · Wreck Crawler copies 2–4 28,105 · Algae Column ×4 (7,500, g1.20) + Ice Harvester ×2 (6,400, g1.12) 53,828 | **253,236** |
| **Structural §7** | On-Deck 9,000 · Mound 21,000 · First Base 47,000 · Long Toss 86,000 | **163,000** |
| **Elastic §8** | hints P5+P6 4,300 · Doppler Rangefinder 3,200 | **7,500** |
| **Committed / slack** | | **423,736 / +6,264 (+1.5%)** |

The optional Cryo Tank (26,000) is the discretionary buy — pure overshoot headroom past 1.6× (§5.5).
Buying it lands the phase at ~70 min, still inside the 60–80 band.

**`deepSpace` — 78 min, income 2,259,000**

| | Detail | Salvage |
|---|---|---|
| **Compulsory §5** | Fusion Ring ×11 (18,000, g1.10, needs Second Base) 333,540 · Orbital Sieve copies 2–6 196,458 · **Drum Farm ×7 (20,000, g1.14) 214,600 — the one new module** · Ice Harvester copies 3–13 165,824 · ISRU Plant ×2 (60,000, g1.18 — 36.7 gross Fuel/s for §7's L5) 130,800 | **1,041,222** |
| **Structural §7** | Second Base 134,000 · Cutoff 216,000 · Warning Track 223,000 · Swing 560,000 | **1,133,000** |
| **Elastic §8** | hints P7+P8 6,020 · Bypass 9,000 · Plot Table 12,000 | **27,020** |
| **Committed / slack** | | **2,201,242 / +57,760 (+2.6%)** |

The optional Cryo Farm (90,000) fits inside that slack with 1.4% to spare.

#### What this budget establishes

**1. The ladders fit.** All four phases land within ±3% of budget, and every residual pushes its phase
toward the upper part of its authored band rather than past it. Summed at the stretched case — full
§8 catalogue, both optional Cryo purchases, no §9 contracts — the act runs
**26 + 53 + 70 + 82 = 231 min ≈ 3.85 h**, against §12 criterion 8's 3.5–5 h. §7.6's own no-contract
figure (~4.05 h) is the same number by another route.

**2. §8's assumed scale is invalid, and R2 is why.** §8.4 assumes lifetime earn of 150k–250k and a
mid-tier module M = 5,000. R2's reconciled §7 ladder alone totals **1,296,000**, so the document was
committed to a multi-million lifetime earn before this section moved anything. Actual lifetime earn is
**≈2.81M**; actual M (a `lifeSupport` tier-2 first copy) is **≈2,000**. §8's whole catalogue at 48,950
is therefore **1.7%** of lifetime earn, not the 20–33% its own target names.

> **The rule handed to §8, in place of new tables.** Price a phase's *full hint ladder* at **3–5% of
> that phase's integrated Salvage** and its *top instrument* at **2–3%**: `aftermath` 460–770 ·
> `lifeSupport` 3,200–5,400 · `lunar` 12,900–21,500 · `deepSpace` 67,800–113,000. Relative to
> `aftermath`, `HINT_PHASE_MULT` becomes roughly **1 / 7 / 28 / 147** rather than 0.4 / 0.7 / 1.0 /
> 1.4. The two-table formula in §8.5 is the right *machine*; only its phase column moves. The budget
> tables above already reserve these amounts.

**3. §8.6's brute-forcer ratio has no headroom left.** §8.6 argues 1.3× is right partly because "the
brute-forcer banks 19,350 Salvage, which buys modules and buys back time." Against 2.81M that is
**0.7%** — the offset is gone, so the measured ratio will sit closer to raw cooldown arithmetic than
§8.6 assumes. And 3.85 h × 1.5 (§8.6's stated worst bound) is **5.8 h**, outside §12's ceiling;
3.85 × 1.3 is 5.0 h, exactly on it. **`attemptsToBypass` must come down until the measured ratio is
≤ 1.3, and §8.6's 1.5× "never worse than" clause should be retired.**

**4. R2's within-phase interpolation runs hot, and it is safe.** R2 assumed ~70/s at L-2 and ~180/s at
L-5; a geometric ramp across the `lunar` band gives 60 and 148 — 15–25% lower, so §7's costs are that
much *more* generous than intended. No action: the budget above uses R2's published figures as-is and
still closes. If simulation confirms the ramp, §7 gains ~10% slack in `lunar` and should spend it on
D-5, per §7.6's own preference.

### 5.4 The module ladder

`cost(n) = baseCost × growth^n`, `n` = copies already owned — the shape `stadiumUpgradeCostGrowth`
uses in `balanceConfig.js`. Rates per second at full throughput. `data/actSevenModulesConfig.js`.
**"Available" replaces a tier column** because availability here is gated by site colonization, not by
an ordinal.

| Chain | id | Name | Available | Base | Growth | Produces | Consumes |
|---|---|---|---|---|---|---|---|
| Salvage | `reclaimerDrone` | Reclaimer Drone | `aftermath` | 320 | 1.34 | 3.0 Slv/s | 1.5 Pwr, 0.10 Prv |
| | `wreckCrawler` | Wreck Crawler | `lifeSupport` | 6,000 | 1.24 | 18 Slv/s | 6.0 Pwr, 0.35 Prv |
| | `orbitalSieve` | Orbital Sieve | `lunar` · On-Deck | 22,000 | 1.20 | 130 Slv/s | 40 Pwr, 2.0 Prv |
| Power | `rtg` | Radiothermal Slug | `aftermath` | 90 | **1.18** | 3.0 Pwr/s | — |
| | `fissionPile` | Fission Pile | `lifeSupport` | 2,300 | 1.17 | 12.0 Pwr/s | 0.40 Prv |
| | `solarWing` | Solar Wing | `lunar` · `vacuumSolar` | 1,400 | 1.14 | 14.0 Pwr/s | — |
| | `fusionRing` | Fusion Ring | `deepSpace` · Second Base | 18,000 | 1.10 | 140 Pwr/s | 2.5 Prv, 4.0 O₂ |
| Oxygen | `scrubberMkI` | Sabatier Scrubber | `aftermath` | 120 | 1.28 | 0.35 O₂/s | 1.0 Pwr |
| | `scrubberMkII` | Cascade Scrubber | `lifeSupport` | 2,600 | 1.24 | 1.20 O₂/s | 3.0 Pwr |
| | `iceHarvester` | Regolith Ice Harvester | `lunar` · `iceAvailable` | 6,400 | **1.12** | 6.0 O₂/s | 12 Pwr, 0.60 Prv |
| Prov. | `rationPrinter` | Ration Printer | `aftermath` | 150 | 1.28 | 0.25 Prv/s | 1.2 Pwr |
| | `hydroponicsBay` | Hydroponics Bay | `lifeSupport` | 1,500 | 1.17 | 0.90 Prv/s | 5.0 Pwr, 0.30 O₂ |
| | `algaeColumn` | Algae Column | `lunar` | 7,500 | 1.20 | 4.50 Prv/s | 20 Pwr, 1.20 O₂ |
| | `drumFarm` | **Spun Drum Farm** | `deepSpace` · Second Base | 20,000 | 1.14 | 24.0 Prv/s | 90 Pwr |
| Fuel | `electrolysisStack` | Electrolysis Stack | `lifeSupport` · gated §5.5 | 2,100 | 1.19 | 0.35 Fuel/s | 6.0 Pwr, 0.50 Prv |
| | `crackingTower` | Cracking Tower | `lunar` | 11,000 | 1.20 | 2.20 Fuel/s | 30 Pwr, 1.80 Prv |
| | `isruPlant` | ISRU Plant | `deepSpace` | 60,000 | 1.18 | 14.0 Fuel/s | 150 Pwr, 8.0 Prv |
| Storage | `bufferCell` / `batteryBank` | Buffer Cell / Battery Bank | `aftermath` / `lifeSupport` | 60 / 2,200 | 1.40 / 1.34 | — | +250 / +2,500 Power |
| | `oxygenTank` / `oxygenReservoir` | Oxygen Tank / Reservoir | `aftermath` / `lifeSupport` | 80 / 2,600 | 1.40 / 1.34 | — | +200 / +2,000 Oxygen |
| | `rationSilo` / `deepSilo` | Ration Silo / Deep Silo | `aftermath` / `lifeSupport` | 80 / 2,600 | 1.40 / 1.34 | — | +200 / +2,000 Provisions |
| | `fuelBladder` / `cryoTank` / `cryoFarm` | Fuel Bladder / Cryo Tank / Cryo Farm | §5.5 / `lunar` / `deepSpace` | 3,600 / 26,000 / 90,000 | 1.45 / 1.40 / 1.35 | — | +400 / +4,000 / +40,000 Fuel |

**`drumFarm` is the only module added to the draft, and price could not have avoided it.** Every other
overrun in §5.3 closed by moving a base cost or an exponent. Provisions could not: §7's pad and colony
upkeep alone demands **110.9 Prov/s** at act end, and 4.50 Prov/s per Algae Column is **27 copies** at
any base price — a copy-spam no exponent rescues, and one the drum-farm fiction of §7.1's Ceres entry
already promised. One module, at the one place price failed.

**`solarFactor` becomes a buildability gate, not an output multiplier.** The draft had Solar Wing
produce `14.0 × site.solarFactor`, which is incoherent with §4's `modules: [{ id, count }]` (no site
field) and with §7.4's one-pool ruling (§5 "sums a list" and does not know how many sites exist).
Replace it with the mechanism `iceAvailable` already uses: **Solar Wing requires a colonized site
declaring `vacuumSolar: true`**, which is On-Deck. The beat §5.10 wanted survives and improves — the
cheapest Power in the act is unbuyable until you colonize, and then it is the best thing on the board.
**§7 adds `vacuumSolar: true` to On-Deck in `actSevenSitesConfig.js`.**

**The two draw figures §7 needs, and they are different numbers.** §7.2 warns the network must reach
"roughly 300 Power/sec and 100 Provisions/sec by the time The Swing is built." Summing §7.2's own
upkeep table across all four colonized sites at max pad tier gives **343.8 Power/s, 110.9 Prov/s,
34.5 O₂/s** — **§7.2's figure is confirmed and its table does not move.** That is not the network's
total draw: the ladder above must also feed this section's Salvage, Fuel, Oxygen and Provisions
chains, and the whole colony at the end of `deepSpace` runs at **≈1,913 Power/s gross, ≈194 Prov/s,
≈84 O₂/s**. §7 must not read 1,913 and conclude its table was wrong — pads and colonies are 18% of the
bus, and the other 82% is the machine that pays for them.

### 5.5 Fuel capacity has two sources (ledger R1)

```
resources.fuel.capacity = Σ sites[].fuelCapacityOnArrival  +  Σ owned storage modules
```

Both terms derived, never stored — the rule `getUnlockedFeatures` follows. The draft derived capacity
from storage alone onto a base of 0 and told §7 to size thresholds against the tank ladder. **That is
overruled and the sentence is withdrawn.** §7.5 sizes thresholds against the Fuel *rate*; §7.3's
`fuelCapacityOnArrival` grants each site a floor at **1.6× the threshold of the launch departing from
it**; this section's storage ladder is **optional headroom for banking past 1.6×**, which is what
§7.6's beat L-5 tank farms are for.

**Which makes every tank above an optional buy except one.** At L2 the On-Deck grant is 6,720 against
a 4,200 threshold; at L5 the Third Base grant is 67,200 against 42,000. A player who never buys a tank
can commit every launch in the game at full 1.6× overshoot. Cryo Tank and Cryo Farm are for players
who want to arrive at the *next* site already part-filled, and they are correctly priced as luxuries
(26,000 in a phase earning 430,000; 90,000 in a phase earning 2.26M).

**The exception is the first Fuel Bladder, and R1 keeps it as the pacing control §7.5 needs.** R1
grants Home Plate's 1,920 **on the first tank purchase**, so the Bladder's own +400 is incidental —
what 3,600 Salvage buys is Fuel accumulating at all. §7.5 requires that not be affordable before
~minute 35 of `lifeSupport`, and price alone cannot hold it (3,600 is 90 seconds of mid-phase income).
So a second control, in the shop contract's existing `available` field:

```js
// data/actSevenModulesConfig.js — on BOTH fuelBladder and electrolysisStack
requires: { fissionPile: 7, hydroponicsBay: 7 },
```

Reaching seven of each costs 27,076 + 17,658 plus everything bought alongside — cumulatively
**≈63,700 Salvage, which the `lifeSupport` band crosses at minute 34.** Fuel then ramps 0.35 → 2.10 as
the six Stacks land, and 1,200 Fuel is crossed at ≈minute 49, exactly where §7.5 puts L1. **This is
the pacing number to measure first:** it is the only minute-hand §5 and §7 share.

### 5.6 The satisfaction factor (Decision 3.3, part 1)

Two rules, symmetric, one for each end of the `[0, capacity]` clamp. Both are computed **once at the
start of a step and held constant for its duration**, which is what keeps every rate linear in time
and every boundary a closed-form solve.

```
demand[r]  = drawMult × Σ_modules count × consumption[m][r]     // at FULL output. Constant.
           + drawMult × Σ_sites site.draw[r]                    // flat per-site life support
           + drawMult × contractUpkeepPerSecond(state)[r]       // §9, folded in BEFORE the solve
gross[r]   = outMult[r] × Σ_modules count × production[m][r] × throughput[m]
           + Σ_sites site.produces[r]                           // Home Plate: 2.0 O2/s
throughput[m] = min over r ∈ inputs(m) of satisfaction[r]

RATIONING (empty end):  satisfaction[r]   = (stock[r] > 0 || gross[r] >= demand[r]) ? 1
                                          : gross[r] / demand[r]
LOAD-FOLLOW (full end): supplyThrottle[r] = (stock[r] >= capacity[r] && gross[r] > demand[r])
                                          ? demand[r] / gross[r] : 1
```

**`demand[r]` is computed at full output, never from actual throttled draw.** This is the one decision
an implementer is most likely to "improve" and must not. Recomputed from actual draw, a resource
pinned at zero whose consumers are throttled harder by a *different* input ends up with a small
positive net rate, lifts off zero, un-throttles next step, drains back, and chatters — an unbounded
sequence of microscopic steps that burns `safetyCapIterations` on an offline return. Full demand makes
the pinned state absorbing.

**Consequence: a resource pinned at zero has `net = 0` by definition, not by computation.** Surplus
arising because a consumer was throttled harder elsewhere is discarded — a small, explicit loss of
conservation that buys exactness at the boundary, non-chattering, and a closed form. A pinned resource
un-pins only when `gross >= demand`: when the player *buys* something, or a downstream module
load-follows off. Events, never continuous drift.

**Home Plate's 2.0 O₂/s is a site production term §7 must author** — `produces: { oxygen: 2.0 }` in
`actSevenSitesConfig.js`. §7.1 already calls Earth "the only free atmosphere in the game"; this is that
sentence as a number, and it makes Oxygen a non-problem in `aftermath` and a real one the moment
Hydroponics Bays arrive.

#### Why it converges instead of oscillating

`gross` and `satisfaction` are mutually recursive. Solve by Kleene iteration from the top:

```js
// engine/colony.js — SOLVE_MAX_PASSES = 16, SOLVE_EPSILON = 1e-4
let s = { power: 1, oxygen: 1, provisions: 1, fuel: 1 };
for (let pass = 0; pass < SOLVE_MAX_PASSES; pass += 1) {
  const gross = grossProduction(modules, sites, s, outMult);
  let delta = 0; const next = {};
  RESOURCE_IDS.forEach((r) => {
    const raw = (stocks[r] > 0 || gross[r] >= demand[r]) ? 1
              : (demand[r] > 0 ? gross[r] / demand[r] : 1);
    // MONOTONE DESCENT: a ration may never rise inside the solve. This is what makes the sequence
    // monotone-decreasing and bounded, i.e. convergent, rather than a two-cycle. Without it the
    // Power/Provisions loop alternates forever.
    next[r] = Math.min(s[r], raw);
    delta = Math.max(delta, s[r] - next[r]);
  });
  s = next;
  if (delta < SOLVE_EPSILON) break;
}
```

`gross` is monotone non-decreasing in `s`, and `s` is monotone non-decreasing in `gross`, so the
composed operator is monotone. Started at the top element and forced downward by the `Math.min`, the
sequence is monotone-decreasing and bounded below by 0. It converges; it cannot oscillate.

**Load-following is a single non-iterated pass run after the rationing solve.** Deliberately outside
the loop: lowering `gross` *raises* the load-follow ratio, so folding it in would break monotonicity.
A capacity pin caused by load-following reduces draw on that producer's *inputs*, which may push an
input into surplus — and that is a **boundary event**, resolved by the next `advance()` iteration
rather than by more passes here. §5.7's iteration ceiling is derived from that choice and pays for it.

> **⚠️ CORRECTION — the two worked examples below contain arithmetic errors. The model they
> illustrate is sound; the printed intermediate numbers are not.** Found during implementation
> (STORY-018 / PR #22) and verified against independent closed forms:
>
> - **Example B's satisfaction trace diverges from its own recurrence after pass 3.** The equations
>   given (`gross.power = 21 + 36·s_prov`, `demand.power = 89.6`, `gross.prov = 4.5·s_power`,
>   `demand.prov = 5.70`) determine the sequence uniquely, and passes 1–3 match to four decimals.
>   Pass 8 is **0.3499**, not 0.351; pass 16 is **0.3433**, not 0.3488. The printed 0.3488 is
>   impossible for a monotone-decreasing sequence converging to the closed-form fixed point 0.34325
>   — it sits below pass 8's true value and above the limit.
> - **The per-pass contraction is 0.563 analytically** (`sqrt((36/89.6)·(4.5/5.7))`), measured
>   0.573 — not the 0.63 stated. The *conclusion* is unaffected: 16 passes remains the right cap,
>   and convergence was measured to land 0.02% from the closed form.
> - **Example A**: its listed power terms sum to 108.8, not the printed 104.6; `7×3.0 + 3×12.0` is
>   57, not the printed 60.0; and `gross.prov` silently omits the four Ration Printers at 57.4%
>   while including them at 100%.
>
> **Implementers: take the equations and the shape, not the printed intermediates.** The shipped
> solver reproduces PRD §5.7's healthy-colony departure rates exactly — Power +14.200, Provisions
> +0.850, Fuel 2.100 against the 2.10/sec anchor, Fuel ending at exactly 1920 — with Oxygen the only
> difference, off by exactly the 2.00/s Home Plate site term that `engine/sites.js` has yet to land.
> This is a documentation defect, not a design one, and it is left in place rather than rewritten so
> the correction stays auditable against what was originally reasoned.

#### Worked example A — a colony at 57% Power satisfaction

An over-committed `lifeSupport` colony: the player bought the Fuel chain before the reactors.
`7× RTG · 3× Fission Pile · 8× Hydroponics Bay · 1× Sabatier · 1× Cascade · 4× Ration Printer ·
8× Reclaimer Drone · 2× Wreck Crawler · 6× Electrolysis Stack`, Power stock 0, silo still holding.

```
demand.power = 8×1.5 + 2×6.0 + 6×6.0 + 8×5.0 + 4×1.2 + 1.0 + 3.0   = 104.6 Power/s
demand.prov  = 8×0.10 + 2×0.35 + 6×0.50 + 3×0.40                   =   5.70 Prov/s
demand.o2    = 8×0.30                                              =   2.40 O2/s

pass 1  s = {1,1,1} → gross.power = 7×3.0 + 3×12.0 = 60.0 ; 60 < 104.6, stock 0 → s.power = 0.574
pass 2  Fission draws only Provisions (s.prov = 1) so its throughput stays 1.0
        → gross.power unchanged at 60.0 → s.power = 0.574 ; |Δ| = 0 → CONVERGED (2 passes)
```

| Everything on the Power bus | At 57.4% | At 100% |
|---|---|---|
| Fuel | 6 × 0.35 × 0.574 = **1.21/s** | 2.10/s |
| Salvage (passive) | (24 + 36) × 0.574 = **34.4/s** | 60.0/s |
| Oxygen net | 2.89 gross − 2.40 draw = **+0.49/s** | +1.15/s |
| Provisions net | 4.13 gross − 5.70 draw = **−1.57/s** | +2.50/s |

The colony is *working*, at 57%, and quietly emptying its silo at 1.57/sec. Against a 2,300-unit Deep
Silo that is **24 minutes of warning**. §6's panel must show the negative net rate and the
time-to-empty; that number is the whole UI.

#### Worked example B — the silo empties, and why it is not a death spiral

Same colony with `stock.provisions = 0` and only five Hydroponics Bays (so `demand.power` = 89.6):

```
gross.prov(s)  = 5 × 0.90 × s.power = 4.50 s.power       demand.prov  = 5.70
gross.power(s) = 21 + 3 × 12 × s.prov = 21 + 36 s.prov   demand.power = 89.6

pass 1  s={1,1}         gross.prov 4.50 < 5.70 → s.prov = 0.789 ; gross.power 57.0 → s.power = 0.636
pass 2  fission t=0.789 gross.power 49.4 → s.power = 0.551 ; hydro t=0.636 gross.prov 2.86 → 0.502
pass 3                  gross.power 39.1 → s.power = 0.436 ;               gross.prov 2.48 → 0.435
pass 8  …                                    s.power = 0.351 ,                            0.283
pass 16 …                                    s.power = 0.3488,                            0.2754
```

Monotone, every pass. The exact fixed point solves in closed form —
`s_p = (21 + 36 × 0.789 s_p) / 89.6 → 61.2 s_p = 21 → s_p = 0.3431` — and 16 passes lands within 2% of
it. Per-pass contraction is ≈0.63 because the two rations lag each other by a pass; 8 passes would
leave a 2.5% *over*-estimate, which is why the cap is 16 and not 8.

**The fixed point is 0.343, not 0, and the 21 Power/s of RTG is the entire reason.** Delete the RTGs
and the same algebra reads `s_p = 0.317 s_p`, whose only solution is `s_p = 0`: a colony built purely
on Provisions-fed generators has a stable equilibrium at total shutdown. Two structural guards,
neither of them a tuning number: **the RTG has no inputs and no `maxCount`**, at 90 base the cheapest
thing in the act; and **`engine/colony.js` never removes a module, never zeroes a stock, and never
fails a purchase that was affordable.** Decision 3.3 is not negotiable and nothing here negotiates
with it.

The collapsed colony still makes `60 × 0.343 = 20.6 Salvage/s` passively plus the click's 2.67/s.
Recovery is purchase-only — this section sells no module-disable — and it is monotone: every RTG
raises the numerator of a fixed point whose denominator is fixed. Returning to `s.power ≥ 0.9` needs
the RTG term at ~48 Power/s, i.e. **RTG copies 8–16, which cost 5,900 total at growth 1.18 — about
five minutes at the collapsed colony's own income. This is what set the RTG's growth exponent at 1.18
rather than the draft's 1.35.** *Simulation must check:* from a deliberately collapsed colony with
zero Salvage banked, measure wall-clock minutes to `s.power >= 0.9` on clicking and passive income
only. **Target: under 6 minutes.** If longer, the RTG is too expensive — not the collapse too deep.

### 5.7 Offline safety (Decision 3.3, part 2)

```js
// engine/colony.js — nextColonyThresholdClock(state, modifiers). The earliest clock at which any
// expedition resource would hit 0 or its capacity at the CURRENT net rate; Infinity when nothing is
// moving. advance() steps to whichever of this and findNextEventClock() comes first, which is what
// makes the piecewise-constant rate model exact rather than approximate: the only instants a rate
// can change are the ones this function returns, plus the instants the player acts — and no player
// acts while offline.
const COLONY_MIN_STEP_SECONDS = 0.5;
RESOURCE_IDS.forEach((id) => {
  const { amount, capacity } = slice.resources[id];
  const rate = net[id];
  if (!Number.isFinite(rate) || rate === 0) return;      // pinned, or nothing produces it
  const distance = (rate > 0 ? capacity : 0) - amount;
  // Already on the boundary. Cannot happen for a correctly-solved pinned resource (its net is 0 by
  // definition, caught above) but a hand-edited save or a float landing exactly on capacity can
  // produce it, and a zero-length step is an infinite advance() loop.
  if (distance === 0) return;
  const seconds = distance / rate;
  if (seconds < COLONY_MIN_STEP_SECONDS) return;
  earliest = Math.min(earliest, state.clock + seconds);
});
```

`COLONY_MIN_STEP_SECONDS` is belt-and-braces, not the mechanism: it drops any boundary closer than
half a second so no accumulation of float error can produce a run of zero-length iterations. The cost
is at most half a second of integration error per boundary in an eight-hour replay, which is
invisible; the benefit is that `safetyCapIterations` can never be reached by this path.

#### An eight-hour return, traced

Departure — the *healthy* end-of-`lifeSupport` colony, the one the 2.10 Fuel/s anchor is measured on:
`7× RTG · 8× Fission Pile · 8× Hydroponics Bay · 1× Sabatier · 1× Cascade · 4× Ration Printer ·
8× Reclaimer Drone · 1× Wreck Crawler · 6× Electrolysis Stack`. Capacities Power 2,850 / Oxygen 2,300
/ Provisions 2,300 / **Fuel 1,920** (Home Plate's grant, R1). Stocks 800 / 900 / 1,100 / 0.

```
gross.power  21 + 96 = 117    demand.power 102.8  → net +14.2/s
gross.prov   1.0 + 7.2 = 8.2  demand.prov    7.35 → net  +0.85/s
gross.o2     2.0 + 1.55 = 3.55 demand.o2     2.40 → net  +1.15/s
Fuel 6 × 0.35 = 2.10/s        Salvage 24 + 18 = 42/s     ← THE 2.10 FUEL/SEC ANCHOR
```

| # | Step | Boundary | What changes |
|---|---|---|---|
| 1 | 144.4 s | **Power at 2,850** | Reactors load-follow to 102.8/117 = 0.879. Fission's Provisions draw falls 3.20 → 2.81; Provisions net rises to +1.24/s. |
| 2 | 770.0 s | **Fuel at 1,920** | Nothing consumes Fuel continuously, so `supplyThrottle.fuel = 0` and Electrolysis idles completely. Power demand −36, Provisions demand −3.00. Reactors follow to 0.571; Provisions net +5.22/s. |
| 3 | 23.8 s | **Provisions at 2,300** | Hydroponics load-follow to 0.363; their Power and Oxygen draw collapses; reactors follow down again, which lowers Provisions demand, which lowers the Hydroponics throttle. **This cascade costs 2–3 further iterations.** Oxygen net settles at +2.80/s. |
| 4 | 80.4 s | **Oxygen at 2,300** | Scrubbers load-follow. Every resource is now pinned. |
| 5 | 27,782 s | *none* — `nextColonyThresholdClock` returns `Infinity` | The remaining 7h 43m credits in **one** iteration: 1,166,844 Salvage. |

**Seven to eight iterations for an eight-hour return** — four boundary steps, the step-3 cascade, and
the terminal step. **The `safetyCapIterations` obligation, re-derived against this trace rather than
the draft's optimistic count:** the ceiling is 3 regime changes per resource (interior → cap-pinned →
draining → zero-pinned) × 4 resources = 12, **plus up to 2 cascade iterations per capacity pin**
(4 pins × 2 = 8, which the draft omitted because it treated load-following as terminating in one
pass), plus 1 terminal step = **21, stated as 25** against `balanceConfig.safetyCapIterations: 2000`
(`tickEngine.js:443`). **The story that lands `nextColonyThresholdClock` owns measuring the real worst
case and recording it in a comment** — Decision 3.3's closing note. An 8h return that silently hit the
safety cap would under-credit the player with no error anywhere.

And the punchline the player actually gets: 1.17M Salvage, four full tanks, and **exactly 1,920
Fuel**, because 1,920 is the tank Home Plate grants. Seven hours forty-three minutes of Electrolysis
idle from minute fifteen — the tank lesson delivered by arithmetic rather than by a tooltip.

*Simulation must check:* drive `advance(state, 28800)` under `node` with an injected rng from (a) a
healthy colony, (b) a Provisions-starved colony, (c) a fully collapsed colony, (d) an empty
`state.expedition`; assert `iterations < 25` and no resource outside `[0, capacity]`.

### 5.8 Wiring into the tick loop

**Salvage goes into `engine/income.js`'s contributor list. Power/Oxygen/Provisions/Fuel do not.**
`totalIncomePerSecond()` returns a bundle that is currency-additive and always ≥ 0, credited through
`creditWallet`, which structurally refuses negatives. Salvage fits exactly — one line,
`salvage: reclaimersPerSecond(state, modifiers)`, plus the matching `creditIncome()` line at
`tickEngine.js:79-93`, parallel to caps/coins. The four consumables cannot: they have capacities,
negative net rates, and rates that are the output of a fixed-point solve rather than a sum. Forcing
them through a ≥ 0 additive bundle means either splitting each into produce- and consume-side
contributors — losing the satisfaction coupling that is the entire mechanic — or relaxing the
invariant `engine/wallet.js` exists to hold. They get a sibling module:

```js
// engine/tickEngine.js — advance(), inside the while loop. Two paths, deliberately. The first is
// monotone currency accumulation and always credits. The second integrates signed net rates against
// a capacity clamp. They share the step and nothing else.
working = creditIncome(working, totalIncomePerSecond(working, modifiers), step);
working = integrateColony(working, modifiers, step);

// EVENT_CLOCK_CONTRIBUTORS — the Phase 0 refactor's list. Each entry is (state, modifiers) => number
// returning a clock or Infinity; findNextEventClock() is Math.min over the list. §5 appends ONE
// registration and never touches the function body (R5).
require('./colony').nextColonyThresholdClock,
```

`modifiers` stays optional on every contributor so the header's existing display call
(`tickEngine.js:500-505`) keeps working; when absent, `nextColonyThresholdClock` computes its own.

| `engine/colony.js` export | Purpose |
|---|---|
| `expeditionSlice(state)` | Defaulting accessor, `concessionsSlice()` shape. Returns a complete zeroed expedition when `state.expedition` is absent, so an in-flight Act IV save loads. |
| `colonyRates(state, modifiers)` | `{ satisfaction, supplyThrottle, gross, demand, net, capacity }`. **One call, one solve.** |
| `integrateColony(state, modifiers, step)` | Applies `net × step`, clamps each resource to `[0, capacity]`. |
| `nextColonyThresholdClock(state, modifiers)` | §5.7. Registered as a contributor, above. |
| `spendResource(state, resourceId, amount)` | **§7's Fuel debit path** (R5). New state, or `null` for refused when the stock is short. Fuel is in `state.expedition.resources`, so `engine/wallet.js` is not the debit path and **nothing outside `colony.js` reaches into the slice.** |
| `isAftermathPhase(state)` / `isLifeSupportPhase(state)` | The two early phase predicates (R4), as **pure functions of state**. `lifeSupport` is `expeditionSlice(state).modules.some(m => m.count > 0)` — the first generator bought; `aftermath` is the default. **`engine/sites.js` is the single writer of `expedition.phase`; this section supplies predicates, writes nothing, and sets no phase milestones.** |
| `reclaimersPerSecond(state, modifiers)` | The one function `income.js` requires. |
| `listOffers(state)` / `purchase(state, id)` | House shop contract for the module shop. `affordable`, `cost` (growth applied), `count`, and `available` (site gating and §5.5's `requires`) all resolved here; §6 renders rows verbatim. |

**§6's `listResources()` is a thin presentation wrapper over `colonyRates`, never a second solve**
(R5). One helper computes every boundary — the same one `nextColonyThresholdClock` uses — so the
header physically cannot disagree with the engine about when a resource bottoms out. A header that
computes its own rate will eventually lie about a time-to-empty, and §5.6's Example A says that number
is the whole UI.

**§9's `contractUpkeepPerSecond(state)` is summed into `demand[r]` before the solve** (R5), as §5.6's
pseudocode shows. A contract drawing 3 Power/s is a consumer like any other; added after the solve, it
can push a resource through zero inside a step — the precise failure Decision 3.3 prevents.

**No circular require:** `income.js → colony.js → modifiers.js / data/*`. `colony.js` must never
require `income.js` or `tickEngine.js`.

### 5.9 Powerups that boost generation

Six new `BONUS_KEYS` in `data/modifierKeysConfig.js`. **A key not in that list is silently inert**
(`conventions.md`) — Act IV's `rookieQualityMult` shipped dead for exactly that reason
(`engine/modifiers.js:50-57`). All six are ordinary additive bonuses composed through
`computeModifiers`, so acts, eras, perks and powerups feed them with no new machinery.

| Key | Clamp | Applies to |
|---|---|---|
| `powerOutputMult` | [1, 4] | gross Power, **before** satisfaction — so a Power powerup raises the ration and un-throttles the whole colony, which is what makes it the right purchase in a crisis |
| `oxygenOutputMult` / `provisionsOutputMult` / `fuelOutputMult` | [1, 4] | gross Oxygen / Provisions / Fuel |
| `salvageOutputMult` | [1, **6**] | PASSIVE Salvage only — the click is flat (§5.2). Ceiling 6 rather than 4 because §8's hint ladder is the elastic Salvage sink and needs somewhere to run |
| `lifeSupportDrawMult` | [**0.4**, 1] | every module's and site's `demand[r]`, also before satisfaction |

**Floored at 1, on `gameSpeedMult`'s reasoning verbatim** (`modifierKeysConfig.js:35-40`): nothing
sells a *worse* generator, and a sign bug producing a negative bonus would turn a setback into a
spiral in the one act where a spiral has a fixed point at zero. `lifeSupportDrawMult` is ceilinged at
1 for the mirror reason and floored at 0.4 to leave room for the two permanents below plus a third the
act does not yet sell.

**`data/actSevenPowerupsConfig.js`** — same shape as `data/powerupsConfig.js` plus
`currency: 'salvage'`. Seven timed (Bus Reroute `powerOutputMult` +0.25/900 s **2,000** · Flush the
Lines `oxygenOutputMult` +0.35/1,200 s **2,600** · Grow Lamps `provisionsOutputMult` +0.35/1,200 s
**2,600** · Reclaimer Overclock `salvageOutputMult` +0.50/600 s **3,200** · Deep-Cycle Discharge
`powerOutputMult` +0.60/300 s **12,000** · Debris Field Pass `salvageOutputMult` +1.20/300 s
**24,000** · Cryo Top-Off `fuelOutputMult` +0.40/1,800 s **40,000**) and three permanent (Closed-Loop
Recycling `lifeSupportDrawMult` −0.12 **90,000** · Second Skin Seals `lifeSupportDrawMult` −0.10
**210,000** · The Gyre `salvageOutputMult` +0.30 **340,000**), mirroring the existing array's split.
Costs are restated against §5.2's bands; the draft priced them against a scale ~11× too small. They
reuse `state.powerups.active` verbatim, so `computeModifiers` (`modifiers.js:143-145`) and
`expirePowerups()` (`tickEngine.js:95-104`) handle them with **zero changes**, offline catch-up
included. **These are elastic, like §8's catalogue** — not in §5.3's compulsory rows.

**One blocker.** `buyPowerup()` (`state/actions/economyActions.js:11-37`) hardcodes `'cash'` on both
the `canAfford` and the `debitWallet`, and `components/ticketing/PowerupShop.js:23` maps `POWERUPS`
with no filter — appending Act VII entries would leak them into Act V's shop. The fix is the house
shop contract retro-fitted onto the one shop that never got it: a new pure **`engine/powerupShop.js`**
exposing `listOffers(state)` / `purchase(state, id)`, reading both config arrays, filtering by
unlocked features, honouring `powerup.currency || 'cash'`. `buyPowerup()` becomes a three-line
delegation. Small standalone story; lands before any Act VII powerup content. **Open question, flagged
rather than solved:** a player who buys Reclaimer Overclock and sees the Sift button unchanged is
entitled to be confused — `engine/clicker.js` takes no `modifiers` argument today.

### 5.10 Phases, flat points, and the unlock scheduled to relieve each

| Phase | Budget | Flat point | Relieving unlock |
|---|---|---|---|
| `aftermath` | 20–30 min | **The ninth Reclaimer Drone** — 4,225 Salvage against a 23-minute payback. The tier-1 ladder walls off by construction (§5.3). | **Fission Pile + Hydroponics Bay.** Power stops being free and Provisions stop being optional in the same purchase. |
| `lifeSupport` | 45–60 min | **~minute 30**: every Mk I module is bought and the interlock stops being a puzzle — you buy one of each in a loop. | **The Fuel tier unlocking at `fissionPile: 7, hydroponicsBay: 7`** (§5.5), ~minute 34. Fuel appears in the header for the first time and the phase acquires a destination. Exit rate: **2.10 Fuel/s**. |
| `lunar` | 60–80 min | **~minute 25**: the second site is just the first colony again, twice. | **`vacuumSolar` and `iceAvailable`** — Solar Wing is unbuildable until On-Deck is colonized and is then the cheapest Power in the act; the Ice Harvester is buildable *only* at First Base. Building the Moon the way you built Earth does not work, and discovering that is the unlock. |
| `deepSpace` | 60–90 min | **Salvage outruns every sink** — modules are bought the instant they appear. | **The 18,000 / 20,000 / 60,000 wall** (Fusion Ring, Drum Farm, ISRU Plant) plus §8's repriced hint ladder. The real relief is a change of binding constraint: from here it is **Provisions**, not Power, that gates the network — §7's Warning Track alone demands 86 Prov/s. |
| `majors` | open-ended | Structural. | §7's board and standing orders. Not this section's to relieve. |

### 5.11 Numbers that are provisional (Decision 3.7), in priority order

1. **The `lifeSupport` Fuel gate.** `requires: { fissionPile: 7, hydroponicsBay: 7 }` plus the Fuel
   Bladder at 3,600 must land the first Electrolysis Stack at **minute 33–38**, because §7.5's entire
   L1 fill (1,200 Fuel crossed at ≈minute 49) hangs off it. Measure this first; it is the one
   minute-hand §5 and §7 share.
2. **The 2.10 Fuel/s anchor** — against the module set a median player *actually* owns at the
   `lifeSupport` exit, not the one §5.3 assumes. **§7's whole threshold table depends on it.**
3. **The Salvage bands of §5.2.** R2 derived §7's cost ladder from the `lunar` and `deepSpace` rows,
   so a band that measures low inflates §7's costs by the same ratio. Per §11.2's sequencing note the
   Phase 2 story must publish its measured bands as a comment in `data/actSevenModulesConfig.js`, and
   the Phase 3 story must recompute against **those** — not against R2's table, which was itself
   computed from unsimulated estimates.
4. **Cost growth (1.10–1.45)** — against copies owned at each phase exit. The exponents are
   deliberately shallower than the draft's for modules the player owns ten or more of (Ice Harvester
   1.12, Fusion Ring 1.10) and steeper for the opening ladder (Reclaimer Drone 1.34, storage
   1.34–1.45). Forty Fusion Rings means the growth is too low; three means the tier-up is too fast.
   **RTG growth at 1.18 is measured *only* against §5.6's 6-minute collapse-recovery target**, and has
   no other job.
5. **Module consumption ratios** — against the distribution of `satisfaction.power` over a run. Target
   is 100% most of the time, dipping into the 50–80% band two or three times per phase. Throttling
   should be a *signal*, not a state.
6. **Storage capacities** — against what an eight-hour return actually banks. Oxygen capacity is the
   offline budget by design; §5.7's trace pins all four tanks in 17 minutes, which is on the short
   side and known.

**What other sections must now recompute.** **§8:** its `HINT_PHASE_MULT` column and every item price
against §5.3's rule (3–5% of phase income for the ladder, 2–3% for the top item), and its
`attemptsToBypass` dial against a brute-forcer ratio that has lost its Salvage offset. **§7:** three
config additions only — `vacuumSolar: true` on On-Deck, `iceAvailable: true` on First Base (already
implied), and `produces: { oxygen: 2.0 }` on Home Plate, plus the §7.1 wording fix in §5.1. **§7.2's
upkeep table, §7.5's thresholds and R2's cost ladder all stand unchanged.**

**Files touched.**
New: `engine/colony.js`, `engine/powerupShop.js`, `data/actSevenModulesConfig.js`,
`data/actSevenPowerupsConfig.js`.
Modified: `engine/tickEngine.js` (`advance`, `creditIncome`, and one registration against the Phase 0
`EVENT_CLOCK_CONTRIBUTORS` list — **not** an edit to `findNextEventClock`'s body),
`engine/income.js` (`salvage` contributor), `engine/clicker.js` (`clickValue`, `clickFlatValue`),
`data/modifierKeysConfig.js` (six `BONUS_KEYS` + `CLAMPS`), `data/acts.js` (Act VII `rules`),
`data/currencies.js` (`salvage`), `state/initialState.js` (`expedition`, `wallet.salvage`),
`state/actions/economyActions.js` (`buyPowerup` delegates), `state/actions/expeditionActions.js`
(new, module purchase), `state/actionTypes.js`, `state/gameReducer.js`,
`components/ticketing/PowerupShop.js` (renders `listOffers` rows).

---

## 6. The UI teardown and what replaces it

This section owns the single most memorable moment in the game and the interface that survives
it. Everything here is presentation layered on Decision 3.1: **the shell is a function of the act
index, and the moment is a function of the transition.** Nothing in this section adds a stored
field except the one milestone Decision 3.2 already names.

---

### 6.1 The call-up offer

**The offer reuses the victory-acknowledgement path exactly, and stores nothing new.**

`AppShell.js:132` computes `championships - victoryAcknowledgedCount`, raises the championship
`Modal` when it is positive, and `ACKNOWLEDGE_VICTORY` (`prestigeActions.js:25`) sets
`victoryAcknowledgedCount = championships`. That ledger is already the house idiom for "announce
once, survive an 8-hour catch-up" (`conventions.md`, "Derived, never stored"), and it happens to
have exactly the shape the call-up needs.

**The offer is a second block inside that same modal** — one paragraph and a `Take the call`
button below the existing championship copy (prose from §10, id `act-7-offer`) — rendered when
`!progression.milestones.callUpAccepted`. **Declining is pressing the existing `Continue`**, and
nothing else; it writes no "declined" flag. That is not laziness: a stored decline is a stored
refusal, and a refusal is a thing the game then has to decide when to *un*-store. Piggybacking on
`victoryAcknowledgedCount` gives "offered once per title, declinable forever, re-offered on the
next title" for free, and it is idempotent under offline catch-up for the same reason the victory
modal already is.

**Winning another championship is too slow to be the only re-offer path**, so the offer also
appears as a permanent card at the top of `PrestigePanel` whenever
`championships >= 1 && !milestones.callUpAccepted`. The Prestige tab is the correct home: it is
the Act VI "what is next" screen, it is the tab Act VII hides (Decision 3.2), and a player looking
for something beyond the championship is already standing there. This is also derived — a
predicate over two existing fields — so it needs no state either.

Both surfaces open **one** confirmation component, `components/narrative/CallUpModal.js`, built on
the existing `Modal` (`common/Modal.js`). Three lines: the league keeps playing without you,
prestige and the era ladder end here, and **this cannot be undone.**

It passes `onClose` (so the backdrop click at `Modal.js:5` and the footer button at `Modal.js:11`
both decline) and renders `Cross over` in the body. That is deliberately lopsided — **three ways to
say no, one to say yes** — which is the correct shape for the only irreversible choice in the game.
It is also deliberately not a `StoryCard`: that component is for prose the player reads and
dismisses, and this must not look like a page turn.

**Confirming dispatches `ACCEPT_CALL_UP` → `progressionActions.acceptCallUpAction(state)`**, which
sets `progression.milestones.callUpAccepted = true` and refuses (returns the identical `state`
object, per the refusal contract in `conventions.md`) when `runStats.championships < 1`. The guard
lives in the action, not the component: a component decides nothing about availability.

**No exit predicate needs writing.** `isExitSatisfied` (`progression.js:56-61`) falls back to
`state.progression.milestones[act.exit.id]` when no predicate is registered, and Act VI's new
`exit: { id: 'callUpAccepted' }` is precisely that shape. The `EXIT_PREDICATES` map stays
untouched.

**The act flips on the next tick, not in the reducer**, because `checkActTransition` is called
from `advance()` (`progression.js:149-157`). So the sequence is: click → milestone stored → up to
one second of the ballpark still on screen → the act flips and §6.2 mounts. That second is a
feature, not a defect: the confirmation lands, and *then* the lights go out. It is also safe —
a reload inside that window reloads with `callUpAccepted` set and act 5, and the first tick after
load crosses the boundary.

> *You can say no. The scout will be back next October.*

---

### 6.2 The teardown sequence

**What it is:** one component, `components/narrative/TeardownOverlay.js`, mounted by `AppShell`,
`position: fixed; inset: 0`, opaque, above everything including the story card. **~6.4 seconds.**

**Four dismissal inputs, and they are part of the component contract, not decoration.** Three are
plain event handlers; only the fourth depends on an animation running:

1. `onClick` on the overlay root — a tap anywhere.
2. `Escape` — a `keydown` listener attached in an effect to `document`, **not** to the root div. A
   `div` with no `tabIndex` never receives `keydown`, and `Modal.js` has no keyboard handling at all
   to inherit (it closes on backdrop click only, `Modal.js:5`), so this must be written.
3. An always-rendered `Continue` button, at the bottom of the overlay from frame one.
4. `onAnimationEnd` (below) — the animated path's auto-dismiss, and a convenience only.

Event handlers are not timers; "no second timer" (below) is unaffected. This list is spelled out
because the failure it prevents is a hang, not a cosmetic bug — see the reduced-motion note.

**What derives it.** The same construction `ToastHost` uses and for the same stated reason
(`ToastHost.js:27-32`): a `useActTeardown(state)` hook holds a `prev` ref of
`state.progression.act`, and starts the sequence on the render where it observes
`before < ACT_SEVEN_INDEX && now >= ACT_SEVEN_INDEX`. **`prev.current === null` establishes the
baseline and plays nothing** — that single line is the whole idempotence argument:

- **Reload mid-sequence:** the first render's baseline is already Act VII, no transition is
  observed, the overlay never mounts. The player lands in the new shell. Nothing is lost, because
  the durable half of the moment is the Act VII intro `StoryCard`, which is still pending (below).
- **8-hour offline catch-up crossing the boundary:** this can only happen if the player confirmed
  and closed the tab inside the sub-second window before the next tick. Either the first render
  shows act 5 and the second act 6 (the sequence plays, correctly, once) or `APPLY_OFFLINE_PROGRESS`
  lands before the first paint and the baseline swallows it (nothing plays). Both are acceptable;
  neither storms, and neither can play twice.
- **Nothing is written.** No `teardownPlayed` flag, no `seenAtClock`. The sequence is not in the
  save, so it cannot be replayed by a save, corrupted by one, or migrated.

**The overlay mounts in the same commit as the act change, so the ballpark is never seen coming
apart.** This is deliberate and it is the one place the fiction and the architecture disagree. To
literally animate the tab bar collapsing, the old tab set would have to stay rendered *past* the
act flip — a second, stale shell driven by presentation state, which is exactly what Decision 3.1
exists to forbid. So **the tear is depicted, not performed**, and the compensation is that
depicting it costs one component and no state. The overlay pays for the loss by opening *in the
ballpark's own palette* and ending in Act VII's: the colour transition is the teardown.

| Stage | Window | What is on screen |
|---|---|---|
| `carrier` | 0 → 1.2s | Ground `#0d1f14`, gold `#f4d35e` text. The title breaks into three horizontal tear bands that slide apart and desaturate. One line of copy. |
| `manifest` | 1.2 → 4.4s | Ground crossfades to `#070b12`. The eight rows of the §2 mapping table type on, one every 0.4s, right-aligned column in phosphor amber. |
| `handoff` | 4.4 → 6.4s | The manifest dims to 15%; one line remains at full ink; the overlay dissolves. |

Eight rows at 0.4s is 3.2s of the 6.4s budget and is the only part worth spending real time on — it
is the payoff for six acts; everything around it is frame. **Measure against: a player who has seen
it once must be able to skip it in under a second, and a first-time player must not reach for the
tab bar before `handoff` ends.**

**No JavaScript timer.** Stages are pure CSS `animation` with `animation-delay`, and the outermost
element carries `teardown-out`; the component's `onAnimationEnd` unmounts when
`e.animationName === 'teardown-out'` (the guard matters — `animationend` bubbles from the eight
staggered children). This follows `SearchLotButton.js:24-26`'s "NO TIMER, and no local state" rule
for the same reason: a `setInterval` here is a second clock to keep in sync with the first.

**Reduced motion.** `@media (prefers-reduced-motion: reduce)` sets every teardown animation to
`animation: none` and pins each stage at its final state — the same technique already used at
`global.css:165-177` for `.floating-gain`. **That means `animationend` never fires and dismissal 4
does not exist**, which is exactly why 1–3 are in the contract: a reduced-motion player sees the
whole manifest at once, statically, and leaves via tap, `Escape` or `Continue` when they have
finished reading. An implementation that ships `onAnimationEnd` as its only exit hangs for every
reduced-motion user, silently, on the one screen the whole act is built around.

**The intro card is deferred, not consumed.** `pendingBeat` (`AppShell.js:80-81`) will resolve
`act-7-intro` the instant the act flips. `AppShell` renders `{!teardown && pendingBeat && ...}`:
the overlay suppresses the card while it is up, nothing dispatches `DISMISS_STORY_BEAT` during the
sequence, and the card is waiting when the overlay clears. That is also why a mid-sequence reload
loses nothing — `storyBeatsSeen` is the durable record and it has not been written.

---

### 6.3 The `hides` mechanism

Decision 3.1 gives the shape and the `getUnlockedFeatures` body. This is the implementation spec.

**Act VII's `hides` array — twelve ids, every one of them a tab:**

```js
hides: [
  'field', 'roster', 'concessions', 'sponsorships', 'bookie', 'ticketing',
  'capsShop', 'league', 'playoffs', 'camp', 'trade', 'prestige',
],
```

That is every key of `PANELS` (`AppShell.js:33-49`). Nothing survives.

**RULE: `hides` may contain only ids that gate a whole tab.** Feature ids do double duty — an id
matching a `PANELS` key gates a tab, and every other id gates a mechanic inside a panel
(`acts.js:15-16`). Subtracting a mechanic id has consequences the act does not intend, and three
of them are live today:

- `'hustle'` — the manual click is never gated in any act. Hiding it would break the anti-softlock
  guarantee that `engine/clicker.js`'s entire header is about, and Act VII is the act that needs it
  most (Salvage is what the click pays).
- `'retirement'` — read at `tickEngine.js:328` to decide whether `checkRetirements()` runs at all.
- `'walkup'` — read at `RosterPanel.js:88` to gate the record crate.

The near-miss that proves this needed checking: **`'concessions'` and `'sponsorships'` are both tab
ids and income-contributor names.** Hiding those tabs looks like it should switch off two income
rails. It does not — `engine/income.js` gates every contributor on its own slice contents
(`ticketingPerSecond` on `state.stadium`, the rest on their arrays), never on a feature id. So the
caps and cash trickles keep running in Act VII, which is correct: Decision 3.5 freezes the *season*,
and §3.5 removes only the `ticketing` contributor. Verified by reading `income.js:32-67`.

**`AppShell` needs no structural change for the tab that vanishes.** `AppShell.js:66`:

```js
const effectiveTab = visibleTabs.indexOf(activeTab) !== -1 ? activeTab : visibleTabs[0] || 'field';
```

Walk the exact case. A player crosses over while sitting on the League tab. `activeTab` is the
React `useState` at `AppShell.js:53` and it is **not** reset — it still holds `'league'` after the
flip, and nothing resets it. `visibleTabs` recomputes from the new unlock set and no longer
contains `'league'`, so `effectiveTab` falls back to `visibleTabs[0]`, which is `'ops'`. Every
render recomputes that fallback until the player taps an Act VII tab, at which point
`setActiveTab('fab')` makes `activeTab` valid again and the fallback stops firing. No reset is
needed and none should be added; the stale value is masked, costs nothing, and self-corrects.

**Two registration lists, two different silent failures, neither caught by `npm run build`:**

1. A tab id in `unlocks` with no `PANELS` entry → `PANELS[effectiveTab] || FieldView`
   (`AppShell.js:67`) renders **the ballpark field**, inside Act VII, under an Act VII tab bar.
2. A tab id in `PANELS` with no entry in `TabNav`'s own `TABS` array → `TabNav.js:29` filters
   `TABS` by `visibleTabs`, so the tab **renders nothing at all** and is unreachable.

Every one of §6.4's six tabs must be added to both lists, in the same order.

**`seenTabs` and the NEW badge.** `progression.seenTabs` is an append-only ledger and it is **not
cleared** at the boundary. The twelve ballpark ids stay in it forever; they are simply never
queried again, because `TabNav` only iterates `visibleTabs`. That is pillar 6 in miniature —
nothing is deleted, it is just no longer asked about — and clearing it would be strictly worse:
a player who declines, keeps playing Act VI, and crosses over later would have every ballpark tab
badged NEW if they somehow returned.

The five progressively-revealed Act VII tabs are absent from `seenTabs`, so each gets its NEW badge
the moment it appears — which is exactly the reveal the badge was built for. `ops` does not get one:
the effect at `AppShell.js:72-76` runs on `effectiveTab` regardless of the overlay, so `ops` is
marked seen while the player is looking at a black screen. That is right for the reason
`AppShell.js:70` already records — looking at a tab is what marks it seen — and a NEW badge on the
tab you were dropped onto is noise, not a reveal.

---

### 6.4 The new shell — six tabs

Keys are `PANELS` keys and `TABS` ids; declaration order is tab order.

| Key | Label | Purpose | Appears |
|---|---|---|---|
| `ops` | Ops | The terminal: net rates, the directive, the log, and where the Salvage click lives. | Act VII entry |
| `fab` | Fab | Fabrication shop — generators, scrubbers, farms, tanks. The Salvage sink. | `phaseLifeSupport` |
| `launch` | Launch | The Fuel threshold and the burn that takes you to the next site. | `launchReady` |
| `sites` | Sites | The colony ladder — Earth → Moon → outer. Each site is a base and a pad. | `launchReady` |
| `artifacts` | Artifacts | The puzzles and the hint ladder. | `phaseLunar` |
| `contracts` | Contracts | The side-quest board; each pays fixed Fuel. | `phaseDeepSpace` |

**Six is a ceiling, not a coincidence.** `global.css:1473-1489` records that Act VI's ten tabs wrap
to four rows on a 390px screen and had to be converted to a scroll-snapped single row to survive.
Act VII is the longest act in the game and ships **four fewer tabs than the act before it.** The
bar getting *smaller* as the game gets bigger is a result to defend in review: every proposal to
split `sites` from `launch`, or give puzzles a second tab, spends a budget the mobile pass already
blew once.

**Why these six.** `ops` and `fab` are the Act I pair rotated — a screen you watch and a screen you
spend on. `launch` is separate from `sites` because they answer different questions (*can I go?* vs
*where am I?*) and because a launch is a committed threshold spend that earns its own confirm
surface, the same way `CallUpModal` does. `artifacts` is separate from `ops` because a puzzle is
read, not monitored. `contracts` is last because it is the only purely optional tab — a player who
never opens it still finishes the act, slowly, which is Decision 3.6 applied to the fuel economy.

**Act VII opens on one tab.** `aftermath` shows `ops` and nothing else for 20–30 minutes: the
deliberate echo of Act I, where the entire game was one button on one screen, and the strongest
available answer to "the game just deleted everything I knew." One screen is not a punishment; it
is the only state a reveal can build from.

---

### 6.5 Intra-act reveal: `unlockedBy`

`unlocks` is per-act, and five of the six tabs arrive mid-act. **The smallest mechanism that does
not fork the derivation:** acts gain an optional `unlockedBy: { [featureId]: milestoneId }`, and
`getUnlockedFeatures` takes an optional second argument. Two lines on top of Decision 3.1's body —
accumulate `Object.assign(gated, ACTS[i].unlockedBy || {})` in the same loop that accumulates
`hides`, then extend the final filter:

```js
  return features.filter((f) => {
    if (hidden.indexOf(f) !== -1) return false;
    const milestone = gated[f];
    if (!milestone || !milestones) return true;      // fail open — see below
    return !!milestones[milestone];
  });
```

Act VII declares:

```js
unlockedBy: {
  fab: 'phaseLifeSupport',
  launch: 'launchReady',
  sites: 'launchReady',
  artifacts: 'phaseLunar',
  contracts: 'phaseDeepSpace',
},
```

**Why `milestones` and not `state`.** Handing `state` to a function in `engine/progression.js` that
currently takes an index would invite every future gate to read arbitrary state, and
derived-never-stored is the thing Decision 3.1 protects. `progression.milestones` is already
documented as "precisely what intra-act triggers are for" (Decision 3.6), is a flat boolean bag,
and is monotonic — which matters, because a gate keyed on `expedition.phase` directly would
*re-hide* a tab if a phase ever moved backwards. A milestone cannot un-fire.

**Fail-open is provably safe here, not merely convenient.** Only `AppShell.js:58` passes
`milestones`. The three other call sites omit it, and every one of them queries an id that will
never carry an `unlockedBy` entry:

| Call site | Queries | Ever gated? |
|---|---|---|
| `HeaderStats.js:61` | currency ids (`caps`/`coins`/`cash`/`salvage`) | No — §6.7 |
| `RosterPanel.js:88` | `walkup` | No — Act IV mechanic |
| `tickEngine.js:328` | `retirement` | No — Act IV mechanic |

So the rule is: **only tab ids carry `unlockedBy`, and the only caller that queries tab ids passes
`milestones`.** A future gate on a non-tab id must update those three call sites in the same
change; that sentence belongs in the comment above the function.

**Who sets the milestones.** `phaseLifeSupport` / `phaseLunar` / `phaseDeepSpace` are set by the
phase machine in §5 the first time each phase is entered; `launchReady` is set by §7 when the first
Fuel tank exists. **This section does not work if §5 and §7 do not set them** — see the
cross-section note at the end.

---

### 6.6 The cross-cutting furniture

`AppShell` renders four things outside the tab switch. All four survive, and the reasons are
already written in the file.

**`SearchLotButton`** stays unchanged in the same `.hustle-bar`. `AppShell.js:147-150` records why
it lives outside the tab switch — it was once inside `LotPanel` and creating a season silently
deleted it. It is never gated in any act (`conventions.md`, "The manual click is never gated"), and
Act VII is where that matters most: it is the Salvage faucet, and therefore the anti-softlock
guarantee for an act whose every shop is Salvage-priced. Act VII declares the same four click keys
every act since Act III has — `clickCurrency: 'salvage'`, `clickLabel` (§10), `clickMultiplier` and
`clickCooldownSeconds` (§5). `engine/clicker.js` reads them off `act.rules` and needs no change.

**`EventFeed`** stays in place below the active panel — `AppShell.js:154-155` calls it "the only
always-on signal that the simulation is running," and an act built on invisible net rates needs it
more than a baseball act did. One addition, not this section's: new `FEED_CATEGORIES` entries in
`data/feedMessages.js:14-24`. The feed is also where pillar 6 pays off — the line reporting that
your former club finished third is a feed entry, not a modal.

**`ToastHost`** stays. Its transition-diff hook (`ToastHost.js:33`) watches crew size, wall-ball
results, act and schedule index; §5 adds the expedition's transitions to the same snapshot. It must
not gain a stored queue, for the reason its own header gives. **`HeaderStats`** stays, re-fitted
below.

---

### 6.7 `HeaderStats` in Act VII

`HeaderStats` renders currency chips from `data/currencies.js`, plus Reputation, Capacity, Clock,
Next, the season/record chip and the era pill. In Act VII several of those are meaningless and four
resources need a readout a chip cannot give.

#### What comes off

Every suppression keys on one resolved rule, `resolveRules(state).seasonFrozen` — Decision 3.5's
flag. `resolveRules` **already exists** (`engine/modifiers.js:85-91`) and is already read by three
components (`PlayoffBracket.js:16`, `StandingsPanel.js:42`, `RosterPanel.js:95`). Reading a rule is
not deciding a rule; this is the established pattern.

| Chip | Suppressed when `seasonFrozen` | Why it is meaningless |
|---|---|---|
| Season / record (`HeaderStats.js:171-183`) | yes | `advance()` no longer progresses the season; the record can never change again. |
| Era pill (`HeaderStats.js:187-194`) | replaced | `eras.js:9-13` states the pill's job is making an era *transition* unmissable. Prestige is hidden, so there are no more transitions. |
| Reputation (`HeaderStats.js:145-148`) | yes | Both readers are frozen: `economy.js:16` feeds `attendanceFraction` → the `ticketing` contributor §3.5 removes, and `modifiers.js:107-108` feeds team strength → games that no longer resolve. |
| Capacity (`HeaderStats.js:149-154`) | yes | Stadium capacity with no attendance. |
| `🏆 Champions this run` (`HeaderStats.js:195`) | yes | Folded into the teardown; it is the thing that got you here, not a live stat. |

#### The phase pill

The era pill's slot, size, markup and `{ bg, ink }` contract are kept; only the source changes — in
Act VII it renders `expedition.phase` from a `PHASES` table in `data/actSevenConfig.js` carrying the
same `{ id, name, description, pill: { bg, ink } }` shape as an era. Reuse, not analogy: the pill
exists to answer "which stage of the long thing am I in," always-on, in one chip, which is exactly
the phase's job. The component branch is one ternary on `seasonFrozen`.

#### The resource readout

Four consumables with capacities do not fit a currency chip: a chip has no ceiling, no sign and no
sense of time. New `components/layout/ResourceChips.js`, rendered by `HeaderStats` as its own row
below the chip row, one `.resource-chip` per resource — icon, label, `74 / 100`, a 3px fill track,
and a signed rate.

**The component computes nothing.** `engine/expedition.js` exposes `listResources(state)` in the
shop-contract idiom (`conventions.md`, "The shop contract") — presentation-ready rows:

```js
{ id, label, icon, amount, capacity, fraction, netRate,
  trend: 'surplus' | 'steady' | 'draining' | 'starved',
  boundaryAtClock,      // clock at which it hits 0 or capacity, or Infinity
  secondsRemaining,     // boundaryAtClock - state.clock, or Infinity
  warn }                // draining and secondsRemaining <= RESOURCE_WARN_SECONDS
```

| Trend | Shown as | Fill |
|---|---|---|
| `surplus` | `▲ +1.4/s` | `#5ad1a0` |
| `steady` / at capacity | `0/s` or `FULL` | `#8fa3bb` |
| `draining` | `▼ −0.6/s · empties in 4m 12s` | `#ff8a66` |
| `starved` (at 0, net ≤ 0) | `▼ −0.6/s · THROTTLED` | `#ff6b57`, chip outlined |

Three properties of that spec are load-bearing:

1. **The sign is never carried by colour alone.** A real minus (U+2212, not a hyphen) plus a
   `▲`/`▼` glyph carries it; colour reinforces. This is also why the resource chips get their own
   class rather than reusing `.currency-rate` — `HeaderStats.js:136` hardcodes a literal `+` and a
   green colour, which is correct for a monotonic wallet and wrong for a signed rate.
2. **The bottom-out warning is the tick loop's own arithmetic, not a second estimate.** Decision
   3.3 already requires `nextColonyThresholdClock(state)` to solve, in closed form, when any
   resource next hits `0` or `capacity`. `listResources().boundaryAtClock` **must come from the same
   `resourceBoundary(resource, netRate)` helper** that `nextColonyThresholdClock` reduces over. If
   the two ever diverge the header warns at a different moment than `advance()` steps, which is the
   worst possible bug in an idle game: the UI would be lying about the only thing the player is
   watching. This is a hard requirement on §5, not a suggestion.
3. **No second timer.** All of it is a pure function of `state.clock`, which advances once a second
   and re-renders the tree — the construction `SearchLotButton.js:24-26` and the countdown chip
   (`HeaderStats.js:89-105`) already use. Fill width is a `style` transform; the remaining time is
   `formatDuration(boundaryAtClock - state.clock)`.

`RESOURCE_WARN_SECONDS` lives in `data/actSevenConfig.js`. **Starting point: 120**, measured
against the one thing that makes a warning useful — two minutes must be long enough to reach `fab`,
read an offer and buy the cheapest scrubber. If §5's cheapest relieving purchase costs more than
~120s of Salvage income at that point in the phase, the warning is decoration and the number must
rise to cover it. Simulate, 30 runs per phase: the gap between `warn` first turning true and the
cheapest fix becoming affordable.

#### Header budget on a phone

`global.css:1442-1470` records that the sticky header had to be shrunk once already. Act VII's row 1
is heartbeat, title, Salvage, Clock, Next, phase pill — **two chips fewer than Act VI's**, because
five came off above. Row 2 is the four resource chips, `repeat(4, 1fr)` on desktop and
`repeat(2, 1fr)` at ≤640px (two rows of two, ~52px). Net header height at 390px lands within ~10px
of Act VI's. That budget is now spent: a fifth resource costs a whole row.

#### The Salvage chip, and one invariant worth writing down

Act VII's `unlocks` includes `'salvage'`, which does more work than it looks like.
`HeaderStats.js:61-66` computes `unlockedCurrencies = CURRENCIES.filter((c) => unlocked.includes(c.id))`
and falls back to "whatever the player holds" **only when that list is empty** — which today it
always is, because no act's `unlocks` contains a currency id (verified: the union across all six
acts is `lot, hustle, collectors, wallBall, wagers, crew, respect, field, roster, league,
statUpgrades, concessions, cardPacks, camp, retirement, bookie, sponsorships, walkup, ticketing,
stadium, powerups, scouting, capsShop, playoffs, trade, prestige` — zero collisions). So adding
`'salvage'` makes `unlockedCurrencies === ['salvage']`, the fallback is skipped, and the header
shows **Salvage only** — no caps, no coins, no cash pile that buys nothing. It also shows Salvage at
zero, because `shownCurrencies` keeps `primary` unconditionally (`HeaderStats.js:66`), which is what
a brand-new currency needs.

That is a zero-diff result resting on a coincidence, so the invariant goes in a comment in both
`data/currencies.js` and `data/acts.js`: **no feature id may equal a currency id unless the act
deliberately intends that currency to be the only one shown.** The day someone adds `'cash'` to an
act's `unlocks` for an unrelated reason, Act VII's header quietly grows a cash chip.

---

### 6.8 Visual identity

**Act VII must not look like the ballpark, and the bar for saying so is the one `eras.js:1-17` sets**
— a named palette with a reason per colour, and every text pair's ratio computed rather than
eyeballed, because "chips render at 0.78rem on a phone, which is normal-size text for contrast
purposes, so anything under 4.5:1 is unreadable in sunlight on the bus."

**The palette: vacuum blue-black and phosphor amber.** The ballpark is warm and saturated — green
ground, gold, clay, outfield blue. Act VII is cold and near-monochrome, with exactly one warm
colour in it: the amber accent, which is the instrument glow. Everything the player buys or reads
is amber; everything else is blue-grey.

| Token | Value | Role | Ratio |
|---|---|---|---|
| `--v7-bg` | `#070b12` | Page ground (replaces `#0d1f14`) | — |
| `--v7-panel` | `#0e1622` | Panel / header ground (replaces `#143620`) | — |
| `--v7-chip` | `#0a1018` | Chip ground | — |
| `--v7-border` | `#1e2c40` | Hairlines (replaces `#23522f`) | — |
| `--v7-ink` | `#dbe6f2` | Body text on panel | **14.4:1** |
| `--v7-muted` | `#8fa3bb` | Labels, `.muted` (on chip) | **7.4:1** |
| `--v7-accent` | `#ffb340` | Headings, active tab, prices (on panel) | **10.2:1** |
| `--v7-accent-ink` | `#07121a` | Text on the amber active tab | **10.6:1** |
| `--v7-good` | `#5ad1a0` | Surplus rate / fill | **9.6:1** |
| `--v7-drain` | `#ff8a66` | Draining rate / fill | **7.9:1** |
| `--v7-alert` | `#ff6b57` | Starved / throttled | **6.5:1** |

Phase pills, in the `{ bg, ink }` shape `eras.js` uses, ratio computed ink-on-bg:

| Phase | bg | ink | Ratio | Why this colour |
|---|---|---|---|---|
| `aftermath` | `#8a9a91` | `#0a1014` | **6.5:1** | Ash green — the ballpark's colour, drained. The one phase that still remembers. |
| `lifeSupport` | `#4fb3c4` | `#04161a` | **7.6:1** | Oxygen cyan, the colour of a gauge you are watching. |
| `lunar` | `#cfc7b6` | `#14181f` | **10.6:1** | Regolith bone. |
| `deepSpace` | `#9b86e0` | `#0d0a1c` | **6.4:1** | Dusk violet — furthest from everything before it. |
| `majors` | `#f4d35e` | `#14210f` | **11.4:1** | **The game's own gold, and Act VI's exact pair.** The last phase is the only place the ballpark palette returns, because the majors is the thing baseball was always the farm team for. |

Every pair clears the 4.7:1 floor `eras.js` set for itself. The sequence is ordered so consecutive
picks are far apart on the wheel, for the same reason `eras.js:76-79` gives — "a teal that becomes
a slightly different teal" fails at being noticed. **One exception, stated deliberately:** lunar
bone (hue ~44°) and majors gold (hue ~46°) are nearly the same hue. They are not consecutive
(violet sits between them), saturation separates them at a glance, and the near-rhyme is the point
— bone is what gold looks like with the life bleached out, and getting the gold back is the arc.

**How it is applied.** One class, `expedition`, toggled on `document.body` by an effect in
`AppShell` keyed on `resolveRules(state).seasonFrozen`, removed on unmount. The ballpark ground is
painted on `html, body` (`global.css:5-13`) and `body` is the only element above the React root, so
there is no way to reach it from inside the tree; the alternatives — a second stylesheet, a second
shell — are what Decision 3.1 forbids. One line, idempotent, reverted on unmount. **It must apply
on mount, not after the teardown**, or a player reloading directly into Act VII gets a frame of
ballpark green. During the crossing itself the ordering is moot: the overlay is opaque `inset: 0`.

The CSS is one new feature section defining `body.expedition { --v7-*: … }` plus overrides for
about a dozen selectors — `.app-shell`, `.header-stats`, `.stat-chip`(`.label`), `.panel`(`h2`),
`.card`, `.btn`(`.secondary`), `.tab-nav button`(`.active`), `.tab-badge`, `.lot-click-button`,
`.event-feed`, `.modal-box` — and nothing else. Acts I–VI's literals are untouched.

**Where it goes, and this is a real footgun:** `global.css` **ends inside its
`@media (max-width: 640px)` block** (`conventions.md`, Mobile; the block opens at
`global.css:2533`), so appending at EOF makes the whole Act VII palette mobile-only. The section
goes **before** 2533 under a `/* ===== Act VII — the expedition palette ===== */` marker, per the
convention `global.css:1529-1531` describes.

**Mobile.** Six tabs inherit the scroll-snapped row from `global.css:1473-1489` and fit it without
scrolling at 390px — the first act since Act IV that does. The overlay uses `100dvh` (not `100vh`,
which is wrong under mobile browser chrome), its manifest stacks from two columns to one at ≤640px,
and its type never drops below 0.85rem. New panels hold the 44px tap minimum already enforced for
`.btn`.

---

**Files touched.**
New: `components/narrative/CallUpModal.js`, `components/narrative/TeardownOverlay.js`,
`components/layout/ResourceChips.js`, `components/expedition/{Ops,Fab,Launch,Sites,Artifacts,Contracts}Panel.js`,
`data/actSevenConfig.js` (phase pills, `RESOURCE_WARN_SECONDS`, teardown stage timings).
Modified: `data/acts.js` (Act VI `exit`; Act VII `hides` / `unlocks` / `unlockedBy` / click rules),
`engine/progression.js` (`hides` + `unlockedBy` in `getUnlockedFeatures`),
`state/actions/progressionActions.js` (`acceptCallUpAction`), `state/actionTypes.js`
(`ACCEPT_CALL_UP`), `state/gameReducer.js`, `components/layout/AppShell.js` (six `PANELS` entries,
overlay, `milestones` argument, body class), `components/layout/TabNav.js` (six `TABS` entries),
`components/layout/HeaderStats.js` (`seasonFrozen` suppressions, phase pill, resource row),
`components/prestige/PrestigePanel.js` (the standing offer card), `data/currencies.js` (`salvage`,
plus the feature-id/currency-id invariant), `data/feedMessages.js` (expedition categories),
`data/storyBeats.js` (`act-7-intro`), `styles/global.css` (the `body.expedition` section and the
teardown keyframes, inserted before line 2533).

---

## 7. Sites, colonization and launch

This is the act's spine. §5 explains where the resources come from; this section explains what
they are *for*, and why the act takes hours rather than minutes.

The user's core mechanic — **to launch further you must colonize the Moon, and a colony is what
lets you build the special places you launch from** — is expanded into a five-rung ladder. Each
rung is a site. A site is reached by a launch, colonized with Salvage, and made into a launch
platform by building a pad on it. A pad's tier gates how far the next launch can reach, and a pad
imposes permanent upkeep on the shared network, which is what makes expanding a decision rather
than a purchase.

### 7.0 Three decisions taken here, flagged for the other sections

**A. Resources are ONE global pool, not per-site pools.** Every site produces into and consumes
from a single set of Power / Oxygen / Provisions / Fuel stocks. §5 keeps its assumption: a single
per-resource net rate, and `nextColonyThresholdClock(state)` stays a closed-form solve over four
scalars rather than four × N-sites. Reasoning and the rejected alternative are in §7.4.

**B. `engine/sites.js` is the single writer of `state.expedition.phase`.** §5 and §6 read it and
never write it. See §7.7.

**C. Nothing in this section is modifier-affected.** Launch thresholds, pad costs, colonization
costs and upkeep rates are read straight from config. No `...Mult` key is introduced, nothing is
added to `BONUS_KEYS` (`data/modifierKeysConfig.js`), and a legacy perk bought in Act VI does not
move a launch threshold. This is deliberate: the fill-time arithmetic below only stays honest if
the threshold is a constant, and an implementer who wires a perk to it without adding the key gets
silent inertness — the exact bug `conventions.md` warns about. Perks continue to pay out through
the Act VI systems they were bought for.

Two more coordination points: **§5, §8 and I all edit `findNextEventClock()`
(`engine/tickEngine.js:117–132`)** — three sections, one twelve-line function, the highest-risk
merge in the fan-out. And **Fuel is debited through §5's resource helper, not through
`engine/wallet.js`** — Fuel lives in `state.expedition.resources`, not `state.wallet`.

### 7.1 The ladder

The sites are the program's own way stations, named as the program named them, which is to say:
named as a diamond. §2's mapping is not decoration here — it is the reason the ladder is strictly
ordered. *Rounding the bases: gravity assists, taken in the only order that works.* You cannot
skip second base. The fiction and the gating are the same sentence.

| Rung | Site | Where | Produces that nowhere else does | Opens |
|---|---|---|---|---|
| 0 | **Home Plate** | Earth surface — the lot behind the hardware store, still | **Oxygen.** The only free atmosphere in the game. Also the only site with the Hustle click. | On-Deck |
| 1 | **The On-Deck Circle** | Low orbit — a debris ring 150 years thick | **Salvage.** The only passive Salvage income in the act; everywhere else, Salvage is clicked or paid out by a contract. | First Base |
| 2 | **First Base** | Luna, Mare Crisium | **Power** at scale (regolith arrays, a 14-day day) and the first high-yield **Fuel refinery** — polar ice, and no gravity well to spend the product climbing out of. | Second Base |
| 3 | **Second Base** | Ceres | **Provisions** at scale — spun drum farms. The only site that can feed a five-site network. | Third Base |
| 4 | **Third Base — the Warning Track** | ~90 AU, the approach to the heliopause | **Nothing.** It produces nothing at all. It is upkeep and a pad. | **Over the wall** |

**Every site has a reason that is not "next rung."** Home Plate stays the oxygen supplier for the
entire act, which is the honest version of the fiction — you never stop shipping air up from the
farm team, and the crew you left behind keeps working after you go. On-Deck is where Salvage stops
being click-fed, which is the single largest quality-of-life jump in the act. First Base is where
Fuel/sec roughly doubles. Second Base is where Provisions stop being the binding constraint.

**The Warning Track producing nothing is the design, not an oversight.** It is the act's thesis
rendered as a mechanic: the last site is a pure sink, and the entire network — Earth's air, LEO's
scrap, Luna's power, Ceres's food — exists to hold one pad open at 90 AU long enough to swing. A
player arriving there watches every rate in the header go down and has to build anyway. Nothing is
destroyed and nothing can starve to death (Decision 3.3); the network simply gets slower, and the
last fill is the longest in the game because of a choice the player made and can see.

**Beyond the wall is not a site.** It has no rung, no colonization cost, and no production. See
§7.8.

### 7.2 Launch pads — tiers, costs, upkeep, reach

A pad is built *on* a colonized site and belongs to that site. `sites[].launchPadTier` is the only
input to reach.

| Tier | Pad | Buildable at | Salvage | Build window | Upkeep (Power/s, Prov/s) — **before** the site's `upkeepFactor` | Reaches |
|---|---|---|---|---|---|---|
| 1 | **The Sandlot** | Home Plate only, exists at act start | — | — | 0 / 0 | rung 1 |
| 2 | **The Mound** | any reached site | 3,600 | 5 min | 1.5 / 0.4 | rung 2 |
| 3 | **The Long Toss** | rung ≥ 2 | 12,500 | 8 min | 5 / 1.5 | rung 3 |
| 4 | **The Cutoff** | rung ≥ 3 | 33,000 | 10 min | 14 / 4 | rung 4 |
| 5 | **The Swing** | rung 4 only | 68,000 | 12 min | 40 / 12 | over the wall |

The names are the mapping still paying out. Every pad up to tier 4 is a *throw* — the mound, the
long toss, the cutoff relay that a way station literally is. The fifth is not a throw. It is the
only launch in the act where the player is the batter rather than the pitcher, and it is the only
one aimed at the wall. Six acts of pitching, one swing.

**`upkeepFactor` is where distance costs something.** A pad is a machine that must be fed from the
network; a colony grows what it can. So the site's `upkeepFactor` multiplies the **pad tier's**
upkeep only, and colony base upkeep is authored per site directly:

| Site | `upkeepFactor` | Colony base upkeep (Power/s, O₂/s, Prov/s) | Pad upkeep at max tier |
|---|---|---|---|
| Home Plate | 1.0 | 0 / 0 / 0 | — |
| On-Deck | 1.2 | 2 / 1.5 / 1 | T2 → 1.8 Power, 0.5 Prov |
| First Base | 1.6 | 6 / 4 / 3 | T3 → 8 Power, 2.4 Prov |
| Second Base | 3.0 | 14 / 9 / 6 | T4 → 42 Power, 12 Prov |
| Third Base | 6.0 | 30 / 20 / 14 | **T5 → 240 Power, 72 Prov** |

That last row is the number the whole network is sized against, and it is a **hard dependency on
§5**: the colonized network must be able to produce roughly **300 Power/sec and 100
Provisions/sec** by the time The Swing is built, or the act stalls at its most dramatic moment. If
§5's generator ceilings cannot reach that, scale this table down and re-derive — do not raise the
generator ceiling, because the point is that the Track is *expensive*, not that it is impossible.

**Naming trap, called out because it will otherwise be walked into:** `upkeepFactor` deliberately
does **not** end in `Mult`. `conventions.md` reserves that suffix for members of `BONUS_KEYS` in
`data/modifierKeysConfig.js`; a `siteUpkeepMult` that is not in that list is silently inert, and a
silently-inert upkeep multiplier is a balance bug that no build catches. This is a plain config
scalar on the site record and is named like one.

**Invariant: reach is a function of built pad tier alone, never of current satisfaction.** A
starved network launches *later*, never shorter. Decision 3.3 forbids destroying anything
purchased, and a pad whose reach degrades under starvation is destruction with extra steps —
worse, it is destruction that can happen while the player is asleep. Starvation costs rate. It
never costs a capability. This keeps `listOffers` a pure function of `launchPadTier` and forecloses
a whole class of "why can't I launch, I could yesterday" bug.

More precisely: reach is a function of `launchPadTier` and the explicit mothball flag below, and
**never** of current satisfaction. That is the invariant that matters.

**Optional escape valve, one clause not a system:** a pad may be **mothballed** — upkeep goes to
zero, the pad cannot launch, the tier is retained, and un-mothballing is free and instant. This
lets a player who over-built recover without losing anything, and it is three lines in
`engine/sites.js`. Cut it if it does not earn its UI.

### 7.3 Launch as an event

**`engine/launch.js`, pure, shop-contract shaped.**

```js
listOffers(state)              // one row per currently-legal destination
purchase(state, offerId)       // commits the burn; new state, or null for refused
resolveArrivals(state)         // called from advance(); idempotent
nextArrivalClock(state)        // contributes to findNextEventClock()
```

`listOffers` returns presentation-ready rows in the house shape
(`{ id, name, description, effect, cost, currency, owned, affordable }`) plus the launch-specific
fields the panel needs and must not compute: `originSiteId`, `destinationSiteId`, `requiredPadTier`,
`fuelHeld`, `fuelRequired`, `overshootRatio`, `transitSeconds`, `inFlight`, `blockedReason`. `cost`
is the threshold and `currency` is `'fuel'` — but **`engine/wallet.js` is not the debit path**.
Fuel is in `state.expedition.resources` (Decision 3.4), so `purchase` spends through §5's resource
helper. If §5 does not export one, this section needs `spendResource(state, 'fuel', amount)` and
should say so loudly rather than reaching into the slice.

**A launch runs over a window, and the window is the point.** The alternative — instant, threshold
met, site unlocked — was considered and rejected on three grounds:

1. **§2 says a pitch is "thrust along a vector, committed to before you can see the result."** An
   instant launch is a purchase. A committed burn with a result you wait for is the metaphor
   working.
2. **It is the act's only honest invitation to leave.** An idle game needs a "come back later"
   hook that is not a bar. A transit is dead time the game explicitly asks the player to spend
   elsewhere, and it is the one moment where closing the tab is the correct play.
3. **It is nearly free.** `arrivesAtClock` is an existing idiom (`nextGameAtClock`,
   `completesAtClock`, `nextChallengeAtClock`), it is one more candidate in `findNextEventClock()`,
   and it is a single monotone comparison.

**Transits fit in `state.expedition.launches` with no new field on the slice.** §4 describes
`launches: []` as "completed launches, for the log." A launch in flight is simply a record that
has not resolved yet:

```js
{ id, originSiteId, destinationSiteId, committedAtClock, arrivesAtClock, overshootRatio, resolved }
```

`resolveArrivals` flips every unresolved record whose `arrivesAtClock <= state.clock`, marks the
destination `reached`, and sets `resolved: true`. **Idempotent by construction** — a second pass
finds nothing unresolved. An 8-hour offline return that crosses three arrivals resolves them in
three iterations in clock order, and re-running `advance()` over the same span changes nothing. The
log and the in-flight state are one list, which is also how the player reads it.

**Offline safety.** `nextArrivalClock` contributes at most one boundary at a time (only one launch
may be in flight — see below), and `engine/sites.js: nextBuildClock` contributes at most one per
site, so this section adds O(6) boundaries to an 8-hour catch-up against
`balanceConfig.safetyCapIterations = 2000` (`tickEngine.js:443`). §5's per-resource threshold
boundaries are the ones with a real budget question; this section's are noise. Worth a joint
measurement anyway.

**One launch in flight at a time.** Not a technical limit — the ladder is strictly ordered, so
there is never a second legal destination. Stating it as an invariant keeps `listOffers` simple and
makes the "already in flight" refusal a single check.

#### Can a launch fail?

**No. A committed launch always arrives, and never loses the Fuel.** Arguing it rather than
asserting it, because pillar 3 is doing real work here:

The tempting design is a success roll modified by preparation. It is wrong for this game for a
reason that is architectural before it is philosophical: **a random outcome resolved inside
`advance()` is resolved during offline catch-up, in front of nobody.** A player who commits a
40,000-Fuel burn, closes the tab, and returns to "the burn was short" has been dealt a loss they
did not see, could not influence, and cannot audit. The repo's own guard rail says the same thing
from the other side — `src/engine/` takes `rng` as a defaulted parameter precisely so behaviour is
reproducible, and `advance()` is deterministic today outside game simulation. Threading an rng
through the tick loop to roll dice at a clock boundary is a change to the engine's character, for
a mechanic whose only product is a player who lost 27 minutes for reasons that scrolled past.

The second argument is scale. A failed launch costs the full fill — 22 to 30 minutes at the top of
the ladder. Idle games punish with time, and this act *already* punishes with time; adding a
variance term on top of a half-hour wait is not risk, it is a tax on session length.

So the risk lives at commit time, in front of the player, and it is not random at all:

**Overshoot: the outcome is a deterministic function of `fuelHeld / threshold`.** The Fuel tank
serving each launch has capacity **1.6× the threshold**, so the player can bank up to 60% over.
Committing dumps **the entire tank**, not the threshold — there is no change.

**Tank capacity is a property of the highest rung reached, authored here.** §4 binds
`fuel: { capacity: 0 }`, so without an explicit ladder the tank is whatever §5's module list
happens to provide, overshoot silently clamps, and the launch-now-or-hold decision — this
section's entire answer to "can a launch fail?" — would not come online until the third burn.
Instead each site carries `fuelCapacityOnArrival` in `actSevenSitesConfig.js`, set to 1.6× the
threshold of the launch that departs *from* it, and arrival raises the tank. That makes the 1.6×
rule structural rather than a coincidence between two sections' tuning. §5's tank modules become
optional capacity stacked **on top** of that floor rather than the gate on it — which is what
beat L-5's tank farms are for: banking past 1.6×. **Check against §5's `modules: []`** that
capacity is additive from two sources and that nothing there assumes it owns the ceiling.

| Overshoot | Transit | Arrival grant |
|---|---|---|
| 1.0× (the minimum) | baseline | none |
| each +0.1 | −4% transit | +2% of the destination's colonization cost, in Salvage |
| 1.6× (tank full) | −24% transit | +12% of colonization cost |

This is *stealing* from §2's table — departing on a window the other side has not closed yet. Go
now on the open window and pay in transit time, or hold for six more minutes and arrive with the
cargo margin that pays for half the colonization. No dice, no hidden state, no soft-lock, and the
surplus the player accumulated while doing something else is finally worth something.

### 7.4 Multi-site resource management — one pool

**Decision: a single global pool.** Every colonized site adds its production and its upkeep to one
set of Power / Oxygen / Provisions / Fuel stocks, and there is one satisfaction factor for the
whole network.

**Consequence for §5, stated explicitly as the brief requires:** `nextColonyThresholdClock(state)`
solves over exactly four scalars with one net rate each. Nothing in this section makes a rate
depend on a stock. Colony base upkeep, pad upkeep and `upkeepFactor` are all constants in time
within a step, so the boundary stays a closed-form solve and Decision 3.3's linearity requirement
holds unchanged. §5 does not need to know how many sites exist to compute a rate — it sums a list.

**Why not per-site pools.** They are genuinely better *design*: local shortages, routing, a
Provisions run to the Track that has to be planned. They are also four separate multiplications of
cost — the solve becomes 4 × N boundaries in `findNextEventClock`, satisfaction becomes N factors
that throttle N production sets, the UI grows a per-site resource readout with five stacked
headers on a 390×844 phone (`conventions.md`, Mobile), and every §5 formula acquires a site
dimension. That is most of a second act's worth of work for an act that already has puzzles, a
teardown, contracts and five sites.

**What buys back most of the interest for the price of one config scalar** is `upkeepFactor`
(§7.2). Distance is expensive, so *where* you build is a real decision even though *what you build
from* is one pot. The Track's 6.0 factor makes the final pad cost six times what the same machine
costs in LEO, and that single number carries the load-in-and-out fiction that per-site pools would
have carried with bookkeeping.

**If the expensive version is ever wanted, the cheap version of it is a display layer.** Compute
each site's contribution to the global rate (§5 already has the per-site terms to sum), and show
them per site in the ladder panel without splitting the pools. The player gets "Ceres is carrying
this network" as information; the engine keeps one solve. That is the recommended v2, and it is a
component, not an engine change.

**Non-goal:** transfer, shipping, logistics, or any player-routed movement of resources between
sites. Listed in §13.

### 7.5 The numbers, and how to re-derive them when §5 moves

**The thresholds are derived, not authored.** The design intent is the *fill time in minutes*; the
threshold is `assumedNetFuelRate × targetFillSeconds`. If §5's simulated rates differ from the
assumptions below — and they will — **hold the fill minutes and recompute the thresholds.** That is
the contract. Re-litigating the fill minutes is a pacing conversation; recomputing a threshold is
arithmetic.

| # | Burn | Assumed net Fuel/sec, **measured after** | Target fill | Threshold | Tank cap (1.6×) | Transit |
|---|---|---|---|---|---|---|
| L1 | Home Plate → On-Deck | 1.4 avg (ramping 0.5 → the 2.0 anchor) | 14 min / 840 s | **1,200** | 1,920 | 3 min |
| L2 | On-Deck → First Base | 3.5, after the On-Deck salvage refit | 20 min / 1,200 s | **4,200** | 6,720 | 5 min |
| L3 | First Base → Second Base | 8.0, after the Luna refinery | 28 min / 1,680 s | **13,500** | 21,600 | 8 min |
| L4 | Second Base → Third Base | 16.0, after the Ceres drum farms | 22 min / 1,320 s | **21,000** | 33,600 | 10 min |
| L5 | Third Base → over the wall | 26.0, **net of the Warning Track's upkeep** (≈32 before it) | 27 min / 1,620 s | **42,000** | 67,200 | 12 min |

The "Tank cap" column is the site's `fuelCapacityOnArrival` (§7.3): reaching On-Deck raises the
tank to 6,720 — the ceiling for L2, which departs from On-Deck. L1's own 1,920 comes from
`fuelCapacityOnArrival` on Home Plate, granted when the first tank is bought (see below).

Three notes that are the difference between this table working and this table lying:

**L5's rate is post-Track and that is load-bearing.** Arriving at the Warning Track *lowers* net
Fuel/sec, because 240 Power/s and 72 Provisions/s of pad upkeep come out of the same pool that
feeds the refineries. 26/s is the number after that hit. Sizing L5 against the pre-Track 32/s would
put the final fill at 22 minutes on paper and 27 in practice, and `deepSpace` would break its
budget at exactly the beat that must not drag. This is the one place the best narrative beat fights
the pacing table, and the pacing table wins by being told the truth.

**Every quoted rate is a post-event steady state, and each fill begins right after an event that
just changed the rate.** The real fill is an integral over a ramp, not a quotient — the player is
still building modules while the tank fills. Measured wall-clock will exceed `threshold ÷ rate` by
5–15% at every rung. **The simulation must measure the integral, not the quotient**, and the
tuning comment must record which it measured. This is precisely the class of error that produced
the re-measurement blocks in `data/acts.js` Act III.

**L1 is gated by the tank, not by the rate.** §4 binds `fuel: { amount: 0, capacity: 0 }` — Fuel
cannot accumulate at all until a tank exists. Without that lever, 1,200 Fuel against a rate ramping
to 2.0/s over a 45–60 minute phase is crossed around minute 31 and L1 ends `lifeSupport` a third
early, stealing the time from `lunar`. **So: the first Fuel tank must not be affordable before
roughly minute 35 of `lifeSupport`.** With the tank landing at ~35 and the rate ramping 1.2 → 2.0
across the next 20 minutes, 1,200 Fuel is crossed at ≈ minute 49 — inside the 45–60 band, with the
last third of the phase spent on a bar the player just unlocked rather than one that has been
filling since minute one. **This is a named §5 dependency: the first tank's Salvage price is a
pacing control, not an economy number.**

**Salvage costs, same treatment.** These are the least-confident numbers in the section, because
§5 owns the Salvage rate. Assumed rate stated so they can be recomputed:

| Purchase | Salvage | Assumed Salvage/s at that point | ≈ min of income | Build window |
|---|---|---|---|---|
| Colonize On-Deck | 2,000 | 10 | 3.3 | 3 min |
| The Mound (T2) | 3,600 | 12 | 5.0 | 5 min |
| Colonize First Base | 8,600 | 24 | 6.0 | 6 min |
| The Long Toss (T3) | 12,500 | 26 | 8.0 | 8 min |
| Colonize Second Base | 21,000 | 44 | 8.0 | 8 min |
| The Cutoff (T4) | 33,000 | 55 | 10.0 | 10 min |
| Colonize the Warning Track | 27,000 | 75 | 6.0 | 6 min |
| The Swing (T5) | 68,000 | 95 | 12.0 | 12 min |

Colonizing the Track is deliberately *cheap* to establish and ruinous to sustain. That inversion is
the site's whole character and should survive retuning.

**Side-quest sizing, for §9.** A single fuel contract should pay **8% of the threshold of the
launch currently being filled**, and **no more than 40% of any threshold may come from contracts** —
five countable contracts per rung, and the colony is always the main engine. Concretely:

| Rung | Threshold | One contract (8%) | Contract ceiling (40%) |
|---|---|---|---|
| L1 | 1,200 | **100** | 480 |
| L2 | 4,200 | **340** | 1,680 |
| L3 | 13,500 | **1,100** | 5,400 |
| L4 | 21,000 | **1,700** | 8,400 |
| L5 | 42,000 | **3,400** | 16,800 |

8% is chosen so a contract is worth roughly 100 seconds of production — visible on the bar, felt
immediately, and never a substitute for building. If §9 wants larger, rarer contracts, hold the
40% ceiling and reduce the count.

### 7.6 Phase pacing — `lunar` and `deepSpace`

**The honest risk, named up front:** an idle act that is 80 minutes of watching a bar fill is a
failure, and the Fuel bar is 80 minutes long. The defence is a hard rule with a measurable form.

> **The dead-air metric.** At no point may more than **2 minutes** pass in which the player has
> *no affordable purchase available and no event pending*. This is measurable in simulation —
> drive `advance()` and record the longest interval where `listOffers` across every shop returns
> zero affordable rows and `findNextEventClock()` is more than 120 seconds out. **A story that
> lands a phase without this measurement in its comment block is not done.**

The rule works because the Fuel bar is never the only thing running. Salvage accrues continuously
against a sink that is always open — the next pad, the next colonization, the next §5 module, the
next §8 hint. The Fuel fill is the *phase* timer; the Salvage loop is the *minute* timer. If
simulation shows dead air, the fix is a cheaper Salvage sink, never a smaller threshold.

**How to read the beat tables.** A beat's minutes are its own activity. **The Fuel fill named in a
beat began at the previous commit and has been running underneath everything since** — the beat
names where the fill *completes*, not where it runs. So beat L-6 is a 16-minute beat that
completes a 28-minute fill; the other 12 minutes elapsed during L-4 and L-5 while the player was
colonizing Luna and building The Long Toss. This is the whole reason the act is not a bar-watching
exercise, and it is stated here because otherwise the two tables read as a 12-minute arithmetic
error.

**`lunar` — 60–80 min.** Begins on L1's arrival at On-Deck. Ends on L3's commit — the moment the
player leaves cislunar space, which is what the phase name means.

| Beat | Min | What the player is doing | Flat point | Unlock landing on it |
|---|---|---|---|---|
| **L-1 · Debris sweep** | 0–8 | Colonize On-Deck. First passive Salvage in the act; the shop stops being fed by a thumb. | — | (this beat *is* the relief for `lifeSupport`'s tail) |
| **L-2 · The Mound** | 8–20 | Build T2. Discover a pad has upkeep, and that Earth alone cannot cover it. First forced trip back to §5's generators. | ~min 18: one currency, one sink, nothing to choose between | **Refit modules** — upgrade an owned generator instead of buying another. A second axis on the same Salvage. |
| **L-3 · The second burn** | 20–35 | Fill 4,200. The overshoot decision appears for the first time with a tank that can hold it. | ~min 30: the last third of the fill | The **overshoot** row goes live at 1.0×, and a §9 contract (340 Fuel) is scheduled to land here |
| **L-4 · Mare Crisium** | 35–48 | 5-min transit, colonize Luna, stand up the refinery. Fuel/sec roughly doubles. | — | the act's biggest single rate jump; no relief needed |
| **L-5 · The Long Toss** | 48–58 | Build T3. Its upkeep is the first that can visibly throttle the network. The satisfaction number becomes something the player watches. | ~min 55: micro-managing one percentage with no clear lever | **Tank farms** — capacity, not rate. Changes what the player optimizes from "more per second" to "how much can I bank," which is what overshoot needs. |
| **L-6 · Leaving cislunar** | 58–74 | Fill 13,500. Last chance to overshoot before the long transit. | ~min 70 | The **`deepSpace` teardown beat** (§6) fires on commit — the second time the UI changes under the player |

Totals: **74 min with no contracts** (the upper bound), **≈65 min at typical contract engagement
(~25% of the ceiling)**, **≈60 min at the full 40%.** All three land in the 60–80 band, which is
the check that matters — the band must hold for a player who ignores §9 entirely.

**`deepSpace` — 60–90 min.** Begins on L3's *commit*, not its arrival. The asymmetry is
deliberate: the teardown beat is the burn itself, and it puts the 8-minute dead transit inside the
budget it belongs to rather than making `lunar` pay for it.

| Beat | Min | What the player is doing | Flat point | Unlock landing on it |
|---|---|---|---|---|
| **D-1 · The long transit** | 0–8 | Nothing at the destination yet. Earth, On-Deck and Luna keep producing; Salvage keeps arriving. **Designed absence** — the game says out loud that this is a good time to leave. | this beat is *entirely* flat, on purpose | The feed runs the league's season without you. Hours in, your old club finishes third (Decision 3.5, and the act's best quiet line). |
| **D-2 · The drum** | 8–20 | Colonize Ceres. Provisions stop being the binding constraint for the first time since `lifeSupport`. | — | — |
| **D-3 · The Cutoff** | 20–32 | Build T4. Upkeep now exceeds what Luna alone carries; the four sites become a network rather than a list. | ~min 28: three production sites, one satisfaction number, no way to tell which lever helps | **Per-site contribution readout** (§6 — the display-only version of per-site pools from §7.4) plus §8's routing puzzle |
| **D-4 · The fourth burn** | 32–54 | Fill 21,000 while building Ceres out. The longest concurrent stretch in the act. | ~min 48 | A §9 contract chain (1,700 each) and the warning-track puzzle (§8) are scheduled across this window |
| **D-5 · The Warning Track** | 54–70 | 10-min transit, colonize a site that produces **nothing**. Watch every rate in the header go down. Build anyway. | ~min 64: the network is worse than it was and the bar is slower | **The Swing** appears in the pad list — the first pad whose reach column does not name a site |
| **D-6 · The swing** | 70–89 | Fill 42,000. The last threshold in the game. | the whole beat | Nothing relieves it, and nothing should — see the carve-out below. This is the only place in the odyssey where the flat point is the point. |

**D-6 is the one exception to the dead-air metric, and it is deliberate.** The Swing is the last
item on this section's ladder, so §7's shop is empty for the entire final beat by construction.
Rather than invent a sink to satisfy a rule, the rule takes an exception: **the dead-air metric
holds everywhere in the act except D-6.** The last threshold in the game is the only place that
wants the player watching, and a simulation run that reports dead air at D-6 is reporting intent,
not a bug — the story's comment block must say so explicitly, or the next person to run the check
will "fix" it. (§5's module line and §8's final hint tier both remain purchasable through D-6 if
they happen to still be open; neither is *scheduled* to be.)

**Which rate D-6's 27-minute figure assumes.** L5's fill starts at the L4 commit (minute 54) and
the network degrades in two steps: the Warning Track's colony base upkeep lands at arrival
(~minute 64) and the T5 pad's 240 Power/s lands when The Swing completes (~minute 82). So the
effective rate steps roughly 32 → 30 → 26, and sizing the 42,000 threshold against a flat 26/s is
**deliberately conservative by ~15%.** The safe direction: D-6 will measure shorter than the table
says, pulling `deepSpace` further inside its 90-minute ceiling. If simulation confirms the
integral, spend the recovered minutes on D-5 rather than raising the threshold — arriving at a
site that produces nothing is the beat worth lingering on.

Totals: **89 min with no contracts**, **≈78 min typical**, **≈72 min at the full 40%.** The
no-contract case sits one minute inside the 90-minute ceiling, which is tight enough that if §5's
rates come in low, **D-4 and D-6 are the two fills to shorten first** — they are the only beats
with slack that does not cost a narrative moment.

**Act VII total at typical engagement:** 25 (`aftermath`) + 49 (`lifeSupport`) + 65 + 78 = **217
min ≈ 3.6 h**. With no contracts at all: **≈4.05 h**. Both inside the 3.5–5 h target, with the
upper half of the band reserved for a player who solves no puzzles and brute-forces on cooldown
(§8).

### 7.7 Phases are intra-act, and `engine/sites.js` owns the field

All five phases live inside Act VII. They are **not** acts and do not touch `progression.act`;
Act VII's `unlocks` / `hides` fire once, at the boundary from Act VI. `state.expedition.phase` is
stored because §4 binds it, but it is **recomputed from a pure predicate ladder on every
`advance()` and written only when it differs** — so an old save, a hand-edited save, or a save that
crossed a boundary during an 8-hour catch-up self-heals to the correct phase. That is the house
compromise between §4's stored field and `conventions.md`'s "derived, never stored."

| Phase | Predicate | Owner |
|---|---|---|
| `aftermath` | default | §5 |
| `lifeSupport` | (§5's first-generator condition) | §5 |
| `lunar` | On-Deck is `reached` | **§7** |
| `deepSpace` | an L3 launch record exists (commit, not arrival) | **§7** |
| `majors` | `progression.milestones.overTheWall` | **§7** |

**`engine/sites.js` is the single writer.** §5 supplies the two early predicates as pure functions
and does not write the field. Two writers on a stored, self-healing field is a race that only shows
up on somebody's real save.

`engine/sites.js` also carries the site record's shape. §4 sketches
`sites: [{ id, colonized, launchPadTier }]`; the implementation needs two more fields, which is an
extension of an entry shape rather than a new slice and **should be confirmed by the orchestrator**:

```js
{ id, reached, colonized, launchPadTier, buildingId, readyAtClock }
```

`buildingId` is `'colonize'` or `'padTier3'` — **one build per site at a time.** That is a design
constraint as much as a simplification: a site's crew can only do one thing, so owning four sites
means four builds can run in parallel, and the network's build throughput is itself a reason to
colonize. It also collapses colonization windows and pad-build windows into a single
`readyAtClock`, which is one `findNextEventClock` contributor instead of two.

`engine/sites.js` exposes the Salvage side of the ladder under the shop contract:
`listOffers(state)` (colonize-this-site and build-this-pad rows, cost/affordability resolved),
`purchase(state, offerId)`, `resolveBuilds(state)`, `nextBuildClock(state)`. Same idempotence
argument as arrivals: a completed build clears `buildingId`, so a replayed step is a no-op.

### 7.8 The ending — what "the majors" is

**Winning Act VII is committing the fifth burn.** `launch.purchase` on the over-the-wall offer sets
`progression.milestones.overTheWall`. That is the win condition, and it is a *commit* rather than
an arrival for the same reason the crossing is offered rather than imposed (Decision 3.2): the
game's last act should be the player's, not a timer's. Act VII declares `exit: null` —
`FINAL_ACT_INDEX` is 6 and means it literally again.

Twelve minutes later the transit resolves and `phase` becomes `majors`.

**What is on the other side is a standings table.**

Not a colony, not a sixth phase, not a new content area — the game cannot afford one and does not
need one. The terminal comes back up and shows the exact component the player learned in Act III:
a league table. Earth is one row. The other rows are other farm systems, each with the game *they*
were taught — a species that learned the same control problem through something with a net,
something with a track, something with no ball at all. One config file of prose
(`data/actSevenBoardConfig.js`) and one panel that reuses the standings layout. **The last screen
of the game is the first screen the game ever taught you, and you are in the standings.** That is
pillar 5 collecting on six acts and pillar 4 — reuse before invention — at the same time.

Earth's placement is **deterministic, computed from the run**: elapsed minutes in the act, puzzles
solved unaided vs. hinted vs. brute-forced (§8), contracts completed (§9), peak network Fuel/sec,
and overshoot ratios across the five burns. No dice. A player who played well finishes higher, and
the board tells them which line they earned.

**After that: standing orders.** `majors` is open-ended but is a *post-game state*, not a new
phase. The five sites stay live, the Hustle stays, and an endless ladder of scaling long contracts
consumes Salvage and Fuel to move Earth up the board. That is the idle tail every incremental
needs, and it costs one config file and one panel.

**There is no reset axis in v1, and that is a decision rather than an omission.** Decision 3.2
retired the prestige tab, so a replay axis would have to be designed and built, not inherited. The
designed option, sketched here so a later story can take it and left unbuilt so this one can ship:

> **Service time.** After the board, the program offers to send the next one up. A new run of
> **Act VII only** — the odyssey is not replayed — with the network's accumulated *service time*
> granting a flat production bonus. It is prestige's shape scoped to one act, it reuses
> `resetForPrestige`'s structure without touching `PRESTIGE_ACT_INDEX`, and it is honest to the
> fiction: Earth is a farm team, and a farm team's job is to keep sending them up.

Listed in §14 as the open question it is. Shipping `majors` without it leaves the game with an
ending and an idle tail, which is more than Act VI has today.

---

**Files touched.**
New: `src/data/actSevenSitesConfig.js`, `src/data/actSevenLaunchConfig.js`,
`src/data/actSevenBoardConfig.js`, `src/engine/sites.js`, `src/engine/launch.js`,
`src/state/actions/expeditionActions.js`, `src/components/expedition/SiteLadder.js`,
`src/components/expedition/LaunchPanel.js`, `src/components/expedition/BoardPanel.js`.
Modified: `src/engine/tickEngine.js` (`findNextEventClock` at :117–132 — **shared with §5 and §8**;
plus `resolveArrivals` / `resolveBuilds` calls in the loop body near :458),
`src/engine/progression.js` (the `overTheWall` milestone), `src/data/acts.js` (Act VII `unlocks`),
`src/data/feedMessages.js` (launch, arrival, colonization, the league's season without you),
`src/state/actionTypes.js`, `src/state/gameReducer.js`, `src/components/layout/AppShell.js`.

---

## 8. Puzzles, artifacts and the hint economy

> *The panel does not have a manual. The panel has never had a manual. That is the point of the
> panel.*

**Nine puzzles, one per fielder**, spread across the five phases. Nine is not decoration: the act's
thesis is that the player already learned this material, and nine is the number they have been
looking at for four hours. Six of the nine have a baseball answer wearing operational clothes; the
other three are observation, inference and rate arithmetic — the skills `lifeSupport` teaches anyway.

### 8.1 The rule: the GOAL may be unclear, the FEEDBACK never is

The failure mode of "puzzles that aren't clear" is the moon-logic adventure puzzle, where the player
is not solving a problem but guessing what the author was thinking. Six rules keep this act out of
that:

1. **The prompt never lies and never withholds a needed number.** Everything required is printed on
   the artifact. No second panel, no hidden note, no feed line you had to have read.
2. **No outside knowledge except baseball** — which the game supplied over four hours. No trivia, no
   puns, no rebuses, no pixel-hunting, no anagrams.
3. **The player can check their own answer before submitting.** The strongest rule. Every answer is
   verifiable against the printed data: a sequence you can walk, a count you can re-count, arithmetic
   you can redo. A puzzle confirmable only by the panel is a guessing game and does not ship.
4. **Wrong answers get exact feedback** (§8.2), including the case where the player understood the
   puzzle and answered a slightly different question.
5. **Real orbital mechanics must be real.** Two puzzles compute a synodic period and a
   constant-bearing intercept, both correctly. Where the alien vocabulary would mislead someone who
   knows the physics — a "four-burn transfer" is four *departures*, not four *impulses* — **the
   prompt defines the term inline.** P1's definition line and P6's "leads by one fixed angle" both
   exist because review caught exactly that trap.
6. **The unclear part is the QUESTION, not the ANSWER.** The panel never says "this is a baseball
   question." It says `SET THE PAIR.` The a-ha is recognition, and recognition is instant once it
   arrives — which is the feeling the act is selling.

**Why the constraint is worth it.** An unsolvable puzzle plus a hint ladder is a paywall with extra
steps, and there is no money here, so the wall is just the player's time taken without a trade. Every
hint in §8.4 must be a *convenience* purchase made by someone who could have solved it. The moment a
hint becomes the only route, the Salvage price stops being a sink and becomes a toll.

### 8.2 Feedback: how the game says "close" versus "wrong track"

Every submission returns one of five codes, computed in `engine/puzzles.js`. The prose lives in
`data/actSevenPuzzlesConfig.js` under `FEEDBACK_LINES`, keyed by code, **per-puzzle overridable** —
the overrides are where most of the charm is.

| Code | Number input | Sequence input | Word input |
|---|---|---|---|
| `SOLVED` | within `tolerance` of `value` | every token in position | in `accept[]` after normalisation |
| `NEAR` | within `2 × tolerance`; panel says LOW or HIGH | ≥ half in position; panel prints `n OF 4 IN POSITION` | in `near[]` — right kind of thing |
| `WRONG_KIND` | — | a token that is not one of the four bodies | in `wrongKind[]` — real baseball term, wrong event |
| `OUT_OF_BAND` | beyond `2 × tolerance`; direction still given | fewer than half in position | in no list; no direction available |
| `NULL` | unparseable or empty | too few tokens | empty after normalisation |

- **Numeric puzzles always give direction**, which makes them binary-searchable, and that is
  *intended*: binary search **is** the brute-force path for a number, priced by the cooldown (§8.7),
  not forbidden. A ten-step search at P7's 90s cooldown is fifteen minutes — exactly
  `attemptsToBypass × cooldown`, so neither route dominates and there is no exploit to find.
- **Sequence puzzles give positional counts, not "warmer."** `2 OF 4 IN POSITION` is real
  information; a careful player converges on P5 in three or four submissions. Withholding it makes
  the puzzle a 24-way lottery, and a lottery is not a puzzle.
- **`NEAR` and `WRONG_KIND` are the empathy codes**, written for the player who understood *more*
  than was asked. The physics-literate player who answers `8` to P1 gets `YOU ARE COUNTING ARRIVALS.
  THE PROGRAM DOES NOT SCORE ARRIVALS.` — not "INCORRECT". That line is the difference between a game
  that respects the person playing it and one that doesn't.

**Off-by-one is accepted, not punished.** P4's band is 499–501 because "the cycle the last unit was
drawn" versus "the cycle after which none remained" is a *reading* ambiguity, not a comprehension
failure; where a band exists it is a `tolerance` in config with a comment naming the ambiguity it
absorbs. The same instinct governs wording — P2 asks for *the largest deviation accepted*, P7 for *how
far up the receiver's track* — because naming the exact scalar is cheaper than adjudicating a reading
in a `near` line.

### 8.3 The ladder

Nine artifacts, with the exact player-facing strings — this is `data/` content. The baseball key lives
in the **Key** row; nothing §8.1 or §8.2 already states is restated, and bypass counts are in §8.7's
table rather than here. **Every `Unlocks` is a capability or a tax removal, never raw progress,
and no phase transition anywhere in the act is gated on a puzzle** — §5 and §7 own the phase gates and
they are resource and site conditions. A player who never opens the artifact tab still reaches
`majors`; the *if ignored* line is what they pay, and it is always Fuel, a Salvage rate, or
information.

#### P1 — `circuitConfirmation` · Certification Plate · **aftermath**

```
APTITUDE PROGRAM 7 — CERTIFICATION
CANDIDATE POPULATION: SOL III
PROGRAM DURATION: 151 LOCAL YEARS

THE CIRCUIT HAS FOUR STATIONS INCLUDING THE ORIGIN.
A VEHICLE IS CREDITED ONLY IF IT VISITS EVERY STATION IN
SEQUENCE AND ARRIVES BACK AT THE ORIGIN.

ONE BURN IS COMMITTED AT EACH DEPARTURE.
ARRIVALS ARE NOT SCORED.

STATE THE NUMBER OF BURNS.
```

| | |
|---|---|
| **Input / answer** | number `BURNS` → **4**, tolerance 0. **`near[]`** `8` → `YOU ARE COUNTING ARRIVALS. THE PROGRAM DOES NOT SCORE ARRIVALS.` · `3` → `THE ORIGIN IS A STATION.` |
| **Key** | The diamond. Four bases including home; you depart each exactly once. The teaching puzzle: it establishes in the act's first ten minutes that **these are baseball questions**, so every later panel is read through that lens |
| **Hints** | `THE PANEL IS ASKING YOU TO DESCRIBE A SHAPE YOU KNOW.` / `FOUR STATIONS. YOU DEPART FROM ALL OF THEM, INCLUDING THE LAST.` / `IT IS A DIAMOND. COUNT THE BASES.` |
| **Unlocks / if ignored** | The **artifact index** — later artifacts announce themselves in the feed / you find them by opening the tab |

#### P2 — `zonePlate` · Insertion Gauge · **aftermath**

```
INSERTION LOG — LAST NINE ATTEMPTS
DEVIATION FROM CENTRE, IN BAND UNITS.

  -3.0   ACCEPTED        +2.7   ACCEPTED
  +1.4   ACCEPTED        -4.0   ACCEPTED
  +4.2   REJECTED        +4.1   REJECTED
  -0.1   ACCEPTED
  +4.0   ACCEPTED
  -4.4   REJECTED

STATE THE LARGEST DEVIATION THIS PANEL WILL ACCEPT.
```

| | |
|---|---|
| **Input / answer** | number `BAND UNITS` → **4.0**, tolerance 0.05. **`near[]`** `8` → `THAT IS THE WIDTH. THE PANEL ASKED FOR THE EDGE.` · `4.2` → `THAT ONE WAS REJECTED.` |
| **Key** | Pure observation, no baseball required — `+4.0` and `-4.0` are the corners, and the corner is a strike. The only puzzle whose whole solution is *sorting a printed column*, which is why it sits second |
| **Hints** | `EVERY NUMBER YOU NEED IS ON THE PLATE.` / `SORT THE ACCEPTED ROWS BY MAGNITUDE. IGNORE THE SIGN.` / `LARGEST ACCEPTED MAGNITUDE IS 4.0. SMALLEST REJECTED IS 4.1.` |
| **Unlocks / if ignored** | **Insertion tolerance readout** on the launch panel — see whether a filed trajectory is in band before committing Fuel (§7) / out-of-band insertions cost a retry burn |

#### P3 — `regulator` · Scrubber Regulator · **lifeSupport**

```
SCRUBBER REGULATOR — MANUAL MODE

REGULATOR STATE IS A PAIR OF COUNTERS.
THE LEFT COUNTER ADVANCES ON A REJECTED CYCLE.
THE RIGHT COUNTER ADVANCES ON AN ACCEPTED CYCLE.
THE PAIR RESETS WHEN THE LEFT REACHES FOUR.
THE PAIR RESETS WHEN THE RIGHT REACHES THREE.

THE REGULATOR RUNS AT FULL THROUGHPUT IN EXACTLY ONE STATE:
THE STATE FROM WHICH THE NEXT CYCLE, WHATEVER IT IS, RESETS
THE PAIR.

SET THE PAIR.
```

| | |
|---|---|
| **Input / answer** | pair `PAIR` → **3-2**. Accepts `3-2`, `3 2`, `32`, `3,2`, `three two`, `3 and 2`, `full`, `full count`. **`near[]`** `2-3` → `YOU HAVE THE COUNTERS THE WRONG WAY ROUND.` · `4-3` → `THOSE ARE THE RESET VALUES, NOT THE STATE BEFORE THEM.` |
| **Key** | A full count: 3–2, and the next pitch ends the at-bat whatever it is. The purest statement of the thesis, which is why the literal string `full count` is in `accept[]` — not a cheat code, the panel confirming the player got there the fast way |
| **Hints** | `THE STATE YOU WANT IS ONE STEP BELOW BOTH RESETS AT ONCE.` / `THE LEFT COUNTER IS BALLS. THE RIGHT IS STRIKES.` / `IT IS A FULL COUNT.` |
| **Unlocks / if ignored** | **Regulator override**: every Oxygen scrubber runs at **+25% throughput** (§5 owns the module) / buy more scrubbers — pure Salvage |

#### P4 — `manifest` · Recovered Ration Manifest · **lifeSupport**

```
RECOVERED FROM THE HULK AT 60 KM. WATER DAMAGE THROUGHOUT.

  MANIFEST — PROVISIONS
  LOADED AT DEPARTURE .......... 2,400 UNITS
  CREW ......................... 6
  DRAW ......................... 1 UNIT PER CREW PER CYCLE
  RESUPPLY ..................... NONE SCHEDULED

  LOG, CYCLE 200 (HANDWRITTEN):
  "two of us went on."

STATE THE CYCLE ON WHICH THE LAST UNIT WAS DRAWN.
```

| | |
|---|---|
| **Input / answer** | number `CYCLE` → **500**, tolerance 1 (accepts 499–501, §8.2). **`near[]`** `400` → `YOU HELD THE CREW AT SIX. READ THE LOG AGAIN.` · `600` → `THE DRAW ONLY CHANGES AT CYCLE 200.` |
| **Key** | Rate arithmetic with a step change: 6×200 = 1,200 drawn; 1,200 remain at 4/cycle = 300 more. The only artifact in a human hand, and it teaches the `lifeSupport` skill in the phase that introduces it, on a worked example whose stakes are somebody else's |
| **Hints** | `THE DRAW RATE IS NOT CONSTANT.` / `THE LOG LINE IS A CREW COUNT, NOT A EULOGY.` / `1,200 UNITS REMAIN AT CYCLE 200. FOUR CREW DRAW THEM.` |
| **Unlocks / if ignored** | **Forecast readout**: every resource row gains time-to-empty / time-to-full (§5, §6) / you watch bars instead of numbers |

#### P5 — `assistChain` · Circuit Plate · **lunar**

```
ASSIST CHAIN — FILE AN ORDER

FOUR BODIES. YOU ARRIVE WITH 0 ENERGY.
A BODY WILL NOT ACCEPT YOU BELOW ITS GATE.
A BODY YOU HAVE PASSED ADDS ITS GAIN, ONCE.

  BODY     GATE    GAIN
  VESH       9       6
  ORE        0       3
  TIRRA     15       4
  KAL        3       6

FILE ALL FOUR IN ORDER.
```

| | |
|---|---|
| **Input / answer** | sequence of 4 → **ORE KAL VESH TIRRA**. `,` `>` `->` and whitespace all normalise the same. `n OF 4 IN POSITION` on every wrong submission |
| **Key** | Gravity assists in the only order that works — which is *rounding the bases*: you cannot touch third before second, and the energy you bring to each came from the last |
| **Hints** | `ONLY ONE BODY WILL ACCEPT YOU AT ZERO.` / `YOU HAVE DONE THIS FOUR HUNDRED TIMES. YOU WERE NOT ALLOWED TO SKIP ONE THEN EITHER.` / `ORE OPENS IT AT 3. KAL TAKES YOU TO 9. VESH TAKES YOU TO 15.` |
| **Bypass note** | **`attemptsToBypass: 8` is deliberately above what a systematic player needs.** With positional feedback, 24 permutations collapse in three or four submissions. That is the intended relationship everywhere in §8.7: the counter is a *ceiling on the worst case*, not a pace, and a player who deduces should beat it |
| **Unlocks / if ignored** | **The assist route to the outer sites** — materially cheaper in Fuel than a direct transfer (**§7 dependency**) / direct transfers at a large Fuel premium |

#### P6 — `theWindow` · Departure Board · **lunar**

```
DEPARTURE BOARD

TWO BODIES SHARE A PLANE.
THE INNER COMPLETES ONE CIRCUIT IN 12 UNITS.
THE OUTER COMPLETES ONE CIRCUIT IN 20 UNITS.

THE BOARD OPENS ONLY WHEN THE OUTER LEADS THE INNER BY ONE
FIXED ANGLE. THAT ANGLE IS SATISFIED NOW.

STATE THE INTERVAL UNTIL IT IS SATISFIED AGAIN.
```

| | |
|---|---|
| **Input / answer** | number `UNITS` → **30**, tolerance 0.1. **`near[]`** `60` → `THAT IS WHEN BOTH RETURN TO WHERE THEY STARTED. THE BOARD DOES NOT CARE WHERE THEY STARTED.` · `8` → `THAT IS A DIFFERENCE OF PERIODS, NOT OF RATES.` · `32` → `THE BOARD IS NOT A SUM.` |
| **Key** | The synodic period, `1 / (1/12 − 1/20) = 30`. Correct physics: a transfer window recurs at the synodic period whatever phase angle it needs. Baseball: **stealing** — you go when the lead is right, and if you miss it the lead comes back around |
| **Hints** | `THE ANSWER DOES NOT DEPEND ON WHAT THE ANGLE IS.` / `WORK IN CIRCUITS PER UNIT, NOT UNITS PER CIRCUIT. SUBTRACT.` / `ONE DIVIDED BY (1/12 MINUS 1/20).` |
| **Unlocks / if ignored** | **Launch-window readout** — next open window and the Fuel discount for waiting (**§7 dependency**) / you launch at whatever phase angle you are at, at a Fuel premium |

#### P7 — `releasePoint` · Rendezvous Trainer · **deepSpace**

```
RENDEZVOUS TRAINER

THE RECEIVER IS 8 UNITS DOWNRANGE, ON A TRACK PERPENDICULAR
TO YOUR LINE OF SIGHT, MOVING AT 3 UNITS PER BEAT.

YOUR VEHICLE HOLDS 5 UNITS PER BEAT FROM RELEASE.
YOU MAY NOT STEER AFTER RELEASE.

STATE HOW FAR UP THE RECEIVER'S TRACK YOU AIM.
```

| | |
|---|---|
| **Input / answer** | number `UNITS UP TRACK` → **6**, tolerance 0.1. **`near[]`** `2` → `THAT IS WHEN. THE PANEL ASKED WHERE.` · `10` → `THAT IS THE LENGTH OF YOUR PATH. THE PANEL ASKED FOR THE POINT.` · `8` → `YOU AIMED AT HIM.` |
| **Key** | Constant-bearing intercept: `8² + (3t)² = (5t)²` → `t = 2`, receiver has moved **6**; the 3-4-5 is not hidden. Baseball: **the pitch, and every throw** — you commit before you can see the result, and you throw where he is going to be |
| **Hints** | `HE WILL NOT BE THERE WHEN YOU ARRIVE.` / `SOLVE FOR THE TIME FIRST. YOUR PATH AND HIS TRACK MAKE A RIGHT TRIANGLE.` / `TWO BEATS. HE MOVES 3 A BEAT.` |
| **Unlocks / if ignored** | **Rendezvous assist**: docking with a salvage hulk yields **+50% Salvage** (§5) / less Salvage per hulk — purely a rate |

#### P8 — `filedArcs` · Trajectory File · **deepSpace**

```
FOUR ARCS ON FILE.

  ARC ONE     DEPART 3.1 · CAPTURE 0.9 · DEPART 0.9 · ARRIVE 3.1
  ARC TWO     DEPART 3.2 · CORRECT 0.1 · ARRIVE 3.0
  ARC THREE   DEPART 3.0 · CORRECT 0.1 · NO ARRIVAL ON FILE
  ARC FOUR    DEPART 3.4 · CAPTURE 1.1 · HOLD · DEPART 1.1

THE VEHICLE CARRIES NO CAPTURE STAGE.
THE VEHICLE IS EXPECTED BACK.

NAME THE ARC.
```

| | |
|---|---|
| **Input / answer** | word `ARC` → **ARC TWO**. Accepts `arc two`, `two`, `2`, `arc 2`. **`near[]`** `arc three` → `NO CAPTURE STAGE REQUIRED. ALSO NO WAY HOME.` |
| **Key** | The free return: departure burn plus a mid-course correction, no capture, because the geometry brings you back. Baseball: **a home run** — a trajectory that leaves and returns without a rendezvous |
| **Hints** | `TWO CONDITIONS ARE STATED BELOW THE FILE. BOTH BIND.` / `A CAPTURE IS A RENDEZVOUS. YOU CANNOT PERFORM ONE.` / `TWO ARCS HAVE NO CAPTURE. ONLY ONE COMES BACK.` |
| **Bypass note** | **`attemptsToBypass: 4` equals the number of options, consciously.** A player who tries all four arcs has, in a real sense, read the board; setting it to 10 would only make an honest brute-forcer wait for a result they already earned. The config carries a comment saying so |
| **Unlocks / if ignored** | **Free-return survey probe** — reads the next site's yields before you commit Fuel to a crewed launch (**§7 dependency**) / you commit blind |

#### P9 — `theWall` · Final Certification · **majors**

```
FINAL CERTIFICATION.

ONE EVENT. TWO BODIES.

THE FIRST CROSSES THE BOUNDARY AND IS NOT RECOVERED.
NO INSTRUMENT FOLLOWS IT. NOTHING IS SENT AFTER IT.

THE SECOND COMPLETES THE FOUR-BURN CIRCUIT AT WALKING PACE,
WITH NO OPPOSITION, AND ARRIVES AT THE ORIGIN.

THE PROGRAM SCORES BOTH.
IT HAS ONE NAME FOR BOTH.

NAME IT.
```

| | |
|---|---|
| **Input / answer** | word `NAME` → **home run**. Accepts `homer`, `homerun`, `home-run`, `hr`, `dinger`, `tater`, `long ball`, `four bagger`, `moon shot`, `out of the park`, `over the wall`, `gone`. **`wrongKind[]`** `grand slam` → `THAT IS FOUR RUNNERS. THE EVENT DESCRIBED HAS ONE.` · `foul ball` → `A FOUL BALL IS NOT SCORED.` · `heliopause` / `free return` → `THOSE ARE OUR WORDS FOR IT. WE ASKED FOR YOURS.` |
| **Key** | The act in one prompt. The ball leaves and never comes back — the outfield wall is the heliopause, nobody has hit one over it. The runner completes the four-burn circuit at a trot, unopposed, and arrives home. One name, two trajectories |
| **Hints** | `WE DID NOT INVENT THIS WORD. YOU DID.` / `ONE OF THE TWO BODIES IS A PERSON.` / `THE SECOND BODY IS A RUNNER AND HE IS NOT HURRYING. WHY NOT?` |
| **Why it may be the hardest** | It is the only puzzle whose reward is entirely narrative. §3.6 says no puzzle gates the only path, and the strongest compliance available is a final puzzle that gates *nothing at all*: a player who never solves it still crosses, described accurately as someone who kept trying |
| **Unlocks / if ignored** | **`APTITUDE CONFIRMED`** — the crossing is certified, not merely fuelled / the crossing still happens the moment the Fuel threshold is met, and the program certifies you as `PERSISTENT`. §10 owns both strings |

### 8.4 Pricing: every number here is a fraction of §5's income, not a constant

**Read §5.2, the table headed *Salvage income by phase*.** That table — and only that table — is the
input to every Salvage figure in §8.

This section's first draft priced hints against an assumed scale and was wrong by roughly 10×, because
§5 landed `deepSpace` at 220–900/sec while §8 assumed a mid-tier module cost 5,000 for the whole act.
Ledger R6 names §8's ladder the act's **elastic sink** — no pacing table depends on it — so the fix is
not a better constant, it is to stop having constants. **§8 authors a duration; §5 supplies the rate;
the Salvage figure is derived.** When §5 retunes, §8 regenerates instead of silently contradicting it.

```
// R(phase) = sqrt(entryRate * exitRate)   -- geometric mean of §5.2's band for that phase.
//   hintCost(tier, phase) = round2sf( HINT_TIER_SECONDS[tier] * R(phase) )
//   itemCost(item)        = round2sf( ITEM_MINUTES[item] * 60 * R(item.availableFrom) )
//   HINT_TIER_SECONDS     = { T1: 8, T2: 26, T3: 80 }   -- the only authored numbers here.
// round2sf = round to TWO SIGNIFICANT FIGURES. Stated, because "regenerate against §5's bands"
// otherwise gives two implementers two different price lists -- the exact staleness this scheme
// exists to prevent.
```

Geometric, not arithmetic, because Salvage income grows roughly exponentially within a phase: wall
time is spread evenly in *log* rate, so the geometric mean is the rate the player spends the median
minute of the phase at. An arithmetic mean overweights the last ten minutes of every phase and prices
every hint for a player who no longer needs one.

**Derived — regenerate from §5.2, do not hand-edit:**

| Phase | §5.2 band | **R(phase)** | T1 (8s) | T2 (26s) | T3 (80s) | Ladder / puzzle | Puzzles | Phase total |
|---|---|---|---|---|---|---|---|---|
| `aftermath` | 2.7 → 12 | **5.7** | 46 | 150 | 460 | 656 | P1, P2 | **1,312** |
| `lifeSupport` | 12 → 40 | **22** | 180 | 570 | 1,800 | 2,550 | P3, P4 | **5,100** |
| `lunar` | 40 → 220 | **94** | 750 | 2,400 | 7,500 | 10,650 | P5, P6 | **21,300** |
| `deepSpace` | 220 → 900 | **445** | 3,600 | 12,000 | 36,000 | 51,600 | P7, P8 | **103,200** |
| `majors` | 900+ | **900** (floor) | 7,200 | 23,000 | 72,000 | 102,200 | P9 | **102,200** |

Three authored numbers rather than 27, because 27 numbers is 27 chances for a retune to miss one. The
**1 : 3.25 : 10 tier ratio makes T1 a reflex, T2 a decision and T3 an admission** — that shape is the
design intent and it is what survives a rebalance. There is deliberately no phase multiplier any more:
the old `HINT_PHASE_MULT` ramped 0.4 → 2.0 to make late hints dearer, and §5's income ramps 5.7 → 900,
which does that job 30× harder and does it faithfully.

**Two caveats on the R column.** `majors` is the one price in §8 referenced to a **floor** rather than
a mean, because §5.2 gives it no ceiling; that makes P9's ladder the cheapest in the act relative to
income, and cheaper still as income climbs — safe precisely because P9 gates nothing and its reward is
purely narrative, so do not "fix" it by inventing a ceiling. And **`aftermath`'s 5.7 is the least
settled of the five**, because aftermath income is click-dominated and §5.9 lists `clickFlatValue: 8`
as its number-one provisional; if the opening faucet moves, P1/P2's hints regenerate, which is the
scheme working rather than a problem to route around.

**Prices are baked at authoring time, not computed at runtime.** `hintCost()` reads a number out of
`data/actSevenPuzzlesConfig.js`; the formula lives beside it as a comment, in the style of the 30-run
tuning blocks in `data/acts.js`. Computing `R(phase)` inside `data/` would put logic in the config
layer, which the house rules forbid — and computing it from the player's *actual* income would mean a
stuck player, poor precisely because they are stuck, pays more than a comfortable one.

### 8.5 Items you save up to buy

**Every item is a PERMANENT CAPABILITY, not a per-puzzle consumable.** A decoder that translates a
whole class of artifact is a better purchase than a hint for the same reason a collector is a better
purchase than a click: it changes what the rest of the act feels like. Hints are the impulse buy;
items are the plan. Costs derive from §8.4's `itemCost`; the Salvage column is generated.

| Item | From | `ITEM_MINUTES` | **Cost (derived)** | Effect | Affects |
|---|---|---|---|---|---|
| **Flight Manual, Fragment 3** | `lifeSupport` | 1.5 | **2,000** | **Tier-1 hint free on every puzzle, forever.** The fragment explains what each class of panel is *for*, never what to type | All 9 |
| **Lexicon Core** | `lifeSupport` | 2.5 | **3,300** | Prompts render from `promptTranslated`: `BEATS` → seconds, `BAND UNITS` → degrees, `CIRCUIT` → orbit. **Changes no answer** — removes vocabulary friction so the puzzle is the puzzle | All 9 |
| **Recovered Scorecard** | `lifeSupport` | 4 | **5,300** | A water-damaged scorecard from a 1974 minor-league game, pulled out of the salvage; it prints the program's vocabulary against the one you already know. **Tier-2 hint free on every baseball-key puzzle** | 1, 3, 5, 6, 7, 8, 9 |
| **Doppler Rangefinder** | `lunar` | 2 | **11,000** | Instrument. Reveals the hidden quantity on any artifact that has one: draws the accept band on the Insertion Gauge to scale, prints the assist gates as a solved ladder, shows the two bodies' relative angle live | 2, 5, 6 |
| **Attempt Governor Bypass** | `deepSpace` | 2 | **53,000** | **Halves the submission cooldown on every puzzle**, present and future. The brute-forcer's item, priced to be reachable before the expensive puzzles | All 9 |
| **Inertial Plot Table** | `deepSpace` | 3 | **80,000** | Adds **SIMULATE** beside SUBMIT: test an answer with **no attempt recorded and no cooldown consumed**. A run takes 20 real seconds and reports only `PASS`/`FAIL` — no direction, no `n OF 4` | 1, 2, 4, 5, 6, 7 |

> §5.8's `deepSpace` entry cites "the Plot Table at 12,000" as the sink scheduled at that flat point.
> The item is still scheduled there; the figure is **superseded by the derived 80,000**, which is what
> makes it function as the relief §5.8 wants it to be.

**Why the Plot Table is the most expensive thing here.** It removes *risk*, which is worth more than
removing difficulty. 20s per run and a bare PASS/FAIL keeps it from being a faster binary search than
simply submitting (90s, but returns *direction*): `simulate` is better for testing a theory you
believe, `submit` is better for searching. Simulation must confirm neither strictly dominates.

**Relative pricing makes the two free-hint items structurally ROI-positive, and that is a property,
not a mispricing.** The first draft called the Scorecard the only item with positive Salvage ROI;
under §8.4 that is false, because anything bought cheap in `lifeSupport` and redeemed against
`deepSpace` and `majors` hints captures a 20–40× income ramp. Repricing is the wrong fix — costing
the Scorecard against the hints it replaces puts it near 50,000, unreachable in the very phase where
a player is still learning the act's grammar and most needs it.

| Item | Cost | Value at full ladder | Value at median play (est.) |
|---|---|---|---|
| Flight Manual | 2,000 | 16,352 (8.2×) | ~900 — **negative** |
| Recovered Scorecard | 5,300 | 52,520 (9.9×) | ~4,000 — roughly break-even |

**That spread is the whole design.** A player only "saves" a hint they would otherwise have bought,
and §8.7's brute-forcer proves nobody has to buy any: against the full ladder both look like free
money, against how most people play they are a wash. **Simulation must produce the median column** —
it is an estimate here and it decides whether these two rows are a decision or a tax. The Lexicon Core
is unaffected; its Salvage ROI is **zero** by construction, because it saves *attempts*, and attempts
are cooldown minutes. Both currencies count.

### 8.6 The sink: how much of the act's Salvage §8 is allowed to take

| | Salvage |
|---|---|
| Every hint on every puzzle, graded phases only | 130,912 |
| Every hint on P9 (`majors`, post-critical-path) | 102,200 |
| Every item in §8.5 | 154,600 |
| **§8's total claim on the graded phases** | **285,512** |

Against a graded-phase lifetime earn of **≈ 2.48M** — the sum over `aftermath` … `deepSpace` of
`R(phase) × §5.8's authored duration` — that is **11.5%**.

**The old 20–33% target is retired** — it was set when §8 believed lifetime earn was 150k–250k, and
written before ledger R2 inflated §7's ladder fourfold. The new band is **8–15% of graded-phase
earn**, and the two failure conditions differ. **Below 8%** the puzzles stop being a sink and Salvage
inflates against §5's module ladder, reopening the `deepSpace` flat point in §5.8. **Above 15%** §8
competes with §7's colonization ladder, which is *load-bearing for the pacing tables* where §8 is not
— and R6 applies directly: **§8 is the first lever to move.**

**Why 11.5% is tight rather than comfortable.** R2's reconciled §7 ladder is 1,296,000 across `lunar`
and `deepSpace` — **52%** of graded-phase earn on its own — and §5's module ladder with growth
exponents is roughly another **30%**. Adding §8 puts the act's total Salvage demand near **93% of its
supply**, leaving almost no slack for a player who buys in a different order than the tuning assumed.
**This is R2's combined-sink simulation and it is the first thing to run for this act.** If it
overruns, cut `HINT_TIER_SECONDS` and `ITEM_MINUTES` before touching §5 or §7 — two tables, no pacing
consequences. Per phase the local load is 15.3% / **22.7%** / 8.2% / 11.8% of that phase's own earn;
`lifeSupport` is the peak because all three cheap items are offered there, which is intended (it is
the phase where an item is a genuine save-up rather than a rounding error) but is also the number most
likely to hurt, because it is the same phase §5.8 flags as flattening at minute 30.

### 8.7 Anti-soft-lock: the player who solves nothing and buys nothing

Worst case, walked: a player opens every artifact, never solves one, never buys a hint, and mashes
**OPERATE MANUALLY** until each panel gives up.

| Puzzle | Phase | `attemptsToBypass` | `attemptCooldownSeconds` | Worst case | Phase duration | Share of phase |
|---|---|---|---|---|---|---|
| P1 Certification Plate | `aftermath` | 6 | 45 | 4.5 min | 20–30 min | 30–45% (both) |
| P2 Insertion Gauge | `aftermath` | 6 | 45 | 4.5 min | " | " |
| P3 Scrubber Regulator | `lifeSupport` | 8 | 60 | 8 min | 45–60 min | 27–36% (both) |
| P4 Ration Manifest | `lifeSupport` | 8 | 60 | 8 min | " | " |
| P5 Circuit Plate | `lunar` | 8 | 90 | 12 min | 60–80 min | 30–40% (both) |
| P6 Departure Board | `lunar` | 8 | 90 | 12 min | " | " |
| P7 Rendezvous Trainer | `deepSpace` | 10 | 90 | 15 min | 60–90 min | 23–35% (both) |
| P8 Trajectory File | `deepSpace` | 4 | 90 | 6 min | " | " |
| P9 Final Certification | `majors` | 10 | 150 | 25 min | open-ended | — |
| **Total** | | | | **95 min** | | |

**The governing constraint is the per-phase share, not the total: bypass wall time for all puzzles in
a phase must be ≤ 50% of that phase's authored duration.** Every row satisfies it (worst is `lunar`
at 40%). The total is misleading because cooldowns run *concurrently* with generators, modules and
contracts — a player waiting out a 90-second governor is not idle, they are playing the rest of the
game.

**The design ratio: a zero-solve, zero-hint run finishes the act at 1.3× the median run, and never
worse than 1.5×.** Against the act's 3.5–5h band that is roughly **4.5–6.5 hours**. This is chosen,
not fallen into. A brute-forcer must feel materially slower — otherwise solving is pointless and the
act's texture is decorative — but must never feel *punished*, because they have done nothing wrong.
They may simply not enjoy puzzles, and the game does not get an opinion.

**The archetype owns the Attempt Governor Bypass**, because it is that item's stated audience and it
halves every cooldown in the table above; leaving it out makes 1.3× unfalsifiable. The measured run is
therefore **0 solved, 0 hints, Bypass bought as soon as `deepSpace` income allows**. Three things make
1.3× right rather than something larger:

1. **Only part of the 95 minutes is blocking.** No phase gate is a puzzle, so a bypass is on the
   critical path only while the capability it unlocks is a Fuel tax the player is currently paying.
   The simulation must measure the *blocking* fraction, not the total.
2. **The brute-forcer banks the hint ladder** — **130,912 Salvage across the graded phases**, which
   buys modules and buys back time. Use the graded figure, not the 233,112 act total: P9's 102,200 is
   `majors`-only and post-critical-path, so it cannot offset pace during the phases being measured.
   That offset is why the ratio is smaller than the raw cooldown arithmetic suggests — hints are
   time-cheap and Salvage-expensive, brute force is the reverse.
3. **`attemptsToBypass` is the tuning dial** — a small per-puzzle integer, and the only knob that
   should move if the measured ratio lands wrong. Do not tune the cooldowns: they are also the
   anti-spam rate limit and they set §8.2's binary-search price.

**What the simulation must check** (`node` harness, injected deterministic `rng`, 30 runs per band,
in the style of the `data/acts.js` Act III/IV comment blocks):

- Median time-to-`majors` for a **solver** (9 solved, 0 hints), a **buyer** (0 solved, full ladder,
  all items) and a **brute-forcer** (as defined above). Target `brute / solver ≤ 1.5`, ideally ≈ 1.3.
- No configuration of `expedition.puzzles` makes any phase gate unreachable.
- Buyer's total sink lands at 8–15% of graded-phase earn, and R2's combined §5+§7+§8 draw stays under
  100% of Salvage supply in every phase.
- Median-play hint counts, so §8.5's median-value column stops being an estimate.
- With the Plot Table owned, `simulate`-driven search is not strictly faster than `submit`-driven
  search on any numeric puzzle.

### 8.8 Engine spec — `engine/puzzles.js`

Pure. No React, no DOM, no `Date.now()`, no `Math.random()` — nothing here is random. Follows the shop
contract exactly: the engine resolves availability, cost, ownership and affordability; the component
renders rows and decides nothing.

```js
// Defaulting accessor. Tolerates state.expedition being absent ENTIRELY, not merely .puzzles —
// saves are never migrated (Decision 3.4) and an in-flight Act IV save has no expedition slice.
function puzzleState(state, puzzleId) {
  const e = (((state && state.expedition) || {}).puzzles || {})[puzzleId] || {};
  return { attempts: e.attempts || 0, hintsBought: e.hintsBought || 0,
           solved: !!e.solved, bypassed: !!e.bypassed,
           nextAttemptAtClock: e.nextAttemptAtClock || 0 };   // absent MUST read as ready
}
```

| Export | Returns |
|---|---|
| `listPuzzles(state)` | Presentation-ready rows, availability resolved (shape below) |
| `checkAnswer(puzzleId, input)` | `boolean`. Stateless. Takes an **id**, never an accept-list — no component ever receives one |
| `answerFeedback(puzzleId, input)` | `{ code, lineId, detail }` — a code and a *key* into `FEEDBACK_LINES`, never a composed string |
| `submitAnswer(state, puzzleId, input)` | New state, or `null` for refused (unknown id, already resolved, cooldown live) |
| `attemptBruteForce(state, puzzleId)` | Alias for `submitAnswer(state, puzzleId, null)`. One code path, two labels |
| `buyHint(state, puzzleId)` | Buys the next unbought tier. New state or `null` |
| `hintCost(state, puzzleId, tier)` | The baked §8.4 price, or `0` when an owned item makes that tier free |
| `listInstruments(state)` / `buyInstrument(state, itemId)` | The §8.5 shop, standard shop contract |
| `simulateAnswer(state, puzzleId, input)` | `null` unless the Plot Table is owned. Records no attempt, consumes no cooldown |
| `attemptCooldownRemaining(state, puzzleId)` | Clamped seconds (below) |
| `solvedUnaided(state, puzzleId)` | `solved && hintsBought === 0`. **§9's Rule 5 Draft predicate** (§9.5, contract 11) and §10's `act-7-first-puzzle` feed trigger both call this — neither reads `state.expedition.puzzles` directly, per R5's layer ruling. Omit the id to ask "any puzzle" |
| `aptitudeSummary(state)` | `{ solved, bypassed, unaided, unresolved }` for §10's ending text |
| `nextPuzzleCooldownClock(state)` | Earliest live `nextAttemptAtClock`, or `Infinity`. A `findNextEventClock` contributor (below) |

`listPuzzles(state)` row — same spirit and structure as `engine/lotShop.js:74`:

```js
{
  id, name, artifact, phase, inputLabel, unlocksLabel,   // unlocksLabel is player-facing, from data/
  prompt,                              // promptTranslated when the Lexicon Core is owned
  inputKind,                           // 'number' | 'sequence' | 'word'
  revealed, status,                    // 'open' | 'solved' | 'bypassed'
  attempts, attemptsToBypass, cooldownRemaining,       // cooldown in seconds, already clamped
  hints: [{ tier, cost, bought, affordable, text }],   // ALWAYS 3; text is NULL unless bought
  instrumentReadout,                   // null unless the Doppler Rangefinder is owned
}
```

**`text: null` for unbought hints is a hard rule, not an optimisation.** Prose that reaches the row
reaches the DOM, and a player who opens devtools out of idle curiosity is handed a spoiler they did
not ask for. Same reasoning as `revealed` in `lotShop.js:45`: what the component cannot see, it
cannot leak. Answers themselves ship readable in `dist/main.js` and that is fine — **tier 3 is
near-explicit by design, so the bundle is at worst a free hint the player could have bought**, and
obfuscating means moving prose out of `data/`, breaking the layer rule for no gain.

**The cooldown clamp is lifted from `engine/clicker.js:73–78` for the three reasons its header gives.**
The wait is clamped to what the *current* config declares, so a stale `nextAttemptAtClock` —
hand-edited save, a retune that shortened the cooldown, the Governor Bypass bought mid-wait — can
never ask for a longer lockout than the puzzle in front of the player says. An absent field reads
`0`: in the past, therefore ready.

```js
function attemptCooldownRemaining(state, puzzleId) {
  const seconds = attemptCooldownSeconds(state, puzzleId);   // halved if Governor Bypass owned
  if (seconds === 0) return 0;
  const target = puzzleState(state, puzzleId).nextAttemptAtClock - ((state && state.clock) || 0);
  return Math.max(0, Math.min(seconds, target));
}
```

`submitAnswer` **refuses rather than throws** when the cooldown is live, matching `applyClick` and
`resolveChallenge`, so a double-dispatch or a second tab cannot double-count an attempt.

**`nextPuzzleCooldownClock` is a UI-wake boundary, not a rate boundary** — ledger R5. It changes no
rate, so Decision 3.3's linear-within-a-step requirement and the closed-form solve in
`nextColonyThresholdClock` are untouched; it exists only so an offline catch-up lands a step the
moment a governor expires rather than showing a stale `OPERATE MANUALLY` button. Per R5 this is **a
registration against the contributor list introduced by the Phase 0 refactor of `findNextEventClock`
(`tickEngine.js:117–132`), not an edit to that function's body** — §5, §7, §8 and §9 all append there.
It is storm-safe because **nothing in `advance()` writes `expedition.puzzles`**: `attempts` advances
only inside `submitAnswer`, reachable only from a player dispatch, so an 8-hour catch-up cannot bypass
a puzzle, fire a solve toast or change the artifact tab. The boundary is read, never written through.

**Answer normalisation** — one function, applied to both sides of every comparison:

```js
function normalize(raw) {
  return String(raw == null ? '' : raw)
    .trim().toLowerCase()
    .replace(/[‐-―−]/g, '-')                 // unicode dashes / minus -> hyphen
    .replace(/[.,;:!?'"()\[\]]/g, ' ')
    .replace(/\b(the|a|an|is|it)\b/g, ' ')   // articles and copulas
    .replace(/\s*(->|>|→)\s*/g, ' ')         // sequence separators collapse to space
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Three comparators, selected by `inputKind`. **`number`** — parse the first numeric token (`3,200`,
`4.0`, `+4`, `−4` all parse); compare `Math.abs(parsed - value) <= tolerance`. **`sequence`** — split
on spaces, map each token through the puzzle's `tokenSynonyms`, compare lists; positional match count
feeds `NEAR`. **`word`** — membership in normalised `accept[]`, checking `near[]` then `wrongKind[]`
before falling through to `OUT_OF_BAND`. So `3-2`, `3 2`, `32`, `three two`, `Full Count` and `full`
all reach the same normalised form or `accept[]` entry for P3. The config carries the mapping; the
engine carries no literals.

**Flags.** Two writes on resolution, and the split matters. `progression.milestones['puzzle:' + id]`
is set on **solve or bypass**: every downstream gate (§5's regulator override, §7's assist route)
reads this one key and therefore *cannot* accidentally distinguish the two routes — the anti-soft-lock
guarantee expressed as a naming convention. `progression.milestones['puzzleSolved:' + id]` is set on
**solve only** and read by nothing except `aptitudeSummary()` and §10's ending text. Deliberately
**not** a third `solvedUnaided` key: §9's Rule 5 Draft needs the hint count, which lives in the slice,
so it goes through the export. Colon-namespaced keys sit in the flat `progression.milestones` map read
by `isExitSatisfied()` (`engine/progression.js:60`) and add no new state shape.

### 8.9 Cross-section dependencies

| Depends on | What §8 assumes |
|---|---|
| **§5 economy** | **§5.2's *Salvage income by phase* table is §8's only price input** (§8.4). §5.8's "Plot Table at 12,000" is superseded by the derived 80,000. P3 unlocks +25% scrubber throughput; P7 unlocks +50% hulk Salvage — if §5 has no scrubber or hulk module, those two unlocks need rehoming |
| **§7 sites and launch** | P2 → insertion tolerance readout; **P5 → the assist route to the outer sites**; **P6 → launch-window readout and its Fuel discount**; P8 → free-return survey probe. §7 must define all four as *taxes when absent*, never as gates |
| **§6 UI teardown** | New feature id `artifacts` in Act VII `unlocks` plus a matching `PANELS` key. P4 adds a forecast readout to §6's colony panel |
| **§9 contracts** | Rule 5 Draft (§9.5, contract 11) calls `solvedUnaided(state)`, **not** `state.expedition.puzzles[id]` — the same layer ruling R5 applied to Fuel. Do not pay a puzzle unlock as a contract reward; the two systems must not both hand out the assist route |
| **§10 narrative** | Two ending strings, `APTITUDE CONFIRMED` and `PERSISTENT`, selected by `aptitudeSummary()`. The `act-7-first-puzzle` feed trigger calls `solvedUnaided(state)` |
| **§11 phasing** | Puzzles ship with their phase, not as one story: P1/P2 with `aftermath`, the instrument shop with `lifeSupport`. The `findNextEventClock` contributor-list refactor is a Phase 0 prerequisite (R5) |

**Files touched.**
*New:* `src/data/actSevenPuzzlesConfig.js` (nine puzzles, prompts, translated prompts, accept lists,
`near`/`wrongKind` overrides, hint text, `HINT_TIER_SECONDS`, the baked hint price table with the §8.4
derivation recorded as a comment, `FEEDBACK_LINES`, `PUZZLE_ITEMS` with `ITEM_MINUTES`),
`src/engine/puzzles.js`, `src/state/actions/puzzleActions.js`,
`src/components/expedition/ArtifactPanel.js`, `ArtifactCard.js`, `HintLadder.js`,
`InstrumentShop.js`.
*Modified:* `src/state/actionTypes.js` (`SUBMIT_PUZZLE_ANSWER`, `BUY_PUZZLE_HINT`, `BUY_PUZZLE_ITEM`,
`SIMULATE_PUZZLE_ANSWER`), `src/state/gameReducer.js`, `src/data/acts.js` (Act VII
`unlocks: ['artifacts', …]`), `src/engine/tickEngine.js` (one `nextPuzzleCooldownClock` registration
on the Phase 0 contributor list — **not** an edit to `findNextEventClock`'s body),
`src/components/layout/AppShell.js` (`PANELS` entry), `src/global.css` (artifact-panel section marker
— **not** at EOF, which is inside the mobile media query).

---

## 9. Side quests — fuel contracts

> *"Assignment issued. Terms below. Completion is credited against your transit requisition.
> Non-completion is not a mark against you; it is a scheduling matter."*

### 9.1 Why contracts exist at all

Act VII's four graded phases each end on a **lump**: a launch threshold that has to be filled
before the door opens (§7). Filling a lump is the single most inert thing an incremental game can
ask for. The player builds the colony out over the first third of a phase, reaches the net rate
the phase was designed around, and then — for the remaining two thirds — **watches a bar fill**.
Acts I–VI never had this problem because a season is a stream of events; a threshold is not.

Contracts exist to put something on the other side of that stretch. Three arguments, in the order
they matter:

1. **They give the engaged player something to decide.** Every contract below asks for a *choice*
   the idle loop does not: spend a buffer you were keeping for safety, deliberately starve a
   subsystem and recover it, hold a rate you would otherwise let drift, send a crew somewhere that
   costs you upkeep the whole time it is gone. A side quest that says "accumulate 500 Oxygen" asks
   for nothing — it is the bar, renamed. None of the twelve below is that.
2. **They are a per-player pacing lever, which no other mechanism in this game has.** Act
   durations are tuned by `rules` and modifiers, which move the phase for *everyone*. A contract
   moves the phase only for the player who runs it. This is the first time the repo can shorten a
   phase for an engaged player without shortening it for the one who checks in twice a day, and
   that asymmetry is exactly what an open-ended act needs.
3. **They are the act's second Fuel source, and therefore its anti-flat-point.** §7's flat point in
   every phase is "colony built, rate maxed, threshold not met." The contract board is the unlock
   scheduled to relieve it, and its offer cadence (9.4) is tuned to arrive at that moment.

**What contracts are explicitly NOT:** a Salvage sink (that is the hint ladder, Decision 3.6), a
combat/failure system (pillar 3), or a required path (§7's thresholds are sized against the *idle*
rate, never against the contracted rate — see 9.6).

### 9.2 Payout sizing, and the two numbers that must not be conflated

Two different quantities get called "how much a contract is worth," and the orchestrator should
hold them apart because they reconcile against different sections.

**Fuel skipped.** Every contract's payout is declared as a **percentage of its own phase's launch
threshold**, in a fixed three-rung ladder: **5% / 7.5% / 11%**. Three contracts per Fuel-paying
phase, so a player who runs every one of them skips **23.5% of that phase's threshold**. The
ladder is the authored thing; the absolutes below are a *rendering* of it against thresholds this
section assumed and §7 owns.

| Phase | Assumed launch threshold (§7 owns this) | 5% rung | 7.5% rung | 11% rung | Phase total |
|---|---|---|---|---|---|
| `aftermath` | — (no tank yet; `fuel.capacity` is 0) | — | — | — | pays **Salvage** |
| `lifeSupport` | 1,200 Fuel | 60 | 90 | 130 | 280 (23.3%) |
| `lunar` | 4,000 Fuel | 200 | 300 | 440 | 940 (23.5%) |
| `deepSpace` | 12,000 Fuel | 600 | 900 | 1,300 | 2,800 (23.3%) |
| `majors` | rolling, §7's endless ladder | 8% of current | — | — | one at a time |

**Dependency on §7 — read this before reconciling.** If §7 lands different thresholds, *the
percentages survive and the absolutes are regenerated*. `data/actSevenContractsConfig.js` should
declare `payoutPct` and let `engine/contracts.js` resolve it against the phase's threshold, so the
two files can never drift. The one number §7 must not break is the shape: **three contracts per
phase at 5 / 7.5 / 11**.

**Wall-clock shortened.** This is the smaller number and the honest one. At the anchor rate
(~2 Fuel/sec at the end of `lifeSupport`), a 1,200-Fuel threshold is ~10 minutes of accrual inside
a 45–60 minute phase. Phase duration in Act VII is dominated by **colony build-out and puzzle
work**, not by Fuel accrual — Fuel is the gate at the end, not the body of the phase. So skipping
23.5% of the threshold is only worth roughly 2–3 minutes of the phase's clock directly. The rest
of the contract runner's advantage is indirect: the Salvage riders buy modules earlier, which
raises the rate for the whole remaining phase.

**Target, and what to simulate:** a fully-engaged contract runner finishes a phase in
**0.85–0.92× the baseline wall clock**, and **never below 0.80×**. The simulation is two headless
runs of `advance()` per phase with an injected deterministic `rng` — one ignoring the board
entirely, one claiming every contract at the earliest legal moment — recording the clock at which
each phase's exit predicate first goes true. If the contracted run comes in under 0.80×, the
5/7.5/11 ladder drops to 4/6/9 before any individual contract is retuned; the ladder is the knob.

### 9.3 State shape

A strict superset of the §4 sketch — same field names, same array, one new sibling for board
bookkeeping:

```js
state.expedition.contracts = [
  {
    id: 'bus-trip',          // config id; also the instance id — see uniqueness note below
    status: 'offered',       // offered | active | claimable | done  (expired instances are removed)
    progress: 0,             // seconds held, for sustain kinds. 0 for every other kind.
    expiresAtClock: 4820,    // OFFER deadline only. null once accepted, and null on untimed offers.
    windowEndsAtClock: null, // set at accept on window/expedition kinds
    acceptedAtClock: null,
    payoutFuel: 130,         // RESOLVED at offer time from payoutPct × the phase threshold
    payoutSalvage: 0,
    roll: null,              // rng draw, stored at accept, for the one contract that has one
  },
];

state.expedition.contractBoard = {
  nextOfferAtClock: 0,
  completedIds: [],          // ledger — pays once, ever
  missedIds: [],             // expired offers, eligible to return as Makeup Games
};
```

`contractBoard` is supplied by the expedition slice's defaulting accessor when absent, in the
`concessionsSlice()` shape (`engine/concessions.js:43` — and read its LOAD-BEARING comment: an
accessor that forgets a key is an accessor that deletes it on every write). A save with no
`expedition` at all reads as an empty board and no contracts, which is exactly correct for a
player still in Act IV.

Only two things are stored that could have been derived: `progress` (a seconds accumulator that
genuinely cannot be recovered from a snapshot) and `roll`. Everything else — a delivery's
satisfiability, a state objective's truth, affordability of anything — is recomputed on every
`listOffers()`. Same rule as `concessionsPerSecond()`: derive the rate, never cache it.

### 9.4 The board

**Three slots. Two acceptances. No expiry on anything you have accepted.**

- The board shows **3 offers** at a time, drawn from the current phase's pool plus any Makeup
  Games. Offers the player is not interested in sit there; the board only churns when a slot
  empties or a rotation fires.
- **At most 2 contracts may be `active` at once.** This is the real ceiling on contract income
  and it is why 9.2's arithmetic holds: the per-phase pool is three authored contracts, not an
  infinite rotation, so the maximum Fuel obtainable in a phase is an *authored constant*, not an
  emergent one. (This is the same reasoning as `data/concessionsConfig.js` sizing its stand
  upgrades so "every upgrade owned at once" is a stated number.)
- **Rotation.** `contractBoard.nextOfferAtClock` fires a refresh every `OFFER_ROTATION_SECONDS`
  (start at 300 — measure it; the intent is that the third offer of a phase arrives around the
  moment the colony finishes building out, which is the flat point named in §7). A refresh fills
  empty slots; it never removes an offer the player has not seen churn off.
- **Which offers appear is derived from a state seed, not from `rng`.** `engine/bookie.js:290`
  (`propOfferSeed` + mulberry32) is the template: seed from `(phase, floor(clock / rotation))` so
  the board is identical across a reload and identical for a headless simulation, without storing
  the draw. `rng` stays a defaulted parameter and is used for exactly one thing (the PTBNL roll,
  9.5 #9), consistent with `engine/wallBall.js` and `engine/bookie.js`.

**Expiry, and why it cannot hurt.** Only an **unaccepted offer** carries `expiresAtClock`, and
only three of the twelve contracts have one at all. When an offer expires it is removed from
`contracts` and its id is pushed into `contractBoard.missedIds`, which makes it eligible to be
re-offered as a **Makeup Game** — same payout, deadline doubled, offered preferentially when the
board would otherwise repeat itself. Nothing is debited, nothing is lost, and the phase's total
available Fuel is unchanged by having missed something. That is pillar 3 stated as a mechanism
rather than as a promise, and it is why the Office's copy calls a lapse "a scheduling matter."

An **accepted** contract never expires. It has no deadline to miss; it has a window it is inside,
and the window advances with the clock whether or not the player is watching.

**The 8-hour offline case, concretely.** `nextContractEventClock(state)` joins
`findNextEventClock()` (`tickEngine.js:117`) alongside `nextColonyThresholdClock` from Decision
3.3, returning the minimum of: every active instance's `windowEndsAtClock`, every unaccepted
offer's `expiresAtClock`, and `contractBoard.nextOfferAtClock`. `advance()` therefore steps
*exactly to* each contract boundary and resolves it there. Three consequences worth stating:

1. **Sustain progress is a closed-form add, not a sampling.** Decision 3.3 guarantees rates are
   linear in time within a step, so if a sustain condition holds at the start of a step and no
   boundary is crossed inside it, it held for the whole step: `progress += step`. If it does not
   hold at step start, `progress = 0`. No integration, no sampling error, no dependence on
   `deltaSeconds`. An 8-hour return costs a handful of iterations, exactly as the income
   integration does.
2. **Contracts complete offline, and that is the genre's promise, not a leak.** A player who
   accepts *Innings Limit* and closes the tab satisfies it. The bound on this is not vigilance,
   it is the authored per-phase ceiling (9.2) and the two-slot limit.
3. **Nothing pays out during catch-up.** Completion sets `status: 'claimable'`; the Fuel moves
   only when the player presses the button. See 9.6 on why.

### 9.5 The twelve contracts

Kinds: `state` (reach a condition), `sustain` (hold a rate for a duration), `delivery` (hand over a
lump of stock), `window` (survive a timed window under a constraint), `expedition` (runs, costs
upkeep while it runs). Prose is the Office's, in the register §10.1 fixes. All strings are real
`data/actSevenContractsConfig.js` content.

**`aftermath` — pays Salvage, because the Fuel tank does not exist yet.** This is the phase's one
genuinely distinctive economic fact and it is worth leaning on: the board opens before the thing
it is nominally for, so the first two contracts read as onboarding paperwork.

| # | id / name | Kind | Objective | Pays |
|---|---|---|---|---|
| 1 | `spring-invitation` — **Spring Invitation** | state | Have any three modules online simultaneously | 90 Salvage |
| 2 | `backfield-work` — **Backfield Work** | sustain | Hold a positive net Power rate for 180 consecutive seconds | 140 Salvage |

> **Spring Invitation.** "You are invited to camp. Camp is the surface you are standing on. Bring
> three systems up and hold them up; the Office will consider that an arrival."
>
> **Backfield Work.** "Nobody watches the backfields. That is what they are for. Keep your power
> positive for three minutes and file the result. Nobody will comment on it. It will be read."

**`lifeSupport` — threshold 1,200 Fuel.**

| # | id / name | Kind | Objective | Pays |
|---|---|---|---|---|
| 3 | `bus-trip` — **Bus Trip** | delivery | Hand over 150 Provisions in one transfer | 60 Fuel (5%) |
| 4 | `innings-limit` — **Innings Limit** | window | 600 s with no manual click | 90 Fuel (7.5%) |
| 5 | `rehab-assignment` — **Rehab Assignment** | window | Take Oxygen below 20% of capacity, then back to ≥90%, within 300 s | 130 Fuel (11%) |

> **Bus Trip.** "Provisions are wanted at a site you have not been told about. Load 150 units.
> They will not be returned and you will not be told what they were for."
>
> **Innings Limit.** "You are on a limit. For ten minutes, do not reach for it. Everything you have
> built will keep running without your hand on it — that was the entire point of building it. If
> you reach for it anyway the assignment is void and will be reissued. There is no other penalty."
>
> **Rehab Assignment.** "Take the scrubber off the field. Run it down past twenty percent, service
> it, and have it back above ninety inside five minutes. A system nobody has ever seen fail is a
> system nobody has ever seen recover, and we do not promote those."

*Bus Trip* is the section's cleanest tradeoff: 150 Provisions is a real bite out of the buffer that
keeps §5's satisfaction factor at 1.0, so the 60 Fuel costs a measurable dip in every other rate.
*Innings Limit* asks the player to abstain from the click. Reviewed against `engine/clicker.js`'s
anti-softlock guarantee and compatible with it: the click is never *gated*, the player merely
declines it, and voiding costs nothing but a reissue. Detection is a stored
`clickCountAtAccept = state.clicker.totalClicks` compared at the window boundary — derived from a
counter that already exists (`initialState.js:28`), so no new bookkeeping and no reducer hook.

**`lunar` — threshold 4,000 Fuel.**

| # | id / name | Kind | Objective | Pays |
|---|---|---|---|---|
| 6 | `doubleheader` — **Doubleheader** | sustain | Hold net Fuel ≥ 1.5/sec across two separate 240 s windows with a 120 s gap between | 200 Fuel (5%) |
| 7 | `rain-delay` — **Rain Delay** | window | 300 s during which the contract suppresses Power production by 40%; keep Oxygen above 50% throughout | 300 Fuel (7.5%) |
| 8 | `waiver-claim` — **Waiver Claim** | expedition | Dispatch a crew for 600 s; draws 3 Power/sec and 1 Provision/sec the whole time | 440 Fuel (11%) + 200 Salvage |

> **Doubleheader.** "Two games, one day, one crew. Hold one and a half units of fuel per second for
> four minutes. Stand down for two. Hold it again. We are not measuring your ceiling. We are
> measuring whether your ceiling is there the second time."
>
> **Rain Delay.** "The Office is going to take forty percent of your power away for five minutes.
> This is not a malfunction and you will not be told why. Keep the air above half. Every affiliate
> runs this drill. Most of them run it once."
>
> **Waiver Claim.** "Something was left in your vicinity by an organization that no longer files.
> It is yours if you go and get it. Your crew will be off the board for ten minutes and will draw
> power and provisions the entire time. Recall them whenever you like; a recalled claim is simply
> not a claim."

*Rain Delay* is the only contract where the hardship is imposed by the contract rather than chosen
by the player, and it stays inside pillar 3 because it is opt-in, abandonable at any instant, and
implemented as a **throttle on a rate** — Decision 3.3 clamps at zero and starves rather than
destroys, so the worst case is a colony that produces nothing for five minutes.

**Dependency on §5:** *Waiver Claim*'s and *Rain Delay*'s upkeep must be summed into the consumer
side of §5's net-rate computation. `engine/contracts.js` exports `contractUpkeepPerSecond(state)`
returning a `{ power, oxygen, provisions }` bundle; §5's rate assembly adds it exactly as
`income.js` adds a contributor. It must be included **before** `nextColonyThresholdClock` solves
for the boundary, or an expedition will push a resource through zero inside a step.

**`deepSpace` — threshold 12,000 Fuel.**

| # | id / name | Kind | Objective | Pays |
|---|---|---|---|---|
| 9 | `ptbnl` — **Player To Be Named Later** | delivery | Hand over 300 Salvage | 450–900 Fuel, drawn at accept (nominal 600, 5%) |
| 10 | `pitch-count` — **Pitch Count** | state | Complete any launch having overfilled the threshold by less than 5% | 900 Fuel (7.5%) |
| 11 | `rule-five` — **Rule 5 Draft** | state | Solve any one unsolved artifact without buying a hint | 1,300 Fuel (11%) |

> **Player To Be Named Later.** "Three hundred salvage now. Consideration to follow. The
> consideration has been decided; it has not been written down where you can read it. This is a
> normal instrument and it is executed several thousand times a season."
>
> **Pitch Count.** "Anyone can get there with a full tank. Get there with the tank nearly empty.
> Leave with less than five percent over the requirement and the Office will note that you know
> what the requirement was."
>
> **Rule 5 Draft.** "There is an instrument in your possession that you have not understood and
> have not paid to have explained. Understand it. Unassisted. If you would rather buy the
> explanation, buy it — this assignment will simply not be credited, and nothing else changes."

*PTBNL* is the module's one use of `rng`: `accept(state, id, rng = Math.random)` draws
`roll` once and writes it onto the instance, so the payout cannot be re-rolled by reloading and a
headless run with an injected generator is deterministic. The band is displayed on the board; the
draw is not revealed until claim.

**Dependency on §7:** *Pitch Count* needs a launch to report its overfill margin — either a field
on the `launches[]` log entry or a predicate §7 exports. **Dependency on §8:** *Rule 5 Draft* needs
"solved with `hintsBought === 0`", which `state.expedition.puzzles[id]` already carries per §4.
Note the interaction with Decision 3.6: this contract is *optional by construction*, so a player
who never solves a puzzle forgoes 11% of one phase's threshold — which the baseline duration
already assumes, because the baseline assumes zero contracts.

**`majors` — endless.**

| # | id / name | Kind | Objective | Pays |
|---|---|---|---|---|
| 12 | `organizational-depth` — **Organizational Depth** | rotating | One of the shapes above, re-seeded per offer | 8% of the current threshold |

> **Organizational Depth.** "The Office has no further assignments specific to you. It has a great
> many assignments. You will be given one at a time, indefinitely, for as long as you keep filing.
> Several of your colleagues have been doing this for a hundred and forty years and consider it a
> career."

Plus the wrapper, which is not an authored objective:

> **Makeup Game.** "Rescheduled: *{original name}*. Same terms. Longer window. Weather is not
> counted against anybody."

### 9.6 Engine spec — `engine/contracts.js`

Pure. No React, no DOM, no `Date.now()`, no bare `Math.random()`. Every number from
`data/actSevenContractsConfig.js`. Shop contract throughout: presentation-ready rows out,
`null` for refused.

```js
contractsSlice(state)                      // defaulting accessor: { contracts, contractBoard }
listOffers(state)                          // presentation-ready rows — see below
accept(state, id, rng = Math.random)       // new state or null
claim(state, id)                           // new state or null
abandon(state, id)                         // new state or null; never penalised
refreshBoard(state)                        // seeded from state; called by advance() at nextOfferAtClock
advanceContracts(state, step, rates)       // progress/window/expiry resolution for one step
contractUpkeepPerSecond(state)             // { power, oxygen, provisions } — §5 sums this
nextContractEventClock(state)              // joins findNextEventClock()
```

A `listOffers()` row, fully resolved so the panel recomputes nothing:

```js
{
  id, name, brief, terms, kind, phase, status,
  effect: '+130 Fuel',                     // authored by describe(), like concessions.js:131
  progress: { value: 84, target: 180, pct: 0.47, label: '1:24 of 3:00 held' },
  expiresInSeconds: 240 | null,
  acceptable: true, claimable: false,
  refusal: 'tank' | 'slots' | 'stock' | null,
}
```

**`claim()` refuses when the payout would overflow the tank, and this is load-bearing.** Decision
3.3 clamps every resource to `[0, capacity]`. A 1,300-Fuel payout into a tank with 200 units of
headroom would silently destroy 1,100 Fuel — the single worst bug this section can ship. So:
`claim()` returns `null` when `payoutFuel > fuel.capacity - fuel.amount`, and `listOffers()`
reports `claimable: false, refusal: 'tank'` with a line telling the player why. **Nothing is
lost**: the contract stays claimable forever, and it becomes claimable the moment the player
launches (emptying the tank) or buys a tank module. This is non-punitive, it is the house
`null`-means-refused idiom, and it deliberately creates a legible interaction with §5's tank
modules and §7's launch — *"you cannot bank a payout you have nowhere to put"* is a real decision
in a game whose whole economy is a threshold.

**Dependency on §5 and §7:** the tank capacity ladder must be sized so that at each phase the
11% payout fits in a *reasonably* upgraded tank. If §5's first tank holds 400 and `deepSpace`'s
11% rung is 1,300, the contract is unclaimable for most of the phase. Rule to reconcile against:
**`fuel.capacity` at the start of a phase must be at least 1.5× that phase's threshold**, which
makes every rung claimable at any time and reduces the overflow refusal to a rare, instructive
edge case rather than a constant nuisance.

Other refusals: `'slots'` (two already active), `'stock'` (a delivery whose stock is short — the
delivery's debit and the payout's credit happen atomically inside `claim()`, so a delivery can
never take the goods and fail to pay), unknown id, already in `completedIds`.

**Payout-once is structural.** `claim()` moves the id into `contractBoard.completedIds` and removes
the instance in the same returned object. A replayed action finds no instance and returns `null`
by reference — the `sponsorBoard.announcedOfferIds` idiom (`sponsorships.js:92`), the same ledger
reasoning, for the same offline-catch-up reason.

**Why claiming is a player action and not an automatic credit.** An 8-hour catch-up can complete
both active contracts inside one `advance()` iteration. Auto-crediting there would (a) risk the
overflow above at the worst possible moment, (b) fire two toasts from inside the simulation, which
this repo does not do (`ToastHost.js` derives toasts from transitions precisely to avoid the storm),
and (c) rob the payout of the only moment it is worth anything dramatically. Returning to a board
with two claimable lumps on it is a better homecoming than returning to a full tank.

**Files touched (§9).** New: `src/data/actSevenContractsConfig.js`, `src/engine/contracts.js`,
`src/components/expedition/ContractBoard.js`, `src/state/actions/contractActions.js`. Modified:
`src/engine/tickEngine.js` (`findNextEventClock` gains `nextContractEventClock`; the loop calls
`advanceContracts` and `refreshBoard`), `src/state/actionTypes.js` (`ACCEPT_CONTRACT`,
`CLAIM_CONTRACT`, `ABANDON_CONTRACT`), `src/state/gameReducer.js`, `src/data/feedMessages.js`
(a `contract` category), `src/data/acts.js` (Act VII `unlocks: ['contracts']`),
`src/components/layout/AppShell.js` (`PANELS.contracts`), `src/styles/global.css`.

---

## 10. Narrative

### 10.1 Who is talking, and in what voice

**One register: institutional.** Everything the player reads in Act VII is a document — a notice, a
form, an assignment, a filed report, a dispatch relay. Nobody in this act speaks *to* the player
conversationally, and nothing is dramatised. The comedy and the dread both come from the same
place: a flat administrative voice handling something enormous as routine volume.

**The organisation.** The **Outer Circuit, Office of Player Development** — "the Office," "PD" on a
form. It is not an empire and it is not benevolent. It is a scouting and development bureaucracy
with a hundred and forty years of paperwork on this planet and a backlog.

**The one person.** **Ellis, Area Scout, Territory 9.** He filed the first report on the player.
He is the man in the windbreaker who watched the last travel-ball game from behind the backstop
and did not clap once — that sentence is already in the shipped game
(`data/storyBeats.js:62`), and Act VII does not invent it, it *cashes* it. This is the best
available proof of pillar 5: the reveal is paid for by the previous six acts.

**Ellis does not break the register, and that is why he works.** He never writes a letter. He files
reports, and the warmth leaks through the form fields — a remark in a box labelled *Additional
observations*, a note that a scout is not required to make. "First observed this player at nine
years of age, in a vacant lot behind a hardware store on Vine. Recommended continued monitoring.
No action requested at that time." Reads as a line item. Lands as forty years of somebody watching.

**Rules for anyone writing Act VII prose:**

- Passive voice for the Office, active for Ellis. That is the only tell, and it is enough.
- No exclamation marks. No second person imperative dressed as encouragement. No "congratulations."
- Numbers wherever a number is available. The Office quantifies things that should not be
  quantified: distances, decades, a career, a planet.
- Never explain the metaphor. The mapping table (§2) is the reader's to notice. The Office assumes
  the player already knows what a pitch is; it has no idea the player thinks it is a sport.
- Nothing is generically sci-fi. If a line could appear in any space game, rewrite it as paperwork.

### 10.2 Pacing the reveal

The rug-pull fails if it arrives as a wall of exposition at the act boundary. It is paced across
the whole of `aftermath`, in four movements, and the player is *ahead* of the text the entire time:

1. **The teardown** (§6 owns the sequence; this section owns its strings). No explanation. Signal
   loss, a form header, a designation the player does not recognise, and one button.
2. **The intake** (first 5 minutes). The Office processes the player as an arrival. It refers
   repeatedly to things it assumes are shared knowledge — a *transit requisition*, an *affiliate*,
   a *class* — and never defines any of them.
3. **The mapping** (5–20 minutes). Delivered as *corrections to the player's terminology*, one at a
   time, in feed lines. The player types the baseball word; the Office substitutes the operational
   one. This is the whole reveal and it never once says "baseball was actually spaceflight."
4. **Ellis** (end of `aftermath`). One card. The oldest file in the territory. This is where the
   player understands how long this has been going on, and it lands only because movements 2 and 3
   refused to.

The rest of the act does not re-explain. Later beats are consequences, not exposition.

### 10.3 Story beats

**Shape.** Existing `data/storyBeats.js` objects — `{ id, kind, actIndex, title, prose: [], objective }`
— plus two optional fields: `trigger` and `mode`.

- `mode: 'card'` renders through `components/narrative/StoryCard.js` exactly as today.
  `mode: 'feed'` appends `prose[0]` to the event feed instead. Default `'card'`.
- **The Act VII intro beat keeps `kind: 'actIntro', actIndex: 6`**, so `getActIntroBeat()`
  (`storyBeats.js:78`) and `AppShell.js:80-81` need **zero change** to raise it. Reuse before
  invention. Its id is **`act-7-intro`** — §6 can reference that id without guessing.
- Trigger evaluation is logic and therefore does **not** live in `data/`. New pure
  `engine/narrative.js` exports `pendingStoryBeats(state)`, returning unseen beats whose trigger
  predicate is true, in authored order; the shell renders the first `card` beat, and `advance()`
  appends the `feed` ones.

**Idempotence.** A beat is recorded in `progression.storyBeatsSeen` on dismissal (cards, via the
existing `DISMISS_STORY_BEAT` in `narrativeActions.js:6`) or on append (feed beats, written in the
same returned object as the feed entry). Triggers are **level predicates, not edges** — "phase is
at least `lunar`", never "phase just became `lunar`" — so an 8-hour catch-up that crosses four
triggers inside one `advance()` iteration satisfies four predicates, none of which can fire twice
against the ledger. This is the `sponsorBoard.announcedOfferIds` argument (`sponsorships.js:88-94`)
applied to prose. Card beats then queue: the player dismisses them one at a time, oldest first.
With **six** card beats in the entire act, the worst possible queue is short and the arc is
preserved — which is worth more than the modal count is worth saving.

**One-line change required:** `StoryCard.js:21-24` renders the objective block unconditionally. Feed
beats have no objective and some card beats should not either, so it needs a
`{beat.objective && (...)}` guard.

| # | id | Mode | Trigger | Title |
|---|---|---|---|---|
| 1 | `act-7-teardown` | card | `milestones.callUpAccepted` | **Signal Acquired** (§6 owns the animation; the strings are here) |
| 2 | `act-7-intro` | card | act index 6 (`kind: 'actIntro'`) | **Affiliate 9** |
| 3 | `act-7-first-salvage` | feed | first Salvage credited | Intake, materials |
| 4 | `act-7-mapping-pitch` | feed | 3 modules online | Terminology |
| 5 | `act-7-mapping-catch` | feed | first module repaired | Terminology |
| 6 | `act-7-mapping-wall` | feed | `expedition.fuel.capacity > 0` | Terminology |
| 7 | `act-7-ellis` | card | phase ≥ `lifeSupport` | **Territory 9** |
| 8 | `act-7-life-support` | card | phase ≥ `lifeSupport` (ordered after #7) | **Class A** |
| 9 | `act-7-first-launch` | card | `launches.length ≥ 1` | **Departure Confirmed** |
| 10 | `act-7-first-colony` | feed | any site `colonized` | Register entry |
| 11 | `act-7-lunar` | feed | phase ≥ `lunar` | Reclassification |
| 12 | `act-7-first-puzzle` | feed | any puzzle solved with `hintsBought === 0` | Additional observations |
| 13 | `act-7-hint-bought` | feed | any hint purchased | Expense |
| 14 | `act-7-deep-space` | card | phase ≥ `deepSpace` | **Double-A** |
| 15 | `act-7-contract-first` | feed | first contract claimed | Credited |
| 16 | `act-7-dispatch-1` … `act-7-dispatch-7` | feed | authored clock offsets (10.4) | Relay 9 |
| 17 | `act-7-majors` | card | phase ≥ `majors` | **The Show** |

That is six card beats and sixteen feed beats (nine single beats plus the seven dispatches),
twenty-two authored pieces of prose in all.

**The nine single feed beats, in full.** Each is `prose: ['…']` — one line, appended to the feed by
`advance()` and recorded in `storyBeatsSeen` in the same returned object.

> **3. `act-7-first-salvage`** — "Materials received and graded. The Office notes that you have
> been picking useful things out of dirt with your hands since you were nine and that this is,
> against expectation, a scouted attribute."
>
> **4. `act-7-mapping-pitch`** — "Correction, for the file: the word you are using is *pitch*. The
> instrument is a burn. Thrust along a vector, committed to before the result is visible. You have
> thrown, by our count, forty-one thousand of them. Nobody has ever had to explain a burn to you
> and nobody is going to start now."
>
> **5. `act-7-mapping-catch`** — "Correction, for the file: *catch*. The instrument is a rendezvous
> — matching a body already on a ballistic arc, at the one moment the two of you occupy the same
> point. You were taught this at seven, with a glove, by an adult who believed he was passing an
> afternoon."
>
> **6. `act-7-mapping-wall`** — "Correction, for the file: *the wall*. The instrument is the
> heliopause. Your affiliate's coverage describes it as four hundred feet in centre. That is a
> scale model and it is the only one your species has ever been given. Nobody has hit one over it."
>
> **10. `act-7-first-colony`** — "Entered in the register. Your organisation now operates two
> affiliates. This is one more than it operated this morning and one fewer than the Office
> requires before it will assign you a class."
>
> **11. `act-7-lunar`** — "Reclassification: Class A. Reclassification carries no ceremony, no
> stipend and no change to your assignment. It changes the letterhead. You will find that it
> changes how the letterhead is read."
>
> **12. `act-7-first-puzzle`** — "Additional observations, Ellis, Territory 9: subject solved it
> cold. I want it in the record that nobody sold him the answer, because the Office will assume
> somebody did."
>
> **13. `act-7-hint-bought`** — "Explanation purchased, salvage debited. For the avoidance of
> doubt: buying the answer is a normal instrument, it is used constantly at every level of this
> organisation, and it is not recorded anywhere a promotion board can see it."
>
> **15. `act-7-contract-first`** — "Assignment credited against your transit requisition. You are
> now, formally, filing. Most players never file. Most players are also still on their affiliate."

**Prose for the six card beats.**

> **1. `act-7-teardown` — Signal Acquired**
> "CARRIER LOST — LOCAL BROADCAST — 00:00:04"
> "CARRIER ACQUIRED — OUTER CIRCUIT RELAY 9 — 00:00:00"
> "Good evening. This transmission has been waiting one hundred and forty-one years for a
> qualifying result. You produced one at 21:14 local. Do not adjust anything."
> *Objective:* Acknowledge.

> **2. `act-7-intro` — Affiliate 9**
> "INTAKE — OUTER CIRCUIT, OFFICE OF PLAYER DEVELOPMENT — AFFILIATE 9 (CLASS: ROOKIE)"
> "You are receiving this because a development program on your affiliate has returned a
> qualifying result. The program is the one you have been playing. It is not a sport. It was never
> registered as a sport. It was registered, in the year you would call 1885, as a control-system
> aptitude curriculum, and it was seeded on this affiliate because a species that is *taught* a
> control system forgets it and a species that is *made to play* one does not."
> "Everything you know how to do, you can still do. The Office wishes to be clear that nothing has
> been taken from you and nothing was faked. The pitch is a burn. The catch is a rendezvous. You
> are extremely good at both. You are simply, as of this evening, aware of it."
> "There is a crossing available. It is one way, it is confirmed, and it does not have a date on it
> because it does not need one. First you will have to build something that can leave."
> *Objective:* Bring the site back online.

> **7. `act-7-ellis` — Territory 9**
> "SCOUTING FILE 9-0001 — OPENED 40 YEARS AGO — AREA SCOUT: ELLIS, TERRITORY 9"
> "First observed this player at nine years of age, in a vacant lot behind a hardware store on
> Vine, sorting bottle caps by hand for approximately four hours. Recommended continued
> monitoring. No action requested at that time."
> "Observed subsequently: a chalk strike zone on a loading dock. A six-game season in a uniform
> that did not fit. Fifteen games a summer in a station wagon. I attended most of these. I was
> asked once, by the subject's mother, whether I was somebody's father. I said I was there for the
> pitching."
> "It is customary at this point to append a projection. Mine has not changed in thirty-one years,
> and the Office has queried it twice as unrealistic. I have declined to revise it both times."
> *Objective:* Reach the Moon.

> **8. `act-7-life-support` — Class A**
> "ASSIGNMENT — AFFILIATE 9 — LIFE SUPPORT, THEN TRANSIT"
> "Air, water, food, power. The Office is aware that your affiliate regards these as a
> humanitarian matter. They are logistics. Every one of them is a rate, every rate has a sign, and
> the only question the Office has ever asked of a site is whether the sign is positive when
> nobody is looking at it."
> "You have been doing this since you were eleven, with a snack table behind a chain-link fence.
> The quantities have changed. Nothing else about it has."
> *Objective:* Fill a transit requisition and leave the surface.

> **9. `act-7-first-launch` — Departure Confirmed**
> "TRANSIT — AFFILIATE 9 — VEHICLE 1 — DEPARTED"
> "Your requisition has been filled and your vehicle has left the surface. The Office notes, for
> the file, that this is the first object ever launched from this affiliate by a member of the
> program rather than by its host civilisation."
> "Four burns. In the order you were taught. You did not require the order to be explained."
> *Objective:* Colonise it.

> **14. `act-7-deep-space` — Double-A**
> "RECLASSIFICATION — AFFILIATE 9 — CLASS AA — WITH NOTES ON DISTANCE"
> "From here the Office must be candid about scale, because the next requisition will look like an
> error and it is not one. Everything you have done so far has been on the infield. You are now
> being asked to play the gap."
> "Your affiliate's coverage of the program includes a phrase the Office has always found
> unusually exact: *the warning track*. A strip of different ground, laid deliberately, so that a
> player running full speed at something he cannot see will feel it under his feet before he
> reaches it. We did not put that in the curriculum. Somebody down there worked it out."
> *Objective:* Reach the outer sites.

> **17. `act-7-majors` — The Show**
> "FILE 9-0001 — CLOSED — ELLIS, TERRITORY 9"
> "Subject has crossed. Territory 9 is now, by the Office's own definition, an affiliate that has
> produced. I am required to note that this occurs in roughly one territory in nine thousand and
> that I am therefore not a good scout, I am a lucky one, and I have never once believed that."
> "I am not going with you. Somebody has to stay and watch the lot."
> *Objective:* Everything after this is yours.

### 10.4 Feed lines

New `FEED_CATEGORIES` entries for `data/feedMessages.js`, matching the existing shape at
`feedMessages.js:13`:

```js
colony:   { label: 'Colony',    icon: '🛠️' },
transit:  { label: 'Transit',   icon: '🛰️' },
contract: { label: 'Assignment', icon: '📄' },
office:   { label: 'The Office', icon: '📡' },
dispatch: { label: 'Earth',     icon: '📻' },
```

Every line below is a `feedMessages` function in the existing style — a named function taking the
values the engine already has, returning one string. Never a string built in the engine.

**Routine colony operations.** `moduleOnline(name)` → "`${name}` brought online." ·
`moduleIdle(name)` → "`${name}` is drawing more than the site is making. It is waiting." ·
`siteColonized(name, klass)` → "`${name}` entered in the register as a `${klass}` affiliate." ·
`crewRotated(count)` → "`${count}` on the roster. No moves to report."

**Resource warnings** — flat, never alarmed, because nothing can be lost (Decision 3.3):
`resourceStarved(name)` → "`${name}` is at zero. Everything downstream of it has slowed to match.
Nothing has been damaged." · `resourceCapped(name)` → "`${name}` is at capacity and the overflow is
going nowhere. Build a tank or spend it." · `satisfactionThrottled(pct)` → "Site running at
`${pct}`% of rated output. This is a supply matter, not a fault."

**Launches.** `launchArmed(threshold)` → "Requisition filled: `${threshold}` units. The window is
open and it does not close." · `launchDeparted(vehicle, dest)` → "`${vehicle}` away, on four burns,
for `${dest}`." · `launchArrived(dest)` → "Rendezvous with `${dest}`. Insertion inside tolerance."

**Contracts.** `contractOffered(name)` → "Assignment posted: `${name}`." ·
`contractCompleted(name)` → "`${name}` — terms met. Awaiting your claim." ·
`contractClaimed(name, fuel)` → "`${name}` credited: `${fuel}` units against your requisition." ·
`contractLapsed(name)` → "`${name}` lapsed. It will be rescheduled. Weather is not counted against
anybody." · `contractMakeup(name)` → "Rescheduled: `${name}`. Longer window, same terms."

**The dispatches — the frozen league, carrying on.** This is the emotional payload of the act. The
league did not stop existing because the player left (Decision 3.5: `season`, `league`, `roster`
and `stadium` are all still in state, frozen exactly as the championship left them). These lines
report on it *from very far away*, at long intervals, with the light lag getting worse.

**Mechanically these are feed beats, not a separate system.** `act-7-dispatch-1` … `-7` are ordinary
`data/storyBeats.js` entries with `mode: 'feed'`, category `dispatch`, and a trigger that is a
clock offset from `progression.actEnteredAtClock` — so they fire through `pendingStoryBeats()`
against `progression.storyBeatsSeen` like every other beat, and this section introduces **no second
ledger**. Offsets: 35 / 80 / 130 / 180 / 230 / 280 minutes, plus one on `majors` entry. Measure and
retune; the intent is roughly one dispatch per phase-and-a-half, arriving between the things the
player is actually doing.

1. "Relay 9, delayed 14 minutes: your club has filled your position. The signing was described in
   local coverage as *sensible*."
2. "Relay 9, delayed 41 minutes: they finished third. The write-up mentions you in the eleventh
   paragraph, as a comparison."
3. "Relay 9, delayed 2 hours: they have renamed the grounds. Not after you. After a man who paid
   for the lights."
4. "Relay 9, delayed 6 hours: they won it. There is footage. Somebody in the crowd is wearing your
   number, and is too young to have seen you wear it."
5. "Relay 9, delayed 2 days: a record of yours went this season. It stood eleven years. The Office
   observes that eleven years is longer than most things."
6. "Relay 9, delayed 3 weeks: the league has expanded to sixteen clubs. The vacant lot behind the
   hardware store on Vine is a parking structure. The wall is still there. Somebody has redrawn
   the strike zone."
7. *(on entering `majors`)* "Relay 9, delayed 4 years, 61 days. They are still playing. Every
   evening, in the summer, in several thousand places at once, on a field laid out to the
   dimensions of a four-burn transfer, by people who have not been told and do not need to be.
   The Office has never seen a curriculum take like this one. Nothing is required of you."

**Storm safety.** Fired against `storyBeatsSeen`, at most once each, exactly as the sponsor
announcements are — and the argument is the one already written at `tickEngine.js:422-424`: there
are **seven** dispatches in an entire run and each can fire at most once ever, so the absolute
ceiling across a whole playthrough is seven entries against a `FEED_CAP` of 50. No storm is
possible, and no collapse rule is needed. **Emit all due dispatches during a catch-up, in order** —
collapsing to the newest would destroy the arc, which is the only reason these lines exist.

### 10.5 The naming convention

One rule per noun class. Every invented name in §5, §7, §8 and §9 should be checkable against
these in one read, and the point is that the alien program's vocabulary is *entirely* the
scouting-and-farm-system vocabulary the player already spent six acts inside.

**Sites are affiliates, named `<Class> — <Place>`.** The classification ladder *is* the site ladder,
and it is why §4's final phase is already called `majors`. Class is the Office's word; the place
name is whatever §7 wants.

| Phase | Class | Bank of place names |
|---|---|---|
| `aftermath` | Rookie | the Yard, Home Site, Affiliate 9 |
| `lifeSupport` | Rookie | the Backfields, the Cage, Vine Street Works |
| `lunar` | Class A | Tranquility Yard, the Short Field, Dorsey Station |
| `deepSpace` | Double-A / Triple-A | the Long Field, Warning Track, Foul Pole, the Gap, Deep Left |
| `majors` | The Show | the Heliopause, Over the Wall |

**Modules are ballpark furniture and staff roles.** Never "reactor," never "hydroponics bay." The
skeleton already fixes the anchor (§2.2, pillar 5: *a generator is a bullpen*). Bank: **Bullpen**
(power), **Tarp** (oxygen retention), **Grounds Crew** (provisions), **Water Tower** (tank),
**Clubhouse** (crew capacity), **Batting Cage** (repair/throughput), **On-Deck Circle** (queue /
pre-stage), **Dugout** (shelter/storage), **Rosin Bag**, **Pine Tar**, **The Rake**.

**Artifacts are things an umpire, a scorer or a coach carries.** Bank: **The Rulebook**, **Ground
Rules**, **The Signal Set**, **The Pitch Clock**, **Insertion Tolerance Card**, **The Scorecard**,
**The Lineup Card**, **The Indicator**, **The Foul Lines**, **The Infield Fly**.

**Contracts are organisational paperwork.** Every §9 name is drawn from this bank and it is deep
enough for the endless phase: Spring Invitation, Backfield Work, Bus Trip, Innings Limit, Rehab
Assignment, Doubleheader, Rain Delay, Waiver Claim, Player To Be Named Later, Pitch Count, Rule 5
Draft, Makeup Game, Organizational Depth — and unspent: Option Year, Bonus Clause, Roster Crunch,
Two-Way Deal, Callup Order, Sent Down, Designated for Assignment, Extended Spring, Instructional
League, The Forty-Man.

**The one prohibition.** No name in Act VII may be a word the sport does not already own. If a
proposed name would be at home in any other space game, it is wrong, and the bank above almost
certainly has a better one.

**Files touched (§10).** New: `src/engine/narrative.js`. Modified:
`src/data/storyBeats.js` (17 Act VII beats; `trigger` and `mode` fields),
`src/data/feedMessages.js` (5 new `FEED_CATEGORIES`, ~20 new message functions, the 7 dispatches),
`src/data/toastMessages.js` (an offline-return line for lapsed contracts and claimable payouts),
`src/components/narrative/StoryCard.js` (one-line objective guard, `StoryCard.js:21-24`),
`src/engine/tickEngine.js` (feed-beat emission and the dispatch ledger, beside
`announceSponsorOffers` at `tickEngine.js:425`), `src/state/initialState.js` (nothing new —
`storyBeatsSeen` at `initialState.js:82` already carries this).

---

## 11. Phasing

### 11.1 Phase 0 — Structural prerequisites (build first, in order)

These five stories contain **no Act VII content**. They are the load-bearing changes the act
cannot be built on top of, and every one of them is independently shippable and independently
verifiable against the game as it exists today. Landing them first means the content stories that
follow are additive and can be parallelized.

| # | Story | Why it must come first |
|---|---|---|
| 0.1 | **Extract `PRESTIGE_ACT_INDEX`** from `FINAL_ACT_INDEX`; point `resetForPrestige` at it; rewrite the now-stale `checkActTransition` comment | This is a *latent bug*, not a refactor. The moment `ACTS` has a seventh entry, prestige teleports the player into Act VII. Ship it before `ACTS` grows. Acceptance: prestige behaviour is byte-identical to today. |
| 0.2 | **`hides` in `getUnlockedFeatures`** (Decision 3.1) | The one new primitive the act needs from the progression engine. Lands with no act declaring `hides`, so it is a pure no-op until Act VII uses it — which is exactly what makes it safe to ship early. |
| 0.3 | **`salvage` currency + `expedition` slice with its defaulting accessor** (Decision 3.4) | Every content story reads this slice. Landing it alone proves the absent-slice defaulting against real saves before anything depends on it. |
| 0.4 | **Consumption path + `nextColonyThresholdClock` in `advance()`** (Decision 3.3) | The riskiest change in the whole act and the one with the least visible surface. It should land with zero modules defined — an empty colony produces nothing, consumes nothing, and `nextColonyThresholdClock` returns `Infinity`, so `advance()` behaves exactly as it does today. Then the offline-safety criteria (§12.4, §12.5) can be proven on a synthetic colony before any content exists. |
| 0.5 | **`seasonFrozen` rule** (Decision 3.5) | Small, and needed by the teardown story. Testable immediately by setting it on a scratch act and confirming the season stops while every slice survives. |

**0.1 and 0.4 are the two that must not be rushed.** 0.1 because it is silently destructive; 0.4
because a rate-integration bug is invisible until a player returns after eight hours and quietly
gets the wrong numbers — the worst failure mode an idle game has, because nobody reports it.

### 11.2 Content phases

Same principle the odyssey PRD used: **Phase 1 is a vertical slice** — complete, playable and
shippable on its own — because it proves the two things the whole act rests on (the teardown works,
and a colony ticks safely) before any of the content that assumes them exists.

| Phase | Contents | Outcome |
|---|---|---|
| **1 — The crossing** | The call-up offer and confirm (§6.1), `TeardownOverlay` (§6.2), Act VII's `unlocks`/`hides` (§6.3), the six-tab shell (§6.5), `HeaderStats` under `seasonFrozen` + `ResourceChips` (§6.6), the Salvage click (§5.2), the `ops` and `fab` tabs, tier-1 modules only, the `aftermath` phase, the Act VII intro beat (§10) | **Ship this before anything else.** A player wins the championship, accepts, watches the game tear itself apart, and plays a small clicker-plus-generators loop. That is a complete experience and it proves the act's premise. |
| **2 — Life support** | The full module ladder (§5.3), the satisfaction factor (§5.4), `colonyRates`/`integrateColony`, the Power↔Provisions interlock, storage, the first Fuel Bladder, generation powerups (§5.7), the `lifeSupport` phase | The economy proper. The act's first genuinely new decision — headroom before purchase. |
| **3 — The ladder** | `engine/sites.js` and `engine/launch.js` (§7.3, §7.7), On-Deck and First Base, pad tiers 1–3, overshoot, the `sites` and `launch` tabs, the `lunar` phase | The spine. Colonizing the Moon and launching from it — the user's core mechanic, end to end. |
| **4 — Depth** | `engine/puzzles.js` and all nine artifacts (§8), the instrument shop, the hint ladder, `engine/contracts.js` and the twelve contracts (§9), the `artifacts` and `contracts` tabs | The texture. Both systems are *additive* to a working act, which is why they come after the spine rather than inside it. |
| **5 — Over the wall** | Ceres and the Warning Track, pad tiers 4–5, the `deepSpace` phase, the win condition, the `majors` board (§7.8), standing orders, the Earth dispatches and the full feed (§10) | The ending, and the emotional payload — the league carrying on without you. |

**Phases 3 and 4 could swap, and 4 could be split.** Puzzles and contracts are independent of each
other and of the site ladder; either could ship first, or §8 could land in halves (the `aftermath`
and `lifeSupport` artifacts early, the rest late) if the act tests as thin in its opening hour.
Phases 1, 2 and 5 must be built in order — 2 depends on 1's shell, and 5 is the terminus of 3.

**The one sequencing trap.** §5's economy is Phase 2 and §7's costs are Phase 3, but R2 rules that
§7's costs are *derived from* §5's measured rates. So Phase 2's story must **publish its measured
Salvage bands as a comment in `data/actSevenModulesConfig.js`**, and Phase 3's story must recompute
its ladder against those measurements rather than against R2's table — which was itself computed
from §5's unsimulated estimates. R2 is a reconciliation, not a measurement, and the story that
treats it as one will inherit the error it was written to correct.

## 12. Success criteria

Written to be checkable, in the shape of the odyssey PRD's §9. Where a criterion needs a number,
the number is provisional per Decision 3.7 — but the *criterion* is not.

1. **A player who declines the call-up loses nothing.** Act VI plays exactly as it does today,
   prestige included, forever. Verifiable by diffing behaviour before and after the
   `PRESTIGE_ACT_INDEX` extraction: `resetForPrestige` must produce an identical state.
2. **No existing save breaks.** A v2 save at any act loads, defaults `expedition`, and plays on.
   Checkable by loading a saved fixture from each of Acts I–VI after the change.
3. **The teardown is idempotent.** A player who accepts the call-up, closes the tab for eight
   hours, and returns gets the Act VII shell and *one* teardown sequence — not a replay of it, and
   not a queue of every story beat whose trigger the catch-up crossed.
4. **A resource can never go negative and can never destroy anything.** Drive `advance()` under
   `node` with a deliberately over-committed colony (net-negative on all three consumables) across
   an 8-hour delta and assert: no resource below 0, no module removed, no site lost, no currency
   below 0, and the run recoverable by building one generator.
5. **An 8-hour offline return resolves in a bounded, measured number of iterations** and lands
   within a stated tolerance of the same 8 hours simulated at 1-second steps. Both numbers get
   recorded in a comment (Decision 3.3, and the `safetyCapIterations` note beneath it).
6. **A player who solves zero puzzles and buys zero hints still finishes the act**, and finishes it
   no more than **1.3×** slower than a player who solves everything (ledger R9). The multiplier must
   be *measured*, not asserted — at 1.5× the act breaches criterion 8's ceiling, so this is the one
   §8 number with no slack in it.
7. **Every phase has an identified flat point with a scheduled unlock landing within ~5 minutes
   of it.** The odyssey used ~3 minutes; Act VII's phases are two to three times longer, so the
   window scales with them. This is inherited pillar 2 and it is the criterion most likely to fail
   quietly in an act this long.
8. **The act runs 3.5–5 hours of active play**, and materially less in wall-clock terms for a
   player who idles between sessions — the offline cap is 8 hours and a colony that nets positive
   while away should make returning feel rewarded, not skipped.
9. **Nothing in Act VII reads as generic sci-fi.** Every site, module, artifact and contract name
   traces back to the scouting-and-farm-system vocabulary (§10 publishes the convention). This is
   pillar 5 and it is the difference between the reveal landing and the act feeling bolted on.
10. **The frozen league is visible.** A player who plays Act VII for an hour sees at least one
    feed line about the club they left. Decision 3.5 makes this possible; §10 makes it land.

## 13. Non-goals

Explicitly out of scope. Each of these is a thing a reasonable implementer might otherwise assume.

- **A save migration.** Decision 3.4 keeps `CURRENT_VERSION` where it is. Nobody writes a
  migration; the `expedition` slice defaults when absent, and that is the whole compatibility
  story. If some later change genuinely requires a version bump, it is that change's problem.
- **A second timer, an animation loop, or `requestAnimationFrame`.** `advance()` is the only
  simulation entry point and a 1-second tick is the only cadence. The teardown sequence is CSS.
- **Real-time or twitch input in the puzzles.** Every puzzle resolves against a pure
  `checkAnswer`. Nothing is timed at the input level; the only clocks are `...AtClock` cooldowns.
- **Any network call.** The game has no backend and acquires none here. Puzzle answers live in the
  bundle (§8 addresses why that is acceptable).
- **A new runtime dependency.** The dependency list is `react` and `react-dom`. It stays that way.
  No charting library, no animation library, no state library.
- **Rebalancing Acts I–VI.** Act VII is additive. The one deliberate exception is the
  `PRESTIGE_ACT_INDEX` extraction (Decision 3.2), which is a correctness fix, not a rebalance —
  and it must leave prestige behaving *identically* to today.
- **Removing prestige.** It is hidden in Act VII and fully alive for any player who declines the
  call-up. A player who wants to farm eras forever loses nothing.
- **Deleting the baseball simulation.** Decision 3.5. It freezes. `season`, `league`, `roster`,
  `stadium` and `powerups` all remain in state and remain valid.
- **Procedurally generated content.** Sites, puzzles, contracts and story beats are all authored,
  in `data/`. `data/eras.js` extrapolates past its authored five because prestige is unbounded;
  Act VII is a finite authored arc, like the odyssey itself, and clamps rather than synthesises.
- **Multiplayer, leaderboards, achievements, or export/import of saves.** None of these exist in
  the game today and none of them arrive with this act.

## 14. Open questions

1. **Is one act the right container?** Act VII is budgeted at 3.5–5 hours against an odyssey that
   reaches Act VI in 1.5–2. It is longer than the entire game preceding it. The five phases inside
   it are act-shaped — each has its own currency pressure, its own flat point, its own unlock. The
   argument for keeping it as one act is that the `hides` mechanism, the frozen season and the
   teardown all key off a single act boundary, and splitting it into Acts VII–XI would mean five
   entries in `ACTS` that differ only in `unlocks`. The argument against is that `progression.act`
   is the game's coarsest progress signal and this makes it useless for the back half of the game.
   **`expedition.phase` exists in §4 partly to hedge this** — if the split turns out to be right,
   the phases are already named and already separate.
2. **How much of the reveal survives being spoiled?** The teardown is a one-time surprise, and
   most players who reach it will have seen it discussed. Design the act so the *mechanics* carry
   it — a player who knows the twist should still find the first hour good — rather than betting
   the act on a moment that only works once.
3. **Does the frozen league want to be more than flavor?** Decision 3.5 keeps `season` intact and
   §10 reports on it in the feed. There is a version where the club you left is a live system you
   can still influence at a distance, and a version where touching it at all undoes the point of
   the act. Currently specified as read-only flavor; flag if playtesting says otherwise.
4. **Should declining the call-up be permanent?** Currently re-offerable (Decision 3.2). The
   alternative — a single refusable offer that never returns — is thematically stronger and
   player-hostile in a way this game has never been. Currently resolved in favor of the player.
5. **Per-site versus global resource pools.** Owned by §7, flagged here because it is the largest
   remaining cost fork in the act and it changes §5's integration math.
6. **Whether Act VII needs its own replay axis.** Prestige is retired at the boundary (Decision
   3.2, part 5). If Act VII's ending wants a loop, it must be designed rather than inherited.
