const React = require('react');
const { GameProvider } = require('./state/GameContext');
const AppShell = require('./components/layout/AppShell');

function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}

module.exports = App;
