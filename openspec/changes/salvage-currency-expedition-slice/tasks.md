## 1. Config — the one copy of the shape

- [x] 1.1 Add `src/data/actSevenConfig.js` with `EXPEDITION_PHASES`, `INITIAL_PHASE` and
      `EXPEDITION_RESOURCES` (id + label + base capacity, fuel at 0). Config only — no logic, no
      module/site/cost tables (design, Decision 3).
- [x] 1.2 Add `salvage` to `CURRENCIES` in `src/data/currencies.js`, appended so the last entry stays
      the newest act's currency, with a comment recording that the list is no longer three.

## 2. State shape

- [x] 2.1 Add `wallet.salvage: 0` to `createInitialState()`.
- [x] 2.2 Add the `expedition` slice to `createInitialState()`, built from `actSevenConfig`, with a
      comment extending the file's null-vs-present-and-empty note to explain why this slice is
      present-and-empty (design, Decision 2).
- [x] 2.3 Add `salvage: 0` to `resetForPrestige()`'s wallet literal in `src/engine/prestige.js`, whose
      comment already claims it mirrors `createInitialState()`.

## 3. The defaulting accessor

- [x] 3.1 Create `src/engine/colony.js` exporting `expeditionSlice(state)` in the
      `concessionsSlice()` shape, defaulting from `actSevenConfig`.
- [x] 3.2 Rebuild `resources` from the config id list rather than adopting the stored object, with
      fresh per-resource objects so nothing aliases back into state (design, Decision 5).
- [x] 3.3 Default `capacity` with `Number.isFinite`, not `||`, because fuel's base capacity is a
      legitimate 0 (design, Decision 4).
- [x] 3.4 Add the load-bearing comment the pattern requires: an absent slice is defaulted rather than
      migrated, and a key this function forgets is a key a later write-back deletes.

## 4. Currency plumbing

- [x] 4.1 Add `'salvage'` to the exported id list in `src/engine/wallet.js`.
- [x] 4.2 Confirm `balanceOf`/`creditWallet`/`debitWallet`/`canAfford` are key-agnostic and need no
      special-casing; do not change their bodies.
- [x] 4.3 Enumerate every from-scratch wallet literal and classify each as benign or needing the key.
      Do not add behaviour to fix a benign one. `grep "wallet: {"` is not sufficient — it cannot match
      a literal that is not assigned to a `wallet:` key — so close it with `grep "caps: 0"`. Result,
      four sites:
      - `state/initialState.js` — gets the key.
      - `engine/prestige.js` — gets the key; its comment already claims it mirrors `initialState`.
      - `engine/tickEngine.js:88`, `next.wallet || { caps: 0, coins: 0, cash: 0 }` — benign, left
        alone. It is a fallback for a wholly absent wallet, and the next thing it does is route
        through `creditWallet`, which adds whatever key it is handed.
      - `components/layout/HeaderStats.js:30`, `readWallet()`'s pre-`state.wallet` fallback — benign,
        left alone. Every read site is `wallet[c.id] || 0`, and that branch is only reachable for a
        save predating `state.wallet`, which `loadGame()` discards on version anyway.
- [x] 4.4 Confirm the per-act click currency needs no work: `engine/clicker.js`'s `clickCurrency()`
      reads `actClickRules(state).clickCurrency` and the credit is
      `creditWallet(state.wallet, currency, value)` — generic, no switch on id — so PRD §5.2's
      `clickCurrency: 'salvage'` is a `data/acts.js` line and nothing else.

## 5. Verification — headless, under `node`

- [x] 5.1 `expeditionSlice(undefined)`, `expeditionSlice({})` and
      `expeditionSlice({ expedition: { modules: [{ id: 'x', count: 1 }] } })` each return a fully
      shaped expedition with correct defaults; assert the input is unmutated and no nested object is
      shared with it.
- [x] 5.2 Assert a stored `capacity: 0` survives and is not replaced by the base capacity.
- [x] 5.3 Assert a partial `resources` (one resource only) still returns all four.
- [x] 5.4 Build pre-change fixtures: `createInitialState()` from `git show master:...`, advanced with
      `enterAct()` to Acts I, III and VI, JSON round-tripped. Diff their top-level key sets against
      pre-change `createInitialState()` to confirm they are genuinely pre-change shapes.
- [x] 5.5 Push each fixture through the real `loadGame()` (in-memory `localStorage` stub) and assert it
      is not discarded, then `advance()` it and assert no throw and a moving clock.
- [x] 5.6 Assert `expeditionSlice()` of each loaded fixture is fully shaped.
- [x] 5.7 Credit and debit `salvage` through `engine/wallet.js` and assert it matches the other three,
      including flooring at zero, on a wallet with no `salvage` key.
- [x] 5.8 Replicate `HeaderStats`'s two filter lines to assert Salvage is not shown at a zero balance.
- [x] 5.9 `npm run build` passes.
