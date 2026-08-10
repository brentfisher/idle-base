const { CAMP_PROGRAMS } = require('../data/campProgramsConfig');
const { clamp } = require('../utils/statUtils');

function getProgram(programId) {
  return CAMP_PROGRAMS.find((p) => p.id === programId);
}

function startCamp(player, programId, clock, modifiers) {
  const program = getProgram(programId);
  const duration = program.durationSeconds / modifiers.campSpeedMult;
  return {
    ...player,
    campStatus: { programId, startedAtClock: clock, completesAtClock: clock + duration },
  };
}

function completeCamp(player) {
  const program = getProgram(player.campStatus.programId);
  const stats = { ...player.stats };
  Object.entries(program.statDeltas).forEach(([stat, delta]) => {
    stats[stat] = clamp(stats[stat] + delta, 5, 100);
  });
  return { ...player, stats, campStatus: null };
}

// Called each tickEngine step so a camp completes as soon as its clock target is reached,
// whether that happens live or during offline fast-forward.
function processCampCompletions(roster, clock) {
  return roster.map((player) => {
    if (player.campStatus && player.campStatus.completesAtClock <= clock) {
      return completeCamp(player);
    }
    return player;
  });
}

module.exports = { getProgram, startCamp, completeCamp, processCampCompletions };
