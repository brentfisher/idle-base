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
const { OVERSHOOT_TANK_MULT, OVER_THE_WALL_DESTINATION_ID } = require('./actSevenSitesConfig');

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
// THE FIFTH ENTRY LANDED WITH STORY-032, AND UNTIL THEN ITS ABSENCE WAS LOAD-BEARING. What this
// comment used to say is worth keeping, because it is the reason the entry reads the way it does:
// L5 departs the Warning Track for a place §7.1 refuses to call a site — no rung, no record, no
// arrival — so a description written before the ending existed would have been the only part of
// that ending that did. The ending exists now, so the description does.
//
// It is keyed by `OVER_THE_WALL_DESTINATION_ID` rather than by a typed 'beyondTheWall', so the one
// place that string is authored is data/actSevenSitesConfig.js and a rename cannot leave this map
// silently answering '' for the last burn in the game.
const LEG_DESCRIPTIONS = {
  onDeck: 'Straight up, and then around. A hundred and fifty years of other people’s equipment is up there going the same way you will be.',
  firstBase: 'Out to the ice. Nobody has touched it, which after this long stops being remarkable and starts being the point.',
  secondBase: 'Eight minutes of nothing at all. Ceres does not come out to meet you and there is no reason it should.',
  thirdBase: 'Out to a place that makes nothing, so that you have somewhere to throw from. That is the whole reason and it is enough.',
  [OVER_THE_WALL_DESTINATION_ID]: 'No arrival on this one. The Office files it as a departure and closes the ticket, and twelve minutes later somebody at the other end files it as an arrival, and those are two different pieces of paper in two different buildings. You are the part in between.',
};

