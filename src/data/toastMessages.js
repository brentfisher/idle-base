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

// A game that just finished. Deliberately says nothing about money: what a win is worth
// changes act to act and is being changed elsewhere besides, so the toast reports the result
// and the score and lets the wallet chip report the wallet.
//
// `isHome` picks the preposition rather than adding a word, because at 390px the toast is one
// line and "vs the Ashland Rail" fits where "at home against the Ashland Rail" does not.
function gameResultLine(slot, opponentName) {
  const where = slot.isHome ? 'vs' : 'at';
  // The score is written onto the slot by engine/tickEngine.js when it resolves the game, so
  // it is always there in practice — but a slot without one must read as a sentence rather
  // than as a sentence with a hole in it.
  const score = slot.score ? `${slot.score} ` : '';
  if (slot.result === 'win') {
    return `Won it ${score}${where} ${opponentName}.`;
  }
  return `Dropped one ${score}${where} ${opponentName}.`;
}

// ONE line for a whole batch of games, never one line per game — see the design note in
// components/common/ToastHost.js. This is what an eight-hour offline return says.
function gamesAwayLine(wins, losses) {
  const total = wins + losses;
  if (wins > 0 && losses === 0) return `${total} games played while you were gone. You won all of them.`;
  if (losses > 0 && wins === 0) return `${total} games played while you were gone. You won none of them.`;
  return `${total} games played while you were gone: ${wins}-${losses}.`;
}

module.exports = { crewJoinLine, challengeLine, gameResultLine, gamesAwayLine, CREW_JOIN_LINES };
