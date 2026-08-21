// The Sites panel's furniture — every player-facing string the ladder screen draws that is not
// already authored on a site or a pad (PRD §6.4, "Sites — the affiliate ladder. Where am I?").
//
// A COPY OBJECT AND NOTHING ELSE, exactly as data/actSevenFabConfig.js is one. The ladder itself —
// five rungs, five pad tiers, every cost, every upkeep factor and three hundred lines of
// measurement record — is data/actSevenSitesConfig.js, and that file is required by the ENGINE.
// This one is required by a component. Keeping them apart is the same split fab made: the config a
// solve reads and the words a screen says are edited by different people for different reasons, and
// a copy tweak has no business landing in the file that holds the act's tuning record.
//
// THE NAME IS AWKWARD ON PURPOSE. `actSevenSitesConfig.js` was taken by the thing that deserves the
// shorter name, and `sitesCopy` living in `actSevenSitesPanelConfig.js` is clearer than either file
// being called something that does not say "sites". The alternative — folding these strings into
// the ladder — is what the paragraph above rules out.
//
// NOTHING HERE RESTATES A SITE. No name, no `where`, no description, no cost, no rate: those all
// come back off engine/sites.js's rows, resolved from the ladder config on read (Decision 1 of
// openspec/changes/act-seven-site-ladder). This file must never grow a per-site string, because the
// moment it does there are two places to author a site's words and one of them is nowhere near its
// numbers.
const { formatNumber, formatDuration } = require('../utils/formatNumber');

// A rate's magnitude, in the act's house format. Deliberately IDENTICAL to the one
// components/layout/ResourceChips.js and components/expedition/OpsPanel.js use for a net rate: one
// decimal place under 10, `formatNumber` above it. Site upkeep is 0.4 to 240 per second across the
// ladder, so both branches are live — "1.5 Power/s" on the Mound and "240 Power/s" on the Swing.
//
// `formatNumber` alone would be wrong and silently so: it truncates, so the Mound's 0.4 Provisions/s
// would print as "0" and the row would advertise a pad that costs nothing.
function rateMagnitude(perSecond) {
  const magnitude = Math.abs(perSecond);
  return magnitude < 10 ? magnitude.toFixed(1) : formatNumber(magnitude);
}

// The three ladder states, as words. A FUNCTION RATHER THAN A MAP because the reading is ordered —
// colonized implies reached — and writing that order once here beats writing it in the component,
// where it would be a rules question answered in JSX. data/actSevenOpsConfig.js's getDirective() and
// data/actSevenPalette.js's getPhasePill() are the pattern.
//
// The `id` rides along so the stylesheet can key on it without the component mapping words to class
// names, which is the same string-in-a-component bug one layer along.
//
// "Not reached" AND NOT "LOCKED". An unreached site is a destination, not a refusal — nothing about
// it is withheld, the player simply has not flown there yet, and §7.1's ladder is the whole promise
// of the act. A padlock on Ceres would read as a paywall on a place the game is trying to make you
// want.
function statusFor(site) {
  if (site.colonized) return { id: 'colonized', label: 'Colonized' };
  if (site.reached) return { id: 'reached', label: 'Reached — no colony yet' };
  return { id: 'unreached', label: 'Not reached' };
}

