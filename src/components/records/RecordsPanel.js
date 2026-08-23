const React = require('react');
const { useGame } = require('../../state/GameContext');
const { recordsCopy } = require('../../data/recordsPanelConfig');
const { ACHIEVEMENTS } = require('../../data/achievementsConfig');
const { PAR } = require('../../data/scoreConfig');
const { runScore, ACT_INDICES } = require('../../engine/score');
const { recordSlice, achievementsSlice, runCard } = require('../../engine/records');
const { loadRecords } = require('../../persistence/recordsStore');
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
// THE CAREER SET IS NOT THE RUN'S SET, and the screen has to make that visible or the numbers look
// broken: the achievements block never resets, while the score beside it counts only what THIS run
// earned (PRD §6). A player who has collected everything and starts a fresh run should see a full
// collection and a score of nearly zero, and should be told why in one line rather than left to
// work it out.

// Career records are read once on mount and again whenever a run ends — `endedAtClock` is stamped
// exactly once per run (engine/records.js), so it is the only signal that the store has changed.
// Reading localStorage during render would be a side effect in a pure function; this is the hook
// boundary the rest of the app keeps.
function useCareerRecords(endedAtClock) {
  const [records, setRecords] = React.useState(() => loadRecords());
  React.useEffect(() => {
    setRecords(loadRecords());
  }, [endedAtClock]);
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

function RecordsPanel() {
  const { state } = useGame();
  const endedAtClock = (state.record || {}).endedAtClock || 0;
  const career = useCareerRecords(endedAtClock);
  const record = recordSlice(state);
  // The collection is the CAREER set plus whatever this run has earned but not yet promoted — a
  // run's achievements only reach the store when the run ends (STORY-044), and an achievement that
  // vanished from the collection until the run was over would look like a bug.
  const earnedIds = career.achievements.concat(
    achievementsSlice(state).earned.filter((id) => career.achievements.indexOf(id) === -1)
  );
  const untouched = Object.keys(record.actSeconds).length === 0 && career.runs.length === 0
    && earnedIds.length === 0;

  return (
    <div className="panel rec-panel">
      <h2>{recordsCopy.title}</h2>
      <p className="muted">{recordsCopy.blurb}</p>
      {untouched ? <p className="muted rec-note">{recordsCopy.emptyState}</p> : null}
      <CurrentRun state={state} />
      <Achievements earnedIds={earnedIds} />
      <FinishedRuns runs={career.runs} />
    </div>
  );
}

module.exports = RecordsPanel;
