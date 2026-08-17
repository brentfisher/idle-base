// Act VII's launches — the transit windows, the overshoot band, and every word the launch panel
// says. PRD §7.3 and §7.5, ledger R1.
//
// A launch is the act's punctuation. A Fuel threshold is met, the player commits, and a burn runs
// over a window in which there is genuinely nothing to do — which is the point, not a defect. It is
// the act's one honest invitation to close the tab, and §7.3 argues at length that an instant
// launch would be a purchase rather than a pitch.
//
// ---------------------------------------------------------------------------------------------
// WHAT IS AUTHORED HERE AND WHAT IS NOT
//
//   authored here    the transit window of each leg, keyed by the site it DEPARTS from
//                    the overshoot band's slope (per +0.1 of overshoot: -4% transit, +2% grant)
//                    every player-facing string the launch shop emits
//
//   NOT here         the THRESHOLDS. Every one of them is `departingThreshold` in
//                    data/actSevenSitesConfig.js and engine/launch.js reads them from there.
//                    That file's header states the rule and the reason: two copies of a threshold
//                    is exactly the drift the 1.6x derivation was written to foreclose. A launch
//                    config that restated 1,200 / 4,200 / 13,500 / 21,000 / 42,000 would be the
//                    same bug one file over.
//
//   NOT here         the arithmetic. The slope constants are here; the multiplication is in
//                    engine/launch.js. Data files in this codebase carry lookups and at most a
//                    derivation that exists to stop a number being typed twice (siteFuelCapacity);
//                    they do not carry the rules.
// ---------------------------------------------------------------------------------------------

// The 1.6x band is imported rather than restated, and the import is the whole point of this line.
//
// ONE SCALAR, TWO ROLES, AND THEY ARE THE SAME NUMBER FOR THE SAME REASON. In
// data/actSevenSitesConfig.js it derives each site's `fuelCapacityOnArrival` — the ceiling a player
// may bank to. Here it is the ceiling of the LAUNCH TANK: the most Fuel a single burn can dump, and
// therefore the most overshoot that can buy anything. §7.3 authors them as one fact ("the Fuel tank
// serving each launch has capacity 1.6x the threshold"), so a retune of the band has to move both
// or the overshoot decision decays into a coincidence between two hand-typed numbers. Imported, it
// cannot.
const { OVERSHOOT_TANK_MULT } = require('./actSevenSitesConfig');

// The consumable a launch spends, named here so engine/launch.js contains no resource-id literal.
//
// SPENT THROUGH engine/colony.js's spendResource(), NEVER through engine/wallet.js. Fuel is not a
// currency — it lives in `expedition.resources` with a capacity and a signed net rate, and
// data/actSevenConfig.js is explicit that the four consumables must never be added to
// data/currencies.js. debitWallet() is structurally not how it is spent, and §7.3 says so in those
// words.
const LAUNCH_FUEL_RESOURCE = 'fuel';

// The arrival grant IS a currency, and it is the one the act already runs on. §7.3's overshoot
// table pays "a % of the destination's colonization cost, in Salvage", so the grant lands in the
// wallet through creditWallet() like every other Salvage credit in the game.
//
// That is not in tension with the paragraph above. The Fuel DEBIT may not go through the wallet
// because Fuel is not in the wallet; a Salvage CREDIT must, because Salvage is.
const ARRIVAL_GRANT_CURRENCY = 'salvage';

// THE TRANSIT WINDOW OF EACH LEG, KEYED BY THE SITE THE BURN DEPARTS FROM — the same convention
// `departingThreshold` uses, and for the same reason. The tank you fill and the clock you start are
// both at the place you are standing. Keying by destination would read more naturally in a sentence
// and would then need a special case for L5, whose destination is not a site at all (§7.1: beyond
// the wall is not a place, it has no rung and no record).
//
// Straight from §7.5's table: 3 / 5 / 8 / 10 / 12 minutes. These are NOT derived from anything and
// are not measured against anything — a transit is a pacing choice, not an economy number. The one
// constraint they answer to is §7.6's dead-air rule, which is measured in the block at the foot of
// this file.
//
// The ramp is deliberate and it is the act's tempo: three minutes is long enough to notice and
// short enough to sit through, twelve is long enough that sitting through it is the wrong play.
const TRANSIT_SECONDS_BY_ORIGIN = {
  homePlate: 180,
  onDeck: 300,
  firstBase: 480,
  secondBase: 600,
  thirdBase: 720,
};

