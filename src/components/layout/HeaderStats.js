const React = require('react');
const { useGame } = require('../../state/GameContext');
const { formatCash, formatNumber } = require('../../utils/formatNumber');
const { getEraConfig } = require('../../data/eras');

function HeaderStats() {
  const { state } = useGame();
  const era = getEraConfig(state.prestige.era);
  // The stadium and the season are absent, not zero, until their act creates them.
  const phaseLabel = state.season
    ? { regular: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason' }[state.season.phase]
    : null;

  return (
    <div className="header-stats">
      <span className="title">⚾ Idle Base</span>
      <span className="stat-chip">
        <span className="label">Cash</span>
        {formatCash(state.cash)}
      </span>
      <span className="stat-chip">
        <span className="label">Reputation</span>
        {Math.round(state.reputation)}
      </span>
      {state.stadium && (
        <span className="stat-chip">
          <span className="label">Capacity</span>
          {formatNumber(state.stadium.capacity)}
        </span>
      )}
      {state.season && (
        <span className="stat-chip">
          <span className="label">Season</span>
          {state.season.seasonNumber} · {phaseLabel}
        </span>
      )}
      <span className="stat-chip">
        <span className="label">Era</span>
        {era.name}
      </span>
      {state.hasWonLeagueThisRun && <span className="stat-chip">🏆 Champions this run</span>}
    </div>
  );
}

module.exports = HeaderStats;
