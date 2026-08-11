const React = require('react');

// Labels and ordering for every tab the game can ever show. Which of these are actually
// rendered is decided by AppShell from the unlocked features for the current act and passed
// in as `visibleTabs` — a tab absent from that list is not rendered at all.
const TABS = [
  { id: 'field', label: 'Field' },
  { id: 'roster', label: 'Roster' },
  { id: 'concessions', label: 'Concessions' },
  { id: 'sponsorships', label: 'Sponsors' },
  { id: 'bookie', label: 'The Bookie' },
  { id: 'ticketing', label: 'Ticketing' },
  { id: 'league', label: 'League' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'camp', label: 'Training Camp' },
  { id: 'trade', label: 'Trade Deadline' },
  { id: 'prestige', label: 'Prestige' },
];

function TabNav({ activeTab, visibleTabs, seenTabs, onChange, tradeOpen, playoffsActive }) {
  const visible = visibleTabs || TABS.map((tab) => tab.id);
  const seen = seenTabs || [];

  return (
    <div className="tab-nav">
      {TABS.filter((tab) => visible.indexOf(tab.id) !== -1).map((tab) => {
        const attention = (tab.id === 'trade' && tradeOpen) || (tab.id === 'playoffs' && playoffsActive);
        const classes = ['', tab.id === activeTab ? 'active' : '', attention ? 'attention' : ''].join(' ').trim();
        // Unlocked but never visited — the badge marks the reveal and never comes back once
        // the tab is in progression.seenTabs, which persists with the save.
        const isNew = seen.indexOf(tab.id) === -1;
        return (
          <button key={tab.id} className={classes || undefined} onClick={() => onChange(tab.id)}>
            {tab.label}
            {isNew && <span className="tab-badge">NEW</span>}
          </button>
        );
      })}
    </div>
  );
}

module.exports = TabNav;
