# Design — the Launch panel

## What is actually wired

```mermaid
flowchart TB
  subgraph data["src/data/ — config and prose, no logic"]
    SITES["actSevenSitesConfig.js<br/><i>departingThreshold x5</i><br/><b>OVERSHOOT_TANK_MULT = 1.6</b><br/><i>the ONE authored copy</i>"]
    LCFG["actSevenLaunchConfig.js<br/><i>transit windows, band slopes</i><br/><i>launchCopy — the shop's words</i>"]
    COPY["<b>actSevenLaunchPanelConfig.js</b> — NEW<br/><i>launchPanelCopy</i><br/><i>the screen's words</i>"]
    MODS["actSevenModulesConfig.js<br/><i>getModuleDefinition('fuelBladder')</i><br/><i>the tank's NAME, read not typed</i>"]
  end

  subgraph engine["src/engine/ — pure, no React, no Date.now()"]
    OF["<b>overshootFor()</b><br/><i>the clamp</i><br/>+ tankCeiling"]
    LO["<b>listOffers()</b><br/><i>what committing NOW would do</i><br/>+ tankCeiling, fuelLeftBehind<br/>+ originLabel, destinationLabel"]
    IFR["<b>inFlightReadout()</b> — NEW<br/><i>what IS happening</i><br/>secondsRemaining, progress"]
    PUR["purchase()<br/><i>re-checks every gate<br/>through listOffers()</i>"]
    RA["resolveArrivals()<br/><i>from advance(), not from here</i>"]
    CR["colonyReadout.js<br/><b>opsReadout()</b><br/><i>Fuel capacity + phase</i>"]
  end

  subgraph state["src/state/"]
    AT["actionTypes.js<br/><b>COMMIT_LAUNCH</b>"]
    RED["gameReducer.js<br/><i>one require, one case</i>"]
    ACT["<b>actions/launchActions.js</b> — NEW<br/><i>next || state</i>"]
  end

  subgraph comp["src/components/expedition/ — render only"]
    PANEL["<b>LaunchPanel.js</b>"]
    NT["NoTankNotice<br/><i>capacity 0</i>"]
    BAND["Band<br/><i>held / threshold / ceiling</i><br/><i>.v7-meter + marker</i>"]
    BUYS["Buys<br/><i>ratio, transit, grant</i>"]
    COM["Commit<br/><i>spend note, blockedReason</i>"]
    FLY["InFlight<br/><i>countdown, progress</i>"]
    MOD["common/Modal.js<br/><i>btn danger</i>"]
  end

  SITES --> OF
  SITES --> LCFG
  LCFG --> OF
  MODS --> COPY
  OF --> LO
  LO --> PUR
  LO --> PANEL
  IFR --> PANEL
  CR --> PANEL
  COPY --> PANEL
  PANEL --> NT
  PANEL --> BAND
  PANEL --> BUYS
  PANEL --> COM
  PANEL --> FLY
  PANEL --> MOD
  MOD -->|COMMIT_LAUNCH| RED
  AT --> RED
  RED --> ACT
  ACT --> PUR
  PUR -.->|writes a resolved:false record| IFR
  RA -.->|from advance()| IFR
```

---

## Decision 1 — a burn in flight gets its own accessor, because the shop row cannot carry it

**MEASURED, not assumed.** Two failures, in opposite directions:

**After the fifth burn is committed, `listOffers()` returns nothing at all.** Every rung is reached,
so `currentLeg()`'s `sites.find(s => !s.reached)` is `undefined`; `beyondTheWall()` has already
refused because the record exists; the leg is `null`. Verified under `node`. Without a second source
the Launch panel goes **blank for the twelve minutes of the last burn in the game** — the one beat of
the act the player is most certainly watching.

**During any other burn, the row describes the wrong flight.** The leg still resolves (the
destination is still unreached), but `transitSeconds`, `overshootRatio` and `arrivalGrant` are
recomputed from the Fuel held *right now* — which, immediately after a commit, is zero. Rendering
that row's effect string mid-transit puts a window on screen that nothing is flying.

So: **`listOffers()` answers "what would committing do"; `inFlightReadout()` answers "what is
happening"**, and neither is derived from the other. A flight *replaces* the commit surface rather
than sitting beside it. This is `SitesPanel`'s two-sources constraint in a sharper form.

### 1a — and `nextArrivalClock()` is not the countdown's source

It excludes overdue and window-less records **by contract** — it feeds `advance()`'s step and must
never propose a boundary in the past — so it answers `Infinity` for exactly the corrupt record
`isDue()` takes such care to resolve. `Infinity - clock` on a screen is the failure that guard exists
to prevent. Both cases were driven and both return `Infinity`; both render finite through
`inFlightReadout()`.

