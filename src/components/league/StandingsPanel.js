const React = require('react');
const { useGame } = require('../../state/GameContext');
const { sortStandings, winPct } = require('../../engine/standings');
const { PLAYER_TEAM_ID } = require('../../engine/schedule');
const { resolveRules } = require('../../engine/modifiers');
const SeasonSchedulePanel = require('./SeasonSchedulePanel');

function teamName(state, teamId) {
  if (teamId === PLAYER_TEAM_ID) return 'Your Team';
  const team = state.league.teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

function StandingsPanel() {
  const { state } = useGame();
  const sorted = sortStandings(state.season.standings);
  // Resolved, not the hardcoded 4 this used to print: Act III declares `playoffTeams: 0`, and
  // telling a little leaguer that the top four make a postseason that does not exist is a lie
  // about the act's own win condition — finishing first IS the title there.
  const playoffTeams = resolveRules(state).playoffTeams;

  return (
    <div className="panel">
      <h2>League Standings</h2>
      <p className="muted">
        Season {state.season.seasonNumber} · Game {Math.min(state.season.scheduleIndex, state.season.gamesPerSeason)}
        /{state.season.gamesPerSeason} ·{' '}
        {playoffTeams >= 2 ? `Top ${playoffTeams} make the playoffs` : 'First place takes the title'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="standings">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Pct</th>
              <th>Run Diff</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.teamId} className={row.teamId === PLAYER_TEAM_ID ? 'me' : undefined}>
                <td>{i + 1}</td>
                <td>{teamName(state, row.teamId)}</td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{winPct(row).toFixed(3)}</td>
                <td>{row.runsFor - row.runsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SeasonSchedulePanel />
    </div>
  );
}

module.exports = StandingsPanel;
