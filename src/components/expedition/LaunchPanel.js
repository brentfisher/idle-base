const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const Modal = require('../common/Modal');
const { listOffers, inFlightReadout } = require('../../engine/launch');
const { opsReadout } = require('../../engine/colonyReadout');
const { LAUNCH_FUEL_RESOURCE } = require('../../data/actSevenLaunchConfig');
const { MAJORS_PHASE } = require('../../data/actSevenConfig');
const { launchPanelCopy } = require('../../data/actSevenLaunchPanelConfig');

// The Fuel threshold and the burn that spends it (PRD §6.4, §7.3). The screen that answers *can I
// go?*, against the Sites tab's *where am I?* — §6.4 splits them on that question and defends the
// split as a tab-budget decision, and this half is the one that spends.
//
// THE UI CREATES THIS DECISION RATHER THAN REPORTING IT, AND THAT IS THE WHOLE STORY OF THE FILE.
// §7.3 gives every site a launch tank holding 1.6x the threshold of the burn DEPARTING from it, and
// committing dumps the tank rather than the threshold — there is no change. So the player's real
// question is never "may I go" but "do I go now, or hold six more minutes and arrive with the
// margin that pays for half the colonization". A panel that printed `1,500 / 1,200 — ready` would
// be perfectly accurate and would delete that decision, because the decision only exists if the
// room above the line is visible. Hence the BAND: threshold at one end, ceiling at the other, and
// the fill somewhere between them.
//
// THE 1.6 APPEARS NOWHERE IN THIS FILE OR ITS COPY. `tankCeiling` comes off the offer row, out of
// the same expression in engine/launch.js's overshootFor() that clamps the spend, so the band drawn
// here and the Fuel actually debited are the same number by construction. Ledger R1 derives the
// tank from the threshold precisely so the two cannot drift; restating the multiplier in a
// component would recreate that drift one layer along, where none of the act's measurements would
// catch it.
//
// TWO SOURCES, NEVER ONE DERIVED FROM THE OTHER — the same constraint SitesPanel works under, in a
// sharper form. `listOffers()` answers WHAT COMMITTING NOW WOULD DO; `inFlightReadout()` answers
// WHAT IS HAPPENING. They are not two views of one thing:
//
//   * during any burn, the shop row still resolves (the destination is still unreached) but every
//     figure on it is recomputed from the Fuel held right now — a hypothetical NEXT burn. Rendering
//     its transit mid-flight would put a window on screen that nothing is flying.
//   * after the fifth burn is committed the shop returns NOTHING AT ALL: every rung is reached and
//     the wall is spent, so `currentLeg()` is null. Measured. Without the second source this panel
//     would go blank for the twelve minutes of the last burn in the game.
//
// So a flight in progress replaces the commit surface entirely, rather than sitting beside it.
//
// IT DECIDES NOTHING AND MULTIPLIES NOTHING. Every threshold, ceiling, spend, ratio, transit and
// grant arrives already resolved from engine/launch.js. The only computation below is turning two
// engine numbers into a CSS width, which is the same line ResourceChips and OpsPanel draw: a
// fraction to a percentage decides nothing about the burn.
//
// NO Date.now() AND NO COMPONENT TIMER. The countdown is `secondsRemaining` off the readout, which
// is a subtraction against `state.clock` performed in the engine — see the note there for why it
// lives with the guard rather than on a screen. This component re-renders when the tick reducer
// produces a new state, which is exactly as often as the number changes.

// A meter width, as a percentage string. Guarded on the denominator because `tankCeiling` is 0 for
// a leg with no departing threshold, and clamped at 100 because a player with Cryo storage holds
// more Fuel than the band can take — the overflow is real, it simply is not part of this bar.
function widthPercent(part, whole) {
  if (!Number.isFinite(whole) || whole <= 0) return '0%';
  const fraction = Math.min(1, Math.max(0, part / whole));
  return (fraction * 100).toFixed(1) + '%';
}

