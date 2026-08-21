## 1. The panel's own words

- [x] 1.1 Create `src/data/actSevenArtifactsConfig.js` with `artifactsCopy` — headings, the two
      button labels, the status chips, the governor and attempt lines, the ladder and shop labels —
      so that no player-facing string literal appears in the component. Restate no artifact prose:
      prompts, hints, feedback lines, unlock and ignore sentences all stay beside their answers in
      `data/actSevenPuzzlesConfig.js`.
- [x] 1.2 Add `feedbackLine(lineId, detail)`, the renderer `FEEDBACK_LINES` expects, substituting
      `{n}` from `detail.inPosition` and `{of}` from `detail.of` by name — the field and the
      placeholder differ, so a loop over `detail` would ship a literal `{n}`. Return null for an
      unknown id rather than `undefined` prose.
- [x] 1.3 Add `feedbackClass(code)` so that which colour an outcome wears is a data decision beside
      the act's other tone tables, never a conditional in the component. Give NEAR and WRONG_KIND
      different treatments — that difference is §8.1's rule cashing out.
- [x] 1.4 Author the anti-soft-lock sentence that states the three routes once at the top of the tab,
      and the manual-route line the panel shows instead of the `NULL` prose when the player pressed
      the manual control on purpose.

## 2. The dispatch layer

- [x] 2.1 Create `src/state/actions/puzzleActions.js` with five action ids and five reducers —
      submit, operate manually, simulate, buy hint, buy instrument — each one line over
      `engine/puzzles.js`, each returning the identical state object on refusal.
- [x] 2.2 Pass the player's entry through untouched. No trim, no case fold, no number parse: tolerance
      is `checkAnswer()`'s and a second normaliser would eventually disagree with it.
- [x] 2.3 Grade in the reducer with `answerFeedback()` and record the result ONLY when the engine
      accepted the attempt, so the displayed line and the recorded attempt cannot disagree (design.md
      Decision 1).
- [x] 2.4 Store the record at the top level of state as `puzzleFeedback`, keyed by artifact, holding a
      code, a line id, the detail and which control was pressed — never prose and never an answer
      (design.md Decision 2). Read it back through a defaulting accessor so an old save reads as
      "nothing said yet" and `meta.version` does not move.
- [x] 2.5 Wire `src/state/gameReducer.js` with exactly one `require` and five `case` arms, keeping the
      change additive against a file every act shares.

## 3. The surface

- [x] 3.1 Replace `components/expedition/ArtifactsPanel.js`'s placeholder with the real panel: rows
      from `listPuzzles()`, instruments from `listInstruments()`, and no availability, price,
      cooldown or affordability recomputed anywhere in the file.
- [x] 3.2 Render each artifact as a card: name, status chip, the prompt as a preformatted printout,
      the instrument readout when one is present, what it unlocks and what ignoring it costs.
- [x] 3.3 Render the graded feedback from the stored code and line id, with the outcome's class, and
      keep it on the card after the artifact resolves — it is the record of which route was taken.
- [x] 3.4 Put all three routes on every unresolved card: the answer field and SUBMIT, the hint ladder,
      and OPERATE MANUALLY with the engine's governor countdown and attempt counter. Derive every
      enabled state from the engine, and show no invented wall-time estimate.
- [x] 3.5 Give the hint ladder a control on the lowest unpurchased tier only, since `buyHint()` takes
      no tier (design.md Decision 5). Show higher tiers' prices with no control.
- [x] 3.6 Mark a solved artifact solved and a released one released, and mark an unaided solve using
      the engine's `solvedUnaided()` rather than re-deriving it from the hint rows.
- [x] 3.7 Render the instrument shop on the act's existing `.v7-row` shop primitives, with an
      unaffordable row dimmed rather than hidden and an owned row kept and marked.
- [x] 3.8 Render the simulate bench when an owned instrument enables it, keeping "not yet run" and
      "run and failed" apart, so the act's most expensive purchase is not a no-op.
- [x] 3.9 Add no timer, no `Date.now()` and no tick-time write anywhere in the panel.

## 4. Styling

- [x] 4.1 Add one contiguous named section to `src/styles/global.css`, INSIDE the `body.expedition`
      block and ABOVE the final `@media (max-width: 640px)`, carrying the same note the Ops and Fab
      sections carry about why it is placed there.
- [x] 4.2 Give the four unsuccessful outcomes visibly different treatments using only `--v7-*` tokens,
      and record the computed contrast ratio for every new token-on-ground pairing against the act's
      4.7:1 floor.
- [x] 4.3 Keep the prompt's columns: `white-space: pre` with `overflow-x: auto`, so the printout
      scrolls inside its own box and the page never scrolls sideways at 390px.
- [x] 4.4 Set the answer field to 16px so iOS does not zoom on focus, and give every control a 44px
      minimum height.

## 5. Verification

- [x] 5.1 `npm run build` passes.
- [x] 5.2 Drive `listPuzzles` / `submitAnswer` / `buyHint` / `attemptBruteForce` / `buyInstrument`
      under `node` through the real reducer, and assert the RENDERED markup against the engine's own
      `FEEDBACK_LINES` entries rather than against hardcoded strings — a hardcoded expectation cannot
      catch a panel that invented its own rejection.
- [x] 5.3 Confirm a "close" answer and a "wrong track" answer produce visibly different rendered
      feedback, and that a positional-count line arrives with its placeholders filled.
- [x] 5.4 Confirm the panel mounts against a save with no `expedition.puzzles`, a save with no
      `expedition` key at all, and an unrecognized phase.
- [x] 5.5 Confirm an eight-hour `advance()` records no attempt and resolves no artifact, that the
      governor reads as expired on the far side, and that the feedback record survives both a tick
      and a later engine write to the slice.
- [x] 5.6 Confirm no unpurchased hint prose appears in the rendered markup.
- [x] 5.7 Record what the harness asserted in the panel's footer comment, and delete the harness —
      this repo has no test runner and the record is the artifact.
