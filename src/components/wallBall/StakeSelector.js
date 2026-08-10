const React = require('react');
const { formatNumber } = require('../../utils/formatNumber');

// The stake slider. Convenience ONLY: its ceiling is the same 25%-of-caps figure the engine
// enforces, but engine/wallBall.js re-clamps whatever this sends, so nothing about the
// bounded-loss guarantee depends on this component behaving.
function StakeSelector({ stake, maxStake, minStake, onChange }) {
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
        <span className="wb-stake-cap">Nobody bets more than a quarter of what they have. Max {formatNumber(maxStake)}.</span>
        <button type="button" className="wb-stake-preset" onClick={() => onChange(maxStake)}>
          Max
        </button>
      </div>
    </div>
  );
}

module.exports = StakeSelector;
