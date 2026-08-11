// Turns a finished game into a short sequence of beats the field view can animate.
//
// PURELY PRESENTATIONAL. The game was already decided by engine/gameSim.js at the moment
// engine/tickEngine.js resolved the slot; nothing here influences the score, and nothing in
// the simulation waits for it. That separation is deliberate and load-bearing: an eight-hour
// offline return resolves a whole season inside one advance() iteration, and a replay that the
// engine had to wait on would either stall that or have to be skipped, which is exactly the
// kind of "animation is now a rule" coupling that makes offline catch-up unfixable later.
//
// So this is a pure function of an already-final result, and the component that plays it is
// free to drop it on the floor.
const { randInt, pick } = require('../utils/randomUtils');

// Where a runner stands at each base, matching the diamond drawn in FieldView's 0-100 viewBox.
const BASES = [
  { x: 50, y: 90 }, // home
  { x: 74, y: 64 }, // first
  { x: 50, y: 42 }, // second
  { x: 26, y: 64 }, // third
];

const HIT_TARGETS = [
  { label: 'a liner into left', x: 18, y: 30, bases: 1 },
  { label: 'a gapper to center', x: 50, y: 14, bases: 2 },
  { label: 'one down the right side', x: 82, y: 30, bases: 1 },
  { label: 'a rope past third', x: 28, y: 66, bases: 1 },
];

const OUT_TARGETS = [
  { label: 'popped up to short', x: 38, y: 50 },
  { label: 'grounded to second', x: 58, y: 50 },
  { label: 'lined right at the pitcher', x: 50, y: 66 },
  { label: 'struck him out looking', x: 50, y: 88 },
];

const MOUND = { x: 50, y: 66 };
const PLATE = { x: 50, y: 90 };

// One beat = one batter. `ball` is where the ball ends up, `runnerTo` how far the batter got.
function hitBeat(batterName) {
  const target = pick(HIT_TARGETS);
  return {
    kind: 'hit',
    text: `${batterName} — ${target.label}.`,
    ball: { from: MOUND, to: { x: target.x, y: target.y } },
    runnerTo: Math.min(3, target.bases),
  };
}

function outBeat(batterName) {
  const target = pick(OUT_TARGETS);
  return {
    kind: 'out',
    text: `${batterName} ${target.label}.`,
    ball: { from: MOUND, to: { x: target.x, y: target.y } },
    runnerTo: 0,
  };
}

function nameOf(roster, index) {
  const starters = roster.filter((p) => p.isStarter);
  if (starters.length === 0) return 'The kid';
  return starters[index % starters.length].name.split(' ').slice(-1)[0];
}

// Builds a half-inning: `runs` scored, then outs until three are recorded. Beat count is
// bounded (three outs plus at most `runs` hits) so a blowout cannot produce an endless replay.
function buildHalf(label, runs, roster, startIndex) {
  const beats = [];
  const hits = Math.min(runs, 4);
  let index = startIndex;

  for (let i = 0; i < hits; i += 1) {
    beats.push({ ...hitBeat(nameOf(roster, index)), half: label });
    index += 1;
  }
  for (let outs = 0; outs < 3; outs += 1) {
    beats.push({ ...outBeat(nameOf(roster, index)), half: label });
    index += 1;
  }
  return beats;
}

// `game` is { opponentName, isHome, won, scoreFor, scoreAgainst }.
// Returns { beats, ... } with one half-inning per side — the "at least one inning once per
// side" the field view plays through after each result.
function buildReplay(game, roster) {
  const topLabel = game.isHome ? `${game.opponentName} batting` : 'Your side batting';
  const bottomLabel = game.isHome ? 'Your side batting' : `${game.opponentName} batting`;

  // Runs shown per half are a slice of the final score, not the whole thing: this is one
  // inning of a game that went several, so it should read as a sample, not a recap.
  const yourHalfRuns = Math.max(0, Math.min(game.scoreFor, randInt(0, 2)));
  const theirHalfRuns = Math.max(0, Math.min(game.scoreAgainst, randInt(0, 2)));

  const topRuns = game.isHome ? theirHalfRuns : yourHalfRuns;
  const bottomRuns = game.isHome ? yourHalfRuns : theirHalfRuns;

  return {
    opponentName: game.opponentName,
    won: game.won,
    scoreFor: game.scoreFor,
    scoreAgainst: game.scoreAgainst,
    beats: [...buildHalf(topLabel, topRuns, roster, 0), ...buildHalf(bottomLabel, bottomRuns, roster, 4)],
  };
}

module.exports = { buildReplay, BASES, MOUND, PLATE };
