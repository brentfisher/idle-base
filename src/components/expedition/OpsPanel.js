const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The terminal: net rates, the standing directive and the log (PRD §6.4). The tab Act VII opens
// on, and the only one for the first 20-30 minutes — it carries no `unlockedBy` entry in
// data/acts.js for exactly that reason.
//
// A placeholder until its own story lands. THIS story owns the routing — that 'ops' resolves to a
// panel through both registration lists — and deliberately not the contents.
function OpsPanel() {
  return <PlaceholderPanel panelId="ops" />;
}

module.exports = OpsPanel;
