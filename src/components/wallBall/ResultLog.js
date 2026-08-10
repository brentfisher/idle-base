const React = require('react');
const { formatNumber } = require('../../utils/formatNumber');

function ResultLog({ history }) {
  if (!history || history.length === 0) {
    return <p className="muted">No rallies yet.</p>;
  }
  return (
    <ul className="result-log">
      {history.map((entry) => (
        <li key={entry.id} className={entry.won ? 'won' : 'lost'}>
          <span className="result-verdict">{entry.won ? 'WON' : 'LOST'}</span>{' '}
          {entry.approachName} vs {entry.challengerName} —{' '}
          {entry.won
            ? `+${formatNumber(entry.payout)} caps, +${entry.respectGained} Respect`
            : `−${formatNumber(entry.stake)} caps`}
          {entry.recruited.length > 0 && (
            <span className="result-recruit"> · {entry.recruited.join(', ')} joined the crew</span>
          )}
        </li>
      ))}
    </ul>
  );
}

module.exports = ResultLog;