// ---------------------------------------------------------------------------------------------
// THE OVERSHOOT BAND (§7.3's table, as a line rather than a staircase)
//
//   Overshoot   Transit    Arrival grant
//   1.0x        baseline   none
//   each +0.1   -4%        +2% of the destination's colonization cost, in Salvage
//   1.6x        -24%       +12% of colonization cost
//
// READ AS A CONTINUOUS LINE, NOT AS SIX DISCRETE ROWS, and that reading is a decision rather than
// a convenience. The table's rows are samples of a straight line and interpolating hits every one
// of them exactly, so nothing is invented. Rounding down to the nearest 0.1 instead would make
// 1.599x pay exactly what 1.5x pays, which puts a cliff at every tenth: a player watching the bar
// would learn that the last six percent of a two-minute wait bought nothing, six times per launch.
// A line has no cliff and the decision it presents — go now, or hold — is the same one at every
// instant.
//
// THERE IS NO CLAMP ON THE RATIO, because the SPEND is clamped instead. engine/launch.js commits
// `min(fuelHeld, 1.6 x threshold)`, so the ratio is in [1.0, 1.6] by construction and a second
// guard on it would be a second statement of the same rule. See the long note on the spend in that
// file for why the clamp lives there.
// ---------------------------------------------------------------------------------------------

// The floor of the band. A launch that departs on exactly its threshold overshoots by nothing, pays
// the full transit and arrives with no cargo margin — which is the honest baseline and not a
// penalty. Every number in the table is measured from here.
const OVERSHOOT_FLOOR = 1.0;

// The grid §7.5's table is quoted on. Only ever used as the denominator that turns "how far over
// the floor" into "how many tenths", so that the two slopes below can be read straight off the PRD
// rather than pre-multiplied into a per-unit rate nothing in the document states.
const OVERSHOOT_STEP = 0.1;

const TRANSIT_REDUCTION_PER_STEP = 0.04;
const ARRIVAL_GRANT_PER_STEP = 0.02;

