# Act VII — the frozen-league header and the resource readout

## Why

Act VII freezes the baseball simulation (`seasonFrozen`, STORY-019) without deleting
it. The header does not know that yet: it still shows a season chip, a win-loss record,
reputation, stadium capacity, an era pill and a champions badge for a league that has
stopped moving. Every one of those is now a number that will never change again.

At the same time the act introduces four consumables with capacity ceilings, and a
currency chip cannot say what they need to say. A currency is monotonic — it goes up,
you spend it, the chip shows a balance and a rate. A consumable fills and drains against
a ceiling and can carry a **negative** net rate. The player needs three things a currency
chip has no room for: **amount against capacity**, **the sign of the net rate**, and **a
warning before the resource bottoms out**.

## What changes

Header space is already contested on a 390px screen — `global.css`'s mobile block records
a header row that had to be shrunk once already — so this is a **swap, not an addition**.

| Suppressed when the league is frozen | Replaced by |
|---|---|
| Season chip and win-loss record | Four resource chips |
| Reputation | |
| Stadium capacity | |
| Champions-this-run badge | |
| Era pill | Phase pill, **in the same slot** |

The clock and the countdown stay in both worlds: time still passes and events are still
scheduled.

| File | Change |
|---|---|
| `engine/colonyReadout.js` | **New.** `listResources(state, modifiers?)` — the boundary helper |
| `data/colonyReadoutConfig.js` | **New.** Warning threshold, chip tones, the computed contrast record |
| `components/layout/ResourceChips.js` | **New.** Renders the rows verbatim |
| `components/layout/HeaderStats.js` | The swap, gated on `resolveRules(state).seasonFrozen` |
| `styles/global.css` | A feature section, **above** the trailing mobile media block |

## The decisions worth arguing about

**`listResources` performs no second solve** (ledger **R5**). Everything it returns is
arithmetic *on* `colonyRates()`'s output; nothing in it computes a rate. This is not
pedantry — the header's job here is to say when a resource will bottom out, and a helper
that derived its own rate, *even the same arithmetic written twice*, would drift the first
time either changed. A header saying forty seconds while the engine crosses the boundary
in four is worse than no warning at all.

**It lives in its own file, not in `colony.js`.** `colony.js` is the simulation; this is a
presentation shape. Keeping the boundary visible is what stops the next person adding "just
one more derived number" to the solve.

**The engine decides the warning, the trend and the tone.** A component asking `net < 0` is
a component deciding what counts as falling — a rules question the moment anyone wants a
hysteresis band. The threshold is authored in `data/`, because a number inline in an engine
is a bug just as much as one in a component.

**The condition is `seasonFrozen`, not an act index.** It is the rule that retires the
baseball simulation, so it is exactly the condition under which these chips stop meaning
anything. An era or a later act that freezes the league gets the same header for free.

**Salvage needed no code.** It is already in `data/currencies.js`, and the header already
falls back to whatever the player holds when the unlock filter comes back empty — so it
appears as an ordinary currency chip with no currency name in the component.

## Two states a naive readout gets wrong

**A resource pinned at empty reports an infinite runway, not zero.** `colonyRates` pins
`net` to exactly 0 against a boundary the resource cannot cross, so a starved resource has
**arrived**, not arriving. It is stable there until the player buys something. "You have
ninety seconds to fix this" and "this has been broken for an hour" are the two most
different things the header can say, and they get different states and different colours.

**Fuel starts at 0 amount and 0 capacity, and that is normal.** The player has no tank
until they build one. Without requiring `capacity > 0`, every fresh Act VII save would open
with an alarm-red Fuel chip describing a crisis that is the starting state.

## Accessibility

Contrast ratios are **computed and recorded, not asserted** — with the WCAG 2.1
relative-luminance formula under `node`. The first draft of the comment carried guessed
figures that were all 0.5–1.4 too high, which is precisely why the story asked for them to
be measured. Worst pair **6.86:1** against a 4.5:1 bar (chips render at ~0.78rem, which is
normal-size text for contrast purposes); the phase pill is **8.71:1**.
