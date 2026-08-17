const { purchase } = require('../../engine/board');

// Act VII's post-game standing orders (PRD §7.8). One one-line reducer over engine/board.js.
//
// REFUSAL IS `null` FROM THE ENGINE AND UNCHANGED STATE FROM THE REDUCER, which is the house idiom
// — engine/lotShop.js <-> lotActions.js is the reference pair and every Act VII shop follows it.
// An action the player could not have made through the UI is a no-op, not an error: the panel
// renders `affordable` off listOffers(), so reaching the refusal means a stale render or a replayed
// dispatch, and neither deserves a thrown exception in a game that autosaves. The IDENTICAL object
// is returned rather than a shallow copy, because several call sites in this codebase detect
// "nothing happened" by reference equality.
//
// NO checkActTransition() HERE, and the omission is the interesting one on this particular action.
// lotActions.js calls it because buying the last Starter Kit item satisfies Act I's exit predicate.
// Act VII declares `exit: null` — FINAL_ACT_INDEX is 6 and means it literally — so there is no act
// after this one to transition into, and a standing order is bought AFTER the act has already been
// won. This is the one shop in the game that is structurally incapable of ending anything.
//
// NO RNG. engine/board.js takes none, for the reasons engine/launch.js sets out at length: the
// placement this purchase moves is deterministic and computed from the run, so a random term
// anywhere on this path would make the ending's own arithmetic unauditable.
function fillStandingOrder(state, action) {
  const next = purchase(state, action.offerId);
  return next || state;
}

module.exports = { fillStandingOrder };
