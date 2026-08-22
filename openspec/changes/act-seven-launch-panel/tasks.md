# Tasks — the Launch panel

## 1. The engine's read side (additive only; no rule and no balance moved)

- [x] `overshootFor()` returns `tankCeiling` — named out of the expression that already **clamps**
      the spend, so the band drawn and the Fuel debited are one number (design Decision 2).
- [x] The offer row additionally carries `tankCeiling`, `fuelLeftBehind`, `originLabel` and
      `destinationLabel`.
- [x] `fuelLeftBehind` is `held - spent`, computed in the engine because it is an ECONOMIC fact
      about the clamp and not a layout one (Decision 3).
- [x] **`inFlightReadout(state)` — new export.** `secondsRemaining`, `progress`, `transitSeconds`,
      `fuelSpent`, `arrivalGrant`, both end labels, and `resolved: false`.
- [x] The clock subtraction lives here, guarded, so `clock: 'lots'` yields a finite number and a
      window-less record reads as landing rather than as `NaN` (Decision 1b).
- [x] `destinationLabelFor()` handles the one destination that is not a site — `getSiteDefinition()`
      answers `null` for `beyondTheWall`, which is correct rather than a miss.
- [x] `fuelSpent` and `arrivalGrant` recomputed from the STORED RATIO and config, never denormalized
      — the rule `arrivalGrantFor()` already states.
- [x] `listOffers()`, `purchase()`, `resolveArrivals()`, `nextArrivalClock()` and every gate
      otherwise untouched. No new rule.
- [x] Confirmed `overshootFor()` had no consumer outside `engine/launch.js`, and `listOffers()` no
      consumer at all, so every addition is purely additive.

## 2. The panel

- [x] `LaunchPanel.js` renders real content; `PlaceholderPanel` is no longer imported.
- [x] The commit surface from `listOffers()`, the burn in flight from `inFlightReadout()`, **neither
      derived from the other** (Decision 1). A flight REPLACES the commit surface.
- [x] The band renders as a **band**: held, threshold and ceiling as three figures, and a meter with
      the threshold drawn across it at `fuelRequired / tankCeiling`.
- [x] The fill wears `is-drain` below the threshold and the good fill above it — the bar changes
      character at the one boundary that matters.
- [x] What the surplus buys — ratio, shortened transit against the base window, arrival grant — from
      the engine's figures, itemised BEFORE the commit.
- [x] At the floor the block says so in one sentence; **no "0% shorter" row of zeroes** anywhere.
- [x] The wall's absent grant is SAID rather than omitted (`colonizeCost: 0` is correct, not a
      placeholder).
- [x] The commit states that committing spends the whole tank, ABOVE the control, at full ink
      emphasis and never `.muted` — asserted by string position in the markup.
- [x] The surplus-stays line renders only where there is genuinely Fuel above the band.
- [x] Commit goes through `common/Modal.js` on `CallUpModal`'s precedent; only the modal dispatches;
      the accept is `btn danger` (Decision 4).
- [x] The modal is gated on the offer still being committable, not on the local flag alone.
- [x] `blockedReason` rendered verbatim; the button disabled on it; no refusal re-derived.
- [x] In flight: the countdown, the leg, the progress bar, what was spent, what is being carried, and
      §7.2's starvation invariant in words (Decision 7).
- [x] The no-tank block renders above the band when the engine's Fuel capacity is 0 (Decision 6).
- [x] Empty state distinguishes "not started" from "finished", keyed on the `majors` phase.
- [x] **No `Date.now()`, no `setInterval`, no `setTimeout`, no component-side timer** — asserted
      mechanically against comment-stripped source.
- [x] The only arithmetic in the file is `widthPercent()`, which turns two engine numbers into a CSS
      width.

## 3. The words

- [x] `data/actSevenLaunchPanelConfig.js` — `launchPanelCopy`. No player-facing string literal
      anywhere in the component.
- [x] **Nothing restates a number**: no threshold, no transit window, and above all no `1.6` —
      asserted mechanically against comment-stripped source of BOTH the component and the copy file.
- [x] The spend sentence is worded to stay true once §5's Cryo rows let a player bank past the band
      (Decision 3) — it says "the launch tank", never "everything you have".
- [x] The first tank is named by reading `getModuleDefinition('fuelBladder').label`, never typed.
- [x] The three band figures are unitless with the unit said once in the heading above them.

## 4. Reducer wiring, kept minimal and additive

- [x] `state/actions/launchActions.js` — one line over `purchase()`, refusal as the identical state
      object, matching `sitesActions.js`.
- [x] `actionTypes.js` — `COMMIT_LAUNCH` only, carrying `offerId`. No cancel (Decision 8).
- [x] `gameReducer.js` — exactly one `require` and one `case`.
- [x] Nothing here resolves an arrival: `resolveArrivals()` from `advance()` remains the single
      completion path, so an eight-hour offline return lands a burn exactly once.

## 5. CSS

- [x] `.v7-launch*` rules as ONE contiguous block inside `body.expedition`, above the trailing
      `@media (max-width: 640px)`, with the placement warning every Act VII block since STORY-034
      carries.
- [x] Verified mechanically: the block's header precedes the file's last `@media (max-width: 640px)`
      and no rule in it is unscoped.
