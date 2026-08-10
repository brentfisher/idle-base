const React = require('react');
const { useGame } = require('../../state/GameContext');
const { POSITIONS, FIELDING_POSITIONS } = require('../../data/positions');
const PlayerIcon = require('./PlayerIcon');
const { teamStrength } = require('../../engine/strength');
const { computeModifiers } = require('../../engine/modifiers');

function FieldView() {
  const { state } = useGame();
  const modifiers = computeModifiers(state);
  const strength = teamStrength(state.roster, modifiers);
  const dh = state.roster.find((p) => p.position === 'DH' && p.isStarter);
  const bench = state.roster.filter((p) => !p.isStarter);

  return (
    <div className="panel">
      <h2>Home Field</h2>
      <p className="muted">Team strength: {strength.toFixed(1)} (drives win probability and fan appeal)</p>
      <div className="field-view">
        <svg className="field-svg" viewBox="0 0 100 100">
          <rect x="0" y="0" width="100" height="100" fill="#1f4d2a" />
          <path d="M 50 90 L 8 28 A 62 62 0 0 1 92 28 Z" fill="#2a6338" />
          <polygon points="50,90 74,64 50,42 26,64" fill="#8a6a4a" stroke="#eef3ec" strokeWidth="0.4" />
          <line x1="50" y1="90" x2="8" y2="28" stroke="#eef3ec" strokeWidth="0.4" />
          <line x1="50" y1="90" x2="92" y2="28" stroke="#eef3ec" strokeWidth="0.4" />
          <rect x="48.5" y="88.5" width="3" height="3" fill="#eef3ec" transform="rotate(45 50 90)" />
          {POSITIONS.filter((pos) => FIELDING_POSITIONS.includes(pos.id)).map((pos) => {
            const player = state.roster.find((p) => p.position === pos.id && p.isStarter);
            return <PlayerIcon key={pos.id} x={pos.x} y={pos.y} position={pos.id} player={player} />;
          })}
        </svg>
      </div>
      <h3>Dugout</h3>
      <div className="card-grid">
        {dh && (
          <div className="card">
            <strong>DH</strong> — {dh.name}
          </div>
        )}
        {bench.map((p) => (
          <div className="card" key={p.id}>
            <span className="muted">Bench · {p.position}</span>
            <br />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = FieldView;
