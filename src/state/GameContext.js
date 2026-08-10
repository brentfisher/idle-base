const React = require('react');
const gameReducer = require('./gameReducer');
const { createInitialState } = require('./initialState');
const { loadGame } = require('../persistence/saveLoad');

const GameContext = React.createContext(null);

function GameProvider({ children }) {
  const [state, dispatch] = React.useReducer(gameReducer, undefined, () => loadGame() || createInitialState());
  const value = React.useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

function useGame() {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}

module.exports = { GameContext, GameProvider, useGame };
