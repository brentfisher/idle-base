const { purchase } = require('../../engine/actSevenModules');

// Act VII's fabrication shop (PRD §6.4) — the act's one Salvage sink, and the first place the
// Salvage the shell-level click has been paying out since minute one can actually go.
//
// ONE LINE OVER THE ENGINE, which is the point of the file existing at all. Every rule that decides
// whether this purchase happens — the phase rank, the spend gate, the site-capability gate, the
// price at the current owned count, and the debit itself — is in engine/actSevenModules.js, and
// nothing here may re-ask any of them. A reducer that checked affordability would be a second
// opinion on a question the engine already answered, and second opinions drift.
//
// REFUSAL IS `null` FROM THE ENGINE AND THE IDENTICAL STATE OBJECT FROM THE REDUCER, the house
// idiom that engine/lotShop.js <-> lotActions.js established and every Act VII shop follows (see
// boardActions.js, which states it at length). An action the player could not have taken through
// the UI is a no-op, not an error: the panel draws its buttons off `affordable` from listOffers(),
// so reaching a refusal means a stale render or a replayed dispatch, and neither deserves a thrown
// exception in a game that autosaves. The SAME object is returned rather than a shallow copy,
// because call sites in this codebase detect "nothing happened" by reference equality.
//
// NO checkActTransition() HERE. lotActions.js calls it because buying the last Starter Kit item
// satisfies Act I's exit predicate; Act VII declares `exit: null` and is the final act, so no
// purchase on this bench can end anything. The act's own INTRA-act phase ladder is likewise not
// this file's business — engine/sites.js is the single writer of `expedition.phase` and recomputes
// it from a pure predicate ladder every advance(), so a module bought here that crosses the
// `lifeSupport` threshold is picked up on the next tick by the one thing allowed to notice.
function buyModule(state, action) {
  const next = purchase(state, action.offerId);
  return next || state;
}

module.exports = { buyModule };
