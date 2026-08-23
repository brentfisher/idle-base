// Act IV — the Bookie. Somebody's uncle takes bets on games your team is about to play, and
// he will happily take yours.
//
// This is randomness #3, the punishing one (PRD §Act IV). Act II's wall-ball wager was the
// safe version: bounded, frequent, and you were always the favourite. This one prices the
// REAL matchup, so the only bets that pay are the ones you are supposed to lose.
//
// BOUNDED-LOSS INVARIANT (PRD §6.4, the same three properties engine/wallBall.js states):
//   1. A wager is capped at WAGER_MAX_FRACTION of CURRENT cash — a percentage of holdings,
//      never a flat amount — so absolute losses shrink toward zero as the balance does.
//      clampWager() is the only way a wager amount is computed and the reducer re-clamps
//      whatever the UI sent, unconditionally.
//   2. No currency goes below zero: every wallet write here is engine/wallet.js.
//   3. One open wager at a time, and none at all below a floor of banked passive income, so
//      the money at risk is always money the player had spare. Below the floor the Bookie is
//      not available — and the click (engine/clicker.js) is still a cash faucet in this act,
//      which is what makes a cleaned-out player recoverable in bounded time.
//
// Pure — no React, no DOM. Every moneyline number comes from data/actFourConfig.js; every prop
// number and every prop line comes from data/propBetsConfig.js.
//
// RANDOMNESS. The moneyline needs none of its own: it is settled by the game the tick loop was
// going to simulate anyway, so it just prices what is already there. The PROP BOARD does need
// randomness — its chances are rolled rather than derived — and it enters the way this codebase
// always takes it, as a defaulted `rng` parameter on placePropBet() so the bounded-loss
// guarantees can be driven headlessly with an always-lose generator. There is no bare
// Math.random() anywhere in this file. The offer BOARD is generated from a seeded generator
// derived from state, not from `rng`, for a reason spelled out over propOfferSeed().
const { winProbability } = require('./gameSim');
const balanceConfig = require('../data/balanceConfig');
const { PLAYER_TEAM_ID } = require('./schedule');
const { getTeamStrength } = require('./strength');
const { creditWallet, debitWallet, balanceOf } = require('./wallet');
const { concessionsPerSecond } = require('./concessions');
const { sponsorshipsPerSecond } = require('./sponsorships');
const { clamp } = require('../utils/statUtils');
// The record card's counters. engine/records.js owns what a counter means; this file owns when.
const { recordWagerSettled } = require('./records');
const {
  WAGER_MAX_FRACTION,
  MIN_WAGER,
  BOOKIE_FLOOR_SECONDS,
  BOOKIE_MIN_FLOOR_CASH,
  HOUSE_EDGE,
  MIN_PAYOUT_MULT,
  MAX_PAYOUT_MULT,
  SIDE_FOR,
  SIDE_AGAINST,
} = require('../data/actFourConfig');
const {
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
  PROP_REPUTATION_PER_MULT,
  MIN_PROP_REPUTATION_WIN,
  ordinalInning,
  FALLBACK_PLAYER_NAMES,
  FALLBACK_OPPONENT_NAME,
  PROP_LINES,
} = require('../data/propBetsConfig');

// Every read of the Act IV bookie slice goes through this. A save written before the Bookie
// existed has no slice, and this codebase tolerates an absent slice rather than migrating it.
// The prop fields default the same way, so a save written before the prop board existed reads
// as "no prop pending, no prop record" and behaves exactly as it did — which is the whole
// reason nothing here is ever migrated.
function bookieSlice(state) {
  const slice = (state && state.bookie) || {};
  return {
    wager: slice.wager || null,
    wins: slice.wins || 0,
    losses: slice.losses || 0,
    net: slice.net || 0,
    lastResult: slice.lastResult || null,
    // The prop board keeps its own pending bet, its own record and its own last result.
    // `lastResult` stays exclusively the moneyline's: engine/tickEngine.js reads it straight
    // into feedMessages.bookieSettled() whenever a moneyline was open, and a prop result
    // written into the same field would be handed to a formatter expecting a different shape.
    prop: slice.prop || null,
    propWins: slice.propWins || 0,
    propLosses: slice.propLosses || 0,
    propNet: slice.propNet || 0,
    lastPropResult: slice.lastPropResult || null,
  };
}

