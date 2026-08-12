const React = require('react');
const { useGame } = require('../../state/GameContext');
const { formatDuration } = require('../../utils/formatNumber');
const { resolveTeamName } = require('../../engine/identity');
const { resolveRules } = require('../../engine/modifiers');

function PlayoffBracket() {
  const { state } = useGame();
  const { playoffs } = state.season;
  const last = state.season.lastOffseasonSummary;

  if (!playoffs) {
    // Resolved, not the hardcoded 4 this used to print, for the same reason StandingsPanel
    // resolves it: Acts III–V declare `playoffTeams: 0`, and promising a postseason that the
    // act does not hold is a lie about its own win condition.
    const playoffTeams = resolveRules(state).playoffTeams;
    return (
      <div className="panel">
        <h2>Playoffs</h2>
        <p className="muted">
          {playoffTeams >= 2
            ? `No playoff bracket right now — the top ${playoffTeams} teams qualify at the end of the regular season.`
            : 'No postseason in this league — finishing first at the end of the regular season takes the title.'}
          {last && (
            <>
              {/* Positive-only, and never "missed the playoffs": last season was played under
                  whatever act was active then, so the only act-correct account of it is the one
                  the summary carries. `finishedFirst` is the title in a no-postseason league. */}
              {' '}
              Last season: {last.wins}-{last.losses}
              {last.madePlayoffs ? ' · Made the playoffs' : ''}
              {last.finishedFirst ? ' · 🥇 First place!' : ''}
              {last.wonChampionship ? ' · 🏆 Champions!' : ''}
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
          🏆 <strong>{resolveTeamName(state, playoffs.champion)}</strong> won the championship!
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
                  {resolveTeamName(state, match.teamA)}
                  {match.scoreA != null ? ` (${match.scoreA})` : ''}
                </div>
                <div className={match.winner === match.teamB ? 'winner' : undefined}>
                  {resolveTeamName(state, match.teamB)}
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