// The tank, before any tank exists. §5.5 and ledger R1: Fuel's base capacity is 0, so Fuel is
// discarded as fast as it is made and the threshold below is not a target the player is approaching
// slowly — it is unreachable. That is the single fact gating the entire launch system and it is
// invisible everywhere else in the app; the Ops panel prints "0/0", which is correct and explains
// nothing.
//
// Gated on the engine's CAPACITY rather than on owning a particular module, so it stays true if the
// ladder ever grows a second way to hold propellant.
function NoTankNotice() {
  return (
    <div className="v7-launch-notank">
      <h3>{launchPanelCopy.noTankTitle}</h3>
      {launchPanelCopy.noTankLines.map((line, i) => <p key={i}>{line}</p>)}
      <p className="v7-launch-notank-fix">{launchPanelCopy.noTankFix}</p>
    </div>
  );
}

// The band — the point of the screen. Three figures and one bar: what is in the tank, the line that
// makes a burn legal, and the ceiling the tank stops at.
//
// THE MARKER IS DRAWN, NOT DESCRIBED. `.v7-meter` is already `position: relative` (STORY-034), so
// the threshold rides inside it as an absolutely positioned rule at `threshold / ceiling` of the
// width. A bar with a line across it says "you are past this / you are not" in one glance and
// "there is this much room left" in the same glance, which is the pair of facts the decision needs
// and which no arrangement of two numbers conveys as fast.
//
// DIVS, NOT SPANS, INSIDE THE METER. STORY-034's primitive sets a 6px height and no `display`, so
// an inline child drops the height and the bar does not exist — OpsPanel's note records walking
// into exactly this.
function Band({ offer }) {
  return (
    <div className="v7-launch-band">
      <div className="v7-launch-band-figures">
        <span className="v7-launch-band-held">
          <span className="v7-launch-band-label">{launchPanelCopy.heldLabel}</span>
          {launchPanelCopy.fuelFigure(offer.fuelHeld)}
        </span>
        <span className="v7-launch-band-figure">
          <span className="v7-launch-band-label">{launchPanelCopy.thresholdLabel}</span>
          {launchPanelCopy.fuelFigure(offer.fuelRequired)}
        </span>
        <span className="v7-launch-band-figure">
          <span className="v7-launch-band-label">{launchPanelCopy.ceilingLabel}</span>
          {launchPanelCopy.fuelFigure(offer.tankCeiling)}
        </span>
      </div>

      <div className="v7-meter v7-launch-meter">
        {/* The bar changes character at the one boundary that matters. `.v7-meter-fill` is already
            the act's good colour, so the legal state needs no class at all; below the threshold it
            takes `is-drain`, which is honest — Fuel under the line is not progress toward a choice,
            it is progress toward HAVING one. */}
        <div
          className={'v7-meter-fill' + (offer.affordable ? '' : ' is-drain')}
          style={{ width: widthPercent(offer.fuelHeld, offer.tankCeiling) }}
        />
        <div
          className="v7-launch-mark"
          style={{ left: widthPercent(offer.fuelRequired, offer.tankCeiling) }}
        />
      </div>

      <p className="muted">{launchPanelCopy.bandNote}</p>

      {/* Only where there is genuinely Fuel above the band, which is nowhere until §5's Cryo rows
          are built. The reassurance is the engine's own reading of its clamp: what is above the
          tank was never in it, and it is waiting at the next rung as a head start. */}
      {offer.fuelLeftBehind > 0 ? (
        <p className="v7-launch-surplus">{launchPanelCopy.surplusStaysNote(offer.fuelLeftBehind)}</p>
      ) : null}
    </div>
  );
}

// What the surplus has bought at this exact fill, itemised, BEFORE the commit rather than after.
// §7.3's overshoot table is a line rather than a staircase, so these figures move continuously as
// the tank fills and the player can watch the price of waiting.
//
// At the floor the block says so in one sentence instead of listing zeroes — a row reading
// "0% shorter, +0 Salvage" reads as a broken feature, where its absence reads as what it is, which
// is a burn leaving on the minimum.
// ITEMISED EVEN WHILE THE BURN IS REFUSED, and that is a decision rather than an oversight. At every
// rung above the first the player arrives with no pad, so the reach refusal ("Build The Mound
// first") is the NORMAL state of this screen for as long as that pad takes to buy — and it is
// exactly then that the surplus block is doing its most useful work, because it is what tells the
// player that continuing to fill is worth something. Suppressing it while blocked would hide the
// reason to keep filling at the one moment there is nothing else to do.
function Buys({ offer }) {
  const overshooting = offer.transitSeconds < offer.baseTransitSeconds;

  return (
    <div className="v7-launch-buys">
      <h3>{launchPanelCopy.buysTitle}</h3>
      {overshooting ? (
        <React.Fragment>
          <p className="v7-launch-buys-line">{launchPanelCopy.buysRatio(offer.overshootRatio)}</p>
          <p className="v7-launch-buys-line">
            {launchPanelCopy.buysTransit(offer.transitSeconds, offer.baseTransitSeconds)}
          </p>
          {/* The wall pays no grant, and `colonizeCost: 0` is the correct value rather than a
              placeholder — nobody colonizes it. Said in words rather than left as a missing line,
              because an absent figure on the one burn that matters most would read as a bug at the
              moment the player is reading hardest. */}
          {offer.arrivalGrant > 0
            ? <p className="v7-launch-buys-line">{launchPanelCopy.buysGrant(offer.arrivalGrant)}</p>
            : <p className="muted">{launchPanelCopy.buysNoGrant}</p>}
        </React.Fragment>
      ) : (
        <p className="muted">{launchPanelCopy.buysNothing}</p>
      )}
    </div>
  );
}

