// Field coordinates are on a 0-100 x/y grid matching the FieldView SVG viewBox.
const POSITIONS = [
  { id: 'P', label: 'Pitcher', x: 50, y: 66, isPitcher: true },
  { id: 'C', label: 'Catcher', x: 50, y: 88, isPitcher: false },
  { id: '1B', label: 'First Base', x: 72, y: 66, isPitcher: false },
  { id: '2B', label: 'Second Base', x: 58, y: 50, isPitcher: false },
  { id: '3B', label: 'Third Base', x: 28, y: 66, isPitcher: false },
  { id: 'SS', label: 'Shortstop', x: 38, y: 50, isPitcher: false },
  { id: 'LF', label: 'Left Field', x: 18, y: 30, isPitcher: false },
  { id: 'CF', label: 'Center Field', x: 50, y: 14, isPitcher: false },
  { id: 'RF', label: 'Right Field', x: 82, y: 30, isPitcher: false },
  { id: 'DH', label: 'Designated Hitter', x: 50, y: 96, isPitcher: false, fielder: false },
];

// All 10 are starting lineup spots (DH included); fielder:false just means FieldView
// draws it in the dugout strip instead of on the diamond.
const STARTER_POSITIONS = POSITIONS.map((p) => p.id);
const FIELDING_POSITIONS = POSITIONS.filter((p) => p.fielder !== false).map((p) => p.id);
const BENCH_SLOTS = 5;

module.exports = { POSITIONS, STARTER_POSITIONS, FIELDING_POSITIONS, BENCH_SLOTS };
