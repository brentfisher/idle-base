const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { CAMP_PROGRAMS } = require('../../data/campProgramsConfig');
const { formatCash, formatDuration } = require('../../utils/formatNumber');

function statDeltaSummary(statDeltas) {
  return Object.entries(statDeltas)
    .map(([stat, delta]) => `${delta > 0 ? '+' : ''}${delta} ${stat}`)
    .join(', ');
}

function TrainingCampPanel() {
  const { state, dispatch } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(state.roster[0]?.id || '');
  const playerInCamp = state.roster.find((p) => p.campStatus);
  const selectedPlayer = state.roster.find((p) => p.id === selectedPlayerId);

  return (
    <div className="panel">
      <h2>Training Camp</h2>
      <p className="muted">One player can attend camp at a time. Programs trade off stats — pick a focus for your roster.</p>

      {playerInCamp && (
        <div className="card">
          <strong>{playerInCamp.name}</strong> is at camp —{' '}
          {formatDuration(Math.max(0, playerInCamp.campStatus.completesAtClock - state.clock))} remaining
        </div>
      )}

      {!playerInCamp && (
        <>
          <div className="card">
            <label>
              Player:{' '}
              <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                {state.roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="card-grid">
            {CAMP_PROGRAMS.map((program) => (
              <div className="card" key={program.id}>
                <strong>{program.name}</strong>
                <div className="muted">{program.description}</div>
                <div className="muted">{statDeltaSummary(program.statDeltas)}</div>
                <div className="muted">{formatDuration(program.durationSeconds)}</div>
                <button
                  className="btn"
                  disabled={!selectedPlayer || state.cash < program.cost}
                  onClick={() =>
                    dispatch({ type: actionTypes.START_CAMP, playerId: selectedPlayerId, programId: program.id })
                  }
                  style={{ marginTop: 6 }}
                >
                  Send — {formatCash(program.cost)}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

module.exports = TrainingCampPanel;
