const React = require('react');
const { useGame } = require('../../state/GameContext');
const { computeModifiers } = require('../../engine/modifiers');
const { revenuePerSecond, attendanceFraction } = require('../../engine/economy');
const { formatCash } = require('../../utils/formatNumber');

function RevenueTicker() {
  const { state } = useGame();
  const modifiers = computeModifiers(state);
  const perSecond = revenuePerSecond(state, modifiers);
  const fraction = attendanceFraction(state, modifiers);

  return (
    <div className="card">
      <div>
        <strong>{formatCash(perSecond)}</strong> / sec
      </div>
      <div className="muted">Attendance: {Math.round(fraction * 100)}% of capacity</div>
    </div>
  );
}

module.exports = RevenueTicker;
