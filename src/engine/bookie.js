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
// Pure — no React, no DOM. Every number comes from data/actFourConfig.js. `rng` is not needed:
// the wager is settled by the game the tick loop was going to simulate anyway, so the Bookie
// adds no new randomness of its own — it just prices what is already there.
const { winProbability } = require('./gameSim');
const balanceConfig = require('../data/balanceConfig');
const { PLAYER_TEAM_ID } = require('./schedule');
const { getTeamStrength } = require('./strength');
const { creditWallet, debitWallet, balanceOf } = require('./wallet');
const { concessionsPerSecond } = require('./concessions');
const { sponsorshipsPerSecond } = require('./sponsorships');
const { clamp } = require('../utils/statUtils');
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

// Every read of the Act IV bookie slice goes through this. A save written before the Bookie
// existed has no slice, and this codebase tolerates an absent slice rather than migrating it.
function bookieSlice(state) {
  const slice = (state && state.bookie) || {};
  return {
    wager: slice.wager || null,
    wins: slice.wins || 0,
    losses: slice.losses || 0,
    net: slice.net || 0,
    lastResult: slice.lastResult || null,
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
function settleWager(state, playerWon) {
  const slice = bookieSlice(state);
  const wager = slice.wager;
  if (!wager) return state;

  const won = wager.side === SIDE_AGAINST ? !playerWon : !!playerWon;
  const payout = won ? Math.round(wager.amount * wager.payoutMult) : 0;

  return {
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
  };
}

// A wager cannot survive the season it was placed in: the schedule it referred to is gone.
// Called from the offseason transition. Refunded rather than voided — the game it was placed
// on was never played, and taking a player's money for a fixture that did not happen is the
// one loss the bounded-loss invariant would not explain.
function refundOpenWager(state) {
  const slice = bookieSlice(state);
  if (!slice.wager) return state;
  return {
    ...state,
    wallet: creditWallet(state.wallet, 'cash', slice.wager.amount),
    bookie: { ...slice, wager: null },
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
};