// The act's passive cash, which is what the floor is measured in. Read from the two
// contributors that actually exist in Act IV rather than from engine/income.js's full bundle,
// because that also needs a resolved modifiers object and the ticketing contributor it would
// add is gated on a stadium that does not exist for two more acts.
function passiveCashPerSecond(state) {
  return concessionsPerSecond(state) + sponsorshipsPerSecond(state);
}

// "About two minutes of passive income", per the PRD, with an absolute minimum for a player
// who has signed no sponsors at all. A floor expressed in seconds tracks the act's economy
// instead of going stale the moment the first sponsor is signed.
function wagerFloor(state) {
  return Math.max(BOOKIE_MIN_FLOOR_CASH, Math.round(BOOKIE_FLOOR_SECONDS * passiveCashPerSecond(state)));
}

function maxWagerFor(cash) {
  const balance = typeof cash === 'number' && Number.isFinite(cash) ? Math.max(0, cash) : 0;
  return Math.floor(balance * WAGER_MAX_FRACTION);
}

function maxWager(state) {
  return maxWagerFor(balanceOf(state.wallet, 'cash'));
}

// The only place a wager amount is decided. Anything that is not a usable number becomes 0 —
// a string, a NaN, an Infinity, a negative — so a malformed action can never mint money or
// escape the cap. Strict `typeof` rather than Number() coercion, matching clampStake().
function clampWager(cash, requested) {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), maxWagerFor(cash)));
}

// The fixture the Bookie is quoting: the next game on the schedule, priced with the same
// strengths engine/tickEngine.js will hand to simulateGame() when it plays it. Returns null
// whenever there is no next regular-season game — between seasons, or in the playoffs, the
// Bookie has nothing to sell.
function nextMatchup(state, modifiers) {
  const season = state.season;
  if (!season || season.phase !== 'regular') return null;
  const slot = season.schedule[season.scheduleIndex];
  if (!slot) return null;

  const playerStrength = getTeamStrength(state, modifiers, PLAYER_TEAM_ID);
  const oppStrength = getTeamStrength(state, modifiers, slot.opponentTeamId);
  const team = state.league ? state.league.teams.find((t) => t.id === slot.opponentTeamId) : null;

  return {
    opponentTeamId: slot.opponentTeamId,
    opponentName: team ? team.name : 'the visitors',
    isHome: slot.isHome,
    // The same probability the game itself will roll against (engine/gameSim.js).
    playerWinProbability: winProbability(playerStrength, oppStrength, balanceConfig.eloK),
  };
}

// Fair odds are 1/p; the house keeps HOUSE_EDGE of that. Clamped at both ends, which is what
// keeps the payout JSON-safe as well as sane: an unclamped 1/p goes to Infinity as p goes to
// zero, and an Infinity written into a wager would come back from a save as null.
//
// The clamp also IS the design. Backing a heavy favourite is floored near 1.1x — the Bookie
// will take that bet all day and it barely moves the act. The money is at the other end,
// where the clamp bites at 6x and the player is betting on a game they will probably lose.
function payoutMultFor(playerWinProbability, side) {
  const p = clamp(playerWinProbability, 0.01, 0.99);
  const chance = side === SIDE_AGAINST ? 1 - p : p;
  return clamp((1 / chance) * (1 - HOUSE_EDGE), MIN_PAYOUT_MULT, MAX_PAYOUT_MULT);
}

function hasOpenWager(state) {
  return !!bookieSlice(state).wager;
}

// Why the Bookie will not deal right now, as one reason rather than a set of booleans the
// panel would have to prioritise itself. null means he will.
function unavailableReason(state, modifiers) {
  if (hasOpenWager(state)) return 'openWager';
  if (!nextMatchup(state, modifiers)) return 'noGame';
  if (balanceOf(state.wallet, 'cash') < wagerFloor(state)) return 'belowFloor';
  if (maxWager(state) < MIN_WAGER) return 'belowFloor';
  return null;
}

