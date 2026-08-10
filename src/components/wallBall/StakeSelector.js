const React = require('react');
const { formatNumber } = require('../../utils/formatNumber');
const { MIN_STAKE, STAKE_FRACTION_CAP } = require('../../engine/wallBall');

// Presentation only. The slider's max is a convenience — the stake is re-clamped in
// engine/wallBall.js: clampStake() on every dispatch, so nothing here is load-bearing for
// the bounded-loss invariant.
function StakeSelector({ stake, maxStake, onChange, disabled }) {
  const usable = maxStake >= MIN_STAKE;
  return (
    <div className="stake-selector">
      <label htmlFor="wall-ball-stake">
        Stake <strong>{formatNumber(stake)}</strong> caps
      </label>
      <input
        id="wall-ball-stake"
        type="range"
        min={MIN_STAKE}
        max={Math.max(MIN_STAKE, maxStake)}
        step={1}
        value={Math.min(stake, Math.max(MIN_STAKE, maxStake))}
        disabled={disabled || !usable}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="muted">
        House rule: never more than {Math.round(STAKE_FRACTION_CAP * 100)}% of what you are carrying.
        Max right now is {formatNumber(maxStake)} caps.
      </div>
      <div className="stake-presets">
        <button className="btn secondary" disabled={disabled || !usable} onClick={() => onChange(MIN_STAKE)}>
          Min
        </button>
        <button
          className="btn secondary"
          disabled={disabled || !usable}
          onClick={() => onChange(Math.max(MIN_STAKE, Math.floor(maxStake / 2)))}
        >
          Half
        </button>
        <button className="btn secondary" disabled={disabled || !usable} onClick={() => onChange(maxStake)}>
          Max
        </button>
      </div>
    </div>
  );
}

module.exports = StakeSelector;
