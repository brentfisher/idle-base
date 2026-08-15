# Tasks — the full module ladder, the interlock, and derived capacity

## 1. The ladder

- [x] Add PRD §5.4's remaining producers: Wreck Crawler, Orbital Sieve, Fission Pile, Solar Wing,
      Fusion Ring, Cascade Scrubber, Ice Harvester, Hydroponics Bay, Algae Column, Spun Drum Farm,
      Electrolysis Stack, Cracking Tower, ISRU Plant.
- [x] Each declares production **and** consumption; the Pile/Bay/Scrubber trio closes the cycle
      that makes the ration a genuine fixed point.
- [x] Add the nine storage rows — capacity only, no rate, steeper growth than any producer.
- [x] Correct STORY-024's header note that the Sabatier Scrubber is inert: the Hydroponics Bay eats
      Oxygen, so from `lifeSupport` the Oxygen chain is load-bearing.

## 2. Derived capacity (ledger R1)

- [x] `colonyCapacity(slice, owned)` in `engine/colony.js`: base + owned storage grants, plus the
      site term for Fuel.
- [x] Called **before** the solve — the ceiling is an input to `loadFollowThrottles`, so deriving it
      after would throttle this tick against last tick's ceiling.
- [x] The site term sums over an empty list until STORY-027, written now on purpose.
- [x] Verify the stored ceiling is ignored: a save claiming 99,999 Power capacity with one Buffer
      Cell derives 350.
- [x] Verify grants for all four resources, single and multiple copies, tier-1 and tier-2.

## 3. The two gates

- [x] `requires: { moduleId: count }` — the spend gate, on `fuelBladder` and `electrolysisStack`.
- [x] `requiresSiteCapability` — the colonization gate, on `solarWing` and `iceHarvester`.
- [x] Both enforced in `purchase()` as well as `listOffers()`.
- [x] Verify 6 Piles / 7 Bays hides both gated rows and refuses both purchases; 7 / 7 opens them.
- [x] Verify a site declaring `vacuumSolar` opens the Solar Wing but **not** the Ice Harvester.
- [x] Storage rows render their grant without a `/s` suffix — "+250 max power", never "+250 power/s".

## 4. Measurement

- [x] Continuous run through `aftermath` and `lifeSupport`, buyer subject to every gate.
- [x] **The pacing control**: requires-gate opens 38.1 min into `lifeSupport`, first Fuel Bladder
      bought at 39.4. Requirement is "not before ~35" — met, and late is the safe direction.
- [x] **Solve convergence against the real ladder**: worst 16 passes, i.e. stops on the cap rather
      than on epsilon. Confirms `SOLVE_MAX_PASSES` is correctly sized.
- [x] **Starvation**: ration 0.200, Salvage 30.00 to 6.00/s, net pinned to 0, modules intact after
      1200s; one printer strictly improves (0.228 / 6.83), 29 fully restore.
- [x] **Affordability as an integral**, not threshold divided by rate.
- [x] Publish all of it as a tuning block in `actSevenModulesConfig.js`.

## 5. Gate

- [x] `npm run build` passes with no errors.

## Recorded, not fixed

- [ ] **Phases run fast and `lifeSupport` earns 2.6x its §5.3 budget** (aftermath 14.6 min vs the
      authored 20-30; lifeSupport 40.2 vs 45-60; 285,218 earned vs 108,200 budgeted). Deliberately
      not retuned: §5.3 is a consistency check and says so, the buyer is optimal so these are upper
      bounds, and the elastic §8 catalogue that would absorb the surplus does not exist yet. **The
      story that lands the artifact and instrument sinks must re-measure before anyone moves a cost
      here** (ledger R8).

## Out of scope

- [ ] The Fab panel that renders these rows — this change ships the data and the engine contract.
- [ ] Sites, colonization and the Fuel site grant (STORY-027). Two rows ship priced but unbuyable
      until it lands, and the Fuel capacity formula's second term sums over an empty list.
- [ ] Generation powerups (STORY-026) — `OUTPUT_MULTIPLIER_KEYS` remain inert.
- [ ] `lunar` and `deepSpace` pacing. Their rows are priced from §5.4 but were only reachable in the
      harness by injecting a site, so their durations are **not** measured here.
