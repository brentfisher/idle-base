// Everything you own that helps you play. Act I's three starter items are the act's exit
// gate (140 caps total, PRD §5); Act II's gear extends the same list, so "kit quality" is
// one number that grows across both acts and feeds wall-ball as the player's strength.

const KIT_ITEMS = [
  { id: 'ball', name: 'Ball', description: 'Scuffed, but it’s round.', cost: 25, strength: 8, act: 0 },
  { id: 'glove', name: 'Glove', description: 'Someone else’s initials on the strap.', cost: 40, strength: 10, act: 0 },
  { id: 'bat', name: 'Bat', description: 'Aluminum. Slightly bent. Yours.', cost: 75, strength: 12, act: 0 },

  {
    id: 'freshTape',
    name: 'Fresh Tape',
    description: 'A re-taped ball comes off the bricks true.',
    cost: 250,
    strength: 3,
    act: 1,
  },
  {
    id: 'chalkBox',
    name: 'Chalk Box',
    description: 'Your own strike zone, drawn where you like it.',
    cost: 600,
    strength: 4,
    act: 1,
  },
  {
    id: 'wallRights',
    name: 'Wall Rights',
    description: 'The good stretch of brick, and everyone knows it.',
    cost: 1400,
    strength: 5,
    act: 1,
  },
];

const STARTER_KIT_IDS = KIT_ITEMS.filter((item) => item.act === 0).map((item) => item.id);

function getKitItem(itemId) {
  return KIT_ITEMS.find((item) => item.id === itemId) || null;
}

function kitItemsForAct(actIndex) {
  return KIT_ITEMS.filter((item) => item.act === actIndex);
}

module.exports = { KIT_ITEMS, STARTER_KIT_IDS, getKitItem, kitItemsForAct };
