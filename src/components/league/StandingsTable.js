const React = require('react');
const { winPct } = require('../../engine/standings');

// THE STANDINGS TABLE. Six columns, one highlighted row, and nothing else.
//
// Extracted from StandingsPanel by STORY-032 so that Act VII's ending can be the SAME TABLE rather
// than a second one that looks like it. PRD §7.8's last sentence is the whole argument: "the last
// screen of the game is the first screen the game ever taught you, and you are in the standings."
// A board panel that reimplemented these six columns would make that sentence a resemblance instead
// of a fact, and `conventions.md`'s pillar — reuse before invention — exists for exactly this case.
//
// ---------------------------------------------------------------------------------------------
// IT TAKES ROWS, NOT STATE, AND THAT IS WHAT MAKES IT SHARED RATHER THAN TWO-MODE.
//
// The version of this markup that lived inside StandingsPanel read `PLAYER_TEAM_ID` from
// engine/schedule.js and called `resolveTeamName(state, row.teamId)` per row. Neither means
// anything to a table of farm systems, and carrying them in would have made this a component with
// an `isBoard` branch — which is a second layout wearing one component's name.
//
// So the caller resolves both. Rows arrive carrying a display `name` and an `id`, and `highlightId`
// says which one is the player's. Each caller already knows the answer in its own vocabulary:
// StandingsPanel maps `teamId` through resolveTeamName() and highlights PLAYER_TEAM_ID; the board
// hands over rows that were never teams at all and highlights `earth`. This component knows about
// neither league and decides nothing, which is the layer split stated as a prop list.
//
// ROWS ARRIVE SORTED. The `#` column is the array index, so ordering is the caller's — and it has
// to be, because both callers sort with engine/standings.js's sortStandings() and a component that
// re-sorted would be a second, silent opinion about what a standings table is ordered by.
//
// THE HORIZONTAL SCROLLER IS PART OF THE COMPONENT, not decoration around it. Six columns of
// numbers do not fit 390px, and the wrapper is what keeps the PAGE from scrolling sideways instead
// of the table. StandingsPanel's own comment records the near-miss that taught this — a text input
// in a `<td>` fighting this scroller is the easiest way to hand a phone a horizontal scrollbar —
// and moving the scroller out of the shared component would put that lesson one file away from the
// markup it applies to.
// ---------------------------------------------------------------------------------------------
function StandingsTable({ rows, highlightId, teamHeading }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            {/* The one heading the two callers disagree about. Defaulted rather than required, so
                the league keeps reading exactly as it did and only the board has to say anything. */}
            <th>{teamHeading || 'Team'}</th>
            <th>W</th>
            <th>L</th>
            <th>Pct</th>
            <th>Run Diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={row.id === highlightId ? 'me' : undefined}>
              <td>{i + 1}</td>
              <td>{row.name}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              {/* winPct() from engine/standings.js, not a division here. It is the same function
                  the rows were sorted by, so the column can never disagree with the order. */}
              <td>{winPct(row).toFixed(3)}</td>
              <td>{row.runsFor - row.runsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

module.exports = StandingsTable;
