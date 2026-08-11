const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { clickLabel, clickValue, clickCurrency } = require('../../engine/clicker');
const { getCurrency } = require('../../data/currencies');
const { formatNumber } = require('../../utils/formatNumber');

// The manual income action. This button is rendered in every act and is never disabled —
// it is the anti-softlock guarantee (PRD §6.4).
//
// The currency is read, not assumed. This used to print "caps" unconditionally, which was
// correct only for as long as no act overrode `clickCurrency`; Act III pays cash, and the
// button would otherwise have credited one thing while promising another.
function SearchLotButton() {
  const { state, dispatch } = useGame();
  const currency = getCurrency(clickCurrency(state));

  return (
    <button className="lot-click-button" onClick={() => dispatch({ type: actionTypes.SEARCH_LOT })}>
      <span className="lot-click-label">{clickLabel(state)}</span>
      <span className="lot-click-value">
        +{currency.symbol}
        {formatNumber(clickValue(state))} {currency.symbol ? '' : currency.label.toLowerCase()}
      </span>
    </button>
  );
}

module.exports = SearchLotButton;
