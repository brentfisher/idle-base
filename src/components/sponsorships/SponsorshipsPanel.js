const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { listOffers, sponsorshipsPerSecond, sponsorMultiplier } = require('../../engine/sponsorships');
const { travelBallView } = require('../../engine/travelBall');
const { KIND_SPONSOR, KIND_REPUTATION } = require('../../data/actFourConfig');
const { formatNumber } = require('../../utils/formatNumber');

// Act IV's shop, and the one place the act's exit is legible as a number. Renders
// engine/sponsorships.js: listOffers() verbatim, including its cost/owned/locked/affordable
// flags, and decides none of them itself — the same contract Act III's panel has with
// engine/concessions.js.
function OfferCard({ offer, onBuy }) {
  const disabled = offer.owned || offer.locked || !offer.affordable;
  const classes = ['sp-offer', offer.owned ? 'owned' : '', offer.locked ? 'locked' : '']
    .join(' ')
    .trim();

  return (
    <button type="button" className={classes} disabled={disabled} onClick={() => onBuy(offer.id)}>
      <span className="sp-offer-head">
        <span className="sp-offer-name">{offer.name}</span>
        {offer.locked && <span className="sp-offer-lock">{offer.minReputation} rep</span>}
      </span>
      <span className="sp-offer-desc">{offer.description}</span>
      <span className="sp-offer-foot">
        <span className="sp-offer-effect">{offer.effect}</span>
        <span className="sp-offer-cost">{offer.owned ? 'Signed' : `$${formatNumber(offer.cost)}`}</span>
      </span>
    </button>
  );
}

// The act's progress, as the thing the player is actually working toward rather than as two
// numbers to combine in their head — the lesson Act II's crew bar taught. Until two seasons
// are in the books the bar tracks seasons, because no win rate can end the act before then.
function ActProgress({ view }) {
  const pct = Math.round(view.fraction * 100);
  const rate = Math.round(view.winRate * 100);
  const required = Math.round(view.winRateRequired * 100);

  return (
    <div className="sp-progress">
      <div className="sp-progress-head">
        <strong>{view.canAdvance ? 'Somebody has seen enough.' : 'Two seasons. Sixty percent.'}</strong>
        <span className="muted">
          {view.wins}-{view.losses} over the last {Math.min(view.seasonsCompleted, view.seasonsRequired)} of{' '}
          {view.seasonsRequired} · {rate}% against {required}%
        </span>
      </div>
      <div className="sp-bar">
        <div className="sp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted">
        {view.canAdvance
          ? 'You have done it over two full summers. That is the part they were waiting on.'
          : view.gate === 'seasons'
            ? `A hot fifteen games is not the same as a season. ${view.seasonsLeft} more to finish.`
            : 'Your last two seasons are the whole record. Win now and the old ones stop counting.'}
      </p>
    </div>
  );
}

function SponsorshipsPanel() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const sponsors = offers.filter((o) => o.kind === KIND_SPONSOR);
  const reputationDeals = offers.filter((o) => o.kind === KIND_REPUTATION);
  const rate = sponsorshipsPerSecond(state);
  const multiplier = sponsorMultiplier(state);
  const view = travelBallView(state);
  const buy = (offerId) => dispatch({ type: actionTypes.BUY_SPONSORSHIP, offerId });

  return (
    <div className="panel">
      <h2>Who Is Paying For This</h2>
      <p className="muted">
        Sponsors earning ${rate.toFixed(0)}/sec · reputation {Math.round(state.reputation)} is paying them{' '}
        {Math.round((multiplier - 1) * 100)}% over the rate on the paper
      </p>

      <ActProgress view={view} />

      <h3>Sponsors</h3>
      <p className="muted">
        Signed once, and they keep paying. What they pay goes up with your name, so the first deal
        is worth more at the end of the summer than it was the day you signed it.
      </p>
      <div className="sp-grid">
        {sponsors.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>

      <h3>Making a Bigger Name</h3>
      <p className="muted">
        Reputation is worth the same two things it has always been worth: every point above 20 makes
        the team stronger in every game, and makes every sponsor pay more.
      </p>
      <div className="sp-grid">
        {reputationDeals.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={buy} />
        ))}
      </div>
    </div>
  );
}

module.exports = SponsorshipsPanel;
