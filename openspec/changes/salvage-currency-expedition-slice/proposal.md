## Why

Act VII (the Farm Team odyssey, `docs/PRD-act-seven-farm-team.md`) needs a fourth currency and a
new top-level state slice. Every later Act VII story — the module shop, the colony integrator, the
site ladder, the puzzles — reads that slice, so the shape has to exist before any of them can be
written against it.

Landing it alone and first also buys the thing that is genuinely risky here. `persistence/saveLoad.js`
discards any save whose `meta.version` differs from `CURRENT_VERSION` and there is **no migration
path**, so a new slice is only safe if it is readable when totally absent. Shipping the shape on its
own lets that defaulting be proved against real in-flight saves *before* anything depends on it,
rather than discovering the gap inside a story that also has a mechanic to debug.

## What Changes

- `data/currencies.js` gains `salvage` as a fourth entry, appended per the file's cheapest-first
  convention (the last entry is the newest act's currency).
- `state/initialState.js` gains `wallet.salvage: 0` and the `expedition` slice in the shape of PRD §4:
  `phase`, `resources` (four `{ amount, capacity }` records), `modules`, `sites`, `puzzles`,
  `contracts`, `launches`.
- New `data/actSevenConfig.js` holds the only copy of the expedition's base shape — the resource ids,
  their base capacities, the five phase ids and the initial phase. `initialState.js` and the accessor
  both read it, so they cannot drift.
- New `engine/colony.js` exports `expeditionSlice(state)`, a defaulting accessor in the
  `concessionsSlice()` / `wallBallSlice()` shape that returns a fully-formed expedition when the slice
  is absent, `{}`, or partially populated. `engine/colony.js` is the module PRD §5.8 assigns the rest
  of the colony simulation to; this change lands only the accessor.
- `engine/prestige.js`'s wallet literal gains `salvage: 0`, keeping true its own comment that it
  "mirrors the wallet in `createInitialState()`".
- **Not** a `CURRENT_VERSION` bump, and deliberately so — see design Decision 1.
- **No behaviour.** Nothing credits salvage, nothing integrates the resources, no component renders
  the slice. `HeaderStats` already renders currencies from the `CURRENCIES` config list rather than
  from literals, so it needs no edit to show a Salvage chip once something pays it.

## Capabilities

### New Capabilities

- `expedition-state`: the Act VII expedition slice — its shape, its four capacity-bounded consumables,
  and the requirement that it be readable through a defaulting accessor when absent from a save.

### Modified Capabilities

- `currency`: extended with a fourth currency (Salvage) and with the explicit statement that adding a
  currency does not invalidate an existing save. The spec's existing requirements are **preserved**
  unchanged — in particular "currencies not yet introduced are not shown, including at a zero
  balance", which this change satisfies without a component edit (design, Risks).

Relationship to the in-flight `odyssey-progression-architecture` change:

- Its **Decision 2** (locked content is `null`; tick-loop collections are present-and-empty) is
  **preserved** and applied verbatim. `expedition`'s collections are dereferenced by `advance()` on
  every iteration once Act VII exists, so the slice is present-and-empty rather than `null`.
- Its **`currency` spec** is **extended**, not revised or superseded. Currency succession and the
  conversion of a retired currency at an act boundary are untouched here and remain that change's.

## Impact

- Code: `src/data/currencies.js`, `src/data/actSevenConfig.js` (new), `src/state/initialState.js`,
  `src/engine/colony.js` (new), `src/engine/wallet.js` (its exported `CURRENCIES` id list),
  `src/engine/prestige.js` (one key in the reset wallet literal).
- Saves: none. `CURRENT_VERSION` stays at 2; a v2 save from any act loads unchanged.
- No new dependencies, no build changes, no component changes.
