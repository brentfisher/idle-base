const React = require('react');

// A real line score, filling in inning by inning as the replay plays. `partial` carries a null
// for any inning not yet finished, so the table reads as a game in progress rather than a
// result that was already known — which it was, but the point of the replay is to not say so.
function BoxScore({ lineScore, partial, innings, final }) {
  const columns = Array.from({ length: innings }, (_, i) => i + 1);
  const total = (row) => row.reduce((sum, r) => sum + (r || 0), 0);

  const rows = [
    { name: lineScore.awayName, played: partial.away, full: lineScore.away },
    { name: lineScore.homeName, played: partial.home, full: lineScore.home },
  ];

  return (
    <div className="box-score">
      <table>
        <thead>
          <tr>
            <th className="box-team" />
            {columns.map((n) => (
              <th key={n}>{n}</th>
            ))}
            <th className="box-total">R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className={row.name === 'You' ? 'box-you' : undefined}>
              <td className="box-team">{row.name}</td>
              {columns.map((n) => (
                <td key={n}>{row.played[n - 1] === null || row.played[n - 1] === undefined ? '·' : row.played[n - 1]}</td>
              ))}
              <td className="box-total">{final ? total(row.full) : total(row.played)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

module.exports = BoxScore;
