const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { CAMP_PROGRAMS, CAMP_SWAP_COPY } = require('../../data/campProgramsConfig');
const { positionLabel } = require('../../data/positions');
const { describeCampSwap, standInFor } = require('../../engine/trainingCamp');
const { formatCash, formatDuration } = require('../../utils/formatNumber');

function statDeltaSummary(statDeltas) {
  return Object.entries(statDeltas)
    .map(([stat, delta]) => `${delta > 0 ? '+' : ''}${delta} ${stat}`)
    .join(', ');
}

// The consequence of sending THIS player, spelled out before the Send buttons are reachable. The
// engine computes it (describeCampSwap) so the sentence here and the swap the reducer performs
// cannot drift apart — a Send button that promised one stand-in and produced another, or that
// silently no-ops because a starter has no cover, is worse than the bug being fixed.
function SwapPreview({ preview }) {
  if (!preview || !preview.camper) return null;

  if (preview.reason === 'bench') {
    return <div className="camp-swap-preview is-neutral">{CAMP_SWAP_COPY.benchPlayerIsFree}</div>;
  }
  if (preview.reason === 'noBench') {
    return <div className="camp-swap-preview is-blocked">{CAMP_SWAP_COPY.noBench}</div>;
  }

  const delta = Math.round(preview.teamRatingDelta);
  return (
    <div className={`camp-swap-preview${delta < 0 ? ' is-cost' : ' is-neutral'}`}>
      <div>
        {CAMP_SWAP_COPY.standIn(
          preview.standIn.name,
          preview.standIn.position,
          positionLabel(preview.camper.position),
          Math.round(preview.standInRating)
        )}
      </div>
      <div className="camp-swap-impact">{CAMP_SWAP_COPY.teamImpact(delta)}</div>
    </div>
  );
}

function TrainingCampPanel() {
  const { state, dispatch } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(state.roster[0]?.id || '');
  const playerInCamp = state.roster.find((p) => p.campStatus);
  const selectedPlayer = state.roster.find((p) => p.id === selectedPlayerId);

  // Guarded on selectedPlayer so an empty roster (or a selection whose player has since retired)
  // renders the panel rather than throwing.
  const preview = selectedPlayer ? describeCampSwap(state.roster, selectedPlayerId) : null;
  const blocked = !!preview && !preview.ok;
  const coveringPlayer = playerInCamp ? standInFor(state.roster, playerInCamp) : null;

  return (
    <div className="panel">
      <h2>Training Camp</h2>
      <p className="muted">One player can attend camp at a time. Programs trade off stats — pick a focus for your roster.</p>
      <p className="muted">{CAMP_SWAP_COPY.intro}</p>

      {playerInCamp && (
        <div className="card">
          <strong>{playerInCamp.name}</strong> is at camp —{' '}
          {formatDuration(Math.max(0, playerInCamp.campStatus.completesAtClock - state.clock))} remaining
          {coveringPlayer && (
            <div className="camp-swap-note">
              {CAMP_SWAP_COPY.currentlyCovering(coveringPlayer.name, positionLabel(playerInCamp.position))}
            </div>
          )}
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
                    {p.name} ({p.position}){p.isStarter ? '' : ' — bench'}
                  </option>
                ))}
              </select>
            </label>
            <SwapPreview preview={preview} />
          </div>
          <div className="card-grid">
            {CAMP_PROGRAMS.map((program) => (
              <div className="card" key={program.id}>
                <strong>{program.name}</strong>
                <div className="muted">{program.description}</div>
                <div className="muted">{statDeltaSummary(program.statDeltas)}</div>
                <div className="muted">{formatDuration(program.durationSeconds)}</div>
                <button
                  className="btn camp-send-btn"
                  disabled={!selectedPlayer || blocked || state.wallet.cash < program.cost}
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
