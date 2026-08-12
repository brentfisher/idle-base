const React = require('react');
const { formatNumber } = require('../../utils/formatNumber');

// The stake slider. Convenience ONLY: engine/wallBall.js re-clamps whatever this sends, so
// nothing about the recoverability guarantee depends on this component behaving.
//
// The ceiling is now everything the player holds (STAKE_MAX_FRACTION is 1), so "Max" is
// genuinely all of it. That makes the max preset a button that can empty the jar in one tap,
// which is why it is labelled for what it does rather than "Max" — an all-in wager should be
// a thing the player chose, not a thing they discovered afterwards.
function StakeSelector({ stake, maxStake, minStake, onChange }) {
  const allIn = stake >= maxStake && maxStake > minStake;
  return (
    <div className="wb-stake">
      <div className="wb-stake-head">
        <span className="wb-stake-label">Wager</span>
        <span className="wb-stake-value">{formatNumber(stake)} caps</span>
      </div>
      <input
        className="wb-stake-slider"
        type="range"
        min={minStake}
        max={Math.max(minStake, maxStake)}
        step={1}
        value={stake}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="wb-stake-foot">
        <button type="button" className="wb-stake-preset" onClick={() => onChange(minStake)}>
          Min
        </button>
        <span className={`wb-stake-cap${allIn ? ' all-in' : ''}`}>
          {allIn
            ? 'Every cap you own is on this rally.'
            : `You can bet the whole jar — ${formatNumber(maxStake)} caps.`}
        </span>
        <button type="button" className="wb-stake-preset" onClick={() => onChange(maxStake)}>
          All in
        </button>
      </div>
    </div>
  );
}

module.exports = StakeSelector;
