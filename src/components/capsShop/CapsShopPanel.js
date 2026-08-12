const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers } = require('../../engine/capsShop');
const { computeModifiers } = require('../../engine/modifiers');
const { formatNumber } = require('../../utils/formatNumber');

// The late-game caps sink. Renders engine/capsShop.js: listOffers() verbatim, including its
// cost/owned/affordable flags, and decides none of them itself — the same contract
// components/concessions/ConcessionsPanel.js has with engine/concessions.js.
function OfferCard({ offer, onBuy }) {
  const disabled = offer.owned || !offer.affordable;

  return (
    <button
      type="button"
      className={`cs-offer${offer.owned ? ' owned' : ''}${!offer.owned && !offer.affordable ? ' locked' : ''}`}
      disabled={disabled}
      onClick={() => onBuy(offer.id)}
    >
      <span className="cs-offer-head">
        <span className="cs-offer-name">{offer.name}</span>
        <span className="cs-offer-count">
          {offer.count}/{offer.maxCount}
        </span>
      </span>
      <span className="cs-offer-desc">{offer.description}</span>
      {/* What is already bought, shown alongside what one more buys. A ladder whose rungs are
          each "+15%" is otherwise impossible to read a position on. */}
      {offer.totalBonus > 0 && (
        <span className="cs-offer-have">Currently +{Math.round(offer.totalBonus * 100)}%</span>
      )}
      <span className="cs-offer-foot">
        <span className="cs-offer-effect">{offer.effect}</span>
        <span className="cs-offer-cost">{offer.owned ? 'All bought' : `${formatNumber(offer.cost)} caps`}</span>
      </span>
    </button>
  );
}

function CapsShopPanel() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const modifiers = computeModifiers(state);
  const buy = (upgradeId) => dispatch({ type: actionTypes.BUY_CAPS_UPGRADE, upgradeId });

  // The pace multiplier is the reason most players open this tab, and it is the one bonus
  // whose effect is otherwise invisible — a shorter wait does not announce itself. Printed as
  // the resolved multiplier rather than as the shop's own contribution, because an era or a
  // perk could contribute too and the player cares about the number that is actually running.
  const pace = modifiers.gameSpeedMult;

  return (
    <div className="panel">
      <h2>The Coffee Can</h2>
      <p className="muted">
        You never stopped picking them up. Neither did anyone else who was around back then —
        and around a ballpark, a fistful of bottle caps still buys a favour.
      </p>
      <p className="muted">
        {formatNumber(Math.floor(state.wallet.caps || 0))} caps
        {pace > 1 ? ` · games running ${pace.toFixed(2)}x` : ''}
      </p>

      <div className="cs-grid">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>
    </div>
  );
}

module.exports = CapsShopPanel;
