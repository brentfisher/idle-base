const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const useGameTick = require('../../hooks/useGameTick');
const HeaderStats = require('./HeaderStats');
const TabNav = require('./TabNav');
const FieldView = require('../field/FieldView');
const RosterPanel = require('../roster/RosterPanel');
const TicketingPanel = require('../ticketing/TicketingPanel');
const StandingsPanel = require('../league/StandingsPanel');
const PlayoffBracket = require('../playoffs/PlayoffBracket');
const TrainingCampPanel = require('../trainingCamp/TrainingCampPanel');
const TradeDeadlinePanel = require('../tradeDeadline/TradeDeadlinePanel');
const PrestigePanel = require('../prestige/PrestigePanel');
const Modal = require('../common/Modal');
const LotPanel = require('../lot/LotPanel');
const StoryCard = require('../narrative/StoryCard');
const { getActIntroBeat } = require('../../data/storyBeats');

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

  // Entering an act raises its story card once; dismissing records it in
  // progression.storyBeatsSeen, so it never returns on reload.
  const introBeat = getActIntroBeat(state.progression.act);
  const pendingBeat = introBeat && !state.progression.storyBeatsSeen.includes(introBeat.id) ? introBeat : null;

  // The franchise UI does not exist until the act that creates a season runs its
  // initializer (design doc, Decision 2) — pre-season acts are the lot, and nothing else.
  if (!state.season) {
    return (
      <div className="app-shell">
        <LotPanel />
        {pendingBeat && <StoryCard beat={pendingBeat} />}
      </div>
    );
  }

  const tradeOpen = state.season.tradeWindows.some((w) => w.open);
  const playoffsActive = state.season.phase === 'playoffs';
  const ActivePanel = PANELS[activeTab] || FieldView;
  const summary = state.season.lastOffseasonSummary;

  // Sticky on prestige.runStats.championships (not the transient per-season summary, which
  // a later season's offseason transition can overwrite during a long offline catch-up) so
  // a title win is never silently missed. Shown once per championship, ahead of the recap.
  const unseenChampionships = state.prestige.runStats.championships - state.prestige.victoryAcknowledgedCount;
  const showVictory = unseenChampionships > 0;

  return (
    <div className="app-shell">
      <HeaderStats />
      <TabNav activeTab={activeTab} onChange={setActiveTab} tradeOpen={tradeOpen} playoffsActive={playoffsActive} />
      <ActivePanel />

      {pendingBeat && <StoryCard beat={pendingBeat} />}

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

      {!showVictory && state.season.offseasonSummaryPending && summary && (
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
