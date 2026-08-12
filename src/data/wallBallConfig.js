// Act II — Off the Wall. Every Act II number lives here; engine/wallBall.js contains the
// rules and none of the tuning.
//
// Strengths below are on the same scale engine/gameSim.js: winProbability() consumes, with
// balanceConfig.eloK = 15. That K is steep on purpose for team-vs-team play — a 15-point gap
// is already a 9% game — which is exactly why engine/wallBall.js bands the gap before using
// it (see GAP_BAND).

// The player's strength going into a rally. The kit is what Act I bought, so gear is the
// axis the player actually moved; the crew backing them up is worth a little on top.
const KIT_BASE_STRENGTH = 28;
const KIT_ITEM_STRENGTH = 2; // full Starter Kit (3 items) => 34
const CREW_STRENGTH_PER_MEMBER = 1; // full crew (3) => 37

// How far the player-vs-challenger gap is allowed to move the odds before the approach
// delta is applied. Un-banded, Showboat swings from ~10% loss fully geared to ~70% loss
// un-geared, so the "genuinely bad decision" is either free or fatal by accident; banded,
// it stays a 30-41% loss across every gear/crew/challenger combination while gearing up
// still visibly helps. The band, not the approach, is what makes the risk legible.
const GAP_BAND = 1.5;

// Absolute belt-and-braces bounds on the resolved probability: no challenge is ever a
// certainty in either direction, whatever a future challenger or bonus does to the gap.
const MIN_WIN_PROBABILITY = 0.05;
const MAX_WIN_PROBABILITY = 0.95;

// The three approaches are strength deltas, not hard-coded odds, so they compose with the
// banded gap through the one probability model in the game.
//   delta 11.3 => 15% loss, 7.2 => 25%, 4.0 => 35% (at eloK 15, before banding).
// `payoutMult` is the TOTAL returned on a win, stake included, so net winnings are
// stake * (payoutMult - 1). Caps EV per stake is p * payoutMult - 1: +0.275 / +0.500 /
// +0.950. Showboat's caps EV is the highest and that is deliberate — what makes it a bad
// greedy decision is drawdown, not EV. Losing three max stakes in a row costs 58% of the
// bankroll and it happens 4.3% of the time; the same run on Safe happens 0.3% of the time.
// Respect runs the other way per unit of risk taken, so Safe is the line you grind caps on
// and Showboat the line you grind crew on, and neither dominates.
const APPROACHES = [
  {
    id: 'safe',
    name: 'Play it straight',
    description: 'Meet the ball. Nothing fancy, nothing dropped.',
    strengthDelta: 11.3,
    payoutMult: 1.5,
    respect: 2,
  },
  {
    id: 'normal',
    name: 'Just play',
    description: 'Take your cuts and see what the wall gives back.',
    strengthDelta: 7.2,
    payoutMult: 2,
    respect: 3,
  },
  {
    id: 'showboat',
    name: 'Showboat',
    description: 'Called shot, behind the back, the whole block watching.',
    strengthDelta: 4,
    payoutMult: 3,
    respect: 5,
  },
];

const DEFAULT_APPROACH_ID = 'normal';

// The line of kids waiting their turn. Strength spread is deliberately wider than GAP_BAND
// so the band is what is doing the work, not the roster of challengers.
const CHALLENGERS = [
  {
    id: 'reese',
    name: 'Tommy Reese',
    strength: 30,
    taunt: 'He buys your caps for a penny. He thinks that makes him your boss.',
  },
  {
    id: 'delgado',
    name: 'Ana Delgado',
    strength: 33,
    taunt: 'Left-handed, and she has never once swung at a bad one.',
  },
  {
    id: 'boyle',
    name: 'Skip Boyle',
    strength: 36,
    taunt: 'Two years older and he will remind you of it every pitch.',
  },
  {
    id: 'whitaker',
    name: 'June Whitaker',
    strength: 39,
    taunt: 'Nobody has beaten her at this wall. Nobody has come close.',
  },
];

