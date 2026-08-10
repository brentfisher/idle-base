const React = require('react');
const { APPROACHES } = require('../../data/wallBallConfig');

// Odds are shown, not hidden: the whole point of a resolved strength check rather than a
// twitch mini-game is that the player is making an informed wager.
function ChallengeCard({ challenger, kitQuality, probabilities, selectedApproachId, onSelect, disabled }) {
  return (
    <div className="challenge-card">
      <div className="challenge-header">
        <div>
          <h3>{challenger.name}</h3>
          <p className="muted challenger-taunt">“{challenger.taunt}”</p>
        </div>
        <div className="challenge-strengths">
          <div>
            <span className="label">Your kit</span>
            <strong>{kitQuality.toFixed(1)}</strong>
          </div>
          <div>
            <span className="label">Them</span>
            <strong>{challenger.strength}</strong>
          </div>
        </div>
      </div>

      <div className="approach-grid">
        {APPROACHES.map((approach) => {
          const p = probabilities[approach.id];
          const selected = approach.id === selectedApproachId;
          return (
            <button
              key={approach.id}
              className={['approach', selected ? 'selected' : ''].join(' ').trim()}
              disabled={disabled}
              onClick={() => onSelect(approach.id)}
            >
              <strong>{approach.name}</strong>
              <span className="approach-odds">{Math.round(p * 100)}% to win</span>
              <span className="approach-payout">pays {approach.payoutMult}x</span>
              <span className="muted approach-desc">{approach.description}</span>
              <span className="muted approach-meta">
                +{approach.respectOnWin} Respect · {approach.cooldownSeconds}s to line up
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

module.exports = ChallengeCard;
