// The Launch panel's furniture — every player-facing string the commit screen draws that is not
// already authored on an offer row (PRD §6.4, "Launch — the Fuel threshold. Can I go?").
//
// A COPY OBJECT AND NOTHING ELSE, the same split data/actSevenSitesPanelConfig.js makes against
// data/actSevenSitesConfig.js. data/actSevenLaunchConfig.js is required by the ENGINE: it holds the
// transit windows, the overshoot slopes and the shop's own prose. This one is required by a
// COMPONENT. They are edited by different people for different reasons, and a copy tweak has no
// business landing in the file that carries the act's pacing measurements.
//
// NOTHING HERE RESTATES A NUMBER. No threshold, no transit window, and above all NO 1.6 — the tank
// ceiling arrives on the offer row as `tankCeiling`, out of the same expression in
// engine/launch.js's overshootFor() that CLAMPS the spend. Ledger R1 derives the band from the
// threshold precisely so the two cannot drift, and a component or a copy file that multiplied by
// 1.6 itself would recreate the drift one layer along, where no measurement would catch it.
const { formatNumber, formatDuration } = require('../utils/formatNumber');
// The first tank, BY NAME, from the file that names it. The no-tank sentence below has to tell the
// player what to go and buy, and the alternative — typing 'Fuel Bladder' here — would make
// data/actSevenModulesConfig.js's row and this line two authors of one module's name.
const { getModuleDefinition } = require('./actSevenModulesConfig');

const FIRST_FUEL_TANK = getModuleDefinition('fuelBladder');

// A Fuel figure. `formatNumber` alone, because Fuel runs 400 to 67,200 across the act and never
// arrives as a fraction — a launch threshold is a whole number by construction and the tank it is
// measured against is 1.6 of one. Deliberately the same formatter the header chips and the shop
// rows use, so a tank reading "6.72K" here reads "6.72K" there.
function fuel(amount) {
  return formatNumber(amount);
}

// The overshoot, as the player meets it: "1.25x". Two decimals at most and trailing zeroes dropped,
// because the ratio is continuous — engine/launch.js reads §7.5's table as a line rather than a
// staircase — so it is almost never a round tenth, and "1.2500x" would print precision the decision
// does not have.
function ratio(overshootRatio) {
  return (Math.round(overshootRatio * 100) / 100) + 'x';
}

function percent(fraction) {
  return Math.round(fraction * 100) + '%';
}

