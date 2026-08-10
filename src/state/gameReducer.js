const actionTypes = require('./actionTypes');
const economyActions = require('./actions/economyActions');
const rosterActions = require('./actions/rosterActions');
const seasonActions = require('./actions/seasonActions');
const prestigeActions = require('./actions/prestigeActions');
const progressionActions = require('./actions/progressionActions');
const { createInitialState } = require('./initialState');

function gameReducer(state, action) {
  switch (action.type) {
    case actionTypes.TICK:
      return seasonActions.tick(state, action);
    case actionTypes.APPLY_OFFLINE_PROGRESS:
      return seasonActions.applyOfflineProgressAction(state, action);
    case actionTypes.DISMISS_OFFSEASON_SUMMARY:
      return seasonActions.dismissOffseasonSummary(state);

    case actionTypes.SET_TICKET_PRICE:
      return economyActions.setTicketPrice(state, action);
    case actionTypes.BUY_POWERUP:
      return economyActions.buyPowerup(state, action);
    case actionTypes.UPGRADE_STADIUM:
      return economyActions.upgradeStadium(state, action);

    case actionTypes.BUY_STAT_UPGRADE:
      return rosterActions.buyStatUpgrade(state, action);
    case actionTypes.START_CAMP:
      return rosterActions.startCampAction(state, action);
    case actionTypes.EXECUTE_TRADE:
      return rosterActions.executeTradeAction(state, action);

    case actionTypes.PRESTIGE_RESET:
      return prestigeActions.prestigeResetAction(state);
    case actionTypes.BUY_PERK:
      return prestigeActions.buyPerkAction(state, action);
    case actionTypes.ACKNOWLEDGE_VICTORY:
      return prestigeActions.acknowledgeVictoryAction(state);

    case actionTypes.MARK_TAB_SEEN:
      return progressionActions.markTabSeen(state, action);

    case actionTypes.HARD_RESET:
      return createInitialState();

    default:
      return state;
  }
}

module.exports = gameReducer;