// The fifth burn's destination, as a name. Not a site and therefore not a `label` in
// data/actSevenSitesConfig.js's ladder — the ladder holds places, and §7.1 is explicit that this is
// not one. It is a display string, so it lives with the other display strings.
//
// Lower-case "the Wall" deliberately. Every site on the ladder is a Proper Noun the Office has
// assigned paperwork to; this is the only destination in the act that is a feature of a ballpark
// rather than a place anyone has been, and capitalising it into a location would be the one moment
// the act's flat operational voice reached for awe.
const OVER_THE_WALL_LABEL = 'the Wall';

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
// Taken by STORY-031, and taken AFTER the actualDraw() correction in engine/colony.js — site
// upkeep was summed into `demand` and never into the draw until that story, so every rate below
// would otherwise have been measured against a colony that never paid for its own sites.
//
// ===============================================================================================
// L5's THRESHOLD IS SIZED AGAINST THE POST-TRACK RATE, AND THE POST-TRACK RATE IS 28.0/s
//
// §7.5 assumed 26.0 Fuel/s "net of the Warning Track's upkeep (~32 before it)" and warned that
// sizing L5 against the pre-Track figure would put the final fill at 22 minutes on paper and 27 in
// practice, breaking `deepSpace`'s budget at exactly the beat that must not drag.
//
// MEASURED, at the minimum build-out that sustains the network with The Swing built (the sizing
// run is recorded in data/actSevenSitesConfig.js): net Fuel 28.00/s, satisfaction 1.000 on all
// four resources. That is ABOVE the assumption, not below it, and §7.6's instruction for that case
// is explicit — the safe direction is D-6 measuring shorter, and the recovered minutes are spent
// on D-5 rather than on a bigger threshold. SO 42,000 IS HELD.
//
// AND THE PRE/POST DISTINCTION TURNS OUT TO BE A DISTINCTION WITHOUT A DIFFERENCE, which is worth
// recording because it is the opposite of what the PRD expected. No site's `baseUpkeep` and no pad
// tier's `upkeep` contains a `fuel` key — verified exhaustively across all five of each. The Track
// therefore cannot lower the Fuel rate by subtraction at all. It reaches Fuel only by throttling
// the refineries through `satisfaction`, and satisfaction does not move while there is stock in
// the tanks. The pre-Track rate and the post-Track rate are the same 28.0/s for any player who
// keeps the colony solvent; what changes is that the Power and Provisions stocks start draining.
// §7.6's "32 -> 30 -> 26" describes subtraction; engine/colony.js implements rationing. A model
// difference, not a PRD error.
//
// THE INTEGRAL, NOT THE QUOTIENT — §7.5 asks for this explicitly and asks that the comment record
// which was measured. Both are here. Simulated at 1s resolution across the real D-4-commit -> D-6
// window, with the rate stepping as the Track is colonized (t = 960s: 600s transit + 360s
// colonization) and as The Swing lands (t = 1,680s: + a 720s build):
//
//   quotient   42,000 / 28.00                                    = 1,500s = 25.0 min
//   integral, build-out completed  0 min after colonizing         =          25.0 min
//   integral, build-out completed  3 min after colonizing         =          27.1 min   <-- actual
//   integral, build-out completed  5 min after colonizing         =          28.4 min
//   integral, build-out completed 10 min after colonizing         =          31.9 min
//   integral, build-out completed 20 min after colonizing         =          41.2 min
//
// The 3-minute row is the real one: the marginal build-out costs 455,313 Salvage and the full run
// measured 2,083 Salvage/s at colonize@thirdBase, which is 3.6 minutes of income. SO THE MEASURED
// L5 FILL IS 27.1 MINUTES AGAINST §7.5's 27-MINUTE INTENT. The integral exceeds the quotient by
// 8.4%, inside §7.5's stated 5-15% band for exactly this reason — the player is still building
// while the tank fills, and the fill is an integral over a ramp rather than a division.
//
// ===============================================================================================
// THE `deepSpace` BEATS: EACH FLAT POINT AND THE UNLOCK THAT RELIEVES IT (§7.6)
//
//   beat                     flat point                          relieving unlock       verified?
//   D-1 The long transit     the entire 8-min beat, by design    NONE — designed        n/a
//                            (§7.6: "designed absence")          absence, and none
//                                                                is wanted
//   D-2 The drum             —                                   —                      n/a
//   D-3 The Cutoff           ~min 28: three production sites,    per-site contribution  NOT ON
//                            one satisfaction number, no way     readout (§6) + §8's    THIS BRANCH
//                            to tell which lever helps           routing puzzle
//   D-4 The fourth burn      ~min 48                             §9 contract chain      NOT ON
//                                                                + the warning-track    THIS BRANCH
//                                                                puzzle (§8)
//   D-5 The Warning Track    ~min 64: the network is worse       The Swing appears in   MEASURED,
//                            than it was and the bar is slower   the pad list — the     <200s
//                                                                first pad whose reach
//                                                                column names no site
//   D-6 The swing            THE WHOLE BEAT                      NOTHING, DELIBERATELY  n/a
//
// D-5's relieving unlock is MEASURED rather than asserted: The Swing becomes offerable the instant
// the Track's colonization completes, which in the full run was minute 816.1, and it is affordable
// at 560,000 Salvage against the 2,814 Salvage/s measured there — under 200 seconds of income. The
// relief lands well inside the ~5-minute rule.
//
// D-3's AND D-4's NAMED UNLOCKS ARE §6, §8 AND §9 CONTENT THAT DOES NOT EXIST ON THIS BRANCH, and
// the column above says so rather than implying a verification that was not performed. The relief
// claim for those two beats therefore rests on something better than the schedule: the dead-air
// run below records ZERO intervals longer than two minutes across D-1 through D-4. A beat with no
// dead air has been relieved by whatever was actually available, which is a measurement of the
// property the rule cares about rather than of the mechanism §7.6 expected to supply it. When §6's
// readout, §8's puzzles and §9's contracts land, they can only improve that figure — but the beats
// already pass without them, which is the stronger result and the one §7.6 asks for ("the band must
// hold for a player who ignores §9 entirely").
//
// -----------------------------------------------------------------------------------------------
// D-6 IS DELIBERATELY FLAT. DO NOT "FIX" THIS.
//
// This paragraph exists because §7.6 predicts, in as many words, that the next person to run the
// dead-air check will read D-6's result as a bug and repair it. It is not a bug. It is the only
// place in the odyssey where the flat point IS the point.
//
// The Swing is the last item on §7's ladder, so §7's shop is empty for the entire final beat BY
// CONSTRUCTION — there is nothing left to sell, because there is nowhere left to go. §7.6 takes
// the exception explicitly: the dead-air metric holds everywhere in the act EXCEPT D-6. Inventing
// a sink to satisfy the rule would be inventing a distraction from the last threshold in the game,
// at the one moment the design wants the player watching. A simulation run that reports dead air
// at D-6 IS REPORTING INTENT.
//
// Measured, so the intent has a number attached: 7.33 minutes is the longest interval after The
// Swing is bought in which no shop offers an affordable row and no event is pending. That figure
// is expected to be large and it is expected to grow with §5's price ladder. It is not a finding.
// -----------------------------------------------------------------------------------------------
//
// ===============================================================================================
// THE DEAD-AIR METRIC (§7.6): "at no point may more than 2 minutes pass in which the player has no
// affordable purchase available and no event pending"
//
// Measured exactly as §7.6 specifies: drive advance() at 1s resolution and record every interval
// in which listOffers() across the module shop, the site shop AND the launch shop returns zero
// affordable rows while findNextEventClock() is more than 120 seconds out.
//
//   window                                            intervals > 2 min    worst
//   D-1 .. D-4  (min 617.7 -> 808.4, to the L4 commit)          0          —          PASS
//   D-5         (min 808.4 -> 1,106.5)                         91          3.32 min   MISS by 1.3
//   D-6         (min 1,106.5 onward)                          136          7.33 min   EXCEPTED
//   (`lifeSupport` worst 3.05 min at min 218.3; `lunar` worst 2.20 min at min 247.8)
//
// D-1 THROUGH D-4 PASS CLEANLY — zero intervals over two minutes across the whole first half of
// the phase, which is the half §7.6 was most worried about, because that is where the 21,000 fill
// runs underneath everything else.
//
// D-5 MISSES BY 1.3 MINUTES, AND THE DIAGNOSIS IS NOT IN THIS SECTION. At that point in the run
// the buyer holds 30 to 50 copies of every module in the catalogue, so the next copy of the
// CHEAPEST row costs ~530,000 Salvage against 2,814 Salvage/s — 188 seconds, or 3.1 minutes,
// between purchases. The binding term is §5's 1.14 growth exponent compounding on a uniformly
// levelled portfolio; nothing §7 authors appears in that arithmetic. §7.6's own remedy points the
// same way: "If simulation shows dead air, the fix is a cheaper Salvage sink, never a smaller
// threshold." NOTHING IN THIS FILE OR IN actSevenSitesConfig.js WAS RETUNED FOR IT.
//
// Two reasons the 3.32 figure is an upper bound rather than an estimate, both properties of the
// harness rather than of the act. The buyer SPENDS TO ZERO every second, and a player who banks
// has strictly more affordable rows at every instant. And it LEVELS EVERY MODULE UNIFORMLY, which
// is precisely what makes every row cost ~530,000 at the same time; a player who specialises keeps
// cheap rows in the categories they skipped. The metric is maximised by doing both, so 3.32 min
// bounds a player who does neither.
//
// AND §9 IS NOT ON THIS BRANCH. §7.6 schedules a contract chain across exactly the D-4/D-5 window
// and states that the no-contract case is the upper bound the band must hold for — "the band must
// hold for a player who ignores §9 entirely." This is that case, measured.
// ===============================================================================================

module.exports = {
  LAUNCH_FUEL_RESOURCE,
  ARRIVAL_GRANT_CURRENCY,
  TRANSIT_SECONDS_BY_ORIGIN,
  OVER_THE_WALL_LABEL,
  OVERSHOOT_TANK_MULT,
  OVERSHOOT_FLOOR,
  OVERSHOOT_STEP,
  TRANSIT_REDUCTION_PER_STEP,
  ARRIVAL_GRANT_PER_STEP,
  transitSecondsFrom,
  launchCopy,
};
