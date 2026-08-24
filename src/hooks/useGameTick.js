const React = require('react');
const actionTypes = require('../state/actionTypes');
const { useGame } = require('../state/GameContext');
const { saveGame } = require('../persistence/saveLoad');
const { promoteSealedRun } = require('../persistence/runEnd');
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

  // THE STORAGE HALF OF ENDING A RUN. engine/tickEngine.js seals the card the moment the win lands
  // — purely, inside advance(), so an offline catch-up seals it at the instant it happened — and
  // this writes it into the career store. It is here and not in the reducer because a reducer may
  // not touch localStorage, and not in the tick because a catch-up runs advance()'s loop hundreds
  // of times and would write hundreds of times.
  //
  // Keyed on `endedAtClock`, which is written exactly once per run (engine/records.js: sealRun is
  // idempotent), so this effect fires once per run however many renders follow. promoteRun() upserts
  // by run id anyway, so a double fire costs a duplicate write and never a duplicate row.
  const endedAtClock = (state.record || {}).endedAtClock || 0;
  React.useEffect(() => {
    if (endedAtClock > 0) promoteSealedRun(stateRef.current);
  }, [endedAtClock]);

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
