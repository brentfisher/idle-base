const { purchase } = require('../../engine/concessions');

// Act III's shop action. No act transition check here, unlike lotActions/wallBallActions:
// nothing in this shop can satisfy Act III's exit, which is finishing first in a season.
function buyConcession(state, action) {
  const next = purchase(state, action.offerId);
  if (!next) return state;
  return next;
}

module.exports = { buyConcession };