// The burn under way. Replaces the commit surface entirely rather than sitting beside it — see the
// two-sources note at the head of the file.
//
// THE COUNTDOWN IS THE ENGINE'S. `secondsRemaining` is computed in engine/launch.js against
// `state.clock`, so a save with a corrupt clock yields a finite number rather than NaN, and a
// window-less record reads as landing rather than counting down from nothing.
function InFlight({ flight }) {
  return (
    <div className="v7-launch-flight">
      <div className="v7-launch-flight-head">
        <h3>{launchPanelCopy.inFlightTitle}</h3>
        <span className="v7-launch-flight-clock">
          {flight.secondsRemaining > 0
            ? launchPanelCopy.remainingLabel(flight.secondsRemaining)
            : launchPanelCopy.landingLabel}
        </span>
      </div>

      <div className="v7-launch-flight-leg">
        {launchPanelCopy.inFlightLeg(flight.originLabel, flight.destinationLabel)}
      </div>

      <div className="v7-meter v7-launch-meter">
        <div className="v7-meter-fill" style={{ width: widthPercent(flight.progress, 1) }} />
      </div>

      <p className="v7-launch-buys-line">
        {launchPanelCopy.inFlightSpent(flight.fuelSpent, flight.overshootRatio)}
      </p>
      {flight.arrivalGrant > 0 ? (
        <p className="v7-launch-buys-line">{launchPanelCopy.inFlightGrant(flight.arrivalGrant)}</p>
      ) : null}

      {/* §7.2's SHARPEST RULE, said on the one screen where a worried player would most expect it to
          be false. Reach is a function of the built pad tier alone; a starved network launches LATER
          and never SHORTER, and nothing that happens to the colony during a transit can touch a burn
          already in the air. The engine holds that invariant; this is where the player is told. */}
      <p className="muted">{launchPanelCopy.inFlightSafeNote}</p>
      <p className="muted">{launchPanelCopy.inFlightOneNote}</p>
    </div>
  );
}

// The commit surface: the button that does not spend, and the sentence that says what spending
// means. `blockedReason` is the engine's single statement of all three refusals (a burn already
// under way, a pad that does not throw that far, a tank under the line) and is rendered rather than
// re-derived.
//
// THE ROW IS SHOWN WITH A REASON RATHER THAN HIDDEN, which is engine/launch.js's deliberate
// divergence from every other shop in the act and is argued there: the launch shop has exactly one
// row, so omitting it leaves an empty panel on the tab whose whole subject is the thing the player
// is waiting for.
function Commit({ offer, onCommit }) {
  return (
    <div className="v7-launch-commit">
      {/* Before the irreversible action and not after it. §7.3's spend is the act's one
          unrecoverable decision and the tank/threshold gap is exactly the part a player would
          assume works the other way. */}
      <p className="v7-launch-spend">{launchPanelCopy.spendNote}</p>

      {offer.blockedReason ? (
        <p className="v7-launch-blocked">{offer.blockedReason}</p>
      ) : null}

      {/* Disabled on the engine's own refusal, so the only way to reach purchase()'s null is a stale
          render — which state/actions/launchActions.js turns into a no-op by identity. */}
      <button
        type="button"
        className="v7-launch-button"
        disabled={!!offer.blockedReason}
        onClick={onCommit}
      >
        {launchPanelCopy.commitLabel}
      </button>
    </div>
  );
}

