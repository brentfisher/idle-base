const { purchase } = require('../../engine/sites');

// Act VII's site ladder (PRD §6.4, §7.1, §7.2) — colonizing a rung, and building the pad that lets
// you throw from it. The second Salvage sink in the act, and the only one that bills forever.
//
// ONE LINE OVER THE ENGINE, the same one state/actions/fabActions.js is. Every rule that decides
// whether this purchase happens — whether the site is reached, whether it is already building,
// which single pad tier that rung may build, and the debit itself — is in engine/sites.js, and
// nothing here may re-ask any of them. purchase() re-checks each gate through the identical
// candidateBuildFor() that listOffers() used, so there is one definition of what is legal; a check
// here would be a second opinion on a question already answered, and second opinions drift.
//
// REFUSAL IS `null` FROM THE ENGINE AND THE IDENTICAL STATE OBJECT FROM THE REDUCER, the house
// idiom engine/lotShop.js <-> lotActions.js established and every Act VII shop follows. The panel
// draws its buttons off `affordable` from listOffers(), so reaching a refusal means a stale render
// or a replayed dispatch, and neither deserves a thrown exception in a game that autosaves. The
// SAME object is returned rather than a shallow copy, because call sites in this codebase detect
// "nothing happened" by reference equality.
//
// ONE ACTION FOR BOTH COLONIZATION AND PADS, and that is the engine's vocabulary showing through
// rather than a shortcut. An offer id is `<buildingId>@<siteId>` — 'colonize@onDeck',
// 'padTier3@firstBase' — and engine/sites.js's note on OFFER_SEPARATOR argues at length that the
// prefix IS the `buildingId` that gets stored, precisely so there is one vocabulary and no mapping
// table. Two actions here would reintroduce the mapping this reducer is not supposed to need: the
// dispatcher would have to decide which kind of row it had pressed, which is a rules question the
// engine answers by parsing the id it emitted.
//
// NOTHING HERE COMPLETES A BUILD. purchase() only OPENS a window — it writes `buildingId` and
// `readyAtClock` and debits — and engine/sites.js's resolveBuilds() is the single completion path,
// run from advance(). That split is what makes an eight-hour offline return grant each build
// exactly once, so a reducer that "helpfully" finished a zero-second build here would be a second
// completion path and the idempotence note on resolveBuilds() would stop being true.
//
// NO checkActTransition() HERE, for fabActions.js's reason: Act VII declares `exit: null` and is
// the final act. The act's INTRA-act phase ladder is likewise not this file's business — colonizing
// On-Deck does not advance `expedition.phase`, ARRIVING there does, and engine/sites.js is the
// single writer of that field and recomputes it from a pure predicate ladder every advance().
function buySiteBuild(state, action) {
  const next = purchase(state, action.offerId);
  return next || state;
}

module.exports = { buySiteBuild };
