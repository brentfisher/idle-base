const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { challengeView } = require('../../engine/wallBall');
const { DEFAULT_APPROACH_ID } = require('../../data/wallBallConfig');
const { formatNumber } = require('../../utils/formatNumber');
const StakeSelector = require('./StakeSelector');
const CrewList = require('./CrewList');

// Act II's panel. It renders whatever engine/wallBall.js says the wall currently looks like
// and decides nothing about odds, payouts or stake ceilings itself (the same contract
// components/lot/LotShop.js has with engine/lotShop.js).
//
// The selected approach and stake are local component state on purpose: they are a pending
// intent, not game state, and they are re-clamped by the engine when the challenge resolves.
function WallBallPanel() {
  const { state, dispatch } = useGame();
  const [approachId, setApproachId] = React.useState(DEFAULT_APPROACH_ID);
  const [requestedStake, setRequestedStake] = React.useState(1);

  const view = challengeView(state, approachId);
  // The ceiling moves with the balance every tick, so what the slider shows is always
  // re-derived rather than remembered.
  const stake = Math.max(view.minStake, Math.min(requestedStake, view.maxStake));
  const approach = view.approaches.find((a) => a.id === approachId) || view.approaches[0];
  const coolingDown = view.cooldownRemaining > 0;
  const ready = view.canWager && !coolingDown;

  return (
    <div className="wb-panel">
      <div className="wb-scoreline">
        <span className="wb-scoreline-item">
          <strong>{view.wins}</strong>/{view.winsRequired} wins
        </span>
        <span className="wb-scoreline-item">
          <strong>{view.respect}</strong> respect
          {view.nextCrewAt ? <em> · next kid at {view.nextCrewAt}</em> : null}
        </span>
        <span className="wb-scoreline-item">
          <strong>{view.crewSize}</strong>/{view.crewRequired} crew
        </span>
      </div>

      <div className="wb-challenger">
        <span className="wb-section-label">At the wall</span>
        <span className="wb-challenger-name">{view.challenger.name}</span>
        <span className="wb-challenger-taunt">{view.challenger.taunt}</span>
      </div>

      <div className="wb-approaches">
        {view.approaches.map((option) => (
          <button
            type="button"
            key={option.id}
            className={`wb-approach${option.id === approachId ? ' selected' : ''}`}
            onClick={() => setApproachId(option.id)}
          >
            <span className="wb-approach-name">{option.name}</span>
            <span className="wb-approach-desc">{option.description}</span>
            <span className="wb-approach-odds">
              {Math.round(option.lossChance * 100)}% chance you lose it · {option.payoutMult}x · +{option.respect} respect
            </span>
          </button>
        ))}
      </div>

      <StakeSelector stake={stake} maxStake={view.maxStake} minStake={view.minStake} onChange={setRequestedStake} />

      <button
        type="button"
        className="wb-challenge-button"
        disabled={!ready}
        onClick={() => dispatch({ type: actionTypes.RESOLVE_WALL_BALL_CHALLENGE, stake, approachId })}
      >
        {coolingDown && <span className="wb-challenge-label">Next kid steps up in {Math.ceil(view.cooldownRemaining)}s</span>}
        {!coolingDown && !view.canWager && <span className="wb-challenge-label">Nothing to wager — go hustle some caps</span>}
        {ready && (
          <>
            <span className="wb-challenge-label">Take the challenge</span>
            <span className="wb-challenge-sub">
              Win {formatNumber(Math.floor(stake * approach.payoutMult) - stake)} · lose {formatNumber(stake)}
            </span>
          </>
        )}
      </button>

      {view.lastResult && (
        <div className={`wb-result${view.lastResult.won ? ' won' : ' lost'}`}>
          <span className="wb-result-line">
            {view.lastResult.won
              ? `You took ${view.lastResult.challengerName} off the wall.`
              : `${view.lastResult.challengerName} had your number that time.`}
          </span>
          <span className="wb-result-detail">
            {view.lastResult.delta >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(view.lastResult.delta))} caps
            {view.lastResult.respectGained > 0 ? ` · +${view.lastResult.respectGained} respect` : ''}
            {view.lastResult.recruited > 0
              ? ` · ${view.lastResult.recruited === 1 ? 'a kid wants in' : `${view.lastResult.recruited} kids want in`}`
              : ''}
          </span>
        </div>
      )}

      <CrewList crew={state.crew || []} crewRequired={view.crewRequired} />
    </div>
  );
}

module.exports = WallBallPanel;
