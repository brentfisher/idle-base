const React = require('react');
const { useGame } = require('../../state/GameContext');
const PlayerCard = require('./PlayerCard');

function RosterPanel() {
  const { state } = useGame();
  const starters = state.roster.filter((p) => p.isStarter);
  const bench = state.roster.filter((p) => !p.isStarter);

  return (
    <div className="panel">
      <h2>Roster</h2>
      <p className="muted">Spend cash to upgrade individual stats. Better starters win more games and draw bigger crowds.</p>
      <h3>Starters</h3>
      <div className="card-grid">
        {starters.map((p) => (
          <PlayerCard key={p.id} player={p} clock={state.clock} />
        ))}
      </div>
      <h3>Bench</h3>
      <div className="card-grid">
        {bench.map((p) => (
          <PlayerCard key={p.id} player={p} clock={state.clock} />
        ))}
      </div>
    </div>
  );
}

module.exports = RosterPanel;
