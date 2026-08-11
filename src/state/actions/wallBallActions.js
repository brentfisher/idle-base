const { resolveChallenge } = require('../../engine/wallBall');
const { purchase } = require('../../engine/wallBallShop');
const { checkActTransition } = require('../../engine/progression');

// Act II's only action. The stake and approach on the action are REQUESTS, not decisions:
// engine/wallBall.js re-clamps the stake against 25% of current caps unconditionally, so a
// tampered-with dispatch, a stale UI or a replayed action can none of them exceed the cap.
// See the invariant block at the top of engine/wallBall.js.
//
// `action.rng` exists so the invariants can be driven through this reducer path with an
// always-lose generator, which is the only way to prove the guarantee rather than the
// function; live dispatches omit it and the engine defaults to Math.random.
//
// The final crew member satisfies Act II's exit predicate, so the transition is checked here
// as well as in advance() — otherwise the act would end up to a full tick after the rally
// that ended it (same reasoning as state/actions/lotActions.js).
function resolveWallBallChallenge(state, action) {
  const next = resolveChallenge(
    state,
    { stake: action.stake, approachId: action.approachId },
    action.rng || Math.random
  );
  if (next === state) return state;
  return checkActTransition(next);
}

// Act II's shop. No act transition check: nothing buyable can satisfy `crewAssembled`, which
// needs wins and crew.
function buyWallBallUpgrade(state, action) {
  return purchase(state, action.offerId) || state;
}

module.exports = { resolveWallBallChallenge, buyWallBallUpgrade };
