const React = require('react');
const { useGame } = require('../../state/GameContext');
const { formatCash, formatNumber, formatDuration } = require('../../utils/formatNumber');
const { getEraConfig } = require('../../data/eras');
const { getActConfig } = require('../../data/acts');
const { computeModifiers } = require('../../engine/modifiers');
const { totalIncomePerSecond } = require('../../engine/income');

// Currencies are shown only once they are in play, and are never removed from state when
// they are retired from the header (PRD §4).
function HeaderStats() {
  const { state } = useGame();
  const act = getActConfig(state.progression.act);
  const era = getEraConfig(state.prestige.era);
  const rates = totalIncomePerSecond(state, computeModifiers(state));

  const showCaps = state.progression.act <= 2;
  const showCoins = state.progression.act >= 2 && state.progression.act <= 4;
  const showCash = state.progression.act >= 4;
  const showRespect = !!state.wallBall && state.progression.act < 2;

  return (
    <div className="header-stats">
      <span className="title">⚾ Idle Base</span>

      {showCaps && (
        <span className="stat-chip">
          <span className="label">Caps</span>
          {formatNumber(state.wallet.caps)}
          <span className="rate">+{rates.caps.toFixed(2)}/s</span>
        </span>
      )}
      {showCoins && (
        <span className="stat-chip">
          <span className="label">Coins</span>
          {formatNumber(state.wallet.coins)}
          <span className="rate">+{rates.coins.toFixed(2)}/s</span>
        </span>
      )}
      {showCash && (
        <span className="stat-chip">
          <span className="label">Cash</span>
          {formatCash(state.wallet.cash)}
          <span className="rate">+{rates.cash.toFixed(2)}/s</span>
        </span>
      )}
      {showRespect && (
        <span className="stat-chip">
          <span className="label">Respect</span>
          {state.wallBall.respect}
        </span>
      )}
      {state.progression.act >= 2 && (
        <span className="stat-chip">
          <span className="label">Reputation</span>
          {Math.round(state.reputation)}
        </span>
      )}

      <span className="stat-chip">
        <span className="label">Act {state.progression.act + 1}</span>
        {act.name}
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
          {state.season.seasonNumber} ·{' '}
          {{ regular: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason' }[state.season.phase]}
        </span>
      )}
      {state.progression.act >= 5 && (
        <span className="stat-chip">
          <span className="label">Era</span>
          {era.name}
        </span>
      )}
      <span className="stat-chip">
        <span className="label">Elapsed</span>
        {formatDuration(state.clock)}
      </span>
      {state.hasWonLeagueThisRun && <span className="stat-chip">🏆 Champions this run</span>}
    </div>
  );
}

module.exports = HeaderStats;
