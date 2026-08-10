const React = require('react');
const actionTypes = require('../state/actionTypes');
const { useGame } = require('../state/GameContext');
const { saveGame } = require('../persistence/saveLoad');
const balanceConfig = require('../data/balanceConfig');

function useGameTick() {
  const { state, dispatch } = useGame();
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  });

  React.useEffect(() => {
    dispatch({ type: actionTypes.APPLY_OFFLINE_PROGRESS, now: Date.now() });
    const tickId = setInterval(() => {
      dispatch({ type: actionTypes.TICK, now: Date.now() });
    }, balanceConfig.tickIntervalMs);
    return () => clearInterval(tickId);
  }, [dispatch]);

  React.useEffect(() => {
    const saveId = setInterval(() => saveGame(stateRef.current), balanceConfig.autosaveIntervalMs);
    const onVisibility = () => {
      if (document.hidden) saveGame(stateRef.current);
    };
    const onUnload = () => saveGame(stateRef.current);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(saveId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      saveGame(stateRef.current);
    };
  }, []);
}

module.exports = useGameTick;
