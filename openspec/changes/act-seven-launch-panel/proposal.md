# Act VII — the Launch panel: the threshold, the overshoot band and the commit

## Why

`engine/launch.js` shipped with STORY-028 and **nothing in the app has ever dispatched into it**.
There was no `COMMIT_LAUNCH`, no reducer case and no action file; `components/expedition/LaunchPanel.js`
returned `<PlaceholderPanel />`. The engine that owns the act's most consequential decision has been
reachable only from a `node` harness — every launch in every measurement in this repo was committed
by a test script, never by a player.

The urgent half is not the button, it is the **band**. §7.3 gives every site a Fuel tank holding
1.6× the threshold of the burn *departing* from it, and committing dumps the tank rather than the
threshold — there is no change. So the player's real question is never "may I go" but *"do I go now,
or hold six more minutes and arrive with the margin that pays for half the colonization"*. A panel
that printed `1,500 / 1,200 — ready` would be perfectly accurate and would **delete that decision**,
because the decision only exists if the room above the line is visible. That is what makes this a
screen the UI *creates* rather than reports.

A second gap surfaced while building it, and it decided the design: **`listOffers()` cannot describe
a burn in flight.** Measured, not assumed — see design Decision 1.

## What Changes

| File | Change |
|---|---|
| `components/expedition/LaunchPanel.js` | **Rewritten.** The band, what the surplus buys, the commit surface, and the burn in flight |
| `data/actSevenLaunchPanelConfig.js` | **New.** `launchPanelCopy` — every word the screen says that is not authored on an offer row |
| `engine/launch.js` | `inFlightReadout()` **new export**; `overshootFor()` additionally returns `tankCeiling`; the offer row additionally carries `tankCeiling`, `fuelLeftBehind`, `originLabel`, `destinationLabel` |
| `state/actions/launchActions.js` | **New.** One line over `purchase()`; refusal is the identical state object |
| `state/actionTypes.js` | `COMMIT_LAUNCH` — one action, and deliberately no cancel |
| `state/gameReducer.js` | One `require`, one `case` |
| `styles/global.css` | The `.v7-launch*` rules, inside `body.expedition`, above the trailing mobile block |
| `data/actSevenPanels.js` | The `launch` blurb annotated the way `fab`, `sites` and `artifacts` are — the panel is real now |

**No balance is touched.** No threshold, transit window, overshoot slope, colonization cost or
upkeep factor moves. Every figure this screen prints is read from the tables §7.5's measurements
were taken against, and the engine additions are all read-side: `overshootFor()` returns one more
field out of an expression it already evaluated, and `inFlightReadout()` writes nothing.

## Capabilities

### New Capabilities

- `game-feedback/expedition-launch-panel`: how an irreversible, over-fillable threshold spend is
  presented — the band rather than the binary, the commitment stated before the control that makes
  it, and a committed action in progress presented from its own record rather than from the shop row
  that started it.

## Impact

- **Act VII is now playable end to end from the UI.** The last engine in the act with no dispatch
  path has one. `contracts` is the only remaining `PlaceholderPanel` (STORY-040).
- **`overshootFor()`'s return grew one field.** It had no consumers outside `engine/launch.js`
  (verified across `src/`), so the addition is purely additive.
- **The offer row grew four fields.** `listOffers()` had no consumer at all before this change.
- **One real defect found and fixed**: the offer row carried `originSiteId` but no `originLabel`, so
  the confirm surface read "out of **undefined**". Caught by mounting `common/Modal.js` with the
  props the panel passes it — no amount of rendering the panel would have found it, because the
  confirm lives in local state a static render cannot toggle.

## Out of Scope

- **No cancel, and the absence is the design.** There is no `ABORT_LAUNCH`. §7.3 makes the burn a
  commitment, `engine/launch.js` takes no rng so a committed burn always arrives, and a recall would
  turn the overshoot decision into a free option. The confirm surface is where the decision is
  reversible; after the dispatch it is not.
- **No arrival surface.** What a burn *does* on landing — marking the site reached, paying the
  arrival grant, moving the phase — is `resolveArrivals()` running from `advance()`, and the player
  meets it on the Sites tab and in the event feed. This panel renders the transit, not the landing.
- **No time-to-threshold estimate.** "Full in 4m 20s" is a division of the tank's shortfall by the
  colony's net Fuel rate, and a net rate is a solve output that moves whenever anything is built.
  Printing it would put a promise on screen that the next purchase invalidates. Not in the AC, and
  not added.
- `PlaceholderPanel.js` and `ACT_SEVEN_PLACEHOLDER_NOTE` untouched — retiring them belongs to the
  story that removes the last placeholder (STORY-040).
