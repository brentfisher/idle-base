# Tasks — the frozen-league header and the resource readout

## 1. The boundary helper

- [x] New `engine/colonyReadout.js` exporting `listResources(state, modifiers)`.
- [x] `modifiers` optional, defaulting internally exactly as `colonyRates` does — a required
      second argument would force a component to decide which modifier set the readout is
      computed against.
- [x] Every returned field is arithmetic on `colonyRates()`'s output. **No second solve.**
- [x] Verify under `node` that `net` and `capacity` are identical to the engine's for the
      same state.
- [x] `secondsUntilEmpty` returns `Infinity` — not 0 — for a resource pinned at empty, because
      the engine pins its net rate to exactly 0.
- [x] Fixed during review: `fraction` returned 1 for a zero capacity, so a fresh Act VII save
      drew a completely filled Fuel meter beside the text "0/0" — the bar saying full while the
      numbers said empty. It returns 0: nothing stored, nothing storable.
- [x] Fixed during review: `starved` required a `capacity > 0` clause. Fuel starts at 0/0
      because no tank has been built, so without it every fresh Act VII save opened with an
      alarm-red chip describing the normal starting state.

## 2. The authored numbers

- [x] New `data/colonyReadoutConfig.js` with the warning threshold, the six tones and
      `resourceTone(row)`.
- [x] Threshold derived rather than chosen — 90s, the measured time to afford the relieving
      purchase, so the warning arrives while the player can still act on it.
- [x] Tone priority is ordered, not a lookup: the states are not mutually exclusive and the
      priority is the design (what has broken outranks what is about to).

## 3. Contrast, computed

- [x] Compute every new bg/ink pair with the WCAG 2.1 relative-luminance formula under `node`.
- [x] Record the measured figures in the config comment.
- [x] **Corrected**: the first draft's numbers were guessed and all 0.5–1.4 high. Replaced with
      the computed values. Worst pair 6.86:1 against a 4.5:1 bar.
- [x] Phase pill measured separately: 8.71:1.

## 4. The chips

- [x] New `components/layout/ResourceChips.js`, rendering rows verbatim and deciding nothing.
- [x] Amount against capacity, the net rate's sign, a proportional meter, and a tooltip
      carrying the runway.
- [x] `Infinity` formats as an em dash, never as a duration.

## 5. The swap

- [x] Gate on `resolveRules(state).seasonFrozen`, not on the act index.
- [x] Suppress the season/record chip, reputation, capacity and the champions badge.
- [x] Reuse the era pill's slot for a phase pill, keeping the `era-chip` class so it inherits
      the pill's shape.
- [x] Unrecognized phase falls back to the raw id rather than vanishing — the phase is
      self-healing and one tick from repair.
- [x] Confirm Salvage needs no code: already in `data/currencies.js`, and the header already
      falls back to held currencies. **No currency name in the component.**

## 6. Styles

- [x] Feature section placed **above** `global.css`'s trailing `@media (max-width: 640px)`
      block — the file ends inside it, so an appended rule is silently mobile-only.
- [x] Colours applied as inline styles from `data/`, never a CSS class per state.
- [x] Chip is a column so the meter spans its width; no fifth column at 390px.
- [x] `prefers-reduced-motion` disables the meter transition.

## 7. Gate

- [x] `npm run build` passes with no errors.

## Deliberately out of scope

- [ ] The Ops panel's own resource display — this change covers the persistent header only.
- [ ] Storage modules that raise a ceiling (STORY-025). The readout already renders a changing
      capacity correctly; nothing here needs revisiting when they land.
- [ ] A visual check in a real browser at 390px. The layout is reasoned from the existing
      mobile block and the chip is built as a column for that reason, but it has not been
      rendered on a device — worth a look during review.
