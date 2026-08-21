const {
  submitAnswer,
  attemptBruteForce,
  answerFeedback,
  buyHint,
  buyInstrument,
  simulateAnswer,
} = require('../../engine/puzzles');
const actionTypes = require('../actionTypes');

// Act VII's artifact puzzles (PRD §8) — the five dispatches the Artifacts panel makes, each one
// line over engine/puzzles.js, plus the one piece of state this layer owns: what the panel last
// said back.
//
// REFUSAL IS `null` FROM THE ENGINE AND THE IDENTICAL STATE OBJECT FROM THE REDUCER, the house idiom
// that engine/lotShop.js <-> lotActions.js established and every Act VII system follows (see
// fabActions.js and boardActions.js, which state it at length). An action the player could not have
// taken through the UI — a live governor, an exhausted ladder, a price they cannot meet, an already
// resolved artifact — is a no-op and not an error: the panel draws its controls off the engine's own
// rows, so reaching a refusal means a stale render or a replayed dispatch, and neither deserves a
// throw in a game that autosaves. The SAME object is returned rather than a copy, because call sites
// in this codebase detect "nothing happened" by reference equality.
//
// NOTHING HERE RE-ASKS A RULE THE ENGINE ANSWERS. No affordability test, no cooldown test, no tier
// arithmetic, no reveal check. A reducer that checked any of them would be a second opinion on a
// question already decided, and second opinions drift.
//
// NO checkActTransition(), for the reason fabActions.js gives: Act VII declares `exit: null` and is
// the final act, so nothing bought or solved here can end anything. And no phase recompute — the
// intra-act ladder belongs to engine/sites.js, which is the single writer of `expedition.phase`.
//
// ---------------------------------------------------------------------------------------------
// THE ACTION IDS ARE IN state/actionTypes.js, beside every other id in the game, and are re-exported
// here only so this module's own reducers can name them. That registry is the house convention —
// all eighteen sibling action modules read from it — and one shared registry is what lets a reader
// answer "what can be dispatched?" from a single file.
const {
  SUBMIT_PUZZLE_ANSWER,
  OPERATE_PUZZLE_MANUALLY,
  SIMULATE_PUZZLE_ANSWER,
  BUY_PUZZLE_HINT,
  BUY_PUZZLE_INSTRUMENT,
} = actionTypes;

// ---------------------------------------------------------------------------------------------
// THE GRADED FEEDBACK, RECORDED IN STATE RATHER THAN COMPUTED IN THE PANEL. This is the decision
// this file exists to make, and it has two independent reasons.
//
// 1. answerFeedback() IS A GRADING ORACLE AND IT MUST NOT BE FREE. It is stateless and pure, so a
//    component could call it on every keystroke and grade an answer without ever spending an
//    attempt — and engine/puzzles.js prices a numeric search AT THE ATTEMPT COOLDOWN on purpose
//    ("binary search IS the brute-force path for a number and it is priced by the attempt cooldown
//    rather than forbidden"). A panel that graded locally would set that price to zero and quietly
//    delete §8.2's whole economy. Same instinct as `text: null` on an unbought hint: what the
//    component cannot compute, it cannot leak.
//
// 2. FEEDBACK AND THE RECORDED ATTEMPT MUST NOT DISAGREE. submitAnswer() REFUSES on a live governor.
//    A panel holding its own feedback would print a grade for an attempt the engine declined to
//    record — the one thing this screen may never do, because the grade is the entire product.
//    Here the two are written together or not at all: `next` is null and nothing is stored.
//
// STORED AT THE TOP LEVEL AND NOT INSIDE `expedition`, which is not a stylistic choice. Every write
// in engine/puzzles.js goes through withPuzzleRecord(), which spreads the DEFAULTED slice back from
// engine/colony.js's expeditionSlice() — that accessor returns a fixed shape, so a key it does not
// name is silently dropped by the next puzzle write, and integrateColony() rebuilds the slice on
// every tick besides. A top-level key survives both: advance() and every reducer spread `...state`.
//
// IT PERSISTS INTO THE SAVE, and that is the intended reading rather than a leak. `wallBall.lastResult`
// is the precedent — a terminal that forgot what it last said the moment the tab was closed would be
// stranger than one that remembers, and the record is a code and a key, never an answer.
function withFeedback(state, puzzleId, result, manual) {
  return {
    ...state,
    puzzleFeedback: {
      ...(state.puzzleFeedback || {}),
      // A CODE AND A LINE ID, NEVER A COMPOSED STRING — the same boundary engine/puzzles.js holds
      // when it returns one. Prose is substituted in data/actSevenArtifactsConfig.js, so the panel
      // and the engine cannot phrase one wrong answer two ways.
      //
      // `manual` is not the engine's; it is which CONTROL the player pressed, which the engine has
      // no way to know and no reason to. Both routes grade NULL and record an identical attempt —
      // see the note on operatePuzzleManually() below.
      [puzzleId]: { code: result.code, lineId: result.lineId, detail: result.detail, manual: !!manual },
    },
  };
}

