// statDeltas are applied (and clamped 0-100) when the camp completes.
// durationSeconds is simulated time, scaled down by modifiers.campSpeedMult.
const CAMP_PROGRAMS = [
  {
    id: 'power_program',
    name: 'Power Program',
    description: 'Heavy lifting and swing mechanics. +Power, -Speed.',
    cost: 300,
    durationSeconds: 300,
    statDeltas: { power: 8, speed: -3 },
  },
  {
    id: 'speed_program',
    name: 'Speed & Agility',
    description: 'Sprint drills and base-running. +Speed, -Power.',
    cost: 300,
    durationSeconds: 300,
    statDeltas: { speed: 8, power: -3 },
  },
  {
    id: 'defense_program',
    name: 'Defensive Fundamentals',
    description: 'Fielding drills and positioning. +Defense, -Contact.',
    cost: 300,
    durationSeconds: 300,
    statDeltas: { defense: 8, contact: -2 },
  },
  {
    id: 'contact_program',
    name: 'Plate Discipline',
    description: 'Batting cage reps and pitch recognition. +Contact, -Defense.',
    cost: 300,
    durationSeconds: 300,
    statDeltas: { contact: 8, defense: -2 },
  },
  {
    id: 'pitching_program',
    name: 'Pitching Lab',
    description: 'Mechanics and pitch-mix work. +Pitching, -Defense.',
    cost: 350,
    durationSeconds: 360,
    statDeltas: { pitching: 10, defense: -2 },
  },
  {
    id: 'balanced_program',
    name: 'Balanced Conditioning',
    description: 'A slower, well-rounded improvement across the board.',
    cost: 500,
    durationSeconds: 480,
    statDeltas: { power: 3, contact: 3, speed: 3, defense: 3, pitching: 3 },
  },
];

// Every string the training-camp screen says about the bench swap. It lives here rather than in
// the panel for the same reason the programs do: the rule the engine enforces and the sentence
// the player reads before tapping Send have to be edited together, and a player who is told the
// wrong thing about a swap discovers it as a mysteriously worse team three games later.
//
// The numbers in these sentences are the POST-swap ones on purpose. A bench outfielder covering
// the mound is rated by engine/strength.js with pitching weighted at 50%, so a left fielder who
// is a perfectly respectable 58 in left is worth about 20 on the mound. Printing their left-field
// rating would read as a fair trade and is precisely the silent weakening this feature exists to
// stop, so `standInRating` below is always the rating at the position being covered.
const CAMP_SWAP_COPY = {
  intro:
    'Sending a starter to camp takes them off the field. Your best available bench player covers the spot ' +
    'while they are away, and hands it straight back when camp ends.',

  benchPlayerIsFree: 'On the bench already — nobody has to cover, and team rating is unchanged.',

  noBench:
    'No bench player is available to cover, so this starter cannot be sent to camp. Send a bench player ' +
    'instead — your team never plays a man down.',

  // `delta` is already signed and rounded by the caller.
  standIn: function standIn(name, fromPosition, coveringLabel, standInRating) {
    return `${name} (${fromPosition}) covers ${coveringLabel} at OVR ${standInRating} while they are away.`;
  },

  teamImpact: function teamImpact(delta) {
    if (delta === 0) return 'Team rating is unchanged for the duration.';
    if (delta < 0) return `Team rating drops ${Math.abs(delta)} for the whole camp — several games' worth.`;
    return `Team rating actually rises ${delta} for the duration.`;
  },

  // Shown on the roster cards, where the two halves of the swap are sitting in the wrong groups
  // (the camper under Bench, the stand-in under Starters) and would otherwise look like a bug.
  awayCoveredBy: function awayCoveredBy(name) {
    return `Off the field — ${name} is covering`;
  },

  coveringFor: function coveringFor(name, positionId) {
    return `Standing in at ${positionId} for ${name}`;
  },

  // The camp screen's version, while the camp is actually running.
  currentlyCovering: function currentlyCovering(standInName, coveringLabel) {
    return `${standInName} is covering ${coveringLabel} and goes back to the bench the moment camp ends.`;
  },
};

module.exports = { CAMP_PROGRAMS, CAMP_SWAP_COPY };
