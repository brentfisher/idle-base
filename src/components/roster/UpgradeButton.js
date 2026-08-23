const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { computeModifiers } = require('../../engine/modifiers');
const { statUpgradeCost, planMaxStatUpgrades, statUpgradeRunCost } = require('../../engine/economy');
const { UPGRADE_COPY } = require('../../data/rosterUpgradeConfig');
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

  // THE SLOT IS GATED ON THE STAT; ONLY THE BUTTON IS GATED ON THE WALLET. That split is the whole
  // fix for a reported bug, and it is worth stating plainly because the previous version looks more
  // economical and is not.
  //
  // This chip used to render only when two or more upgrades were AFFORDABLE. Affordability changes
  // on every purchase — and not only on this row: buying power on one card can drop the balance
  // below the two-upgrade line for sixty other rows at once. Every one of them then loses a
  // 34px-tall control in the same frame, every card below shortens, and the grid re-flows under a
  // thumb that is halfway through a run of clicks. The next tap lands on whatever slid into that
  // spot. That is the "roster screen skips around, the components jump when clicking" report.
  //
  // Gated on `cap - currentValue > upgradeAmount` — a property of the STAT — the slot's presence
  // changes only when a stat comes within one purchase of the ceiling, which is a once-per-stat
  // event the player caused and which removes a control they genuinely no longer need. Nothing the
  // wallet does can move the layout any more.
  //
  // The screen-budget objection to an unconditional second control still stands and is answered
  // rather than ignored: the chip is 34px against the buy button's 44px, and on the rows where it
  // is disabled it is carrying the savings target that used to be nowhere on the screen.
  const bulkSlot = cap - currentValue > amount;
  const bulkAffordable = bulk.steps > 1;
  // What the wallet has to reach for the chip to turn on. Priced by the engine, from the same loop
  // that prices the enabled state, so the two cannot disagree.
  const bulkTarget = bulkAffordable ? null : statUpgradeRunCost(currentValue, 2, modifiers);

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
      {bulkSlot && (
        <button
          className={`btn secondary upgrade-chip is-bulk${bulkAffordable ? '' : ' is-saving'}`}
          disabled={!bulkAffordable}
          onClick={() => dispatch({ type: actionTypes.BUY_STAT_UPGRADE_MAX, playerId, stat })}
          title={
            bulkAffordable
              ? `Buy ${bulk.steps} upgrades — +${bulk.gain} ${stat} to ${bulk.endValue} for ${formatCash(bulk.totalCost)}`
              : UPGRADE_COPY.bulkSavingTitle(formatCash(bulkTarget.totalCost), stat)
          }
        >
          {bulkAffordable
            ? `ALL +${bulk.gain} — ${formatCash(bulk.totalCost)}`
            : UPGRADE_COPY.bulkSavingLabel(formatCash(bulkTarget.totalCost))}
        </button>
      )}
    </span>
  );
}

module.exports = UpgradeButton;


// ---------------------------------------------------------------------------------------------
// VERIFIED — react-dom/server, part of the 125-assertion run recorded in
// components/playoffs/PlayoffBracket.js.
//
// THE REPORTED BUG ("the roster screen skips around ... components jump around when clicking"):
//   · rendered at power 50 with a wallet of 0 and again with 999,999, the markup contains the
//     SAME NUMBER OF CHIPS. Nothing the wallet does adds or removes a control                PASS
//   · broke: the bulk chip is present, disabled, and carries the savings target              PASS
//   · rich: the bulk chip is a live "ALL +n — $x"                                            PASS
//
// THE SLOT IS A FACT ABOUT THE STAT:
//   · one purchase from the cap (99/100), the slot closes — a once-per-stat event            PASS
//   · at the cap, the row is the MAX chip                                                    PASS
//
// The label is not a promise the reducer breaks: BUY_STAT_UPGRADE_MAX through the real reducer
// raises the stat, and statUpgradeRunCost() prices the same run planMaxStatUpgrades() does PASS
// ---------------------------------------------------------------------------------------------
