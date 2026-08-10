// Act II — Off the Wall. Odds and costs only; the resolution logic is engine/wallBall.js.
//
// Approaches are expressed as a *strength delta*, not as a hard-coded probability, so the
// single Elo model in engine/gameSim.js stays the only probability model in the game.
// With balanceConfig.eloK = 15 and the effective gap clamped to STRENGTH_GAP_BAND:
//
//   gap  7 (worst geared state) -> safe .880  normal .745  showboat .595  (40.5% loss)
//   gap  9 (typical)            -> safe .910  normal .800  showboat .666  (33.4% loss)
//   gap 11 (best geared state)  -> safe .930  normal .845  showboat .731  (26.9% loss)
//
// Showboat therefore sits at "roughly a 35% loss rate" across the whole act rather than at
// one gear level — which is the point of the band. Without it, an un-geared player facing a
// late challenger would see Showboat lose ~70% of the time.

const { kitItemsForAct } = require('./kitConfig');

// Effective strength gap fed to winProbability(), clamped so the act can never become
// unwinnable (no gear) or trivial (fully geared against the first kid).
const STRENGTH_GAP_BAND = [7, 11];

// Kit quality is the player's strength. Crew members shag balls and talk trash.
const CREW_STRENGTH_PER_MEMBER = 1.5;

const APPROACHES = [
  {
    id: 'safe',
    name: 'Safe',
    description: 'Short hops off the low bricks. Boring, and it works.',
    strengthDelta: 6,
    payoutMult: 0.5,
    respectOnWin: 1,
    cooldownSeconds: 18,
  },
  {
    id: 'normal',
    name: 'Normal',
    description: 'Play it straight. Take the rally where it goes.',
    strengthDelta: 0,
    payoutMult: 1.2,
    respectOnWin: 2,
    cooldownSeconds: 24,
  },
  {
    id: 'showboat',
    name: 'Showboat',
    description: 'Behind the back, off the drainpipe, no look. The block will talk about it either way.',
    strengthDelta: -4.5,
    payoutMult: 3,
    respectOnWin: 4,
    cooldownSeconds: 36,
  },
];

// Added to the approach cooldown after a loss — the sting is time, not a deeper cap loss,
// because deepening the cap loss is exactly what the anti-softlock invariant forbids.
const LOSS_COOLDOWN_PENALTY_SECONDS = 10;

// Indexed by wins so the act has an arc; extrapolated past the authored list.
const CHALLENGERS = [
  { id: 'squints', name: 'Squints', strength: 21, taunt: 'Bet you can’t hit the box twice.' },
  { id: 'dot', name: 'Dot Kowalski', strength: 23, taunt: 'My brother says you throw like a mailbox.' },
  { id: 'benny', name: 'Benny Two-Gloves', strength: 26, taunt: 'I brought both gloves. Figure it out.' },
  { id: 'ruthie', name: 'Ruthie from Third', strength: 29, taunt: 'You’re standing on my chalk.' },
  { id: 'moose', name: 'Moose', strength: 32, taunt: 'I don’t miss the wall. Ever.' },
  { id: 'thePaperboy', name: 'The Paperboy', strength: 35, taunt: 'I throw four hundred of these before breakfast.' },
];

const CHALLENGER_EXTRAPOLATION_STEP = 3;

function getChallenger(index) {
  if (index < CHALLENGERS.length) return CHALLENGERS[index];
  const last = CHALLENGERS[CHALLENGERS.length - 1];
  const extraSteps = index - (CHALLENGERS.length - 1);
  return {
    ...last,
    id: `${last.id}_${extraSteps}`,
    name: `${last.name} (rematch ${extraSteps})`,
    strength: last.strength + CHALLENGER_EXTRAPOLATION_STEP * extraSteps,
  };
}

// Wagering bounds. See the invariant block at the top of engine/wallBall.js.
const STAKE_FRACTION_CAP = 0.25;
const MIN_STAKE = 5;
const MIN_CAPS_TO_CHALLENGE = Math.ceil(MIN_STAKE / STAKE_FRACTION_CAP); // 20

// Respect thresholds at which the next neighborhood kid joins the crew. Tuned so crew
// recruitment lands near the flat point (~6-8 rally attempts) on a Showboat-leaning line
// and a little later on a Normal-leaning one.
const CREW_RESPECT_THRESHOLDS = [7, 16, 28];

const CREW_POSITIONS = ['CF', 'SS', '1B', 'C', 'LF', '3B'];

// The stat each crew position shows — a crew member is a full player object with exactly
// one stat surfaced, not a parallel entity type.
const CREW_VISIBLE_STAT = {
  CF: 'speed',
  SS: 'defense',
  '1B': 'power',
  C: 'defense',
  LF: 'contact',
  '3B': 'power',
};

// Neighborhood kids, not prospects.
const CREW_QUALITY_MULT = 0.6;

// The wallBallDues income contributor (engine/income.js): a small caps trickle.
const WALL_BALL_DUES = { base: 0.25, perCrewMember: 0.15 };

const WALL_BALL_GEAR = kitItemsForAct(1);

module.exports = {
  APPROACHES,
  CHALLENGERS,
  getChallenger,
  STRENGTH_GAP_BAND,
  CREW_STRENGTH_PER_MEMBER,
  LOSS_COOLDOWN_PENALTY_SECONDS,
  STAKE_FRACTION_CAP,
  MIN_STAKE,
  MIN_CAPS_TO_CHALLENGE,
  CREW_RESPECT_THRESHOLDS,
  CREW_POSITIONS,
  CREW_VISIBLE_STAT,
  CREW_QUALITY_MULT,
  WALL_BALL_DUES,
  WALL_BALL_GEAR,
};
