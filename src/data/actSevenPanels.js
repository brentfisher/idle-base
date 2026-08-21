// The SEVEN Act VII tabs: their ids, their tab-bar labels, and the copy their panels render while
// they are still placeholders (PRD §6.4, plus §7.8's ending). Player-facing prose lives here and
// never in a component, which is the rule that put every other string in this directory.
//
// §6.4 authored six. STORY-032 appended `board`, which is not a placeholder — see the note on that
// row and on the tab ORDER below, where the reason it is last is argued.
//
// WHY THIS IS A SEPARATE FILE FROM data/actSevenConfig.js. That file is the act's SHAPE — the phase
// ladder and the resource records the engine and the save format are built on. This is the act's
// SURFACE. They change for different reasons and are read by different layers: nothing in
// src/engine/ ever needs a tab label, and nothing in src/components/ should be reaching for the
// resource capacity table to render a heading.
//
// THE ID LIST IS ONE OF THREE THAT MUST AGREE, and the other two are silent when they disagree.
// A tab id needs an entry in AppShell's PANELS map (a miss there used to render the ballpark field
// under an Act VII tab bar; it now renders nothing, which is at least honest) and an entry in
// TabNav's TABS array (a miss there renders no button at all, so the tab is unreachable). Neither
// is caught by `npm run build`. TabNav spreads this list rather than restating it, so of the three
// only PANELS is authored by hand — see the note there.
//
// Order is TAB ORDER, and it is argued for in §6.4: `ops` and `fab` are the Act I pair rotated (a
// screen you watch and a screen you spend on), `launch` is split from `sites` because they answer
// different questions — *can I go?* against *where am I?* — and `contracts` is last because it is
// the only purely optional tab in the act.
//
// SEVEN NOW, NOT SIX. §6.4 authored six tabs and STORY-032 appended `board`, which is the act's
// ending (§7.8) and is revealed only in the `majors` phase — after the fifth burn has been
// committed and has landed. It is deliberately LAST in this list rather than beside the other
// read-only screen: AppShell's `visibleTabs[0]` is the fallback tab, so anything declared before
// `ops` would change which screen the teardown lands on, and anything declared before `contracts`
// would move the ending in among the tabs the player uses to play. It is the last tab because it is
// the last thing.
const ACT_SEVEN_PANELS = [
  {
    id: 'ops',
    label: 'Ops',
    title: 'Ops',
    // The tab the act opens on, and for 20-30 minutes the only one. Everything the player can do
    // in `aftermath` is the click, which AppShell renders outside the tab switch entirely.
    blurb: 'Net rates, the standing directive, and the log. The frequency is open; nothing is on it yet.',
  },
  {
    id: 'fab',
    label: 'Fab',
    title: 'Fabrication',
    // Keeps its `blurb` for the reason the `board` row below states: the field is part of this
    // list's shape, and a row missing it would be the one row a future reader had to open a panel
    // to check. components/expedition/FabPanel.js is a real panel as of STORY-036 and never renders
    // PlaceholderPanel, so this line is now read only by whoever is editing this file — the shop's
    // own heading and subtitle are authored in data/actSevenFabConfig.js.
    blurb: 'Where Salvage becomes hardware — generators, scrubbers, farms, tanks. The bench is bare.',
  },
  {
    id: 'launch',
    label: 'Launch',
    title: 'Launch',
    blurb: 'The Fuel threshold, and the burn that spends it. You have nothing to hold Fuel in yet.',
  },
  {
    id: 'sites',
    label: 'Sites',
    title: 'Sites',
    blurb: 'The affiliate ladder, out from the wreck. One site on it so far, and you are standing on it.',
  },
  {
    id: 'artifacts',
    label: 'Artifacts',
    title: 'Artifacts',
    // Keeps its `blurb` for the reason the `fab` and `board` rows above state: the field is part of
    // this list's shape, and a row missing it would be the one row a future reader had to open a
    // panel to check. components/expedition/ArtifactsPanel.js is a real panel as of STORY-038 and
    // never renders PlaceholderPanel, so this line is now read only by whoever is editing this file
    // — the puzzle surface's own heading, subtitle and every other word it draws are authored in
    // data/actSevenArtifactsConfig.js and data/actSevenPuzzlesConfig.js.
    blurb: 'Recovered equipment, and what can be read off it. Nothing recovered.',
  },
  {
    id: 'contracts',
    label: 'Contracts',
    title: 'Contracts',
    blurb: 'Organisational paperwork, paid in Fuel. The board is empty.',
  },
  {
    id: 'board',
    label: 'Board',
    title: 'Standings',
    // Carries a `blurb` like every other row even though components/expedition/BoardPanel.js is a
    // real panel and never renders PlaceholderPanel. The field is part of this list's shape and a
    // row missing it would be the one row a future reader had to check the panel for — and the tab
    // is unreachable before `majors`, so the line is only ever read by whoever is editing this file.
    blurb: 'Farm systems, current season. You are in it.',
  },
];

// One line, shown under every placeholder, and it is deliberately not written in the act's voice:
// it is the game telling the truth about itself rather than the Office telling a story. A player
// can only reach these panels through an injected save today, so the honest reading is the useful
// one — a fictional "standby" line would be indistinguishable from a broken panel.
const ACT_SEVEN_PLACEHOLDER_NOTE = 'This panel is not built yet.';

function getActSevenPanel(panelId) {
  return ACT_SEVEN_PANELS.find((panel) => panel.id === panelId) || null;
}

module.exports = { ACT_SEVEN_PANELS, ACT_SEVEN_PLACEHOLDER_NOTE, getActSevenPanel };
