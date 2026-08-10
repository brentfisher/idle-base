# Tasks — Odyssey Progression Architecture

> **Source of truth for implementation detail.** Each task below maps one-to-one to a `flow`
> story file at `~/flow/kb/idle-base/stories/STORY-NNN-*.md`, which carries the full acceptance
> criteria and the constraining conventions. Those stories are what `/kickoff` dispatches to
> agents. This list exists so the change's progress is trackable from inside the repo — keep the
> two in sync when either changes, and prefer editing the story file first.
>
> Ordering below is by dependency wave. `src/engine/tickEngine.js` and
> `src/state/initialState.js` are each touched by several tasks, so these are **not** safe to
> run fully in parallel.

## 1. Foundation (wave A — blocks everything)

- [ ] 1.1 Migrate `state.cash` to `state.wallet = { caps, coins, cash }` across state, actions,
      engine and components; bump `CURRENT_VERSION` to `2` in `persistence/saveLoad.js` and
      confirm a v1 save is discarded cleanly (STORY-001)

## 2. Rules resolution (wave B — branches from 1.1)

- [ ] 2.1 Add `resolveRules(state)` to `engine/modifiers.js` implementing
      `balanceConfig ← act.rules ← era.rules`, tolerating an absent `progression` slice
      (STORY-002)
- [ ] 2.2 Route the ad-hoc `era.rules` reads through it: `tickEngine.js:157`,
      `prestige.js:29-35` (STORY-002)
- [ ] 2.3 Audit `src/engine/` for direct `balanceConfig.*` reads and convert the overridable
      ones; `playoffTeams` and `secondsPerGame` are the known cases (STORY-002)
- [ ] 2.4 Verify an override survives an offseason transition, and that `0` is honored as an
      explicit value rather than treated as unset (STORY-002)

## 3. Income generalization (wave B — branches from 1.1)

- [ ] 3.1 Add `engine/income.js` with `totalIncomePerSecond(state, modifiers)` returning a
      per-currency bundle (STORY-003)
- [ ] 3.2 Switch `advance()` to it; move the offseason gate inside the `ticketing` contributor;
      wrap the existing `revenuePerSecond()` unchanged (STORY-003)
- [ ] 3.3 Scaffold the remaining contributors (`collectors`, `wallBallDues`, `concessions`,
      `sponsorships`) returning zero until their act lands (STORY-003)
- [ ] 3.4 Verify offline parity over a duration exceeding 2,000 seconds, confirming income is
      rate-integrated and not truncated by `safetyCapIterations` (STORY-003)

## 4. Progression framework (wave C)

- [ ] 4.1 Add `data/acts.js` for the six acts, mirroring the `data/eras.js` shape, with an
      extrapolation-safe `getActConfig` (STORY-004)
- [ ] 4.2 Add `engine/progression.js` with `getUnlockedFeatures` (derived, never stored),
      `checkActTransition`, and `enterAct` (STORY-004)
- [ ] 4.3 Restructure `initialState.js`: content (`stadium`, `league`, `season`, `playoffs`)
      null; collections (`roster`, `powerups`, `runStats`) present-and-empty (STORY-004)
- [ ] 4.4 Add the single `season == null` guard in `advance()` and confirm a fresh game ticks
      for minutes without a season, stadium or roster (STORY-004)
- [ ] 4.5 Call `checkActTransition` from `advance()` and verify transitions fire during offline
      catch-up (STORY-004)
- [ ] 4.6 Set prestige to reset to the Act VI floor; zero `runStats` on entering Act VI
      (STORY-004)

## 5. Feedback and reveal (wave D — parallel-safe with each other)

- [ ] 5.1 Filter the tab bar by unlocked features; add the NEW badge and `seenTabs`; render no
      locked tabs at all (STORY-005)
- [ ] 5.2 Add the capped `state.feed` ring buffer, written by the tick engine at each meaningful
      event, rendered newest-first; decide and document feed persistence (STORY-006)
- [ ] 5.3 Add the tick heartbeat, game clock, next-event countdown (exposing the value
      `findNextEventClock()` already computes), floating gains, and per-currency rates
      (STORY-007)

## 6. First acts (wave E–F)

- [ ] 6.1 Build Act I: click action, collectors, click upgrade, Starter Kit, exit predicate;
      plus the narrative layer (`data/storyBeats.js` and act-intro cards) (STORY-008)
- [ ] 6.2 Verify Act I pacing — first automation within ~25 clicks / ~45 seconds, act completes
      in ~3–5 minutes (STORY-008)
- [ ] 6.3 Build Act II: wall-ball subgame reusing `gameSim.js: winProbability()`, three
      approaches, crew recruitment via `createPlayer()`, Respect (STORY-009)
- [ ] 6.4 Implement and manually exercise the bounded-loss invariant: 25% stake cap, no balance
      below zero, Hustle always available (STORY-009)

## 7. Close-out

- [ ] 7.1 Record the anti-softlock invariant in the repo's conventions: no mechanic may reduce a
      currency below zero, and no mechanic may remove the manual income action (design.md
      Decision 6)
- [ ] 7.2 Re-run `/slice-prd` for PRD Phases 2–5 (Acts III–VI) once this change is applied, so
      the next slice reads these decisions rather than only the PRD