// Places a wager on the next scheduled game and returns the new state; returns the state
// unchanged when the Bookie is not currently dealing. The caller supplies neither the odds
// nor the ceiling — both are decided here, from live state.
//
// The odds are FROZEN at placement. A player who then buys three reputation deals has already
// been quoted the old line, which is exactly how a bookmaker works and stops the shop from
// being a way to print money against a bet already on the table.
function placeWager(state, options = {}, modifiers) {
  if (unavailableReason(state, modifiers)) return state;

  const matchup = nextMatchup(state, modifiers);
  const side = options.side === SIDE_AGAINST ? SIDE_AGAINST : SIDE_FOR;

  // Re-clamped unconditionally, whatever the caller asked for. This line is the invariant.
  const amount = clampWager(balanceOf(state.wallet, 'cash'), options.amount);
  if (amount < MIN_WAGER) return state;

  const slice = bookieSlice(state);
  const payoutMult = payoutMultFor(matchup.playerWinProbability, side);

  return {
    ...state,
    wallet: debitWallet(state.wallet, 'cash', amount),
    bookie: {
      ...slice,
      wager: {
        side,
        amount,
        payoutMult,
        placedAtClock: state.clock || 0,
        opponentName: matchup.opponentName,
        playerWinProbability: matchup.playerWinProbability,
      },
    },
  };
}

// Settles against the game that just finished. Called from engine/tickEngine.js the moment a
// result exists, and deliberately NOT keyed to a game index: the offseason resets
// scheduleIndex to 0, so an index-matched wager would settle against a game in the following
// season. The next game to be played is the game that was bet on, full stop.
//
// The stake was taken at placement, so a winning wager is credited amount * payoutMult and a
// losing one credits nothing.
//
// This is ALSO where a pending prop settles (settleProp(), defined further down). It is folded
// in here rather than given its own hook because this is the one function the tick loop already
// calls the moment a game result exists, and engine/tickEngine.js is not a file this change
// touches. Both paths return the state through settleProp(), including the early one, so the
// function stays an identity when there is neither a wager nor a prop — which is every act but
// this one, and is what engine/tickEngine.js relies on.
//
// `lastResult` remains exclusively the moneyline's: tickEngine reads it into
// feedMessages.bookieSettled() whenever a moneyline was open, so a prop writes lastPropResult.
function settleWager(state, playerWon) {
  const slice = bookieSlice(state);
  const wager = slice.wager;
  if (!wager) return settleProp(state);

  const won = wager.side === SIDE_AGAINST ? !playerWon : !!playerWon;
  const payout = won ? Math.round(wager.amount * wager.payoutMult) : 0;

  // The counters the achievement evaluator reads. `wager.payoutMult` is the line the player was
  // QUOTED — frozen at placement, see placeWager() — and only a win is recorded, so a losing wager
  // at any multiplier leaves `long-shot` exactly where it was.
  return settleProp(recordWagerSettled({
    ...state,
    wallet: payout > 0 ? creditWallet(state.wallet, 'cash', payout) : state.wallet,
    bookie: {
      ...slice,
      wager: null,
      wins: slice.wins + (won ? 1 : 0),
      losses: slice.losses + (won ? 0 : 1),
      net: slice.net + (payout - wager.amount),
      lastResult: {
        won,
        side: wager.side,
        amount: wager.amount,
        payout,
        // Net cash swing, so the panel never has to re-derive it from the payout multiplier.
        delta: payout - wager.amount,
        opponentName: wager.opponentName,
        settledAtClock: state.clock || 0,
      },
    },
  }, { won, payoutMult: wager.payoutMult, prop: false }));
}

