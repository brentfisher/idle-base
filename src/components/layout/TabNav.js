const React = require('react');

// Order is presentation order, not unlock order. Locked tabs are not rendered at all —
// no greyed-out teasers, because the reveal is the reward (design.md Decision 5 / PRD §6.2).
const TABS = [
  { id: 'lot', label: 'The Lot' },
  { id: 'wallBall', label: 'Wall Ball' },
  { id: 'field', label: 'Field' },
  { id: 'roster', label: 'Roster' },
  { id: 'ticketing', label: 'Ticketing' },
  { id: 'league', label: 'League' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'camp', label: 'Training Camp' },
  { id: 'trade', label: 'Trade Deadline' },
  { id: 'prestige', label: 'Prestige' },
];

function TabNav({ activeTab, onChange, unlockedFeatures, seenTabs, tradeOpen, playoffsActive }) {
  const visible = TABS.filter((tab) => unlockedFeatures.includes(tab.id));

  return (
    <div className="tab-nav">
      {visible.map((tab) => {
        const attention = (tab.id === 'trade' && tradeOpen) || (tab.id === 'playoffs' && playoffsActive);
        const isNew = !seenTabs.includes(tab.id);
        const classes = ['', tab.id === activeTab ? 'active' : '', attention ? 'attention' : '']
          .join(' ')
          .trim();
        return (
          <button key={tab.id} className={classes || undefined} onClick={() => onChange(tab.id)}>
            {tab.label}
            {isNew && <span className="tab-new">NEW</span>}
          </button>
        );
      })}
    </div>
  );
}

module.exports = TabNav;
