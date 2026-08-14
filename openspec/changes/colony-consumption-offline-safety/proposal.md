## Why

The entire income model is monotonic and additive. `totalIncomePerSecond()` returns a per-currency
bundle that is always `>= 0`, it is integrated over a step, and `creditWallet()` structurally
refuses a negative. Act VII's Power, Oxygen and Provisions are **consumed**, which breaks two
assumptions that the tick loop currently relies on:

1. **Offline catch-up is the same code path as the live tick.** `advance(state, deltaSeconds)` is
   called identically by the 1-second timer and by `engine/offlineProgress.js` with up to
   `offlineCapSeconds` (8 hours). A colony with a negative net rate integrated across 28,800
   seconds in one step goes arbitrarily negative.
2. **A quiet state takes the whole span as one step.** `findNextEventClock()` returns `Infinity`
   when nothing is pending, and `advance()` then makes `step = remaining`. That is a *feature* for
   monotone income — it is why an 8h return costs a handful of iterations instead of exhausting
   `safetyCapIterations`. It becomes wrong the moment a quantity can cross a boundary *inside* a
   step, because the rate applied to the rest of that step was the pre-crossing rate, and the error
   scales with how long the player was away.

Measured, on a synthetic colony crossing its Fuel cap 357 seconds into an 8-hour absence: without a
boundary contributor the player is credited **1,036,800 Power against a true 1,719,428** — a 40%
under-credit. On a colony crossing zero 55 seconds in, the error runs the other way: **40,320 Oxygen
against a true 10,138**, 4x too much. Nothing throws. Nobody reports it.

## What Changes

- **`engine/colony.js` gains the consumption model**, all pure, extending the existing slice
  accessor rather than sitting beside it:
  - `colonyRates(state, modifiers)` — **one call, one solve** — returning
    `{ satisfaction, supplyThrottle, gross, demand, net, capacity }` (plus a diagnostic `passes`).
  - `integrateColony(state, modifiers, step)` — applies `net x step`, clamps every resource to
    `[0, capacity]`, and returns the state object **by identity** when nothing moved.
  - `nextColonyThresholdClock(state, modifiers)` — the earliest clock at which any resource reaches
    `0` or `capacity` at the current net rate, else `Infinity`.
  - `spendResource(state, resourceId, amount)` — the only debit path into `expedition.resources`.
  - `isAftermathPhase(state)` / `isLifeSupportPhase(state)` — the two early phase predicates as pure
    functions. They **write nothing**; `engine/sites.js` remains the single writer of
    `expedition.phase`.
- **`engine/tickEngine.js` gains two lines and edits no control flow**: one `integrateColony()` call
  beside the existing `creditIncome()` call, and one **append** to `EVENT_CLOCK_CONTRIBUTORS`.
  `findNextEventClock()`'s body is untouched, which is what the contributor list was built for.
- **`data/actSevenConfig.js` gains the tuning**: an intentionally **empty** module catalogue, the
  solve bounds (`SOLVE_MAX_PASSES`, `SOLVE_EPSILON`), `COLONY_MIN_STEP_SECONDS`, and the names of
  PRD §5.9's generation multiplier keys.

**This change ships with ZERO modules defined.** An empty colony produces nothing, consumes nothing,
`nextColonyThresholdClock()` returns `Infinity`, and `integrateColony()` returns its argument
unchanged — so `advance()` is provably identical to what it was, on every save in existence, while
the offline-safety behaviour is proven against a synthetic colony injected at test time. Content and
correctness are separated so that a later balance edit cannot silently become a correctness
regression.

**Not** a breaking change. No `meta.version` bump, no new state field (the `expedition` slice
already exists), no change to any existing export's signature, no change to what any component
renders. `BONUS_KEYS` and `CLAMPS` are deliberately **not** touched — registering §5.9's multiplier
keys changes `computeModifiers()`'s output shape and belongs to the story that sells the powerups.

## Capabilities

### New Capabilities

None specified as a delta. `skip_specs: true`, matching the disposition `event-clock-contributor-list`
and `prestige-act-index` took: the behaviour this change adds is inert in the shipped game (zero
modules), and a requirement describing behaviour no player can reach is a requirement that cannot be
verified. The story that lands the module catalogue makes the colony observable and is the right
place to specify it.

### Modified Capabilities

None. The `income` capability recorded by `changes/odyssey-progression-architecture` describes
monotone currency accrual through `creditWallet()`, and this change **does not route through it** —
that is the point of Decision 2 below. The `progression` capability's dependency on
`findNextEventClock()` returning `Infinity` on a quiet state is preserved exactly: the new
contributor abstains on every colony with no modules, which is all of them today.

## Relationship to `changes/odyssey-progression-architecture`

**Preserved and extended, not revised.** Two of its decisions are directly load-bearing here:

- **Decision 1 (income is rate-integrated, not event-driven)** is preserved in letter and extended
  in scope. Its closing constraint — that `findNextEventClock()` returning `Infinity` on a quiet
  state is *correct* rather than degenerate, because it is what lets an 8h catch-up integrate in one
  pass — is exactly what this change must not break, and the empty-colony abstention is how it does
  not. What is extended is the class of quantity that may be rate-integrated: Decision 1 assumed a
  monotone non-negative bundle, and this change adds a *signed* rate against a capacity clamp. The
  two run side by side in `advance()` sharing the step and nothing else.
- **Decision 6 (the anti-softlock guarantee is mechanical)** is preserved and restated for
  consumables. Its three clauses are about currencies; the equivalent guarantee for a resource that
  can be exhausted is the throttle rule: a starved resource **throttles its dependents by a
  satisfaction factor** and destroys nothing. No module is removed, no stock is zeroed, no colonist
  dies, no currency goes below zero, and no affordable purchase is refused. Recovery is
  purchase-only and monotone, because every generator raises the numerator of a fixed point whose
  denominator is fixed.

## Open questions, flagged rather than solved

**`resetForPrestige()` spreads `...state`, so `expedition` currently survives a prestige.** Recorded
by the sibling slice story (`salvage-currency-expedition-slice`) and not resolved here. This change
makes it *matter* rather than merely noting it: an expedition that survives a prestige carries its
modules, and modules are what make `nextColonyThresholdClock()` stop abstaining. A player who
prestiges out of Act VII would return to Act I with a colony still drawing Power in the background.
Nothing here is unsafe — the clamp and the throttle hold regardless — but the intent is almost
certainly that the colony resets, and the decision belongs to whoever owns the Act VII prestige
rules, not to the consumption engine.