// A wager cannot survive the season it was placed in: the schedule it referred to is gone.
// Called from the offseason transition. Refunded rather than voided — the game it was placed
// on was never played, and taking a player's money for a fixture that did not happen is the
// one loss the bounded-loss invariant would not explain.
//
// A pending PROP is refunded on the same reasoning and in the same place. It is also the only
// way a prop can be left hanging: props settle on the next regular-season game and can only be
// placed while one exists, so the sole path to a stranded prop is the season ending underneath
// it (the player reaches the playoffs, and no further regular game is ever resolved). Without
// this the stake would be silently kept — an unbounded loss, and exactly the thing this
// codebase does not do.
function refundOpenWager(state) {
  const slice = bookieSlice(state);
  if (!slice.wager && !slice.prop) return state;

  let wallet = state.wallet;
  if (slice.wager) wallet = creditWallet(wallet, 'cash', slice.wager.amount);
  if (slice.prop) wallet = creditWallet(wallet, 'cash', slice.prop.amount);

  return { ...state, wallet, bookie: { ...slice, wager: null, prop: null } };
}

// ===========================================================================================
// The prop board — the second page of his notebook
// ===========================================================================================
// Everything below is the PROP bet, which shares this file with the moneyline because it
// shares his table, his floor and his invariants, and shares nothing else. A prop's chance is
// rolled rather than derived, its subject is a hat rather than a scoreline, and it settles off
// a number sealed at placement rather than off who won. See data/propBetsConfig.js for the
// numbers, the expected value and the lines themselves.

// A small deterministic generator (mulberry32). Not `rng`, and deliberately not Math.random:
// the offer board is DERIVED, not stored, so it is recomputed on every one of the ~20 renders
// a second the tick loop causes. A board built from Math.random would visibly reroll itself
// every frame — three different props, three different prices, faster than anyone can read
// them. Seeded from state, the same state produces the same board, so it holds still.
function seededRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The fixture a prop will settle against, read straight off the schedule. Deliberately NOT
// nextMatchup(): a prop does not use a win probability, and going through nextMatchup() would
// drag `modifiers` into a board that has no opinion about how strong anybody is.
function nextGameSlot(state) {
  const season = state && state.season;
  if (!season || season.phase !== 'regular') return null;
  return season.schedule[season.scheduleIndex] || null;
}

function opponentNameFor(state, teamId) {
  const teams = (state && state.league && state.league.teams) || [];
  const team = teams.find((t) => t.id === teamId);
  return team && team.name ? team.name : FALLBACK_OPPONENT_NAME;
}

// WHEN THE BOARD TURNS OVER, expressed as a seed rather than as an event, because nothing is
// going to call us: engine/tickEngine.js is where games resolve and it knows nothing about
// props. So the board is a pure function of state and turns over when the seed changes.
//
// The seed is BOTH a clock epoch and the schedule index, and it needs both:
//   · The clock epoch (PROP_REFRESH_SECONDS) is what stops the board going stale between
//     games and is what makes an offline return correct for free. advance() resolves eight
//     hours of games inside one iteration and never calls us; when the player looks, the clock
//     has moved and the board is simply new. There is no catch-up to miss and no queue to
//     drain, because nothing was ever stored.
//   · The schedule index is what keeps the board HONEST. The lines interpolate the opponent,
//     and the opponent changes the instant a game resolves. Seeded on the clock alone, a line
//     about the visitors would silently change who the visitors are in the middle of its own
//     offer. Including the index means the text turns over exactly when the thing it describes
//     does.
// A prop already placed is untouched by any of this: its text, chance and price were copied
// onto the pending bet at placement.
function propOfferSeed(state) {
  const epoch = Math.floor(Math.max(0, (state && state.clock) || 0) / PROP_REFRESH_SECONDS);
  const season = state && state.season;
  const index = season ? season.scheduleIndex || 0 : 0;
  const number = season ? season.seasonNumber || 0 : 0;
  // Mixed rather than added so that (epoch 3, game 1) and (epoch 1, game 3) are different
  // boards instead of the same one.
  return (Math.imul(epoch + 1, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b) ^ Math.imul(number + 1, 0xc2b2ae35)) >>> 0;
}

