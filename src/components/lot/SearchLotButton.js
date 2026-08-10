const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { clickLabel, clickValue } = require('../../engine/clicker');
const { formatNumber } = require('../../utils/formatNumber');

// The manual income action. This button is rendered in every act and is never disabled —
// it is the anti-softlock guarantee (PRD §6.4).
function SearchLotButton() {
  const { state, dispatch } = useGame();

  return (
    <button className="lot-click-button" onClick={() => dispatch({ type: actionTypes.SEARCH_LOT })}>
      <span className="lot-click-label">{clickLabel(state)}</span>
      <span className="lot-click-value">+{formatNumber(clickValue(state))} caps</span>
    </button>
  );
}

module.exports = SearchLotButton;
