// Copy for the Playoffs tab. Player-facing prose lives in data/ and never in a component (house
// rule — data/feedMessages.js, data/toastMessages.js, data/storyBeats.js).
//
// WHY THIS FILE EXISTS AT ALL. The Playoffs tab used to be one sentence — "No playoff bracket right
// now" — and that sentence was the whole screen for roughly nineteen games out of every twenty. A
// tab is a promise that there is something behind it, and this one was empty most of the time and
// then, on the two or three occasions a year it was not, changed into the most consequential screen
// in the game with no announcement. Everything here is in service of those two problems: the
// projection gives the tab a job during the regular season, and the postseason copy gives the
// bracket the entrance it never had.
//
// NO NUMBERS LIVE HERE. The field size, the seeds, the clinch arithmetic and the matchups are all
// engine/playoffs.js's (seedPreview), and the durations are the act's. This is wording only.

const PLAYOFF_COPY = {
  heading: 'Playoffs',

  // ---------------------------------------------------------------------------------------------
  // The regular season — the projection
  // ---------------------------------------------------------------------------------------------
  // "Projected", said out loud and repeatedly, because the table is drawn from a season in progress
  // and the one thing it must never do is read as a result. `games` is the player's own remaining
  // fixture count, which is what makes the sentence a countdown rather than a status.
  projectionHeading: 'If the season ended today',
  // BEFORE A BALL IS THROWN there is no "if" to answer: every team is 0-0, so the table is the order
  // the league was built in and the seeds on it mean nothing yet. Saying so is the difference
  // between a projection and a claim. See seedPreview()'s note on gamesPlayed.
  projectionHeadingPreseason: 'The field, before anybody has played',
  projectionBlurbPreseason: (fieldSize, games) =>
    `The top ${fieldSize} will qualify. Nobody has played yet — these are the ${games} games that decide it.`,
  projectionBlurb: (fieldSize, games) =>
    games > 0
      ? `The top ${fieldSize} qualify. ${games} game${games === 1 ? '' : 's'} left to sort it out.`
      : `The top ${fieldSize} qualify. The regular season is done.`,

  // The cut line, drawn as a row of its own between the last team in and the first team out. It is
  // the only thing on the table that is not a team, so it says what it is.
  cutLine: 'cut line',

  // The two certainties. Short — they are chips on a table row, not sentences — and deliberately
  // not "MAGIC NUMBER 3" or any other piece of standings vocabulary a nine-year-old's parent would
  // have to look up. See seedPreview()'s note on why these are announced late rather than early.
  clinched: 'IN',
  eliminated: 'OUT',
  clinchedTitle: 'Cannot fall out of the field, whatever happens in the games that are left',
  eliminatedTitle: 'Cannot reach the field any more, even by winning out',

  // The projected first-round pairings, by the same 1-vs-n draw the real bracket uses.
  matchupsHeading: 'Projected first round',
  matchupLabel: (n) => `Game ${n}`,
  // What a seed looks like beside a team name. A `#` reads as a rank in a way "4th" does not once
  // it is sitting in a two-line matchup card.
  seedLabel: (seed) => `#${seed}`,

  // The act that has no postseason at all (Acts III–V declare `playoffTeams: 0`). The tab is not
  // even shown in those acts today, but the panel must still answer for the state rather than draw
  // an empty table, because `playoffTeams` is act- and era-overridable and a tab that renders
  // nothing is indistinguishable from a broken one.
  noPostseason: 'No postseason in this league — finishing first at the end of the regular season takes the title.',
  missedField: 'Not in the field as things stand. The table above is what has to change.',

  // ---------------------------------------------------------------------------------------------
  // The postseason — the fanfare
  // ---------------------------------------------------------------------------------------------
  // The complaint: "there's no fanfare currently". The bracket used to appear in place of the
  // projection with nothing to mark the change — same panel, same heading, different contents. It
  // now announces itself: a banner, a live tab badge, and the bunting border in global.css.
  liveBanner: 'THE PLAYOFFS ARE ON',
  liveBlurb: 'Everything the regular season was for. Win three and nobody can take it back.',
  // The tab badge. Four letters, because the tab bar already wraps to three rows on a phone.
  liveTabBadge: 'LIVE',
  nextRound: (duration) => `Next round in ${duration}`,
  championLine: (teamName) => `${teamName} won the championship!`,
  // The player's own title, which is a different sentence from somebody else's.
  championIsYou: 'You won the whole thing.',
  eliminatedFromBracket: 'Your run is over. The bracket plays itself out below.',

  // ---------------------------------------------------------------------------------------------
  // The standing call-up
  // ---------------------------------------------------------------------------------------------
  // The offer's own words are data/storyBeats.js's `act-7-offer` and are not restated here. What is
  // here is the one line that stands in for them while the block is COLLAPSED, which is how it sits
  // on this tab by default.
  //
  // WHY COLLAPSED. The beat is four paragraphs, and measured at 390px it is roughly a screen and a
  // half — every time the tab is opened, above the bracket, for as long as the offer stands. And it
  // stands indefinitely: declining is never permanent (PRD §3.2), so a player who says no and keeps
  // playing would be scrolling past the same page of prose every postseason. Collapsed, the tab
  // says he is still there and gets out of the way; the prose is one tap behind a control, and the
  // confirmation step still carries the one-way warning in full.
  callUpStanding: 'He is still at the fence, and the folder is still under his arm.',
  callUpExpand: 'Read what he said',
  callUpCollapse: 'Leave it for now',

  // ---------------------------------------------------------------------------------------------
  // Last season
  // ---------------------------------------------------------------------------------------------
  // WHY THE EXIT ROUND IS NAMED. The recap line used to read "41-4 · Made the playoffs · 🥇 First
  // place!" for a team that lost in the semifinal, and a player reported that as having won the
  // championship — reasonably, because nothing on the screen said otherwise. Topping the table and
  // winning the bracket are different achievements in an act that has both, and the recap has to
  // distinguish them or the game is lying to a player about their own season.
  lastSeasonLabel: 'Last season',
  wonIt: '🏆 Champions!',
  finishedFirst: '🥇 First place in the regular season',
  lostInRound: (roundLabel) => `Lost in the ${roundLabel}`,
  madeThePlayoffs: 'Made the playoffs',
  missedThePlayoffs: 'Missed the playoffs',
};