// Payout from chance: fair odds shaded by the house, clamped, then quoted in quarters. Rounded
// DOWN so the quoting can never turn a losing line into a winning one — see the EV working in
// data/propBetsConfig.js.
function propPayoutMultFor(winChance) {
  const p = clamp(winChance, PROP_MIN_WIN_CHANCE, PROP_MAX_WIN_CHANCE);
  const raw = clamp((1 / p) * (1 - PROP_HOUSE_EDGE), MIN_PROP_PAYOUT_MULT, MAX_PROP_PAYOUT_MULT);
  return Math.floor(raw / PROP_PAYOUT_STEP) * PROP_PAYOUT_STEP;
}

// Two first names off the real roster, so a line reads as being about this team. Distinct
// where the roster allows it; a one-player or empty roster falls back rather than rendering a
// blank, because "will have gum on his hat" with no name in front of it is not a bet.
// What a line pays in reputation if it lands. Derived from the payout and NOT from the chance, so
// the flat edge the board is built on survives — the arithmetic is in data/propBetsConfig.js over
// PROP_REPUTATION_PER_MULT. Floored at one on a win: a reward that prints as zero reads as a bug.
//
// Quoted on the OFFER and frozen onto the pending bet alongside the odds, for the same reason the
// odds are frozen: the player was shown a line, and the line is what they get. A retune of the rate
// cannot reach back into a bet that is already written down.
function propReputationFor(payoutMult) {
  return Math.max(MIN_PROP_REPUTATION_WIN, Math.floor(payoutMult * PROP_REPUTATION_PER_MULT));
}

function propNames(state, rng) {
  const roster = (state && state.roster) || [];
  const names = roster.map((p) => (p && p.name ? String(p.name).split(' ')[0] : null)).filter(Boolean);
  const pool = names.length > 0 ? names : FALLBACK_PLAYER_NAMES;
  const first = pool[Math.floor(rng() * pool.length) % pool.length];
  const rest = pool.filter((n) => n !== first);
  const others = rest.length > 0 ? rest : pool;
  return { player: first, teammate: others[Math.floor(rng() * others.length) % others.length] };
}

// The board. PROP_OFFER_COUNT distinct lines, each with its own inning, its own rolled chance
// and therefore its own price — "arbitrary odds", per the request: two props sitting next to
// each other are not the same bet. Lines are drawn without replacement from a copy of the
// pool, so the board never shows the same line twice.
function propOffers(state) {
  const slot = nextGameSlot(state);
  if (!slot) return [];

  const seed = propOfferSeed(state);
  const rng = seededRng(seed);
  const opponent = opponentNameFor(state, slot.opponentTeamId);
  const pool = PROP_LINES.map((line, i) => ({ line, i }));
  const offers = [];

  for (let n = 0; n < PROP_OFFER_COUNT && pool.length > 0; n += 1) {
    const [drawn] = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1);
    const inning = PROP_MIN_INNING + Math.floor(rng() * (PROP_MAX_INNING - PROP_MIN_INNING + 1));
    const { player, teammate } = propNames(state, rng);
    const winChance = PROP_MIN_WIN_CHANCE + rng() * (PROP_MAX_WIN_CHANCE - PROP_MIN_WIN_CHANCE);

    offers.push({
      // Stable for as long as the board is, which is exactly as long as it needs to be: if the
      // board turns over between the tap and the reducer, placePropBet() cannot find this id
      // and refuses. Refusing is correct — the alternative is taking money for a line the
      // player never read.
      id: `prop-${seed}-${drawn.i}`,
      text: drawn.line({ inning: ordinalInning(inning), player, teammate, opponent }),
      winChance,
      payoutMult: propPayoutMultFor(winChance),
      reputation: propReputationFor(propPayoutMultFor(winChance)),
    });
  }

  return offers;
}

function maxPropBetFor(cash) {
  const balance = typeof cash === 'number' && Number.isFinite(cash) ? Math.max(0, cash) : 0;
  return Math.floor(balance * PROP_MAX_FRACTION);
}

function maxPropBet(state) {
  return maxPropBetFor(balanceOf(state.wallet, 'cash'));
}

// The only place a prop stake is decided, and the same strict contract as clampWager(): a
// string, a NaN, an Infinity or a negative all become 0 rather than being coerced.
function clampPropBet(cash, requested) {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), maxPropBetFor(cash)));
}