function LaunchPanel() {
  const { state, dispatch } = useGame();
  // Local, and deliberately not in the save. A half-opened confirm is not a fact about the run —
  // AppShell holds the call-up's `confirmingCallUp` the same way, for the same reason.
  const [confirming, setConfirming] = React.useState(false);

  // ONE SOLVE PER RENDER, AND IT IS HERE FOR THE FUEL CEILING RATHER THAN FOR RATES. colonyRates()
  // is a 16-pass Kleene fixed point and OpsPanel's header argues that one per render is the budget
  // for the panel that is open continuously; this one is not that panel, and it needs exactly two
  // things a shop row cannot carry — whether Fuel has anywhere to go at all (capacity 0 until the
  // first tank, which is the gate on the whole launch system) and which phase the run is in. Taking
  // opsReadout() rather than listResources() gets both from the single solve; the alternative pair
  // of calls would take two.
  const readout = opsReadout(state);
  const fuelRow = readout.rows.find((row) => row.id === LAUNCH_FUEL_RESOURCE) || null;

  // Both accessors reach the slice through engine/colony.js's expeditionSlice(), which is what makes
  // this panel correct against a save with no `expedition` key at all — saves are never migrated in
  // this codebase, so absent must read as empty, and it does so in the accessor rather than in a
  // guard on this line.
  const flight = inFlightReadout(state);
  const offer = listOffers(state)[0] || null;

  // A confirm surface can outlive the row it was opened on: a tick can land an arrival, or a
  // replayed dispatch can put a burn in the air, between the click and the render. Gated on the
  // offer still being committable rather than on the flag alone, so the modal cannot ask the player
  // to confirm a burn the engine would now refuse.
  const confirmable = !!offer && !offer.blockedReason && !flight;

  return (
    <div className="panel">
      <h2>{launchPanelCopy.title}</h2>
      <p className="muted">{launchPanelCopy.subtitle}</p>

      {flight ? <InFlight flight={flight} /> : null}

      {!flight && offer ? (
        <React.Fragment>
          <div className="v7-launch-destination">
            <span className="v7-launch-band-label">{launchPanelCopy.nextLabel}</span>
            <span className="v7-launch-destination-name">{offer.destinationLabel}</span>
          </div>
          <p className="muted">{launchPanelCopy.destinationNote}</p>
          <p className="v7-launch-leg">{offer.description}</p>

          {/* The tank that does not exist yet, ABOVE the band rather than below it. A player whose
              ceiling is 0 is not reading the band; they are reading why the band does not move. */}
          {fuelRow && fuelRow.capacity <= 0 ? <NoTankNotice /> : null}

          <h3>{launchPanelCopy.bandTitle}</h3>
          <Band offer={offer} />
          <Buys offer={offer} />
          <Commit offer={offer} onCommit={() => setConfirming(true)} />
        </React.Fragment>
      ) : null}

      {/* No leg and nothing in the air: every save before Act VII, and the run that has already
          thrown its last burn and watched it land. The two read very differently to a player, so
          they are two sentences — "nothing on the board" would be the wrong reading of a finished
          ladder, which is the opposite of a failure. */}
      {!flight && !offer ? (
        <p className="muted">
          {readout.phase === MAJORS_PHASE ? launchPanelCopy.finishedNote : launchPanelCopy.emptyNote}
        </p>
      ) : null}

      {/* CallUpModal's precedent (§6.4): the button that spends opens a surface, and only the
          surface dispatches. Closing it — backdrop, or the decline label — costs nothing, so a
          mis-tap on the commit button is free. `btn danger` because this is the act's one
          irreversible spend and the app already dresses that decision that way. */}
      {confirming && confirmable ? (
        <Modal
          title={launchPanelCopy.confirm.title}
          onClose={() => setConfirming(false)}
          closeLabel={launchPanelCopy.confirm.declineLabel}
        >
          {launchPanelCopy.confirm.prose(offer).map((line, i) => <p key={i}>{line}</p>)}
          {offer.fuelLeftBehind > 0 ? (
            <p className="muted">{launchPanelCopy.surplusStaysNote(offer.fuelLeftBehind)}</p>
          ) : null}
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              setConfirming(false);
              dispatch({ type: actionTypes.COMMIT_LAUNCH, offerId: offer.id });
            }}
          >
            {launchPanelCopy.confirm.acceptLabel}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// VERIFIED (STORY-039), under `node`. This repo has no test runner and `npm run build` transforms
// JSX without ever MOUNTING it, so a throw on mount ships with a green build — STORY-032 hit exactly
// that, and STORY-036, STORY-037 and STORY-038 all record it. The harness below was run (137
// assertions, all passing) and then deleted; what it asserted is the record. It drove the engine and
// the reducer directly AND mounted this component through react-dom/server inside a GameContext,
// across fifteen fixtures. Every displayed figure was asserted against the ENGINE'S OWN RETURN
// VALUE rather than against a hardcoded number, because a hardcoded list cannot catch a panel that
// recomputed something.
//
// IT FOUND ONE REAL DEFECT, which is the reason for the paragraph above. The confirm surface names
// the site a burn departs from, and the offer row carried `originSiteId` but no `originLabel` — so
// the modal read "out of undefined" for every launch in the game. It renders in local state that
// renderToStaticMarkup cannot toggle, so no amount of rendering the PANEL would have caught it;
// mounting common/Modal.js with the same props the panel passes did. `originLabel` is now on the
// row beside `destinationLabel`.
//
// FRESH ACT VII — no tank, no Fuel, nothing built:
//   * Fuel's capacity is 0, and the no-tank block renders naming the FUEL BLADDER — read from
//     data/actSevenModulesConfig.js by id, never typed here. That zero is the gate on the whole
//     launch system (§5.5, ledger R1) and the Ops panel's "0/0" is the only other place it appears.
//   * the destination, the threshold and the ceiling in the markup are `listOffers()`'s
//     `destinationLabel`, `fuelRequired` and `tankCeiling` — compared against the engine's values,
//     not against 1,200 and 1,920.
//   * THE THRESHOLD MARKER SITS AT 62.5% AND THE ASSERTION IS `fuelRequired / tankCeiling`, not the
//     literal. That is the check that this panel reads the band rather than restating ledger R1's
//     1.6, and it is the one assertion in the set that would fail silently if someone "simplified"
//     the marker to a constant.
//   * the engine's `blockedReason` is rendered VERBATIM ("Tank at 0 of 1.20K. Keep filling.") and
//     the commit button is `disabled`. The spend note appears ABOVE the button in the markup —
//     asserted by string position, because "before the irreversible action" is the requirement.
//
// THE FOUR FILL STATES the AC names, all with a Fuel Bladder built:
//   * BELOW (900): the no-tank block is GONE, the fill is `900 / tankCeiling` and wears `is-drain`,
//     and the row is still blocked on the tank.
//   * AT THE THRESHOLD (1,200): ratio exactly 1.0, transit exactly the base window, button enabled.
//     THE MARKUP CONTAINS NO "0% shorter" ANYWHERE — the overshoot block is omitted at the floor
//     rather than rendered as a row of zeroes, which is engine/launch.js's own choice held on the
//     second surface.
//   * WITH SURPLUS (1,500): 1.25x, transit 162s against a 180s base (10% shorter, and 162 is the
//     engine's rounding), a 450 Salvage grant — 2.5 steps x 2% x 9,000 — and all three lines on
//     screen are the copy functions fed the engine's numbers.
//   * ABOVE THE BAND (5,000): the spend clamps to the 1,920 ceiling, the ratio pins at 1.6, the bar
//     clamps at 100%, and `fuelLeftBehind` is 3,080. This is the fixture the WORDING exists for —
//     §7.3's "dumps the whole tank" means the launch band, not everything held, and once §5's Cryo
//     rows exist the two diverge. Asserted: the spend note does not contain "everything you have",
//     the surplus-stays line is on screen, and the confirm quotes the SPEND rather than the holding.
//
// REACH-BLOCKED, WHICH IS THE NORMAL STATE AT EVERY RUNG ABOVE THE FIRST. A site is reached by a
// launch and arrives with no pad, so the screen sits here for as long as that pad takes to buy —
// On-Deck reached at tier 0, holding 10,000 against a 4,200 threshold:
//   * the leg has moved up a rung (First Base, departing The On-Deck Circle) and the refusal is the
//     REACH one, naming the pad: "The pad here does not throw that far. Build The Mound first." The
//     `noPad` fallback is asserted NOT to fire — every rung on today's ladder has a legal pad tier,
//     checked exhaustively, so `noPad` is a future-ladder branch and not this one.
//   * `affordable` is TRUE and the burn is still refused. The two are different questions and the
//     panel does not conflate them: the band is drawn, the button is disabled, and the reason is on
//     screen.
//   * THE SURPLUS IS STILL ITEMISED, deliberately — see the note on Buys. The overflow line reads
//     `10,000 - 6,720`, which is honest: nothing is lost by filling past the band while waiting.
//
// IN FLIGHT TO A SITE — committed through the real reducer, then read at clock 100 of a 162s window:
//   * the whole tank was debited (Fuel 0) and the record is `resolved: false`.
//   * the countdown is 62s and equals `arrivesAtClock - clock`. THE COMMIT SURFACE AND THE BAND ARE
//     BOTH ABSENT FROM THE MARKUP — a flight replaces them rather than sitting beside them.
//   * `fuelSpent` and the 450 grant are recomputed from the STORED RATIO and match the commit.
//   * THE STALE-ROW CHECK, which is why inFlightReadout() exists at all: `listOffers()` still
//     returns a row mid-flight, its `transitSeconds` differs from the flight's (it is priced off
//     the now-empty tank), and that hypothetical window is asserted ABSENT from the markup.
//   * REACH IS NOT DEGRADED BY STARVATION (§7.2's sharpest rule). With every resource zeroed the
//     countdown, the destination and the safety sentence are bit-for-bit what they were. A starved
//     network launches LATER, never SHORTER, and this screen never says otherwise.
//
// IN FLIGHT TO THE WALL — the case that cannot be read off a shop row:
//   * before commit, the wall's row pays NO grant (`colonizeCost: 0` is correct, not a placeholder)
//     and the panel SAYS so rather than omitting the line.
//   * committing sets `progression.milestones.overTheWall` — at commit, not arrival (§7.8).
//   * `listOffers()` THEN RETURNS ZERO ROWS, measured. The panel is nonetheless not blank: the
//     in-flight block renders, names "the Wall", and counts down. That is the twelve minutes of the
//     last burn in the game, and it was the finding that shaped this file.
//
// AFTER IT LANDS: no offers, nothing in flight, and the FINISHED sentence rather than the
// empty-board one — keyed on `majors`, because "nothing on the board" is the wrong reading of a
// ladder that is complete.
//
// THE SAVES THAT MUST NOT THROW:
//   * `expedition` DELETED entirely: renders, and the state object still has no `expedition` key
//     afterwards. The opening leg still resolves — Home Plate is `reachedAtStart` in config — so the
//     honest reading is the no-tank state, not an empty board.
//   * A FRESH ACT I SAVE: renders, names no destination, prints the empty-board sentence.
//   * Act VII with no tank, no pad and no launch history: renders.
//
// CORRUPTION, because a save is a file on somebody's disk:
//   * `clock: 'lots'` yields a FINITE countdown rather than NaN — which is the whole reason that
//     subtraction lives in engine/launch.js and not here.
//   * a record with `arrivesAtClock: null` reads as due: 0 remaining, progress 1 (not NaN), and the
//     screen says "Landing" for the one frame before resolveArrivals() clears it.
//   * BOTH OF THOSE CASES MAKE nextArrivalClock() RETURN Infinity, asserted. That is the function's
//     correct behaviour and exactly why it is not this panel's source.
//
// THE REDUCER: a commit advances state and debits the whole tank; a REPLAYED commit returns the
// IDENTICAL object by `===` and neither double-debits nor writes a second record (the gate is
// `blockedReason` finding the unresolved record, in front of the debit); a malformed offer id and a
// commit below the threshold both come back identical by `===`.
//
// PURITY AND HYGIENE: a full render plus both accessors leave the state byte-for-byte unchanged.
// The component's code contains no `Date.now`, no `setInterval`, no `setTimeout`, no
// `PlaceholderPanel`, NO 1.6, no threshold literal and no transit-window literal — checked with
// comments stripped, so the paragraphs arguing that 1.6 must not appear do not themselves trip the
// check. The new CSS sits above the file's closing `@media (max-width: 640px)` and every rule in it
// is scoped to `body.expedition`.
// ---------------------------------------------------------------------------------------------

module.exports = LaunchPanel;
