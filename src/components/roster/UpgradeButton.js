const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost, planMaxStatUpgrades } = require('../../engine/economy');
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

  // WHAT SPENDING EVERYTHING ON THIS STAT WOULD BUY. Priced step by step by the engine, because the
  // cost curve climbs with the stat — see planMaxStatUpgrades() for why dividing the wallet by the
  // first price is the wrong number and a button labelled from it would under-deliver.
  const bulk = planMaxStatUpgrades(currentValue, state.wallet.cash, modifiers);

  // SHOWN ONLY WHEN IT WOULD DO SOMETHING THE SINGLE BUY DOES NOT, i.e. two or more upgrades are
  // affordable. That gate is a screen-budget decision and not a nicety: RosterPanel's own header
  // calls the Roster tab the densest in the game — fifteen cards, four or five upgrade rows each —
  // and an unconditional second control is sixty to seventy-five more buttons on a 390px screen.
  // A player who cannot afford two does not need a bulk button, and the one case this exists for
  // is the opposite one: coming back to a wallet full enough that the next dozen presses are a
  // formality.
  const showBulk = bulk.steps > 1;

  return (
    <span className="upgrade-chip-group">
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
      {/* DELIBERATELY NOT LABELLED "MAX". The chip above this component's early return already owns
          that word and it means something else — "this stat is at the ceiling" — and that chip
          exists precisely so a player never has to work out WHY a control is unavailable. A second
          MAX meaning "spend everything" would put the ambiguity straight back.
          The label carries what it will actually do, so the player is never guessing at the total. */}
      {showBulk && (
        <button
          className="btn secondary upgrade-chip is-bulk"
          onClick={() => dispatch({ type: actionTypes.BUY_STAT_UPGRADE_MAX, playerId, stat })}
          title={`Buy ${bulk.steps} upgrades — +${bulk.gain} ${stat} to ${bulk.endValue} for ${formatCash(bulk.totalCost)}`}
        >
          ALL +{bulk.gain} — {formatCash(bulk.totalCost)}
        </button>
      )}
    </span>
  );
}

module.exports = UpgradeButton;
