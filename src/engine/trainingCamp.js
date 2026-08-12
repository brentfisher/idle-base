const { CAMP_PROGRAMS } = require('../data/campProgramsConfig');
const { clamp } = require('../utils/statUtils');
const { playerOverall } = require('./strength');

function getProgram(programId) {
  return CAMP_PROGRAMS.find((p) => p.id === programId);
}

// The bench-swap record, read defensively. A camp started before this feature existed has a
// campStatus with no `benchSwap` at all, and that save must complete its camp without throwing
// and without inventing a swap to undo — the camper was never demoted, so there is nothing to
// reverse and `null` is the honest answer. Saves are never migrated in this codebase
// (see wallBallSlice in engine/wallBall.js), so every read goes through here.
function campSwap(player) {
  const swap = player && player.campStatus && player.campStatus.benchSwap;
  if (!swap || !swap.standInId) return null;
  return {
    standInId: swap.standInId,
    // Where the stand-in came from, so returning them is an exact undo rather than a guess.
    standInPosition: swap.standInPosition,
    // The spot they were moved into — also the camper's own position.
    coveringPosition: swap.coveringPosition,
  };
}

// Who comes off the bench when `player` leaves for camp, and what they are worth once they are
// standing there.
//
// Eligibility is deliberately NOT "a bench player at the same position". Two facts rule that out.
// First, engine/strength.js branches `playerOverall` on position — pitching is half a pitcher's
// rating and near-irrelevant for everyone else — so "same position" and "best replacement" are
// different questions, and only the second one is the one the team actually plays. Second, bench
// composition is frozen for the life of a run: trades replace a starter, retirement replaces a
// player in place, and neither ever adds depth. Act III seeds only two bench players at random
// positions, so a same-position rule would leave roughly four saves in five permanently unable to
// send their pitcher to the Pitching Lab, with no move available to fix it.
//
// So: score every bench player AS IF already standing in that spot, and take the best. That
// naturally prefers a bench pitcher to cover the mound when one exists, and falls back to the
// least-bad outfielder when one does not — degrading instead of locking.
//
// The stand-in's `position` is reassigned to the vacated spot for the duration. That is what lets
// components/field/FieldView.js keep drawing nine (it looks up `position === pos.id && isStarter`)
// without any change there, and it is why the rating below is the rating the game will really use.
//
// Ties go to the first bench player in roster order — a fold, not a sort, because engine code is
// pure and this also runs during offline catch-up.
function findStandIn(roster, player) {
  if (!player || !player.isStarter) return null;
  let best = null;
  let bestRating = -Infinity;
  roster.forEach((candidate) => {
    if (candidate.isStarter || candidate.campStatus || candidate.id === player.id) return;
    const rating = playerOverall({ ...candidate, position: player.position });
    if (rating > bestRating) {
      bestRating = rating;
      best = candidate;
    }
  });
  return best ? { player: best, ratingAtPosition: bestRating } : null;
}

// Everything TrainingCampPanel.js needs to tell the truth BEFORE the player commits, computed by
// the same function the reducer will use so the button and the outcome cannot drift apart.
//
// `teamRatingDelta` is the change to the mean the starting nine (ten, with the DH) contributes to
// engine/strength.js — one slot swapped, divided across the lineup. It is the number that decides
// games, and it is the number a player deserves to see before spending 300 on a camp that costs
// them four points of team rating for its whole duration.
function describeCampSwap(roster, playerId) {
  const camper = roster.find((p) => p.id === playerId);
  if (!camper) return { ok: false, reason: 'missing', camper: null, standIn: null };
  if (!camper.isStarter) {
    return { ok: true, reason: 'bench', camper, standIn: null, teamRatingDelta: 0 };
  }

  const found = findStandIn(roster, camper);
  if (!found) return { ok: false, reason: 'noBench', camper, standIn: null, teamRatingDelta: 0 };

  const starterCount = roster.filter((p) => p.isStarter).length || 1;
  const camperRating = playerOverall(camper);
  return {
    ok: true,
    reason: 'swap',
    camper,
    standIn: found.player,
    camperRating,
    standInRating: found.ratingAtPosition,
    teamRatingDelta: (found.ratingAtPosition - camperRating) / starterCount,
  };
}

// The player currently covering for `camper`, or null. Used by the panel and the roster cards to
// show the swap rather than leaving the player to assume it.
function standInFor(roster, camper) {
  const swap = campSwap(camper);
  if (!swap) return null;
  return roster.find((p) => p.id === swap.standInId) || null;
}

