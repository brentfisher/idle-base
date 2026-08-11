// Act III — Little League. Every Act III number lives here; engine/littleLeague.js contains
// the rules and none of the tuning.
//
// The league's *shape* (team count, games, pacing, no postseason) is declared as act rules in
// data/acts.js, because those override balanceConfig through resolveRules(). What lives here is
// what has no balanceConfig equivalent: who the player's first real team actually is.

// The kids the player takes the field with are the same quality as the crew they recruited off
// the wall (data/wallBallConfig.js CREW_QUALITY_MULT), so a promoted crew member is not visibly
// worse than the teammates who turn up alongside them. Change these together or the crew — the
// three players the act before earned — become the weakest names on the sheet.
const LITTLE_LEAGUE_QUALITY_MULT = 0.5;
const LITTLE_LEAGUE_AGE_RANGE = [9, 12];

// Little league benches are short. This is deliberately below balanceConfig-era BENCH_SLOTS (5):
// the roster screen at this scale should read as a handful of kids, not a farm system. Leftover
// crew members are added on top of this, so a player who recruited three infielders still keeps
// all three.
const LITTLE_LEAGUE_BENCH_SLOTS = 2;

// How a promoted crew member is credited on the roster screen, replacing the 'wallBall' tag
// they carried in state.crew.
const PROMOTED_ACQUIRED_VIA = 'crew';

module.exports = {
  LITTLE_LEAGUE_QUALITY_MULT,
  LITTLE_LEAGUE_AGE_RANGE,
  LITTLE_LEAGUE_BENCH_SLOTS,
  PROMOTED_ACQUIRED_VIA,
};
