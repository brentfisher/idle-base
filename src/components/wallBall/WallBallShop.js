const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers, handsPerSecond } = require('../../engine/wallBallShop');
const { KIND_HAND } = require('../../data/wallBallShopConfig');
const { formatNumber } = require('../../utils/formatNumber');

// Act II's caps shop. Renders engine/wallBallShop.js: listOffers() verbatim — cost, ownership
// and affordability are all decided there.
function Offer({ offer, onBuy }) {
  const disabled = offer.owned || !offer.affordable;
  return (
    <button
      type="button"
      className={`cx-offer${offer.owned ? ' owned' : ''}${!offer.owned && !offer.affordable ? ' locked' : ''}`}
      disabled={disabled}
      onClick={() => onBuy(offer.id)}
    >
      <span className="cx-offer-head">
        <span className="cx-offer-name">{offer.name}</span>
        {offer.maxCount > 1 && (
          <span className="cx-offer-count">
            {offer.count}/{offer.maxCount}
          </span>
        )}
      </span>
      <span className="cx-offer-desc">{offer.description}</span>
      <span className="cx-offer-foot">
        <span className="cx-offer-effect">{offer.effect}</span>
        <span className="cx-offer-cost">{offer.owned ? 'Bought' : `${formatNumber(offer.cost)} caps`}</span>
      </span>
    </button>
  );
}

function WallBallShop() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const grit = offers.filter((o) => o.kind !== KIND_HAND);
  const hands = offers.filter((o) => o.kind === KIND_HAND);
  const rate = handsPerSecond(state);
  const buy = (offerId) => dispatch({ type: actionTypes.BUY_WALL_BALL_UPGRADE, offerId });

  return (
    <div className="wb-shop">
      <span className="wb-section-label">
        Worth having{rate > 0 ? ` · hands bring in ${rate.toFixed(1)} caps/sec` : ''}
      </span>
      <p className="wb-shop-note">
        You need a bankroll before anyone will play you. These are how you build one.
      </p>

      <div className="cx-grid">
        {grit.map((offer) => (
          <Offer key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>
      <div className="cx-grid">
        {hands.map((offer) => (
          <Offer key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>
    </div>
  );
}

module.exports = WallBallShop;
