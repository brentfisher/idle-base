function applyGameResult(standings, teamId, won, runsFor, runsAgainst) {
  return standings.map((row) => {
    if (row.teamId !== teamId) return row;
    return {
      ...row,
      wins: row.wins + (won ? 1 : 0),
      losses: row.losses + (won ? 0 : 1),
      runsFor: row.runsFor + runsFor,
      runsAgainst: row.runsAgainst + runsAgainst,
    };
  });
}

function winPct(row) {
  const games = row.wins + row.losses;
  return games === 0 ? 0 : row.wins / games;
}

function sortStandings(standings) {
  return [...standings].sort((a, b) => {
    const pctDiff = winPct(b) - winPct(a);
    if (pctDiff !== 0) return pctDiff;
    return b.runsFor - b.runsAgainst - (a.runsFor - a.runsAgainst);
  });
}

// Whether the season that just ended finished with the player on top of the table.
//
// READ FROM THE RECAP, NOT FROM THE STANDINGS, and that is the whole reason this is a function
// rather than a call to sortStandings(). engine/tickEngine.js's runOffseasonTransition() computes
// `finishedFirst` and then RESETS the standings three lines later, so by the time an exit predicate
// or a feed line runs, the evidence is gone. The recap is what survives.
//
// ONE READER FOR TWO ACTS. Act III's title and Act V's pennant are the same fact about two
// different leagues — both declare `playoffTeams: 0`, so topping the table IS the trophy — and the
// two used to be one function in engine/littleLeague.js and one that did not exist at all. Act V's
// exit was unsatisfiable for exactly that reason: `minorsPennantWon` was named in data/acts.js and
// nothing anywhere in src/ ever wrote or evaluated it, so isExitSatisfied() fell through to a
// milestone that had no writer and the act could not be left. See engine/progression.js.
function finishedFirstLastSeason(state) {
  const summary = state && state.season && state.season.lastOffseasonSummary;
  return !!(summary && summary.finishedFirst);
}

module.exports = { applyGameResult, winPct, sortStandings, finishedFirstLastSeason };
