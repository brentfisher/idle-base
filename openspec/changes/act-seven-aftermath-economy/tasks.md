# Tasks — Act VII `aftermath` economy

## 1. The click

- [x] Wire `clickFlatValue` into `engine/clicker.js`'s `clickValue()` as an early return,
      guarded by a strict `typeof` + `Number.isFinite` + `> 0` check.
- [x] Rewrite the "ships INERT" comment in `data/acts.js` — it described the pre-change
      state and would have been a lie the moment this landed.
- [x] Verify Acts I–VI are unchanged: `clickValue` in Act I still returns `perClick`, and
      a `perClick` of 77 in Act VII still returns 8.

## 2. The catalogue

- [x] New `data/actSevenModulesConfig.js` with the four `aftermath` rungs from PRD §5.4,
      `moduleCost(definition, owned)` and `getModuleDefinition(id)`.
- [x] Use `producesSalvage` as a distinct key; document why it is not `produces.salvage`.
- [x] Populate `EXPEDITION_MODULES` in `data/actSevenConfig.js` from the new config rather
      than duplicating the rows.
- [x] Record that the Sabatier Scrubber is **inert until Oxygen has a consumer**, so nobody
      later "fixes" it by inventing a benefit.

## 3. The Salvage rate

- [x] Add `salvageFromOwned(owned, satisfaction, supplyThrottle)` to `engine/colony.js`,
      mirroring `grossProduction`'s throughput and load-follow terms.
- [x] Return it as an **additive** `salvage` key on `colonyRates`, leaving every existing
      key untouched so STORY-023's `listResources` wrapper is unaffected.
- [x] Confirm a starved colony pays 0 Salvage.

## 4. The income contributor

- [x] Add `salvagePerSecond(state, modifiers)` to `engine/income.js`, gated on the `ops`
      feature via `getUnlockedFeatures`, reading the rate off `colonyRates` rather than
      re-summing.
- [x] Add `salvage` to `totalIncomePerSecond`'s bundle.
- [x] Confirm no require cycle between `income.js`, `colony.js` and `progression.js`.

## 5. The shop

- [x] New `engine/actSevenModules.js` with `listOffers` / `purchase` in the house contract.
- [x] Availability as a **phase rank** comparison, failing open at both edges.
- [x] Route the debit through `engine/wallet.js`.
- [x] Confirm refusals return `null`: unknown id, unaffordable, one short of cost.
- [x] Fixed during review: `isAvailable` originally failed **closed** on an unrecognized
      phase, which would have emptied the act's only Salvage sink for a save one tick from
      self-repair.

## 6. Measurement (ledger R8)

- [x] Drive the config through `colony.js` + `clicker.js` under `node` with a buyer that
      purchases a Drone whenever the bus can feed one.
- [x] Record seconds of pure clicking to first automation — **118s**, target 90–130s.
- [x] Record click share at minute 10 and at the phase exit — **15.1%** and **7.5%**.
- [x] Identify the flat point and its relieving unlock — **191s gap**, RTG inside ~90s.
- [x] Publish all of it as a tuning comment in `actSevenModulesConfig.js`, including the
      unreachable <5% target and why it was not chased.

## 7. Gate

- [x] `npm run build` passes with no errors.

## Deliberately out of scope

- [ ] The storage ladder (Buffer Cell, Oxygen Tank, Ration Silo) — STORY-025, which owns
      capacity as a derived quantity. **It must re-measure §5.2's bands**, because the
      figures above are of a partial ladder and run ~27% hot at the phase exit.
- [ ] Tier-2+ rungs (Wreck Crawler, Fission Pile, Mk II scrubbers, hydroponics, Fuel chain).
- [ ] The panel that renders `listOffers` — this change ships the engine contract only.
- [ ] Generation powerups (`OUTPUT_MULTIPLIER_KEYS` stay inert) — STORY-026.
