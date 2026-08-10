const React = require('react');

const TABS = [
  { id: 'field', label: 'Field' },
  { id: 'roster', label: 'Roster' },
  { id: 'ticketing', label: 'Ticketing' },
  { id: 'league', label: 'League' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'camp', label: 'Training Camp' },
  { id: 'trade', label: 'Trade Deadline' },
  { id: 'prestige', label: 'Prestige' },
];

function TabNav({ activeTab, onChange, tradeOpen, playoffsActive }) {
  return (
    <div className="tab-nav">
      {TABS.map((tab) => {
        const attention = (tab.id === 'trade' && tradeOpen) || (tab.id === 'playoffs' && playoffsActive);
        const classes = ['', tab.id === activeTab ? 'active' : '', attention ? 'attention' : ''].join(' ').trim();
        return (
          <button key={tab.id} className={classes || undefined} onClick={() => onChange(tab.id)}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

module.exports = TabNav;
