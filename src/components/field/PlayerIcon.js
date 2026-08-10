const React = require('react');
const { playerOverall } = require('../../engine/strength');

// Simple rating -> color ramp: low rating reds out, high rating glows gold.
function ratingColor(rating) {
  if (rating >= 65) return '#f4d35e';
  if (rating >= 50) return '#6ab04c';
  if (rating >= 35) return '#4a90a4';
  return '#a44a4a';
}

function PlayerIcon({ x, y, position, player }) {
  const rating = player ? Math.round(playerOverall(player)) : 0;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r="5" fill={ratingColor(rating)} stroke="#0d1f14" strokeWidth="0.6" />
      <text className="player-icon-pos" y="1.3">
        {position}
      </text>
      <text className="player-icon-label" y="8.5">
        {player ? player.name.split(' ').slice(-1)[0] : '—'}
      </text>
      <text className="player-icon-label" y="12" opacity="0.75">
        {rating}
      </text>
    </g>
  );
}

module.exports = PlayerIcon;
