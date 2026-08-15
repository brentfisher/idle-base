# Specs — Act VII `aftermath` economy

## 1. The click

**`data/acts.js`** — Act VII's `rules` declares `clickCurrency: 'salvage'`,
`clickLabel: 'Sift the wreck'`, `clickFlatValue: 8`, `clickCooldownSeconds: 3`. No
`clickMultiplier`: it would be dead config, because the flat value replaces the
calculation rather than scaling it.

**`engine/clicker.js` — `clickValue(state)`**

```
flat = actClickRules(state).clickFlatValue
if typeof flat === 'number' && isFinite(flat) && flat > 0  →  return flat
otherwise                                                  →  return max(1, perClick × scale)   [today's behaviour]
```

- The guard is a strict `typeof`, not `Number()` coercion — matching
  `clickCooldownSeconds()` and `clampStake()` in `engine/wallBall.js`.
- **Acts I–VI must be bit-identical.** No act before VII declares `clickFlatValue`, so
  the early return never fires and `perClick` is neither read nor written on that path.
- The press pays **2.667 Salvage/s** (8 ÷ 3s) for every player, regardless of `perClick`.

## 2. The module catalogue

**`data/actSevenModulesConfig.js`** — `cost(n) = round(baseCost × growth^n)`, `n` = copies
already owned. Rounded at the boundary so the row, the affordability check and the debit
all see the identical integer.

| id | Label | Phase | Base | Growth | Produces | Consumes |
|---|---|---|---|---|---|---|
| `reclaimerDrone` | Reclaimer Drone | `aftermath` | 320 | 1.34 | 3.0 Salvage/s | 1.5 power, 0.10 provisions |
| `rtg` | Radiothermal Slug | `aftermath` | 90 | 1.18 | 3.0 power/s | — |
| `scrubberMkI` | Sabatier Scrubber | `aftermath` | 120 | 1.28 | 0.35 oxygen/s | 1.0 power |
| `rationPrinter` | Ration Printer | `aftermath` | 150 | 1.28 | 0.25 provisions/s | 1.2 power |

- Salvage output uses the key **`producesSalvage`**, never `produces.salvage`.
- Every rate, cost and growth exponent lives here. **No magic numbers in engine or components.**
- `EXPEDITION_MODULES` in `data/actSevenConfig.js` is this array, not a second copy.

## 3. The Salvage rate

**`engine/colony.js` — `colonyRates(state, modifiers)`** gains one additive return key:

```
salvage = Σ over owned modules:  count × producesSalvage × throughputOf(def, satisfaction)
                                       × loadFollowOf(def, supplyThrottle)
```

- Existing keys (`satisfaction`, `supplyThrottle`, `gross`, `demand`, `net`, `capacity`,
  `passes`) are **unchanged in name, shape and value**. `salvage` is additive so
  `listResources` (STORY-023) can wrap this return unaffected.
- No output multiplier is applied: `OUTPUT_MULTIPLIER_KEYS` is keyed by resource id and
  Salvage is not a resource. A Salvage powerup is a wallet-side bonus in
  `data/modifierKeysConfig.js`, not a term here.
- **A starved drone must not pay full income.** Throttling by the solved ration is what
  makes the Power/Provisions interlock real rather than decorative.

## 4. The income contributor

**`engine/income.js` — `salvagePerSecond(state, modifiers)`**, added to
`totalIncomePerSecond`'s returned bundle as `salvage`.

- Returns `0` unless the `ops` feature is unlocked, checked via
  `getUnlockedFeatures(progression.act, expeditionSlice(state).phase)`.
- When unlocked, returns `colonyRates(state, modifiers).salvage` — read, not re-summed.
- Non-finite guards to `0`.

## 5. The shop contract

**`engine/actSevenModules.js`**, modelled on `engine/lotShop.js` ↔ `components/lot/LotShop.js`.

`listOffers(state)` → rows of
`{ id, name, description, effect, cost, currency, count, owned, affordable }`

- Cost, ownership and affordability are **already resolved**; the panel recomputes nothing.
- `count` is a quantity (every module is repeatable); `owned` is `count > 0`.
- **Unavailable rows are omitted, not disabled** — locked features are never rendered in
  this game.
- `effect` is assembled from the module's own rates, so the shop cannot advertise a
  number the engine does not honour.

`purchase(state, moduleId)` → new state, or **`null` for refused**: unknown id, phase not
reached, or unaffordable. The debit goes through `engine/wallet.js`, so no currency can go
below zero structurally.

**Availability** is a rank comparison against `EXPEDITION_PHASES`, and **fails open at both
edges** — a row with no phase and a run with an unrecognized phase both reveal everything.

## 6. Measurements (required deliverable, recorded in `actSevenModulesConfig.js`)

| Metric | Target | Measured | |
|---|---|---|---|
| Pure clicking to first automation | 90–130s | **118s** | ✅ |
| Salvage/s at minute 10 | — | 15.0/s | |
| Salvage/s at `aftermath` exit (min 25) | §5.2 band 2.7→26 | 33.0/s | ~27% hot — partial ladder |
| Click share at minute 10 | <5% | 15.1% | ❌ unreachable, see below |
| Click share at phase exit | §5.2 "~10%" | 7.5% | ✅ |
| Flat point → relieving unlock | ~5 min | 191s gap, RTG inside ~90s | ✅ |

**The <5%-at-minute-10 target is unreachable and was not chased.** It requires >50/s at
minute 10 against §5.2's authoritative 26/s for the whole phase's *exit*. §5.2's own prose
("~10% at that phase's exit") is the figure this ladder is judged against, and 7.5% sits
inside it. Recorded in the config comment rather than silently missed.

**The exit rate runs hot because the ladder is deliberately partial** — §5.3's compulsory
spend includes storage rungs and scrubbers this change does not ship, so the simulated
colony buys fewer things and banks more. Ledger R8 says later stories recompute against
the measurement; the storage story must **re-measure**, not trust this line.

## 7. Backward compatibility

- No save migration. `expeditionSlice()` already tolerates a missing slice.
- With no modules owned: all rates solve to 0, `integrateColony` returns its input by
  identity, `salvagePerSecond` returns 0 without running the solve.
- Acts I–VI: no behavioural change on any path.
