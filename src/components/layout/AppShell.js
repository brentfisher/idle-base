const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const useGameTick = require('../../hooks/useGameTick');
const { getUnlockedFeatures } = require('../../engine/progression');
const HeaderStats = require('./HeaderStats');
const TabNav = require('./TabNav');
const EventFeed = require('./EventFeed');
const FieldView = require('../field/FieldView');
const RosterPanel = require('../roster/RosterPanel');
const TicketingPanel = require('../ticketing/TicketingPanel');
const StandingsPanel = require('../league/StandingsPanel');
const PlayoffBracket = require('../playoffs/PlayoffBracket');
const TrainingCampPanel = require('../trainingCamp/TrainingCampPanel');
const TradeDeadlinePanel = require('../tradeDeadline/TradeDeadlinePanel');
const PrestigePanel = require('../prestige/PrestigePanel');
const Modal = require('../common/Modal');

// Tab id === feature id in an act's `unlocks` array (data/acts.js). This is the single point of
// coupling between the tab bar and the act config: if the real acts name a feature differently,
// change the key here (or map it) rather than hunting through the components.
// Declaration order is the tab order.
const PANELS = {
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
  const [activeTab, setActiveTab] = React.useState('field');
  useGameTick();

  // There is no season until Act III creates one, so every season-derived flag here reads as
  // "absent", not "zero".
  const tradeOpen = !!state.season && state.season.tradeWindows.some((w) => w.open);
  const playoffsActive = !!state.season && state.season.phase === 'playoffs';
  const ActivePanel = PANELS[activeTab] || FieldView;
  const summary = state.season ? state.season.lastOffseasonSummary : null;

  // Locked tabs are not rendered at all — no greyed-out teasers. The reveal is the reward.
  const act = state.progression.act;
  const visibleTabs = React.useMemo(() => {
    const unlocked = getUnlockedFeatures(act);
    return Object.keys(PANELS).filter((tabId) => unlocked.indexOf(tabId) !== -1);
  }, [act]);

  // If the tab the player is on ever stops being unlocked, fall back to the first visible tab
  // instead of rendering blank. `PANELS[...] || FieldView` stays as the final backstop.
  const effectiveTab = visibleTabs.indexOf(activeTab) !== -1 ? activeTab : visibleTabs[0] || 'field';
  const ActivePanel = PANELS[effectiveTab] || FieldView;

  // Looking at a tab is what marks it seen, which covers the tab the app opens on as well as
  // one the player clicks. markTabSeen is a no-op once the id is recorded, so this settles.
  const seenTabs = state.progression.seenTabs;
  React.useEffect(() => {
    if (seenTabs.indexOf(effectiveTab) === -1) {
      dispatch({ type: actionTypes.MARK_TAB_SEEN, tabId: effectiveTab });
    }
  }, [effectiveTab, seenTabs, dispatch]);

  // Sticky on prestige.runStats.championships (not the transient per-season summary, which
  // a later season's offseason transition can overwrite during a long offline catch-up) so
  // a title win is never silently missed. Shown once per championship, ahead of the recap.
  const unseenChampionships = state.prestige.runStats.championships - state.prestige.victoryAcknowledgedCount;
  const showVictory = unseenChampionships > 0;

  return (
    <div className="app-shell">
      <HeaderStats />
      <TabNav
        activeTab={effectiveTab}
        visibleTabs={visibleTabs}
        seenTabs={seenTabs}
        onChange={setActiveTab}
        tradeOpen={tradeOpen}
        playoffsActive={playoffsActive}
      />
      <ActivePanel />
      {/* Rendered below the active panel rather than inside a tab: the feed is the only
          always-on signal that the simulation is running, so it must never be hidden. */}
      <EventFeed />

      {showVictory && (
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

      {!showVictory && state.season && state.season.offseasonSummaryPending && summary && (
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