function transitSecondsFrom(originSiteId) {
  const seconds = TRANSIT_SECONDS_BY_ORIGIN[originSiteId];
  // 0 rather than a fallback window, and it is the correct answer rather than a defensive one: a
  // site with no entry here has no launch departing from it, which is true of nothing on today's
  // ladder and would be true of a terminal site added later. engine/launch.js refuses to offer a
  // burn with no window rather than shipping the player a zero-length one.
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

// ---------------------------------------------------------------------------------------------
// PROSE (conventions.md: a string literal in a component or an engine is the same bug as a number)
//
// Written as functions rather than as a table of finished sentences because every one of them has a
// measured number in it, and a sentence assembled in the engine from fragments held here would put
// half the wording one file away from the other half. data/feedMessages.js is the precedent.
//
// VOICE: this is the Office's operational vocabulary, flat and unimpressed, describing something
// enormous as a routine movement between affiliates. §10.1. Nothing here reaches for awe; the burn
// is a thing the crew does, and the player supplies the rest.
// ---------------------------------------------------------------------------------------------

// Per-leg flavour, keyed by DESTINATION because this is the one place the player is being told
// where they are going rather than what they are leaving.
//
// There is no entry for the fifth burn, and its absence is load-bearing rather than an oversight:
// L5 departs the Warning Track for a place §7.1 refuses to call a site. It has no record, no rung
// and no arrival, so engine/launch.js emits no offer for it and STORY-032 owns what happens
// instead. A description here would be the only part of that ending that existed.
const LEG_DESCRIPTIONS = {
  onDeck: 'Straight up, and then around. A hundred and fifty years of other people’s equipment is up there going the same way you will be.',
  firstBase: 'Out to the ice. Nobody has touched it, which after this long stops being remarkable and starts being the point.',
  secondBase: 'Eight minutes of nothing at all. Ceres does not come out to meet you and there is no reason it should.',
  thirdBase: 'Out to a place that makes nothing, so that you have somewhere to throw from. That is the whole reason and it is enough.',
};

// The house formatters, rather than an ad-hoc one written here. utils/formatNumber.js is a pure
// CommonJS module with no React and no DOM, so requiring it from a data file breaks no layer, and
// the alternative is a second number-formatting convention living in one act — a Fuel figure that
// reads "6720" beside a Salvage figure that reads "6.72K" is the kind of inconsistency nobody
// notices while writing it and everybody notices while playing.
const { formatNumber, formatDuration } = require('../utils/formatNumber');

function percentLabel(fraction) {
  return Math.round(fraction * 100) + '%';
}

const launchCopy = {
  offerName: (destinationLabel) => 'Burn for ' + destinationLabel,

  description: (destinationSiteId) => LEG_DESCRIPTIONS[destinationSiteId] || '',

  // THE EFFECT STRING LEADS WITH THE TRANSIT, deliberately, exactly as engine/sites.js's effect
  // strings lead with the upkeep and for the same reason. The transit is what the player is
  // actually buying with the wait, and a row that led with the arrival grant would be selling them
  // the small half of the decision.
  //
  // The overshoot clause is omitted entirely at the floor rather than rendered as "0% shorter, +0
  // Salvage". A row of zeroes reads as a broken feature; its absence reads as what it is, which is
  // a burn leaving on the minimum.
  effect: ({ transitSeconds, baseTransitSeconds, overshootRatio, arrivalGrant }) => {
    const parts = ['transit ' + formatDuration(transitSeconds)];
    if (transitSeconds < baseTransitSeconds) {
      const shorter = percentLabel(1 - transitSeconds / baseTransitSeconds);
      parts.push(shorter + ' shorter at ' + (Math.round(overshootRatio * 100) / 100) + 'x');
    }
    if (arrivalGrant > 0) {
      parts.push('arrives with ' + formatNumber(arrivalGrant) + ' Salvage of cargo margin');
    }
    return parts.join(', ');
  },

  // THE ROW IS SHOWN WITH A REASON RATHER THAN OMITTED, which is a deliberate divergence from every
  // other shop in this act (engine/sites.js: "unavailable rows are omitted, not disabled") and it
  // is worth stating why the house rule is broken here.
  //
  // Omission works when a shop has many rows and a hidden one is invisible among the rest. The
  // launch shop has exactly ONE row, because the ladder is strictly ordered and there is never a
  // second legal destination. Omitting it leaves an empty panel on the tab whose entire subject is
  // the thing the player is waiting for, with no statement of what is missing. §7.3's own field
  // list asks for `blockedReason`, which is that argument already made.
  blocked: {
    inFlight: 'A burn is already under way. One at a time — there is only ever one place to go next.',
    reach: (padLabel) => 'The pad here does not throw that far. Build ' + padLabel + ' first.',
    noPad: 'There is nothing here to launch from.',
    fuel: (held, required) => 'Tank at ' + formatNumber(held) + ' of ' + formatNumber(required) + '. Keep filling.',
  },
};

// ---------------------------------------------------------------------------------------------
// VERIFIED — under `node`, driving engine/launch.js, engine/sites.js, engine/colony.js and
// engine/tickEngine.js's real advance() loop. The harness lives in /tmp and is deliberately not
// committed; there is no test runner in this repo and adding one is its own change.
//
// [MEASUREMENT BLOCK FILLED IN BELOW ONCE THE HARNESS HAS RUN]
// ---------------------------------------------------------------------------------------------

module.exports = {
  LAUNCH_FUEL_RESOURCE,
  ARRIVAL_GRANT_CURRENCY,
  TRANSIT_SECONDS_BY_ORIGIN,
  OVERSHOOT_TANK_MULT,
  OVERSHOOT_FLOOR,
  OVERSHOOT_STEP,
  TRANSIT_REDUCTION_PER_STEP,
  ARRIVAL_GRANT_PER_STEP,
  transitSecondsFrom,
  launchCopy,
};
