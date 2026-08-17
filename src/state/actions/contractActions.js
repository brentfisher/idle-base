const { accept, claim, abandon } = require('../../engine/contracts');

// Act VII's contract board (PRD §9). Three one-line reducers over engine/contracts.js.
//
// REFUSAL IS `null` FROM THE ENGINE AND UNCHANGED STATE FROM THE REDUCER, which is the house idiom
// (engine/lotShop.js <-> lotActions.js is the reference pair, and engine/launch.js and
// engine/sites.js both follow it). An action the player could not have made through the UI is a
// no-op, not an error: the panel already renders `acceptable` / `claimable` / `abandonable` off
// listOffers(), so reaching one of these branches means either a stale render or a replayed
// dispatch, and neither deserves a thrown exception in a game that autosaves.
//
// The IDENTICAL object is returned rather than a shallow copy, because several call sites in this
// codebase detect "nothing happened" by reference equality.
//
// NO checkActTransition() HERE, and the omission is deliberate rather than an oversight.
// lotActions.js calls it because buying the last Starter Kit item satisfies Act I's exit predicate.
// Nothing on this board can end an act: Act VII's exit is §7.8's over-the-wall burn, which is a
// launch, and a contract only ever makes Fuel arrive sooner.
//
// NO RNG IS THREADED THROUGH accept() EITHER. Its `rng` parameter is defaulted to Math.random for
// exactly one draw (Player To Be Named Later's consideration) and a reducer is the one place in the
// app where calling Math.random is correct: it is a player action, in front of the player, outside
// advance(). A headless harness injects its own generator by calling accept() directly.
function acceptContract(state, action) {
  const next = accept(state, action.contractId);
  return next || state;
}

function claimContract(state, action) {
  const next = claim(state, action.contractId);
  return next || state;
}

function abandonContract(state, action) {
  const next = abandon(state, action.contractId);
  return next || state;
}

module.exports = { acceptContract, claimContract, abandonContract };
