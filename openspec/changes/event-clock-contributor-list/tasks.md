## 1. Establish the baseline

- [x] 1.1 Extract the pre-change `tickEngine.js` from `git HEAD` to a temporary sibling module so
      the real prior `findNextEventClock` — not a hand-copied approximation — is the comparison
      baseline.
- [x] 1.2 Write the fixture sweep in `/tmp` (not in the repo — no test framework is being added).
      Build every fixture by overlaying onto `createInitialState()`; compare with `Object.is`.

## 2. Refactor

- [x] 2.1 Extract `nextGameAtClock(state)` — guard `!state.season || phase !== 'regular'`,
      preserving the original's phase check exactly.
- [x] 2.2 Extract `nextPlayoffRoundAtClock(state)` — guard `!state.season || phase !== 'playoffs'
      || !playoffs`.
- [x] 2.3 Extract `nextPowerupExpiryAtClock(state)` — default `powerups.active` to `[]`, keep the
      `expiresAtClock != null` test that excludes permanent powerups.
- [x] 2.4 Extract `nextCampCompletionAtClock(state)` — default `roster` to `[]`, keep the
      `if (p.campStatus)` test and push `completesAtClock` unguarded (Decision 4: `NaN`
      propagation is preserved, not repaired).
- [x] 2.5 Declare `const EVENT_CLOCK_CONTRIBUTORS = [...]` with the four registrations.
- [x] 2.6 Reduce `findNextEventClock(working)` to a `reduce(Math.min, Infinity)` over the list,
      leaving its name, signature and export untouched.
- [x] 2.7 Write the block comment above the list: why the seam exists, the four pending Act VII
      consumers by story id, and the `Infinity`-not-`0` contract stated in terms of the offline
      catch-up it protects.

## 3. Prove behaviour preservation

- [x] 3.1 Sweep all 25 fixtures against the baseline — no season, regular season, regular season
      with a stale `playoffs` object, playoffs, playoffs with `playoffs: null`, offseason, timed
      powerups, permanent (`null`-expiry) powerups, mixed, single/multiple camps, camps mixed with
      non-campers, and the two `NaN` cases. **25/25 identical.**
- [x] 3.2 Include one combination fixture per contributor in which that contributor is the strict
      minimum, plus an exact-tie fixture.
- [x] 3.3 Mutation-test the sweep: drop each registration in turn and confirm it fails.
      **5 / 2 / 4 / 7 divergences respectively — every contributor is individually detected.**
- [x] 3.4 Confirm AC #4: absent `powerups`, absent `roster`, and both absent all return `Infinity`
      where the baseline threw `TypeError`.
- [x] 3.5 Confirm the `Infinity` path is intact end-to-end: `advance(quietState, 28800)` carries
      the clock the full 28,800s rather than stopping short at `safetyCapIterations`.
- [x] 3.6 Delete the temporary baseline module; confirm `git status` shows `src/engine/tickEngine.js`
      as the only modified file under `src/`.
- [x] 3.7 `npm run build` — passes (pre-existing bundle-size warnings only).

## 4. Diff hygiene

- [x] 4.1 Confirm the change is one contiguous region inside the replaced function's footprint and
      touches nothing else in `tickEngine.js` — STORY-019 is editing this file concurrently from an
      older base. **75 insertions, 9 deletions, no hunk outside lines 117-133 of the original.**
- [x] 4.2 Confirm `module.exports` is unchanged and the contributors are not exported (no consumer).
- [x] 4.3 Confirm `meta.version` is untouched — saves are never migrated.
- [x] 4.5 Confirm the new module-scope `nextGameAtClock` function cannot be captured by object
      shorthand: every other occurrence in the file is `.nextGameAtClock` or an explicit
      `nextGameAtClock: <value>` (lines 249, 460), never `{ nextGameAtClock }`. The sweep is
      structurally blind to this, since no fixture drives `resolveGameSlot`/`runOffseasonTransition`.
- [x] 4.6 Verify the two constants quoted in the block comment against `data/balanceConfig.js`
      rather than against the odyssey design prose: `safetyCapIterations: 2000` and
      `offlineCapSeconds: 8 * 3600` (28,800s). Both current.
- [x] 4.4 Stage explicit paths rather than `git add -A`: `node_modules` is tracked in this repo.
