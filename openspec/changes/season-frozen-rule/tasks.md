## 1. Declare the rule

- [x] 1.1 Add `seasonFrozen: false` to `src/data/balanceConfig.js`, beside the other
      season-shape rules, with a comment recording why it is declared as an explicit `false`
      rather than left absent (design.md Decision 1).
- [x] 1.2 Confirm `engine/modifiers.js` needs no change — `resolveRules()` layers arbitrary keys
      by spread, so the new rule resolves through `balanceConfig ← act.rules ← era.rules` and is
      attached to `modifiers.rules` with no edit.

## 2. Gate the tick loop

- [x] 2.1 Import `resolveRules` alongside the existing `computeModifiers` in
      `src/engine/tickEngine.js`.
- [x] 2.2 Gate the season candidates in `findNextEventClock()` on the resolved rule, keeping the
      exported one-argument signature so `components/layout/HeaderStats.js` needs no edit. Leave
      powerup-expiry and camp-completion candidates in the list.
- [x] 2.3 Comment 2.2 at length: record the step-size deadlock, that it is NOT redundant with the
      phase-block gate, and the measured `clockDelta: 60` vs `clockDelta: 4000` result.
- [x] 2.4 Extend the single `if (working.season)` guard in `advance()` to
      `if (working.season && !modifiers.rules.seasonFrozen)`, so fixture resolution, playoff
      rounds and the offseason transition are all skipped together.
- [x] 2.5 Comment 2.4 with why this is a suspension rather than a deletion (`advance()`
      dereferences `state.season`; `AppShell` early-returns on its absence) and what deliberately
      keeps running while frozen.

## 3. Gate the ticketing contributor

- [x] 3.1 Add the frozen check to `ticketingPerSecond()` in `src/engine/income.js`, beside the
      existing `phase !== 'offseason'` gate, reading `modifiers.rules.seasonFrozen`.
- [x] 3.2 Verify every caller of `totalIncomePerSecond()` passes a real `computeModifiers()`
      result, so `modifiers.rules` can be dereferenced unguarded as it already is in
      `tickEngine.js`. (Checked: `tickEngine.js`, `HeaderStats.js`, `RevenueTicker.js`.)
- [x] 3.3 Comment 3.1 with why the gate belongs inside the contributor rather than as an
      act-level branch in `advance()`, and cross-reference the two `tickEngine.js` gates so the
      next reader does not conclude one of them is redundant.

## 4. Verify

- [x] 4.1 Build a `node` harness outside the repo that patches `Math.random` and `Date.now`
      deterministically *before any require*, and constructs Act III and Act VI states with a
      stadium and a non-ticket income source.
- [x] 4.2 Assert coverage, not just equality: each unset scenario must resolve a non-zero number
      of fixtures, offseason rollovers and ticketing cash, and the Act VI scenario must actually
      form a playoff bracket.
- [x] 4.3 Unset case — run five scenarios (Act III chunked/single, Act VI chunked/single, offline
      catch-up) before and after the change and deep-compare each final state against its own
      before-state. Do not compare chunked against single; they legitimately differ.
- [x] 4.4 Set case — inject `rules: { seasonFrozen: true }` on a scratch act in the harness (not
      in `data/acts.js`) and assert: clock advances the full duration in both call patterns,
      non-ticket income accrues, ticketing rate is exactly 0, no fixture/playoff/rollover occurs,
      `season`/`league`/`stadium` byte-identical, `roster`/`powerups` structurally valid,
      `season` still truthy.
- [x] 4.5 Prove the `findNextEventClock` gate is load-bearing by removing only it and re-running
      the frozen scenario; record the numbers in design.md.
- [x] 4.6 Run `npm run build`.
- [x] 4.7 Confirm no save-version bump was needed — no persisted state shape changed.