function hasOpenProp(state) {
  return !!bookieSlice(state).prop;
}

// Why the prop board is closed, as one reason. Note that an open MONEYLINE does not close it
// and an open prop does not close the moneyline: they are different bets on different pages,
// and one of each is the intended shape. The cash floor is shared, though — the money a player
// gambles at this fence is always money they had spare, whichever page it goes on.
function propUnavailableReason(state) {
  if (hasOpenProp(state)) return 'openProp';
  if (!nextGameSlot(state)) return 'noGame';
  if (balanceOf(state.wallet, 'cash') < wagerFloor(state)) return 'belowFloor';
  if (maxPropBet(state) < MIN_PROP_BET) return 'belowFloor';
  return null;
}

// Places a prop and returns the new state; returns the state unchanged when the board is not
// open, when the offer is no longer on it, or when there is nothing wagerable. The caller
// supplies neither the odds nor the ceiling.
//
// THE SEALED ROLL. `roll` is one uniform draw taken HERE and stored on the pending bet, and
// settleProp() answers by comparing it against the chance that was quoted. This is a commit,
// not a result: it is taken before anyone knows what it decides, and once taken there is
// exactly one answer it can give. That is what makes settlement honest under this codebase's
// two nastiest paths — a reload (the roll comes back out of the save unchanged, so the prop
// settles to the same thing it always would have) and an offline catch-up (advance() may run
// settlement inside a state that is recomputed more than once; a roll taken at settlement
// would answer differently each time, and a sealed one cannot). It is also why settleProp()
// needs no rng and therefore no signature change to settleWager(), which engine/tickEngine.js
// calls with two arguments and which is not a file this change may touch.
//
// The chance and the price are frozen alongside it for the same reason the moneyline freezes
// its odds: the player was quoted a line, and the line is what they get.
function placePropBet(state, options = {}, rng = Math.random) {
  if (propUnavailableReason(state)) return state;

  const offer = propOffers(state).find((o) => o.id === options.offerId);
  if (!offer) return state;

  // Re-clamped unconditionally, whatever the caller asked for. This line is the invariant.
  const amount = clampPropBet(balanceOf(state.wallet, 'cash'), options.amount);
  if (amount < MIN_PROP_BET) return state;

  const slice = bookieSlice(state);

  return {
    ...state,
    wallet: debitWallet(state.wallet, 'cash', amount),
    bookie: {
      ...slice,
      prop: {
        offerId: offer.id,
        text: offer.text,
        amount,
        winChance: offer.winChance,
        payoutMult: offer.payoutMult,
        reputation: offer.reputation,
        roll: rng(),
        placedAtClock: state.clock || 0,
      },
    },
  };
}

