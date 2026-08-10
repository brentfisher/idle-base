const React = require('react');
const { useGame } = require('../../state/GameContext');
const { PLAYER_TEAM_ID } = require('../../engine/schedule');
const { formatDuration } = require('../../utils/formatNumber');

function teamName(state, teamId) {
  if (!teamId) return 'TBD';
  if (teamId === PLAYER_TEAM_ID) return 'Your Team';
  const team = state.league.teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

function PlayoffBracket() {
  const { state } = useGame();
  const { playoffs } = state.season;

  if (!playoffs) {
    return (
      <div className="panel">
        <h2>Playoffs</h2>
        <p className="muted">
          No playoff bracket right now — the top 4 teams qualify at the end of the regular season.
          {state.season.lastOffseasonSummary && (
            <>
              {' '}
              Last season: {state.season.lastOffseasonSummary.wins}-{state.season.lastOffseasonSummary.losses},{' '}
              {state.season.lastOffseasonSummary.madePlayoffs ? 'made the playoffs' : 'missed the playoffs'}
              {state.season.lastOffseasonSummary.wonChampionship ? ' and won the championship!' : '.'}
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Playoffs</h2>
      {playoffs.champion ? (
        <p>
          🏆 <strong>{teamName(state, playoffs.champion)}</strong> won the championship!
        </p>
      ) : (
        <p className="muted">Next round in {formatDuration(playoffs.nextRoundAtClock - state.clock)}</p>
      )}
      <div className="bracket">
        {playoffs.rounds.map((round, roundIndex) => (
          <div className="bracket-round" key={roundIndex}>
            {round.map((match) => (
              <div className="bracket-match" key={match.matchId}>
                <div className={match.winner === match.teamA ? 'winner' : undefined}>
                  {teamName(state, match.teamA)}
                  {match.scoreA != null ? ` (${match.scoreA})` : ''}
                </div>
                <div className={match.winner === match.teamB ? 'winner' : undefined}>
                  {teamName(state, match.teamB)}
                  {match.scoreB != null ? ` (${match.scoreB})` : ''}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = PlayoffBracket;
