const React = require('react');
const { useGame } = require('../../state/GameContext');
const { recordsCopy } = require('../../data/recordsPanelConfig');
const { ACHIEVEMENTS } = require('../../data/achievementsConfig');
const { PAR } = require('../../data/scoreConfig');
const { runScore, ACT_INDICES } = require('../../engine/score');
const { recordSlice, achievementsSlice, runCard } = require('../../engine/records');
const actionTypes = require('../../state/actionTypes');
const { loadRecords, saveProfile, markRunAsked } = require('../../persistence/recordsStore');
const { endRunAndClearSave } = require('../../persistence/runEnd');
const { isConfigured, identifyPlayer, submitRun, fetchEntries } = require('../../persistence/leaderboardClient');
const { leaderboardCopy, MAX_NAME_LENGTH } = require('../../data/leaderboardConfig');
const { generateId } = require('../../utils/randomUtils');
const { getActConfig } = require('../../data/acts');
const { formatDuration, formatNumber } = require('../../utils/formatNumber');

// The record card, on screen. Three blocks: the run in progress, the achievements kept across every
// run, and the runs that have finished.
//
// IT COMPUTES NO SCORE. `runScore()` is read, never re-implemented, and `PAR` is read, never
// restated — PRD §3.3 makes the score derived precisely so that one function answers for it, and a
// component doing its own arithmetic is a second answer that will disagree the first time
// data/scoreConfig.js is retuned. The only decision in this file is which blocks to render.
//
// TWO SOURCES, AND THEY MEAN DIFFERENT THINGS. The run in progress comes from game state; the
// finished runs and the achievement collection come from persistence/recordsStore.js, a second
// localStorage key that survives clearing the save. That is the split PRD §3.2 exists to make, and
// it is why this screen reads both rather than deriving either from the other.
//
// REACHABLE FROM ACT III, NOT ACT I, AND THAT IS NOT A BUG IN THE GATING. `records` is unlocked at
// Act I (data/acts.js) and getUnlockedFeatures() reports it there — but AppShell early-returns a
// pre-season shell for Acts I-II, which renders "the lot, and nothing else" by design (odyssey
// Decision 2), tab bar included. So the tab appears when the tab bar does. Measured in the browser
// after a reset, not assumed. Nothing here tries to fight that: Act I being one button on one
// screen is the act's whole point, and there is no record to read before the first act ends anyway.
//
// THE CAREER SET IS NOT THE RUN'S SET, and the screen has to make that visible or the numbers look
// broken: the achievements block never resets, while the score beside it counts only what THIS run
// earned (PRD §6). A player who has collected everything and starts a fresh run should see a full
// collection and a score of nearly zero, and should be told why in one line rather than left to
// work it out.

// Career records are read once on mount and again whenever a run ends — `endedAtClock` is stamped
// exactly once per run (engine/records.js), so it is the only signal that the store has changed.
// Reading localStorage during render would be a side effect in a pure function; this is the hook
// boundary the rest of the app keeps.
// `asked` is bumped by the post prompt when it finishes, because the prompt writes to the same
// store this reads — without it the panel would keep offering a run the player has just answered
// for until the next reload.
function useCareerRecords(endedAtClock, asked) {
  const [records, setRecords] = React.useState(() => loadRecords());
  React.useEffect(() => {
    setRecords(loadRecords());
  }, [endedAtClock, asked]);
  return records;
}

