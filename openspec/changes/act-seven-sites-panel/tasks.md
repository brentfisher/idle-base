# Tasks — the Sites panel

## 1. The engine's read side

- [x] `listSites()` additionally resolves `upkeep` (site base, unscaled), `padUpkeep`
      (`padUpkeepAt()`, scaled by the site's `upkeepFactor`) and `produces`.
- [x] Each is an ORDERED, LABELLED list — ordered by `EXPEDITION_RESOURCES` so a config edit that
      reorders one site's `baseUpkeep` object cannot reshuffle a column the player reads down, and
      labelled from the same field `colonyReadout.js` reads for the header chips.
- [x] The filter is the biller's filter: non-finite and non-positive rates are dropped exactly as
      `colony.js`'s `addRates()` drops them, so the screen shows what the network pays.
- [x] `buildLabel` and `buildSecondsRemaining`, the latter computed against a guarded clock
      (design Decision 9).
- [x] `'Colonize ' + site.label` factored into `colonizeLabel()` — the shop row and the running-build
      row are the same sentence at two moments and must not be two literals.
- [x] `listOffers()`, `purchase()` and every gate untouched. No new rule, no balance change.
- [x] Confirmed nothing else in `src/` consumed `listSites()`, so the additions are purely additive.

## 2. The panel

- [x] `SitesPanel.js` renders real content; `PlaceholderPanel` is no longer imported.
- [x] The ladder from `listSites()`, the shop from `listOffers()`, **neither derived from the
      other** (design Decision 1).
- [x] Ladder row: rung chip, name, status pill, `where`, description, upkeep / pad upkeep /
      production, the pad and its reach, and the running build.
- [x] Upkeep lines gated on `colonized`, matching where `colony.js` charges them (Decision 5).
- [x] Reach gated on `launchPadTier > 0`, sourced from the row's `reachesRung`, never recomputed
      from the tier, and with no degraded variant anywhere (Decision 4).
- [x] `SiteOffer` renders the engine's `effect` string **above** the description and at full ink
      emphasis — Decision 9 of `act-seven-site-ladder`, held by position AND by colour (Decision 3).
- [x] Purchase dispatches `BUY_SITE_BUILD`; the button is disabled on the engine's `affordable` and
      the panel resolves no cost and no affordability of its own.
- [x] Exactly one pad tier per rung, because the panel renders whatever `listOffers()` returned and
      invents no tier list.
- [x] No `.v7-meter` anywhere — §7.4's one pool, with `poolNote` saying so in words (Decision 8).
- [x] Both empty states render their heading and an authored sentence (Decision 6).

## 3. The words

- [x] `data/actSevenSitesPanelConfig.js` — `sitesCopy` and `statusFor()`. No player-facing string
      literal anywhere in the component.
- [x] Nothing restates a site: no name, no `where`, no description, no cost, no rate.
- [x] `rateMagnitude()` matches the act's house rate format (`ResourceChips`, `OpsPanel`) — one
      decimal under 10. `formatNumber` alone truncates and would print the Mound's 0.4 Provisions/s
      as `0`.
- [x] The empty-shop sentence is worded to stay true after launches land.

## 4. Reducer wiring, kept minimal and additive

- [x] `state/actions/sitesActions.js` — one line over `purchase()`, refusal as the identical state
      object, matching `fabActions.js`.
- [x] `actionTypes.js` — `BUY_SITE_BUILD` only. One action, because there is one row vocabulary
      (design Decision 7).
- [x] `gameReducer.js` — exactly one `require` and one `case`.

## 5. CSS

- [x] `.v7-site*` rules as ONE contiguous block inside `body.expedition`, above the trailing
      `@media (max-width: 640px)`, with the placement warning the Ops and Fab blocks carry.
- [x] Verified mechanically: the block ends at line 3627 and the media query opens at 3629.
- [x] `.v7-row`, `.v7-row-cost`, `.v7-rate` and `button.v7-row-cost` EXTENDED, not forked.
- [x] Amber used for the reach figure and the price button and nothing else; upkeep on
      `.v7-rate.is-drain`, production on `.v7-rate.is-good`.
- [x] Contrast recomputed (WCAG relative luminance): ink/panel 14.36, accent/panel 10.18, good/panel
      9.57, drain/panel 7.85, muted/panel 7.02, muted/chip 7.38, good/chip 10.05, ink/chip 15.10.
      No new pairing is introduced; all clear the 4.7 floor.
- [x] Mobile handled by `flex-wrap` on every horizontal group rather than a media query, so nothing
      overflows 390px.
- [ ] **NOT MET, AND NOT THIS BRANCH'S TO FIX**: the 44px tap-target floor. `button.v7-row-cost` is
      `padding: 6px 10px` with a 1px border and inherited font — roughly 33px tall at 390x844. It is
      pre-existing, it is the ONLY control this panel draws, and it is shared with Fab (STORY-036)
      and the standing-order board (STORY-032), both already merged. Its own comment asks panel
      stories to extend rather than fork it, so a Sites-only override would be three buttons that
      nearly match and two panels still under the floor. Raised as a cross-panel gap.

## 6. Verification

- [x] `npm run build` passes.
- [x] Driven under `node` with a Babel require-hook, 99 assertions, engine AND mount (through
      `react-dom/server` inside a `GameContext`), across six fixtures. Harness deleted; the record is
      the `VERIFIED (STORY-037)` block at the foot of `SitesPanel.js`.
- [x] **Fresh Act VII**: five rows in rung order, zero offers, Home Plate the only colonized site,
      `+2.0 Oxygen/s` as production, `Reaches rung 1`, and the string `Reaches rung 0` absent from
      the markup entirely. Every name, `where` and description asserted against the engine's own
      return values rather than a hardcoded list.
- [x] **`markSiteReached(state, 'onDeck')`**: exactly one offer, `colonize@onDeck`, effect
      `-2 power/s, -1.5 oxygen/s, -1 provisions/s` rendered verbatim and, scoped to the shop half of
      the markup, ABOVE the description. Affordable at 9,000 and disabled at 8,999.
- [x] **Purchase**: debits to 0, writes the build, removes the row from the shop while the site is
      busy, and shows `Colonize The On-Deck Circle — 2m 0s left`. A replayed purchase and a
      malformed offer id both return the identical state object by `===`.
- [x] **A pad built (tier 2)**: reach is 2 and equals `siteReach()` called directly; the Power and
      Provisions the panel prints equal the delta in `colonyRates().demand` to within 1e-9.
- [x] **No `expedition` key**: renders the full ladder, and the state still has no `expedition` key
      afterwards.
- [x] **Pre-Act-VII save**: `resolvedSites()` is `[]`, both sections render their authored
      sentences, and no site is named.
- [x] **Corruption**: `clock: 'lots'` yields a finite remainder; an unrecognized `buildingId`
      renders the fallback line and never the raw id.
- [x] Purity: `listSites()`, `listOffers()` and a full render leave the state byte-for-byte
      unchanged.

## 7. Out of scope, deliberately

- [ ] **No balance retune.** No cost, window, `upkeepFactor` or threshold moved. The act is won at
      4.86h against a 5.00h ceiling — a 2.7% margin — and any change lengthening a fill would owe a
      re-run of that measurement.
- [ ] **No launch is stubbed.** The ladder is inert until `engine/launch.js` exists and that is
      correct; the panel is built to come alive unchanged when it does.
- [ ] `PlaceholderPanel.js` and `ACT_SEVEN_PLACEHOLDER_NOTE` untouched — retiring them belongs to
      the story that removes the last placeholder. Only the `sites` `blurb` comment was annotated.
- [ ] The offer effect strings keep the engine's lowercase resource ids (`-2 power/s`) against the
      ladder's labelled rates (`−2.0 Power/s`). Prettifying them means editing `describeRates()`,
      which is the function guaranteeing the shop cannot advertise a number the engine does not
      honour. Recorded as a known gap.