// A stake is a fraction of CURRENT caps, never a flat amount. At 1.0 that fraction is
// everything you are holding: you can shove the whole jar onto one rally and lose it.
//
// This was 0.25, then 0.4, and is now deliberately uncapped at the player's request — "let
// people bankrupt themselves if they want". A ceiling below 1.0 is paternalism in a game whose
// entire Act II fantasy is a kid betting his bottle caps against the kid at the wall, and the
// interesting decision — how much of it do I actually put up? — only exists if the top of the
// slider is genuinely all of it. The stake slider still starts well below the maximum, so
// going all in stays a thing you choose rather than a thing you do by accident.
//
// WHAT THIS DOES NOT BREAK. Going broke is not the same as being stuck, and only the second
// one is forbidden (PRD §6.4, design Decision 6, conventions.md "Hard Invariants"). The
// guarantee was never that losses are small; it is that any state is recoverable in bounded
// time, and that rests entirely on the Hustle click, which is never gated on anything and
// pays whether you have 0 caps or 10,000 (engine/clicker.js). A player who loses everything
// is a short click away from MIN_STAKE and back at the wall. The other two structural halves
// of the invariant are untouched: no currency may go below zero (every write goes through
// engine/wallet.js), and clampStake() is still the ONLY way a stake is computed, with the
// reducer re-clamping whatever the UI sent, unconditionally.
//
// MIN_STAKE is what stops a broke player farming Respect off free zero-stake challenges:
// under 8 caps there is nothing to wager, and the answer is the Hustle button. It also means
// you have to build a bankroll before you can play at all, which is what makes the Act II
// shop worth visiting rather than optional.
const STAKE_MAX_FRACTION = 1;
const MIN_STAKE = 8;

// Seconds between challenges — the line of kids, and the whole of Act II's pacing.
// Attempts to a full crew are RESPECT_THRESHOLDS[2] / (win rate * approach respect):
// Safe 35.3, Normal 26.7, Showboat 18.5. At 22s that is 12.9 / 9.8 / 6.8 minutes, with the
// default Normal line inside the 8-12 minute target and crew #1 landing at 6.7 attempts.
const CHALLENGE_COOLDOWN_SECONDS = 22;

// Respect shortens the walkup. The line of kids is the pacing, and being known on the block is
// what makes the next one stop waiting to be asked — so the cooldown is scaled by
// (1 - respect * RESPECT_COOLDOWN_REDUCTION_PER_POINT), floored at MIN_COOLDOWN_FRACTION of the
// base. Multiplicative on the base rather than a flat subtraction, so retuning
// CHALLENGE_COOLDOWN_SECONDS retunes the whole curve and the floor stays a stated fraction.
//
// THIS IS RESPECT'S THIRD RETURN and the numbers are small on purpose. Respect already pays
// through RESPECT_CAPS_BONUS_PER_POINT (+81% passive caps at 54) and through RESPECT_THRESHOLDS,
// which hands over crew, which feeds CREW_STRENGTH_PER_MEMBER into kitQuality AND
// CREW_DUES_PER_SECOND into income. Adding a fourth multiplier to the same stat is how an act
// collapses, so this one is sized to be *felt on the clock* and nowhere near the others:
//
//   At 54 respect (a full crew, which is also Act II's exit at EXIT_CREW_REQUIRED = 3):
//     · passive caps  ×1.81  — unchanged by this constant, it is the caps bonus doing that
//     · walkup        22s -> 22 * (1 - 54*0.005) = 16.1s
//     · rallies/min   2.73 -> 3.74, i.e. the wall half of the economy speeds up ×1.37
//   The two are separate channels — one scales the collectors, one scales how often you may
//   wager — so there is no single combined multiplier, and neither one moves the other.
//
// The number that actually picked 0.005 is time-to-full-crew, since that is the act. Respect
// accrues ~2.02/attempt on the default Normal line (54 respect in 26.7 attempts, per the note
// above), so cooldown(n) ~= 22 * (1 - 0.0101n) and the run integrates to
// 22 * (26.7 - 0.0101 * 26.7^2 / 2) = 508s. Act II's default line goes 9.8 -> 8.5 minutes and
// stays inside the 8-12 minute target; Safe goes 12.9 -> 11.2, Showboat 6.8 -> 5.9. The act
// gets faster without any line falling out of the band it was tuned into.
//
// THE FLOOR IS NOT OPTIONAL. Nothing ends Act II against the player's will — a player may keep
// grinding the wall past 54 respect indefinitely — and an unfloored linear reduction reaches
// zero at 200 respect, at which point the challenge button is a spam button and the Respect
// faucet is unbounded. At 0.6 the walkup bottoms out at 13.2s, which is reached at 80 respect
// (well past the exit, so the floor is a guard rather than a live constraint during the act)
// and is still long enough that a rally is a decision rather than a click.
const RESPECT_COOLDOWN_REDUCTION_PER_POINT = 0.005;
const MIN_COOLDOWN_FRACTION = 0.6;

