# Act VII — the full module ladder, the interlock, and derived capacity

## Why

STORY-024 shipped four `aftermath` rungs against a deliberately empty later ladder. That phase
works, but it is not yet *the act*: a Reclaimer Drone eats Power, an RTG makes Power out of
nothing, and the whole thing is a one-way chain. `engine/colony.js` runs a Kleene iteration to a
fixed point for a graph that does not yet have a cycle in it.

**The act's actual game is that Power buys Provisions and Provisions buy Power.** From
`lifeSupport` onward:

- The **Fission Pile** makes Power and eats **Provisions** (staffing).
- The **Hydroponics Bay** makes Provisions and eats **Power and Oxygen**.
- The **Cascade Scrubber** makes Oxygen and eats **Power**.

There is no ordering of purchases that makes any one of them self-sufficient. That is why the solve
is a fixed point rather than a dependency walk, and this change is what finally makes that true in
the shipped game rather than only in a test fixture.

## What changes

| File | Change |
|---|---|
| `data/actSevenModulesConfig.js` | The rest of §5.4: 12 more producers, 9 storage rows, the measured tuning record |
| `engine/colony.js` | **`colonyCapacity()`** — every ceiling derived from base + owned storage (+ site grants for Fuel) |
| `engine/actSevenModules.js` | `requires` (a spend gate) and `requiresSiteCapability` (a colonization gate) |

## The decisions worth arguing about

**Capacity is derived, never stored (ledger R1).**

```
capacity[r] = base[r] + Σ owned storage grants  ( + Σ sites[].fuelCapacityOnArrival, for fuel )
```

The stored ceiling is now ignored. This is the rule `getUnlockedFeatures` already follows, and for
the same reason: a stored ceiling is a second source of truth, so retuning a tank's grant would
need a migration on a save format that has none. Derived, a balance edit lands on every existing
save on the next tick.

Ignoring the stored value is safe in the only direction that matters. Recomputing can produce the
same number (nobody owned storage, so the sum is the base) or a larger one (they did) — it cannot
silently shrink a ceiling under a stock already above it. Even a hand-edited save that managed it
would be handled: `integrateColony` clamps to `[0, capacity]` unconditionally, so the surplus is
discarded rather than becoming an impossible state.

**The Fuel site term is written now and sums over an empty list.** `slice.sites` stays empty until
STORY-027. Encoding one source today and discovering the second later is precisely how the draft
that R1 overruled gets rebuilt by accident.

**The first Fuel Bladder is a pacing control, not an economy row.** Fuel's base capacity is 0, so
until a tank exists Fuel cannot be banked *at all* — what 3,600 Salvage buys is Fuel accumulating,
which gates the entire launch system. §7.5 requires that not be reachable before ~minute 35 of
`lifeSupport`, and **price alone cannot hold it**: 3,600 is about ninety seconds of mid-phase
income, so a player who simply saves arrives early regardless. The control is therefore a **spend
gate** — seven Fission Piles and seven Hydroponics Bays — which cannot be waited out because it is
~63,700 Salvage of cumulative spend on things individually worth buying.

**The two site-gated rows fail closed, unlike the phase gate.** Solar Wing and Ice Harvester ship
priced and present but unbuyable until colonization lands. An unrecognized *phase* is corruption one
tick from self-repair, so revealing everything is safe there. A missing *site* is not corruption —
it is the accurate statement that nothing has been colonized. Failing open would offer the cheapest
Power in the act from minute one and delete the `lunar` phase's central beat.

## Measured, and what it says

A continuous run from a fresh save through both phases, with the buyer subject to every gate a
player is. **The buyer is optimal**, so every figure is an upper bound on pace — "no player is
faster than this", which is the useful direction for a pacing control.

| | Measured | Target |
|---|---|---|
| requires-gate opens | 38.1 min into `lifeSupport` | — |
| First Fuel Bladder bought | **39.4 min into `lifeSupport`** | not before ~35 ✅ |
| Worst solve passes, real ladder | **16** (= the cap) | bounded ✅ |
| Starved ration / Salvage | 0.200, 30.00 → 6.00/s, net pinned to 0 | throttle, not destroy ✅ |
| `aftermath` exit | 14.6 min | authored 20–30 ⚠ |
| `lifeSupport` exit | 40.2 min | authored 45–60 ⚠ |
| `lifeSupport` integrated earn | 285,218 | §5.3 budget 108,200 ⚠ |

**The phases run fast and `lifeSupport` earns 2.6× its budget.** Not retuned, and the two facts
have to be read together: the ladder is more generous than §5.3 assumed, so an optimal buyer walls
off early. §5.3 is explicitly a consistency check rather than a simulation; this is the simulation,
and ledger **R8** says later stories recompute against the measurement. The elastic §8 catalogue
that would absorb the surplus does not exist yet — the story that adds the artifact and instrument
sinks should re-measure before anyone moves a cost here.

Recorded in full in the config's tuning block rather than quietly corrected.
