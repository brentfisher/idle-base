const React = require('react');
const { useGame } = require('../../state/GameContext');
const { computeModifiers } = require('../../engine/modifiers');
const { attendanceFraction } = require('../../engine/economy');
const { totalIncomePerSecond } = require('../../engine/income');
const { formatCash } = require('../../utils/formatNumber');

function RevenueTicker() {
  const { state } = useGame();
  const modifiers = computeModifiers(state);
  // Same source as the header's per-currency rates, so the two can't disagree.
  const perSecond = totalIncomePerSecond(state, modifiers).cash;
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
