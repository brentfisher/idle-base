const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The puzzles and the hint ladder (PRD §6.4, §8). A tab of its own rather than a section of Ops
// because a puzzle is read, not monitored. Revealed at the `lunar` phase.
//
// A placeholder until its own story lands. THIS story owns the routing — that 'artifacts' resolves
// to a panel through both registration lists — and deliberately not the contents.
function ArtifactsPanel() {
  return <PlaceholderPanel panelId="artifacts" />;
}

module.exports = ArtifactsPanel;