const sitesCopy = {
  // The panel's heading, duplicated from the `sites` row in data/actSevenPanels.js for the reason
  // fabCopy.title states: that list is the TAB BAR's source, and a panel reaching into the tab
  // registry for its own <h2> would couple the two so that renaming a tab retitles a screen.
  title: 'Sites',
  subtitle: 'The affiliate ladder, out from the wreck. Every rung is a place, and every place has a bill.',

  // ---------------------------------------------------------------------------------------------
  // THE LADDER HALF — "where am I"
  // ---------------------------------------------------------------------------------------------
  ladderTitle: 'The ladder',
  // Says the two structural rules of §7.1/§7.7 in one line, because both are invisible until they
  // bite: you cannot skip a rung, and a site's crew can only do one thing at a time.
  ladderNote: 'Strictly ordered — you cannot skip a base. One build per site at a time.',

  rungLabel: (rung) => 'Rung ' + rung,

  // §7.4's ONE POOL, stated where it would otherwise be inferred wrongly. Five rows each listing
  // rates is exactly the shape that reads as five stockpiles, and it is not — every rate on this
  // screen lands in one shared network. The Ops panel is where the pool itself is.
  poolNote: 'Every rate below is drawn from the one shared network. There are no per-site stocks.',

  upkeepLabel: 'Upkeep',
  padUpkeepLabel: 'Pad upkeep',
  producesLabel: 'Produces',

  // A drain and a supply, in the act's house shapes. The TRUE MINUS SIGN rather than a hyphen, for
  // the reason OpsPanel's formatNet() gives: a hyphen and a plus at the same size read as different
  // weights, and these two are meant to be told apart by shape at a glance.
  upkeepRate: (rate) => '−' + rateMagnitude(rate.perSecond) + ' ' + rate.label + '/s',
  produceRate: (rate) => '+' + rateMagnitude(rate.perSecond) + ' ' + rate.label + '/s',

  // The pad's whole point. Stated as a RUNG rather than a site name because the top pad reaches past
  // the end of the ladder — §7.1 is explicit that beyond the wall is not a site — so a string that
  // named a destination would have nothing to name there. engine/sites.js's describePadEffect()
  // makes the identical choice for the shop row, and these two must agree.
  reachLabel: (reachesRung) => 'Reaches rung ' + reachesRung,
  // Why the number cannot move. §7.2's sharpest rule, said once at the head of the ladder rather
  // than on every padded row: a starved network launches LATER, never SHORTER. Once, because it is
  // a property of reach itself and not of any one pad — five copies of it would read as five
  // separate reassurances about five separate numbers, which is the opposite of one invariant.
  reachNote: 'Reach is set by the pad you built. Nothing the colony runs short of ever changes it.',

  // A build under way. The name is null for a `buildingId` no pad tier answers to — a retired or
  // hand-edited id, which is reachable in a codebase that never migrates a save — and the fallback
  // says the true thing rather than putting the raw id on screen.
  buildingLabel: (name, seconds) => (name || 'Work under way') + ' — ' + formatDuration(seconds) + ' left',

  // Rendered when resolvedSites() comes back empty, which is every save before Act VII and every
  // save whose act has not yet unlocked the expedition. A heading over nothing is the shape of a
  // bug; one sentence is not.
  emptyLadderNote: 'No ladder yet. It starts at the lot behind the hardware store.',

  // ---------------------------------------------------------------------------------------------
  // THE SHOP HALF — "what can I buy right now"
  // ---------------------------------------------------------------------------------------------
  offersTitle: 'Establish',
  // Names the ordering the rows use, because that ordering is Decision 9 and not a formatting
  // choice: the running cost comes before the capability, every time.
  offersNote: 'What each row costs to keep is on it, before what it buys.',

  costLabel: (cost) => formatNumber(cost) + ' Salvage',
  buildTimeNote: (seconds) => 'Takes ' + formatDuration(seconds) + '.',

  // THE HONEST READING OF TODAY, AND IT MUST STAY HONEST AFTER LAUNCHES LAND. A site is reached only
  // by a launch, so with no burn yet flown there is exactly one colonized site and nothing to
  // establish — and that is the ladder working, not an empty shop. The sentence says what would
  // change it, so a player who reads it knows where to go next, and it stays true forever: the day
  // every rung is colonized and every pad is built, "nothing new is within reach" is still the
  // correct thing to print.
  emptyOffersNote: 'Nothing new is within reach. Fly somewhere, and it will be here waiting.',
};

module.exports = { sitesCopy, statusFor };
