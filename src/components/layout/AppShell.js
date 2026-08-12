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
const LotPanel = require('../lot/LotPanel');
const WallBallPanel = require('../wallBall/WallBallPanel');
const ConcessionsPanel = require('../concessions/ConcessionsPanel');
const SponsorshipsPanel = require('../sponsorships/SponsorshipsPanel');
const BookiePanel = require('../bookie/BookiePanel');
const CapsShopPanel = require('../capsShop/CapsShopPanel');
const SearchLotButton = require('../lot/SearchLotButton');
const StoryCard = require('../narrative/StoryCard');
const ToastHost = require('../common/ToastHost');
const { getActIntroBeat } = require('../../data/storyBeats');

// Tab id === feature id in an act's `unlocks` array (data/acts.js). This is the single point of
// coupling between the tab bar and the act config: if the real acts name a feature differently,
// change the key here (or map it) rather than hunting through the components.
// Declaration order is the tab order.
const PANELS = {
  field: FieldView,
  roster: RosterPanel,
  concessions: ConcessionsPanel,
  sponsorships: SponsorshipsPanel,
  bookie: BookiePanel,
  ticketing: TicketingPanel,
  // Sits beside the other shops rather than at the end of the bar: by Act V the tab count is
  // already high on a phone, and a caps sink read as a late-game curiosity if it appeared after
  // the league and the playoffs. It is a shop, so it belongs with the shops.
  capsShop: CapsShopPanel,
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

  // Locked tabs are not rendered at all — no greyed-out teasers. The reveal is the reward.
  const act = state.progression.act;
  const unlocked = React.useMemo(() => getUnlockedFeatures(act), [act]);
  const visibleTabs = React.useMemo(
    () => Object.keys(PANELS).filter((tabId) => unlocked.indexOf(tabId) !== -1),
    [unlocked]
  );

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

  // Entering an act raises its story card once; dismissing records it in
  // progression.storyBeatsSeen, so it never returns on reload.
  const introBeat = getActIntroBeat(state.progression.act);
  const pendingBeat = introBeat && !state.progression.storyBeatsSeen.includes(introBeat.id) ? introBeat : null;

  // The franchise UI does not exist until the act that creates a season runs its initializer
  // (design doc, Decision 2) — pre-season acts are the lot, and nothing else. This early return
  // is also what stops the tab gate above from rendering an empty shell during Acts I-II, when
  // no franchise feature is unlocked yet. Every hook must stay above it.
  //
  // Act II adds the wall BESIDE the lot rather than replacing it. The Hustle button exists in
  // every act and is never gated (PRD 6.4): a broke player who cannot make the minimum wager
  // is always one click away from being able to.
  if (!state.season) {
    const wallUnlocked = unlocked.indexOf('wallBall') !== -1;
    return (
      <div className="app-shell app-shell-preseason">
        {/* The wall appears ABOVE the lot, which is the one place a player already scrolled
            past. Entering Act II therefore looked like nothing had changed. This marker sits
            where their eyes already are and points up. */}
        {wallUnlocked && (
          <div className="new-above" aria-hidden="true">
            <span>The wall is up there ↑</span>
          </div>
        )}
        {wallUnlocked && <WallBallPanel />}
        <LotPanel />
        {/* The same sticky bar the post-season branch renders below, for the same reason, and
            deliberately the same markup rather than a parallel one. The click used to live
            inside LotPanel here, so in Act I it scrolled off the bottom of a growing shop and
            in Act II it sat below a wall panel that had pushed it most of a page down — while
            Act III's copy, rendered here, stayed pinned. Two branches, two behaviours, one
            button: the player noticed.

            .app-shell-preseason (styles/global.css) is what makes `bottom: 0` mean the bottom
            of the SCREEN and not merely the bottom of a short page — Act I's content does not
            fill a viewport, and sticky alone does nothing until something overflows. */}
        <div className="hustle-bar">
          <SearchLotButton />
        </div>
        {pendingBeat && <StoryCard beat={pendingBeat} />}
        <ToastHost />
      </div>
    );
  }

  // Past this point a season is guaranteed, so these read it directly.
  const tradeOpen = state.season.tradeWindows.some((w) => w.open);
  const playoffsActive = state.season.phase === 'playoffs';
  const summary = state.season.lastOffseasonSummary;

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
      {/* The manual click, in every act. It lived inside LotPanel, which only renders in the
          pre-season branch above — so creating a season in Act III silently deleted the one
          action that guarantees any state is recoverable (engine/clicker.js, PRD 6.4). It is
          rendered here, outside the tab switch, so no tab can ever hide it again. */}
      <div className="hustle-bar">
        <SearchLotButton />
      </div>
      {/* Rendered below the active panel rather than inside a tab: the feed is the only
          always-on signal that the simulation is running, so it must never be hidden. */}
      <EventFeed />

      {pendingBeat && <StoryCard beat={pendingBeat} />}
      <ToastHost />

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
            {/* In a league with no postseason (Act III), finishing first is the whole title,
                so "Missed the playoffs" would be reporting a competition that never existed. */}
            {summary.madePlayoffs ? ' · Made the playoffs' : ''}
            {summary.finishedFirst ? ' · 🥇 First place!' : ''}
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
