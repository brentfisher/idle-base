// Act IV — the prop board. The man at the fence keeps a second page in his notebook, and on
// that page he is not pricing the game at all. Every prop number and every prop line lives
// here; engine/bookie.js contains the rules and none of the tuning, the same split
// data/wallBallConfig.js has with engine/wallBall.js.
//
// A prop is a DIFFERENT KIND OF BET from the moneyline above it. The moneyline is priced off
// the real matchup (engine/gameSim.js winProbability) and settles on who actually won. A prop
// is priced off nothing — its chance is ROLLED inside a band and its subject is a kid, a hat
// or somebody's dad. That is why it has its own PLACE_PROP_BET action and its own slot in the
// bookie slice rather than being another field on the moneyline wager.

// ---------------------------------------------------------------------------
// Bounded loss
// ---------------------------------------------------------------------------
// The same three structural properties as the moneyline (engine/bookie.js's invariant block),
// with the ceiling pulled in hard. A prop is a novelty, and a novelty must not be able to move
// the act: 5% of current cash against the moneyline's 20%, so a player who takes every prop on
// the board and loses every one of them has spent a seventh of what one bad moneyline costs.
//
// A percentage of CURRENT cash, never a flat amount, so the absolute loss shrinks toward zero
// as the balance does. MIN_PROP_BET is what stops a cleaned-out player farming free lines, and
// it is deliberately exactly 5% of BOOKIE_MIN_FLOOR_CASH (500) — the same floor of banked
// income the moneyline is gated on. So the moment he will deal with you at all, the smallest
// prop is affordable, and there is no dead band where the board is visible but unplayable.
const PROP_MAX_FRACTION = 0.05;
const MIN_PROP_BET = 25;

// ---------------------------------------------------------------------------
// The odds, and why they lose
// ---------------------------------------------------------------------------
// "A low win rate, 30% or less", with correspondingly juicy payouts. The chance is rolled
// uniformly inside this band per offer, which is what makes the odds arbitrary — two props on
// the same board are not the same bet, and neither one is derived from anything happening on
// the field.
//
// The ceiling is 0.28 rather than 0.30 so the stated "30% or less" survives a retune of the
// rounding below without anyone having to re-derive it.
const PROP_MIN_WIN_CHANCE = 0.08;
const PROP_MAX_WIN_CHANCE = 0.28;

// Fair odds are 1/p; he keeps a quarter. Twice the moneyline's HOUSE_EDGE of 0.12 on purpose:
// the moneyline is a tempo mechanic a player can reasonably work, and the prop board is a
// SINK. The numbers on it are big enough (2.5x to 9.25x) that nobody reads them as a tax.
//
// EXPECTED VALUE, worked. Before rounding, EV per unit staked is
//     p * payoutMult - 1  =  p * (1/p) * (1 - 0.25) - 1  =  -0.25
// at every single point in the band — the edge is flat, so no corner of the board is a better
// bet than any other and there is nothing to shop for. Rounding the payout DOWN to
// PROP_PAYOUT_STEP (below) can only ever remove value, at most 0.25 * p of it, so the realised
// EV lands between -0.25 (at the long end) and -0.30 (at the short end). Clearly negative
// everywhere, which is the requirement: a player who lives on this board finishes Act IV
// slower, and a player who never opens it is not missing income.
//
// The clamps do not bite anywhere inside the band — at p = 0.28 the payout is 2.68x and at
// p = 0.08 it is 9.38x — so they are belt-and-braces against a future retune, and they are
// also what keeps the number JSON-safe: an unclamped 1/p goes to Infinity as p goes to zero,
// and an Infinity written into a save comes back from JSON.parse as null.
const PROP_HOUSE_EDGE = 0.25;
const MIN_PROP_PAYOUT_MULT = 2;
const MAX_PROP_PAYOUT_MULT = 12;

// Payouts are quoted in quarters. He is a man with a notebook, not a pricing desk, and
// "9.25x" reads as a bet where "9.3839x" reads as a spreadsheet. Rounded DOWN, never to
// nearest, so the rounding can never accidentally hand the player a positive-EV line.
const PROP_PAYOUT_STEP = 0.25;

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
// Three at a time — enough that there is a choice, few enough that the whole board is one
// glance on a 390px screen.
//
// The board turns over every PROP_REFRESH_SECONDS, which at Act IV's 40s-per-game pacing
// (data/acts.js) is about three games. It also turns over whenever a game resolves, because
// the lines interpolate the opponent — see propOfferSeed() in engine/bookie.js. Both, not
// either: the clock alone would let a line about "the visitors" silently change who the
// visitors are mid-offer, and the schedule alone would freeze the board solid between seasons.
const PROP_OFFER_COUNT = 3;
const PROP_REFRESH_SECONDS = 120;

// Innings a prop can be about. Travel ball is seven (data/acts.js does not model innings, so
// this is the prop board's own fiction and nothing checks it against a box score).
const PROP_MIN_INNING = 1;
const PROP_MAX_INNING = 7;