### 1b — the subtraction lives in the engine

`secondsRemaining` is `arrivesAtClock - clock` and it is computed in `engine/launch.js`, for the same
reason `engine/sites.js` computes `buildSecondsRemaining` rather than handing a panel a
`readyAtClock`: a save carries `clock`, a save can be corrupt, and the subtraction that must stay
finite belongs where the guard already is. `clock: 'lots'` yields a finite number; a record with no
`arrivesAtClock` reads as landing rather than counting down from `NaN`.

**No `Date.now()`, no `setInterval`, no `setTimeout`** — asserted mechanically against the
comment-stripped source. The component re-renders when the tick reducer produces a new state, which
is exactly as often as the number changes.

---

## Decision 2 — the band is drawn, and the 1.6 is never restated

The tank ceiling comes off the offer row as `tankCeiling`, emitted from the **same expression in
`overshootFor()` that clamps the spend**:

```js
const tankCeiling = OVERSHOOT_TANK_MULT * threshold;
const fuelSpent = Math.min(held, tankCeiling);
```

so the band drawn on screen and the Fuel actually debited are one number by construction. Ledger R1
derives the tank from the threshold precisely so the two cannot drift; restating the multiplier in a
component would recreate that drift one layer along, where none of the act's measurements would
catch it.

The threshold rides inside the meter as an absolutely positioned rule at `fuelRequired /
tankCeiling`. **The verification asserts that ratio, not the 62.5% it evaluates to** — that is the
one assertion in the set that would fail silently if someone "simplified" the marker to a constant.

### 2a — which ceiling, of the three

Three different numbers, and the story's phrasing blurs them:

| | |
|---|---|
| the **launch band ceiling** | `OVERSHOOT_TANK_MULT × departingThreshold`, unrounded — the clamp inside `overshootFor()` |
| a site's **`fuelCapacityOnArrival`** | `Math.round(threshold × mult)` for *that* site |
| the **colony's Fuel capacity** | `colonyCapacity()` summing the above over every reached site, plus tank modules |

The **band is drawn against the first**. Drawing it against colony capacity would put the threshold
marker near the left edge from rung 2 onward (the engine measures the colony ceiling running
1,920 → 9,040 → 30,640 → 131,440 against thresholds of 1,200 → 4,200 → 13,500 → 42,000) and would
misrepresent the decision. The third is used only for the *"no tank exists"* read, which is a
different sentence about a different number.

---

## Decision 3 — "dumps the whole tank" means the band, and the copy has to survive Cryo storage

§7.3's phrase is *"committing dumps the whole tank"*, where **tank** means the launch tank — the
band — and not everything the player holds. `overshootFor()` clamps the spend to the band precisely
so that Fuel banked above it **survives**: the engine's own words are *"what is above the tank was
never in it… it is waiting at the next rung as a head start"*, and the alternative reading turns the
shipped Cryo Tank and Cryo Farm rows into traps.

So *"committing spends everything you have"* would be **false** the moment a Cryo Tank exists, and
false in the direction that costs the player the most. The shipped wording is:

> Committing dumps the launch tank — everything up to the ceiling, not just the threshold. There is
> no change.

plus a separate line, shown only when there genuinely is Fuel above the band, naming what stays
behind. `fuelLeftBehind` is emitted by the **engine** rather than subtracted on screen, because it is
an economic fact about the clamp and not a layout one — a panel deriving it would be the second place
in the app that knows the clamp exists.

Verified at 5,000 Fuel against a 1,920 ceiling: spend clamps, ratio pins at 1.6, bar clamps at 100%,
the surplus line renders 3,080, and the confirm quotes the **spend** rather than the holding.

---

## Decision 4 — the commit surface follows `CallUpModal`, exactly

The button that spends does not spend. It opens `common/Modal.js`, and only the modal dispatches —
step two of the call-up crossing (`AppShell.js`), which is §6.4's named precedent for a committed
spend. Closing it (backdrop, or the decline label) costs nothing, so a mis-tap on the commit button
is free. The accept is `btn danger`, as the call-up's is.

The modal is gated on the offer still being **committable** rather than on the local flag alone: a
tick can land an arrival, or a replayed dispatch can put a burn in the air, between the click and the
render, and a confirm surface must not ask the player to confirm a burn the engine would now refuse.

`confirming` is local `useState` and deliberately not in the save. A half-opened confirm is not a
fact about the run — `AppShell` holds `confirmingCallUp` the same way.

---

## Decision 5 — the blocked row is shown with its reason, not hidden

