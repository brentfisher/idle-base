const balanceConfig = require('../data/balanceConfig');
const { createPlayer } = require('./playerFactory');

// Run once per offseason transition, and ONLY from the act that unlocks retirement onward —
// engine/tickEngine.js owns that gate. It matters that the gate skips this whole function
// rather than just the replacement branch: `seasonsPlayed` accumulates on the line below, so
// gating the branch alone would let every player quietly reach their threshold during the
// acts before, and then retire the entire roster at once the moment the unlock lands.
//
// Ages every player a season; anyone who hits their retireAtSeasons threshold is replaced
// in-place by a freshly generated rookie.
//
// `rookieAgeRange` is resolved rather than read from balanceConfig: Act IV's replacements are
// twelve-year-olds aging into travel ball, not the 20-22 year olds a franchise signs. The
// range is passed through modifiers.rules like retireAtSeasonsRange already is, and falls back
// to balanceConfig for any caller without resolved rules to hand.
function checkRetirements(roster, modifiers, retireAtSeasonsRange) {
  const rookieAgeRange = (modifiers.rules && modifiers.rules.rookieAgeRange) || balanceConfig.rookieAgeRange;
  const retired = [];
  const rookies = [];

  const nextRoster = roster.map((player) => {
    const seasonsPlayed = player.seasonsPlayed + 1;
    if (seasonsPlayed >= player.retireAtSeasons) {
      retired.push({ id: player.id, name: player.name, position: player.position });
      const rookie = createPlayer(player.position, {
        isStarter: player.isStarter,
        qualityMult: modifiers.rookieQualityMult,
        ageRange: rookieAgeRange,
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
