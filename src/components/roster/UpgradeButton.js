const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost } = require('../../engine/economy');
const { formatCash } = require('../../utils/formatNumber');

// `statCap` and `upgradeAmount` are resolved once per render up in RosterPanel and handed down,
// rather than each of ~60 buttons resolving them again. They fall back to the resolved rules on
// the modifiers bundle this component already computes, so the component still works standalone.
function UpgradeButton({ playerId, stat, currentValue, statCap, upgradeAmount }) {
  const { state, dispatch } = useGame();
  const modifiers = computeModifiers(state);
  const cap = statCap != null ? statCap : modifiers.rules.statCap;
  const amount = upgradeAmount != null ? upgradeAmount : modifiers.rules.statUpgradeAmount;

  // A maxed stat is not a disabled button. A disabled button asks the player to work out WHY it
  // is disabled — broke? maxed? — which is the complaint. It is a chip that says MAX, in the
  // same column and at the same height so the rows do not jump when a stat tops out.
  if (currentValue >= cap) {
    return (
      <span className="upgrade-chip is-max" title={`${stat} is at the cap of ${cap}`}>
        MAX
      </span>
    );
  }

  const cost = statUpgradeCost(currentValue, modifiers);
  // The economics are untouched: the reducer already clamps to the cap, so at 99/100 the player
  // pays the same price for the 1 point that is left. Printing the clamped number instead of a
  // flat "+2" is what makes "one upgrade from the ceiling" visible without a second widget.
  const step = Math.min(amount, cap - currentValue);
  const affordable = state.wallet.cash >= cost;

  return (
    <button
      className={`btn secondary upgrade-chip${step < amount ? ' is-last-step' : ''}`}
      disabled={!affordable}
      onClick={() => dispatch({ type: actionTypes.BUY_STAT_UPGRADE, playerId, stat })}
      title={
        step < amount
          ? `Last upgrade: +${step} ${stat} reaches the cap of ${cap}`
          : `+${step} ${stat} (cap ${cap})`
      }
    >
      +{step} — {formatCash(cost)}
    </button>
  );
}

module.exports = UpgradeButton;
