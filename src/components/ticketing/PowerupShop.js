const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { listOffers } = require('../../engine/powerupShop');
const { getCurrency } = require('../../data/currencies');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');

const EFFECT_LABELS = {
  revenueMult: 'ticket revenue',
  attendanceMult: 'attendance',
  strengthMult: 'team strength',
  campSpeedMult: 'camp speed',
  rookieQualityMult: 'rookie quality',
  upgradeCostMult: 'upgrade costs',
  // Act VII. `lifeSupportDrawMult` is phrased as a REDUCTION because its values are negative and
  // lower is better — rendering "-12% life-support draw" from a -0.12 requires the label to be the
  // thing being reduced, not the thing being boosted. Getting this wrong would print "+-12%".
  powerOutputMult: 'Power output',
  oxygenOutputMult: 'Oxygen output',
  provisionsOutputMult: 'Provisions output',
  fuelOutputMult: 'Fuel output',
  salvageOutputMult: 'passive Salvage',
  lifeSupportDrawMult: 'life-support draw',
};

function PowerupShop() {
  const { state, dispatch } = useGame();

  return (
    <div>
      <h3>Powerups</h3>
      <div className="card-grid">
        {/* Rows come from engine/powerupShop.js already resolved — which catalogue is on offer,
            the currency, ownership and affordability. This component decides none of it; before
            this change it read POWERUPS directly with no filter, which would have shown Act VII's
            Salvage-priced rows inside Act V's cash shop. */}
        {listOffers(state).map((powerup) => {
          const isPermanent = powerup.permanent;
          const owned = powerup.owned;
          const active = powerup.active;
          const disabled = owned || !powerup.affordable;
          const sign = powerup.value >= 0 ? '+' : '';
          const currency = getCurrency(powerup.currency);

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
                {owned ? 'Owned' : `Buy — ${currency.symbol}${formatNumber(powerup.cost)}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

module.exports = PowerupShop;
