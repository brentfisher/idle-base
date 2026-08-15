## 1. The authored content

- [x] 1.1 Create `src/data/actSevenPuzzlesConfig.js` with the nine artifacts of PRD §8.3, using the
      player-facing strings verbatim: prompts, accept lists, `near[]`/`wrongKind[]` responses, three
      hint tiers each, `unlocksLabel` and `ignoredLabel`.
- [x] 1.2 Author a `promptTranslated` for the eight artifacts carrying program vocabulary, changing
      no number and no answer. Omit it on the one artifact written in plain words, with a comment
      saying the fallback to `prompt` is the intended behaviour rather than an oversight.
- [x] 1.3 Author `FEEDBACK_LINES` as a flat `lineId -> string` map: five generic code lines,
      per-input-kind lines including the two directional pairs and the positional-count template,
      and sixteen per-puzzle overrides.
- [x] 1.4 Record `answer.tolerance` on every numeric artifact together with the reading ambiguity it
      absorbs — 1 on the manifest for "drawn on" versus "empty after", 0.05 on the gauge for `4`
      against `4.0`, and 0 on the certification plate because there is no ambiguity to absorb.
- [x] 1.5 Author `PUZZLE_ITEMS` with each effect as a declared key (`freeHintTier`,
      `freeHintPuzzles`, `translatesPrompts`, `cooldownMultiplier`, `readoutPuzzles`,
      `enablesSimulate`), so no item id ever appears in the engine.

## 2. Pricing, derived and recorded

- [x] 2.1 Bake `HINT_COSTS` and every item cost from §8.4's formula —
      `round2sf(HINT_TIER_SECONDS[t] x R(phase))` and `round2sf(ITEM_MINUTES x 60 x R)` — with the
      formula beside them as a comment and `HINT_TIER_SECONDS` as the only authored numbers.
- [x] 2.2 Recompute `R(phase)` from §5.2's FINAL bands per ledger R8 (8.4 / 34.2 / 99.5 / 445 / 900
      floor) rather than from §8.4's printed column, which was derived against §5's draft bands.
      Record that §8.4's table is stale and that §5.2 is the input to any regeneration.
- [x] 2.3 Cross-check the regeneration by comparing the resulting per-phase sink shares against the
      shares §8.6 authored independently, and record the four agreements (12.4/22.3/8.1/10.5%
      against 15.3/22.7/8.2/11.8%) as evidence the recompute is the intended one.
- [x] 2.4 Record the total claim on the graded phases (297,034 against 2,812,600 = 10.6%) against
      §8.6's 8-15% band, excluding the final artifact's ladder as post-critical-path.
- [x] 2.5 Reconcile against STORY-025's measured surplus, which that story asked the §8 implementer
      for by name: what the catalogue is worth in wall time at each phase's measured rate, how much
      of the early exit it closes, and how far the R6 lever actually reaches before it breaks
      §8.6's band.

## 3. The engine

- [x] 3.1 Create `src/engine/puzzles.js`, pure — no React, no DOM, no `Date.now()`, no
      `Math.random()`, and no `rng` parameter, because nothing in this system is random.
- [x] 3.2 Write `puzzleState()` tolerating `state.expedition` being absent ENTIRELY, defaulting
      `nextAttemptAtClock` to 0 so absent reads as ready, and coercing a non-numeric stored count
      to its default rather than propagating it.
- [x] 3.3 Implement `normalize()` per §8.8, and a SEPARATE `parseNumber()` — `normalize()` strips
      periods and commas, which is right for prose and would turn `4.0` into `4 0`. Comment why the
      two are not a duplication.
- [x] 3.4 Implement the three comparators by `inputKind`: number (direction at every distance),
      sequence (positional count, unknown-token check first), word (accept, then near, then
      wrongKind).
- [x] 3.5 Implement `answerFeedback()` returning `{ code, lineId, detail }` — a code and a key,
      never a composed string — with a fallback chain ending at the generic line for the code.
