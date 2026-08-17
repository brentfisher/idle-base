const React = require('react');
const { useGame } = require('../../state/GameContext');
// `winPct` moved with the six columns into StandingsTable — the percentage is a property of the
// table, not of this panel, and the file that sorts by it is now the file that prints it.
const { sortStandings } = require('../../engine/standings');
const { PLAYER_TEAM_ID } = require('../../engine/schedule');
const { resolveRules } = require('../../engine/modifiers');
const { resolveTeamName } = require('../../engine/identity');
const SeasonSchedulePanel = require('./SeasonSchedulePanel');
const TeamNameEditor = require('./TeamNameEditor');
// The six columns, extracted by STORY-032 so Act VII's ending renders the SAME table rather than a
// second one that resembles it (PRD §7.8). It takes resolved rows and decides nothing, so the two
// lookups below — the display name and which row is the player's — stay here, in the file that
// knows what a team is. See the long note at its definition.
const StandingsTable = require('./StandingsTable');

// Last season's result, in one line. Deliberately POSITIVE-ONLY — it prints what happened and
// says nothing when nothing did.
//
// It does NOT consult resolveRules(state).playoffTeams the way the current-standings line below
// does, and the difference matters: that line describes the league as it is right now, whereas
// this one describes a season played under whatever act was active THEN. A player who finished
// Act III and moved on would otherwise have last season re-narrated under the new act's rules.
// The summary's own flags are the only act-correct source, and they already encode the care —
// `finishedFirst` is set at engine/tickEngine.js:298 precisely because topping the table IS the
// title in a league with no postseason. Same phrasing as the recap modal in layout/AppShell.js,
// so the League tab and the modal never disagree about what a season was.
function LastSeason({ summary }) {
  if (!summary) return null;
  return (
    <p className="last-season">
      <span className="last-season-label">Last season</span>
      <span className="last-season-body">
        Season {summary.seasonNumber}: {summary.wins}-{summary.losses}
        {summary.madePlayoffs ? ' · Made the playoffs' : ''}
        {summary.finishedFirst ? ' · 🥇 First place!' : ''}
        {summary.wonChampionship ? ' · 🏆 Champions!' : ''}
      </span>
    </p>
  );
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
      {/* Between the heading and the season line rather than inside the player's standings row:
          a text input in a <td> at 390px fights the table's own overflow-x scroller and is the
          easiest way to hand a phone a horizontal scrollbar. Here it is the first thing under
          the heading — discoverable — while still reading as a caption rather than a shop. */}
      <TeamNameEditor />
      <LastSeason summary={state.season.lastOffseasonSummary} />
      <p className="muted">
        Season {state.season.seasonNumber} · Game {Math.min(state.season.scheduleIndex, state.season.gamesPerSeason)}
        /{state.season.gamesPerSeason} ·{' '}
        {playoffTeams >= 2 ? `Top ${playoffTeams} make the playoffs` : 'First place takes the title'}
      </p>
      {/* The league's rows, translated into the shared table's vocabulary: a display `id` and a
          resolved `name`. Both lookups stay on this side because both are facts about a baseball
          league — `teamId` is engine/schedule.js's identifier and resolveTeamName() is the player's
          own naming — and the table renders farm systems that are not teams at all. */}
      <StandingsTable
        rows={sorted.map((row) => ({
          id: row.teamId,
          name: resolveTeamName(state, row.teamId),
          wins: row.wins,
          losses: row.losses,
          runsFor: row.runsFor,
          runsAgainst: row.runsAgainst,
        }))}
        highlightId={PLAYER_TEAM_ID}
      />
      <SeasonSchedulePanel />
    </div>
  );
}

module.exports = StandingsPanel;