const launchPanelCopy = {
  // Duplicated from the `launch` row in data/actSevenPanels.js for the reason every other Act VII
  // panel's copy file states: that list is the TAB BAR's source, and a panel reaching into the tab
  // registry for its own <h2> would couple the two so that renaming a tab retitles a screen.
  title: 'Launch',
  subtitle: 'One threshold, one destination, and the decision of when to stop filling.',

  // ---------------------------------------------------------------------------------------------
  // THE TANK THAT DOES NOT EXIST YET
  //
  // §5.5 and ledger R1: Fuel's base capacity is 0, so before the first tank Fuel is not merely
  // scarce, it is DISCARDED as fast as it is made. That is the single fact gating the whole launch
  // system and it is invisible everywhere else — the Ops panel prints "0/0", which is correct and
  // says nothing about why. This block is where the act explains itself.
  // ---------------------------------------------------------------------------------------------
  noTankTitle: 'Nothing here holds propellant',
  noTankLines: [
    'The wreck has no tank. Fuel is being made and thrown away at the same rate, and the ceiling is not low — it is zero.',
    'Until that changes the threshold below is not a target. It is not reachable at all.',
  ],
  // Names the row to go and buy and the bench it is on. The label is read from the module ladder
  // rather than typed, so a rename moves this sentence with it.
  noTankFix: 'The ' + (FIRST_FUEL_TANK ? FIRST_FUEL_TANK.label : 'first tank') + ' is on the Fab bench. Nothing counts until one is built.',

  // ---------------------------------------------------------------------------------------------
  // THE THRESHOLD AND THE BAND (§7.3)
  //
  // The band is the story of this panel. A screen that printed "1,500 / 1,200 — ready" would be
  // accurate and would delete the act's most consequential decision, because the decision is not
  // WHETHER to go, it is WHEN — and "when" only exists if the player can see the room above the
  // line they have already crossed.
  // ---------------------------------------------------------------------------------------------
  bandTitle: 'The Fuel tank',
  heldLabel: 'In the tank',
  thresholdLabel: 'Threshold',
  ceilingLabel: 'Tank ceiling',

  // The three band figures, unitless. The unit is said once in the heading above them rather than
  // three times across one line — `1.50K Fuel / 1.20K Fuel / 1.92K Fuel` is the same fact printed
  // three times and reads as three unrelated quantities.
  fuelFigure: (amount) => fuel(amount),

  // Said once, at the head of the band, because it is a property of the band and not of any one
  // number on it.
  bandNote: 'Anything above the threshold is surplus, and surplus buys a shorter burn and cargo margin on arrival. The tank stops at the ceiling.',

  // The destination, and the fact that nobody chose it. §7.1's ladder is strictly ordered, so there
  // is exactly one legal destination at every instant of the run — which is what makes one-burn-at-
  // a-time a consequence rather than a rule anyone enforces, and it is worth the player knowing.
  destinationLabel: 'Next',
  destinationNote: 'The ladder is strictly ordered. There is only ever one place to go next.',

  // What the surplus has actually bought, at the fill the player is looking at right now. Every
  // figure is the engine's; this assembles no arithmetic of its own.
  buysTitle: 'What the surplus buys',
  // At the floor there is nothing to itemise, and a list of zeroes reads as a broken feature rather
  // than as a burn leaving on the minimum. engine/launch.js's `effect` string omits the clause for
  // the same reason and this is that decision held on the second surface.
  buysNothing: 'Nothing yet. At the threshold exactly, a burn pays the full window and arrives with no margin.',
  buysTransit: (transitSeconds, baseTransitSeconds) => (
    'Transit ' + formatDuration(transitSeconds) + ' instead of ' + formatDuration(baseTransitSeconds)
    + ' — ' + percent(1 - transitSeconds / baseTransitSeconds) + ' shorter.'
  ),
  buysGrant: (arrivalGrant) => 'Arrives with ' + formatNumber(arrivalGrant) + ' Salvage of cargo margin.',
  buysRatio: (overshootRatio) => 'Filled to ' + ratio(overshootRatio) + ' of the threshold.',
  // The last burn buys the shorter window and no Salvage, and that is correct twice over: nobody
  // colonizes the Wall, and there is no colony left to spend a grant on. Said in words rather than
  // left as a missing line, because an absent grant on the one burn that matters most would read as
  // a bug at the exact moment the player is reading hardest.
  buysNoGrant: 'No cargo margin on this one — there is nothing at the other end to unload onto.',

  // ---------------------------------------------------------------------------------------------
  // THE COMMIT
  //
  // §7.3's irreversible spend, on §6.4's CallUpModal precedent: the button that spends does not
  // spend, it opens a surface that says what is about to happen in full.
  // ---------------------------------------------------------------------------------------------
  commitLabel: 'Commit the burn',

  // THE SENTENCE THAT MUST BE TRUE IN BOTH STATES, and the wording is load-bearing rather than
  // careful. §7.3's phrase is "committing dumps the whole tank", where TANK means the launch tank —
  // the band — and not everything the player holds. Once §5's Cryo rows are built the colony's Fuel
  // ceiling runs well past the band (engine/launch.js measures 131,440 against a 42,000 threshold),
  // and the spend is clamped so that the excess SURVIVES. "Committing spends everything you have"
  // would be false the moment a Cryo Tank exists, and false in the direction that makes a shipped
  // module look like a trap.
  spendNote: 'Committing dumps the launch tank — everything up to the ceiling, not just the threshold. There is no change.',
  // Shown only when there is genuinely more Fuel than the band can hold. The reassurance is real:
  // what is above the tank was never in it, and it is waiting at the next rung as a head start.
  surplusStaysNote: (amount) => fuel(amount) + ' Fuel is above the ceiling and stays behind. It will be waiting when you land.',

  confirm: {
    title: 'Commit the burn',
    // Second person, flat, operational — §10.1's Office voice describing something enormous as a
    // routine movement between affiliates. Nothing here reaches for awe.
    prose: (row) => {
      const lines = [
        'Burning for ' + row.destinationLabel + ', out of ' + row.originLabel + '.',
        'This spends ' + fuel(row.fuelSpent) + ' Fuel — the whole launch tank, not the '
          + fuel(row.fuelRequired) + ' threshold. There is no change and there is no recall.',
        'Transit is ' + formatDuration(row.transitSeconds) + '. Nothing you do in that window changes where it lands.',
      ];
      if (row.arrivalGrant > 0) {
        lines.push('It arrives with ' + formatNumber(row.arrivalGrant) + ' Salvage of cargo margin.');
      }
      return lines;
    },
    acceptLabel: 'Burn',
    declineLabel: 'Keep filling',
  },

  // ---------------------------------------------------------------------------------------------
  // IN FLIGHT (§7.3, §4)
  //
  // A burn under way is a `resolved: false` record and nothing else — there is no status field and
  // no second slot. The panel says so in words because §7.6 asks the transit to be an honest
  // invitation to close the tab, and a player can only take that invitation if they believe the
  // clock is not theirs to protect.
  // ---------------------------------------------------------------------------------------------
  inFlightTitle: 'Under way',
  inFlightLeg: (originLabel, destinationLabel) => originLabel + ' → ' + destinationLabel,
  remainingLabel: (seconds) => formatDuration(seconds) + ' out',
  // The corrupt-record and step-boundary case. engine/launch.js resolves a due burn on the very next
  // tick, so this is a word the player sees for at most one frame — and it is the true one.
  landingLabel: 'Landing',
  inFlightSpent: (fuelSpent, overshootRatio) => fuel(fuelSpent) + ' Fuel spent, at ' + ratio(overshootRatio) + '.',
  inFlightGrant: (arrivalGrant) => 'Carrying ' + formatNumber(arrivalGrant) + ' Salvage of margin.',

  // §7.2's SHARPEST RULE, said on the one screen where a worried player would most expect it to be
  // false. Reach is a function of the built pad tier alone; a starved network launches LATER and
  // never SHORTER, and nothing that happens to the colony during a transit can touch a burn already
  // in the air.
  inFlightSafeNote: 'It is out of the colony’s hands now. Running short of anything here delays the NEXT burn; it cannot shorten, divert or lose this one.',
  inFlightOneNote: 'One at a time. The next destination opens when this one lands.',

  // ---------------------------------------------------------------------------------------------
  // NOTHING TO SHOW
  // ---------------------------------------------------------------------------------------------
  // Reached when there is no leg and nothing in the air — every save before Act VII, and the run
  // that has already thrown its last burn and watched it land. A heading over nothing is the shape
  // of a bug; one sentence is not.
  emptyNote: 'Nothing to throw. There is no burn on the board.',
  // The same state, once the run has won. Distinguished because "nothing on the board" reads as a
  // failure and this is the opposite of one — the ladder is finished, and §7.8's ending is on the
  // Standings tab.
  finishedNote: 'The last one is away and it landed. There is nowhere further to throw from here.',
};

module.exports = { launchPanelCopy };
