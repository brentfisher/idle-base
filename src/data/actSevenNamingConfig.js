// THE ACT VII NAMING CONVENTION (PRD §10.5), published so that every invented name across §5, §7,
// §8 and §9 can be checked against it in one read.
//
// THE POINT, STATED ONCE: the alien program's vocabulary is ENTIRELY the scouting-and-farm-system
// vocabulary the player already spent six acts inside. Act VII does not introduce a science
// fiction lexicon and then wink at baseball; it discovers that the baseball lexicon was the
// operational one all along. That is why the reveal costs nothing to explain — the player has been
// fluent since Act I.
//
// THE ONE PROHIBITION: no name in Act VII may be a word the sport does not already own. If a
// proposed name would be at home in any other space game, it is wrong, and the banks below almost
// certainly have a better one. "Reactor", "hydroponics bay", "solar array", "cryo module" are all
// failures of this rule — which is worth saying plainly, because several of them are currently in
// data/actSevenModulesConfig.js and are the first thing a renaming pass should take.
//
// These banks are REFERENCE, not wiring. Nothing imports them to build a name at runtime; they
// exist so that a person authoring the next site or contract picks from the same well as the last
// one, and so that a reviewer can tell in one read whether a new name belongs.

// Sites are affiliates, named `<Class> — <Place>`. The classification ladder IS the site ladder,
// which is why the final phase is already called `majors`. Class is the Office's word; the place
// name is the territory's.
const SITE_CLASS_BY_PHASE = {
  aftermath: 'Rookie',
  lifeSupport: 'Rookie',
  lunar: 'Class A',
  deepSpace: 'Double-A',
  majors: 'The Show',
};

const SITE_PLACE_NAMES = {
  aftermath: ['the Yard', 'Home Site', 'Affiliate 9'],
  lifeSupport: ['the Backfields', 'the Cage', 'Vine Street Works'],
  lunar: ['Tranquility Yard', 'the Short Field', 'Dorsey Station'],
  deepSpace: ['the Long Field', 'Warning Track', 'Foul Pole', 'the Gap', 'Deep Left'],
  majors: ['the Heliopause', 'Over the Wall'],
};

// Modules are ballpark furniture and staff roles — never "reactor", never "hydroponics bay". The
// anchor is already fixed by the design's pillar 5: a generator is a bullpen.
const MODULE_NAMES = [
  'Bullpen',          // power
  'Tarp',             // oxygen retention
  'Grounds Crew',     // provisions
  'Water Tower',      // tank
  'Clubhouse',        // crew capacity
  'Batting Cage',     // repair / throughput
  'On-Deck Circle',   // queue / pre-stage
  'Dugout',           // shelter / storage
  'Rosin Bag',
  'Pine Tar',
  'The Rake',
];

// Artifacts are things an umpire, a scorer or a coach carries. Never a "relic" and never a
// "device" — the objects in this act are all paperwork and equipment, because the civilisation
// that left them ran a development program, not an empire.
const ARTIFACT_NAMES = [
  'The Rulebook',
  'Ground Rules',
  'The Signal Set',
  'The Pitch Clock',
  'Insertion Tolerance Card',
  'The Scorecard',
  'The Lineup Card',
  'The Indicator',
  'The Foul Lines',
  'The Infield Fly',
];

// Contracts are organisational paperwork, and this bank is deliberately deep enough to keep
// feeding the endless `majors` phase without repeating.
const CONTRACT_NAMES = [
  'Spring Invitation',
  'Backfield Work',
  'Bus Trip',
  'Innings Limit',
  'Rehab Assignment',
  'Doubleheader',
  'Rain Delay',
  'Waiver Claim',
  'Player To Be Named Later',
  'Pitch Count',
  'Rule 5 Draft',
  'Makeup Game',
  'Organizational Depth',
  // Unspent, held in reserve for the endless phase.
  'Option Year',
  'Bonus Clause',
  'Roster Crunch',
  'Two-Way Deal',
  'Callup Order',
  'Sent Down',
  'Designated for Assignment',
  'Extended Spring',
  'Instructional League',
  'The Forty-Man',
];

module.exports = {
  SITE_CLASS_BY_PHASE,
  SITE_PLACE_NAMES,
  MODULE_NAMES,
  ARTIFACT_NAMES,
  CONTRACT_NAMES,
};
