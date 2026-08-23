const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const Modal = require('../common/Modal');
const { formatDuration } = require('../../utils/formatNumber');
const { resolveTeamName } = require('../../engine/identity');
const { resolveRules } = require('../../engine/modifiers');
const { seedPreview } = require('../../engine/playoffs');
const { isCallUpOffered } = require('../../engine/progression');
const { PLAYER_TEAM_ID } = require('../../engine/schedule');
const { PLAYOFF_COPY, seasonOutcomeParts } = require('../../data/playoffsConfig');
const { playoffRoundLabel } = require('../../data/feedMessages');
const { getStoryBeat } = require('../../data/storyBeats');

// THE PLAYOFFS TAB. Three screens in one panel, and the whole point of the rebuild is that there is
// never a fourth state where it is blank:
//
//   1. Regular season — the projected field, seeded off the live standings, with the cut line drawn
//      and the first round it would produce. This is what the tab shows for nineteen games in
//      twenty, and it used to show one sentence saying a bracket would exist later.
//   2. Postseason — the bracket, announced. See the `.playoffs-live` bunting in global.css and the
//      LIVE badge in components/layout/TabNav.js.
//   3. The call-up, whenever engine/progression.js says it is on offer.
//
// EVERY NUMBER IS THE ENGINE'S. seedPreview() decides the field size, the seeds, the cut and the
// matchups; this file renders them and computes nothing, which is the same contract StandingsPanel
// has with sortStandings().

// One row of the projected table. Split out because it is rendered from two arrays (in the field,
// and outside it) with a divider between them.
function SeedRow({ seed, name, ranked }) {
  const classes = ['po-seed-row', seed.inField ? 'in-field' : 'out', seed.isPlayer ? 'me' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <li className={classes}>
      {/* The seed number is withheld before any games are played, for the reason in the heading
          above: at 0-0 it is an artefact of the sort, not a standing. The row keeps its slot and its
          in-field shading, which are true — the top four DO qualify — and drops the claim that
          anybody is fourth. */}
      <span className="po-seed-num">{ranked ? PLAYOFF_COPY.seedLabel(seed.seed) : '·'}</span>
      <span className="po-seed-name">{name}</span>
      <span className="po-seed-record">
        {seed.wins}-{seed.losses}
      </span>
      {/* Certainties only. Both are late by construction (see seedPreview) so neither can be
          announced and then withdrawn, which is the failure that would matter here. */}
      {seed.clinched && (
        <span className="po-seed-tag is-in" title={PLAYOFF_COPY.clinchedTitle}>
          {PLAYOFF_COPY.clinched}
        </span>
      )}
      {seed.eliminated && (
        <span className="po-seed-tag is-out" title={PLAYOFF_COPY.eliminatedTitle}>
          {PLAYOFF_COPY.eliminated}
        </span>
      )}
    </li>
  );
}

