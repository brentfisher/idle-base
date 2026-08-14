## Why

`hides` (`changes/act-hides-feature-gating`) gave the act config the vocabulary for removal and
shipped it inert: no act declared one, and its own proposal states outright that "the behavioural
requirement belongs to the Act VII story, which will be the first to declare a `hides` array and
the first to change what a player sees." `seasonFrozen` (`changes/season-frozen-rule`) did the same
for the simulation — a resolvable rule that suspends the baseball game without deleting it, which
no act declares. `PRESTIGE_ACT_INDEX` (`changes/prestige-act-index`) split "the prestige floor"
away from "the end of the authored arc" so that appending an act would stop being a live bug.

Three mechanisms, all landed, all waiting on the same consumer. This change is that consumer.
`docs/PRD-act-seven-farm-team.md` turns on a seventh act whose premise is that the game was never a
baseball game: the twelve ballpark tabs are retired, the league freezes in place, and six new tabs
arrive over the two-plus hours that follow. This change lands the **config and the routing** — the
act entry, the tab set and the shell that resolves it. The panels behind those tabs are
placeholders and belong to later stories.

## Relationship to prior decisions

**`odyssey-progression-architecture` Decision 5 (unlocks are derived, not stored) — PRESERVED, and
extended in the same direction `act-hides-feature-gating` extended it.** The intra-act reveal is
resolved on read from `expedition.phase`, which is itself recomputed from a pure predicate ladder.
Nothing about which tabs are visible is persisted, so retuning which phase reveals which tab keeps
taking effect on an existing save with no migration.

**`odyssey-progression-architecture` Decision 6 (the manual click is never removed or disabled) —
PRESERVED, and load-bearing here for the first time.** `hides` is capable of retiring `hustle`, and
Act VII is the act with the most apparent reason to (it retires everything else). It does not, and
`data/acts.js` records why at length: the click is Act VII's Salvage faucet, every shop in the act
is Salvage-priced, and the click is therefore the act's entire anti-softlock guarantee.

**`act-hides-feature-gating` Decision 4 (no component changes, and the two limits Act VII
inherits) — REVISED, as that decision anticipated.** It recorded two inherited limits rather than
fixing them, on the grounds that a change claiming to alter no behaviour must not edit components.
This change owns them. Limit 1 is fixed (the `'field'` / `FieldView` fallbacks are gone). Limit 2
is verified rather than fixed, and design.md gives the argument and the measurement.

**PRD §6.5 (`unlockedBy` keyed on milestones) — REVISED, following ledger R4.** The reveal keys off
a phase-rank comparison against `expedition.phase`, not off new `phaseLunar`-style milestones. R4
already ruled this way; this change implements the ruling and records the one place it goes
further than R4 (the `launchReady` capability flag, which has no writer yet — design.md Decision 3).

## What Changes

- `src/data/acts.js` — Act VII is appended at `id: 6`: `rules: { seasonFrozen: true }` plus the
  four click keys from PRD §5.2, `unlocks` of the six new tab ids, `unlockedBy` gating five of them
  by phase, `hides` of all twelve `PANELS` keys, and `exit: null`. `FINAL_ACT_INDEX` becomes 6 by
  derivation. The header comment gains the `unlockedBy` paragraph; two comment blocks that
  described the coincidence of `FINAL_ACT_INDEX` and `PRESTIGE_ACT_INDEX` are rewritten now that
  the two have actually diverged.
- `src/engine/progression.js` — `getUnlockedFeatures()` takes an optional second argument, the
  expedition phase, and applies `unlockedBy` as a rank comparison after the existing
  union-then-subtract. Fails open at both edges. `checkActTransition()`'s comment is rewritten:
  both halves of the sentence it justified itself with have changed meaning.
- `src/data/actSevenPanels.js` — NEW. The six tabs' ids, labels and placeholder copy.
- `src/components/expedition/` — NEW. `PlaceholderPanel` plus six one-line wrappers, one per tab,
  so each later story edits a file that already exists under the right name.
- `src/components/layout/AppShell.js` — the six panels are registered; the unlock derivation takes
  the phase (and the memo takes it as a dependency); the `visibleTabs[0] || 'field'` and
  `PANELS[...] || FieldView` fallbacks are removed; `MARK_TAB_SEEN` is guarded.
- `src/components/layout/TabNav.js` — the six tabs are spread in from `data/actSevenPanels.js`.
- **No CSS.** The placeholders reuse `.panel` and `.muted`. `styles/global.css` ends inside an
  `@media (max-width: 640px)` block and a placeholder is not a good enough reason to go near it.
- **No `meta.version` bump**, and no state shape change of any kind.

## Capabilities

### Modified Capabilities

- **progression** — a stage may now retire the surfaces earlier stages built, may reveal its own
  surfaces progressively from its own internal progression signal, and may never retire the manual
  action. The shell's default surface is derived from the stage rather than falling back to a named
  surface that a stage may have retired.

## Impact

- `src/data/acts.js` — one act appended, three comment blocks revised. No existing act value moves.
- `src/engine/progression.js` — one function gains an optional argument and one helper; verified
  byte-identical output for acts 0-5 at every phase value and for every garbage index.
- `src/components/layout/AppShell.js`, `TabNav.js` — registration plus the fallback fix.
- **Reachability:** Act VII cannot be entered in play after this change. Act VI still declares
  `exit: null`, so `checkActTransition()` cannot cross into it; the crossing is the call-up story's
  (PRD Decision 3.2) and is opt-in by design. Everything here was verified against an injected save.
