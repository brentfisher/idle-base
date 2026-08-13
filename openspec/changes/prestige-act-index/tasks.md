## 1. Baseline

- [x] 1.1 Build a deterministic `resetForPrestige()` harness in `/tmp` (not committed): fixture from
      `createInitialState()` with `progression.act = 5`, fixed `clock`, non-zero `runStats`; seeded
      `Math.random`; frozen `Date.now`.
- [x] 1.2 Run it twice on the unmodified tree and diff the two outputs against each other, to prove
      the harness is deterministic before trusting it as evidence.
- [x] 1.3 Capture the pre-change output to `/tmp/story014-before.json`.

## 2. Split the constant

- [x] 2.1 Add `PRESTIGE_ACT_INDEX = 5` to `src/data/acts.js` beside `FINAL_ACT_INDEX`, with the
      comment block recording why it is a literal, why it is not `ACTS.length - 1`, why it is not
      derived from `unlocks`, and why no assertion guards it.
- [x] 2.2 Export it from `src/data/acts.js`.

## 3. Point prestige at the floor

- [x] 3.1 `src/engine/prestige.js`: require `PRESTIGE_ACT_INDEX` from `../data/acts`; drop the
      `FINAL_ACT_INDEX` import from `./progression`.
- [x] 3.2 Change `resetForPrestige()`'s closing `enterAct(..., FINAL_ACT_INDEX)` to
      `enterAct(..., PRESTIGE_ACT_INDEX)`.
- [x] 3.3 Update the `resetForPrestige()` header comment: "final-act floor" → "prestige floor",
      plus why the two constants are not interchangeable here.

## 4. Move the runStats initializer with prestige, not with the arc

- [x] 4.1 Re-key `ACT_INITIALIZERS[FINAL_ACT_INDEX]` to `[PRESTIGE_ACT_INDEX]` and rename
      `zeroRunStatsForFinalAct` → `zeroRunStatsAtPrestigeFloor` (design.md, Decision 2).
- [x] 4.2 Extend its comment with the Decision 4 reasoning and the Act VII counterfactual.

## 5. Rewrite the checkActTransition comment

- [x] 5.1 Delete both halves of "Act VI declares no exit, so this can never run past the final act".
- [x] 5.2 State the surviving invariant: every advance is player-gated via `isExitSatisfied()`, and
      the terminal act returns false structurally because it declares `exit: null`.
- [x] 5.3 Separate `steps < FINAL_ACT_INDEX` (iteration cap) from the gate (what actually prevents
      overshoot), and warn that this loop must keep reading `FINAL_ACT_INDEX`.
- [x] 5.4 Keep the load-bearing first half about `findNextEventClock()` returning `Infinity` and an
      8-hour catch-up collapsing into one iteration — still true, and a recorded bug fix.

## 6. Verify

- [x] 6.1 Re-run the harness post-change and `diff` against `/tmp/story014-before.json` — must be
      empty, with nothing excluded from the comparison.
- [x] 6.2 Check the positive assertions (`act === 5`, `runStats` zeroed, roster/league/schedule
      sizes), so an empty diff cannot be two identical crashes.
- [x] 6.3 Exercise the counterfactual: with a synthetic seventh act pushed onto `ACTS`,
      `ACTS.length - 1` is 6 while `PRESTIGE_ACT_INDEX` stays 5.
- [x] 6.4 `npm run build` — errors only; the three bundle-size warnings are pre-existing.
