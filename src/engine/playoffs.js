const { simulateGame } = require('./gameSim');
const { sortStandings } = require('./standings');
const { PLAYOFF_COPY } = require('../data/playoffsConfig');

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

// ---------------------------------------------------------------------------------------------
// THE PROJECTION — what the Playoffs tab shows for the 95% of a season when there is no bracket
// ---------------------------------------------------------------------------------------------
// The reported problem: "the playoffs screen should show seeds based upon how the teams are
// performing in the regular season, the tab is empty most of the time". It was literally empty —
// one sentence saying a bracket would exist later — and it is a TAB, which is a promise that there
// is something behind it. A postseason field is knowable from the standings on any day of the
// season; there was never a reason to withhold it.
//
// THE FIELD SIZE IS playoffFieldSize() AND NOT `playoffTeams`, and that is load-bearing rather than
// pedantic. generateBracket() needs a power-of-2 field, so a league declaring 6 qualifiers actually
// sends 4 — and a preview that drew the top 6 would promise two teams a berth the bracket will not
// give them. The two must be the same function, so the function moved here, next to the bracket it
// constrains, and engine/tickEngine.js imports it rather than owning it.
//
// PURE, AND IT TAKES ROWS RATHER THAN STATE. Same contract components/league/StandingsTable.js has:
// the caller resolves names, this decides seeds and the cut. That keeps it drivable under `node`
// with a literal array, which is how the numbers below were checked.
function playoffFieldSize(declared, availableTeams) {
  const n = Math.min(declared || 0, availableTeams);
  if (n < 2) return 0;
  return 2 ** Math.floor(Math.log2(n));
}

// How many games each team has left. Every team plays the same number of fixtures in a season, so
// this is `gamesPerSeason - played` — and a team that has played more than the schedule says (which
// cannot happen, but a corrupt save is not required to be sensible) reads as zero rather than as a
// negative that would make the clinch arithmetic below hand out berths.
function gamesRemainingFor(row, gamesPerSeason) {
  const played = (row.wins || 0) + (row.losses || 0);
  return Math.max(0, (gamesPerSeason || 0) - played);
}

// The projected field, seeded, with the cut line placed and each side of it explained.
//
// CLINCHED / ELIMINATED ARE COMPUTED, NOT GUESSED, and they are the two facts that make this screen
// worth opening in July rather than in September. A team is IN for certain when even losing every
// remaining game leaves it above the best the first team outside the cut could possibly finish; it
// is OUT for certain when winning every remaining game still cannot catch the worst the last team
// inside the cut could finish. Both are stated in WINS, which is what the table sorts on first.
//
// The comparison is deliberately made against the CURRENT occupants of the two boundary slots and
// not against every permutation of the remaining schedule. That is a real approximation and it errs
// on the side of silence: a season can be mathematically decided a game or two before this says so,
// and it will never announce a clinch that a later result takes away. Announcing and retracting is
// the failure that matters — the other direction is a screen that is merely a little cautious.
function seedPreview(standings, { playoffTeams, playerTeamId, gamesPerSeason } = {}) {
  const rows = sortStandings(standings || []);
  const fieldSize = playoffFieldSize(playoffTeams, rows.length);

  // The two boundary rows: the last team currently in, and the first team currently out. Either can
  // be absent — a league smaller than its own field, or a field of zero — and every use below is
  // guarded, because "no postseason in this act" is a state this function has to answer for.
  const lastIn = fieldSize > 0 ? rows[fieldSize - 1] : null;
  const firstOut = rows.length > fieldSize ? rows[fieldSize] : null;

  const seeds = rows.map((row, index) => {
    const remaining = gamesRemainingFor(row, gamesPerSeason);
    const inField = fieldSize > 0 && index < fieldSize;

    // Ceiling and floor for this team, and for whichever boundary row decides its fate.
    const floor = row.wins;
    const ceiling = row.wins + remaining;
    const rivalCeiling = firstOut ? firstOut.wins + gamesRemainingFor(firstOut, gamesPerSeason) : -Infinity;
    const rivalFloor = lastIn ? lastIn.wins : Infinity;

    return {
      teamId: row.teamId,
      seed: index + 1,
      wins: row.wins,
      losses: row.losses,
      runDiff: (row.runsFor || 0) - (row.runsAgainst || 0),
      gamesRemaining: remaining,
      isPlayer: row.teamId === playerTeamId,
      inField,
      // A one-team field is not a postseason, so nothing clinches or is eliminated in an act that
      // declares `playoffTeams: 0` — the whole projection collapses to a plain table there.
      clinched: inField && fieldSize > 0 && floor >= rivalCeiling,
      eliminated: !inField && fieldSize > 0 && ceiling < rivalFloor,
    };
  });

  // The first-round matchups the bracket WOULD build from this field today, drawn by the same
  // 1-vs-n, 2-vs-(n-1) pairing generateBracket() uses at the top of this file. Restating the
  // pairing here would be a second opinion about what a bracket is; instead the projection asks
  // generateBracket() itself, with the projected field, and reads the first round back out.
  const field = seeds.filter((s) => s.inField).map((s) => s.teamId);
  const matchups =
    field.length >= 2
      ? generateBracket(field).rounds[0].map((match, i) => ({
          matchId: match.matchId,
          label: PLAYOFF_COPY.matchupLabel(i + 1),
          teamA: match.teamA,
          teamB: match.teamB,
          seedA: seeds.find((s) => s.teamId === match.teamA).seed,
          seedB: seeds.find((s) => s.teamId === match.teamB).seed,
          // Whether the player is in this pairing at all, so the component can mark it without
          // knowing which team id is theirs.
          hasPlayer: match.teamA === playerTeamId || match.teamB === playerTeamId,
        }))
      : [];

  const playerSeed = seeds.find((s) => s.isPlayer) || null;

  // HOW MANY GAMES THE SEASON HAS ACTUALLY PRODUCED, which the panel needs in order not to assert a
  // seed nobody earned. At 0-0 every row ties on win percentage AND on run differential, so
  // sortStandings() falls through to array order and the player is #1 by construction rather than by
  // performance — on a screen whose entire job is to report performance. The panel says so in that
  // one case instead of pretending. Read off the player's own row: every team plays the same number
  // of fixtures, so one row answers for the league.
  const gamesPlayed = playerSeed ? playerSeed.wins + playerSeed.losses : 0;

  return {
    fieldSize,
    seeds,
    matchups,
    playerSeed,
    gamesPlayed,
    // Games left in the player's own season — the number the header line counts down.
    gamesRemaining: playerSeed ? playerSeed.gamesRemaining : 0,
  };
}

module.exports = { generateBracket, resolveCurrentRound, playoffFieldSize, seedPreview };