// Settles the pending prop against the sealed roll. Called from settleWager(), which
// engine/tickEngine.js already runs once per resolved game — so a prop settles on the next game
// to be played, exactly like a moneyline, and an offline catch-up settles it on the first of
// however many games it resolved rather than once per game.
//
// Returns the state unchanged when there is nothing pending, which is what keeps settleWager()
// an identity function in the acts that have no Bookie at all. The pending prop is cleared in
// the same write that pays it, so there is no window in which it could settle twice.
function settleProp(state) {
  const slice = bookieSlice(state);
  const prop = slice.prop;
  if (!prop) return state;

  const won = prop.roll < prop.winChance;
  const payout = won ? Math.round(prop.amount * prop.payoutMult) : 0;

  // THE REPUTATION, AND WHY IT IS READ OFF THE BET RATHER THAN RECOMPUTED. `prop.reputation` was
  // frozen at placement next to the odds. A bet written down before this shipped has no such field
  // and falls back to the current rate — saves are never migrated in this codebase, and a wager in
  // flight across a reload must settle to something rather than to NaN.
  //
  // Reputation is NOT a wallet currency. It is a plain number on the root state that
  // engine/modifiers.js turns into a team-strength multiplier, so it is written directly, the same
  // way engine/concessions.js writes it — and read through the guarded idiom in modifiers.js, since
  // a save can reach this line with the field absent.
  const reputationWon = won
    ? Number.isFinite(prop.reputation)
      ? prop.reputation
      : propReputationFor(prop.payoutMult)
    : 0;
  const reputation =
    (typeof state.reputation === 'number' ? state.reputation : balanceConfig.startingReputation) + reputationWon;

  // Same contract as the moneyline above, into a DIFFERENT counter: the prop board quotes a much
  // wider spread of multipliers, so sharing one would make the moneyline's achievement farmable off
  // the other page (PRD §5.4).
  return recordWagerSettled({
    ...state,
    reputation,
    wallet: payout > 0 ? creditWallet(state.wallet, 'cash', payout) : state.wallet,
    bookie: {
      ...slice,
      prop: null,
      propWins: slice.propWins + (won ? 1 : 0),
      propLosses: slice.propLosses + (won ? 0 : 1),
      propNet: slice.propNet + (payout - prop.amount),
      lastPropResult: {
        won,
        text: prop.text,
        amount: prop.amount,
        payout,
        // What the fence saw. Carried on the result so the panel and the feed report the same
        // number the settlement actually credited, rather than re-deriving it from the multiplier.
        reputation: reputationWon,
        // Net cash swing, so the panel never re-derives it from the multiplier.
        delta: payout - prop.amount,
        payoutMult: prop.payoutMult,
        settledAtClock: state.clock || 0,
      },
    },
  }, { won, payoutMult: prop.payoutMult, prop: true });
}

// Presentation-ready view of the prop board, folded into bookieView() below. Everything the
// panel needs to render and nothing it has to compute.
function propBoardView(state) {
  const slice = bookieSlice(state);
  const ceiling = maxPropBet(state);
  return {
    offers: propOffers(state),
    pending: slice.prop,
    maxBet: ceiling,
    minBet: MIN_PROP_BET,
    unavailableReason: propUnavailableReason(state),
    record: { wins: slice.propWins, losses: slice.propLosses, net: slice.propNet },
    lastResult: slice.lastPropResult,
  };
}

// Presentation-ready view of the table. The panel renders this and decides nothing about
// odds, ceilings or availability itself (the same contract as engine/wallBall.js's
// challengeView).
function bookieView(state, modifiers) {
  const slice = bookieSlice(state);
  const matchup = nextMatchup(state, modifiers);
  const ceiling = maxWager(state);
  const floor = wagerFloor(state);

  return {
    matchup,
    wager: slice.wager,
    maxWager: ceiling,
    minWager: MIN_WAGER,
    floor,
    cash: balanceOf(state.wallet, 'cash'),
    unavailableReason: unavailableReason(state, modifiers),
    record: { wins: slice.wins, losses: slice.losses, net: slice.net },
    lastResult: slice.lastResult,
    // The second page. Deliberately its own sub-object with its own availability reason, so an
    // open moneyline cannot hide the prop board and vice versa.
    props: propBoardView(state),
    sides: matchup
      ? [
          {
            id: SIDE_FOR,
            label: 'On your team',
            chance: matchup.playerWinProbability,
            payoutMult: payoutMultFor(matchup.playerWinProbability, SIDE_FOR),
          },
          {
            id: SIDE_AGAINST,
            label: 'Against your team',
            chance: 1 - matchup.playerWinProbability,
            payoutMult: payoutMultFor(matchup.playerWinProbability, SIDE_AGAINST),
          },
        ]
      : [],
  };
}

module.exports = {
  bookieSlice,
  passiveCashPerSecond,
  wagerFloor,
  maxWagerFor,
  maxWager,
  clampWager,
  nextMatchup,
  payoutMultFor,
  hasOpenWager,
  unavailableReason,
  placeWager,
  settleWager,
  refundOpenWager,
  bookieView,
  // The prop board.
  nextGameSlot,
  propOfferSeed,
  propPayoutMultFor,
  propOffers,
  maxPropBetFor,
  maxPropBet,
  clampPropBet,
  hasOpenProp,
  propUnavailableReason,
  placePropBet,
  settleProp,
  propBoardView,
};