`engine/sites.js` omits unavailable rows and states the rule; `engine/launch.js` deliberately breaks
it and argues why. The launch shop has **exactly one row**, because the ladder is strictly ordered
and there is never a second legal destination — so omitting it leaves an empty panel on the tab whose
whole subject is the thing the player is waiting for. The panel renders `blockedReason` verbatim and
disables the control; it re-derives none of the three refusals.

---

## Decision 6 — the tank that does not exist yet gets a block of its own, above the band

Fuel's base capacity is **0** (§5.5, ledger R1), so before the first tank Fuel is not merely scarce —
it is **discarded as fast as it is made**, and the threshold is not a target the player is
approaching slowly. That is the single fact gating the entire launch system and it is invisible
everywhere else in the app: the Ops panel prints `0/0`, which is correct and explains nothing.

It renders **above** the band, because a player whose ceiling is zero is not reading the band; they
are reading why the band does not move. It is gated on the **engine's capacity** rather than on
owning a particular module, so it stays true if the ladder ever grows a second way to hold
propellant. The row to go and buy is named by reading `getModuleDefinition('fuelBladder').label`,
so a rename moves the sentence with it.

### 6a — one solve per render, chosen rather than drifted into

Fuel's ceiling and the run's phase both come from `opsReadout()`, which runs `colonyRates()` — a
16-pass Kleene fixed point. `OpsPanel`'s header argues that one solve per render is the budget for
the panel that is open *continuously*; this is not that panel. Taking `opsReadout()` rather than
`listResources()` gets **both** facts from the single solve; the obvious pair of calls would take two.

---

## Decision 7 — reach is never rendered as degraded by resources

§7.2's sharpest rule: reach is a function of the built pad tier alone, so **a starved network
launches later, never shorter**. Nothing on this screen dims, warns or conditions on how the colony
is doing, and the in-flight block says the invariant in words — the one screen where a worried player
would most expect it to be false.

Verified: with every resource zeroed mid-transit, the countdown, the destination and the safety
sentence are bit-for-bit unchanged.

---

## Decision 8 — one action, and deliberately no cancel

`COMMIT_LAUNCH` carries `offerId`, matching `BUY_SITE_BUILD`, `BUY_MODULE` and `BUY_LOT_ITEM`: it is
the id of a row the shop offered, and every shop in this game names it the same way. The offer id is
also the stored record's id, so a burn in the log traces straight back to the row that started it.

There is no `ABORT_LAUNCH` — see the proposal's Out of Scope.

**A replayed commit cannot double-spend, and the gate is not the shape.** The second dispatch runs
`listOffers()` again, `blockedReasonFor()` finds the unresolved record the first one wrote, and the
row comes back blocked — so `purchase()` returns `null` **before** `spendResource()` is reached. The
Fuel debit is not idempotent and does not need to be; the gate in front of it is. Verified: replay
returns the identical object by `===`, the tank is debited once, and exactly one record exists.

---

## Decision 9 — the meter primitive is extended, never forked

The band and the transit bar are STORY-034's `.v7-meter` / `.v7-meter-fill` with one addition — an
absolutely positioned marker, which the primitive already supports because it declares
`position: relative`. Forking the meter to draw a line on it would fork a rule three panels now build
on.

Two mechanics carried forward from `OpsPanel`'s notes: children of `.v7-meter` are **block** elements
(the primitive sets a 6px height and no `display`, so an inline child drops the height and the bar
does not exist), and the launch meter raises that to 14px — this is the only meter in the act a
player makes a *decision* against, and it has to carry a marker that reads as a line and not a speck.

The commit control takes its own class rather than the global `.btn`, which is the ballpark's green
on the ballpark's ink; `.v7-artifact-submit` made the same move and this matches it, so there is one
button shape in the act. The **modal's** button keeps `btn danger`, because a modal renders on the
app's own ground rather than on `body.expedition`'s — and because that is what the precedent does.

---

## What is deliberately not here

**A time-to-threshold estimate.** "Full in 4m 20s" divides the shortfall by the colony's net Fuel
rate, and a net rate is a solve output that moves whenever anything is built. It would put a promise
on screen that the next purchase invalidates.

**A launch history.** The record list *is* the log (§4, §7.3) and `EventFeed` already renders below
the active panel in every act. A second list of past burns on this tab would be the act's most
consistent element made inconsistent — `OpsPanel` refuses a second feed for the identical reason.

**Any per-site Fuel reading.** §7.4 rules that Act VII has one pool and not one per site. The band is
the *launch tank* — a property of the leg, not a stock at a place — and nothing here suggests
otherwise.
