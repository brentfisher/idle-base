const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { listOffers } = require('../../engine/contracts');
const { contractCopy, MAX_ACTIVE_CONTRACTS } = require('../../data/actSevenContractsConfig');

// The contract board — organisational paperwork, paid in Fuel (PRD §6.4, §9). Last in the tab order,
// and §6.4 is explicit about why: it is the ONLY PURELY OPTIONAL TAB IN THE ACT.
//
// THAT IS THIS SCREEN'S DESIGN CONSTRAINT AND NOT A FOOTNOTE. A player who never opens this tab
// still finishes, slowly — Decision 3.6 applied to the fuel economy. So the board has to read as an
// OPPORTUNITY and never as a chore the act is withholding progress behind, because those two are
// the same list of rows and differ only in how the screen frames them. A board that opened with
// "3 assignments outstanding" would convert an offer into an obligation and would make every player
// who ignores it feel behind, which is the precise failure §9.1 is guarding against. Hence
// `optionalNote` at the top, before any row: nothing here is required.
//
// IT RESOLVES NOTHING. engine/contracts.js's listOffers() emits presentation-ready rows — the name,
// the brief, the terms, the payout as a finished string, the progress with its own label, the
// refusal as a sentence — and this file renders them verbatim. §9.6 specifies that contract, and
// the reason it matters here more than on most panels is that a surface running its own arithmetic
// would eventually disagree with the engine about WHETHER A PAYOUT FITS, which is the one
// disagreement that costs the player Fuel.
//
// ONE SOLVE FOR THE WHOLE BOARD, and it is the engine's doing rather than this file's discipline:
// listOffers() calls colonyRates() once and threads it into every row. Twelve rows resolved
// independently would be twelve Kleene fixed points per render, on a panel the tick re-renders.
//
// THE PAYOUT IS `effect` AND NEVER `payoutFuel`, AND THIS IS THE ONE RULE IN THE FILE THAT WOULD
// FAIL SILENTLY. §9.5: for Player To Be Named Later, "the band is displayed on the board; the draw
// is not revealed until claim." The draw is rolled inside accept(), so an OFFERED ptbnl row carries
// a `payoutFuel` that is neither the band nor what will actually be paid — measured on this branch:
// the row reads 1,000 while the band is 750-1,500 and a roll of 0.5 pays 1,125. `effect` is the
// field that carries the branch holding that rule. Rendering the bare number instead would print a
// figure that is simply wrong, and would look entirely reasonable in review.
//
// NO Date.now() AND NO COMPONENT TIMER. Every duration on this screen — the offer deadline, the
// window remaining, the hold accumulated — arrives already formatted from the engine, measured
// against `state.clock`. This component re-renders when the tick reducer produces a new state.
//
// LEDGER R3: payouts resolve PER LAUNCH, not per phase. Nothing here renders a phase, groups by
// one, or implies that a phase boundary settles anything — a per-phase reading would be a different
// game, and the row's `phase` field is deliberately not drawn.

// One row's progress. Rendered only where the engine gave a quantity to render.
//
// A `state` contract has no bar and gets none: progressFor() says it in its own words — "a `state`
// contract is a condition, not a quantity. It has no bar; it has an answer." A half-full bar under
// "have any three modules online simultaneously" would invent a middle the engine does not model.
// The test lives in data/actSevenContractsConfig.js's showsBar() rather than in this JSX, because
// which rows have a quantity is a rules question.
function ContractProgress({ row }) {
  return (
    <div className="v7-contract-progress">
      {contractCopy.showsBar(row) ? (
        /* DIVS, NOT SPANS. STORY-034's `.v7-meter` sets a height and `position: relative` but no
           `display`, so on an inline element the height is ignored and the bar does not exist —
           OpsPanel's note records walking into exactly this. */
        <div className="v7-meter">
          <div
            className="v7-meter-fill"
            style={{ width: `${(row.progress.pct * 100).toFixed(1)}%` }}
          />
        </div>
      ) : null}
      <span className="v7-contract-progress-label">{row.progress.label}</span>
    </div>
  );
}

