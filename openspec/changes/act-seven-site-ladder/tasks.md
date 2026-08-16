# Tasks — the site ladder, colonization, launch pads and the phase writer

## 1. The ladder (data/actSevenSitesConfig.js)

- [x] Author §7.1's five rungs: Home Plate, the On-Deck Circle, First Base, Second Base, and Third
      Base — the Warning Track.
- [x] Each carries `rung`, `upkeepFactor`, `baseUpkeep`, `departingThreshold`, colonize cost and
      window, and its capability flags.
- [x] Home Plate is `reachedAtStart` + `colonizedAtStart` with `startingPadTier: 1`, so a fresh save
      needs no stored record at all and the act's first Salvage sink is a module, not a pad.
- [x] Home Plate produces a flat 2.0 O2/s — the only site production term in the act, unthrottled
      and unmultiplied, because a planet does not throttle back because your tank is full.
- [x] Author §7.2's five pad tiers with the reach each buys, and narrow buildability to **one tier
      per rung** (a tier-N pad sits on rung N-1).
- [x] Derive `fuelCapacityOnArrival` as `1.6 × departingThreshold` rather than authoring it, so
      §7.3's overshoot band cannot drift apart from the thresholds it is a multiple of.
- [x] Derive a pad's effective upkeep as tier upkeep × the site's `upkeepFactor`.
- [x] Recompute the Salvage costs against STORY-025's measurement, holding §7.5's minutes-of-income
      intent rather than copying ledger R2's estimate-derived table.
- [x] Preserve the Warning Track's inversion — 6.0 minutes to establish against a 6.0 `upkeepFactor`
      to sustain.

## 2. The record and its resolution (engine/colony.js)

- [x] `resolvedSites()` — one resolved record per **configured** site in ladder order, joined to
      whatever the save holds, so a reordered `sites` array cannot change the rung ordering.
- [x] Store six fields only; resolve rung, upkeep, production, flags and the Fuel grant from config
      on every read.
- [x] Read the three boolean fields with `=== true`, so corruption cannot silently colonize a site.
- [x] Treat a `buildingId` with no finite `readyAtClock` as idle, turning a corrupt save into a lost
      build rather than a permanently occupied rung.
- [x] Gate on the `ops` feature, so pre-Act-VII saves get `[]` and no caller needs its own act check.
- [x] Fold site upkeep and site production into the ration; scale pad upkeep by `upkeepFactor`.
- [x] Widen `nextColonyThresholdClock`'s abstention to "no modules **and** no sites".

## 3. The shop (engine/sites.js)

- [x] `listSites()` — every site resolved, for §6's panel. Distinct from `listOffers()`: "where am
      I" versus "what can I buy right now", and neither is derivable from the other.
- [x] `listOffers()` in the house shop contract, with cost, ownership and affordability already
      resolved so the panel recomputes nothing.
- [x] Offer id is `<buildingId>@<siteId>`, carrying the value that gets stored.
- [x] `purchase()` re-checks every gate through the same `candidateBuildFor()` the listing used, and
      returns null for a busy site, an illegal tier, an unaffordable row or a malformed id.
- [x] Debit through `engine/wallet.js`, so no currency can go below zero structurally.
- [x] Effect strings lead with the upkeep and are assembled from the config the solve reads.
- [x] Omit unavailable rows rather than disabling them.

## 4. Builds

- [x] One build per site (`buildingId`), collapsing colonization and pad windows into a single
      `readyAtClock` contributor.
- [x] `resolveBuilds()` completes every build whose window has closed and clears the slot.
- [x] **Idempotent by construction** — verified that a replayed call returns state by identity.
- [x] A completed pad reads its tier from the stored `buildingId`, never `launchPadTier + 1`.
- [x] An unrecognized `buildingId` grants nothing and is cleared rather than stranding the site.
- [x] `nextBuildClock()` on STORY-017's contributor list, returning `Infinity` when nothing pends
      and excluding overdue records so `advance()`'s step is never pinned at zero.
- [x] `markSiteReached()` exported for STORY-028, idempotent and identity-returning.

## 5. The phase writer (§7.7, ledger R4)

- [x] `engine/sites.js` is the **single writer** of `expedition.phase`; §5 supplies predicates and
      §6 reads the field, neither writes it.
- [x] Recompute from a pure predicate ladder each `advance()`, write only on a difference.
- [x] Scan **highest-satisfied**, not first-unsatisfied, so a non-nested save under-reports for one
      tick rather than permanently.
- [x] `lunar` turns on arrival (`reachedPhase`); `deepSpace` turns on launch commit (`commitPhase`),
      reading the log so the predicate stays monotone.
- [x] Phase boundaries are data — the writer is a loop over `EXPEDITION_PHASES`, naming no site id.
- [x] Abstain entirely when `resolvedSites()` is empty, so no `expedition` slice is materialised into
      the six acts that have no use for one.
- [x] `phaseRank` moved next to the phase list it indexes, so the act's three gates stop keeping
      private copies of one `indexOf`.

## 6. Reach

- [x] `siteReach()` reads the built pad tier alone — no resource, satisfaction or rate input.
- [x] Verified a starved network launches later, never shorter.

## 7. Verification

- [x] `npm run build` passes.
- [x] **1.6× tank floor holds at all five sites** — 1,200→1,920, 4,200→6,720, 13,500→21,600,
      21,000→33,600, 42,000→67,200.
- [x] **One pad tier per rung**, no gaps or overlaps; the top pad reaches rung 5, past the end of the
      ladder, which is §7.1's "beyond the wall is not a site".
- [x] **Home Plate's Fuel grant is withheld until a tank is owned** — 0 capacity at act start, 2,320
      on the first 400-unit Bladder (its 400 plus Home Plate's 1,920, arriving together on the
      purchase ledger R1 says should carry them).
- [x] `resolveBuilds()` idempotent by identity; `nextBuildClock()` returns `Infinity` before Act VII
      and with nothing pending, never 0.
- [x] The phase writer heals a save hand-edited to `majors` back to `lunar`, and returns identity
      when the stored phase is already correct.
- [x] `writeExpeditionPhase()` returns a fresh Act I save by identity, materialising no slice.
- [x] `purchase()` refuses a busy site, an illegal tier and a malformed offer id, each with null.
- [x] Colonize → pad flow end to end: `colonize@onDeck` (9,000 Salvage, 180s) resolves to
      `colonized`, then `padTier2@onDeck` builds and reach becomes 2.
- [x] Every name added passes `data/actSevenNamingConfig.js`'s prohibition — all are terms the sport
      already owns.

## 8. Deferred, with the reason recorded in the config

- [ ] **Minutes-of-income measurement — owed by STORY-028, not by this change.** Every purchase this
      change prices happens in `lunar` or later; a site is reached only by a launch, and launches are
      STORY-028. `listOffers()` correctly returns zero rows for the whole of `aftermath` and
      `lifeSupport`, so measuring here would mean synthesising the arrival times being priced
      against. Ledger R8 puts later stories on the measurement; STORY-028 is the first branch on
      which this ladder can be played at all.
