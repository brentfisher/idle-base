const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The side-quest board, each contract paying fixed Fuel (PRD §6.4, §9). Last in tab order because
// it is the only purely optional tab in the act — a player who never opens it still finishes,
// slowly, which is Decision 3.6 applied to the fuel economy. Revealed at the `deepSpace` phase.
//
// A placeholder until its own story lands. THIS story owns the routing — that 'contracts' resolves
// to a panel through both registration lists — and deliberately not the contents.
function ContractsPanel() {
  return <PlaceholderPanel panelId="contracts" />;
}

module.exports = ContractsPanel;