// One act's row. Four states, and the difference between the middle two is the whole reason
// data/recordsPanelConfig.js has three separate strings for them:
//   * timed        — a duration, its points, and how it sat against par.
//   * IN PROGRESS  — the act being played right now. It has no split yet and is not a failure.
//   * NOT RECORDED — played before the game kept time (PRD §4). Never `0s`, which would read as
//                    the best possible run.
//   * not played   — still ahead of the player.
function SplitRow({ actIndex, seconds, points, status }) {
  const par = PAR[actIndex];
  const act = getActConfig(actIndex);
  return (
    <div className={'rec-split rec-split-' + status}>
      <span className="rec-split-act">{act ? act.shortLabel : 'Act ' + (actIndex + 1)}</span>
      <span className="rec-split-time">
        {status === 'timed' ? formatDuration(seconds) : null}
        {status === 'unrecorded' ? recordsCopy.notRecorded : null}
        {status === 'current' ? recordsCopy.inProgress : null}
        {status === 'future' ? recordsCopy.notPlayed : null}
      </span>
      <span className="rec-split-par">{par > 0 ? recordsCopy.parLabel(par) : null}</span>
      <span className="rec-split-points">
        {status === 'timed' ? recordsCopy.pointsLabel(points) : null}
      </span>
    </div>
  );
}

function CurrentRun({ state }) {
  const record = recordSlice(state);
  const card = runCard(state);
  const score = runScore(card);
  const currentAct = (state.progression || {}).act;

  return (
    <section className="rec-block">
      <div className="rec-score">
        <span className="rec-score-label">{recordsCopy.scoreLabel}</span>
        <span className="rec-score-value">{formatNumber(score.total)}</span>
      </div>
      <p className="muted rec-note">{recordsCopy.scoreNote}</p>

      <h3 className="rec-heading">{recordsCopy.splitsHeading}</h3>
      <div className="rec-splits">
        {ACT_INDICES.map((actIndex) => {
          const seconds = record.actSeconds[actIndex];
          let status = 'future';
          if (score.actPoints[actIndex] !== undefined) status = 'timed';
          else if (score.unrecordedActs.indexOf(actIndex) !== -1) status = 'unrecorded';
          else if (actIndex === currentAct) status = 'current';
          return (
            <SplitRow
              key={actIndex}
              actIndex={actIndex}
              seconds={seconds}
              points={score.actPoints[actIndex]}
              status={status}
            />
          );
        })}
      </div>
    </section>
  );
}

