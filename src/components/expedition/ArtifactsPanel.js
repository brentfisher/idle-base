const React = require('react');
const { useGame } = require('../../state/GameContext');
const puzzleActions = require('../../state/actions/puzzleActions');
const { listPuzzles, listInstruments, solvedUnaided } = require('../../engine/puzzles');
const { artifactsCopy, feedbackLine, feedbackClass } = require('../../data/actSevenArtifactsConfig');

// The artifacts — the puzzle surface, the graded feedback, the hint ladder, the manual governor and
// the instrument shop (PRD §6.4, §8). A tab of its own rather than a section of Ops because a puzzle
// is READ, not monitored, and this is the one screen in the act a player stops moving to look at.
//
// THIS PANEL IS THE STORY, AND THE REASON IS §8.1's BINDING RULE: the GOAL may be unclear, the
// FEEDBACK never is. engine/puzzles.js grades every submission into one of five codes and hands back
// a code plus a KEY into an authored line table — SOLVED, NEAR, WRONG_KIND, OUT_OF_BAND, NULL — and
// a panel that collapsed those into "incorrect" would pass every engine check while throwing away
// the thing the whole system exists to do. Nothing below invents a rejection: every line the player
// reads is the engine's `lineId` rendered through data/actSevenArtifactsConfig.js, and NEAR and
// WRONG_KIND are drawn in different colours because "you have the right kind of answer" and "you are
// answering a different question" are different pieces of news.
//
// AND IT IS WHERE THE ANTI-SOFT-LOCK GUARANTEE BECOMES VISIBLE (design.md Decision 6, PRD §8.7).
// Three ways past every artifact — answer it, buy the ladder, or operate it manually until the panel
// gives up — and the third needs no answer, no Salvage and no purchase. All three are on every open
// row, and the guarantee is stated in words at the top of the screen, because a guarantee the player
// cannot see does not reassure anyone. Hiding the manual control to keep the puzzles "pure" would
// revoke a structural promise at the presentation layer, which is the one place it cannot be
// defended.
//
// RENDER ONLY, AND WITH ONE SHARP EDGE THAT IS NOT OBVIOUS. The usual rule holds — rows come from
// listPuzzles() with availability, prices, hint tiers, the governor and affordability already
// resolved, and nothing here recomputes any of them. The sharp edge is that answerFeedback() is pure
// and stateless and so a component COULD grade an answer locally, which would hand the player a free
// oracle and delete the attempt cooldown's whole reason to exist. Grading happens in the reducer,
// once, beside the attempt it belongs to: state/actions/puzzleActions.js argues it in full.
//
// NO TIMER AND NO Date.now(). Every countdown on this screen is a figure the engine derived from
// `state.clock`, which the tick advances, and engine/tickEngine.js already carries
// nextPuzzleCooldownClock() on its event-clock contributor list so a governor expiring lands a
// simulation step rather than being noticed late. A setInterval here would be a second clock that
// disagreed with the first one during an offline catch-up.
//
// AND NOTHING HERE WRITES ON A TICK. `expedition.puzzles` is written only from a player dispatch,
// which is what makes an eight-hour offline return unable to advance an attempt count or resolve an
// artifact. Every control below is an onClick or an onSubmit; there is no effect on this screen.

// The last thing the panel said, in the engine's own words. Rendered from the stored code and line
// id — never composed here — so one wrong answer cannot be phrased two ways by two surfaces.
//
// The MANUAL case is the one substitution, and it is not a re-grade. The engine grades an empty
// submission NULL and §8.2's authored NULL line is "THE PANEL READS FIGURES. IT READ NONE.", which
// is right for a fumbled submit and reads as a bug after a deliberate press of a control labelled
// OPERATE MANUALLY. Same code, same recorded attempt, different sentence.
function FeedbackLine({ feedback }) {
  if (!feedback) return null;
  const text = feedback.manual ? artifactsCopy.manualLine : feedbackLine(feedback.lineId, feedback.detail);
  // null means data drift — an id the engine resolved that the line table no longer carries — and
  // saying nothing beats printing `undefined` at the player. See feedbackLine().
  if (!text) return null;
  return (
    <div className={('v7-artifact-feedback ' + feedbackClass(feedback.code)).trim()}>{text}</div>
  );
}

