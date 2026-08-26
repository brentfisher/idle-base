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
            // The state modifiers ride as classes as well as as inline colour: `is-warning` and
            // `is-starved` are what the stylesheet keys the badge and the emphasis off, and a chip
            // whose only signal was a hue would be exactly the colour-only encoding the readout is
            // careful to avoid everywhere else.
            className={
              `stat-chip resource-chip${row.starved ? ' is-starved' : ''}` +
              `${row.warning ? ' is-warning' : ''}${row.full ? ' is-full' : ''}`
            }
            key={row.id}
            // `--resource-accent` rather than three inline colours: the meter fill, the signed rate
            // and the border all take the same value, and threading it as a custom property lets the
            // stylesheet decide WHERE the accent lands while this file decides only what it is.
            style={{ background: tone.bg, color: tone.ink, '--resource-accent': tone.accent }}
            title={`${row.label}: ${formatNumber(row.amount)} of ${formatNumber(row.capacity)}`
              + ` · ${formatNet(row.shownNet)}`
              + (row.starved ? ' · empty and not recovering' : '')
              + (row.warning ? ` · empties in ${formatRunway(row.secondsUntilEmpty)}` : '')
              + (row.full ? ' · at capacity' : '')
              // The tooltip is where the chip has room to say the second half of it. The rate
              // above now reads the production figure on a full tank, and a number that is being
              // made but not banked has to say so somewhere or it is just a wrong reading.
              + (row.venting ? ' · surplus discarded — build storage to keep it' : '')
              // The chip is the only place a player sees Fuel before they open Ops, so the state
              // that looks like "switched off" has to be nameable from here too.
              + (row.unbanked ? ' · nothing can hold this yet' : '')}
          >
            <span className="label">{row.label}</span>
            <span className="resource-amount">
              {formatNumber(row.amount)}
              {/* The ceiling is the point of the chip, so it is always shown — including when it
                  is 0, which is a real state (no tank built yet) and not a missing value. */}
              <span className="resource-capacity">/{formatNumber(row.capacity)}</span>
            </span>
            {/* The rate takes the accent, so the one number that says whether this resource is in
                trouble is also the one thing on the chip wearing a colour.

                `shownNet`, NOT `net`, AND THE ENGINE CHOSE BETWEEN THEM. On a full tank the two
                differ: `net` is 0 because nothing is landing, `shownNet` is what the colony is
                making anyway. The chip prints the production figure and keeps every other full-tank
                signal exactly as it was — `100/100`, a bar at 100%, the `full` tone and `is-full` —
                so the reading is "making +15.0/s, tank is full", which is two facts rather than
                one silence. Which of the two rates this is remains engine/colonyReadout.js's
                decision; this line only puts the result on screen. */}
            <span className="resource-net">{formatNet(row.shownNet)}</span>
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
