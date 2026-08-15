# Act VII — the click, Salvage income, and the `aftermath` tier-1 modules

## Why

Act VII ships today as a shell. STORY-021 landed its config and swapped the tab
shell; STORY-016 added the `salvage` currency and the `expedition` slice; STORY-018
added the consumption path and `colonyRates()`. What none of them added is anything
to *do*: `EXPEDITION_MODULES` is an empty array, so the colony produces nothing,
consumes nothing, and every rate solves to zero. The act is a bar with no economy
behind it.

This change makes `aftermath` — the act's opening phase — playable end to end:

1. A click that pays a **flat** amount of Salvage.
2. A passive Salvage ladder that is itself a **Power and Provisions consumer**.
3. The tier-1 modules that give the phase an economy, behind a shop-contract engine.

## What changes

| File | Change |
|---|---|
| `data/acts.js` | Act VII's `clickFlatValue` stops being inert; the comment recording why is rewritten |
| `data/actSevenModulesConfig.js` | **New.** The `aftermath` rungs, `cost(n) = baseCost × growth^n`, plus the measurement record |
| `data/actSevenConfig.js` | `EXPEDITION_MODULES` is populated from the new config instead of being `[]` |
| `engine/clicker.js` | `clickValue()` reads `clickFlatValue`, replacing the `perClick × multiplier` calculation |
| `engine/colony.js` | `colonyRates()` gains a `salvage` field, derived from the same solve |
| `engine/actSevenModules.js` | **New.** `listOffers` / `purchase` in the house shop contract |
| `engine/income.js` | A `salvage` contributor, gated on its own unlock |

## The decisions worth arguing about

**Salvage is manufactured, not found.** The Reclaimer Drone is the act's only income
*and* a Power and Provisions consumer. Buying one makes the next more expensive and
raises the colony's draw. Without that second cost the act degenerates into "buy
drones, buy everything" — drones become a pure multiplier on a resource nothing
competes for, and the satisfaction solve `engine/colony.js` exists to run never has
anything to ration. **The interlock is the game.**

**`clickFlatValue` replaces the calculation rather than scaling it.** `clicker.perClick`
spans 2 to 77 across the eight concessions rungs, so at *any* multiplier the press is a
38× spread between two players who reached the same act. Act VI tolerates that because
caps are a side currency there; Act VII opens the way Act I opens — one button, one
screen — and for the first two minutes the click is 100% of the act's income. An absent
key is today's behaviour exactly, so Acts I–VI are untouched.

**`producesSalvage` is a separate key from `produces`.** Salvage is a wallet currency,
not one of the four consumables. Putting it inside `produces` would work today *only*
because `colonyRates` iterates `EXPEDITION_RESOURCE_IDS` and would silently ignore it —
and would break the moment anything iterated `produces` directly.

**The Salvage rate comes out of the same solve that integrates the colony.** One ration
in play means the header, the income and the colony can never disagree about how starved
the colony is. Two sums would be two rations, and a header reading 26/s while the wallet
fills at 9/s is a bug the player experiences as the game lying to them.

## Scope

`aftermath` rows only — Reclaimer Drone, RTG, Sabatier Scrubber, Ration Printer. The
later rungs and the whole storage ladder land with the stories that price them, each
carrying its own measurement. This is the same argument `actSevenConfig.js` already
makes for shipping the consumption engine against an empty catalogue, one rung up:
content and correctness stay separable, so a balance edit can never arrive as an
unmeasured correctness regression.

## Known gap, recorded rather than hidden

The story asked for a click share **below 5% at minute 10**. That target is
**unreachable**, and not because the ladder is mistuned — it contradicts PRD §5.2, which
ledger **R8** makes authoritative. Under 5% at minute 10 requires passive income above
50/s there; §5.2 puts the whole phase's *exit* rate at 26/s, twenty-plus minutes later.
§5.2's own prose gives the figure this ladder should be judged against — the click is
"~10% at that phase's exit" — and the measured **7.5% at minute 25** sits inside it.
Retuning to hit the stated target would mean roughly doubling the phase's income against
an authoritative table, so it was not done.
