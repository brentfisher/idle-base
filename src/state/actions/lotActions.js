const { purchase } = require('../../engine/lotShop');
const { checkActTransition } = require('../../engine/progression');

// Buying the last Starter Kit item satisfies Act I's exit predicate, so the transition is
// checked here as well as in advance() — otherwise the act would end up to a full tick
// after the purchase that ended it.
function buyLotItem(state, action) {
  const next = purchase(state, action.offerId);
  if (!next) return state;
  return checkActTransition(next);
}

module.exports = { buyLotItem };
