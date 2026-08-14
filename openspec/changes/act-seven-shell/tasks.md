## 1. The act entry

- [x] 1.1 Append Act VII to `ACTS` in `src/data/acts.js` at `id: 6`, with `exit: null` and a
      comment recording that its null exit means "end of the authored arc" while Act VI's means
      "the win condition" — two different facts that happen to share a value.
- [x] 1.2 Declare `rules: { seasonFrozen: true, … }` plus the four click keys from PRD §5.2
      (`clickCurrency: 'salvage'`, `clickLabel: 'Sift the wreck'`, `clickFlatValue: 8`,
      `clickCooldownSeconds: 3`).
- [x] 1.3 Comment `clickFlatValue` as shipping INERT — `engine/clicker.js` is the §5 click story's
      file and does not read it yet — and record what the click pays in the interim (`perClick`
      Salvage, since no `clickMultiplier` is declared) and why a placeholder multiplier would be
      worse than a visible gap.
- [x] 1.4 Declare `unlocks: ['ops', 'fab', 'launch', 'sites', 'artifacts', 'contracts']`, with a
      comment recording why `salvage` is deliberately NOT unlocked (`HeaderStats.js:61` filters
      `CURRENCIES` by the unlocked set and falls back to held currencies only when that filter is
      empty; unlocking it would drop the caps and cash chips as a side effect of a routing change).
- [x] 1.5 Declare `hides` as the twelve `PANELS` keys, with the tab-ids-only rule, the three
      mechanic ids that must never appear there (`hustle`, `retirement`, `walkup`), the
      `concessions`/`sponsorships` near-miss, and why `lot`/`wallBall` are absent.
- [x] 1.6 Declare `unlockedBy` mapping five tab ids to phase ids, with `ops` deliberately absent.
- [x] 1.7 Extend the file header with the `unlockedBy` paragraph, and rewrite the two comment
      blocks that described `FINAL_ACT_INDEX` and `PRESTIGE_ACT_INDEX` as coinciding — they no
      longer do, which is the case those comments were written for.

## 2. The resolution

- [x] 2.1 Give `getUnlockedFeatures()` in `src/engine/progression.js` an optional second argument,
      the expedition phase, and accumulate `unlockedBy` in the loop that already accumulates
      `hides`.
- [x] 2.2 Add `hasReachedPhase(phase, required)` — a rank comparison over `EXPEDITION_PHASES`,
      never an equality test — and apply it in the existing `filter()` after the `hides`
      subtraction.
- [x] 2.3 Import `EXPEDITION_PHASES` from `data/actSevenConfig.js` for its ORDER only; the
      comparison lives in the engine because `src/data/` carries no logic.
- [x] 2.4 Comment the second argument at length: why it is a scalar and not `state`, why it fails
      open at both edges, and the rule that follows (only tab ids carry `unlockedBy`; only the
      caller that queries tab ids passes a phase).
- [x] 2.5 Rewrite `checkActTransition()`'s comment. Both halves of the sentence it justified itself
      with have changed meaning: record that the loop is player-gated rather than bounded, that Act
      VII's `exit: null` stops it for the same structural reason Act VI's did, and that Act VI's
      `exit: null` is what keeps Act VII unreachable until the call-up story lands.
- [x] 2.6 Audit every reader of `FINAL_ACT_INDEX` and `PRESTIGE_ACT_INDEX` now that they differ
      (design.md Decision 6). No code change required; `ACT_INITIALIZERS` is already keyed on the
      prestige floor.

## 3. The panels

- [x] 3.1 Add `src/data/actSevenPanels.js` — the six tabs' ids, labels, headings and placeholder
      blurbs, in tab order, plus the shared "not built yet" line.
- [x] 3.2 Add `src/components/expedition/PlaceholderPanel.js`, rendering a heading and copy looked
      up by id, reusing `.panel` and `.muted` so no CSS is written.
- [x] 3.3 Add six one-line wrappers — `OpsPanel`, `FabPanel`, `LaunchPanel`, `SitesPanel`,
      `ArtifactsPanel`, `ContractsPanel` — so every later story edits a file that already exists
      under the right name.
- [x] 3.4 Confirm no player-facing string literal appears in any of the seven components.

## 4. The shell

- [x] 4.1 Register the six panels in `AppShell`'s `PANELS` map, after the twelve ballpark keys,
      with a comment recording that `ops` being first is what makes the fallback land on the
      terminal.
- [x] 4.2 Spread the six into `TabNav`'s `TABS` from `data/actSevenPanels.js`, so their ids are
      authored exactly once across the two registration lists.
- [x] 4.3 Read the phase through `engine/colony.js`'s `expeditionSlice()` — never off
      `state.expedition` — and pass it to `getUnlockedFeatures()`.
- [x] 4.4 Add `phase` to the `useMemo` dependency list. Keyed on `act` alone the tab set freezes at
      whatever the phase was when the act began and the reveal never fires.
- [x] 4.5 Remove the `|| 'field'` and `|| FieldView` fallbacks; fall back to `visibleTabs[0]` and
      render nothing when there is no visible tab (design.md Decision 4).
- [x] 4.6 Guard the `MARK_TAB_SEEN` effect on `effectiveTab` being truthy, so an undefined tab id
      can never be persisted. Do NOT clear `seenTabs` anywhere.
- [x] 4.7 Comment the pre-season early return with the invariant Act VII depends on, the evidence
      for it, and why widening its condition would be a crash rather than a hardening.

## 5. Verification

- [x] 5.1 `getUnlockedFeatures(i)` for `i` in 0..5 string-identical to the same call on
      `HEAD` — at every phase value and for every garbage index — with the baseline loaded from
      `git show` rather than described.
- [x] 5.2 Act VII's tab set at each of the five phases is exactly the intended one; no baseball tab
      at any phase; `hustle` present at every phase; mechanic ids all survive.
- [x] 5.3 Unknown and omitted phases both fail open to all six tabs.
- [x] 5.4 Entering Act VII leaves `season`, `league`, `roster` and `stadium` intact; 30 simulated
      minutes advance the clock, resolve no game and leave the league byte-identical; the same 30
      minutes in Act VI DO move it (the control that proves the assertion measures something).
- [x] 5.5 Every `PANELS` key is registered in `TabNav` and vice versa, in the same order, checked
      by parsing both files.
- [x] 5.6 Run the built app on an injected Act VII save: one tab at `aftermath`, six at
      `deepSpace`, each panel renders, the click credits Salvage, no console output, `seenTabs`
      appended and never cleared.
- [x] 5.7 `npm run build` passes.
- [x] 5.8 No harness, fixture or scratch file is left in the repo.
