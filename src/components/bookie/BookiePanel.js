const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { bookieView } = require('../../engine/bookie');
const { computeModifiers } = require('../../engine/modifiers');
const { SIDE_FOR } = require('../../data/actFourConfig');
const { formatNumber } = require('../../utils/formatNumber');
// The reputation wording, from data/ rather than from this file. The two UNAVAILABLE_COPY blocks
// below predate the house rule and are left where they are; nothing new is added to them.
const { PROP_COPY } = require('../../data/propBetsConfig');

// Act IV's table. It renders whatever engine/bookie.js says the line currently is and decides
// nothing about odds, ceilings or availability itself — the same contract Act II's panel has
// with engine/wallBall.js.
//
// The chosen side and amount are local component state on purpose: they are a pending intent,
// not game state, and the engine re-clamps both when the wager is placed.
const UNAVAILABLE_COPY = {
  openWager: 'You already have money on this one. One at a time.',
  noGame: 'Nothing to bet on between seasons. He will be back at the fence in the spring.',
  belowFloor: 'He looks at what you are holding and goes back to his coffee. Come back with more.',
};

// The prop board's own reasons. Separate from the ones above because the two bets are gated
// separately — an open moneyline does not close the prop board, and saying "one at a time"
// there would be a lie.
const PROP_UNAVAILABLE_COPY = {
  openProp: 'He has already written one down for you. He is not writing two.',
  noGame: 'No game, no props. He puts the notebook away.',
  belowFloor: 'He turns the page back to the real odds without saying anything.',
};

