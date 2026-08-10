const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { PERKS } = require('../../data/perksConfig');
const { getEraConfig } = require('../../data/eras');
const { calculateLegacyPoints } = require('../../engine/prestige');
const { formatCash, formatNumber } = require('../../utils/formatNumber');
const Modal = require('../common/Modal');

function PrestigePanel() {
  const { state, dispatch } = useGame();
  const [confirming, setConfirming] = React.useState(false);
  const currentEra = getEraConfig(state.prestige.era);
  const nextEra = getEraConfig(state.prestige.era + 1);
  const earnable = calculateLegacyPoints(state);

  return (
    <div className="panel">
      <h2>Prestige</h2>
      <p className="muted">
        Reset your run for a permanent boost. You keep legacy points, purchased perks, and advance to a new era with
        its own rules.
      </p>
      <div className="card">
        <div>
          Legacy Points: <strong>{formatNumber(state.prestige.legacyPoints)}</strong> (lifetime earned:{' '}
          {formatNumber(state.prestige.totalLegacyEarned)})
        </div>
        <div className="muted">
          Current era: {currentEra.name} — {currentEra.description}
        </div>
        <div className="muted">This run: {state.prestige.runStats.championships} championship(s), peak rating {state.prestige.runStats.peakOverallRating.toFixed(1)}, {formatCash(state.prestige.runStats.totalRevenue)} earned.</div>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => setConfirming(true)}>
          Prestige Now (+{formatNumber(earnable)} legacy)
        </button>
      </div>

      <h3>Perk Tree</h3>
      <div className="card-grid">
        {PERKS.map((perk) => {
          const owned = state.prestige.purchasedPerks.includes(perk.id);
          const locked = perk.prerequisite && !state.prestige.purchasedPerks.includes(perk.prerequisite);
          const disabled = owned || locked || state.prestige.legacyPoints < perk.legacyCost;
          return (
            <div className="card" key={perk.id}>
              <strong>{perk.name}</strong>
              <div className="muted">{perk.description}</div>
              {locked && <div className="muted">Requires: {perk.prerequisite}</div>}
              <button
                className="btn secondary"
                disabled={disabled}
                onClick={() => dispatch({ type: actionTypes.BUY_PERK, perkId: perk.id })}
                style={{ marginTop: 6 }}
              >
                {owned ? 'Owned' : `${perk.legacyCost} legacy`}
              </button>
            </div>
          );
        })}
      </div>

      {confirming && (
        <Modal title="Prestige?" onClose={() => setConfirming(false)}>
          <p>
            This resets your cash, roster, stadium, and season progress. You'll earn{' '}
            <strong>{formatNumber(earnable)}</strong> legacy points and move into the <strong>{nextEra.name}</strong>{' '}
            era: {nextEra.description}
          </p>
          <button
            className="btn"
            onClick={() => {
              dispatch({ type: actionTypes.PRESTIGE_RESET });
              setConfirming(false);
            }}
          >
            Confirm Prestige
          </button>
        </Modal>
      )}
    </div>
  );
}

module.exports = PrestigePanel;
