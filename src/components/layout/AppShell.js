const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const useGameTick = require('../../hooks/useGameTick');
const { getUnlockedFeatures } = require('../../engine/progression');
const { getActEntryBeat } = require('../../data/storyBeats');
const HeaderStats = require('./HeaderStats');
const TabNav = require('./TabNav');
const LotPanel = require('../lot/LotPanel');
const WallBallPanel = require('../wallBall/WallBallPanel');
const FieldView = require('../field/FieldView');
const RosterPanel = require('../roster/RosterPanel');
const TicketingPanel = require('../ticketing/TicketingPanel');
const StandingsPanel = require('../league/StandingsPanel');
const PlayoffBracket = require('../playoffs/PlayoffBracket');
const TrainingCampPanel = require('../trainingCamp/TrainingCampPanel');
const TradeDeadlinePanel = require('../tradeDeadline/TradeDeadlinePanel');
const PrestigePanel = require('../prestige/PrestigePanel');
const Modal = require('../common/Modal');

// Keyed by feature id; which of these render is derived from the act, never stored.
const PANELS = {
  lot: LotPanel,
  wallBall: WallBallPanel,
  field: FieldView,
  roster: RosterPanel,
  ticketing: TicketingPanel,
  league: StandingsPanel,
  playoffs: PlayoffBracket,
  camp: TrainingCampPanel,
  trade: TradeDeadlinePanel,
  prestige: PrestigePanel,
};

function AppShell() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = React.useState('lot');
  useGameTick();

  const unlockedFeatures = getUnlockedFeatures(state.progression.act);
  const act = state.progression.act;

  // On an act boundary, jump to the thing the act just opened — the reveal is the reward.
  const previousAct = React.useRef(act);
  React.useEffect(() => {
    if (previousAct.current === act) return;
    previousAct.current = act;
    const newest = getUnlockedFeatures(act).filter((f) => !getUnlockedFeatures(act - 1).includes(f));
    if (newest.length > 0) setActiveTab(newest[0]);
  }, [act]);

  React.useEffect(() => {
    if (!unlockedFeatures.includes(activeTab)) setActiveTab(unlockedFeatures[0] || 'lot');
  }, [unlockedFeatures, activeTab]);

  React.useEffect(() => {
    if (!state.progression.seenTabs.includes(activeTab) && unlockedFeatures.includes(activeTab)) {
      dispatch({ type: actionTypes.MARK_TAB_SEEN, tabId: activeTab });
    }
  }, [activeTab, unlockedFeatures, state.progression.seenTabs, dispatch]);

  // season / league / stadium are null until their act constructs them (Decision 2), so
  // every read of them here is guarded rather than assumed.
  const tradeOpen = !!state.season && state.season.tradeWindows.some((w) => w.open);
  const playoffsActive = !!state.season && state.season.phase === 'playoffs';
  const ActivePanel = PANELS[activeTab] || LotPanel;
  const summary = state.season ? state.season.lastOffseasonSummary : null;

  const beat = getActEntryBeat(act);
  const showBeat = !!beat && !state.progression.storyBeatsSeen.includes(beat.id);

  // Sticky on prestige.runStats.championships (not the transient per-season summary, which
  // a later season's offseason transition can overwrite during a long offline catch-up) so
  // a title win is never silently missed. Shown once per championship, ahead of the recap.
  const unseenChampionships = state.prestige.runStats.championships - state.prestige.victoryAcknowledgedCount;
  const showVictory = unseenChampionships > 0;

  return (
    <div className="app-shell">
      <HeaderStats />
      <TabNav
        activeTab={activeTab}
        onChange={setActiveTab}
        unlockedFeatures={unlockedFeatures}
        seenTabs={state.progression.seenTabs}
        tradeOpen={tradeOpen}
        playoffsActive={playoffsActive}
      />
      <ActivePanel />

      {showBeat && (
        <Modal
          title={beat.title}
          onClose={() => dispatch({ type: actionTypes.MARK_STORY_BEAT_SEEN, beatId: beat.id })}
          closeLabel="Go on then"
        >
          {beat.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="muted">
            <strong>Objective:</strong> {beat.objective}
          </p>
        </Modal>
      )}

      {!showBeat && showVictory && (
        <Modal
          title="🏆 League Champions!"
          onClose={() => dispatch({ type: actionTypes.ACKNOWLEDGE_VICTORY })}
          closeLabel="Continue"
        >
          <p>
            Your team won the league — that's the win condition for the game! You've now won{' '}
            <strong>{state.prestige.runStats.championships}</strong> championship
            {state.prestige.runStats.championships === 1 ? '' : 's'} this run.
          </p>
          <p className="muted">
            You can keep playing to chase more titles and grow the franchise, or head to the Prestige tab to bank a
            permanent bonus and start a new era.
          </p>
        </Modal>
      )}

      {!showBeat && !showVictory && state.season && state.season.offseasonSummaryPending && summary && (
        <Modal
          title={`Season ${summary.seasonNumber} Recap`}
          onClose={() => dispatch({ type: actionTypes.DISMISS_OFFSEASON_SUMMARY })}
          closeLabel="Continue"
        >
          <p>
            Record: {summary.wins}-{summary.losses}
            {summary.madePlayoffs ? ' · Made the playoffs' : ' · Missed the playoffs'}
            {summary.wonChampionship ? ' · 🏆 Champions!' : ''}
          </p>
          {summary.retired.length > 0 && (
            <>
              <h3>Retired</h3>
              <ul>
                {summary.retired.map((p) => (
                  <li key={p.id}>
                    {p.name} ({p.position})
                  </li>
                ))}
              </ul>
              <h3>Rookies Signed</h3>
              <ul>
                {summary.rookies.map((p) => (
                  <li key={p.id}>
                    {p.name} ({p.position})
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

module.exports = AppShell;
