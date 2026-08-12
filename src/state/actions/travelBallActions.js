const { purchase } = require('../../engine/sponsorships');
const { placeWager, placePropBet } = require('../../engine/bookie');
const { computeModifiers } = require('../../engine/modifiers');

// Act IV's two player actions. Neither checks for an act transition, unlike
// lotActions/wallBallActions: Act IV's exit is a win rate accumulated by played seasons, and
// nothing bought or wagered here can satisfy it — only engine/tickEngine.js can.
function buySponsorship(state, action) {
  const next = purchase(state, action.offerId);
  if (!next) return state;
  return next;
}

// The amount and the odds are both decided inside engine/bookie.js from live state; whatever
// the UI sent is re-clamped there unconditionally. Modifiers are resolved here because the
// line is priced off the real matchup, which needs aiStrengthMult and strengthMult.
function placeBookieWager(state, action) {
  return placeWager(state, { amount: action.amount, side: action.side }, computeModifiers(state));
}

// The prop board. No modifiers: a prop is priced off a rolled chance rather than off the
// matchup, so nothing about how strong either team is enters into it — which is precisely what
// makes it a different action rather than another field on the wager above.
//
// The offerId and the amount on the action are both REQUESTS. engine/bookie.js re-clamps the
// amount against 5% of current cash unconditionally, and refuses outright if the offer is no
// longer on the board, so a tampered dispatch, a stale panel or a replayed action can none of
// them exceed the cap or buy a line the player never saw.
//
// `action.rng` exists so the sealed outcome roll can be driven through this reducer path with
// an always-lose generator, which is the only way to prove the bounded-loss guarantee rather
// than assert it; live dispatches omit it and the engine defaults to Math.random.
function placeProp(state, action) {
  return placePropBet(state, { offerId: action.offerId, amount: action.amount }, action.rng || Math.random);
}

module.exports = { buySponsorship, placeBookieWager, placeProp };