// One assignment. Every string on it is the engine's or the config's; the only decision made here is
// which blocks to render.
function ContractRow({ row, dispatch }) {
  const status = contractCopy.statusFor(row);

  return (
    <div className={'v7-contract is-' + status.id}>
      <div className="v7-contract-head">
        <span className="v7-contract-name">{row.name}</span>
        {/* NO MAKEUP BADGE. §9.4's rescheduled offer already states itself twice on this card
            before any marker: the name reads "Makeup Game: Bus Trip" and the brief opens
            "Rescheduled: Bus Trip. Same terms. Longer window." A third would be one fact three
            times, and `row.makeup` is deliberately not drawn. */}
        <span className={'v7-contract-status is-' + status.id}>{status.label}</span>
      </div>

      <div className="v7-contract-brief">{row.brief}</div>
      {/* The terms sit apart from the brief and in full ink: the brief is why the Office wants it,
          the terms are what you actually have to do, and a player deciding whether to spend a slot
          is reading the second. */}
      <div className="v7-contract-terms">{row.terms}</div>

      {/* THE PAYOUT, AS THE ENGINE'S FINISHED STRING. See the note at the head of the file — this is
          `effect` and never `payoutFuel`, because for an offered PTBNL the two disagree and only
          this one honours §9.5. */}
      <div className="v7-contract-effect">{row.effect}</div>

      {/* Omitted rather than rendered as "no deadline": most offers have none, and an absent
          deadline is the default rather than a fact worth a line. Accepting discharges it — the
          engine nulls the field the instant a row goes active — so this cannot survive acceptance
          and needs no status test of its own. */}
      {row.expiresInSeconds !== null ? (
        <div className="v7-contract-expiry">{contractCopy.expiresLabel(row.expiresInSeconds)}</div>
      ) : null}

      {/* HIDDEN ON AN OFFERED WINDOW ROW, and the reason is in showsProgress(): the engine's
          fallback reports "10:00 remaining" for a clock that is not running, one line from a real
          countdown. Nothing is lost — every one of those contracts states its window in its own
          `terms` — while a delivery row's "150 of 150 on hand" is true at this instant and is
          exactly what a player deciding whether to take it is reading. */}
      {contractCopy.showsProgress(row) ? <ContractProgress row={row} /> : null}

      {/* THE ROW IS SHOWN WITH ITS REASON RATHER THAN DISABLED IN SILENCE. §9.6 authors the five
          refusals as SENTENCES rather than codes for exactly this — a player reading "slots" learns
          nothing, and two of the three actionable ones ("you do not have the goods on hand", "the
          payout will not fit in the tank") name something the player can go and fix. The tank
          refusal in particular is the load-bearing one: nothing is lost by refusing, the contract
          stays claimable forever, and the sentence says so. */}
      {row.refusalReason ? (
        <div className="v7-contract-refusal">{row.refusalReason}</div>
      ) : null}

      <div className="v7-contract-actions">
        {/* Each control is gated on the engine's own flag, so the only way to reach a reducer's
            refusal is a stale render — which state/actions/contractActions.js turns into a no-op by
            identity. The three are separate actions because they are three different decisions
            refused for three different reasons; see the block on them in state/actionTypes.js. */}
        {row.status === 'offered' ? (
          <button
            type="button"
            className="v7-contract-button"
            disabled={!row.acceptable}
            onClick={() => dispatch({ type: actionTypes.ACCEPT_CONTRACT, contractId: row.id })}
          >
            {contractCopy.acceptLabel}
          </button>
        ) : null}

        {row.status === 'claimable' ? (
          <button
            type="button"
            className="v7-contract-button is-claim"
            disabled={!row.claimable}
            onClick={() => dispatch({ type: actionTypes.CLAIM_CONTRACT, contractId: row.id })}
          >
            {contractCopy.claimLabel}
          </button>
        ) : null}

        {row.abandonable ? (
          <button
            type="button"
            className="v7-contract-button is-abandon"
            onClick={() => dispatch({ type: actionTypes.ABANDON_CONTRACT, contractId: row.id })}
          >
            {contractCopy.abandonLabel(row.status)}
          </button>
        ) : null}
      </div>

      {/* Walking away is free, and saying so is not decoration: a player who suspects a penalty will
          hoard a slot on an assignment they cannot finish, which is the one way this optional board
          can actually cost somebody something. KEYED ON STATUS, because "the slot comes back" is
          true of an accepted assignment and false of an offer — the ceiling counts what you have
          taken, and declining returns nothing because nothing was spent. */}
      {row.abandonable ? (
        <div className="v7-contract-abandon-note">{contractCopy.abandonNote(row.status)}</div>
      ) : null}
    </div>
  );
}

