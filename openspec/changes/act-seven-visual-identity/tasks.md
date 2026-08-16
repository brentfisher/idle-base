# Tasks — the expedition palette and the Act VII CSS section

## 1. The tokens

- [x] `:root` block carrying all eleven §6.8 tokens, each with its role and computed ratio in a
      comment, in the shape `data/eras.js:1-17` uses.
- [x] Declared at `:root` rather than on `body.expedition` so the `html` ground rule can resolve the
      same token — custom properties inherit downward only (design Decision 2).
- [x] `body.expedition` applies `background` and `color` from them.
- [x] The whole section sits **above** the file's trailing `@media (max-width: 640px)` block, with a
      comment at its head saying that later panel stories add rules inside it and why.
- [x] Verified programmatically: last `body.expedition` rule at line 3000, mobile block at 3004.

## 2. The overrides

- [x] `.app-shell` / `.app-shell-preseason`, `.header-stats` (and `.title`), `.stat-chip` (and
      `.label`), `.panel` (and `h2`, `h3`), `.muted`, `.tab-nav button` (and `.active`, `.attention`).
- [x] The click surface: `.hustle-bar`, `.lot-click-button` (and `:hover`, `.cooling`),
      `.lot-click-label`, `.lot-click-fill` — the Salvage faucet, in scope per design Decision 7.
- [x] **The label-contrast fix**: `.era-chip .label` and `.resource-chip .label` restated at equal
      specificity so `color: inherit` survives. Measured 1.02/1.32/1.59:1 before, 6.86:1 worst after.

## 3. The switch

- [x] `AppShell` toggles `expedition` on `document.body` from an effect keyed on
      `resolveRules(state).seasonFrozen`, with a cleanup that removes it.
- [x] Applies on mount, not after the teardown — verified by loading a save already in Act VII.
- [x] Cleanup removes the class, so prestige back to Act VI does not leave the ballpark black.

## 4. The phase pills

- [x] `data/actSevenPalette.js` — five pills in `{ bg, ink }`, `eras.js`'s shape.
- [x] `getPhasePill()` returns null for an unrecognized id; the chip then keeps its neutral ground
      and shows the raw id (design Decision 4).
- [x] `HeaderStats` colours the existing `.phase-chip` slot inline, by the same path the era chip
      uses. No new chip, no new tab.
- [x] Ratios **computed**, not copied: all five clear the 4.7 floor, lowest `deepSpace` at 6.39.
      The arithmetic is recorded at the foot of the palette file.
- [x] Verified every phase in `EXPEDITION_PHASES` has a pill and there are no extra keys.

## 5. Shared primitives for the queued panels

- [x] `.v7-rate` with `.is-good` / `.is-drain` / `.is-alert` — the third state is the clamp at zero,
      which is what Decision 3.3's throttle-rather-than-fail asks the UI to communicate.
- [x] `.v7-meter` / `.v7-meter-fill` for stock against derived capacity.
- [x] `.v7-row` / `.v7-row-name` / `.v7-row-cost` / `.is-unaffordable` for the house shop contract,
      shared by Fab (STORY-036) and Sites (STORY-037).

## 6. Verification

- [x] `npm run build` passes.
- [x] Driven in Chrome against an injected Act VII save: body class present, ground `#070b12`,
      panels `#0e1622`, `.panel h2` and the active tab `#ffb340`, phase pill `#4fb3c4`.
- [x] Swept `.app-shell`, `.panel`, `.header-stats`, `.stat-chip`, tab buttons, `.hustle-bar`,
      `.lot-click-button` and `.muted` for the four ballpark ground colours — none remain.
- [x] Every header chip label clears 4.5:1 (worst 6.86).
- [x] No player-facing string added to a component; the palette is data.

## 7. Out of scope, deliberately

- [ ] **No panel body is touched.** All six tabs still render `PlaceholderPanel`. STORY-035 (Ops),
      036 (Fab) and 037 (Sites) are unblocked by this merging and add their rules inside this
      section.
- [ ] The `reactor` / `hydroponicsBay` / `solarWing` naming violation
      (`data/actSevenNamingConfig.js`) is untouched — open since Phase 3 and not this change's job.
