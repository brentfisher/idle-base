const { simulateGame } = require('./gameSim');

// seededTeamIds: ordered best-to-worst by standings, length must be a power of 2.
function generateBracket(seededTeamIds) {
  const n = seededTeamIds.length;
  const round1 = [];
  for (let i = 0; i < n / 2; i += 1) {
    round1.push({
      matchId: `r0_m${i}`,
      teamA: seededTeamIds[i],
      teamB: seededTeamIds[n - 1 - i],
      winner: null,
      scoreA: null,
      scoreB: null,
    });
  }

  const totalRounds = Math.log2(n);
  const rounds = [round1];
  let prevCount = round1.length;
  for (let r = 1; r < totalRounds; r += 1) {
    const roundMatches = [];
    for (let i = 0; i < prevCount / 2; i += 1) {
      roundMatches.push({ matchId: `r${r}_m${i}`, teamA: null, teamB: null, winner: null, scoreA: null, scoreB: null });
    }
    rounds.push(roundMatches);
    prevCount /= 2;
  }

  return { rounds, currentRoundIndex: 0, champion: null };
}

// Resolves every playable match in the current round, advances winners into the next
// round's slots (or sets champion if this was the final).
function resolveCurrentRound(bracket, getStrength) {
  const round = bracket.rounds[bracket.currentRoundIndex];
  const resolvedRound = round.map((match) => {
    if (match.winner || !match.teamA || !match.teamB) return match;
    const result = simulateGame(getStrength(match.teamA), getStrength(match.teamB));
    return {
      ...match,
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      winner: result.aWins ? match.teamA : match.teamB,
    };
  });

  const rounds = bracket.rounds.map((r, i) => (i === bracket.currentRoundIndex ? resolvedRound : r));
  const isLastRound = bracket.currentRoundIndex === rounds.length - 1;

  if (isLastRound) {
    return { rounds, currentRoundIndex: bracket.currentRoundIndex, champion: resolvedRound[0].winner };
  }

  const nextRoundIndex = bracket.currentRoundIndex + 1;
  const winners = resolvedRound.map((m) => m.winner);
  rounds[nextRoundIndex] = rounds[nextRoundIndex].map((match, i) => ({
    ...match,
    teamA: winners[i * 2],
    teamB: winners[i * 2 + 1],
  }));

  return { rounds, currentRoundIndex: nextRoundIndex, champion: null };
}

module.exports = { generateBracket, resolveCurrentRound };
