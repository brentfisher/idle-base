// The SEVEN Act VII tabs: their ids and their tab-bar labels (PRD §6.4, plus §7.8's ending).
//
// ONCE THIS FILE ALSO HELD `title`, `blurb` AND A PLACEHOLDER NOTE, AND STORY-040 REMOVED ALL THREE.
// Every one of them had exactly one reader — components/expedition/PlaceholderPanel.js, the shared
// body each Act VII tab rendered until the story that owned it landed. STORY-040 is the last of the
// six panel stories, so `contracts` stopped rendering that body, nothing imported it, and it was
// deleted. Its fields went with it rather than being left behind as a registry of strings no screen
// reads: five rows of this list carried a paragraph arguing `blurb` was kept "because the field is
// part of this list's shape", and the moment the last reader went those paragraphs were defending a
// field against its own absence of purpose. Verified by grep before removal — `blurb`, `title`,
// `getActSevenPanel` and `ACT_SEVEN_PLACEHOLDER_NOTE` had no consumer left anywhere in src/.
//
// WHAT SURVIVES IS `id` AND `label`, and both have live readers: TabNav spreads them into its TABS
// array, and AppShell's PANELS map is keyed by id. Each panel authors its own <h2> from its own copy
// config — which is why `title` was dead even before the placeholder went.
//
// §6.4 authored six. STORY-032 appended `board` — see the note on the tab ORDER below, where the
// reason it is last is argued.
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
  { id: 'ops', label: 'Ops' },
  { id: 'fab', label: 'Fab' },
  { id: 'launch', label: 'Launch' },
  { id: 'sites', label: 'Sites' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'board', label: 'Board' },
];

module.exports = { ACT_SEVEN_PANELS };
