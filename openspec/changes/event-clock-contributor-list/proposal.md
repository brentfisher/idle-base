## Why

`engine/tickEngine.js` `findNextEventClock()` is a twelve-line function with four hardcoded
candidate sources, and `key-files.md` already names this file "the most likely file for two
parallel changes to collide in." Act VII queues **four more** candidate sources onto that same
function — colony resource boundaries (STORY-027), launch arrivals and site builds (STORY-028),
puzzle cooldowns (STORY-029) and contract windows (STORY-030). Four independent story branches
each editing the same twelve lines of shared control flow is four merge conflicts resolved by
hand, in the one function whose correctness bounds every step the simulation takes.

This is the identical argument the odyssey change made for income in design.md Decision 1
("every new act would edit a conditional that every other act also touches"), and it was right
there. PRD ledger R5 mandates this refactor as a Phase 0 story explicitly, before any of the
four consumers land.

## What Changes

- `findNextEventClock()` becomes a `reduce` over a module-level `EVENT_CLOCK_CONTRIBUTORS`
  array. Each contributor is a pure `(state) => clock | Infinity`.
- The four existing candidate sources become four registered contributors —
  `nextGameAtClock`, `nextPlayoffRoundAtClock`, `nextPowerupExpiryAtClock`,
  `nextCampCompletionAtClock` — each keeping its own guard, verbatim.
- Each contributor now tolerates its slice being absent instead of dereferencing it blindly.
  This is the change's only behavioural difference, it is unreachable in the shipped game, and
  it is in the safe direction. See design.md Decision 3.
- A block comment above the list records the contract every contributor must honour and, in
  particular, *why* returning `Infinity` for "nothing pending" is load-bearing rather than
  incidental.

**Not** a breaking change. No save format change (`meta.version` untouched), no new state
fields, no new module, no change to `module.exports`, no change to what any component renders.
The four contributor functions are intentionally **not** exported — nothing outside this file
has a use for them yet, and exporting them would invite a caller before there is a reason.

## Capabilities

### New Capabilities

None. This change adds no behaviour, so it adds no requirement worth specifying. `skip_specs:
true` is set in `.openspec.yaml`, per the guidance that specs describe behaviour and behaviour
does not change here — the same disposition `prestige-act-index` took.

### Modified Capabilities

None. The `income` and `progression` capabilities recorded by
`changes/odyssey-progression-architecture` both *depend* on `findNextEventClock()` returning
`Infinity` on a quiet state (odyssey design.md Decision 1, "income must be rate-integrated, not
event-driven"), and this change preserves that property exactly rather than modifying it.

## Relationship to `changes/odyssey-progression-architecture`

**Independent, and downstream of it.** That change is the six-act architectural spine; this one
touches none of its decisions. It does, however, sit squarely on two of them and is written to
honour both:

- **Decision 1** established the income-contributor list and, in its closing constraint,
  established that `findNextEventClock()` returning `Infinity` when nothing is pending is
  *correct* rather than a degenerate case, because it is what lets `advance()` integrate an 8h
  catch-up in one step instead of exhausting `safetyCapIterations`. This change copies that
  decision's shape onto the event clock and promotes its constraint into a written contract that
  the four pending Act VII contributors must satisfy.
- **Decision 2** established that `roster` and `powerups` are present-and-empty from t=0 while
  `season` is `null` until Act III, which is exactly why three of the four contributors need no
  slice guard today and one always did.

Nothing in the odyssey change needs revising as a result.

## Impact

**Affected code:** `src/engine/tickEngine.js` only — 75 insertions, 9 deletions, entirely inside
the footprint of the function being replaced. Deliberately the narrowest possible diff: another
branch (STORY-019, `seasonFrozen`) is concurrently editing this same file from an older base, so
every unrelated line touched here is a conflict somebody resolves by hand.

**Unaffected:** every other engine module, all of `state/`, all of `components/`, `data/`,
persistence and the save format. `module.exports` is unchanged, so the header countdown bar that
imports `findNextEventClock` for display keeps working untouched.

**Downstream:** unblocks STORY-018, STORY-027, STORY-028, STORY-029 and STORY-030, each of which
becomes an append of one function plus one array entry.
