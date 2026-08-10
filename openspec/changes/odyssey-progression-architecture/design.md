# Design — Odyssey Progression Architecture

Source PRD: `docs/PRD-incremental-odyssey.md` (§3 is the normative section for this document).

This design exists because the change is cross-cutting: it touches the engine, state, and
component layers simultaneously, and is implemented by roughly nine parallel story branches.
Without these decisions recorded up front, each branch answers them independently and the
answers conflict.

## Context

Three properties of the existing code constrain everything here:

1. `engine/tickEngine.js: advance(state, deltaSeconds)` is the single simulation entry point.
   The live one-second tick and `engine/offlineProgress.js`'s catch-up both call it, differing
   only in `deltaSeconds`. Anything not folded into `advance()` silently fails to apply offline.
2. `src/engine/` is pure — no React or DOM imports — and `src/data/` is config with no logic.
   `data/eras.js` already implements the exact abstraction the act system needs.
3. `createInitialState()` eagerly constructs the entire game: roster, league, schedule,
   standings, trade windows.

## Decision 1 — Early income flows through a generalized income-source list

**Problem.** `advance()` cannot produce early-act income as written. Its revenue line is gated on
`season.phase !== 'offseason'` and calls `revenuePerSecond()`, which reads
`state.stadium.capacity` and `state.stadium.ticketPrice`; `attendanceFraction()` additionally
reads `state.season.schedule`. The first act has no stadium and no schedule.

**Decision.** Introduce `engine/income.js` exporting `totalIncomePerSecond(state, modifiers)`,
returning a per-currency bundle summed from every unlocked contributor:

| Contributor | Currency | Unlocked at | Notes |
|---|---|---|---|
| `collectors` | caps | Act I | count × rate per tier |
| `wallBallDues` | caps | Act II | small trickle |
| `concessions` | coins | Act III | proto-ticketing |
| `sponsorships` | coins | Act IV | flat rate |
| `ticketing` | cash | Act V | wraps existing `revenuePerSecond()` unchanged |

`advance()` calls `totalIncomePerSecond()` instead of `revenuePerSecond()`. The
`phase !== 'offseason'` gate **moves inside the `ticketing` contributor** — suspension is a
property of ticket sales, not of income in general.

**Alternative rejected:** branching by act inside `advance()`. It would need duplicating in
`offlineProgress.js`, and every new act would edit a conditional that every other act also
touches.

**Constraint — income must be rate-integrated, not event-driven.** `advance()` is bounded by
`balanceConfig.safetyCapIterations` (2,000) while `offlineCapSeconds` permits 8 hours (28,800s).
Modelling early income as a per-second event would force ~28,800 iterations, hit the cap, and
silently discard roughly seven hours of a returning player's income. `findNextEventClock()`
returning `Infinity` when no discrete event is pending is therefore *correct*: the loop takes one
large step and integrates rate × step in a single pass. Any future mechanic that introduces
frequent early events must revisit `safetyCapIterations` at the same time.

## Decision 2 — Locked content does not exist; tick-loop collections are present-and-empty

**Decision.** Act transitions are the initializer boundary. A fresh game constructs only what the
first act needs; entering Act III is what first calls `generateSeasonSchedule()`.

Applied bluntly this breaks `advance()`, whose loop body unconditionally dereferences state that
would be absent: `expirePowerups` reads `powerups.active`; `processCampCompletions` and
`updatePeakRating` read `roster`; `addRevenue` writes `prestige.runStats.totalRevenue`;
`findNextEventClock` and three branches read `season.phase`. So the rule splits:

- **Player-visible content is `null` until its act creates it:** `stadium`, `league`, `season`,
  `playoffs`.
- **Tick-loop collections are present-and-empty from t=0:** `roster: []`,
  `powerups: { active: [], purchasedPermanentIds: [] }`, `prestige.runStats` zeroed. Iterating an
  empty array is free and correct; guarding every call site is neither.
- `season: null` takes **one** guard at the top of the phase-handling block — not a check per
  line.

**Rationale for absence over hiding.** Hiding is cheaper initially, but leaves a professional
roster and a full league in state during the bottle-cap phase — semantically wrong, and it bloats
every save from the first second. Components need absent-value handling either way, so take the
honest data model.

**Consequence.** Each act's implementing story owns *creating* its content fields. Components
must treat pre-act content as absent, not as zero. A shared guard convention should be settled
in the first implementing story rather than solved differently in each.

## Decision 3 — Acts reuse the era config shape

