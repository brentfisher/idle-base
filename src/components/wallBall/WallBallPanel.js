const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { challengeView } = require('../../engine/wallBall');
const { DEFAULT_APPROACH_ID } = require('../../data/wallBallConfig');
const { formatNumber } = require('../../utils/formatNumber');
const StakeSelector = require('./StakeSelector');
const CrewList = require('./CrewList');
const WallBallShop = require('./WallBallShop');

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
  const progress = view.crewProgress;

  return (
    <div className="wb-panel">
      {/* What the player is working toward RIGHT NOW is one more kid, so that is the bar.
          Cumulative wins against the exit requirement used to sit here and read as a broken
          progress bar ("7/5"), because the win half of the exit is satisfied long before the
          crew half ever is. The record is a record; it is not progress. */}
      <div className="wb-progress">
        <div className="wb-progress-head">
          <span className="wb-progress-label">
            {progress.done ? 'The crew is yours' : `Next kid at ${progress.to} respect`}
          </span>
          <span className="wb-progress-count">
            {view.crewSize}/{view.crewRequired} crew
          </span>
        </div>
        <div className="wb-progress-track">
          <div className="wb-progress-fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
        </div>
        <div className="wb-progress-foot">
          <span>
            {progress.done ? `${view.respect} respect` : `${progress.have}/${progress.need} respect toward them`}
          </span>
          <span className="wb-record">
            {view.wins}W · {view.losses}L
          </span>
        </div>
      </div>

      {view.capsMultiplier > 1 && (
        <p className="wb-note">
          Being known is worth something: caps come in {Math.round((view.capsMultiplier - 1) * 100)}% faster.
        </p>
      )}

      {/* The second thing respect buys, said out loud. It is a reward that happens *between*
          rallies, so without a line of copy the player experiences it as nothing at all —
          they never see the 22s they are no longer waiting. Both numbers, so the comparison
          is on screen rather than in their memory. */}
      {view.cooldownSeconds < view.baseCooldownSeconds && (
        <p className="wb-note">
          The line moves for you now: {Math.round(view.cooldownSeconds)}s between kids instead of{' '}
          {view.baseCooldownSeconds}s{view.cooldownAtFloor ? " — and that is as fast as they'll come." : '.'}
        </p>
      )}

      {view.canAdvance && (
        <p className="wb-advance">
          You have the crew and the record. Win one more and you are done with this wall — Little
          League signs up at the hardware store.
        </p>
      )}

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
              {/* The third thing a win buys, and the one the act was not paying out loud. Caps and
                  respect are both banked; this is the one the player feels immediately, and the
                  riskier the line the shorter the wait. Engine-resolved seconds — see
                  challengeView(). */}
              <span className="wb-approach-tempo"> · next kid in {Math.round(option.winCooldownSeconds)}s</span>
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
        {!coolingDown && !view.canWager && (
          <span className="wb-challenge-label">
            Nobody plays for less than {view.minStake} caps — go hustle, or buy some help
          </span>
        )}
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
      <WallBallShop />
    </div>
  );
}

module.exports = WallBallPanel;
