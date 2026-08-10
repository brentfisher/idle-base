const React = require('react');

function StatBar({ label, value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="stat-bar-row">
      <span className="stat-label">{label}</span>
      <span className="stat-bar-track">
        <span className="stat-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="stat-bar-value">{Math.round(value)}</span>
    </div>
  );
}

module.exports = StatBar;
