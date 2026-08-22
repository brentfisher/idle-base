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

// ---------------------------------------------------------------------------------------------
// MISADVENTURES — the things that happen around a baseball game rather than in it.
//
// The season's own results are already narrated (gameResultLine above, and the event feed), and
// they are all score and money. These are the other half of a season: the dog, the sprinklers,
// somebody's dad. They report nothing and change nothing — no state is read except which act you
// are in, and none is written.
//
// ACT-TAGGED, because the joke IS the act. A kid picking dandelions in left field is Act III and
// nowhere else; an agent leaving a voicemail is Act VI and would be nonsense in a little league.
// `acts: null` means it fits anywhere baseball is being played. The tags are act INDICES
// (data/acts.js is 0-based, so Act III is 2).
//
// Written to be observational rather than jokey, which is the voice the rest of this game is in —
// see data/storyBeats.js and the challenger taunts in data/wallBallConfig.js. Nothing here has a
// punchline; they are things that are funny because they are true.
const SEASON_MISADVENTURES = [
  // --- Act III, little league: nine-year-olds, and the adults arranging them ---
  { acts: [2], text: 'Your left fielder has found a patch of dandelions and is no longer available.' },
  { acts: [2], text: 'Game paused. Somebody’s little brother is on the field and will not be reasoned with.' },
  { acts: [2], text: 'The snack schedule has caused a dispute among the parents that will outlast the season.' },
  { acts: [2], text: 'Orange slices at the half. Nobody has explained that baseball does not have a half.' },
  { acts: [2], text: 'Your catcher took the mask off to sneeze and has not been able to get it back on.' },
  { acts: [2], text: 'A dog has the ball. The dog is faster than everyone here and knows it.' },
  { acts: [2], text: 'Third base is a folded sweatshirt again. The actual base is in somebody’s garage.' },

  // --- Act IV, travel ball: three towns over, and everybody's dad ---
  { acts: [3], text: 'Somebody’s dad has brought a radar gun. He is showing everyone the readings.' },
  { acts: [3], text: 'The tournament schedule changed at 6am. Nobody was told. Everybody is here anyway.' },
  { acts: [3], text: 'Two hours in the van, and the game before yours has gone to extras.' },
  { acts: [3], text: 'The hotel pool is closed, which is now the most important thing that happened today.' },
  { acts: [3], text: 'A parent is filming every pitch for a highlight reel nobody has asked to see.' },
  { acts: [3], text: 'The concession stand is a folding table and it has run out of everything but pickles.' },

  // --- Act V, the minors: a real stadium, run on a budget ---
  { acts: [4], text: 'Between innings, the mascot lost a footrace to a child and took it badly.' },
  { acts: [4], text: 'The tarp crew has been beaten by the tarp. Again.' },
  { acts: [4], text: 'Tonight is Free Bat Night, which the front office is already regretting.' },
  { acts: [4], text: 'The scoreboard is stuck on the third inning and management says that is character.' },
  { acts: [4], text: 'A local dealership is giving away a car for a ball through a hoop. Nobody has ever won it.' },

  // --- Act VI, the big leagues: the same game, with an audience ---
  { acts: [5], text: 'Someone in the front row caught a foul ball and dropped it. It is already everywhere.' },
  { acts: [5], text: 'Rain delay. The grounds crew dance has more highlights than the game did.' },
  { acts: [5], text: 'An agent left a voicemail during the seventh. It was four minutes long and said nothing.' },
  { acts: [5], text: 'The broadcast has spent an entire inning on a graphic about a streak that ended in April.' },

  // --- Anywhere there is a field ---
  { acts: null, text: 'The sprinklers came on. Groundskeeping insists they are on a timer and the timer is correct.' },
  { acts: null, text: 'A ball went over the fence into the yard with the dog in it. That is the last anyone saw of it.' },
  { acts: null, text: 'The other team’s coach has been arguing about a rule that does not exist.' },
  { acts: null, text: 'Rain held off. Everybody stood around for twenty minutes deciding whether it would.' },
  { acts: null, text: 'Somebody stepped on the rake. It went exactly how you would expect.' },
];

// One in this many completed games says something. Frequent enough to be a texture of the season,
// rare enough that it never buries the result of the game the player just watched — and the result
// toast always fires, so this is only ever an addition.
const MISADVENTURE_EVERY = 4;

// A small integer hash, so the pick is DERIVED rather than rolled.
//
// Randomness in the component would re-roll on every render and flicker; storing the choice would
// mean putting a joke in the save file, which components/common/ToastHost.js's whole design exists
// to avoid. Hashing the season and the game index means a given game always says the same thing,
// it costs nothing, and it needs no rng threaded anywhere.
function hashOf(seasonNumber, gameIndex, salt) {
  const n = (Math.max(0, seasonNumber | 0) * 7919 + Math.max(0, gameIndex | 0) * 104729 + salt * 15485863) >>> 0;
  // xorshift-multiply, so adjacent games are not adjacent picks — without it a season walks the
  // list in order and the "randomness" is visibly a rota.
  let h = n ^ (n >>> 13);
  h = Math.imul(h, 1274126177) >>> 0;
  h ^= h >>> 16;
  return Math.imul(h, 2246822519) >>> 0;
}

// The first act with a SEASON, which is the first act that can have a misadventure during one.
// Named here rather than imported from engine/littleLeague.js's LITTLE_LEAGUE_ACT_INDEX because
// src/data/ does not require src/engine/ — the dependency runs the other way — and a lone integer
// with its reason written down is better than inverting the module graph for it.
const FIRST_SEASON_ACT = 2;

// The misadventure for a given completed game, or null when this one is uneventful.
//
// GUARDED ON THE ACT rather than trusting the caller. components/common/ToastHost.js only reaches
// this on a completed game, which cannot happen before Act III — but `acts: null` means "anywhere
// baseball is being played", and without this guard that would include the vacant lot and the
// wall, where a line about the other team's coach is nonsense. The function is total on its own.
//
// Returns null rather than a fallback for an act with no lines tagged to it, so an act added later
// stays quiet instead of borrowing somebody else's jokes.
function misadventureFor(seasonNumber, gameIndex, act) {
  if (!(act >= FIRST_SEASON_ACT)) return null;

  // TWO SEPARATELY SALTED HASHES, not two slices of one. Shifting bits out of a single hash sounds
  // independent and is not: the gate keeps only values where `h % 4 === 0`, and any field derived
  // from that surviving quarter is correlated with it — measured, it repeated one line for a whole
  // run of games. Salting the input instead makes the two draws genuinely unrelated.
  if (hashOf(seasonNumber, gameIndex, 1) % MISADVENTURE_EVERY !== 0) return null;

  const pool = SEASON_MISADVENTURES.filter((m) => m.acts === null || m.acts.indexOf(act) !== -1);
  if (pool.length === 0) return null;
  return pool[hashOf(seasonNumber, gameIndex, 2) % pool.length].text;
}

module.exports = {
  crewJoinLine,
  challengeLine,
  gameResultLine,
  gamesAwayLine,
  CREW_JOIN_LINES,
  SEASON_MISADVENTURES,
  MISADVENTURE_EVERY,
  misadventureFor,
};
