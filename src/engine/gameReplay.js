// Turns a finished game into a pitch-by-pitch sequence the field view can animate, plus the
// line score that sequence adds up to.
//
// PURELY PRESENTATIONAL. The game was already decided by engine/gameSim.js the moment
// engine/tickEngine.js resolved the slot; nothing here influences the score, and nothing in the
// simulation waits for it. That separation is load-bearing: an eight-hour offline return
// resolves a whole season inside one advance() iteration, and a replay the engine had to await
// would either stall that or have to be skipped — the kind of "animation is now a rule"
// coupling that makes offline catch-up unfixable later.
//
// The innings are made to SUM to the real final score rather than being a sample of it, so the
// box score on screen is the actual result and not a decoration that contradicts it.
const { randInt, pick } = require('../utils/randomUtils');

const INNINGS = 3;

// Base coordinates on the 0-100 viewBox FieldView draws. Index is bases reached: 0 = at the
// plate / retired, 1..3 = first, second, third. A runner who scores returns to the plate.
const BASES = [
  { x: 50, y: 90 },
  { x: 74, y: 64 },
  { x: 50, y: 42 },
  { x: 26, y: 64 },
];

const MOUND = { x: 50, y: 66 };
const PLATE = { x: 50, y: 90 };

// Where a ball ends up, and how far it moves the batter. `bases: 4` is out of the park.
const HITS = [
  { label: 'lines one into left', x: 18, y: 30, bases: 1 },
  { label: 'finds the gap in center', x: 50, y: 14, bases: 2 },
  { label: 'pulls one down the right-field line', x: 82, y: 30, bases: 2 },
  { label: 'chops one past the third baseman', x: 28, y: 66, bases: 1 },
  { label: 'gets every bit of it', x: 50, y: 6, bases: 4 },
];

const OUTS = [
  { label: 'pops it up to short', x: 38, y: 50 },
  { label: 'grounds to second', x: 58, y: 50 },
  { label: 'lines it right at the pitcher', x: 50, y: 66 },
  { label: 'goes down swinging', x: 50, y: 88 },
  { label: 'flies out to center', x: 50, y: 14 },
];

// Pitch beats are short on purpose — the count is texture, and the player is waiting for
// something to happen. The action beat is what holds.
const PITCH_HOLD_MS = 130;
const ACTION_HOLD_MS = 560;
const INNING_HOLD_MS = 360;

// A replay must finish before the next game starts, or the field cuts mid-inning to a new one
// and the box score the player was reading is replaced by a different game's. Three innings of
// a high-scoring game runs well over Act III's 25s game interval at natural pacing, so the
// whole sequence is time-scaled to fit whatever budget the caller has. Pitches keep a floor so
// that compressing never turns the count into an unreadable flicker.
const MIN_PITCH_HOLD_MS = 45;
const DEFAULT_BUDGET_MS = 14000;

function totalHold(beats) {
  return beats.reduce((sum, b) => sum + b.hold, 0);
}

function fitToBudget(beats, budgetMs) {
  if (totalHold(beats) <= budgetMs) return beats;

  const scale = budgetMs / totalHold(beats);
  let scaled = beats.map((b) => ({
    ...b,
    hold: b.type === 'pitch' ? Math.max(MIN_PITCH_HOLD_MS, Math.round(b.hold * scale)) : Math.round(b.hold * scale),
  }));

  // The pitch floor and the rounding can both push back over the line, so the budget would be
  // an aspiration rather than a cap. Pitches are texture — a count the player is waiting to see
  // past — so drop them from the front until it genuinely fits. Actions and inning ends are
  // never dropped: those are the game.
  let i = 0;
  while (totalHold(scaled) > budgetMs && i < scaled.length) {
    if (scaled[i].type === 'pitch') {
      scaled = [...scaled.slice(0, i), ...scaled.slice(i + 1)];
    } else {
      i += 1;
    }
  }
  return scaled;
}

function nameOf(roster, index) {
  const starters = roster.filter((p) => p.isStarter);
  if (starters.length === 0) return 'The kid';
  return starters[index % starters.length].name.split(' ').slice(-1)[0];
}

