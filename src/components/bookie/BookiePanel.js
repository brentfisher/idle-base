const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { bookieView } = require('../../engine/bookie');
const { computeModifiers } = require('../../engine/modifiers');
const { SIDE_FOR } = require('../../data/actFourConfig');
const { formatNumber } = require('../../utils/formatNumber');

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

      <p className="muted bk-record">
        {view.record.wins}-{view.record.losses} with him, {view.record.net >= 0 ? 'up' : 'down'} $
        {formatNumber(Math.abs(Math.round(view.record.net)))} on the summer.
      </p>
    </div>
  );
}

module.exports = BookiePanel;