function ContractsPanel() {
  const { state, dispatch } = useGame();
  // listOffers() reaches the slice through engine/colony.js's expeditionSlice() and gates on the
  // act's own feature id, so it returns [] for every save before Act VII and for a save with no
  // `expedition` key at all. Saves are never migrated in this codebase, so absent must read as
  // empty — and it does so in the accessor rather than in a guard on this line.
  const rows = listOffers(state);

  return (
    <div className="panel">
      <h2>{contractCopy.title}</h2>
      <p className="muted">{contractCopy.subtitle}</p>

      {/* BEFORE ANY ROW, because it is what the rows MEAN rather than a note about them. */}
      <p className="v7-contract-optional">{contractCopy.optionalNote}</p>
      {/* THE TWO PREAMBLE LINES SAY DIFFERENT THINGS AND BOTH ARE NEEDED. `optionalNote` is about
          the BOARD — none of this is required, and the run finishes without any of it. `panelIntro`
          is the Office's standing boilerplate about an ACCEPTED assignment — not finishing one is
          not held against you. A player can believe the second and still feel behind for ignoring
          the first, which is the exact failure §9.1 guards against, so the plain statement goes
          above the form language rather than being folded into it. `panelIntro` was authored by
          STORY-030 for this screen and is rendered rather than restated. */}
      <p className="muted">{contractCopy.panelIntro}</p>
      <p className="muted">{contractCopy.slotsNote(MAX_ACTIVE_CONTRACTS)}</p>

      {/* An empty board is a real and frequent state — the board refreshes on its own clock, and a
          player who has accepted both slots' worth sees the rest of it empty. A sentence rather than
          an empty div, and one written in the Office's voice rather than the app's: nothing is
          wrong, there is simply nothing outstanding. */}
      {rows.length > 0
        ? rows.map((row) => <ContractRow key={row.id} row={row} dispatch={dispatch} />)
        : <p className="muted">{contractCopy.boardEmpty}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// VERIFIED (STORY-040), under `node`. This repo has no test runner and `npm run build` transforms
// JSX without ever MOUNTING it, so a throw on mount ships with a green build — STORY-032 hit exactly
// that, and every panel story since has recorded it. The harness below was run (165 assertions, all
// passing) and then deleted; what it asserted is the record. It drove the engine and the reducer
// directly AND mounted this component through react-dom/server inside a GameContext, across twelve
// fixtures, asserting every displayed string against the ENGINE'S OWN RETURN VALUE rather than
// against a hardcoded list.
//
// AN EMPTY BOARD — the state the tab opens in and returns to constantly, since the board refreshes
// on its own clock: the authored empty sentence, no buttons at all, and the three preamble lines.
// The optional statement is asserted present AND asserted not to be `.muted`, because "the player
// skims past it" is the failure it exists to prevent.
//
// A POPULATED BOARD — refreshBoard() placed Rehab Assignment, Bus Trip and Innings Limit. Every
// name, brief, terms and payout string on screen was compared against the row the engine returned.
// Three Accept buttons, no File-it button. THE PHASE IS ABSENT FROM THE MARKUP, asserted by string
// — ledger R3 resolves payouts per LAUNCH and a screen that grouped or labelled by phase would be
// describing a different game.
//
// THE OFFERED-WINDOW CLOCK THAT IS NOT RUNNING — a defect this file used to have. progressFor()
// falls back to `remainingLabel(total)` for a `window` or `expedition` row that is not yet ACTIVE,
// so the board printed "10:00 remaining" on an assignment nobody had accepted, one line from
// `expiresLabel`'s real countdown. Two opposite time semantics in identical treatment. Asserted now:
// the engine still reports it, showsProgress() refuses it, THE STRING IS NOT IN THE MARKUP, and the
// row's own terms ("600 seconds with no manual click") carry the window instead. Accepting brings
// the block back, and its countdown is then on screen. A delivery row KEEPS its progress while
// offered — "150 of 150 Provisions on hand" is true at that instant and is what a player deciding
// whether to take it is reading — so the suppression is a decision and not a blackout.
//
// A MAKEUP GAME (§9.4). Rendered before deciding rather than reasoned about: the name already reads
// "Makeup Game: Bus Trip" and the brief already opens "Rescheduled: Bus Trip." A badge would have
// been one fact three times on one card, so `row.makeup` is deliberately not drawn and the copy
// authors no badge — asserted by `makeupBadge === undefined`.
//
// THE `majors` ROTATING ROW, which is the only `kind` path no other fixture reaches. definitionFor()
// merges the drawn template's kind over the base, so `rotating` never survives to listOffers()'s
// ternary and the row arrives as whatever was drawn — sustain, window or expedition. All five
// templates were rendered: each resolves to its template's kind, each renders its own terms and
// payout, and the progress gating agrees with the drawn kind rather than the base's. Also asserted
// repeatable, because writing an endless row into the payout-once ledger would end the endless act.
//
// PTBNL, AND THIS IS THE FIXTURE THE FILE'S CENTRAL RULE EXISTS FOR (§9.5). An offered `ptbnl` row
// carries `payoutFuel: 1000`, its `effect` reads "+750-1500 Fuel, consideration to follow", and a
// roll of 0.5 at accept pays 1,125. So the bare field is neither the band nor the payout. Asserted:
// the band is on screen and THE STRING "+1000 Fuel" IS NOT. After accepting, the row quotes 1,125
// and the panel shows it — the draw is revealed at claim time and not before.
//
// ACTIVE AND CLAIMABLE, through the real reducer:
//   * accepting flips the status and DISCHARGES THE DEADLINE (§9.4: "an accepted contract never
//     expires"). The deadline line is asserted gone from the markup for that row.
//   * an active row keeps its walk-away control and its reassurance — and BOTH ARE KEYED ON STATUS.
//     abandon() takes an offered row and an active row down one path, but they are not one act to a
//     player: an offer is DECLINED and an assignment is DROPPED. More importantly "the slot comes
//     back" is TRUE of an active row and FALSE of an offer, because the two-slot ceiling counts what
//     has been accepted — declining returns nothing, since nothing was spent. Asserted in both
//     directions: the active row says Drop and promises the slot, the offered row says Decline and
//     does not, and the string "slot comes back" appears nowhere on an offered board.
//   * delivering the goods and stepping advanceContracts() flips it claimable: the File-it button
//     appears, the pill reads Complete, and the card takes `is-claimable`.
//   * claiming REMOVES the instance and writes the id into `contractBoard.completedIds`. The panel
//     stops rendering it, and a REPLAYED claim returns the identical state object by `===` —
//     payout-once is structural rather than guarded.
//   * THE FIXTURE OWNS A FUEL BLADDER AND THAT IS NOT SCENERY. Fuel's base capacity is 0 and
//     creditResource() refuses rather than clamping, so without a tank every payout on this board
//     is refused and the fixture would have asserted nothing about claiming. That refusal is
//     exercised deliberately below instead.
//
// THE REFUSALS, RENDERED VERBATIM — §9.6 authors them as sentences rather than codes precisely so a
// panel can print them:
//   * `slots`: two accepted, and the third offer comes back refused with its Accept disabled.
//   * `tank`: a 900-Fuel payout into a colony with no tank. THE LOAD-BEARING ONE — creditResource()
//     refusing is what stops 900 Fuel being destroyed at the moment it is earned — and the reducer
//     returns the identical state object, so a refused claim has taken nothing.
//
// THE `state` KIND HAS AN ANSWER, NOT A BAR. Spring Invitation renders NO `.v7-meter` anywhere in
// the markup, asserted by absence, and prints the engine's answer label instead. A quantity row in
// the same run DOES draw one, so the absence is a decision rather than a missing feature.
//
// THE SAVES THAT MUST NOT THROW: `expedition` deleted entirely (renders, and the state still has no
// `expedition` key afterwards); a fresh Act I save, where isLive() is false and the board is empty;
// and `clock: 'lots'`, which renders with NO "NaN" anywhere — every duration on this screen is
// formatted by the engine's formatClock(), which guards a non-finite input into '0:00'.
//
// THE PLACEHOLDER REMOVAL, CHECKED RATHER THAN ASSUMED. PlaceholderPanel.js is gone;
// ACT_SEVEN_PLACEHOLDER_NOTE, getActSevenPanel, `blurb` and `title` are gone from
// data/actSevenPanels.js; and a comment-stripped sweep of every .js file under src/ finds no
// remaining reader of any of them. Comments are stripped because that file's own header now ARGUES
// these symbols have no reader, and an unstripped sweep would find the argument and call it one.
//
// AND THE THREE ID LISTS STILL AGREE — the check §6.4 asks for, because two of the three FAIL
// SILENTLY: a missing key in AppShell's PANELS map renders nothing, a missing TabNav entry makes the
// tab unreachable, and `npm run build` catches neither. All seven ids are present in both
// directions, all seven are unique, all seven carry a label, and TabNav still loads. TabNav spreads
// this list rather than restating it, so PANELS is the only hand-authored one and it is the one the
// sweep compares against.
//
// PURITY AND HYGIENE: a full render plus listOffers() leave the state byte-for-byte unchanged. The
// component's code contains no `Date.now`, no timer, no `PlaceholderPanel`, and — asserted
// explicitly — NO READ OF `payoutFuel`, `payoutSalvage` OR the row's `phase`. The new CSS sits above
// the file's closing `@media (max-width: 640px)`, every rule is scoped to `body.expedition`, and the
// section uses no `!important`.
// ---------------------------------------------------------------------------------------------

module.exports = ContractsPanel;
