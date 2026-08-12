const React = require('react');

// `label`, `value` and `max` are the original three props and behave exactly as they did; the
// two below are opt-in so any other caller keeps the plain bar.
//
// showCap prints "74 / 100" instead of "74". A coloured fill alone cannot answer "am I nearly
// done with this guy?" — the player has to know what the ceiling IS, and on a phone the fill
// being "almost full" is a few pixels of difference.
//
// nextStep is how much the next purchase would actually add (clamped, so it is 1 at 99/100).
// It is what drives the one-away marker: the sliver of track still to buy is drawn hatched so a
// stat that is one upgrade short is distinguishable at a glance from one that is three short.
function StatBar({ label, value, max = 100, showCap = false, nextStep = null }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const capped = value >= max;
  const oneAway = !capped && nextStep != null && nextStep > 0 && value + nextStep >= max;

  const rowClass = ['stat-bar-row', capped ? 'is-capped' : '', oneAway ? 'is-one-away' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      <span className="stat-label">{label}</span>
      <span className="stat-bar-track">
        <span className="stat-bar-fill" style={{ width: `${pct}%` }} />
        {oneAway && <span className="stat-bar-lastnotch" style={{ left: `${pct}%` }} />}
      </span>
      <span className="stat-bar-value">
        {Math.round(value)}
        {showCap && <span className="stat-bar-cap"> / {max}</span>}
      </span>
    </div>
  );
}

module.exports = StatBar;
