const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost } = require('../../engine/economy');
const balanceConfig = require('../../data/balanceConfig');
const { formatCash } = require('../../utils/formatNumber');

function UpgradeButton({ playerId, stat, currentValue }) {
  const { state, dispatch } = useGame();
  const modifiers = computeModifiers(state);
  const cost = statUpgradeCost(currentValue, modifiers);
  const maxed = currentValue >= balanceConfig.statCap;
  const disabled = maxed || state.cash < cost;

  return (
    <button
      className="btn secondary"
      disabled={disabled}
      onClick={() => dispatch({ type: actionTypes.BUY_STAT_UPGRADE, playerId, stat })}
      title={maxed ? 'Maxed out' : `+${balanceConfig.statUpgradeAmount} ${stat}`}
    >
      {maxed ? 'Maxed' : `+${balanceConfig.statUpgradeAmount} — ${formatCash(cost)}`}
    </button>
  );
}

module.exports = UpgradeButton;
