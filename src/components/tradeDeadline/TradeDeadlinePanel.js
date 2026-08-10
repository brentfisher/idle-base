const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { playerOverall } = require('../../engine/strength');
const { formatCash } = require('../../utils/formatNumber');

function TradeDeadlinePanel() {
  const { state, dispatch } = useGame();
  const { tradeWindows, scheduleIndex } = state.season;

  return (
    <div className="panel">
      <h2>Trade Deadline</h2>
      <p className="muted">
        Spend cash to swap in an upgrade at a starter's position for a playoff push. One trade per window.
      </p>
      {tradeWindows.map((window, index) => {
        let status;
        if (window.used) status = 'Trade completed for this window.';
        else if (window.open) status = null;
        else if (scheduleIndex < window.openAtGame) status = `Opens at game ${window.openAtGame}.`;
        else status = 'Window closed.';

        return (
          <div key={index} style={{ marginBottom: 16 }}>
            <h3>
              Trade Window {index + 1} (games {window.openAtGame}–{window.closeAtGame})
            </h3>
            {status && <p className="muted">{status}</p>}
            {window.open && (
              <div className="card-grid">
                {window.candidates.map((candidate) => (
                  <div className="card" key={candidate.id}>
                    <strong>{candidate.name}</strong> — {candidate.targetPosition}
                    <div className="muted">OVR {Math.round(playerOverall(candidate))} · Age {candidate.age}</div>
                    <button
                      className="btn"
                      disabled={state.wallet.cash < candidate.cost}
                      onClick={() =>
                        dispatch({ type: actionTypes.EXECUTE_TRADE, windowIndex: index, candidateId: candidate.id })
                      }
                      style={{ marginTop: 6 }}
                    >
                      Trade for — {formatCash(candidate.cost)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

module.exports = TradeDeadlinePanel;
