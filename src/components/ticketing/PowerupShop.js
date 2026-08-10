const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { POWERUPS } = require('../../data/powerupsConfig');
const { formatCash, formatDuration } = require('../../utils/formatNumber');

const EFFECT_LABELS = {
  revenueMult: 'ticket revenue',
  attendanceMult: 'attendance',
  strengthMult: 'team strength',
  campSpeedMult: 'camp speed',
  rookieQualityMult: 'rookie quality',
  upgradeCostMult: 'upgrade costs',
};

function PowerupShop() {
  const { state, dispatch } = useGame();

  return (
    <div>
      <h3>Powerups</h3>
      <div className="card-grid">
        {POWERUPS.map((powerup) => {
          const isPermanent = powerup.durationSeconds === null;
          const owned = isPermanent && state.powerups.purchasedPermanentIds.includes(powerup.id);
          const active = state.powerups.active.find((p) => p.id === powerup.id);
          const disabled = owned || state.cash < powerup.cost;
          const sign = powerup.value >= 0 ? '+' : '';

          return (
            <div className="card" key={powerup.id}>
              <strong>{powerup.name}</strong>
              <div className="muted">{powerup.description}</div>
              <div className="muted">
                {sign}
                {Math.round(powerup.value * 100)}% {EFFECT_LABELS[powerup.effectType]}
                {isPermanent ? ' (permanent)' : ` for ${formatDuration(powerup.durationSeconds)}`}
              </div>
              {active && !isPermanent && (
                <div className="muted" style={{ color: '#f4d35e' }}>
                  Active — {formatDuration(Math.max(0, active.expiresAtClock - state.clock))} left
                </div>
              )}
              <button
                className="btn"
                disabled={disabled}
                onClick={() => dispatch({ type: actionTypes.BUY_POWERUP, powerupId: powerup.id })}
                style={{ marginTop: 6 }}
              >
                {owned ? 'Owned' : `Buy — ${formatCash(powerup.cost)}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

module.exports = PowerupShop;