// THE ONE READING OF A SEASON RECAP, used by all three screens that print one — the recap modal
// (components/layout/AppShell.js), the League tab's last-season line and the Playoffs tab. They each
// had their own copy of this ternary chain, which is how they came to disagree: the modal, the
// League tab and the Playoffs tab all said "Made the playoffs · 🥇 First place!" about a season that
// ended with a semifinal loss, because none of them looked at the bracket.
//
// POSITIVE-ONLY, AND THAT RULE SURVIVES. Last season was played under whatever act was active then,
// and this is read in a later one, so it must not narrate the old season under the new act's rules —
// "Missed the playoffs" is never printed, because an act with no postseason cannot miss one. The
// summary's own flags are the only act-correct source. The exit round is the newest of those flags
// and it comes from the bracket itself, so naming it is act-correct by construction.
//
// `roundLabel` is passed in rather than imported: data/feedMessages.js already owns
// playoffRoundLabel() and names the same round for the feed, and two files naming rounds differently
// is exactly the disagreement this function exists to end. Callers hand it that function.
function seasonOutcomeParts(summary, roundLabel) {
  if (!summary) return [];
  const parts = [];
  const exit = summary.playoffExit;

  if (summary.wonChampionship) {
    if (summary.finishedFirst) parts.push(PLAYOFF_COPY.finishedFirst);
    parts.push(PLAYOFF_COPY.wonIt);
    return parts;
  }

  if (summary.finishedFirst) parts.push(PLAYOFF_COPY.finishedFirst);

  // The bracket, when there was one. A save written before the exit was recorded still says it made
  // the playoffs and simply cannot say what happened in them — which is the honest thing to print
  // for a season nothing knows the shape of any more.
  if (exit && typeof roundLabel === 'function') {
    parts.push(PLAYOFF_COPY.lostInRound(roundLabel(exit.roundIndex, exit.totalRounds)));
  } else if (summary.madePlayoffs) {
    parts.push(PLAYOFF_COPY.madeThePlayoffs);
  }

  return parts;
}

module.exports = { PLAYOFF_COPY, seasonOutcomeParts };
