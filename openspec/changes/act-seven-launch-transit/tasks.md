# Tasks — launch commit, transit, arrivals and the overshoot

## 1. The engine

- [x] New pure `engine/launch.js` and `data/actSevenLaunchConfig.js`.
- [x] House shop contract: `listOffers`, `purchase` (commits the burn), `resolveArrivals`,
      `nextArrivalClock`, plus `overshootFor` for the panel to render the band.
- [x] `cost` is the threshold and is what `affordable` compares against; the whole tank is what
      committing dumps. The gap between them **is** the overshoot decision, not a discrepancy.
- [x] Thresholds read from `departingThreshold`; nothing restated.
- [x] Fuel debited via `colony.spendResource` — not `engine/wallet.js`.
- [x] Arrival calls `sites.markSiteReached()`; this file never writes a site record.
- [x] Launch records carry `destinationSiteId` and `resolved`, matching the shape
      `sites.launchCommitGrants()` already reads for the `deepSpace` predicate.
- [x] **No rng in the launch path.** A launch cannot fail.
- [x] One launch in flight; a single refusal check.

## 2. The tick loop

- [x] `nextArrivalClock` appended to `EVENT_CLOCK_CONTRIBUTORS`; nothing above the line touched.
- [x] Returns `Infinity` when nothing is pending, never 0.
- [x] `resolveArrivals` in the loop body, **before** `writeExpeditionPhase` — an arrival is the input
      to the `lunar` predicate.

## 3. Verification (driven under `node`, the repo's substitute for a test runner)

- [x] Pre-Act-VII save: `nextArrivalClock` returns `Infinity`, no slice materialised.
- [x] Below threshold: the offer lists but is not affordable.
- [x] At threshold (1,200 Fuel): commits, tank goes to 0, record is `resolved: false` with
      `arrivesAtClock` 180s out.
- [x] Second commit while in flight is refused with null.
- [x] **Overshoot is deterministic**: 1,920 Fuel (1.6x) buys a 137s transit against 180s at the
      exact threshold, and committing the same state twice yields the identical arrival clock.
- [x] Arrival marks `onDeck` reached; a replayed `resolveArrivals` returns state **by identity**;
      `nextArrivalClock` returns to `Infinity`.
- [x] The phase writer lands on `lunar` after arrival.
- [x] An 8h `advance()` crossing the arrival resolves it **exactly once**, and a rerun over the same
      span is byte-identical — the no-rng guarantee, observed rather than asserted.
- [x] `npm run build` passes.

## 4. The measurement STORY-027 deferred here

- [x] Harness at 1s resolution through the real `advance()`, clicking every cooldown and driving the
      module shop, the site shop and this engine — the buyer subject to every gate a player is.
- [x] Seven of eight rungs measured; the run reached `deepSpace` with all five sites reached.
- [x] **Every rung comes in cheap: 0.88–2.25 measured minutes against 3.3–10.0 intended.** Recorded
      in `data/actSevenSitesConfig.js`, **not retuned** — the house rule 024 and 025 both followed.
- [x] Diagnosis recorded: this is ledger R2's error one layer down. 027 re-derived against 025's
      measurement, but 025 measured `aftermath`/`lifeSupport` and every row here is bought in
      `lunar` or later, where income has compounded ~30x.
- [x] **Bias direction stated**: this buyer is competent, not optimal, so a faster player sees
      *more* minutes than the table. The figures are a **lower** bound.
- [x] The Warning Track's cheap-to-establish / ruinous-to-sustain inversion confirmed intact.

## 5. Owed to a later story, not done here

- [ ] **An optimal-buyer run to the win condition.** `padTier5` was not reached inside the 16h
      horizon and the run was still in `deepSpace`. That is not a finding against §12 criterion 8's
      5-hour ceiling, because this buyer is not optimal and the horizon is not a completion time —
      but nobody may claim the ceiling holds until such a run exists. **STORY-032** (the win
      condition) is where it lands.
- [ ] Retuning the cost ladder against the measurement. Deliberately not done: the gap is real but
      its size is unsettled while the buyer is sub-optimal, and retuning against a lower bound would
      move the numbers in a direction the next measurement could contradict.
