const React = require('react');
const { useGame } = require('../../state/GameContext');

function opponentName(state, teamId) {
  const team = state.league.teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

function SeasonSchedulePanel() {
  const { state } = useGame();
  const { schedule, scheduleIndex } = state.season;
  const recent = schedule.slice(Math.max(0, scheduleIndex - 5), scheduleIndex).reverse();
  const upcoming = schedule.slice(scheduleIndex, scheduleIndex + 5);

  return (
    <div>
      <h3>Recent Games</h3>
      <div className="card-grid">
        {recent.length === 0 && <span className="muted">No games played yet.</span>}
        {recent.map((g) => (
          <div className="card" key={g.gameIndex}>
            <span className={g.result === 'win' ? '' : 'muted'}>
              {g.result === 'win' ? 'W' : 'L'} {g.score}
            </span>
            <div className="muted">
              {g.isHome ? 'vs' : '@'} {opponentName(state, g.opponentTeamId)}
            </div>
          </div>
        ))}
      </div>
      <h3>Upcoming</h3>
      <div className="card-grid">
        {upcoming.map((g) => (
          <div className="card" key={g.gameIndex}>
            {g.isHome ? 'vs' : '@'} {opponentName(state, g.opponentTeamId)}
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = SeasonSchedulePanel;
