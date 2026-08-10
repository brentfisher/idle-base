const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers } = require('../../engine/lotShop');
const { formatNumber } = require('../../utils/formatNumber');

// Renders whatever engine/lotShop.js says is currently visible. Costs, ownership and
// availability are all decided there; this component only draws them.
function LotShop() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state).filter((offer) => offer.revealed);

  if (offers.length === 0) return null;

  return (
    <div className="lot-shop">
      {offers.map((offer) => (
        <button
          key={offer.id}
          className={`lot-offer${offer.owned ? ' owned' : ''}`}
          disabled={offer.owned || !offer.affordable}
          onClick={() => dispatch({ type: actionTypes.BUY_LOT_ITEM, offerId: offer.id })}
        >
          <span className="lot-offer-head">
            <span className="lot-offer-name">{offer.name}</span>
            <span className="lot-offer-cost">{offer.owned ? 'Owned' : `${formatNumber(offer.cost)} caps`}</span>
          </span>
          <span className="lot-offer-desc">{offer.description}</span>
          <span className="lot-offer-effect">{offer.effect}</span>
        </button>
      ))}
    </div>
  );
}

module.exports = LotShop;
