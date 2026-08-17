# Tasks — the contract board and the fuel side quests

## 1. Config and prose

- [x] New `data/actSevenContractsConfig.js`: the twelve contracts across five kinds, every string
      the board renders, and every number the engine reads.
- [x] Payouts declared as `payoutPct` on the 5% / 7.5% / 11% ladder, never as absolutes.
- [x] `createContractBoard()` — ONE base literal, imported by `initialState.js` and by
      `expeditionSlice()`, returning a fresh object per call.
- [x] `contractDrawFor(id)` — the draw table, a config lookup in the `padUpkeepAt()` shape. Two
      forms: a flat crew bundle, and a fraction of gross-at-full-output for Rain Delay.
- [x] Every tuned number carries its measurement.

## 2. `engine/colony.js`

- [x] `expeditionSlice()` gains `contractBoard`, defaulted field-by-field: `Number.isFinite` for
      `nextOfferAtClock` (0 is legitimate), `Array.isArray` for `completedIds` / `missedIds`.
- [x] `contractUpkeepPerSecond(state)` implemented here — the cycle argument, and the
      `resolvedSites()` precedent, recorded in a comment.
- [x] Summed into `demandAtFullOutput()` at STORY-027's named landing site, `* drawMult`, BEFORE
      `solveSatisfaction` and therefore before `nextColonyThresholdClock` solves.
- [x] AND into `actualDraw()`, without load-follow, so the draw actually moves the stock. The
      pre-existing gap in the SITE term is measured and recorded at the call site, not fixed.
- [x] New `creditResource(state, id, amount)`: refuses with `null` when the credit would exceed the
      DERIVED ceiling, mirroring `spendResource()`.
- [x] `isExpeditionLive` exported, so the contract board takes the same act gate site terms take.

## 3. `engine/launch.js`

- [x] `currentLaunchThreshold(state)` exported — the threshold of the launch being filled (ledger
      R3), read from the existing `currentLeg()` rather than reimplemented.

## 4. `engine/contracts.js`

- [x] New, pure. No React, no DOM, no `Date.now()`, no bare `Math.random()`.
- [x] `listOffers` / `accept` / `claim` / `abandon` / `refreshBoard` / `advanceContracts` /
      `contractUpkeepPerSecond` (re-export) / `nextContractEventClock`.
- [x] Rows fully resolved: `effect`, `progress`, `expiresInSeconds`, `acceptable`, `claimable`,
      `refusal`. The panel recomputes nothing.
- [x] Board seeded from `(phaseRank, floor(clock / OFFER_ROTATION_SECONDS))` via a local mulberry32;
      `rng = Math.random` defaulted and used only for PTBNL's draw, once, at accept.
- [x] Only unaccepted offers expire; a lapse or a void pushes the id into `missedIds` and returns as
      a Makeup Game at the same payout with a doubled window.
- [x] `claim()` returns `null` on overflow against `colonyRates(state).capacity.fuel`; nothing is
      lost and the contract stays claimable.
- [x] `claim()` is atomic: a delivery's debit and its credit happen in one returned object.
- [x] Payout-once: `claim()` moves the id into `completedIds` and removes the instance together.
- [x] Refusal is `null` from the engine; a no-op returns the identical object.
- [x] Every entry point abstains outside a live Act VII expedition.

## 5. The tick loop

- [x] `nextContractEventClock` APPENDED to `EVENT_CLOCK_CONTRIBUTORS`; `findNextEventClock()` not
      touched.
- [x] Returns `Infinity` when nothing is pending, never 0. Past-due boundaries excluded. Every
      candidate `Number.isFinite`-guarded.
- [x] Abstains when the board is full — a refresh only fills empty slots.
- [x] Paired with `advanceContracts()` in the loop body, then `refreshBoard()` after it so a lapse
      refills its slot on the same iteration.
- [x] `advanceContracts` receives the rates sampled BEFORE `integrateColony()`, and the sample is
      only taken when there is an active contract to sample for.

## 6. Reducer

- [x] `ACCEPT_CONTRACT` / `CLAIM_CONTRACT` / `ABANDON_CONTRACT` in `actionTypes.js`.
- [x] `state/actions/contractActions.js` — `null` from the engine becomes unchanged state.
- [x] `gameReducer.js` wired.
- [x] `ContractsPanel.js` and `data/feedMessages.js` deliberately NOT touched — STORY-040 owns the
      panel (as STORY-037/039 own the sites and launch panels, both still placeholders with their
      engines shipped), and nothing in this engine emits a feed entry.

## 7. Verification (driven under `node`, the repo's substitute for a test runner)

- [x] Pre-Act-VII save: every entry point returns state by identity, `nextContractEventClock` is
      `Infinity`, and no `expedition` key is materialised.
- [x] **AC #8 — the 40% ceiling:** every payout obtainable against every threshold summed,
      including PTBNL's largest draw, against 40%. Recorded in the config.
- [x] **AC #7 — 8-hour offline resolution:** sustain progress, a window closing, and an expedition's
      upkeep all resolved correctly across `advance(state, 28800)`, with the iteration count
      recorded against `safetyCapIterations`.
- [x] A replayed `advanceContracts` returns state by identity; a rerun of the same span is identical.
- [x] Overflow: `claim()` returns `null` with a full tank and pays after a launch empties it.
- [x] Upkeep ordering: an expedition contract moves `nextColonyThresholdClock` earlier and cannot
      push a resource below zero inside a step.
- [x] Seeded board: same state, same board; injected `rng`, same PTBNL draw.
- [x] `npm run build` passes.
