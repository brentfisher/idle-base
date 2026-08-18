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

module.exports = { fabCopy };
