const balanceConfig = require('../data/balanceConfig');
const { createPlayer } = require('./playerFactory');

// Run once per offseason transition. Ages every player a season; anyone who hits their
// retireAtSeasons threshold is replaced in-place by a freshly generated rookie.
function checkRetirements(roster, modifiers, retireAtSeasonsRange) {
  const retired = [];
  const rookies = [];

  const nextRoster = roster.map((player) => {
    const seasonsPlayed = player.seasonsPlayed + 1;
    if (seasonsPlayed >= player.retireAtSeasons) {
      retired.push({ id: player.id, name: player.name, position: player.position });
      const rookie = createPlayer(player.position, {
        isStarter: player.isStarter,
        qualityMult: modifiers.rookieQualityMult,
        ageRange: balanceConfig.rookieAgeRange,
        retireAtSeasonsRange,
        seasonsPlayed: 0,
        acquiredVia: 'rookie',
      });
      rookies.push(rookie);
      return rookie;
    }
    return { ...player, seasonsPlayed };
  });

  return { roster: nextRoster, retired, rookies };
}

module.exports = { checkRetirements };