// Crew size is DERIVED from Respect by counting the thresholds passed, never incremented,
// so a double-dispatch or a replayed action cannot double-recruit.
// Crew #1 comes early on purpose — it is the act teaching you what Respect is for, and at 15
// it arrived about seven challenges in, long after the lesson was needed. The gaps then widen,
// so the last kid is the one you actually work for.
const RESPECT_THRESHOLDS = [6, 24, 54];

// Crew members are real players (engine/playerFactory.js), just simplified ones: they are
// nine years old and only one stat is shown. Being real entities is what lets Act III
// promote them into the roster without fabricating fields.
const CREW_QUALITY_MULT = 0.5;
const CREW_AGE_RANGE = [8, 11];
const CREW_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
// The one stat a crew member is known for, chosen per position — the card shows this and
// nothing else, three acts before the full PlayerCard exists.
const CREW_SIGNATURE_STATS = { P: 'pitching', C: 'defense', SS: 'defense', '2B': 'speed', '3B': 'defense' };
const CREW_DEFAULT_SIGNATURE_STAT = 'power';

// Each crew member kicks in a few caps a second — the `wallBallDues` contributor in
// engine/income.js. Small on purpose: the crew is the act's exit condition, not its economy.
const CREW_DUES_PER_SECOND = 0.25;

// Respect multiplies cap collection: being known on the block is worth something before it is
// worth anything on a field. Applied in engine/income.js to the caps contributors. At 54
// Respect (a full crew) this is +81%, which is felt without replacing the collectors as the
// reason caps arrive at all.
const RESPECT_CAPS_BONUS_PER_POINT = 0.015;

// Respect is spent at the Act III boundary: it becomes state.reputation, which is what the
// franchise game already runs on. 60 Respect (a full crew) => +30 reputation on a base of 20.
const REPUTATION_PER_RESPECT = 0.5;

// Act II's exit, named by data/acts.js as `crewAssembled` and evaluated in
// engine/progression.js.
const EXIT_WINS_REQUIRED = 5;
const EXIT_CREW_REQUIRED = 3;

module.exports = {
  KIT_BASE_STRENGTH,
  KIT_ITEM_STRENGTH,
  CREW_STRENGTH_PER_MEMBER,
  GAP_BAND,
  MIN_WIN_PROBABILITY,
  MAX_WIN_PROBABILITY,
  APPROACHES,
  DEFAULT_APPROACH_ID,
  CHALLENGERS,
  STAKE_MAX_FRACTION,
  MIN_STAKE,
  CHALLENGE_COOLDOWN_SECONDS,
  RESPECT_COOLDOWN_REDUCTION_PER_POINT,
  MIN_COOLDOWN_FRACTION,
  RESPECT_THRESHOLDS,
  CREW_QUALITY_MULT,
  CREW_AGE_RANGE,
  CREW_POSITIONS,
  CREW_SIGNATURE_STATS,
  CREW_DEFAULT_SIGNATURE_STAT,
  CREW_DUES_PER_SECOND,
  RESPECT_CAPS_BONUS_PER_POINT,
  REPUTATION_PER_RESPECT,
  EXIT_WINS_REQUIRED,
  EXIT_CREW_REQUIRED,
};
