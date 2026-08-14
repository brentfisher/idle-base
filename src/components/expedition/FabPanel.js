const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The fabrication shop — generators, scrubbers, farms and tanks, and the act's one Salvage sink
// (PRD §6.4). Revealed at the `lifeSupport` phase.
//
// A placeholder until its own story lands. THIS story owns the routing — that 'fab' resolves to a
// panel through both registration lists — and deliberately not the contents.
function FabPanel() {
  return <PlaceholderPanel panelId="fab" />;
}

module.exports = FabPanel;
