// Act I — The Vacant Lot. Every Act I cost and rate lives here (PRD §5); nothing is
// inlined into components or engine code.
//
// The collector tiers (Kid Brother, Wagon) are in data/collectorTiers.js instead, because
// engine/income.js owns the `collectors` contributor and reads them directly.

// Permanent upgrades to clicker.perClick.
const CLICK_UPGRADES = [
  {
    id: 'sharperEyes',
    name: 'Sharper Eyes',
    description: 'You learn the particular glint a bottle cap makes under two inches of dust.',
    cost: 60,
    perClickBonus: 1,
  },
];

// Owning all three ends the act (see the exit predicate in data/acts.js).
const STARTER_KIT_ITEMS = [
  {
    id: 'ball',
    name: 'Ball',
    description: 'Scuffed, a little lopsided, and yours.',
    cost: 25,
  },
  {
    id: 'glove',
    name: 'Glove',
    description: "Somebody's older brother outgrew it. The pocket is already broken in.",
    cost: 40,
  },
  {
    id: 'bat',
    name: 'Bat',
    description: 'Thirty-one inches of taped-up ash. It rings when you hit one right.',
    cost: 75,
  },
];

const ACT_ONE = {
  // Label on the manual income button while in Act I. From Act II it becomes "Hustle"
  // (data/acts.js) — the button itself is never removed. See PRD §6.4.
  clickLabel: 'Search the lot',
  clickFlavor: 'Kneel down, sift the dirt, pocket what shines.',

  // Progressive reveal, so a fresh game shows the click button and nothing else.
  // Both rules are monotone in quantities that only ever grow, so nothing un-reveals when
  // the player spends: the first collector appears once they are halfway to affording it,
  // and buying any collector opens the rest of the lot.
  firstOfferRevealAtFraction: 0.5,
};

module.exports = { CLICK_UPGRADES, STARTER_KIT_ITEMS, ACT_ONE };
