## Why

`getUnlockedFeatures(actIndex)` in `src/engine/progression.js` builds the cumulative union of the
`unlocks` arrays for acts `0..actIndex`. It is monotonic by construction: an act can only ever ADD
feature ids, never take one away. Every act in the authored arc so far only ever added, so the
limitation has never bitten.

The arc no longer stays additive. `docs/PRD-act-seven-farm-team.md` §3.1 turns on a seventh act
whose entire premise is a teardown — the baseball UI the first six acts built is retired and
replaced. There is no way to express that in the act config today, at any price: the config has no
vocabulary for removal.

This change adds that vocabulary and nothing else. It lands with **no act declaring `hides`**, so
it is a provable no-op — `getUnlockedFeatures` returns byte-identical output at every act index
before and after. That is exactly what makes it safe to land ahead of the act that needs it, and
what keeps the Act VII story from having to touch the resolution rule and the content in one
reviewable unit.

## Relationship to Decision 5 — this **extends** it, and supersedes one sentence of its text

`changes/odyssey-progression-architecture/design.md` **Decision 5** ("Unlocks are derived, not
stored") is the property this change sits directly on. Its *invariant* is preserved in full and is
the reason `hides` takes the shape it does:

> unlocks are computed on read; nothing about which features are unlocked is persisted; retuning
> which act unlocks a feature takes effect on existing saves with no migration.

`hides` is **config resolved on read**, not a persisted flag, precisely so that all three clauses
keep holding word for word. Retuning which act retires which feature must take effect on an
existing save with no migration, same as unlocking always has. A stored `hidden` list would freeze
one edit of `data/acts.js` into every save in the wild and need a migration to undo it — the exact
failure Decision 5 exists to prevent.

What this change *does* supersede is one sentence of Decision 5's prose: "returns the cumulative
union of `unlocks` arrays for acts `0..actIndex`". After this change the derivation is the union of
`unlocks` **minus** the union of `hides`, over the same act range and still entirely on read. The
decision's title, its rationale and its invariant are untouched; only its description of the
formula is extended. Nothing here revisits the ruling itself.

## What Changes

- `src/data/acts.js` — the header comment gains a paragraph documenting a new optional act key,
  `hides: [...featureId]`: the inverse of `unlocks`, drawn from the same id namespace (a PANELS key
  retires a whole tab, anything else retires a mechanic inside a still-visible panel). The
  paragraph also records the precedence rule an author needs, that re-listing an id in a later
  act's `unlocks` will not bring it back.
- `src/data/acts.js` — **no act gains a `hides` key.** The ACTS array is unchanged.
- `src/engine/progression.js` — `getUnlockedFeatures()` collects each act's `hides` alongside its
  `unlocks` in the existing single loop, then subtracts the collected ids from the finished union
  with a `filter()`. Its comment block records why resolution is union-then-subtract rather than
  per-act, and the consequence that `hides` wins over a later `unlocks` of the same id.
- **No component change.** `components/layout/AppShell.js:64-67` already falls back to the first
  visible tab when the active one stops being unlocked, and the other three consumers gate on
  `includes()` of the returned array, which is the whole gate for a mechanic id. Verified by
  reading them, not assumed; two inherited limits are recorded in design.md for the Act VII story.
- **No behaviour change of any kind.** With no act declaring `hides` the subtraction set is empty
  at every index, so the function returns the same ids in the same order. Verified by diff, not by
  inspection (see design.md).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is behaviourally inert by construction: it introduces an authoring affordance in
`src/data/` that no act uses, and the observable output of the only function it touches is proven
identical at every reachable act index. `.openspec.yaml` therefore sets `skip_specs: true`, the
same call the sibling `prestige-act-index` change made for the same reason. Specs describe
behaviour; no behaviour changes here, and inventing a requirement to satisfy validation would
misrepresent the change. The behavioural requirement belongs to the Act VII story, which will be
the first to declare a `hides` array and the first to change what a player sees.

## Impact

- `src/engine/progression.js` — one function body (four added lines) plus its comment block.
- `src/data/acts.js` — header comment only. No config value moves.
- **Consumers, none modified:** `components/layout/AppShell.js:58` (tab gate + the preseason
  `wallBall` check), `components/layout/HeaderStats.js:61`, `components/roster/RosterPanel.js:88`
  (`walkup`), `engine/tickEngine.js:419` (`retirement`). All four read the returned array through
  `includes()`/`indexOf()` and need no change to honour a shrinking array.
- **No persistence file is touched and `meta.version` is NOT bumped.** No save shape changes;
  `hides` is config, never state. A save written before this change resolves identically after it.
- Unblocks: the Act VII story, which is the first act that retires rather than adds.
