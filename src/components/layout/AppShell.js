const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const useGameTick = require('../../hooks/useGameTick');
const { getUnlockedFeatures, isCallUpOffered } = require('../../engine/progression');
const { expeditionSlice } = require('../../engine/colony');
const { resolveRules } = require('../../engine/modifiers');
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
const OpsPanel = require('../expedition/OpsPanel');
const FabPanel = require('../expedition/FabPanel');
const LaunchPanel = require('../expedition/LaunchPanel');
const SitesPanel = require('../expedition/SitesPanel');
const ArtifactsPanel = require('../expedition/ArtifactsPanel');
const ContractsPanel = require('../expedition/ContractsPanel');
const BoardPanel = require('../expedition/BoardPanel');
const RecordsPanel = require('../records/RecordsPanel');
const StoryCard = require('../narrative/StoryCard');
const ToastHost = require('../common/ToastHost');
const TeardownOverlay = require('../expedition/TeardownOverlay');
const TitleScreen = require('./TitleScreen');
const ReturnSummary = require('./ReturnSummary');
const { getActIntroBeat, getStoryBeat } = require('../../data/storyBeats');
// The one shared reading of a season recap, plus the one function that names a playoff round.
const { seasonOutcomeParts } = require('../../data/playoffsConfig');
const { playoffRoundLabel } = require('../../data/feedMessages');

// Tab id === feature id in an act's `unlocks` array (data/acts.js). This is the single point of
// coupling between the tab bar and the act config: if the real acts name a feature differently,
// change the key here (or map it) rather than hunting through the components.
// Declaration order is the tab order.
//
// TWO REGISTRATION LISTS, and a miss in either is silent. An id unlocked with no entry HERE never
// reaches `visibleTabs` at all, because that list is built by intersecting these keys with the
// unlocked set — so the tab simply does not exist, with no error. An id with an entry here but
// none in TabNav's TABS renders no button, so the tab is unreachable, also with no error. Neither
// is caught by `npm run build`. Act VII's six ids are spread into TabNav from
// data/actSevenPanels.js precisely so only one of the two lists is hand-authored for them.
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
  // Unlocked in Act I and never retired, so it is the one key in this map that is reachable from
  // BOTH the baseball acts and Act VII — every other key belongs to one side of the teardown.
  records: RecordsPanel,
  // Act VII. Every key above is retired by that act's `hides` (data/acts.js), so these seven are
  // never on screen beside them: the map holds nineteen entries and no act ever shows more than
  // twelve of them. Order matters twice over — it is the tab order, and `visibleTabs[0]` is the
  // fallback tab, so `ops` being the first Act VII key is what makes the teardown land on the
  // terminal rather than nowhere.
  ops: OpsPanel,
  fab: FabPanel,
  launch: LaunchPanel,
  sites: SitesPanel,
  artifacts: ArtifactsPanel,
  contracts: ContractsPanel,
  // The ending (PRD §7.8), held back by `unlockedBy: { board: 'majors' }` until the fifth burn has
  // both been committed and landed. LAST, and the placement is load-bearing for the same reason
  // `ops` being first is: this map's key order is the tab order AND the fallback order, so a `board`
  // declared any earlier would put the screen that says the act is over in among the screens the
  // player uses to play it. It is also why the NEW badge lands correctly — `seenTabs` is
  // append-only across the act boundary, so the board gets its badge at the instant it is revealed,
  // which is the one tab in the game where that badge is the announcement.
  board: BoardPanel,
};