// The board is DERIVED, never stored (engine/bookie.js propOfferSeed), so it turns over on its
// own between renders. The selected offer is therefore re-found by id every render rather than
// remembered: if the board has moved on, the selection falls back to whatever is on it now, and
// the engine refuses a stale id outright if one somehow gets dispatched.
function PropBoard({ view, dispatch }) {
  const props = view.props;
  const [selectedId, setSelectedId] = React.useState(null);
  const [requested, setRequested] = React.useState(0);

  const chosen = props.offers.find((o) => o.id === selectedId) || props.offers[0] || null;
  const amount = Math.max(props.minBet, Math.min(requested || props.minBet, props.maxBet));
  const ready = !props.unavailableReason && chosen && props.maxBet >= props.minBet;

  return (
    <div className="bp-board">
      <span className="bk-section-label">The other page</span>
      <p className="muted bp-blurb">
        He turns the notebook around. None of it is about who wins. He will take money on all of
        it.
      </p>

      {props.pending && (
        <div className="bp-open">
          <span className="bp-open-line">${formatNumber(props.pending.amount)} on: {props.pending.text}</span>
          <span className="bp-open-detail">
            {props.pending.payoutMult.toFixed(2)}x · pays $
            {formatNumber(Math.round(props.pending.amount * props.pending.payoutMult))}
            {props.pending.reputation ? ` and ${PROP_COPY.reputationQuote(props.pending.reputation)}` : ''} if it
            happens. He settles it after the next game.
          </span>
        </div>
      )}

      {props.offers.length > 0 && (
        <div className="bp-offers">
          {props.offers.map((offer) => (
            <button
              type="button"
              key={offer.id}
              className={`bp-offer${chosen && offer.id === chosen.id ? ' selected' : ''}`}
              onClick={() => setSelectedId(offer.id)}
            >
              <span className="bp-offer-text">{offer.text}</span>
              <span className="bp-offer-odds">
                {offer.payoutMult.toFixed(2)}x · he gives it {Math.round(offer.winChance * 100)}%
                {/* The second thing a win pays, quoted before the money is down. It is the only
                    reason to open this page that survives the -25% edge, so it is on the offer and
                    not just on the result. The number is the engine's (engine/bookie.js
                    propReputationFor) — it scales with the payout so no line on the board is a
                    better reputation buy than any other. */}
                <span className="bp-offer-rep"> · {PROP_COPY.reputationQuote(offer.reputation)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {ready && (
        <>
          <div className="bp-stake">
            <label>
              <span className="bp-stake-label">${formatNumber(amount)} on it</span>
              <input
                type="range"
                min={props.minBet}
                max={Math.max(props.minBet, props.maxBet)}
                step={1}
                value={amount}
                onChange={(e) => setRequested(Number(e.target.value))}
              />
            </label>
            <span className="muted">Props are pocket money. He will not take more than a twentieth of it.</span>
          </div>

          <button
            type="button"
            className="bp-place"
            onClick={() => dispatch({ type: actionTypes.PLACE_PROP_BET, offerId: chosen.id, amount })}
          >
            <span className="bp-place-label">Write it down</span>
            <span className="bp-place-sub">
              Win ${formatNumber(Math.round(amount * chosen.payoutMult) - amount)} · lose ${formatNumber(amount)}
            </span>
          </button>
        </>
      )}

      {props.unavailableReason && (
        <p className="bp-unavailable">{PROP_UNAVAILABLE_COPY[props.unavailableReason]}</p>
      )}

      {props.lastResult && (
        <div className={`bp-result${props.lastResult.won ? ' won' : ' lost'}`}>
          <span className="bp-result-line">
            {props.lastResult.won ? 'It happened.' : 'It did not happen.'} {props.lastResult.text}
          </span>
          <span className="bp-result-detail">
            {props.lastResult.delta >= 0 ? '+' : '−'}${formatNumber(Math.abs(props.lastResult.delta))} ·{' '}
            {props.lastResult.payoutMult.toFixed(2)}x
            {/* Guarded on the value rather than on `won`: a result written before props paid
                reputation has no such field, and saves are never migrated here. */}
            {props.lastResult.reputation > 0 && (
              <span className="bp-result-rep"> · {PROP_COPY.reputationWon(props.lastResult.reputation)}</span>
            )}
          </span>
        </div>
      )}

      {(props.record.wins > 0 || props.record.losses > 0) && (
        <p className="muted bp-record">
          {props.record.wins}-{props.record.losses} on props, {props.record.net >= 0 ? 'up' : 'down'} $
          {formatNumber(Math.abs(Math.round(props.record.net)))}.
        </p>
      )}
    </div>
  );
}

function OpenWager({ wager }) {
  return (
    <div className="bk-open">
      <span className="bk-open-line">
        ${formatNumber(wager.amount)} {wager.side === SIDE_FOR ? 'on your team' : 'against your team'} vs the{' '}
        {wager.opponentName}
      </span>
      <span className="bk-open-detail">Pays ${formatNumber(Math.round(wager.amount * wager.payoutMult))} if it lands.</span>
    </div>
  );
}

function BookiePanel() {
  const { state, dispatch } = useGame();
  const [side, setSide] = React.useState(SIDE_FOR);
  const [requested, setRequested] = React.useState(0);

  const view = bookieView(state, computeModifiers(state));
  // The ceiling moves with the balance every tick, so what the slider shows is always
  // re-derived rather than remembered.
  const amount = Math.max(view.minWager, Math.min(requested || view.minWager, view.maxWager));
  const chosen = view.sides.find((s) => s.id === side) || view.sides[0];
  const ready = !view.unavailableReason && view.maxWager >= view.minWager;

  return (
    <div className="panel bk-panel">
      <h2>The Man At The Fence</h2>
      <p className="muted">
        He does not introduce himself and he does not watch the game. He writes in a notebook and he
        pays in cash.
      </p>

      {view.wager && <OpenWager wager={view.wager} />}

      {view.matchup && (
        <div className="bk-matchup">
          <span className="bk-section-label">Next game</span>
          <span className="bk-matchup-name">
            {view.matchup.isHome ? 'vs' : 'at'} the {view.matchup.opponentName}
          </span>
          <span className="bk-matchup-odds">
            He has you at {Math.round(view.matchup.playerWinProbability * 100)}% to win it.
          </span>
        </div>
      )}

      {ready && (
        <>
          <div className="bk-sides">
            {view.sides.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`bk-side${option.id === side ? ' selected' : ''}`}
                onClick={() => setSide(option.id)}
              >
                <span className="bk-side-name">{option.label}</span>
                <span className="bk-side-odds">
                  {option.payoutMult.toFixed(2)}x · {Math.round(option.chance * 100)}% chance
                </span>
              </button>
            ))}
          </div>

          <div className="bk-stake">
            <label>
              <span className="bk-stake-label">
                ${formatNumber(amount)} of ${formatNumber(Math.floor(view.cash))}
              </span>
              <input
                type="range"
                min={view.minWager}
                max={Math.max(view.minWager, view.maxWager)}
                step={1}
                value={amount}
                onChange={(e) => setRequested(Number(e.target.value))}
              />
            </label>
            <span className="muted">He will not take more than a fifth of what you are carrying.</span>
          </div>

          <button
            type="button"
            className="bk-place"
            onClick={() => dispatch({ type: actionTypes.PLACE_BOOKIE_WAGER, amount, side })}
          >
            <span className="bk-place-label">Put it down</span>
            <span className="bk-place-sub">
              Win ${formatNumber(Math.round(amount * chosen.payoutMult) - amount)} · lose ${formatNumber(amount)}
            </span>
          </button>
        </>
      )}

      {view.unavailableReason && <p className="bk-unavailable">{UNAVAILABLE_COPY[view.unavailableReason]}</p>}

      {view.lastResult && (
        <div className={`bk-result${view.lastResult.won ? ' won' : ' lost'}`}>
          <span className="bk-result-line">
            {view.lastResult.won
              ? `He counts out $${formatNumber(view.lastResult.payout)} without looking up.`
              : `He puts your $${formatNumber(view.lastResult.amount)} in his coat pocket.`}
          </span>
          <span className="bk-result-detail">
            {view.lastResult.delta >= 0 ? '+' : '−'}${formatNumber(Math.abs(view.lastResult.delta))} · vs the{' '}
            {view.lastResult.opponentName}
          </span>
        </div>
      )}

      {/* Outside the moneyline's `ready` gate on purpose. `ready` is false whenever a
          moneyline is open, and a prop is a different bet on a different page — gating one on
          the other would hide the whole board the moment the player backs their own team. */}
      <PropBoard view={view} dispatch={dispatch} />

      <p className="muted bk-record">
        {view.record.wins}-{view.record.losses} with him, {view.record.net >= 0 ? 'up' : 'down'} $
        {formatNumber(Math.abs(Math.round(view.record.net)))} on the summer.
      </p>
    </div>
  );
}

module.exports = BookiePanel;