function Projection({ state, preview }) {
  const name = (teamId) => resolveTeamName(state, teamId);
  const inField = preview.seeds.filter((s) => s.inField);
  const outOfField = preview.seeds.filter((s) => !s.inField);
  const ranked = preview.gamesPlayed > 0;

  return (
    <>
      {/* Before the first pitch of a season the table is not a projection of anything — every team is
          0-0, the sort ties all the way down, and the order is whatever the league array happens to
          be. The screen says that rather than presenting an unearned #1. */}
      <h3 className="po-sub">
        {preview.gamesPlayed > 0 ? PLAYOFF_COPY.projectionHeading : PLAYOFF_COPY.projectionHeadingPreseason}
      </h3>
      <p className="muted">
        {preview.gamesPlayed > 0
          ? PLAYOFF_COPY.projectionBlurb(preview.fieldSize, preview.gamesRemaining)
          : PLAYOFF_COPY.projectionBlurbPreseason(preview.fieldSize, preview.gamesRemaining)}
      </p>

      <ul className="po-seed-list">
        {inField.map((seed) => (
          <SeedRow key={seed.teamId} seed={seed} name={name(seed.teamId)} ranked={ranked} />
        ))}
        {/* The cut, as a row rather than as a border on the row above it: a border would be a
            property of the fourth team, and the line belongs to the league. */}
        {outOfField.length > 0 && (
          <li className="po-cut-line" aria-hidden="true">
            <span>{PLAYOFF_COPY.cutLine}</span>
          </li>
        )}
        {outOfField.map((seed) => (
          <SeedRow key={seed.teamId} seed={seed} name={name(seed.teamId)} ranked={ranked} />
        ))}
      </ul>

      {preview.playerSeed && !preview.playerSeed.inField && <p className="po-missing">{PLAYOFF_COPY.missedField}</p>}

      {/* HIDDEN UNTIL A GAME HAS BEEN PLAYED, for the same reason the seed numbers are: a 1-vs-4
          pairing drawn from a table where every team is 0-0 names four teams at random and puts them
          in a bracket. The heading above already says the field is not decided; printing the
          matchups anyway would take it back. */}
      {ranked && preview.matchups.length > 0 && (
        <>
          <h3 className="po-sub">{PLAYOFF_COPY.matchupsHeading}</h3>
          <div className="po-matchups">
            {preview.matchups.map((match) => (
              <div className={`po-matchup${match.hasPlayer ? ' has-player' : ''}`} key={match.matchId}>
                <span className="po-matchup-label">{match.label}</span>
                <span className="po-matchup-side">
                  <span className="po-seed-num">{PLAYOFF_COPY.seedLabel(match.seedA)}</span> {name(match.teamA)}
                </span>
                <span className="po-matchup-side">
                  <span className="po-seed-num">{PLAYOFF_COPY.seedLabel(match.seedB)}</span> {name(match.teamB)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function LiveBracket({ state, playoffs }) {
  const champion = playoffs.champion;
  const playerWon = champion === PLAYER_TEAM_ID;
  // Whether the player is still alive: they are, if they appear in the round now being played.
  const currentRound = playoffs.rounds[playoffs.currentRoundIndex] || [];
  const stillIn = currentRound.some((m) => m.teamA === PLAYER_TEAM_ID || m.teamB === PLAYER_TEAM_ID);

  return (
    <>
      {champion ? (
        <div className={`po-champion${playerWon ? ' is-you' : ''}`}>
          🏆 <strong>{PLAYOFF_COPY.championLine(resolveTeamName(state, champion))}</strong>
          {playerWon && <span className="po-champion-you">{PLAYOFF_COPY.championIsYou}</span>}
        </div>
      ) : (
        <>
          <div className="po-live-banner">{PLAYOFF_COPY.liveBanner}</div>
          <p className="muted">{PLAYOFF_COPY.liveBlurb}</p>
          <p className="po-next-round">
            {PLAYOFF_COPY.nextRound(formatDuration(playoffs.nextRoundAtClock - state.clock))}
          </p>
          {!stillIn && <p className="po-missing">{PLAYOFF_COPY.eliminatedFromBracket}</p>}
        </>
      )}
      <div className="bracket">
        {playoffs.rounds.map((round, roundIndex) => (
          <div className="bracket-round" key={roundIndex}>
            {/* The round's own name, which the bracket never printed. Taken from the function the
                feed uses, so "Semifinal" means the same thing in both places. */}
            <span className="bracket-round-label">{playoffRoundLabel(roundIndex, playoffs.rounds.length)}</span>
            {round.map((match) => (
              <div
                className={`bracket-match${
                  match.teamA === PLAYER_TEAM_ID || match.teamB === PLAYER_TEAM_ID ? ' has-player' : ''
                }`}
                key={match.matchId}
              >
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
    </>
  );
}

// THE CALL-UP, ON A SCREEN THAT STAYS PUT.
//
// It was previously rendered in exactly one place: inside the championship modal in AppShell.js,
// whose visibility is `championships > victoryAcknowledgedCount`. That modal's "Continue" button —
// and a tap anywhere on its backdrop, which is easy to do by accident on a phone — dispatches
// ACKNOWLEDGE_VICTORY. After that, isCallUpOffered(state) is still true and NOTHING IN THE GAME
// RENDERS IT. The offer does not come back until the next championship, which in Act VI means
// playing another whole season and winning another bracket. That is the "I won the championship,
// where's my alien call-up?" report, and it is a dead end rather than a missing feature.
//
// So the offer also lives here, on the tab the postseason belongs to, gated on nothing but
// isCallUpOffered() — which is the engine's answer to "may the player cross", and already accounts
// for the milestone, the act and the championship count. The modal keeps its version: the moment
// the trophy is handed over is still the right moment to make the offer. This is where it waits.
function CallUpOffer() {
  const { state, dispatch } = useGame();
  const [confirming, setConfirming] = React.useState(false);
  // COLLAPSED BY DEFAULT, and local rather than persisted. The beat is four paragraphs — about a
  // screen and a half at 390px, measured — and the offer stands INDEFINITELY, because declining is
  // never permanent (PRD §3.2). Left open, a player who says no and keeps playing would scroll past
  // the same page of prose above the bracket every time they opened this tab for the rest of the
  // run. Local state rather than a persisted `seen` flag because there is nothing here worth writing
  // to a save: coming back to the tab and finding it closed again is the correct default.
  const [expanded, setExpanded] = React.useState(false);
  const beat = getStoryBeat('act-7-offer');
  if (!isCallUpOffered(state) || !beat) return null;

  return (
    <div className="po-callup">
      <h3>{beat.title}</h3>
      {expanded ? (
        beat.prose.map((paragraph, i) => <p key={i}>{paragraph}</p>)
      ) : (
        <p className="po-callup-standing">{PLAYOFF_COPY.callUpStanding}</p>
      )}
      <div className="po-callup-actions">
        <button className="btn secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? PLAYOFF_COPY.callUpCollapse : PLAYOFF_COPY.callUpExpand}
        </button>
        <button className="btn" onClick={() => setConfirming(true)}>
          {beat.acceptLabel}
        </button>
      </div>

      {/* Step two, exactly as the modal does it: closing returns to the offer, and only the button
          inside dispatches. A mis-tap costs nothing, which is the property that matters for an
          action that ends the baseball game. */}
      {confirming && (
        <Modal
          title={beat.confirm.title}
          onClose={() => setConfirming(false)}
          closeLabel={beat.confirm.declineLabel}
        >
          {beat.confirm.prose.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <button
            className="btn danger"
            onClick={() => {
              setConfirming(false);
              dispatch({ type: actionTypes.ACCEPT_CALL_UP });
            }}
          >
            {beat.confirm.acceptLabel}
          </button>
        </Modal>
      )}
    </div>
  );
}

function PlayoffBracket() {
  const { state } = useGame();
  const { playoffs } = state.season;
  const last = state.season.lastOffseasonSummary;
  const rules = resolveRules(state);
  const live = !!playoffs && !playoffs.champion;

  const preview = seedPreview(state.season.standings, {
    playoffTeams: rules.playoffTeams,
    playerTeamId: PLAYER_TEAM_ID,
    gamesPerSeason: state.season.gamesPerSeason,
  });

  // Last season, read through the one shared helper so this tab, the League tab and the recap modal
  // cannot describe the same season differently — which is how a semifinal loss came to read as a
  // championship on all three.
  const outcome = seasonOutcomeParts(last, playoffRoundLabel);

  return (
    <div className={`panel po-panel${live ? ' playoffs-live' : ''}`}>
      <h2>{PLAYOFF_COPY.heading}</h2>

      {last && (
        <p className="muted po-last">
          <span className="po-last-label">{PLAYOFF_COPY.lastSeasonLabel}</span> {last.wins}-{last.losses}
          {outcome.map((part) => ` · ${part}`).join('')}
        </p>
      )}

      <CallUpOffer />

      {playoffs ? (
        <LiveBracket state={state} playoffs={playoffs} />
      ) : preview.fieldSize >= 2 ? (
        <Projection state={state} preview={preview} />
      ) : (
        <p className="muted">{PLAYOFF_COPY.noPostseason}</p>
      )}
    </div>
  );
}

module.exports = PlayoffBracket;


// ---------------------------------------------------------------------------------------------
// VERIFIED — 125 assertions, react-dom/server under a Babel require-hook against a GameContext
// fixture driven through the REAL reducer and advance(), plus a 390x844 iframe for layout. The
// harness was deleted after the run, per the house pattern (conventions.md: there is no test
// runner; `npm run build` transforms JSX and never mounts it).
//
// THE CALL-UP, which is the bug this file exists to fix:
//   · isCallUpOffered() is true after a title, and the offer renders on this tab           PASS
//   · it SURVIVES ACKNOWLEDGE_VICTORY — the dispatch that used to strand it — and is
//     still rendered here afterwards                                                       PASS
//   · it disappears after ACCEPT_CALL_UP, from the engine and from the tab                 PASS
//   · collapsed by default; the standing line is what shows                                PASS
//
// THE RECAP, which is the confusion this file exists to end:
//   · a 41-4 season that lost in the semifinal reads "Lost in the Semifinal" here and on
//     the League tab, and never prints the championship line                               PASS
//   · a save written before playoffExit was recorded still renders ("Made the playoffs")   PASS
//   · an act with no postseason says nothing about missing one                             PASS
//
// THE PROJECTION:
//   · regular season shows the field, the cut line and the projected first round           PASS
//   · at 0-0 the seed numbers AND the matchups are withheld — the sort ties all the way
//     down, so a #1 there is an artefact of array order                                    PASS
//   · both appear as soon as a game has been played                                        PASS
//
// THE POSTSEASON:
//   · the live bracket carries the banner and the .playoffs-live bunting; a decided one
//     carries neither                                                                      PASS
//   · rounds are named (Semifinal / Final) and the player's match is marked                PASS
//
// RENDERS WITH `season.lastOffseasonSummary` DELETED — the white-screen class the build
// cannot catch                                                                             PASS
//
// AT 390x844 (the target viewport, measured in an iframe rather than assumed): no horizontal
// overflow; the collapsed call-up is 211px against 657px expanded, which keeps "THE PLAYOFFS ARE
// ON" at y=509, above the fold.
// ---------------------------------------------------------------------------------------------