function Achievements({ earnedIds }) {
  return (
    <section className="rec-block">
      <h3 className="rec-heading">{recordsCopy.achievementsHeading}</h3>
      <p className="muted rec-note">{recordsCopy.achievementsNote}</p>
      <div className="rec-achievements">
        {ACHIEVEMENTS.map((achievement) => {
          const earned = earnedIds.indexOf(achievement.id) !== -1;
          return (
            <div key={achievement.id} className={'rec-ach' + (earned ? ' is-earned' : '')}>
              <span className="rec-ach-name">{achievement.name}</span>
              <span className="rec-ach-desc">{achievement.description}</span>
              <span className="rec-ach-points">
                {earned ? recordsCopy.achievementPoints(achievement.points) : recordsCopy.achievementLocked}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Finished runs, best score first — and PARTIAL RUNS ARE NOT RANKED AGAINST COMPLETE ONES. A card
// with unrecorded acts scores lower for a reason that has nothing to do with how it was played
// (PRD §4), so sorting it into the same column would quietly punish the player for having started
// before the game kept time. They are listed under the ranked ones, badged, with the reason said
// once rather than as an asterisk on every row.
function FinishedRuns({ runs }) {
  const scored = runs
    .map((run) => ({ run, score: runScore(run) }))
    .sort((a, b) => b.score.total - a.score.total);
  const ranked = scored.filter((entry) => !entry.score.partial);
  const unranked = scored.filter((entry) => entry.score.partial);

  return (
    <section className="rec-block">
      <h3 className="rec-heading">{recordsCopy.runsHeading}</h3>
      {scored.length === 0 ? (
        <p className="muted rec-note">{recordsCopy.runsEmpty}</p>
      ) : (
        <p className="muted rec-note">{recordsCopy.runsNote}</p>
      )}
      <div className="rec-runs">
        {ranked.concat(unranked).map((entry, index) => (
          <div key={entry.run.runId || index} className="rec-run">
            <span className="rec-run-score">{formatNumber(entry.score.total)}</span>
            <span className="rec-run-meta">
              {recordsCopy.runTotalLabel(entry.run.totalSeconds || 0)}
              {entry.run.endedAtTimestamp
                ? ' · ' + new Date(entry.run.endedAtTimestamp).toLocaleDateString()
                : ''}
            </span>
            <span className="rec-run-badges">
              {entry.score.partial ? <span className="rec-badge">{recordsCopy.partialBadge}</span> : null}
              {entry.run.complete ? null : <span className="rec-badge">{recordsCopy.incompleteBadge}</span>}
            </span>
          </div>
        ))}
      </div>
      {unranked.length > 0 ? <p className="muted rec-note">{recordsCopy.partialNote}</p> : null}
    </section>
  );
}

// THE SHARED WALL. Fetched when the tab opens and NEVER on a timer: hooks/useGameTick.js is the
// only timer in this repo and it stays that way, and a board that polled would keep a third-party
// request in flight for as long as the tab was open.
//
// NEVER LOAD-BEARING (PRD §7.2). A pending fetch renders the two local blocks and a quiet line; a
// failed one renders the two local blocks and a quieter one. No spinner across the screen, no error
// modal, no retry loop. Everything above this block on the page works with the network unplugged,
// because all of it comes from the machine the player is sitting at.
function SharedBoard() {
  const [state, setState] = React.useState({ status: isConfigured() ? 'loading' : 'off', entries: [] });

  React.useEffect(() => {
    if (!isConfigured()) return undefined;
    let live = true;
    fetchEntries().then((result) => {
      if (!live) return;
      setState(result.ok
        ? { status: 'ready', entries: result.entries }
        : { status: 'failed', entries: [] });
    });
    // Abandoned rather than cancelled if the tab closes mid-flight: the client already aborts on
    // its own timeout, and this guard only stops a setState after unmount.
    return () => { live = false; };
  }, []);

  return (
    <section className="rec-block">
      <h3 className="rec-heading">{leaderboardCopy.boardHeading}</h3>
      {/* Said on the screen, not buried in a tooltip. Every client-side leaderboard puts a writable
          key in the bundle, ours included, so these scores are posted rather than verified — and a
          board that implied otherwise would be lying to the people reading it (PRD §3.1). */}
      <p className="muted rec-note">{leaderboardCopy.unverifiedNote}</p>
      {state.status === 'off' ? <p className="muted rec-note">{leaderboardCopy.notConfigured}</p> : null}
      {state.status === 'loading' ? <p className="muted rec-note">{leaderboardCopy.pending}</p> : null}
      {state.status === 'failed' ? <p className="muted rec-note">{leaderboardCopy.failed}</p> : null}
      {state.status === 'ready' && state.entries.length === 0
        ? <p className="muted rec-note">{leaderboardCopy.empty}</p> : null}
      <div className="rec-runs">
        {state.entries.map((entry, index) => (
          <div key={entry.id || index} className="rec-run">
            <span className="rec-run-score">{formatNumber(entry.score || 0)}</span>
            <span className="rec-run-meta">{entryName(entry)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// The name a board entry was posted under. Read off the entry's props rather than off the alias,
// because the props are what the submission actually carried and the alias shape is the vendor's.
function entryName(entry) {
  const props = (entry && entry.props) || [];
  const named = Array.isArray(props) ? props.find((p) => p && p.key === 'name') : null;
  if (named && named.value) return named.value;
  const alias = entry && entry.playerAlias;
  return (alias && (alias.displayName || alias.identifier)) || 'anonymous';
}

// THE POST PROMPT, and the only new interruption in the whole design.
//
// IT ASKS AFTER THE RECORD IS ALREADY SAFE. The card is sealed by the tick and promoted by
// hooks/useGameTick.js before this ever renders (STORY-044), so closing the tab at the prompt loses
// the POST and never the RUN. That ordering is the reason the prompt can be this casual about being
// declined.
//
// ONCE PER RUN. `postedRunIds` records that the question was asked — posted or declined, it does
// not distinguish — and it lives in the records key, so declining survives a reload. Re-asking
// somebody who said no is nagging, and this is a request to send data to a third party.
//
// NOTHING BLOCKS. Accepting fires two requests and swaps a line of copy; declining swaps a line of
// copy. Neither disables the page, and both leave every other block exactly as it was.
function PostPrompt({ card, profile, score, onDone }) {
  const [name, setName] = React.useState(profile.displayName || '');
  const [status, setStatus] = React.useState('asking');

  function post() {
    setStatus('posting');
    const trimmed = name.slice(0, MAX_NAME_LENGTH);
    // The uuid is minted once per machine and reused forever: it is what makes a returning player
    // update their own row instead of minting a second identity (PRD §3.1). The typed name is
    // mutable and collides; this is not.
    const playerUuid = profile.playerUuid || generateId('player');
    saveProfile({ displayName: trimmed, playerUuid });
    identifyPlayer(playerUuid)
      .then((identified) => {
        if (!identified.ok) return { ok: false };
        saveProfile({ aliasId: identified.aliasId });
        return submitRun(card, identified.aliasId, trimmed, score);
      })
      .then((result) => {
        markRunAsked(card.runId);
        setStatus(result.ok ? 'posted' : 'failed');
        // THE OUTCOME IS HANDED UP RATHER THAN RENDERED HERE. Marking the run asked is what makes
        // this component's own `pending` prop go away, so it unmounts on the same pass — a
        // confirmation rendered from its own state would flash and vanish, and a player who pressed
        // a button would be told nothing at all. The panel owns the line that outlives the prompt.
        onDone(result.ok ? 'posted' : 'failed');
      });
  }

  function decline() {
    markRunAsked(card.runId);
    setStatus('declined');
    // Declining says nothing back. The player asked for the block to go away; the block goes away.
    onDone('declined');
  }

  return (
    <section className="rec-block rec-prompt">
      <h3 className="rec-heading">{leaderboardCopy.promptHeading}</h3>
      <p className="muted rec-note">{leaderboardCopy.promptBody}</p>
      <label className="rec-name-label" htmlFor="rec-name">{leaderboardCopy.nameLabel}</label>
      <input
        id="rec-name"
        className="rec-name-input"
        type="text"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={leaderboardCopy.namePlaceholder}
        onChange={(e) => setName(e.target.value)}
        disabled={status === 'posting'}
      />
      <p className="muted rec-note">{leaderboardCopy.nameNote}</p>
      <div className="rec-prompt-actions">
        {/* `btn` is the base class every button in this app is styled from; `secondary` alone
            matches nothing (styles/global.css defines `.btn.secondary`, not `.secondary`). */}
        <button type="button" className="btn" onClick={post} disabled={status === 'posting'}>
          {status === 'posting' ? leaderboardCopy.posting : leaderboardCopy.postAction}
        </button>
        <button type="button" className="btn secondary" onClick={decline} disabled={status === 'posting'}>
          {leaderboardCopy.declineAction}
        </button>
      </div>
    </section>
  );
}

// STARTING OVER — the caller persistence/runEnd.js shipped without, and the only dispatcher of
// HARD_RESET in the codebase. Both existed and neither reached the other: the reducer has answered
// HARD_RESET with a fresh state since the odyssey landed, and nothing has ever sent it.
//
// THE ORDER IS THE POINT AND IT IS NOT THIS COMPONENT'S TO GET RIGHT. endRunAndClearSave() seals
// the run, promotes it into the career store and only then clears the save — a clearSave() that ran
// first would have destroyed the record that promotion exists to keep. This file calls that one
// function rather than the three steps, so the sequence cannot be got wrong from here.
//
// HARD_RESET IS DISPATCHED AFTER, not instead. The save is gone at that point but the reducer still
// holds the finished run in memory, and hooks/useGameTick.js autosaves every 30 seconds and again
// on unload — so without the dispatch the very next autosave would write the cleared run straight
// back. Resetting the reducer is what makes the wipe stick.
//
// TWO STEPS, NO MODAL. The rest of this act's UI does not interrupt, and a destructive control that
// needs a second press does not need a dialog to be safe. The second step says what goes and what
// stays, in that order.
function StartOver({ dispatch }) {
  const [confirming, setConfirming] = React.useState(false);
  const { state } = useGame();

  function wipe() {
    endRunAndClearSave(state);
    dispatch({ type: actionTypes.HARD_RESET });
    setConfirming(false);
  }

  return (
    <section className="rec-block rec-start-over">
      <h3 className="rec-heading">{recordsCopy.startOverHeading}</h3>
      <p className="muted rec-note">{recordsCopy.startOverBody}</p>
      {confirming ? (
        <>
          <p className="muted rec-note">{recordsCopy.startOverWarning}</p>
          <div className="rec-prompt-actions">
            <button type="button" className="btn danger" onClick={wipe}>
              {recordsCopy.startOverConfirm}
            </button>
            <button type="button" className="btn secondary" onClick={() => setConfirming(false)}>
              {recordsCopy.startOverCancel}
            </button>
          </div>
        </>
      ) : (
        <div className="rec-prompt-actions">
          <button type="button" className="btn secondary" onClick={() => setConfirming(true)}>
            {recordsCopy.startOverAction}
          </button>
        </div>
      )}
    </section>
  );
}

function RecordsPanel() {
  const { state, dispatch } = useGame();
  const endedAtClock = (state.record || {}).endedAtClock || 0;
  const [asked, setAsked] = React.useState(0);
  const career = useCareerRecords(endedAtClock, asked);
  const record = recordSlice(state);
  // The collection is the CAREER set plus whatever this run has earned but not yet promoted — a
  // run's achievements only reach the store when the run ends (STORY-044), and an achievement that
  // vanished from the collection until the run was over would look like a bug.
  const earnedIds = career.achievements.concat(
    achievementsSlice(state).earned.filter((id) => career.achievements.indexOf(id) === -1)
  );
  const untouched = Object.keys(record.actSeconds).length === 0 && career.runs.length === 0
    && earnedIds.length === 0;

  // Which finished run, if any, still owes the player a question. It has to be one that ENDED (so
  // it is sealed and already promoted) and one nobody has been asked about — and the board has to
  // exist at all, because asking somebody to post to a board this build has not been configured
  // with would be asking them for nothing.
  const [outcome, setOutcome] = React.useState(null);
  const pending = React.useMemo(() => {
    if (!isConfigured()) return null;
    return career.runs.find((run) => run && run.runId
      && career.profile.postedRunIds.indexOf(run.runId) === -1) || null;
  }, [career]);

  return (
    <div className="panel rec-panel">
      <h2>{recordsCopy.title}</h2>
      <p className="muted">{recordsCopy.blurb}</p>
      {untouched ? <p className="muted rec-note">{recordsCopy.emptyState}</p> : null}
      {pending ? (
        <PostPrompt
          key={pending.runId}
          card={pending}
          profile={career.profile}
          score={runScore(pending).total}
          onDone={(result) => { setOutcome(result); setAsked((n) => n + 1); }}
        />
      ) : null}
      {/* Outlives the prompt that produced it, because marking the run asked unmounts that prompt
          on the same pass. A player who pressed a button is told what happened. */}
      {!pending && outcome === 'posted' ? <p className="muted rec-note">{leaderboardCopy.posted}</p> : null}
      {!pending && outcome === 'failed' ? <p className="muted rec-note">{leaderboardCopy.postFailed}</p> : null}
      <CurrentRun state={state} />
      <Achievements earnedIds={earnedIds} />
      <FinishedRuns runs={career.runs} />
      <SharedBoard />
      {/* Last on the screen, deliberately. Everything above it is what the player came to read;
          this is the one control that takes something away. */}
      <StartOver dispatch={dispatch} />
    </div>
  );
}

module.exports = RecordsPanel;
