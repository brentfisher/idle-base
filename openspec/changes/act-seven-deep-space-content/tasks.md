# Tasks — `deepSpace` content, and the site upkeep nobody was paying

## 1. The engine correction

- [x] `actualDraw()` in `engine/colony.js` charges site upkeep: `+ drawMult × siteUpkeepPerSecond(sites)`.
- [x] Scaled by `drawMult`, matching `demandAtFullOutput()`; **not** load-followed — a site has no
      `produces` map and a pad does not back off because a silo is full.
- [x] Signature widened to `actualDraw(owned, drawMult, throttles, sites)`; one call site, in
      `colonyRates()`.
- [x] Merge note written **at the site term**, naming the merged order with PR #34's `contractDraw`:
      `actualDraw(owned, drawMult, throttles, sites, contractDraw)`, both terms taken, both scaled by
      `drawMult`, neither load-followed.
- [x] No new engine module. `engine/sites.js` and `engine/launch.js` are already rung-agnostic and
      needed nothing.

## 2. Content — verified present, nothing added

- [x] Ceres (`secondBase`, `upkeepFactor` 3.0, baseUpkeep 14/9/6) — already authored by STORY-027.
- [x] The Warning Track (`thirdBase`, `upkeepFactor` 6.0, baseUpkeep 30/20/14) — already authored,
      with **no `produces` key at all** rather than an empty one, and the cheap-to-establish /
      ruinous-to-sustain inversion argued in place.
- [x] Pad tiers 4 (The Cutoff, 216,000 Salvage, 600 s, 14/4) and 5 (The Swing, 560,000 Salvage,
      720 s, 40/12, `reachesRung: 5`) — already authored.
- [x] Ceres's "produces that nowhere else does" gate confirmed: `drumFarm` carries `phase: 'deepSpace'`
      and Ceres carries `commitPhase: 'deepSpace'`, so the phase is the gate and no
      `requiresSiteCapability` flag is needed.
- [x] **No authored number in `data/actSevenSitesConfig.js` was changed by this story.**

## 3. Measurement — AC #4, can the network pay for The Swing

- [x] Site upkeep summed at full build-out: **343.8 Power/s, 34.5 O₂/s, 110.9 Prov/s** — ~15% above
      §7.2's own "roughly 300 and 100" target.
- [x] Sustaining build-out found by a deterministic greedy sizer (33 steps): 11 Fusion Ring, 7 Spun
      Drum Farm, 13 Ice Harvester, 2 ISRU Plant, 2 Cryo Farm — 1,069,856 Salvage, **net Fuel +28.0/s
      at satisfaction 1.000 on all four**.
- [x] Corroborated in a full 30 h run through the real `advance()`: `padTier5@thirdBase` bought at
      minute 1,106.5 with satisfaction 1.000, and 1.000 for the whole post-Swing tail.
- [x] **DECISION: the upkeep table is NOT scaled down.** §7.2's conditional does not fire. Neither
      table moved — not the upkeep table, not a generator ceiling.
- [x] Recorded in `data/actSevenSitesConfig.js` and in `design.md` §2.

## 4. Measurement — AC #5, the final threshold against the post-Track rate

- [x] Verified structurally that **no `fuel` key exists in any site `baseUpkeep` or any pad
      `upkeep`**, across all five of each — so the Track reaches Fuel only through the ration.
- [x] Three-stage degradation measured: (a) 28.0/s → (b) 28.0/s, Power −42.0 → (c) 28.0/s, Power
      −285.8 with a **2.9-minute buffer runway**; satisfaction 1.000 at every stage.
- [x] Post-Track rate **28.00/s** measured, against §7.5's assumed 26.0 — above, so per §7.6 the
      slack goes to D-5 and **42,000 is held**.
- [x] **The integral, not the quotient**, as §7.5 demands, with which was measured recorded:
      quotient 25.0 min, integral **27.1 min** against a 27-minute intent, +8.4% (inside §7.5's
      stated 5–15% band).
- [x] `grep`ed for a restated threshold: 42,000 appears once, as `departingThreshold`. Nothing else
      restates it; `fuelCapacityOnArrival` derives from it.

## 5. Measurement — AC #6 and #7, flat points and dead air

- [x] `deepSpace` beat table recorded with each flat point and its relieving unlock, in
      `data/actSevenLaunchConfig.js`.
- [x] D-5's relief measured rather than asserted: The Swing is offerable the instant the Track's
      colonization completes and costs under 200 s of income at the rate measured there.
- [x] **D-6 commented as deliberately flat, in those words, with "do not fix this"** — §7.6 predicts
      the next reviewer will otherwise repair it.
- [x] Dead-air metric driven exactly as §7.6 specifies (all three shops, `findNextEventClock` > 120 s):
      **D-1…D-4 zero intervals over 2 min (PASS)**; D-5 worst 3.32 min (**miss by 1.3**); D-6 worst
      7.33 min (**excepted**).
- [x] D-5's miss diagnosed to §5's 1.14 growth exponent on a uniformly levelled portfolio, not to
      anything §7 authors. **Nothing retuned for it**, per §7.6's own remedy.
- [x] Both harness biases stated: spends to zero, and levels uniformly — the metric is maximised by
      doing both, so 3.32 min bounds a player who does neither.

## 6. Measurement — the §7.5 affordability delta

- [x] Delta shown to be exactly `drawMult × siteUpkeep`, with `drawMult = 1` because
      `lifeSupportDrawMult` is not in `BONUS_KEYS`.
- [x] Per-rung share-of-gross table recorded; **Oxygen is where it bites** (61.6% of gross at the
      Track-colonized stage), not Power.
- [x] The early bite recorded: Home Plate's free 2.0 O₂/s minus On-Deck's 1.5 leaves **+0.5**.
- [x] End-to-end ladder compared fixed vs pre-fix over 30 h: **0.4 minutes of drift**, with the
      reason recorded rather than left as a null result.
- [x] Written into `engine/colony.js` beneath the function it explains.

## 7. Gates

- [x] `npm run build` passes (3 pre-existing size warnings, no errors).
- [x] Harnesses left in `/tmp`, not committed — there is no test runner in this repo and adding one
      is its own change.
- [x] Nothing denormalized into a stored site record; upkeep stays config and applies to saves in
      flight.
- [x] No `Mult`-suffixed key introduced; nothing added to `BONUS_KEYS`.
