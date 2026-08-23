const React = require('react');
const { ACT_SEVEN_PANELS } = require('../../data/actSevenPanels');
const { PLAYOFF_COPY } = require('../../data/playoffsConfig');

// Labels and ordering for every tab the game can ever show. Which of these are actually
// rendered is decided by AppShell from the unlocked features for the current act and passed
// in as `visibleTabs` — a tab absent from that list is not rendered at all.
//
// The twelve ballpark tabs are listed here; Act VII's six are SPREAD IN from
// data/actSevenPanels.js at the end. Two lists rather than one because the split is the house
// layering rule showing through, not an inconsistency: a player-facing string literal in a
// component is a bug, and the twelve below are a pre-existing one this story is not widening. The
// spread also means Act VII's ids are authored exactly once, so the class of failure this file is
// most prone to — a tab id registered in AppShell's PANELS map and forgotten here, which renders
// no button at all and makes the tab unreachable with no error anywhere — cannot happen for the
// six that came last.
const TABS = [
  { id: 'field', label: 'Field' },
  { id: 'roster', label: 'Roster' },
  { id: 'concessions', label: 'Concessions' },
  { id: 'sponsorships', label: 'Sponsors' },
  { id: 'bookie', label: 'The Bookie' },
  { id: 'ticketing', label: 'Ticketing' },
  // Short on purpose: this arrives in Act V, when the tab bar is at its widest and already
  // wraps to three rows on a 390px screen.
  { id: 'capsShop', label: 'Caps' },
  { id: 'league', label: 'League' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'camp', label: 'Training Camp' },
  { id: 'trade', label: 'Trade Deadline' },
  { id: 'prestige', label: 'Prestige' },
  // LAST among the baseball tabs and BEFORE the Act VII block, which is the only position that
  // works: this is the one tab that survives the teardown, so it has to sit at a boundary rather
  // than in the middle of a group that disappears. Short label — Act V is where the bar is widest.
  { id: 'records', label: 'Record' },
  // Act VII. Every one of the twelve above is retired by that act's `hides` (data/acts.js), so
  // these six are never on screen beside them — the bar gets SMALLER at the biggest act in the
  // game, which is a result to defend: ten tabs already had to be converted to a scroll-snapped
  // single row to survive a 390px screen.
  ...ACT_SEVEN_PANELS.map((panel) => ({ id: panel.id, label: panel.label })),
];

// `callUpPending` is engine/progression.js's isCallUpOffered(), resolved once by AppShell. It rings
// the Playoffs tab because that is where the standing offer is rendered — and the offer previously
// had no home outside a modal that a stray tap could dismiss for good.
function TabNav({ activeTab, visibleTabs, seenTabs, onChange, tradeOpen, playoffsActive, callUpPending }) {
  const visible = visibleTabs || TABS.map((tab) => tab.id);
  const seen = seenTabs || [];

  return (
    <div className="tab-nav">
      {TABS.filter((tab) => visible.indexOf(tab.id) !== -1).map((tab) => {
        const playoffsRinging = tab.id === 'playoffs' && (playoffsActive || callUpPending);
        const attention = (tab.id === 'trade' && tradeOpen) || playoffsRinging;
        const classes = ['', tab.id === activeTab ? 'active' : '', attention ? 'attention' : ''].join(' ').trim();
        // Unlocked but never visited — the badge marks the reveal and never comes back once
        // the tab is in progression.seenTabs, which persists with the save.
        const isNew = seen.indexOf(tab.id) === -1;
        // THE POSTSEASON'S OWN BADGE, and it TAKES PRECEDENCE over NEW rather than sitting beside
        // it. The reported gap — "there's no fanfare, the playoffs just start" — is that the tab
        // looked identical in October and in July. NEW cannot fill that role: it is spent the first
        // time the tab is opened and never returns, where this comes back every postseason. Two
        // badges on one button at 390px is also simply two badges too many; the live one wins
        // because it is the one that is true today.
        const isLive = tab.id === 'playoffs' && playoffsActive;
        const badge = isLive ? PLAYOFF_COPY.liveTabBadge : isNew ? 'NEW' : null;
        return (
          <button key={tab.id} className={classes || undefined} onClick={() => onChange(tab.id)}>
            {tab.label}
            {badge && <span className={`tab-badge${isLive ? ' is-live' : ''}`}>{badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

module.exports = TabNav;
