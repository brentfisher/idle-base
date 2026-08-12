const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers, concessionsPerSecond, standRateMultiplier } = require('../../engine/concessions');
// Read-only, to print what a press is actually worth right now. Two of the five groups below
// sell nothing but `perClick`, and perClick on its own is not a number a player can act on —
// engine/clicker.js multiplies it by the act's clickMultiplier, so the same 77 is 616 in Act
// III and 924 in Act IV. Showing the raw stat would advertise the ladder at a third of its
// value in the act it was priced for.
const { clickValue, clickCurrency } = require('../../engine/clicker');
// Same pair components/lot/SearchLotButton.js already reads, called the same way, so the click
// button and this readout can never disagree about what a press is worth. data/currencies.js
// names this panel as one of its three intended consumers.
const { getCurrency } = require('../../data/currencies');
const {
  KIND_STAND,
  KIND_BOOSTER,
  KIND_CAPS_UPGRADE,
  KIND_STAND_UPGRADE,
  KIND_CASH_CLICK_UPGRADE,
} = require('../../data/concessionsConfig');
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
        <span className="cx-offer-cost">
          {offer.owned
            ? 'All bought'
            : offer.currency === 'caps'
              ? `${formatNumber(offer.cost)} caps`
              : `$${formatNumber(offer.cost)}`}
        </span>
      </span>
    </button>
  );
}

// The shop is five kinds of thing now, and a flat list of eighteen cards is a wall on a phone.
// SECTIONS is the whole grouping: order, heading, the currency the group is paid in, and one
// line saying what buying into the group actually does. Declared as data rather than as five
// hand-written blocks so a sixth kind is one entry and not another copy-paste of the markup.
//
// The currency badge is per GROUP, not per card, because currency is the single most useful
// thing to know before reading three descriptions — and the two per-click groups are the same
// mechanic split only by what it costs, so putting caps and cash side by side as headings is
// what makes that legible at a glance.
const SECTIONS = [
  {
    kind: KIND_STAND,
    title: 'Stands',
    currency: 'cash',
    blurb: 'Cash while you are not watching. Each copy costs more than the last.',
  },
  {
    kind: KIND_STAND_UPGRADE,
    title: 'Running It Better',
    currency: 'cash',
    blurb:
      'Multiplies what every stand you own pays. Worth nothing until you have stands, and worth more with each one.',
  },
  {
    kind: KIND_CAPS_UPGRADE,
    title: 'Still Got Caps',
    currency: 'caps',
    blurb:
      'Bought with bottle caps, which keep turning up long after they stopped being the point. Each one makes every press worth more.',
  },
  {
    kind: KIND_CASH_CLICK_UPGRADE,
    title: 'A Bigger Operation',
    currency: 'cash',
    blurb:
      'The same thing again, priced in cash, for when the caps have run dry and the gate has not. Each one makes every press worth more.',
  },
  {
    kind: KIND_BOOSTER,
    title: 'Making a Name',
    currency: 'cash',
    blurb:
      'Reputation makes the whole team play better — every point above 20 is a permanent strength bonus in every game.',
  },
];

// "$924 a press" / "77 caps a press". Symbol-first when the currency has one, trailing label
// when it does not, which is the convention components/lot/SearchLotButton.js already prints.
function pressLabel(state) {
  const currency = getCurrency(clickCurrency(state));
  const value = formatNumber(clickValue(state));
  return currency.symbol
    ? `${currency.symbol}${value} a press`
    : `${value} ${currency.label.toLowerCase()} a press`;
}

function OfferSection({ section, offers, onBuy }) {
  if (offers.length === 0) return null;

  return (
    <section className="cx-section">
      <h3 className="cx-section-head">
        <span>{section.title}</span>
        <span className={`cx-currency-badge ${section.currency}`}>
          {section.currency === 'caps' ? 'caps' : 'cash'}
        </span>
      </h3>
      <p className="muted cx-section-blurb">{section.blurb}</p>
      <div className="cx-grid">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={onBuy} />
        ))}
      </div>
    </section>
  );
}

function ConcessionsPanel() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const rate = concessionsPerSecond(state);
  const standMult = standRateMultiplier(state);
  const buy = (offerId) => dispatch({ type: actionTypes.BUY_CONCESSION, offerId });

  return (
    <div className="panel">
      <h2>Behind the Backstop</h2>
      <p className="muted">
        Somebody has to run the stand. Earning ${rate.toFixed(1)}/sec
        {/* Only shown once something is multiplying it — otherwise it is a permanent "x1.00"
            that teaches the player nothing and takes up a line on a 390px screen. */}
        {standMult > 1 && <span className="cx-mult"> (x{standMult.toFixed(2)})</span>} · reputation{' '}
        {Math.round(state.reputation)} · {formatNumber(Math.floor(state.wallet.caps))} caps ·{' '}
        {/* Currency-aware rather than hard-coded to cash: the panel stays visible into Act V,
            where data/acts.js declares no clickCurrency and the press reverts to caps. Rendered
            through getCurrency exactly as the click button does — a panel that hardcodes a
            currency name is "a bug waiting for the act that changes it" (data/currencies.js). */}
        {pressLabel(state)}
      </p>

      {SECTIONS.map((section) => (
        <OfferSection
          key={section.kind}
          section={section}
          offers={offers.filter((offer) => offer.kind === section.kind)}
          onBuy={buy}
        />
      ))}
    </div>
  );
}

module.exports = ConcessionsPanel;
