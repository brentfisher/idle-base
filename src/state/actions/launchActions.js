const { purchase } = require('../../engine/launch');

// Act VII's launches (PRD §6.4, §7.3) — the burn that spends the Fuel threshold, and the act's one
// irreversible player decision.
//
// ONE LINE OVER THE ENGINE, the same one state/actions/sitesActions.js and state/actions/fabActions.js
// are. Every rule that decides whether this commit happens — whether a burn is already in flight,
// whether the pad at this site throws that far, whether the tank is over the threshold, how much of
// it is actually dumped, how long the transit runs and whether this is the burn that wins the game —
// is in engine/launch.js. purchase() re-checks each gate through the identical listOffers() that
// drew the row, so there is one definition of what is legal; a check here would be a second opinion
// on a question already answered, and second opinions drift.
//
// REFUSAL IS `null` FROM THE ENGINE AND THE IDENTICAL STATE OBJECT FROM THE REDUCER, the house idiom
// engine/lotShop.js <-> lotActions.js established and every Act VII shop follows. The panel draws
// its commit button off the engine's `blockedReason`, so reaching a refusal means a stale render or
// a replayed dispatch — and neither deserves a thrown exception in a game that autosaves. The SAME
// object is returned rather than a shallow copy, because call sites in this codebase detect
// "nothing happened" by reference equality.
//
// A REPLAYED COMMIT CANNOT DOUBLE-SPEND, and it is worth saying which line stops it rather than
// trusting the shape. The second dispatch runs listOffers() again, blockedReasonFor() finds the
// unresolved record the first one wrote, and the row comes back blocked — so purchase() returns
// null before spendResource() is ever reached. The Fuel debit is not idempotent and does not need
// to be; the gate in front of it is.
//
// NOTHING HERE RESOLVES AN ARRIVAL. purchase() only OPENS a window — it writes the launch record
// with its `arrivesAtClock` and debits the Fuel — and engine/launch.js's resolveArrivals() is the
// single completion path, run from advance() so an eight-hour offline return lands the burn exactly
// once and pays its arrival grant exactly once. A reducer that "helpfully" finished a zero-second
// transit here would be a second completion path and the idempotence note on resolveArrivals()
// would stop being true.
//
// NO checkActTransition() HERE, for sitesActions.js's reason: Act VII declares `exit: null` and is
// the final act. The act's INTRA-act phase ladder is likewise not this file's business —
// engine/sites.js is the single writer of `expedition.phase` and recomputes it from a pure
// predicate ladder every advance(). That includes the ending: committing the fifth burn sets
// `progression.milestones.overTheWall` inside purchase(), and the phase writer promotes the run to
// `majors` when the record RESOLVES, from the tick loop rather than from here.
function commitLaunch(state, action) {
  const next = purchase(state, action.offerId);
  return next || state;
}

module.exports = { commitLaunch };
