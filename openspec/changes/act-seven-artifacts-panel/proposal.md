## Why

`act-seven-artifact-puzzles` landed nine artifacts, five graded feedback codes, a hint ladder, an
attempt governor and an instrument shop — and deliberately shipped **no rendering**, saying so in its
own scope note: "the artifact tab remains the placeholder the shell story shipped… the panel, its
actions and its action types are a later story". This is that story.

Two of the act's structural promises are currently true only in the source code, which is the same as
not being true at all:

- **PRD §8.1's binding rule** — the goal may be unclear, the FEEDBACK never is — exists to keep the
  moon-logic adventure puzzle out of the game. The engine discharges its half: every submission comes
  back as one of five codes with a key into authored prose, and it distinguishes a near miss from a
  wrong-kind answer with per-artifact lines written for a player who understood *more* than was
  asked. A surface that collapsed those into "incorrect" would pass every existing check while
  deleting the point of the system.
- **The anti-soft-lock guarantee** (design.md Decision 6 of the puzzles change, PRD §8.7) — every
  artifact has three independent ways past it, and the third needs no answer, no currency and no
  purchase. A guarantee the player cannot see does not reassure anyone, and a player who cannot find
  the manual route is soft-locked in the only way that matters: in their own reading of the game.

There is also a plainer reason. Six purchasable instruments, three of them costing more than the
whole hint ladder, currently have no surface on which their effects can be seen or bought.

## What Changes

- **The Artifacts tab renders the puzzle surface.** `components/expedition/ArtifactsPanel.js` stops
  returning the placeholder. One card per revealed artifact: the prompt as a preformatted printout,
  what it unlocks, what ignoring it costs, and its status.
- **Graded feedback is displayed as graded.** The panel renders the engine's code and line id through
  authored prose, and the four unsuccessful outcomes are visually distinct from one another. No bare
  rejection exists anywhere on the screen.
- **All three routes past an artifact are on every open card**: an answer field, the hint ladder with
  its prices, and a labelled manual-operation control with its governor and its attempt counter.
- **A new state record: what the panel last said.** Feedback is graded once, in the reducer, beside
  the attempt it belongs to, and recorded in state for the surface to render. It is not graded in the
  component — see design.md, Decision 1.
- **Five new player actions** in `state/actions/puzzleActions.js`: submit, operate manually,
  simulate, buy hint, buy instrument. Each is one line over the engine and refuses by returning the
  identical state object.
- **The instrument shop renders** in the house shop contract, wearing the act's existing shop row.
- **No balance change of any kind.** No price, no cooldown, no attempt count and no reward moves.

## Capabilities

### New Capabilities

- `artifact-panel`: what the artifact surface displays, which controls it offers and when, how it
  distinguishes the resolution routes, and the rules that keep it a rendering surface — no rule
  resolution, no local grading, no timer of its own.

### Modified Capabilities

None. `game-feedback`, `expedition-state` and `progression` keep every requirement
`act-seven-artifact-puzzles` established; this change adds the display requirements that make §8.1's
rule observable, and they are additions rather than edits.

## Impact

- Affected capabilities: `artifact-panel` (new)
- New: `src/data/actSevenArtifactsConfig.js`, `src/state/actions/puzzleActions.js`
- Rewritten: `src/components/expedition/ArtifactsPanel.js` (placeholder to real panel)
- Modified: `src/state/gameReducer.js` (one `require`, five `case` arms), `src/styles/global.css`
  (one named section inside the Act VII block, above the final media query),
  `src/data/actSevenPanels.js` (a comment on the `artifacts` row only)
- New state: a top-level `puzzleFeedback` map. **Not a save migration** — absent reads as "nothing
  said yet", so every existing save loads and plays unchanged and `meta.version` does not move.
- Untouched: `src/engine/puzzles.js`, `src/data/actSevenPuzzlesConfig.js`, `src/engine/tickEngine.js`
