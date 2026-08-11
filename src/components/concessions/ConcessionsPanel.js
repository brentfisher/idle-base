const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers, concessionsPerSecond } = require('../../engine/concessions');
const { KIND_STAND } = require('../../data/concessionsConfig');
const { formatNumber } = require('../../utils/formatNumber');

// Act III's shop. Renders engine/concessions.js: listOffers() verbatim, including its
// cost/owned/affordable flags, and decides none of them itself — the same contract
// components/lot/LotShop.js has with engine/lotShop.js.
function OfferCard({ offer, onBuy }) {
  const disabled = offer.owned || !offer.affordable;
  const repeatable = offer.maxCount > 1;

  return (
    <button
      type="button"
      className={`cx-offer${offer.owned ? ' owned' : ''}${!offer.owned && !offer.affordable ? ' locked' : ''}`}
      disabled={disabled}
      onClick={() => onBuy(offer.id)}
    >
      <span className="cx-offer-head">
        <span className="cx-offer-name">{offer.name}</span>
        {repeatable && (
          <span className="cx-offer-count">
            {offer.count}/{offer.maxCount}
          </span>
        )}
      </span>
      <span className="cx-offer-desc">{offer.description}</span>
      <span className="cx-offer-foot">
        <span className="cx-offer-effect">{offer.effect}</span>
        <span className="cx-offer-cost">{offer.owned ? 'All bought' : `$${formatNumber(offer.cost)}`}</span>
      </span>
    </button>
  );
}

function ConcessionsPanel() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const stands = offers.filter((o) => o.kind === KIND_STAND);
  const boosters = offers.filter((o) => o.kind !== KIND_STAND);
  const rate = concessionsPerSecond(state);
  const buy = (offerId) => dispatch({ type: actionTypes.BUY_CONCESSION, offerId });

  return (
    <div className="panel">
      <h2>Behind the Backstop</h2>
      <p className="muted">
        Somebody has to run the stand. Earning ${rate.toFixed(1)}/sec · reputation{' '}
        {Math.round(state.reputation)}
      </p>

      <h3>Stands</h3>
      <p className="muted">Cash while you are not watching. Each one costs more than the last.</p>
      <div className="cx-grid">
        {stands.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>

      <h3>Making a Name</h3>
      <p className="muted">
        Reputation makes the whole team play better — every point above {formatNumber(20)} is a
        permanent strength bonus in every game.
      </p>
      <div className="cx-grid">
        {boosters.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>
    </div>
  );
}

module.exports = ConcessionsPanel;
