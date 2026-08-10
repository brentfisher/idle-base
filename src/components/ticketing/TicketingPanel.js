const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { computeModifiers } = require('../../engine/modifiers');
const { stadiumUpgradeCost, stadiumCapacityGain } = require('../../engine/economy');
const { formatCash, formatNumber } = require('../../utils/formatNumber');
const RevenueTicker = require('./RevenueTicker');
const PowerupShop = require('./PowerupShop');

function TicketingPanel() {
  const { state, dispatch } = useGame();
  const modifiers = computeModifiers(state);
  const upgradeCost = stadiumUpgradeCost(state.stadium.level, modifiers);
  const capacityGain = stadiumCapacityGain(state.stadium.level);

  return (
    <div className="panel">
      <h2>Ticketing</h2>
      <RevenueTicker />

      <h3>Ticket Price</h3>
      <div className="card">
        <input
          type="range"
          min="1"
          max="60"
          value={state.stadium.ticketPrice}
          onChange={(e) => dispatch({ type: actionTypes.SET_TICKET_PRICE, price: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
        <div className="muted">
          Current price: {formatCash(state.stadium.ticketPrice)} — higher prices earn more per fan but shrink the
          crowd.
        </div>
      </div>

      <h3>Stadium</h3>
      <div className="card">
        <div>
          Level {state.stadium.level} · Capacity {formatNumber(state.stadium.capacity)}
        </div>
        <button
          className="btn"
          disabled={state.wallet.cash < upgradeCost}
          onClick={() => dispatch({ type: actionTypes.UPGRADE_STADIUM })}
          style={{ marginTop: 6 }}
        >
          Expand (+{formatNumber(capacityGain)} capacity) — {formatCash(upgradeCost)}
        </button>
      </div>

      <PowerupShop />
    </div>
  );
}

module.exports = TicketingPanel;