// The panel's read of the above. A defaulting accessor rather than a raw dereference in the
// component, for the reason every slice in this codebase has one: `state.puzzleFeedback` is absent
// in every save written before this change and there is no migration path, so absent has to read as
// "nothing said yet" in ONE place rather than in a guard at each call site.
function lastFeedback(state, puzzleId) {
  const stored = (state && state.puzzleFeedback) || {};
  return stored[puzzleId] || null;
}

// ---------------------------------------------------------------------------------------------
// The five.

// `action.input` IS THE RAW FIELD CONTENTS, UNTOUCHED. Case, whitespace, synonyms, unicode dashes,
// thousands separators and numeric tolerance are all checkAnswer()'s business — engine/puzzles.js
// carries two normalisers and a long argument for why they differ — and a trim() anywhere on this
// path would be a second, weaker normaliser that the first one would eventually disagree with.
function submitPuzzleAnswer(state, action) {
  const next = submitAnswer(state, action.puzzleId, action.input);
  if (!next) return state;
  return withFeedback(next, action.puzzleId, answerFeedback(action.puzzleId, action.input), false);
}

// THE ANTI-SOFT-LOCK ROUTE (§8.7, design.md Decision 6). Mechanically identical to submitting
// nothing — attemptBruteForce() is an alias for submitAnswer(state, id, null) and the engine keeps
// it as one code path so that the resolution milestones cannot be set in two places — and it is a
// SEPARATE ACTION anyway, because the player pressing a labelled control is a different event from
// a fumbled empty submit and the panel answers the two differently. The flag rides on the feedback
// record; nothing about the state write differs.
function operatePuzzleManually(state, action) {
  const next = attemptBruteForce(state, action.puzzleId);
  if (!next) return state;
  return withFeedback(next, action.puzzleId, answerFeedback(action.puzzleId, null), true);
}

// The Inertial Plot Table (§8.5). NO FEEDBACK RECORD, deliberately: a simulate reports PASS or FAIL
// and nothing else, the engine stores that on the puzzle record where listPuzzles() already returns
// it, and writing a graded line here would hand the bench the ordering information that is the only
// thing stopping it from strictly dominating SUBMIT.
function simulatePuzzleAnswer(state, action) {
  return simulateAnswer(state, action.puzzleId, action.input) || state;
}

// NO TIER ON THE ACTION, because buyHint() takes none: it always buys the next unbought tier, which
// is what makes the ladder a ladder. An action carrying a tier would imply the player could skip
// one, and the reducer would then have to enforce an order the engine already enforces.
function buyPuzzleHint(state, action) {
  return buyHint(state, action.puzzleId) || state;
}

function buyPuzzleInstrument(state, action) {
  return buyInstrument(state, action.itemId) || state;
}

module.exports = {
  SUBMIT_PUZZLE_ANSWER,
  OPERATE_PUZZLE_MANUALLY,
  SIMULATE_PUZZLE_ANSWER,
  BUY_PUZZLE_HINT,
  BUY_PUZZLE_INSTRUMENT,
  submitPuzzleAnswer,
  operatePuzzleManually,
  simulatePuzzleAnswer,
  buyPuzzleHint,
  buyPuzzleInstrument,
  lastFeedback,
};
