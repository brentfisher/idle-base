// What a run adds up to. Pure — no React, no DOM, no storage — and it STORES NOTHING (PRD §3.3).
//
// DERIVED, NEVER ACCUMULATED, which is the same contract engine/bookie.js keeps with its prop board
// ("the board is DERIVED, never stored"). A record card holds facts: seconds per act, the ids
// earned, whether the run finished. The number is computed on read, every read. An incrementally
// accumulated score cannot be audited against the facts it claims to summarise, cannot be re-tuned
// after the fact, and drifts — and drift in a leaderboard entry is indistinguishable from cheating
// (PRD §3.1), which is the one thing a shared board cannot afford to be ambiguous about.
//
// The consequence to protect: editing data/scoreConfig.js re-scores every run ever played, live,
// including the ones already on the board.
const { PAR, WEIGHT, SPEED_CAP, FLOOR } = require('../data/scoreConfig');
const { getAchievement } = require('../data/achievementsConfig');

// Every act the odyssey has, in order. Derived from the config rather than from FINAL_ACT_INDEX so
// that this file has no opinion about progression — a run is scored on the acts the tuning table
// knows how to price.
const ACT_INDICES = Object.keys(PAR).map(Number).sort((a, b) => a - b);

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// A duration the run could actually have taken. Anything else — a missing key, a string, a NaN, a
// negative from a hand-edited save — is NOT a zero-second act, and the distinction is the whole
// reason this function exists rather than a `|| 0`. Zero would be the best time in the game.
function usableSeconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

// One act's contribution. Par scores exactly WEIGHT[act]; half par scores double, subject to
// SPEED_CAP; twice par scores half. Never negative, because a slow run is a worse run and not a
// penalty against the rest of the card.
function actPointsFor(actIndex, seconds) {
  const par = PAR[actIndex];
  const weight = WEIGHT[actIndex];
  if (!(par > 0) || !(weight > 0)) return 0;
  const ratio = par / Math.max(seconds, FLOOR);
  return Math.round(weight * clamp(ratio, 0, SPEED_CAP));
}

// The ids earned IN THIS RUN, priced from data/achievementsConfig.js.
//
// THE RUN'S SET AND NOT THE CAREER'S (PRD §6). Achievements are career-scoped and stay earned
// forever, which is right for a collection and wrong for a board: a veteran's fresh run would
// otherwise open carrying forty points of other runs' history and outscore a newcomer who played
// better. The caller passes `record.achievements`; if it hands over the career set instead, this
// function cannot tell — which is why the rule is stated at both ends.
//
// An unknown id scores 0 rather than throwing: a card written before an achievement was renamed
// must still score, and a run should never be unscoreable because the config moved underneath it.
function achievementPointsFor(ids) {
  if (!Array.isArray(ids)) return 0;
  return ids.reduce((sum, id) => {
    const achievement = getAchievement(id);
    return sum + (achievement ? achievement.points : 0);
  }, 0);
}

// THE SCORE, AND WHY IT IS NOT A BARE NUMBER. A card with gaps in it — an act cleared before the
// record card existed, so its duration was never taken (PRD §4) — is not comparable to a complete
// one, and a function that returned only a total would let every caller lose that fact on the way
// to a leaderboard row. So `partial` comes back beside the number and the rows that could not be
// scored are named.
//
// An act is UNRECORDED, not zero, when a later act was recorded and this one was not: reaching act
// 3 means acts 0-2 happened, whatever the card says about them. That is the only way to tell
// "played but not timed" from "not yet played", and it is what makes a save that predates
// STORY-041 legible rather than silently the fastest run in the game.
//
// TOTAL BY CONSTRUCTION: every input path returns a finite number. A `{}` card scores 0 and is not
// partial (nothing was skipped — nothing happened yet); a corrupt duration is unrecorded; a
// zero-second act is floored, not divided by.
function runScore(record) {
  const card = record || {};
  const actSeconds = (card.actSeconds && typeof card.actSeconds === 'object') ? card.actSeconds : {};

  const scored = {};
  let recordedCount = 0;
  let highestRecorded = -1;
  ACT_INDICES.forEach((actIndex) => {
    const seconds = usableSeconds(actSeconds[actIndex]);
    if (seconds === null) return;
    recordedCount += 1;
    highestRecorded = Math.max(highestRecorded, actIndex);
    scored[actIndex] = actPointsFor(actIndex, seconds);
  });

  // THE FRONTIER: the furthest point the run is known to have reached. An act BEHIND it with no
  // entry was played and never timed; an act ahead of it has not been played. Taking the later of
  // the two signals matters for exactly one case, and it is the commonest one there is — a save
  // that predates the record card has an EMPTY `actSeconds` and a `reachedAct` of 3 or 4, and
  // without `reachedAct` every act behind the player would read as unplayed.
  //
  // `reachedAct` itself is excluded: the act being played right now is neither timed nor missing.
  const reached = typeof card.reachedAct === 'number' ? card.reachedAct : -1;
  const frontier = Math.max(highestRecorded, reached);
  const unrecorded = ACT_INDICES.filter(
    (actIndex) => actIndex < frontier && scored[actIndex] === undefined
  );

  const actTotal = Object.keys(scored).reduce((sum, key) => sum + scored[key], 0);
  const achievementTotal = achievementPointsFor(card.achievements);

  return {
    total: actTotal + achievementTotal,
    actPoints: scored,
    achievementPoints: achievementTotal,
    // Which acts were priced, and which were played but never timed. Named rather than counted so a
    // surface can say "Act III: not recorded" instead of "3 acts missing".
    scoredActs: Object.keys(scored).map(Number),
    unrecordedActs: unrecorded,
    // A card with holes in it. Not the same as an unfinished run — see `complete`, which the run's
    // ending sets (STORY-044) and this function only passes through.
    partial: unrecorded.length > 0,
    complete: !!card.complete,
    recordedCount,
  };
}

module.exports = { runScore, actPointsFor, achievementPointsFor, ACT_INDICES };