// A plausible count leading up to whatever already happened. Never a full 3-2 walk unless the
// outcome IS a walk, so the count never contradicts the result it is leading to.
function countBeats(batter, half, inning, outcomeIsWalk) {
  const beats = [];
  let balls = 0;
  let strikes = 0;
  const pitches = outcomeIsWalk ? 4 : randInt(0, 3);

  for (let i = 0; i < pitches; i += 1) {
    const throwBall = outcomeIsWalk ? true : Math.random() < 0.45;
    if (throwBall) balls += 1;
    else if (strikes < 2) strikes += 1;
    else continue; // a foul with two strikes: the count holds
    beats.push({
      type: 'pitch',
      hold: PITCH_HOLD_MS,
      half,
      inning,
      batter,
      balls,
      strikes,
      text: `${balls}-${strikes}`,
    });
  }
  return beats;
}

// One half-inning that scores exactly `runs`, then makes three outs.
function buildHalf(inning, half, isPlayerBatting, runs, roster, batterStart) {
  const beats = [];
  let index = batterStart;
  let scored = 0;
  let outs = 0;

  while (scored < runs) {
    const batter = nameOf(roster, index);
    const hit = pick(HITS);
    beats.push(...countBeats(batter, half, inning, false));
    scored += 1;
    beats.push({
      type: 'action',
      hold: ACTION_HOLD_MS,
      half,
      inning,
      batter,
      kind: 'hit',
      isPlayerBatting,
      ball: { from: MOUND, to: { x: hit.x, y: hit.y } },
      runnerTo: Math.min(4, hit.bases),
      runs: 1,
      outs,
      text: `${batter} ${hit.label} — a run scores.`,
    });
    index += 1;
  }

  while (outs < 3) {
    const batter = nameOf(roster, index);
    const out = pick(OUTS);
    beats.push(...countBeats(batter, half, inning, false));
    outs += 1;
    beats.push({
      type: 'action',
      hold: ACTION_HOLD_MS,
      half,
      inning,
      batter,
      kind: 'out',
      isPlayerBatting,
      ball: { from: MOUND, to: { x: out.x, y: out.y } },
      runnerTo: 0,
      runs: 0,
      outs,
      text: `${batter} ${out.label}. ${outs} down.`,
    });
    index += 1;
  }

  beats.push({
    type: 'inningEnd',
    hold: INNING_HOLD_MS,
    half,
    inning,
    text: `End of the ${half === 'top' ? 'top' : 'bottom'} of the ${inning}${inning === 1 ? 'st' : inning === 2 ? 'nd' : 'rd'}.`,
  });

  return { beats, nextBatter: index };
}

// Distributes `total` runs across INNINGS innings. Weighted toward "not every inning", so a
// 4-run game reads as a rally rather than a metronome.
function spreadRuns(total) {
  const innings = new Array(INNINGS).fill(0);
  for (let r = 0; r < total; r += 1) innings[randInt(0, INNINGS - 1)] += 1;
  return innings;
}

// `game` is { opponentName, isHome, won, scoreFor, scoreAgainst }.
// Home team bats in the bottom half — so which half is "yours" depends on `isHome`, exactly as
// it would in a real box score.
function buildReplay(game, roster, options = {}) {
  const budgetMs = options.budgetMs || DEFAULT_BUDGET_MS;
  const yourRuns = spreadRuns(Math.max(0, game.scoreFor));
  const theirRuns = spreadRuns(Math.max(0, game.scoreAgainst));

  const topRuns = game.isHome ? theirRuns : yourRuns;
  const bottomRuns = game.isHome ? yourRuns : theirRuns;

  const beats = [];
  let batter = 0;
  for (let i = 1; i <= INNINGS; i += 1) {
    const top = buildHalf(i, 'top', !game.isHome, topRuns[i - 1], roster, batter);
    beats.push(...top.beats);
    const bottom = buildHalf(i, 'bottom', game.isHome, bottomRuns[i - 1], roster, top.nextBatter);
    beats.push(...bottom.beats);
    batter = bottom.nextBatter;
  }

  return {
    opponentName: game.opponentName,
    isHome: game.isHome,
    won: game.won,
    scoreFor: game.scoreFor,
    scoreAgainst: game.scoreAgainst,
    innings: INNINGS,
    // The line score, in display order: away team first, exactly like a real one.
    lineScore: {
      away: game.isHome ? theirRuns : yourRuns,
      home: game.isHome ? yourRuns : theirRuns,
      awayName: game.isHome ? game.opponentName : 'You',
      homeName: game.isHome ? 'You' : game.opponentName,
    },
    beats: fitToBudget(beats, budgetMs),
  };
}

module.exports = { buildReplay, spreadRuns, fitToBudget, BASES, MOUND, PLATE, INNINGS, DEFAULT_BUDGET_MS };
