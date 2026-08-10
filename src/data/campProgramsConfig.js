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

module.exports = { CAMP_PROGRAMS };
