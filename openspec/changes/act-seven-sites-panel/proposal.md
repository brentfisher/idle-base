# Act VII — the Sites panel: the ladder, its upkeep, and what a pad costs to keep

## Why

`engine/sites.js` shipped with STORY-027 and one of its exports has had **no consumer at all** since
the day it landed. `listSites()` is documented in the source as "Every site, resolved, in ladder
order — for §6's Sites panel", and §6's Sites panel returns `<PlaceholderPanel />`. The act's whole
spine — you colonize to launch further, and a colony is what lets you build the places you launch
from — has been running in the engine with nowhere on screen that says so.

The urgent half is not the ladder, it is the **upkeep**. §7.2's design is that expanding must be a
*decision* and not a purchase, and the only thing that makes it one is the permanent draw on the
shared pool. The Warning Track is deliberately the cheapest rung on the ladder to establish (6.0
minutes of income) and the most ruinous in the act to sustain (a 6.0 `upkeepFactor`, 270 Power/s
once the Swing is on it), and that inversion is the act's thesis expressed as a mechanic. A player
who cannot see the running cost before buying has not been given the decision the section is built
around — they have been sold something.

## What Changes

| File | Change |
|---|---|
| `components/expedition/SitesPanel.js` | **Rewritten.** The ladder from `listSites()`, the shop from `listOffers()`, kept as two sources |
| `data/actSevenSitesPanelConfig.js` | **New.** `sitesCopy` and `statusFor()` — every word the screen says that is not authored on a site |
| `engine/sites.js` | `listSites()` additionally resolves `upkeep`, `padUpkeep`, `produces`, `buildLabel` and `buildSecondsRemaining` |
| `state/actions/sitesActions.js` | **New.** One line over `purchase()`; refusal is the identical state object |
| `state/actionTypes.js` | `BUY_SITE_BUILD` — one action, because colonization and pads are one row vocabulary |
| `state/gameReducer.js` | One `require`, one `case` |
| `styles/global.css` | The `.v7-site*` ladder rules, inside `body.expedition`, above the trailing mobile block |
| `data/actSevenPanels.js` | The `sites` blurb annotated the way `fab`'s is — the panel is real now |

**No balance is touched.** No cost, no window, no upkeep factor and no threshold moves. The act is
won at 4.86h against a 5.00h ceiling — a 2.7% margin — and every number this screen prints is read
from the tables that measurement was taken against.

## Capabilities

### New Capabilities

- `game-feedback/expedition-sites-panel`: how a progression ladder of places is presented — the
  distinction between "where am I" and "what can I buy", the requirement that a permanent running
  cost is stated before the capability it buys, and the requirement that a capability set by a
  built structure is never rendered as degraded by resource pressure.

### Modified Capabilities

None. `engine/sites.js` gains resolved read-only fields on a row that already existed; the rules
about what may be colonized, what a pad costs, when a build completes and how far a pad reaches are
untouched, and `openspec/changes/act-seven-site-ladder` remains the authority on all four.

## Impact

- **Reads** `engine/sites.js` (`listSites`, `listOffers`, `purchase`) and, through it,
  `engine/colony.js`'s `resolvedSites()` and `data/actSevenSitesConfig.js`'s `padUpkeepAt()`.
- **Writes** nothing but a build record, through the engine's existing `purchase()`.
- **Depends on** `act-seven-visual-identity` for the palette and the CSS section. Independent of the
  Ops and Fab panels; all three extend the same shared row primitives without forking them.
- **Not blocked by** `act-seven-launch-transit`, but inert without it: a site is reached only by a
  launch, so today `listOffers()` correctly returns zero rows and Home Plate is the only colonized
  site. The panel is built to read honestly in that state and to come alive unchanged when the
  first burn lands. **Nothing here stubs a launch.**
- **Does not touch** `PlaceholderPanel.js` or `ACT_SEVEN_PLACEHOLDER_NOTE`; removing them belongs to
  the story that retires the last placeholder.
