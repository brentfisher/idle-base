// The Fab panel's furniture — every player-facing string the fabrication shop draws that is not
// already authored on a module (PRD §6.4, "Fabrication shop — generators, scrubbers, farms, tanks.
// The Salvage sink.").
//
// A COPY OBJECT AND NOTHING ELSE. There is no fab CONFIG: the ladder, its prices, its gates and its
// measurement record all live in data/actSevenModulesConfig.js, and the panel gets its rows from
// engine/actSevenModules.js with cost, ownership and affordability already resolved. What was left
// over is the screen's own words, and they are here for the reason `conventions.md` gives — a
// string literal in a component is a string nobody editing the act's voice will ever find.
// data/actSevenBoardConfig.js's `boardCopy` is the pattern, down to the function-valued fields for
// the lines that interpolate a number.
//
// NOTHING HERE RESTATES A MODULE. No label, no description, no effect, no price: those come back
// off the offer. This file must never grow a per-module string, because the moment it does there
// are two places to author a module's words and one of them is not next to its numbers.
const { formatNumber } = require('../utils/formatNumber');

const fabCopy = {
  // The panel's heading. Duplicated from the `fab` row in data/actSevenPanels.js exactly as
  // `boardCopy.title` duplicates the `board` row's — that list is the TAB BAR's source (its
  // `label`), and a panel reaching into the tab registry for its own <h2> would couple the two so
  // that renaming a tab silently retitles a screen.
  title: 'Fabrication',
  subtitle: 'Salvage in, hardware out. Everything the colony runs on is built on this bench.',

  // The cost, which is also the button. Salvage is an ordinary wallet currency (engine/wallet.js)
  // and is named as one — the four consumables a module produces and consumes are NOT currencies
  // and never appear as a price.
  costLabel: (cost) => formatNumber(cost) + ' Salvage',

  // Owned count. Every module in this act is repeatable, so ownership is a quantity and not a
  // state, and the row says how many rather than whether.
  ownedLabel: (count) => count + ' built',

  // The spend gate (PRD §5.5). Withheld rows, and what they are waiting on.
  //
  // The heading says "not yet" and not "locked", which is the whole distinction this section
  // exists to draw: a phase-gated row is absent because the run has not got there, and a row here
  // is present because the player can go and get it this minute by buying things they already
  // wanted. It is a plan, not a wall.
  goalsTitle: 'Not yet buildable',
  goalsNote: 'These need hardware rather than Salvage. Build what they list and they open.',
  // One prerequisite: the module's own label, then progress toward the count it wants.
  requirementLabel: (requirement) => requirement.name + ' ' + requirement.owned + '/' + requirement.needed,

  // Defensive, and it should never be seen: the tier-1 rows carry no gate of any kind, so the shop
  // is non-empty from the first second of the act. It exists because the alternative to a sentence
  // is a heading over nothing, and this panel is reachable from a save this codebase never
  // migrates — an unrecognized phase reveals every row, but a future edit that gated the bottom
  // rung would empty the screen with no explanation on it.
  emptyNote: 'Nothing can be built from here yet.',
};

// ---------------------------------------------------------------------------------------------
// THE SHOP'S SECTIONS
// ---------------------------------------------------------------------------------------------

// The shop grew to twenty-six rows across four phases, presented as one flat run in purchase order.
// That is fine while a player is buying the next thing and useless the moment they are looking for
// a PARTICULAR thing — and the commonest reason to go looking is a resource that has stopped
// moving. "I have no Fuel" should land the eye on the Fuel section, not start a scan.
//
// SECTIONS ARE DERIVED FROM WHAT A MODULE DOES, never declared per row. engine/actSevenModules.js
// reads `capacity` and `produces` off the definition and answers with one of these ids; nothing in
// data/actSevenModulesConfig.js carries a category field. A new module lands in the right section
// by virtue of what it produces, and cannot land in the wrong one by being forgotten.
//
// ORDER IS THE DEPENDENCY ORDER OF THE COLONY, not alphabetical and not by price. Salvage pays for
// everything, Power runs everything, Oxygen and Provisions gate the crew, Fuel is the launch
// threshold, and storage is what lets any of it be banked. A player reading top to bottom is
// reading the order in which the colony's problems arrive.
const FAB_SECTIONS = [
  { id: 'salvage', label: 'Salvage', note: 'What pays for everything else.' },
  { id: 'power', label: 'Power', note: 'What everything else runs on.' },
  { id: 'oxygen', label: 'Oxygen', note: null },
  { id: 'provisions', label: 'Provisions', note: null },
  { id: 'fuel', label: 'Fuel', note: 'The launch threshold. Nothing here banks without a tank.' },
  { id: 'storage', label: 'Storage', note: 'Ceilings. A resource at its cap is being thrown away.' },
  // The catch-all. Nothing routes here today; it exists so a module that produces something
  // unexpected is still shown rather than silently dropped from the shop.
  { id: 'other', label: 'Other', note: null },
];

const FAB_SECTION_ORDER = FAB_SECTIONS.map((section) => section.id);

function getFabSection(id) {
  return FAB_SECTIONS.find((section) => section.id === id) || null;
}

module.exports = { fabCopy, FAB_SECTIONS, FAB_SECTION_ORDER, getFabSection };