// Three tiers, priced by the engine. `text` is null on every unbought tier and that is a hard rule
// rather than an optimisation — engine/puzzles.js withholds it so that prose the player has not
// bought never reaches the DOM for them to find in devtools — so an unbought row has nothing to
// render but its price.
//
// ONLY THE NEXT UNBOUGHT TIER CARRIES A BUTTON. buyHint() takes no tier and always buys
// `hintsBought + 1`, so a control on tier 3 would buy tier 1 and lie about what it did. The ladder
// is ordered and `bought` is the engine's, so "the next one" is the first row without it.
//
// GAP, RECORDED: hintRows() emits `tier`, `cost`, `bought` and `affordable` but no `next`/`buyable`
// flag, so that one derivation happens here. It is the shape of the ladder rather than a rule about
// prices, and it is the only thing on this screen the engine did not resolve.
function HintLadder({ row, resolved, onBuy }) {
  const next = row.hints.find((hint) => !hint.bought) || null;

  return (
    <div className="v7-artifact-hints">
      <div className="v7-artifact-sub">{artifactsCopy.hintsTitle}</div>
      <p className="muted">{artifactsCopy.hintsNote}</p>
      {row.hints.map((hint) => {
        const buyable = !resolved && next != null && next.tier === hint.tier;
        return (
          <div key={hint.tier} className={'v7-artifact-hint' + (hint.bought ? ' is-bought' : '')}>
            <span className="v7-artifact-hint-tier">{artifactsCopy.hintTierLabel(hint.tier)}</span>
            {/* The bought line, verbatim from the artifact's own `hints` array. Amber, because it is
                something the player spent Salvage on. */}
            {hint.bought ? <span className="v7-artifact-hint-text">{hint.text}</span> : null}
            {hint.bought ? null : buyable ? (
              <button
                type="button"
                className="v7-row-cost"
                disabled={!hint.affordable}
                onClick={() => onBuy()}
              >
                {artifactsCopy.hintCostLabel(hint.cost)}
              </button>
            ) : (
              // No control at all, and the price still shown as a target — the same treatment
              // components/expedition/FabPanel.js gives a row the spend gate is holding, for the
              // same reason: a priced control that can only refuse is worse than no control.
              <span className="v7-artifact-hint-locked">
                {artifactsCopy.hintLockedLabel} · {artifactsCopy.hintCostLabel(hint.cost)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// One artifact. The prompt, what it is worth, the answer field, the graded reply, the two governed
// routes past it and the ladder.
function ArtifactRow({ row, unaided, feedback, onSubmit, onManual, onSimulate, onBuyHint }) {
  // THE DRAFT IS THE ONLY LOCAL STATE ON THIS SCREEN, and it is a text field's contents rather than
  // anything the game knows about: it is not read by the engine, not persisted, and not graded until
  // it is dispatched.
  //
  // RAW, AND IT STAYS RAW. It is handed to the reducer exactly as typed — no trim, no case fold, no
  // number parse. engine/puzzles.js carries two deliberately different normalisers (one preparing
  // prose for a set test, one preparing a numeral for arithmetic, and its comment explains why
  // `4.0` breaks the first) and a tidy-up here would be a third, weaker one that the other two would
  // eventually disagree with. The panel's job is to deliver the keystrokes.
  const [draft, setDraft] = React.useState('');
  const resolved = row.status !== 'open';
  const busy = row.cooldownRemaining > 0;

  function submit(event) {
    event.preventDefault();
    onSubmit(draft);
    // The field is deliberately NOT cleared. A numeric artifact answers with a direction, so the
    // fastest honest play is to edit the number you just filed and submit again; wiping it would
    // make the player retype their own last guess every governor.
  }

  return (
    <div className={'v7-artifact' + (resolved ? ' is-resolved' : '')}>
      <div className="v7-artifact-head">
        <span className="v7-artifact-name">{row.name}</span>
        <span className={'v7-artifact-status is-' + row.status}>
          {artifactsCopy.statusLabel[row.status]}
        </span>
        {/* Only where the engine distinguishes it. solvedUnaided() is `solved && hintsBought === 0`
            and it is read by §9's Rule 5 Draft and §10's ending text, so the one fact in the act
            that records HOW the player got there is also shown to the player. Never derived from
            the hint rows here — that would be a second implementation of the same predicate. */}
        {unaided ? <span className="v7-artifact-unaided">{artifactsCopy.unaidedLabel}</span> : null}
      </div>

      {/* THE PROMPT, PREFORMATTED. Several of these are printed tables — an insertion log in two
          columns, a manifest with dot leaders, a gate/gain grid — and §8.1's rule 3 is that the
          player can check their own answer, which they cannot do against a table whose columns have
          been re-wrapped. It scrolls inside its own box on a narrow screen rather than making the
          page scroll; the CSS block carries that note.

          `prompt` is already the translated text when the Lexicon Core is owned — listPuzzles()
          decides that, and this file does not know the item exists. */}
      <pre className="v7-artifact-prompt">{row.prompt}</pre>

      {/* Present only when an owned instrument reads this artifact. It does not solve anything: it
          prints the quantity the panel describes and does not print, and the player still has to
          read the answer off it. */}
      {row.instrumentReadout ? (
        <div className="v7-artifact-readout">
          <span className="v7-artifact-readout-label">{artifactsCopy.readoutLabel}</span>
          {row.instrumentReadout}
        </div>
      ) : null}

      <div className="v7-artifact-stakes">
        <div><span className="v7-artifact-stake-label">{artifactsCopy.unlocksLabel}</span> {row.unlocksLabel}</div>
        {/* What it costs to walk away, stated on every row. This is the sentence that makes the
            anti-soft-lock guarantee legible per artifact: it is always a convenience, a rate or
            information, and never the ending. */}
        <div className="muted">
          <span className="v7-artifact-stake-label">{artifactsCopy.ignoredLabel}</span> {row.ignoredLabel}
        </div>
      </div>

      {resolved ? (
        <div className="v7-artifact-status-note">{artifactsCopy.statusNote[row.status]}</div>
      ) : (
        <form className="v7-artifact-form" onSubmit={submit}>
          <label className="v7-artifact-label" htmlFor={'artifact-answer-' + row.id}>
            {artifactsCopy.answerLabel(row.inputLabel)}
          </label>
          <div className="v7-artifact-controls">
            <input
              id={'artifact-answer-' + row.id}
              className="v7-artifact-input"
              type="text"
              value={draft}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
            {/* Disabled while the governor is live, and the enabled state is the ENGINE's:
                `cooldownRemaining` is attemptCooldownRemaining(), which is clamped to what the
                CURRENT config says the wait can be, so a stale deadline in a save can never
                disable this button for longer than the line beside it promises.

                Also disabled on an empty field, which is a decision rather than an oversight: an
                empty submission grades NULL and RECORDS AN ATTEMPT exactly as the manual route
                does, and burning a 90-second governor on a stray Enter would be a hostile way to
                discover that. The player who wants to spend an attempt on nothing has a labelled
                control for it directly below. Emptiness is tested on the raw string — a
                whitespace-only entry still goes to the engine and is graded there. */}
            <button
              type="submit"
              className="v7-artifact-submit"
              disabled={busy || draft.length === 0}
            >
              {artifactsCopy.submitLabel}
            </button>
          </div>
        </form>
      )}

      {/* ALWAYS, INCLUDING ON A RESOLVED ARTIFACT. The last thing the panel said is the record of
          how this ended — an accepted answer in the good colour, or the manual line on one the
          panel released — and a screen that erased it the instant the artifact resolved would throw
          away the only trace of which of the three routes the player actually took. */}
      <FeedbackLine feedback={feedback} />

      {resolved ? null : (
        <React.Fragment>
          {/* THE THIRD WAY PAST, ON THE ROW, ALWAYS VISIBLE. Its counter is the engine's pair —
              attempts against `attemptsToBypass` — and there is deliberately no time estimate
              beside it: the engine exports no wall-time figure, §8.7's published table is about one
              cooldown pessimistic because the first attempt is free, and a panel doing that
              multiplication itself would be inventing a promise. */}
          <div className="v7-artifact-manual">
            <div className="v7-artifact-manual-head">
              <button type="button" className="v7-artifact-manual-button" disabled={busy} onClick={onManual}>
                {artifactsCopy.manualLabel}
              </button>
              <span className={'v7-artifact-governor' + (busy ? ' is-busy' : '')}>
                {busy ? artifactsCopy.cooldownLabel(row.cooldownRemaining) : artifactsCopy.readyLabel}
              </span>
              <span className="v7-artifact-attempts">
                {artifactsCopy.attemptsLabel(row.attempts, row.attemptsToBypass)}
              </span>
            </div>
            <p className="muted">{artifactsCopy.manualNote}</p>
          </div>

          {/* The Inertial Plot Table's bench, drawn only when an owned instrument enables it —
              `canSimulate` is the engine's and no item id appears in this file. Its own deadline is
              `simulateRemaining`, a different field from the attempt governor because a run costs no
              attempt and consumes no cooldown. It reports PASS or FAIL and nothing else; adding a
              direction to it here would collapse the measured reason it does not dominate SUBMIT. */}
          {row.canSimulate ? (
            <div className="v7-artifact-sim">
              <div className="v7-artifact-manual-head">
                <button
                  type="button"
                  className="v7-artifact-manual-button"
                  disabled={row.simulateRemaining > 0 || draft.length === 0}
                  onClick={() => onSimulate(draft)}
                >
                  {artifactsCopy.simulateLabel}
                </button>
                {row.simulateRemaining > 0 ? (
                  <span className="v7-artifact-governor is-busy">
                    {artifactsCopy.simulateBusyLabel(row.simulateRemaining)}
                  </span>
                ) : null}
                {/* null is "not run yet" and false is "run, and it failed" — the engine keeps the
                    two apart on purpose, so a boolean test here would report an untried bench as a
                    failure. */}
                {row.simulatePass !== null ? (
                  <span className={'v7-artifact-sim-result' + (row.simulatePass ? ' is-pass' : '')}>
                    {artifactsCopy.simulateResultLabel(row.simulatePass)}
                  </span>
                ) : null}
              </div>
              <p className="muted">{artifactsCopy.simulateNote}</p>
            </div>
          ) : null}
        </React.Fragment>
      )}

      <HintLadder row={row} resolved={resolved} onBuy={onBuyHint} />
    </div>
  );
}

// The instrument shop, in the house shop contract and wearing STORY-034's `.v7-row` primitives —
// the same row components/expedition/FabPanel.js draws, because two shops in one act that nearly
// match is the thing those primitives exist to prevent. listInstruments() resolves the phase gate,
// ownership and affordability; this recomputes none of them.
//
// An owned instrument keeps its row rather than disappearing. Every effect here is permanent and
// several of them are invisible on this screen (a halved governor, a free tier, a translated
// prompt), so the row is the only place the player can confirm what they are running.
function InstrumentRow({ instrument, onBuy }) {
  return (
    <div className={'v7-row' + (instrument.owned || instrument.affordable ? '' : ' is-unaffordable')}>
      <div className="v7-row-main">
        <div className="v7-row-name">
          {instrument.name}
          {instrument.owned ? (
            <span className="v7-row-owned">{artifactsCopy.instrumentOwnedLabel}</span>
          ) : null}
        </div>
        <div className="v7-row-effect">{instrument.description}</div>
        <div className="v7-row-effect">{instrument.effect}</div>
      </div>
      {instrument.owned ? (
        <span className="v7-row-cost">{artifactsCopy.instrumentCostLabel(instrument.cost)}</span>
      ) : (
        <button
          type="button"
          className="v7-row-cost"
          disabled={!instrument.affordable}
          onClick={onBuy}
        >
          {artifactsCopy.instrumentCostLabel(instrument.cost)}
        </button>
      )}
    </div>
  );
}

function ArtifactsPanel() {
  const { state, dispatch } = useGame();
  // Both lists resolve their own reveal gate, and an unrevealed artifact is OMITTED rather than
  // drawn locked — the reveal is the reward, and a greyed-out Final Certification in the aftermath
  // is four phases of spoiler. Both accessors reach the slice through expeditionSlice(), so a save
  // with no `expedition` key at all — let alone no `expedition.puzzles` — reads as empty rather
  // than throwing. Saves are never migrated in this codebase; absent has to read as empty.
  const rows = listPuzzles(state);
  const instruments = listInstruments(state);

  return (
    <div className="panel">
      <h2>{artifactsCopy.title}</h2>
      <p className="muted">{artifactsCopy.subtitle}</p>

      {/* Stated once, above everything, rather than repeated on nine rows. */}
      <div className="v7-artifact-guarantee">
        <h3>{artifactsCopy.guaranteeTitle}</h3>
        <p className="muted">{artifactsCopy.guaranteeNote}</p>
      </div>

      {rows.length > 0
        ? rows.map((row) => (
          <ArtifactRow
            key={row.id}
            row={row}
            // The engine's predicate, called per row. Cheap — it reads one record — and it is the
            // only figure this panel asks for that listPuzzles() does not already carry.
            unaided={solvedUnaided(state, row.id)}
            feedback={puzzleActions.lastFeedback(state, row.id)}
            onSubmit={(input) => dispatch({
              type: puzzleActions.SUBMIT_PUZZLE_ANSWER,
              puzzleId: row.id,
              input,
            })}
            onManual={() => dispatch({ type: puzzleActions.OPERATE_PUZZLE_MANUALLY, puzzleId: row.id })}
            onSimulate={(input) => dispatch({
              type: puzzleActions.SIMULATE_PUZZLE_ANSWER,
              puzzleId: row.id,
              input,
            })}
            onBuyHint={() => dispatch({ type: puzzleActions.BUY_PUZZLE_HINT, puzzleId: row.id })}
          />
        ))
        : <p className="muted">{artifactsCopy.emptyNote}</p>}

      <h3>{artifactsCopy.instrumentsTitle}</h3>
      <p className="muted">{artifactsCopy.instrumentsNote}</p>
      {instruments.length > 0
        ? instruments.map((instrument) => (
          <InstrumentRow
            key={instrument.id}
            instrument={instrument}
            onBuy={() => dispatch({
              type: puzzleActions.BUY_PUZZLE_INSTRUMENT,
              itemId: instrument.id,
            })}
          />
        ))
        : <p className="muted">{artifactsCopy.instrumentsEmptyNote}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// VERIFIED (STORY-038), under `node`. This repo has no test runner and `npm run build` transforms
// JSX without ever MOUNTING it, so a throw on mount ships with a green build — STORY-032 hit exactly
// that. One harness, 95 assertions, driving the ENGINE, the REDUCER and the RENDERED MARKUP through
// react-dom/server against a GameContext fixture. It was run and then deleted; what it asserted is
// the record.
//
// THE FEEDBACK IS THE ENGINE'S, ASSERTED AGAINST FEEDBACK_LINES RATHER THAN AGAINST A HARDCODED
// STRING — a hardcoded expectation cannot catch a panel that invented its own rejection:
//   * `grand slam` on the Final Certification renders `p9.fourRunners` VERBATIM and carries
//     `is-wrong-kind`; `60` on the Departure Board renders `p6.synodicNotPeriod` and carries
//     `is-near`; `4000` renders `number.OUT_OF_BAND.HIGH` and carries `is-out-of-band`. All three
//     are on screen at once in a run and no two share a class, which is §8.1's rule discharged:
//     close and wrong-track are visibly different, and neither is a bare "incorrect".
//   * The sequence template substitutes: a three-quarter-right assist chain renders
//     `2 OF 4 IN POSITION.` and NO `{n}` or `{of}` reaches the page. (The placeholder is `{n}` and
//     the engine's field is `inPosition`, so a renderer that looped over `detail` would ship the
//     literal braces.)
//   * A token that is not a body on the plate renders `sequence.WRONG_KIND`, not a positional count.
//
// THE THREE ROUTES, EACH DRIVEN TO ITS END THROUGH THE REDUCER:
//   * SOLVE: `  Home Run  ` — padded and mixed case — solves, because tolerance is checkAnswer's and
//     the panel does not pre-normalise. Sets `puzzle:` and `puzzleSolved:`, renders ACCEPTED and
//     UNAIDED, and keeps the accepted line on the resolved card.
//   * LADDER: tier 1 debits 7,200 and its prose appears; the OTHER TWO TIERS' PROSE IS ABSENT FROM
//     THE MARKUP, which is engine/puzzles.js's `text: null` rule holding at the DOM. Exactly one
//     priced control on the ladder (tier 2, at hintCost()), tier 3 shows LOCKED and no button. A
//     solve after a hint is NOT unaided and the panel does not claim it is.
//   * MANUAL: five presses on the Certification Plate, advancing only the clock between them, flip
//     `bypassed`, set `puzzle:` and NOT `puzzleSolved:`, and render RELEASED. The row shows the
//     manual line rather than the NULL prose. OPERATE MANUALLY appears once per open row — counted
//     against listPuzzles(), not a fixed number — and the guarantee is stated at the top of the tab.
//
// GOVERNORS AND THE CLOCK, WITH NO TIMER ANYWHERE:
//   * A submission inside a live governor is a no-op BY REFERENCE (`===`) and does not overwrite the
//     feedback already on screen. The panel prints PANEL BUSY with the engine's remaining seconds
//     and re-enables at the boundary; nextPuzzleCooldownClock() reports exactly `clock + cooldown`
//     and an advance() past it leaves the row ready.
//   * STORM SAFETY HELD: an 8-HOUR advance() over a state with a live attempt advances no attempt
//     count, resolves nothing, and leaves the panel reading PANEL READY on the far side.
//   * The feedback record survives both an advance() and a later engine write to the slice — which
//     is the whole reason it is stored at the top level rather than inside `expedition`.
//
// INSTRUMENTS, in the house shop contract: an unaffordable row is drawn dimmed rather than hidden;
// a bought one keeps its row and says OWNED; a second purchase is a no-op by reference. The Flight
// Manual turns tier 1 to FREE across the ladder, the Lexicon Core swaps the prompt to the translated
// text (and changes no answer), the Rangefinder adds the readout to the three artifacts that have
// one, the Governor Bypass halves the printed wait to 45s, and the Plot Table adds the bench — which
// records no attempt, consumes no attempt governor, and reports PASS, FAIL or nothing at all
// depending on whether it has been run.
//
// AND IT MOUNTS AGAINST THE SAVES THIS CODEBASE NEVER MIGRATES: `expedition` deleted entirely,
// `expedition` present with no `puzzles`, and an unrecognized phase all render — the first two draw
// their phase's rows and buy against them, and the third fails open exactly as the engine does.
// ---------------------------------------------------------------------------------------------

module.exports = ArtifactsPanel;