- [x] `.v7-meter` / `.v7-meter-fill` EXTENDED, not forked — the marker rides inside the primitive's
      existing `position: relative` (Decision 9).
- [x] Meter children are block elements, per `OpsPanel`'s note; the launch meter is 14px because it
      carries a marker.
- [x] Contrast recomputed (WCAG relative luminance): ink/panel 14.36, ink/chip 15.10, accent/panel
      10.18, accent/chip 10.70, good/panel 9.57, muted/panel 7.02, muted/chip 7.38, alert/panel 6.48,
      alert/chip 6.81, accent-ink/accent 10.60. No new pairing is introduced; all clear the 4.7 floor.
- [x] The commit control is 44px minimum height — the tap-target floor `button.v7-row-cost` misses
      across Fab, Sites and the standings board. This panel's one control meets it.
- [x] Mobile handled by the existing flex groups rather than a new media query; nothing overflows
      390px.

## 6. Verification

- [x] `npm run build` passes (3 pre-existing bundle-size warnings, unchanged).
- [x] Driven under `node` with a Babel require-hook, **124 assertions**, engine AND reducer AND mount
      (through `react-dom/server` inside a `GameContext`), across thirteen fixtures. Harness deleted;
      the record is the `VERIFIED (STORY-039)` block at the foot of `LaunchPanel.js`.
- [x] Every displayed figure asserted against the ENGINE'S OWN RETURN VALUE, never a hardcoded
      number — a hardcoded list cannot catch a panel that recomputed something.
- [x] **The four fill states the AC names**: no tank (capacity 0, notice renders, threshold
      unreachable); below threshold (`is-drain`, blocked on the tank); at the threshold exactly
      (ratio 1.0, base window, no zero-row); with surplus (1.25x, 162s against a 180s base, 450
      Salvage — 2.5 steps × 2% × 9,000).
- [x] **Above the band** (5,000 against a 1,920 ceiling): spend clamps, ratio pins at 1.6, bar clamps
      at 100%, `fuelLeftBehind` is 3,080, the surplus line renders, and the confirm quotes the spend.
- [x] **In flight to a site**: whole tank debited, `resolved: false`, countdown 62s at clock 100 of a
      162s window and equal to `arrivesAtClock - clock`. The commit surface and the band are BOTH
      absent from the markup.
- [x] **The stale-row check**: `listOffers()` still returns a row mid-flight, its `transitSeconds`
      differs from the flight's, and that hypothetical window is asserted ABSENT from the markup.
- [x] **Reach is not degraded by starvation**: with every resource zeroed, the countdown, the
      destination and the safety sentence are bit-for-bit unchanged.
- [x] **In flight to the wall**: `listOffers()` returns ZERO rows after the commit (measured), the
      milestone is set at commit, and the panel is nonetheless not blank — it names "the Wall" and
      counts down.
- [x] **After it lands**: the FINISHED sentence rather than the empty-board one.
- [x] **Saves that must not throw**: `expedition` deleted entirely (renders; the state still has no
      `expedition` key afterwards); a fresh Act I save (renders, names no destination); Act VII with
      no tank, no pad and no launch history.
- [x] **Corruption**: `clock: 'lots'` yields a finite countdown; `arrivesAtClock: null` reads as due
      with `progress` 1 rather than `NaN` and says "Landing". Both cases make `nextArrivalClock()`
      return `Infinity` — asserted, because that is exactly why it is not the panel's source.
- [x] **The reducer**: a replayed commit returns the identical object by `===` and neither
      double-debits nor writes a second record; a malformed offer id and a below-threshold commit
      both come back identical by `===`.
- [x] **The confirm surface**: mounted directly with the props the panel passes, since local state a
      static render cannot toggle. It names both ends of the leg, quotes the spend AND the threshold
      it is not, says there is no change, says what stays behind, and dresses the accept `btn danger`.
- [x] Purity: a full render plus both accessors leave the state byte-for-byte unchanged.

## 7. Found and fixed

- [x] **The offer row carried `originSiteId` but no `originLabel`**, so the confirm surface rendered
      "out of **undefined**" for every launch in the game. Found by mounting `common/Modal.js` with
      the props the panel passes it — no amount of rendering the PANEL would have caught it, because
      the confirm lives in local state a static render cannot toggle. `originLabel` now sits on the
      row beside `destinationLabel`.

## 8. Out of scope, deliberately

- [ ] **No balance retune.** No threshold, transit window, overshoot slope, colonization cost or
      upkeep factor moved. §7.5's measurements and the act's 4.86h-against-5.00h margin stand
      untouched, and every number this screen prints is read from the tables they were taken against.
- [ ] **No cancel.** `ABORT_LAUNCH` does not exist and its absence is the design — see Decision 8 and
      the proposal.
- [ ] **No arrival surface.** `resolveArrivals()` runs from `advance()`; the player meets the landing
      on the Sites tab and in the event feed.
- [ ] **No time-to-threshold estimate.** It divides a shortfall by a solve output that moves whenever
      anything is built; it would put a promise on screen that the next purchase invalidates.
- [ ] `PlaceholderPanel.js` and `ACT_SEVEN_PLACEHOLDER_NOTE` untouched — retiring them belongs to
      STORY-040, which removes the last placeholder. Only the `launch` `blurb` comment was annotated.