function ordinalInning(n) {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

// Used when there is no roster to draw a name from — an empty roster, or a save that reaches
// the board before Act IV has built one. The board never renders a blank.
const FALLBACK_PLAYER_NAMES = ['Brent', 'the third baseman', "somebody's kid", 'the tall one'];
const FALLBACK_OPPONENT_NAME = 'the visitors';

// The lines. Each is a function of a context object — { inning, player, teammate, opponent } —
// so a prop reads as being about THIS game rather than about baseball in general. `inning` is
// already an ordinal string; `player` and `teammate` are first names off state.roster and are
// guaranteed different where the roster allows it.
//
// Voice check, because this is the part the player actually came for: specific, deadpan, small,
// and about the texture of amateur baseball rather than about baseball. A hat. A hot dog. A
// dad. A foul ball in the parking lot. Never a joke with a punchline — the humour is that
// somebody wrote this down in a notebook and is willing to take money on it.
const PROP_LINES = [
  (c) => `${c.player} will have gum on his hat in the ${c.inning}.`,
  (c) => `A foul ball reaches the parking lot in the ${c.inning}. Nobody goes and gets it.`,
  (c) => `Somebody's dad argues a call in the ${c.inning} from behind the fence, using the word "clearly".`,
  (c) => `The ${c.opponent} bring out a cooler that turns out to contain only orange slices.`,
  (c) => `${c.player} steps out of the box in the ${c.inning} to fix a batting glove that is fine.`,
  (c) => `The scoreboard is wrong for the entire ${c.inning} and nobody mentions it.`,
  (c) => `A dog gets onto the field before the ${c.inning} is over.`,
  (c) => `${c.teammate} finishes a hot dog between innings and asks for another one.`,
  (c) => `The ${c.opponent} coach makes a pitching change in the ${c.inning} and then changes his mind.`,
  (c) => `Somebody's little sister does a cartwheel on the berm during the ${c.inning}.`,
  (c) => `${c.player} slides into second in the ${c.inning} when he did not need to.`,
  (c) => `A parent films the whole ${c.inning} vertically.`,
  (c) => `The ${c.opponent} warm up with a ball that is visibly a different brand.`,
  (c) => `${c.teammate} loses a sunflower seed shell down his own jersey in the ${c.inning}.`,
  (c) => `The PA plays six seconds of a song and then stops, twice, before the ${c.inning}.`,
  (c) => `An umpire cleans the plate with a brush he is clearly borrowing.`,
  (c) => `${c.player} throws to the wrong base in the ${c.inning} and gets away with it.`,
  (c) => `Somebody's dad offers to help drag the infield and is politely declined.`,
  (c) => `A ${c.opponent} player forgets how many outs there are in the ${c.inning}.`,
  (c) => `The snack bar runs out of the blue slush before the ${c.inning}.`,
  (c) => `${c.teammate} wears his sunglasses on the back of his head all game.`,
  (c) => `A ball hits the top of the fence in the ${c.inning} and stays in.`,
  (c) => `${c.player} adjusts the helmet after every single pitch of one at-bat.`,
  (c) => `Somebody's grandmother brings a folding chair that is better than the bleachers.`,
  (c) => `The ${c.opponent} attempt a hidden ball trick in the ${c.inning}. It does not work.`,
  (c) => `A ${c.inning}-inning pitching change takes longer than the ${c.inning} inning did.`,
  (c) => `${c.teammate} catches a foul ball barehanded in the dugout and pretends it did not hurt.`,
  (c) => `Somebody's dad keeps a scorebook in pen and has to cross something out in the ${c.inning}.`,
  (c) => `${c.player} gets dirt in his eye in the ${c.inning} and blames the wind.`,
  (c) => `A kid on the ${c.opponent} bench is wearing the wrong number for the whole game.`,
  (c) => `The lineup card blows off the fence during the ${c.inning}.`,
  (c) => `${c.teammate} asks the umpire what the count is in the ${c.inning} and gets it wrong anyway.`,
  (c) => `Two mothers agree, out loud, that the ${c.inning} was "a long inning".`,
  (c) => `A tee-ball game on the next diamond over finishes before the ${c.inning} does.`,
  (c) => `${c.player} is on base in the ${c.inning} with a sock visibly falling down.`,
  (c) => `The ${c.opponent} catcher takes his mask off to argue and immediately puts it back on.`,
];

module.exports = {
  PROP_MAX_FRACTION,
  MIN_PROP_BET,
  PROP_MIN_WIN_CHANCE,
  PROP_MAX_WIN_CHANCE,
  PROP_HOUSE_EDGE,
  MIN_PROP_PAYOUT_MULT,
  MAX_PROP_PAYOUT_MULT,
  PROP_PAYOUT_STEP,
  PROP_OFFER_COUNT,
  PROP_REFRESH_SECONDS,
  PROP_MIN_INNING,
  PROP_MAX_INNING,
  ordinalInning,
  FALLBACK_PLAYER_NAMES,
  FALLBACK_OPPONENT_NAME,
  PROP_LINES,
};
