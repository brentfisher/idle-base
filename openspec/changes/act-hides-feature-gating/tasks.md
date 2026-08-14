## 1. Baseline

- [x] 1.1 Extract the base commit to a clean tree: `git archive fe545c8 | tar -x -C
      /tmp/story015-base`. Compare against that, not against the pre-edit working copy.
- [x] 1.2 Write `/tmp/story015-matrix.js` (not committed): takes a repo root, prints
      `getUnlockedFeatures(i)` as ordered JSON for `undefined, -1, 0, 1, 2, 3, 4, 5, 6`. `undefined`
      is a live call path (`RosterPanel.js:88`, `HeaderStats.js:61`); `-1` and `6` hit
      `getActConfig`'s coercion and clamp branches.
- [x] 1.3 Capture the base-tree output to `/tmp/story015-before.json`.

## 2. Add the key to config

- [x] 2.1 `src/data/acts.js` header: document `hides` beside the `unlocks` paragraph — optional,
      same id namespace (PANELS key ⇒ tab, otherwise a mechanic), omit for an act that retires
      nothing.
- [x] 2.2 Record the author-facing consequence of the precedence rule in the same paragraph:
      re-listing an id in a later `unlocks` will NOT bring it back; delete the `hides` entry.
- [x] 2.3 Add `hides` to **no act**. The `ACTS` array itself is untouched.

## 3. Subtract in the engine

- [x] 3.1 `getUnlockedFeatures()`: collect `(ACTS[i].hides || [])` into a `hidden` array inside the
      existing `unlocks` loop — same range, same `current.id` bound, no second traversal.
- [x] 3.2 Subtract after the loop with `features.filter(...)`, so surviving ids keep the order the
      union produced and an empty `hidden` returns the old array element for element.
- [x] 3.3 Extend the comment block above the function with the union-then-subtract rationale
      (design.md, Decision 2): why subtraction is not interleaved, that `hides` beats a later
      `unlocks` of the same id, that `unlocks` arrays are authored cumulatively so a re-listed id
      is more likely an edit collision than an intended restoration, and that `hides` is read only
      from acts `0..actIndex` so a late teardown is invisible early.
- [x] 3.4 Keep the Decision 5 paragraph and extend it to say why `hides` is config resolved on read
      rather than a persisted flag.

## 4. Verify the consumers need no change

- [x] 4.1 Read `AppShell.js:64-67` rather than trusting the story's claim — confirmed it falls back
      to `visibleTabs[0]` when the active tab stops being unlocked.
- [x] 4.2 Check the other three consumers (`HeaderStats.js:61`, `RosterPanel.js:88`,
      `tickEngine.js:419`) — all gate through `includes()`, which is the whole gate for a mechanic
      id and needs no change to honour a shrinking array.
- [x] 4.3 Record the two limits found, `visibleTabs[0] || 'field'` backstopping to `FieldView` and
      the pre-season branch rendering `LotPanel` unconditionally, in design.md Decision 4 as work
      the Act VII story inherits. **Do not edit any component in this change.**

## 5. Prove the no-op

- [x] 5.1 Run the matrix against the working tree and `diff` against `/tmp/story015-before.json` —
      empty, nothing excluded from the comparison.
- [x] 5.2 Positive assertion so an empty diff cannot be two identical crashes: Act VI resolves to 26
      ids, `lot` first through `prestige` last.

## 6. Prove the mechanism

- [x] 6.1 `/tmp/story015-mechanism.js` (not committed) mutates an existing `ACTS` entry in place.
      **Not** by appending a seventh act: `FINAL_ACT_INDEX` is captured at module load and
      `getActConfig()` clamps past it, so an appended act is clamped away and every assertion
      passes for the wrong reason. One `node` process per case, so no module-cache bleed.
- [x] 6.2 `sameAct` — an act naming an id in both arrays resolves to hidden; survivors keep order.
- [x] 6.3 `hidesBeforeUnlock` — **the discriminating case.** `ACTS[2].hides = ['camp']` while
      `ACTS[3].unlocks` contains `camp`: `getUnlockedFeatures(3)` and `(5)` must not contain it.
      Per-act subtraction would restore it here; this is the case that tests Decision 2 rather than
      just "hides removes something already in the union".
- [x] 6.4 `notRetroactive` — `ACTS[4].hides` is invisible at act 3 and effective from act 4 on.
- [x] 6.5 `unknownId` and `emptyArray` — both inert, no throw.
- [x] 6.6 `mechanicIds` — `retirement` and `walkup` (not PANELS keys) go through the identical path.
- [x] 6.7 Run the discriminating case against the base tree and confirm it FAILS there (`camp`
      present), proving the harness exercises the new code rather than agreeing with itself.

## 7. Build

- [x] 7.1 `npm run build` — clean. The three bundle-size warnings are pre-existing and unrelated.