function AppShell() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = React.useState('field');
  // The call-up's second step. Local and not stored: it is which of two screens is showing, which
  // is the definition of view state, and persisting it would mean a reload could drop the player
  // back onto a confirmation they never opened. It sits up here with the other hooks because
  // AppShell early-returns a pre-season shell below and a hook may not live past that return.
  const [confirmingCallUp, setConfirmingCallUp] = React.useState(false);

  // THE TITLE SCREEN, AND WHY THE TEST IS LATCHED IN AN INITIALIZER RATHER THAN RE-READ.
  //
  // "Brand new game" is `clock === 0 && clicker.totalClicks === 0`, and that is true for about one
  // render. useGameTick() below dispatches APPLY_OFFLINE_PROGRESS on its first effect and then ticks
  // once a second, so a condition recomputed on every render would unmount the title screen roughly
  // a second after it appeared — while the player was still reading it. The useState initializer
  // runs once, on mount, which is the only moment the question can be asked honestly.
  //
  // LOCAL AND NEVER IN THE SAVE. A title screen is not a fact about the run: no engine module can
  // see it, no reducer holds it, and persisting it would mean the version bump in
  // persistence/saveLoad.js (which discards mismatched saves) had been spent on a modal. Dismissing
  // it must not return, and the latch is what guarantees that — nothing sets it back to true, so a
  // reload is the only thing that can re-ask, and by then the clock has moved.
  //
  // It sits up here with the other hooks because AppShell early-returns a pre-season shell below and
  // a hook may not live past that return. A brand new save is Act I, which is exactly the branch
  // that early-returns, so getting this wrong means the screen never appears at all.
  const [showTitle, setShowTitle] = React.useState(function () {
    return state.clock === 0 && state.clicker.totalClicks === 0;
  });

  // The welcome-back screen. Read through a falsy test rather than `=== null`, because the field is
  // absent from saves that predate it and `undefined` has to mean "nothing to show" too. Suppressed
  // while the title screen is up: the two are mutually exclusive in practice (a brand new save was
  // never away) but they are both `.modal-backdrop` at the same z-index, so which one wins is
  // decided here rather than by DOM order.
  const returnSummary = !showTitle && state.returnSummary ? state.returnSummary : null;

  useGameTick();

  // Locked tabs are not rendered at all — no greyed-out teasers. The reveal is the reward.
  //
  // The phase is Act VII's intra-act clock: five of its six tabs are listed in `unlocks` at the
  // act boundary and held back by `unlockedBy` until the run reaches the phase that names them
  // (data/acts.js). It is read through engine/colony.js's slice accessor rather than off
  // `state.expedition`, which is the only sanctioned way into that slice, and it is `'aftermath'`
  // for every save that predates the slice — so every act before VII passes a phase that gates
  // nothing. BOTH values are memo dependencies: keying only on `act` would freeze the tab set at
  // whatever the phase was when the act began, and the reveal would simply never fire.
  const act = state.progression.act;
  const phase = expeditionSlice(state).phase;
  const unlocked = React.useMemo(() => getUnlockedFeatures(act, phase), [act, phase]);
  const visibleTabs = React.useMemo(
    () => Object.keys(PANELS).filter((tabId) => unlocked.indexOf(tabId) !== -1),
    [unlocked]
  );

  // If the tab the player is on ever stops being unlocked, fall back to the first visible tab
  // instead of rendering blank. That is the whole crossing into Act VII, and it needs no reset:
  // a player who crosses while sitting on League keeps `activeTab === 'league'` in the useState
  // above, `visibleTabs` no longer contains it, and every render resolves to `visibleTabs[0]`
  // until they tap something. The stale value is masked, costs nothing and self-corrects.
  //
  // THE `|| 'field'` AND `|| FieldView` BACKSTOPS THAT USED TO BE HERE ARE GONE, and removing them
  // is the point rather than a tidy-up. They made the ballpark the answer to every question the
  // tab gate could not answer — including, once an act retires `field` itself, "which tab does an
  // act that has no baseball in it open on?", where the answer they gave was to render the pitch
  // inside the act whose entire premise is that the pitch is gone. The fallback is now purely
  // structural: whatever the act's first visible tab is, which is `ops` in Act VII and `field` in
  // Acts III-VI exactly as before, with no id spelled out in this file at all.
  //
  // `ActivePanel` can now be undefined, in one case only: no visible tabs at all. It cannot happen
  // for a *missing* PANELS entry, because `visibleTabs` is built from this map's own keys — an
  // unlocked id with no panel never gets that far. So the guard below covers an act that unlocks
  // no tab, and rendering nothing there is the honest answer; the previous code would have shown
  // that player a ballpark.
  const effectiveTab = visibleTabs.indexOf(activeTab) !== -1 ? activeTab : visibleTabs[0];
  const ActivePanel = effectiveTab ? PANELS[effectiveTab] : null;

  // Looking at a tab is what marks it seen, which covers the tab the app opens on as well as
  // one the player clicks. markTabSeen is a no-op once the id is recorded, so this settles.
  //
  // Guarded on `effectiveTab` existing now that it can be undefined: `seenTabs.indexOf(undefined)`
  // is -1, so without the guard an act with no visible tabs would dispatch MARK_TAB_SEEN with an
  // undefined id and persist it into the save, once, forever. Note what is NOT here: nothing
  // clears `seenTabs` at the Act VII boundary. It is append-only, the twelve ballpark ids stay in
  // it and are simply never queried again, and each Act VII tab therefore gets its NEW badge at
  // the moment it is revealed — which is exactly what the badge is for.
  const seenTabs = state.progression.seenTabs;
  React.useEffect(() => {
    if (effectiveTab && seenTabs.indexOf(effectiveTab) === -1) {
      dispatch({ type: actionTypes.MARK_TAB_SEEN, tabId: effectiveTab });
    }
  }, [effectiveTab, seenTabs, dispatch]);

  // Act VII's palette (PRD §6.8). One class on <body>, and it has to be <body> rather than
  // anything inside the tree: the ballpark ground is painted on `html, body`
  // (styles/global.css:5-13) and `body` is the only element above the React root, so there is no
  // way to reach it from in here. The alternatives — a second stylesheet, a second shell — are
  // what Decision 3.1 forbids.
  //
  // KEYED ON `seasonFrozen` RATHER THAN ON THE ACT INDEX, matching HeaderStats.js:74. The rule is
  // what the act declares about itself, so an era or a later act that also freezes the season gets
  // the treatment without anyone remembering to add an index here.
  //
  // IT MUST APPLY ON MOUNT, NOT AFTER THE TEARDOWN. A player reloading directly into Act VII never
  // sees the overlay — it plays once, on the act flip — so a palette that waited for it would
  // leave that player on ballpark green permanently. Running it as a plain mount effect keyed on
  // the flag is what covers both paths; during the crossing itself the ordering is moot, because
  // the teardown overlay is an opaque `inset: 0`.
  //
  // The cleanup is not decorative either: prestige returns the player to Act VI with the same
  // component tree mounted, and a class left behind would paint the ballpark in expedition black.
  const frozen = !!resolveRules(state).seasonFrozen;
  React.useEffect(() => {
    if (!frozen) return undefined;
    document.body.classList.add('expedition');
    return () => document.body.classList.remove('expedition');
  }, [frozen]);

  // Entering an act raises its story card once; dismissing records it in
  // progression.storyBeatsSeen, so it never returns on reload.
  const introBeat = getActIntroBeat(state.progression.act);
  // `!showTitle` is not defensive, it is an ordering. On a brand new save BOTH are pending —
  // `act-1-intro` is unseen at exactly the moment the title screen shows — and both render a
  // `.modal-backdrop` at z-index 100, so without this the two would stack and DOM order would decide
  // what the player's first ever screen was. The intended sequence is: name the game, press Start,
  // and only then "The Vacant Lot" with its objective. It is also why the title screen's prose
  // deliberately does not retell the card's scene (data/titleScreenConfig.js).
  const pendingBeat =
    introBeat && !showTitle && !state.progression.storyBeatsSeen.includes(introBeat.id) ? introBeat : null;

  // The franchise UI does not exist until the act that creates a season runs its initializer
  // (design doc, Decision 2) — pre-season acts are the lot, and nothing else. This early return
  // is also what stops the tab gate above from rendering an empty shell during Acts I-II, when
  // no franchise feature is unlocked yet. Every hook must stay above it.
  //
  // ACT VII DEPENDS ON THIS BRANCH NOT BEING TAKEN, and it was verified rather than assumed,
  // because if it were taken the act that retires the ballpark would render as Act I's vacant lot.
  // It holds for a structural reason and not a lucky one: `seasonFrozen` is a SUSPENSION, never a
  // deletion (Decision 3.5) — engine/tickEngine.js gates the season-phase block on it and leaves
  // `season`, `league`, `roster` and `stadium` in state, valid and untouched — and the only way
  // into Act VII is forward through Act III, whose initializer is what creates the season in the
  // first place. Nothing in the engine ever nulls the slice. Measured on an injected Act VII save:
  // 30 minutes of simulated clock, season still truthy, `scheduleIndex` and standings unmoved.
  //
  // The condition is deliberately left as `!state.season` rather than being widened to something
  // Act VII-aware. Making it `!state.season && visibleTabs.length === 0` looked tempting and is a
  // crash: the branch below dereferences `state.season.tradeWindows` immediately, and FieldView and
  // StandingsPanel read the season too, so a season-less save would fall through to a null
  // dereference instead of to a lot that at least renders.
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
        <TeardownOverlay />
        {/* IN BOTH SHELLS, for the reason TeardownOverlay's comment below already gives and which is
            sharper for these two. This branch IS Act I, so a title screen mounted only in the
            post-season return would be missing from the one act it exists for — and a returning
            player can be mid-Act-II, which is also this branch. Only one branch renders at a time,
            so only one instance of each ever exists. */}
        {showTitle && <TitleScreen onStart={() => setShowTitle(false)} />}
        {returnSummary && <ReturnSummary />}
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

  // The offer, and the prose for it. Both are looked up unconditionally rather than behind
  // `showVictory` so that a beat id typo shows up as a missing offer on the very first title
  // rather than as a crash — getStoryBeat() returns null for an unknown id, and every use of
  // `callUpBeat` below is null-guarded.
  const callUpOffered = isCallUpOffered(state);
  const callUpBeat = getStoryBeat('act-7-offer');

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
        callUpPending={callUpOffered}
      />
      {ActivePanel && <ActivePanel />}
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
      {/* Rendered in BOTH shells, and it has to be. AppShell early-returns a pre-season shell when
          state.season is absent, so an overlay mounted only here would be missing for that whole
          class of saves. Only one branch renders at a time, so only one instance ever exists;
          switching branches remounts it and resets its baseline, which plays nothing — the safe
          direction. The crossing this exists for does not switch branches: Act VII keeps
          state.season, because seasonFrozen pauses the simulation without deleting it. */}
      <TeardownOverlay />

      {/* The other half of the pair mounted in the pre-season branch above. The welcome-back screen
          takes PRECEDENCE over the victory modal and the offseason recap — both of those are gated
          on `!returnSummary` below — rather than merely being rendered first: they are all
          `.modal-backdrop` at the same z-index, so DOM order decides which one paints on top and the
          later one wins. A long absence can produce all three at once, and a player who has just
          come back needs to be told what they missed before being handed a trophy for part of it.
          Each dismissal reveals the next. */}
      {showTitle && <TitleScreen onStart={() => setShowTitle(false)} />}
      {returnSummary && <ReturnSummary />}

      {/* The call-up rides inside the victory modal rather than arriving as a popup of its own,
          because the offer only makes sense in the moment the trophy is handed over — and because
          reusing this modal means "Continue" is already the decline, with no second dismissal for
          a player to mis-read as consent. `showVictory` fires once per championship, so winning
          another title re-offers for free (PRD §3.2: declining is never permanent).

          Whether to offer at all is engine/progression.js's isCallUpOffered() — the component is
          not allowed to know what makes the crossing available, only how to draw it. */}
      {!returnSummary && showVictory && !confirmingCallUp && (
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
          {callUpOffered && callUpBeat && (
            /* Inline style rather than a class, matching Modal.js's own footer: this is a divider
               inside a modal, and global.css ends inside its mobile media block, so a rule added
               there is a mobile-only rule unless it is placed by hand in a feature section. */
            <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16 }}>
              <h3>{callUpBeat.title}</h3>
              {callUpBeat.prose.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              <button className="btn" onClick={() => setConfirmingCallUp(true)}>
                {callUpBeat.acceptLabel}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Step two, and the only screen whose button dispatches. Closing it (backdrop, or the
          decline label) returns to the trophy — a mis-tap on step one costs nothing. */}
      {showVictory && confirmingCallUp && callUpBeat && (
        <Modal
          title={callUpBeat.confirm.title}
          onClose={() => setConfirmingCallUp(false)}
          closeLabel={callUpBeat.confirm.declineLabel}
        >
          {callUpBeat.confirm.prose.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <button
            className="btn danger"
            onClick={() => {
              setConfirmingCallUp(false);
              dispatch({ type: actionTypes.ACCEPT_CALL_UP });
            }}
          >
            {callUpBeat.confirm.acceptLabel}
          </button>
        </Modal>
      )}

      {!returnSummary && !showVictory && state.season && state.season.offseasonSummaryPending && summary && (
        <Modal
          title={`Season ${summary.seasonNumber} Recap`}
          onClose={() => dispatch({ type: actionTypes.DISMISS_OFFSEASON_SUMMARY })}
          closeLabel="Continue"
        >
          <p>
            {/* One shared reading of a recap (data/playoffsConfig.js seasonOutcomeParts), used here,
                on the League tab and on the Playoffs tab. Each screen used to assemble its own
                ternary chain, and all three therefore told a team that lost in the semifinal that it
                had made the playoffs and finished first — with nothing anywhere saying what happened
                in the bracket. The helper keeps the positive-only rule (an act with no postseason
                cannot have missed one) and adds the exit round. */}
            Record: {summary.wins}-{summary.losses}
            {seasonOutcomeParts(summary, playoffRoundLabel)
              .map((part) => ` · ${part}`)
              .join('')}
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