// Roster-level because a camp start now moves two players, not one. Returns the roster unchanged
// when the camp cannot start — including the case where a starter has nobody to cover for them,
// which is a refusal rather than playing a man down: a team that quietly fields eight is exactly
// the "silently weakened" outcome the swap exists to prevent, and a bench player can always be
// sent instead. TrainingCampPanel.js states this before the button is reachable.
function sendToCamp(roster, playerId, programId, clock, modifiers) {
  const player = roster.find((p) => p.id === playerId);
  const program = getProgram(programId);
  if (!player || !program || player.campStatus) return roster;

  const found = player.isStarter ? findStandIn(roster, player) : null;
  if (player.isStarter && !found) return roster;

  const duration = program.durationSeconds / modifiers.campSpeedMult;
  const benchSwap = found
    ? {
        standInId: found.player.id,
        standInPosition: found.player.position,
        coveringPosition: player.position,
      }
    : null;
  const campStatus = { programId, startedAtClock: clock, completesAtClock: clock + duration, benchSwap };

  return roster.map((p) => {
    // `benchSwap` non-null is itself the record that the camper was a starter — findStandIn only
    // returns a stand-in for one — so there is no second "wasStarter" flag to keep in sync.
    if (p.id === player.id) return { ...p, isStarter: benchSwap ? false : p.isStarter, campStatus };
    if (benchSwap && p.id === benchSwap.standInId) {
      return { ...p, isStarter: true, position: benchSwap.coveringPosition };
    }
    return p;
  });
}

// Stat application only. Kept player-level and separate from the swap undo so the two halves of
// "camp finished" stay readable: this one is the reward, reverseCampSwap below is the bookkeeping.
function completeCamp(player) {
  const program = getProgram(player.campStatus.programId);
  const stats = { ...player.stats };
  Object.entries(program.statDeltas).forEach(([stat, delta]) => {
    stats[stat] = clamp(stats[stat] + delta, 5, 100);
  });
  return { ...player, stats, campStatus: null };
}

// The exact undo of sendToCamp's swap: the camper gets their starting spot back, the stand-in goes
// back to the bench AND back to their own position.
//
// Guarded rather than blind, because the roster can legitimately change while a camp runs. A trade
// or a retirement can replace the stand-in with a different player who inherits their starting slot
// and position; retirement can also replace the camper (the rookie arrives with campStatus null, so
// the swap record vanishes with them and the stand-in simply keeps the job — the team still fields
// nine, which is the right outcome).
//
// So the camper is restored unconditionally, while the stand-in is demoted only if they are still
// on the roster, still starting, and still standing in the spot we put them in. When that check
// fails the lineup can carry one extra starter until the next roster change. That is bounded at
// one, only ever makes the team stronger, and is strictly better than demoting whoever happens to
// occupy the slot now — which could bench a player the user just paid to trade for.
function reverseCampSwap(roster, camper) {
  const swap = campSwap(camper);
  if (!swap) return roster;
  return roster.map((p) => {
    if (p.id === camper.id) return { ...p, isStarter: true };
    if (p.id === swap.standInId && p.isStarter && p.position === swap.coveringPosition) {
      return { ...p, isStarter: false, position: swap.standInPosition };
    }
    return p;
  });
}

// Called each tickEngine step so a camp completes as soon as its clock target is reached,
// whether that happens live or during offline fast-forward. Idempotent by construction: the
// completion clears campStatus, so a second pass over the same roster finds nothing due and
// returns it untouched — which matters because offline catch-up walks many steps in a row.
function processCampCompletions(roster, clock) {
  const finishing = roster.filter((p) => p.campStatus && p.campStatus.completesAtClock <= clock);
  if (finishing.length === 0) return roster;

  // Swaps are reversed off the PRE-completion snapshot of each camper, because completeCamp
  // clears campStatus and with it the record of who was covering.
  let next = roster.map((p) => (p.campStatus && p.campStatus.completesAtClock <= clock ? completeCamp(p) : p));
  finishing.forEach((camper) => {
    next = reverseCampSwap(next, camper);
  });
  return next;
}

module.exports = {
  getProgram,
  campSwap,
  findStandIn,
  describeCampSwap,
  standInFor,
  sendToCamp,
  completeCamp,
  reverseCampSwap,
  processCampCompletions,
};
