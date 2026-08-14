const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The Fuel threshold and the burn that spends it (PRD §6.4). Split from Sites because the two
// answer different questions — *can I go?* against *where am I?* — and because a launch is a
// committed threshold spend that earns its own confirm surface.
//
// A placeholder until its own story lands. THIS story owns the routing — that 'launch' resolves to
// a panel through both registration lists — and deliberately not the contents.
function LaunchPanel() {
  return <PlaceholderPanel panelId="launch" />;
}

module.exports = LaunchPanel;