**Decision.** `data/acts.js` mirrors `data/eras.js`:
`{ id, name, description, entry, exit, rules, modifierBonuses, unlocks }`, with
`getActConfig(actIndex)` extrapolation-safe like `getEraConfig`. Do not invent a parallel config
system — a 4-team, 6-game little league is already expressible through this mechanism.

**Rules resolution order:** `balanceConfig ← act.rules ← era.rules` (era highest).
**Modifier bonuses order:** `act ← era ← perks ← powerups`, extending the chain documented in
`engine/modifiers.js`.

The two axes do not collide in practice: Acts I–V run at era 0, whose `rules` is `{}`, and Act VI
declares `rules: {}` and defers to the era. Era-last precedence preserves today's behavior where
prestige eras reshape the endgame baseline.

**Required prerequisite — `resolveRules(state)`.** `era.rules` is **not** processed by
`computeModifiers()` today; only `era.modifierBonuses` is. `rules` is read ad-hoc by consumers,
and several `balanceConfig` values bypass overrides entirely. Two confirmed cases:

- `tickEngine.js:119` reads `balanceConfig.playoffTeams` directly, so an act declaring
  `playoffTeams: 0` would silently do nothing.
- `runOffseasonTransition()` routes `gamesPerSeason` through the era override but hardcodes
  `secondsPerGame: balanceConfig.secondsPerGame` twice — so per-act pacing would apply on entry
  and then **silently revert at the first offseason transition**.

A single `resolveRules(state)` helper in `engine/modifiers.js` must replace every ad-hoc read,
and every overridable direct `balanceConfig` read must be routed through it. It must distinguish
"not overridden" from "overridden to 0" — the existing `||` fallback idiom treats a legitimate
`0` as absent, and `playoffTeams: 0` is a real value. This is a prerequisite for the middle acts,
not cleanup.

## Decision 4 — Prestige resets to the final-act floor

**Problem.** `resetForPrestige()` rebuilds the roster, league and season and advances the era.
Under an act system it would otherwise return a prestiging player to the first act.

**Decision.** Prestige sets `progression.act` to the Act VI index and leaves all earlier unlock
flags permanently on. The odyssey is played exactly once per save; prestige remains an endgame
replay axis, as today.

Consequences:
- Legacy perks are not purchasable before the final act. `calculateLegacyPoints()` reads
  championships, peak rating and total revenue — all endgame-scale quantities.
- **Entering the final act zeroes `prestige.runStats`.** `addRevenue()` accumulates
  `totalRevenue`, which `calculateLegacyPoints()` divides by 100,000; without zeroing, the entire
  odyssey's earnings would inflate the first prestige payout exactly once, confusingly.

## Decision 5 — Unlocks are derived, not stored

`getUnlockedFeatures(actIndex)` returns the cumulative union of `unlocks` arrays for acts
`0..actIndex`, computed on read. Nothing about which features are unlocked is persisted.

This is self-healing: retuning which act unlocks a feature takes effect on existing saves with no
migration. Only *intra-act* triggers are stored, in `progression.milestones`, along with
presentation state (`seenTabs`, `storyBeatsSeen`).

## Decision 6 — The anti-softlock guarantee is mechanical

The game introduces mechanics that can lose the player currency. The guarantee that no sequence
of losses is unrecoverable is not a balance target but a structural property:

1. The manual click action exists in every act and is never removed or disabled.
2. Its income floor is above zero, so any state is recoverable in bounded time.
3. Every loss mechanic is capped as a *percentage of current holdings*, so absolute losses shrink
   toward zero and can never cross it.

**This is a hard project invariant** and should be recorded in the repo's conventions once
implemented: no mechanic may reduce a currency below zero, and no mechanic may remove the manual
income action.

## Save compatibility

`persistence/saveLoad.js` discards any save whose `meta.version !== CURRENT_VERSION` — there is
no migration path. This change bumps `CURRENT_VERSION` to `2`, a hard wipe of all
`idle-base-save-v1` saves.

**Accepted deliberately.** A migration fabricating a plausible progression state benefits only
saves that have, by definition, already seen all the content. Optionally show a one-time notice
when a v1 save is discarded.

## Risks

| Risk | Mitigation |
|---|---|
| `engine/tickEngine.js` is touched by most implementing stories | Sequence in dependency waves (tasks.md); do not fan out in parallel |
| The `resolveRules` audit misses a direct `balanceConfig` read | Audit is an explicit acceptance criterion; two known cases named as regression checks |
| Offline catch-up regressions ship silently | Offline parity is an explicit acceptance criterion on both the income and progression stories |
| No test framework exists in the repo | Verification is by running the app plus diff review; adding a framework is out of scope here but worth a separate change — `src/engine/` is pure and highly testable |
