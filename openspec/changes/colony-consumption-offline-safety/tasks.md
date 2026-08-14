## 1. Tuning and shape (`data/actSevenConfig.js`)

- [x] 1.1 Add `EXPEDITION_RESOURCE_IDS`, derived from `EXPEDITION_RESOURCES` rather than written out
      a second time.
- [x] 1.2 Add `EXPEDITION_MODULES = []` — the catalogue, deliberately empty — with the entry shape
      documented for the content stories and the read-at-call-time / `FINAL_ACT_INDEX` warning.
- [x] 1.3 Add `SOLVE_MAX_PASSES = 16` and `SOLVE_EPSILON = 1e-4`, with §5.6's derivation of why 16
      and not 8.
- [x] 1.4 Add `COLONY_MIN_STEP_SECONDS = 0.5`, commented as belt-and-braces rather than mechanism.
- [x] 1.5 Add `OUTPUT_MULTIPLIER_KEYS` / `DRAW_MULTIPLIER_KEY`, commented as inert until §5.9
      registers them in `BONUS_KEYS`. **Do not register them here** — that changes
      `computeModifiers()`'s output shape.

## 2. The solve (`engine/colony.js`)

- [x] 2.1 `ownedModules(slice)` — join owned counts to catalogue entries, indexing the array at call
      time. Drop non-positive/non-finite counts and unknown ids rather than coercing, so a corrupt
      save cannot inject a `NaN` into a rate.
- [x] 2.2 `demandAtFullOutput(owned, drawMult)` — constant across the solve, with Decision 2's
      "do not improve this" note and the seams where site draw and contract upkeep fold in.
- [x] 2.3 `grossProduction(owned, satisfaction, modifiers, extraThrottle)` —
      `throughput[m] = min over inputs of satisfaction[r]`.
- [x] 2.4 `solveSatisfaction()` — Kleene iteration from the top, `Math.min` monotone descent, capped
      at `SOLVE_MAX_PASSES`, exiting early on `SOLVE_EPSILON`. Returns the pass count.
- [x] 2.5 `loadFollowThrottles()` + `loadFollowOf()` — one non-iterated pass after the solve. Guard
      the division; Fuel's capacity of 0 makes `stock >= capacity` true from turn one.
- [x] 2.6 `actualDraw()` — draw after load-follow, explicitly *not* the same quantity as `demand`.
- [x] 2.7 `colonyRates(state, modifiers)` — assemble; pin `net` to exactly 0 at **both** boundaries;
      `modifiers` optional so the display path and the contributor can call it with state alone.

## 3. Integration and the contributor

- [x] 3.1 `integrateColony(state, modifiers, step)` — `net x step`, clamp to `[0, capacity]`, return
      the state **by identity** when nothing moved, and spread the full accessor return when it did.
- [x] 3.2 `nextColonyThresholdClock(state, modifiers)` — abstain on an empty colony before computing
      modifiers; skip `rate === 0`, `distance === 0`, and boundaries under `COLONY_MIN_STEP_SECONDS`.
- [x] 3.3 `spendResource()` — refuse with `null` when short; no-op by identity on a zero amount.
- [x] 3.4 `isAftermathPhase()` / `isLifeSupportPhase()` — predicates only, writing no phase.
- [x] 3.5 `engine/tickEngine.js`: **append** `nextColonyThresholdClock` to
      `EVENT_CLOCK_CONTRIBUTORS`. `findNextEventClock()`'s body untouched.
- [x] 3.6 `engine/tickEngine.js`: call `integrateColony()` beside `creditIncome()` inside the
      `step > 0` guard, with the two-paths comment.

## 4. Prove it under `node` (the harness IS the acceptance check)

- [x] 4.1 Extract the real pre-change `tickEngine.js` from `master` as the comparison baseline —
      not a hand-copied approximation. **Removed from `src/` before commit**; nothing test-shaped
      ships in this repo.
- [x] 4.2 Freeze `Date.now()` and seed `Math.random` before any `require`. Patch
      `utils/randomUtils.js`'s `generateId` — its counter is module-level, so building the same
      fixture twice yields different ids and would read as a real divergence.
- [x] 4.3 **Zero-module parity.** 8h `advance()` deep-identical to the baseline; `expedition`
      reference-identical; a pre-slice save still has no `expedition` key; contributor abstains.
      **5/5.**
- [x] 4.4 **Solve vs external oracle.** PRD §5.6 example B, built from its equations. Passes 1–3
      reproduce exactly; engine matches an independent re-derivation to 1e-12; 16 passes lands
      0.02% from the closed form; non-increasing on every pass. **17/17.**
- [x] 4.5 **Boundary correctness.** Zero-crossing and cap-crossing fixtures, chunked vs stepwise at
      dt=1s and dt=0.01s, both against a hand-computed closed form. Chunked exact; residual bounded
      by one dt of the rate jump and shrinking 100x/120x. **14/14.**
- [x] 4.6 **Mutation test.** De-register the contributor and confirm the answer breaks — 4x wrong
      and 40% under-credit. Without this the boundary test could pass vacuously.
- [x] 4.7 **Over-committed colony, 8h.** Net-negative on all three consumables (asserted, after the
      first attempt turned out to be net-positive on Provisions). No resource outside
      `[0, capacity]`, no module removed, no currency negative, full clock, recoverable. **29/29.**
- [x] 4.8 **Malformed and hostile stored state** — 23 cases (negative/over-cap/NaN/string/Infinity
      amounts, NaN/negative/Infinity capacities, null records, missing maps, NaN/negative/Infinity
      module counts, unknown ids, a non-array `modules`). **Found a real bug**: `normalizeResource()`
      defaulted `amount` with `|| 0`, which passes a string through to `Math.max` as `NaN` and, via
      this change's new read path, freezes `advance()`'s clock permanently. Fixed with
      `Number.isFinite`. **72/72.**
- [x] 4.9 **Record the measured bounds as comments** in `engine/colony.js`: iteration bound 5 vs
      `safetyCapIterations` 2,000; convergence bound 16 passes; the chunked-vs-stepwise table.
- [x] 4.10 `npm run build`.

## 5. Not done here, deliberately

- [ ] 5.1 The module catalogue (PRD §8) — each row lands with the story that prices it.
- [ ] 5.2 Site production/draw terms — `engine/sites.js`. Seams commented in place.
- [ ] 5.3 Contract upkeep summed into `demand` — `engine/contracts.js`. Seam commented in place.
- [ ] 5.4 §5.9's six `BONUS_KEYS` and their clamps — the powerup story. Defaulted reads are in place.
- [ ] 5.5 `reclaimersPerSecond()` into `engine/income.js` — Salvage is a currency, its own story.
- [ ] 5.6 `expedition.phase` writes and the predicate ladder — `engine/sites.js` is the single writer.
- [ ] 5.7 `resetForPrestige()` spreading `expedition` — flagged in proposal.md, owned by whoever
      owns the Act VII prestige rules.
