// AI opponents that fill out the league alongside the player's team. Sized generously
// (up to a 20-team league, e.g. the Expansion era's 16) with a numbered fallback beyond that.
const AI_TEAM_NAMES = [
  'Harbor City Anchors',
  'Redrock Rattlers',
  'Millbrook Foxes',
  'Sunset Bay Marlins',
  'Ironvale Smiths',
  'Prairie Wind Hawks',
  'Cascade Loggers',
  'Golden Plains Bison',
  'Stonebridge Miners',
  'Bluff County Wolves',
  'Emberfield Comets',
  'Copperline Kestrels',
  'Driftwood Pelicans',
  'Northgate Sentinels',
  'Sable Ridge Coyotes',
  'Cinderbrook Foundry',
  'Palmetto Row Gators',
  'Wintergreen Otters',
  'Flint Hollow Badgers',
  'Amberfield Locomotives',
];

function getAiTeamName(index) {
  return AI_TEAM_NAMES[index] || `Team ${index + 1}`;
}

module.exports = { AI_TEAM_NAMES, getAiTeamName };
