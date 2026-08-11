// Copy for the transient toasts (components/common/ToastHost.js). Prose lives in data/,
// never in a component — same rule as data/storyBeats.js and data/feedMessages.js.

// A kid deciding you are worth standing next to. Indexed so the three arrivals escalate:
// the first is somebody's little brother, the last is a kid who had options.
const CREW_JOIN_LINES = [
  (name) => `${name} has started following you home. Nobody discussed this.`,
  (name) => `${name} showed up with a glove and an opinion about the batting order.`,
  (name) => `${name} — who has a bike with gears — says they're with you now.`,
];

const CREW_JOIN_FALLBACKS = [
  (name) => `${name} is in. Word gets around.`,
  (name) => `${name} wants a turn at the wall, and wants to be on your side of it.`,
];

function pickBy(index, list) {
  return list[index % list.length];
}

function crewJoinLine(member, index) {
  const name = member && member.name ? member.name.split(' ')[0] : 'Somebody';
  const line = index < CREW_JOIN_LINES.length
    ? CREW_JOIN_LINES[index]
    : pickBy(index - CREW_JOIN_LINES.length, CREW_JOIN_FALLBACKS);
  return line(name);
}

function challengeLine(result) {
  const who = result.challengerName || 'the kid at the wall';
  if (result.won) {
    const gained = Math.abs(result.delta);
    return `Took ${who} off the wall. +${gained} caps${result.respectGained ? ` · +${result.respectGained} respect` : ''}.`;
  }
  return `${who} had your number. −${Math.abs(result.delta)} caps.`;
}

module.exports = { crewJoinLine, challengeLine, CREW_JOIN_LINES };
