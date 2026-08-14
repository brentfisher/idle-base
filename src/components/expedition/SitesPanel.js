const React = require('react');
const PlaceholderPanel = require('./PlaceholderPanel');

// The affiliate ladder — each site a base and a pad (PRD §6.4, §7). engine/sites.js, a later
// story, is also the single writer of `expedition.phase`, which is the field this act's whole
// intra-act reveal keys off.
//
// A placeholder until that story lands. THIS story owns the routing — that 'sites' resolves to a
// panel through both registration lists — and deliberately not the contents.
function SitesPanel() {
  return <PlaceholderPanel panelId="sites" />;
}

module.exports = SitesPanel;
