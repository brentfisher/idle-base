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

module.exports = { applyGameResult, winPct, sortStandings };
