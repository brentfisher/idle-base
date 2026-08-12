const { purchase } = require('../../engine/capsShop');

// The late-game caps sink's only player action. Like lotActions/concessionsActions, a refused
// purchase (unknown upgrade, already maxed, unaffordable) comes back from the engine as null
// and is returned as the unchanged state rather than as an error: a dispatch the player could
// not have made through the UI is a no-op, not a failure to report.
//
// No act-transition check, unlike lotActions/wallBallActions: nothing bought here can satisfy
// an act's exit condition. Acts V and VI end on a pennant and a championship respectively.
function buyCapsUpgrade(state, action) {
  const next = purchase(state, action.upgradeId);
  return next || state;
}

module.exports = { buyCapsUpgrade };
