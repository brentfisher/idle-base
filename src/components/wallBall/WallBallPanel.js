const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { formatNumber } = require('../../utils/formatNumber');
const { KIT_ITEMS } = require('../../data/kitConfig');
const { APPROACHES } = require('../../data/wallBallConfig');
const wallBall = require('../../engine/wallBall');
const ChallengeCard = require('./ChallengeCard');
const StakeSelector = require('./StakeSelector');
const CrewList = require('./CrewList');
const ResultLog = require('./ResultLog');

function WallBallPanel() {
  const { state, dispatch } = useGame();
  const [approachId, setApproachId] = React.useState('normal');
  const [stake, setStake] = React.useState(wallBall.MIN_STAKE);

  // wallBall is constructed by enterAct(state, 1); the panel is only reachable once the
  // 'wallBall' feature is unlocked, but a guard here keeps the component honest.
  if (!state.wallBall) return null;

  const caps = Math.floor(state.wallet.caps);
  const maxStake = wallBall.maxStake(state);
  const cooldown = wallBall.cooldownRemaining(state);
  const ready = wallBall.canChallenge(state);
  const tooPoor = caps < wallBall.MIN_CAPS_TO_CHALLENGE;
  const clampedStake = Math.min(Math.max(stake, wallBall.MIN_STAKE), Math.max(wallBall.MIN_STAKE, maxStake));

  const probabilities = APPROACHES.reduce((map, approach) => {
    map[approach.id] = wallBall.approachWinProbability(state, approach.id);
    return map;
  }, {});

  function throwIt() {
    dispatch({ type: actionTypes.RESOLVE_WALL_BALL_CHALLENGE, approachId, stake: clampedStake });
  }

  const gear = KIT_ITEMS.filter((item) => item.act === 1);
  const last = state.wallBall.lastResult;

  return (
    <div className="panel wall-ball-panel">
      <h2>Off the Wall</h2>
      <p className="muted">
        Chalk strike zone on the loading dock. Put caps on it, pick your line, and throw.
      </p>

      <div className="wall-ball-scoreboard">
        <span className="stat-chip">
          <span className="label">Wins</span>
          {state.wallBall.wins}/5
        </span>
        <span className="stat-chip">
          <span className="label">Losses</span>
          {state.wallBall.losses}
        </span>
        <span className="stat-chip">
          <span className="label">Respect</span>
          {state.wallBall.respect}
        </span>
        <span className="stat-chip">
          <span className="label">Crew</span>
          {state.crew.length}/3
        </span>
      </div>

      <ChallengeCard
        challenger={wallBall.currentChallenger(state)}
        kitQuality={wallBall.kitQuality(state)}
        probabilities={probabilities}
        selectedApproachId={approachId}
        onSelect={setApproachId}
        disabled={false}
      />

      <StakeSelector stake={clampedStake} maxStake={maxStake} onChange={setStake} disabled={!ready} />

      <button className="btn throw-button" disabled={!ready} onClick={throwIt}>
        {cooldown > 0
          ? `Lining up the next one — ${Math.ceil(cooldown)}s`
          : tooPoor
            ? `Need ${wallBall.MIN_CAPS_TO_CHALLENGE} caps to get in the game — go Hustle`
            : `Throw — ${formatNumber(clampedStake)} caps on it`}
      </button>

      {tooPoor && (
        <p className="muted">
          Nobody takes your action below {wallBall.MIN_CAPS_TO_CHALLENGE} caps. The lot is still there, and it
          still pays.
        </p>
      )}

      {last && (
        <div className={['last-result', last.won ? 'won' : 'lost'].join(' ')}>
          {last.won
            ? `You took ${last.challengerName} for ${formatNumber(last.payout)} caps.`
            : `${last.challengerName} had your number. Down ${formatNumber(last.stake)} caps.`}
        </div>
      )}

      <h3>Gear</h3>
      <p className="muted">Better kit, better odds — up to a point. The block always sends someone tougher.</p>
      <div className="card-grid">
        {gear.map((item) => {
          const owned = state.kit.ownedItemIds.includes(item.id);
          return (
            <div className="card" key={item.id}>
              <strong>{item.name}</strong>
              <p className="muted">{item.description}</p>
              <p className="muted">+{item.strength} kit quality</p>
              <button
                className="btn"
                disabled={owned || caps < item.cost}
                onClick={() => dispatch({ type: actionTypes.BUY_KIT_ITEM, itemId: item.id })}
              >
                {owned ? 'Owned' : `Buy — ${formatNumber(item.cost)} caps`}
              </button>
            </div>
          );
        })}
      </div>

      <CrewList crew={state.crew} respect={state.wallBall.respect} />

      <h3>Recent rallies</h3>
      <ResultLog history={state.wallBall.history} />
    </div>
  );
}

module.exports = WallBallPanel;
