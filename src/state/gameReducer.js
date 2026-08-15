const actionTypes = require('./actionTypes');
const economyActions = require('./actions/economyActions');
const rosterActions = require('./actions/rosterActions');
const walkupActions = require('./actions/walkupActions');
const seasonActions = require('./actions/seasonActions');
const prestigeActions = require('./actions/prestigeActions');
const progressionActions = require('./actions/progressionActions');
const clickerActions = require('./actions/clickerActions');
const lotActions = require('./actions/lotActions');
const narrativeActions = require('./actions/narrativeActions');
const wallBallActions = require('./actions/wallBallActions');
const concessionsActions = require('./actions/concessionsActions');
const capsShopActions = require('./actions/capsShopActions');
const travelBallActions = require('./actions/travelBallActions');
const identityActions = require('./actions/identityActions');
const { createInitialState } = require('./initialState');

function gameReducer(state, action) {
  switch (action.type) {
    case actionTypes.TICK:
      return seasonActions.tick(state, action);
    case actionTypes.APPLY_OFFLINE_PROGRESS:
      return seasonActions.applyOfflineProgressAction(state, action);
    case actionTypes.DISMISS_OFFSEASON_SUMMARY:
      return seasonActions.dismissOffseasonSummary(state);

    case actionTypes.SEARCH_LOT:
      return clickerActions.searchLot(state, action);
    case actionTypes.BUY_LOT_ITEM:
      return lotActions.buyLotItem(state, action);
    case actionTypes.DISMISS_STORY_BEAT:
      return narrativeActions.dismissStoryBeat(state, action);

    case actionTypes.RESOLVE_WALL_BALL_CHALLENGE:
      return wallBallActions.resolveWallBallChallenge(state, action);
    case actionTypes.BUY_WALL_BALL_UPGRADE:
      return wallBallActions.buyWallBallUpgrade(state, action);

    case actionTypes.BUY_CONCESSION:
      return concessionsActions.buyConcession(state, action);

    case actionTypes.BUY_CAPS_UPGRADE:
      return capsShopActions.buyCapsUpgrade(state, action);

    case actionTypes.BUY_SPONSORSHIP:
      return travelBallActions.buySponsorship(state, action);
    case actionTypes.PLACE_BOOKIE_WAGER:
      return travelBallActions.placeBookieWager(state, action);
    case actionTypes.PLACE_PROP_BET:
      return travelBallActions.placeProp(state, action);

    case actionTypes.SET_TICKET_PRICE:
      return economyActions.setTicketPrice(state, action);
    case actionTypes.BUY_POWERUP:
      return economyActions.buyPowerup(state, action);
    case actionTypes.UPGRADE_STADIUM:
      return economyActions.upgradeStadium(state, action);

    case actionTypes.BUY_STAT_UPGRADE:
      return rosterActions.buyStatUpgrade(state, action);
    case actionTypes.SET_WALKUP_SONG:
      return walkupActions.setWalkupSongAction(state, action);
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
    case actionTypes.ACCEPT_CALL_UP:
      return progressionActions.acceptCallUp(state);
    case actionTypes.SET_TEAM_NAME:
      return identityActions.setTeamName(state, action);

    case actionTypes.HARD_RESET:
      return createInitialState();

    default:
      return state;
  }
}

module.exports = gameReducer;
