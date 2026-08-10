const React = require('react');
const StatBar = require('../common/StatBar');
const UpgradeButton = require('./UpgradeButton');
const { playerOverall } = require('../../engine/strength');
const { formatDuration } = require('../../utils/formatNumber');

const POSITION_STATS = {
  P: ['pitching', 'defense', 'contact', 'power', 'speed'],
  DEFAULT: ['power', 'contact', 'speed', 'defense'],
};

function PlayerCard({ player, clock }) {
  const stats = POSITION_STATS[player.position] || POSITION_STATS.DEFAULT;
  const overall = Math.round(playerOverall(player));
  const inCamp = !!player.campStatus;
  const campRemaining = inCamp ? Math.max(0, player.campStatus.completesAtClock - clock) : 0;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{player.name}</strong>
        <span className="muted">
          {player.position} {player.isStarter ? '' : '(bench)'}
        </span>
      </div>
      <div className="muted">
        OVR {overall} · Age {player.age} · Season {player.seasonsPlayed}/{player.retireAtSeasons}
      </div>
      {inCamp && (
        <div className="muted" style={{ color: '#f4d35e' }}>
          In camp — {formatDuration(campRemaining)} left
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        {stats.map((stat) => (
          <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <StatBar label={stat} value={player.stats[stat]} />
            </div>
            <UpgradeButton playerId={player.id} stat={stat} currentValue={player.stats[stat]} />
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = PlayerCard;
