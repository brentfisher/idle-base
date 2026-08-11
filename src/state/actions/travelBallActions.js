const { purchase } = require('../../engine/sponsorships');
const { placeWager } = require('../../engine/bookie');
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

module.exports = { buySponsorship, placeBookieWager };