- [x] 3.6 Implement `checkAnswer(puzzleId, input)` taking an id and never an accept list.
- [x] 3.7 Implement `submitAnswer()` refusing rather than throwing on unknown id, resolved puzzle
      and live cooldown, and `attemptBruteForce()` as an alias passing a null input — one code path,
      two labels.
- [x] 3.8 Implement `attemptCooldownSeconds()` composing item multipliers by product, and
      `attemptCooldownRemaining()` with the clamp lifted from `engine/clicker.js`.
- [x] 3.9 Implement `buyHint()` and `hintCost()`, with a free tier still passing through
      `engine/wallet.js` as a zero debit rather than taking a second path.
- [x] 3.10 Implement `listPuzzles()` in the shop-contract shape, with `text: null` on every unbought
      hint tier and unrevealed artifacts omitted rather than disabled.
- [x] 3.11 Implement `listInstruments()` / `buyInstrument()` in the house shop contract, storing
      ownership as `progression.milestones['puzzleItem:' + id]` — NOT in `expedition.puzzles`, whose
      guard would accept a stray non-puzzle key.
- [x] 3.12 Implement `simulateAnswer()` returning null unless an owned item enables it, recording no
      attempt, consuming no attempt cooldown, and carrying its own `nextSimulateAtClock`.
- [x] 3.13 Implement `solvedUnaided()` (id optional) and `aptitudeSummary()` so that nothing outside
      this file reads `state.expedition.puzzles` directly.
- [x] 3.14 Write the two resolution milestones — `puzzle:<id>` on solve OR bypass, `puzzleSolved:<id>`
      on solve only — through a progression writer guarded on both read and write.

## 4. The wake boundary

- [x] 4.1 Implement `nextPuzzleCooldownClock()` deriving each candidate from the clamped remaining
      wait and keeping only strictly positive ones, so the 0-return that would pin `advance()`'s
      step is unreachable despite the stored deadline defaulting to 0.
- [x] 4.2 Append it to `EVENT_CLOCK_CONTRIBUTORS` in `src/engine/tickEngine.js` — an append, not an
      edit to `findNextEventClock()`'s body — with a comment recording that it is a UI-wake boundary
      and that nothing in `advance()` writes `expedition.puzzles`.

## 5. Measurement

- [x] 5.1 Build a `node` harness driving the SHIPPED engine for every per-puzzle figure: mash the
      brute-force path against a synthetic advancing clock and read the instant `bypassed` flips out
      of `listPuzzles()`, rather than computing `attempts x cooldown` in the harness.
- [x] 5.2 Measure the brute-force ratio over 30 runs with a deterministic injected rng and phase
      durations sampled inside §5.2's bands. Report BOTH §8.7's blocking-fraction metric and an
      all-blocking upper bound, and name which is the gate.
- [x] 5.3 Measure the same at §8.3's authored counts for comparison, on the same code path.
- [x] 5.4 Bring `attemptsToBypass` to 5/5/6/6/6/6/7/4/10 and record in the tuning block that the
      authored counts ALSO clear 1.3 — that the reduction buys margin against four estimated
      coefficients rather than fixing a failed measurement.
- [x] 5.5 Itemise the eight blocking coefficients with the source of each, and flag the four that are
      estimated pending §7's launch ladder as requiring re-measurement by that story.
- [x] 5.6 Verify the per-phase share constraint (bypass wall time <= 50% of the phase's authored
      duration) and record the measured shares.
- [x] 5.7 Measure the crossover at which submitting beats testing on a numeric artifact, confirming
      neither strictly dominates.
- [x] 5.8 Drive `nextPuzzleCooldownClock()` under three states — no expedition at all, a stale past
      deadline, a live deadline — plus a stale overlong deadline, confirming it returns Infinity or
      a value strictly greater than the clock and never 0.
- [x] 5.9 Verify all five feedback codes are reachable, every accept-list variant is accepted, all
      three routes are open on all nine artifacts at a zero balance, and every refusal path returns
      null.

## 6. Gate

- [x] 6.1 `npm run build` passes.
