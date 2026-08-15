const React = require('react');
const { useGame } = require('../../state/GameContext');
const { listResources } = require('../../engine/colonyReadout');
const { resourceTone } = require('../../data/colonyReadoutConfig');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');

// The four consumables, as chips. A currency chip cannot say what these need to say — an amount
// against a ceiling, the SIGN of a net rate, and a warning before the resource bottoms out — which
// is why this is a separate component rather than another entry in the currency row.
//
// IT DECIDES NOTHING. Every field it renders was decided by engine/colonyReadout.js: the warning
// state, the trend, the runway, even which tone to wear. This component's entire job is to put
// them on screen. That is not ceremony — the header must never compute a rate the engine did not
// hand it, because a header that disagrees with the simulation about when Power runs out is worse
// than a header with no rates at all.

function formatNet(net) {
  if (!Number.isFinite(net) || net === 0) return '0/s';
  const magnitude = Math.abs(net) < 10 ? Math.abs(net).toFixed(1) : formatNumber(Math.abs(net));
  return `${net > 0 ? '+' : '−'}${magnitude}/s`;
}

// Infinity means "not falling" and must not be formatted as a duration — see the note on
// secondsUntilEmpty(). An em dash reads as "no countdown here", which is what it is.
function formatRunway(seconds) {
  return Number.isFinite(seconds) ? formatDuration(Math.round(seconds)) : '—';
}

function ResourceChips() {
  const { state } = useGame();
  const rows = listResources(state);

  return (
    <React.Fragment>
      {rows.map((row) => {
        const tone = resourceTone(row);
        return (
          <span
            className="stat-chip resource-chip"
            key={row.id}
            style={{ background: tone.bg, color: tone.ink }}
            title={`${row.label}: ${formatNumber(row.amount)} of ${formatNumber(row.capacity)}`
              + ` · ${formatNet(row.net)}`
              + (row.starved ? ' · empty and not recovering' : '')
              + (row.warning ? ` · empties in ${formatRunway(row.secondsUntilEmpty)}` : '')
              + (row.full ? ' · at capacity' : '')}
          >
            <span className="label">{row.label}</span>
            <span className="resource-amount">
              {formatNumber(row.amount)}
              {/* The ceiling is the point of the chip, so it is always shown — including when it
                  is 0, which is a real state (no tank built yet) and not a missing value. */}
              <span className="resource-capacity">/{formatNumber(row.capacity)}</span>
            </span>
            <span className="resource-net">{formatNet(row.net)}</span>
            {/* The meter is the fastest read on the chip and the only part that survives being
                glanced at. Rendered under the text rather than beside it: 390px has no room for a
                fifth column, and a bar the full width of the chip is easier to judge anyway. */}
            <span className="resource-track">
              <span className="resource-fill" style={{ width: `${(row.fraction * 100).toFixed(1)}%` }} />
            </span>
          </span>
        );
      })}
    </React.Fragment>
  );
}

module.exports = ResourceChips;
