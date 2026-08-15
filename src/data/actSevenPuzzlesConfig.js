// Act VII's nine artifacts, their prose, their answers, the hint ladder and the instrument shop —
// PRD §8. Every player-facing string in the puzzle system is in this file and nowhere else; the
// engine carries no literals and no component ever receives an accept list.
//
// THE DESIGN RULE THIS FILE EXISTS TO HOLD (PRD §8.1): the GOAL may be unclear, the FEEDBACK never
// is. Every prompt below prints every number its answer needs, so the player can check their own
// answer before submitting. A puzzle confirmable only by the panel is a guessing game and does not
// ship. That is why the prompts are long and why none of them is edited for brevity: a line trimmed
// out of a prompt is a number the player has to guess at.
//
// ---------------------------------------------------------------------------------------------
// PRICING — DERIVED, NOT AUTHORED. REGENERATE, DO NOT HAND-EDIT.
//
//   R(phase)            = sqrt(entryRate * exitRate)          -- geometric mean of §5.2's band
//   hintCost(tier,phase)= round2sf( HINT_TIER_SECONDS[tier] * R(phase) )
//   itemCost(item)      = round2sf( ITEM_MINUTES[item] * 60 * R(item.availableFrom) )
//   HINT_TIER_SECONDS   = { T1: 8, T2: 26, T3: 80 }            -- the only authored numbers here
//   round2sf            = round to TWO significant figures
//
// Geometric and not arithmetic because Salvage income grows roughly exponentially inside a phase:
// wall time is spread evenly in LOG rate, so the geometric mean is the rate the player spends the
// median minute of the phase at. An arithmetic mean overweights the last ten minutes of every phase
// and prices every hint for a player who no longer needs one.
//
// THE R COLUMN IS LEDGER R8'S, NOT §8.4'S. §8.4's printed table (5.7 / 21.9 / 93.8 / 445) was
// computed against §5's DRAFT bands and is stale: §5.2's final table moved `aftermath` from 2.7->12
// to 2.7->26 and `lifeSupport` from 12->40 to 26->45, because the tier-1 module ladder could not
// actually produce the old figures. Ledger R8 (PRD lines 491-516) rules explicitly: "keep §8's
// formula and all three tier constants; recompute R from §5's final table." §8.4 labels that column
// regenerate-don't-edit for exactly this reason. Anyone re-deriving these prices reads §5.2, not
// §8.4's table.
//
//   Phase         §5.2 band      R = sqrt(entry*exit)     T1 (8s)   T2 (26s)   T3 (80s)   Ladder
//   aftermath     2.7 -> 26      8.4                      67        220        670        957
//   lifeSupport   26  -> 45      34.2                     270       890        2,700      3,860
//   lunar         45  -> 220     99.5                     800       2,600      8,000      11,400
//   deepSpace     220 -> 900     445                      3,600     12,000     36,000     51,600
//   majors        900+           900  (FLOOR, see below)  7,200     23,000     72,000     102,200
//
// The 1 : 3.25 : 10 tier ratio makes T1 a reflex, T2 a decision and T3 an admission. That shape is
// the design intent and it is what survives a rebalance — three authored numbers rather than 27,
// because 27 numbers is 27 chances for a retune to miss one. There is deliberately no phase
// multiplier: §5's income ramps 8.4 -> 900 across the act, which does that job 100x harder than a
// hand-authored curve and does it faithfully.
//
// `majors` is referenced to a FLOOR rather than a mean, because §5.2 gives it no ceiling. That makes
// P9's ladder the cheapest in the act relative to income, and cheaper still as income climbs. Safe
// precisely because P9 gates nothing and its reward is purely narrative — do not "fix" it by
// inventing a ceiling. `aftermath`'s 8.4 is the least settled of the five: aftermath income is
// click-dominated and §5.11 lists `clickFlatValue: 8` as its number-one provisional. If the opening
// faucet moves, P1/P2's hints regenerate. That is the scheme working, not a problem to route around.
//
// PRICES ARE BAKED AT AUTHORING TIME, NOT COMPUTED AT RUNTIME. Computing R(phase) inside src/data/
// would put logic in the config layer, which the house rules forbid; computing it from the player's
// ACTUAL income would mean a stuck player — poor precisely because they are stuck — pays more for
// the hint than a comfortable one. The formula lives here as a comment and the numbers live below as
// numbers.
//
// ---------------------------------------------------------------------------------------------
// THE SINK, CROSS-CHECKED (§8.6, and the second opinion R8 line 513 asks for).
//
//   Every hint on every graded-phase puzzle (P1-P8)      135,634
//   Every instrument in PUZZLE_ITEMS                     161,400
//   §8's total claim on the graded phases                297,034
//
// Against §5.2's integrated graded-phase earn — 15,400 + 108,200 + 430,000 + 2,259,000 = 2,812,600 —
// that is 10.6%, inside §8.6's 8-15% band. P9's 102,200 is excluded: it is `majors`-only and entirely
// post-critical-path, so counting it would flatter a figure that exists to bound pressure on the
// phases the player is still being paced through.
//
// Per phase, §8's local load against that phase's own integrated earn:
//
//   aftermath    1,914 / 15,400      = 12.4%   (§8.6 authored 15.3%)
//   lifeSupport  24,120 / 108,200    = 22.3%   (§8.6 authored 22.7%)
//   lunar        34,800 / 430,000    =  8.1%   (§8.6 authored  8.2%)
//   deepSpace    236,200 / 2,259,000 = 10.5%   (§8.6 authored 11.8%)
//
// Four independent agreements inside a point and a half, from a table regenerated at R8's values
// against one authored at §8.4's. That is the cross-check passing, and it is the strongest evidence
// available that the recompute above is the intended one rather than a misreading of the ledger.
//
// `lifeSupport` is the peak because all three cheap items are offered there, which is intended — it
// is the phase where an item is a genuine save-up rather than a rounding error — and it is also the
// number most likely to hurt, because §5.8 flags the same phase as flattening around minute 30.
//
// §8 IS THE ACT'S ELASTIC SINK (ledger R6): no pacing table depends on it. If a later story's
// measurement shows a phase running hot or cold against §5.3's budget, HINT_TIER_SECONDS and
// ITEM_MINUTES are the FIRST two tables to move, before anything in §5's module ladder or §7's
// colonization ladder — those are load-bearing for the pacing tables and this is not. Moving either
// table here is a one-line edit plus a regeneration of the baked column above; moving §5 or §7 is a
// re-simulation of the act.
//
// ---------------------------------------------------------------------------------------------
// HOW THESE PRICES SIT AGAINST STORY-025's MEASURED SURPLUS — the reconciliation that story asked
// the §8 implementer for by name. (Source: THE FULL LADDER, MEASURED (STORY-025) — the measurement
// block at the top of data/actSevenModulesConfig.js.)
//
// STORY-025 drove a continuous run through `aftermath` and `lifeSupport` with an OPTIMAL buyer and
// found the ladder more generous than §5.3 assumed:
//
//   phase        measured earn   §5.3 budget   ratio    measured exit   authored band
//   aftermath    10,613          15,400        0.69x    14.6 min        20-30 min
//   lifeSupport  285,218         108,200       2.6x     40.2 min        45-60 min
//
// and recorded the expectation directly: "A player who buys any of §8's elastic catalogue — which
// this buyer does not, because §8 does not exist yet — spends that surplus and lands inside the
// band. The story that adds the artifact/instrument sinks should re-measure."
//
// THIS IS THAT RE-MEASURE, AND THE ANSWER IS: §8 HELPS, BUT IT DOES NOT CLOSE THE GAP ALONE, AND IT
// SHOULD NOT BE STRETCHED UNTIL IT DOES. Prices here are baked against §5.2's AUTHORED bands, as
// §8.4 instructs, so §8's absolute draw does not scale with a measured surplus — the percentages
// move instead:
//
//   phase        §8's claim   as % of §5.3 budget   as % of STORY-025's MEASURED earn
//   aftermath    1,914        12.4%                 18.0%
//   lifeSupport  24,120       22.3%                  8.5%
//
// Converted to wall time at each phase's measured average rate, the full §8 catalogue buys back
// ~2.6 min of `aftermath` and ~3.4 min of `lifeSupport`. That moves the measured exits to roughly
// 17.2 min and 43.6 min, against authored floors of 20 and 45 — most of the `lifeSupport` shortfall
// and about half of `aftermath`'s, from a buyer who purchases the entire catalogue on sight.
//
// THE REACH OF THE R6 LEVER IS BOUNDED, AND THAT IS THE USEFUL PART OF THIS NOTE. Closing
// `lifeSupport`'s remaining ~1.4 min by inflating §8 alone would need roughly 1.4x these prices;
// closing the whole 177,018-Salvage surplus with §8 would need about 7x, which lands the sink near
// 60% of the phase's authored earn and shreds §8.6's 8-15% band. So R6 stands — §8 is still the
// first lever to move, and it is cheap to move — but a surplus of this size is a §5 finding, and
// the honest reading of STORY-025's own words is that the optimal buyer's early exit is mostly a
// property of the ladder rather than of a missing sink. Note also that STORY-025's buyer is an
// UPPER BOUND on pace by construction; a player who does not buy perfectly is slower than 40.2 min
// before §8 takes a single Salvage off them.
//
// One consequence worth flagging for whoever retunes: measured against the numbers above, §8's load
// is HEAVIEST where the surplus is SMALLEST. `aftermath` earns 0.69x its budget and pays 18% of it
// to §8; `lifeSupport` earns 2.6x and pays 8.5%. If either phase has to give, it is `aftermath` —
// and the cheapest correction there is HINT_TIER_SECONDS.T3, which is 70% of that phase's whole §8
// claim and is the tier §8.4 calls "an admission" rather than a purchase anyone plans around.
// ---------------------------------------------------------------------------------------------

// The only authored numbers in the pricing scheme. Seconds of that phase's income per hint tier.
const HINT_TIER_SECONDS = { T1: 8, T2: 26, T3: 80 };

// R(phase), recomputed from §5.2's final bands per ledger R8. Kept as data rather than folded into
// the baked prices so that a regeneration has one place to read its input from — and so the ratio
// between two phases' prices is inspectable without re-deriving it from §5.
const PHASE_SALVAGE_RATE = {
  aftermath: 8.4,
  lifeSupport: 34.2,
  lunar: 99.5,
  deepSpace: 445,
  majors: 900,
};

// The baked column. Index 0 is tier 1. Regenerate with round2sf(HINT_TIER_SECONDS[t] * R(phase)).
const HINT_COSTS = {
  aftermath: [67, 220, 670],
  lifeSupport: [270, 890, 2700],
  lunar: [800, 2600, 8000],
  deepSpace: [3600, 12000, 36000],
  majors: [7200, 23000, 72000],
};

// Salvage, for every price in this file. Read from a named constant rather than assumed at each
// call site, so a later row priced in something else is a data edit rather than an engine change.
const PUZZLE_CURRENCY = 'salvage';

// ---------------------------------------------------------------------------------------------
// FEEDBACK LINES (§8.2). A flat map of lineId -> string. The engine returns a CODE and a KEY into
// this map, never a composed string, so no prose crosses the engine boundary and the same wrong
// answer cannot be phrased two different ways by two different panels.
//
// `{n}` and `{of}` are substituted by the renderer. They are placeholders in prose, not logic: the
// alternative is the engine building the sentence, which puts a player-facing string in src/engine/.
//
// The five generic lines are the floor. THE PER-PUZZLE OVERRIDES BELOW THEM ARE WHERE THE CHARM IS,
// and they are written for the player who understood MORE than was asked — the physics-literate
// player who answers 8 to P1 is counting arrivals, which is a better reading of the hardware than
// the one the panel wanted. "INCORRECT" would be a lie about what they did.
const FEEDBACK_LINES = {
  'code.SOLVED': 'ACCEPTED.',
  'code.NEAR': 'CLOSE. NOT ACCEPTED.',
  'code.WRONG_KIND': 'THAT IS NOT THE KIND OF THING THE PANEL IS ASKING FOR.',
  'code.OUT_OF_BAND': 'NOT ACCEPTED.',
  'code.NULL': 'NOTHING ENTERED. THE PANEL IS WAITING.',

  // Numeric puzzles ALWAYS give direction, at every distance. That makes them binary-searchable and
  // that is INTENDED: binary search IS the brute-force path for a number, and it is priced by the
  // attempt cooldown rather than forbidden. Withholding direction would not make the puzzle harder,
  // it would make it a lottery.
  'number.NEAR.LOW': 'CLOSE. YOUR FIGURE IS LOW.',
  'number.NEAR.HIGH': 'CLOSE. YOUR FIGURE IS HIGH.',
  'number.OUT_OF_BAND.LOW': 'NOT ACCEPTED. YOUR FIGURE IS LOW.',
  'number.OUT_OF_BAND.HIGH': 'NOT ACCEPTED. YOUR FIGURE IS HIGH.',
  'number.NULL': 'THE PANEL READS FIGURES. IT READ NONE.',

  // Sequence puzzles give POSITIONAL COUNTS, not "warmer". `2 OF 4 IN POSITION` is real information
  // and a careful player converges in three or four submissions; "warmer" makes a 24-way permutation
  // a lottery, and a lottery is not a puzzle.
  'sequence.NEAR': '{n} OF {of} IN POSITION.',
  'sequence.OUT_OF_BAND': '{n} OF {of} IN POSITION.',
  'sequence.WRONG_KIND': 'THAT IS NOT ONE OF THE BODIES ON THE PLATE.',
  'sequence.NULL': 'THE PANEL EXPECTS {of} IN ORDER.',

  'word.NULL': 'NOTHING ENTERED. THE PANEL IS WAITING.',

  // --- P1 ---
  'p1.arrivals': 'YOU ARE COUNTING ARRIVALS. THE PROGRAM DOES NOT SCORE ARRIVALS.',
  'p1.origin': 'THE ORIGIN IS A STATION.',
  // --- P2 ---
  'p2.width': 'THAT IS THE WIDTH. THE PANEL ASKED FOR THE EDGE.',
  'p2.rejected': 'THAT ONE WAS REJECTED.',
  // --- P3 ---
  'p3.reversed': 'YOU HAVE THE COUNTERS THE WRONG WAY ROUND.',
  'p3.resetValues': 'THOSE ARE THE RESET VALUES, NOT THE STATE BEFORE THEM.',
  // --- P4 ---
  'p4.heldAtSix': 'YOU HELD THE CREW AT SIX. READ THE LOG AGAIN.',
  'p4.stepChange': 'THE DRAW ONLY CHANGES AT CYCLE 200.',
  // --- P6 ---
  'p6.synodicNotPeriod': 'THAT IS WHEN BOTH RETURN TO WHERE THEY STARTED. THE BOARD DOES NOT CARE '
    + 'WHERE THEY STARTED.',
  'p6.differenceOfPeriods': 'THAT IS A DIFFERENCE OF PERIODS, NOT OF RATES.',
  'p6.notASum': 'THE BOARD IS NOT A SUM.',
  // --- P7 ---
  'p7.thatIsWhen': 'THAT IS WHEN. THE PANEL ASKED WHERE.',
  'p7.pathLength': 'THAT IS THE LENGTH OF YOUR PATH. THE PANEL ASKED FOR THE POINT.',
  'p7.aimedAtHim': 'YOU AIMED AT HIM.',
  // --- P8 ---
  'p8.noWayHome': 'NO CAPTURE STAGE REQUIRED. ALSO NO WAY HOME.',
  // --- P9 ---
  'p9.fourRunners': 'THAT IS FOUR RUNNERS. THE EVENT DESCRIBED HAS ONE.',
  'p9.notScored': 'A FOUL BALL IS NOT SCORED.',
  'p9.ourWords': 'THOSE ARE OUR WORDS FOR IT. WE ASKED FOR YOURS.',
};

// ---------------------------------------------------------------------------------------------
// THE NINE (§8.3). Six have a baseball answer wearing operational clothes; three are observation,
// inference and rate arithmetic — the skills `lifeSupport` teaches anyway. Nine is not decoration:
// it is the number of fielders, and the number the player has been looking at for four hours.
//
// EVERY `unlocksLabel` IS A CAPABILITY OR A TAX REMOVAL, NEVER RAW PROGRESS, and no phase transition
// anywhere in the act is gated on a puzzle — §5 and §7 own the phase gates and they are resource and
// site conditions. A player who never opens this tab still reaches `majors`. `ignoredLabel` is what
// they pay instead, and it is always Fuel, a Salvage rate, or information.
//
// `promptTranslated` is what the Lexicon Core renders instead of `prompt`. It CHANGES NO ANSWER and
// no number — it removes vocabulary friction so the puzzle is the puzzle. A puzzle whose alien
// vocabulary is already plain English simply omits it and the engine falls back to `prompt`, which
// is why the field is absent on P4 rather than duplicated.
//
// `attemptsToBypass` / `attemptCooldownSeconds` are the anti-soft-lock path (§8.7). See the tuning
// block at the foot of this file for the measured brute-force ratio that set the counts.
const ACT_SEVEN_PUZZLES = [
  {
    id: 'circuitConfirmation',
    name: 'Certification Plate',
    artifact: 'Certification Plate',
    phase: 'aftermath',
    inputKind: 'number',
    inputLabel: 'BURNS',
    prompt: [
      'APTITUDE PROGRAM 7 — CERTIFICATION',
      'CANDIDATE POPULATION: SOL III',
      'PROGRAM DURATION: 151 LOCAL YEARS',
      '',
      'THE CIRCUIT HAS FOUR STATIONS INCLUDING THE ORIGIN.',
      'A VEHICLE IS CREDITED ONLY IF IT VISITS EVERY STATION IN',
      'SEQUENCE AND ARRIVES BACK AT THE ORIGIN.',
      '',
      'ONE BURN IS COMMITTED AT EACH DEPARTURE.',
      'ARRIVALS ARE NOT SCORED.',
      '',
      'STATE THE NUMBER OF BURNS.',
    ].join('\n'),
    promptTranslated: [
      'APTITUDE PROGRAM 7 — CERTIFICATION',
      'CANDIDATE POPULATION: EARTH',
      'PROGRAM DURATION: 151 YEARS',
      '',
      'THE ORBIT HAS FOUR STOPS INCLUDING THE ONE YOU START FROM.',
      'A VEHICLE COUNTS ONLY IF IT VISITS EVERY STOP IN ORDER AND',
      'GETS BACK TO WHERE IT STARTED.',
      '',
      'ONE ENGINE BURN IS SPENT EVERY TIME YOU LEAVE A STOP.',
      'GETTING SOMEWHERE DOES NOT COUNT. LEAVING DOES.',
      '',
      'STATE THE NUMBER OF BURNS.',
    ].join('\n'),
    // Tolerance 0: there is no reading ambiguity here to absorb. The prompt defines "one burn at
    // each departure" and "arrivals are not scored" inline, precisely because a reviewer who knows
    // orbital mechanics reads "four-burn transfer" as four IMPULSES rather than four DEPARTURES.
    // §8.1 rule 5: where the alien vocabulary would mislead someone who knows the physics, the
    // prompt defines the term.
    answer: { value: 4, tolerance: 0 },
    near: [
      { value: 8, lineId: 'p1.arrivals' },
      { value: 3, lineId: 'p1.origin' },
    ],
    hints: [
      'THE PANEL IS ASKING YOU TO DESCRIBE A SHAPE YOU KNOW.',
      'FOUR STATIONS. YOU DEPART FROM ALL OF THEM, INCLUDING THE LAST.',
      'IT IS A DIAMOND. COUNT THE BASES.',
    ],
    // The teaching puzzle. It establishes in the act's first ten minutes that these are BASEBALL
    // questions, so every later panel is read through that lens. The whole ladder depends on this
    // one landing, which is why it is the simplest thing in the file.
    unlocksLabel: 'The artifact index — later artifacts announce themselves in the feed.',
    ignoredLabel: 'You find them by opening this tab.',
    attemptsToBypass: 5,
    attemptCooldownSeconds: 45,
  },

  {
    id: 'zonePlate',
    name: 'Insertion Gauge',
    artifact: 'Insertion Gauge',
    phase: 'aftermath',
    inputKind: 'number',
    inputLabel: 'BAND UNITS',
    prompt: [
      'INSERTION LOG — LAST NINE ATTEMPTS',
      'DEVIATION FROM CENTRE, IN BAND UNITS.',
      '',
      '  -3.0   ACCEPTED        +2.7   ACCEPTED',
      '  +1.4   ACCEPTED        -4.0   ACCEPTED',
      '  +4.2   REJECTED        +4.1   REJECTED',
      '  -0.1   ACCEPTED',
      '  +4.0   ACCEPTED',
      '  -4.4   REJECTED',
      '',
      'STATE THE LARGEST DEVIATION THIS PANEL WILL ACCEPT.',
    ].join('\n'),
    promptTranslated: [
      'INSERTION LOG — LAST NINE ATTEMPTS',
      'HOW FAR OFF CENTRE, IN DEGREES.',
      '',
      '  -3.0   ACCEPTED        +2.7   ACCEPTED',
      '  +1.4   ACCEPTED        -4.0   ACCEPTED',
      '  +4.2   REJECTED        +4.1   REJECTED',
      '  -0.1   ACCEPTED',
      '  +4.0   ACCEPTED',
      '  -4.4   REJECTED',
      '',
      'STATE THE LARGEST MISS THIS PANEL WILL STILL ACCEPT.',
    ].join('\n'),
    // 0.05 absorbs "4" against "4.0" and nothing else; the gap to the smallest rejected row (4.1)
    // is 0.1, so the band cannot swallow a wrong answer. The wording — "the largest deviation
    // ACCEPTED" rather than "the band" — is doing the same work: naming the exact scalar is cheaper
    // than adjudicating a reading in a `near` line (§8.2).
    answer: { value: 4.0, tolerance: 0.05 },
    near: [
      { value: 8, lineId: 'p2.width' },
      { value: 4.2, lineId: 'p2.rejected' },
    ],
    hints: [
      'EVERY NUMBER YOU NEED IS ON THE PLATE.',
      'SORT THE ACCEPTED ROWS BY MAGNITUDE. IGNORE THE SIGN.',
      'LARGEST ACCEPTED MAGNITUDE IS 4.0. SMALLEST REJECTED IS 4.1.',
    ],
    // Pure observation, no baseball required — +4.0 and -4.0 are the corners, and the corner is a
    // strike. The only puzzle whose whole solution is sorting a printed column, which is why it sits
    // second: it proves rule 3 (you can check your own answer) on a panel where checking is trivial.
    instrumentReadout: 'ACCEPT BAND DRAWN TO SCALE: -4.0 ... +4.0. REJECTED ROWS SHOWN OUTSIDE IT.',
    unlocksLabel: 'Insertion tolerance readout on the launch panel — see whether a filed trajectory '
      + 'is in band before committing Fuel.',
    ignoredLabel: 'Out-of-band insertions cost a retry burn.',
    attemptsToBypass: 5,
    attemptCooldownSeconds: 45,
  },

  {
    id: 'regulator',
    name: 'Scrubber Regulator',
    artifact: 'Scrubber Regulator',
    phase: 'lifeSupport',
    inputKind: 'word',
    inputLabel: 'PAIR',
    prompt: [
      'SCRUBBER REGULATOR — MANUAL MODE',
      '',
      'REGULATOR STATE IS A PAIR OF COUNTERS.',
      'THE LEFT COUNTER ADVANCES ON A REJECTED CYCLE.',
      'THE RIGHT COUNTER ADVANCES ON AN ACCEPTED CYCLE.',
      'THE PAIR RESETS WHEN THE LEFT REACHES FOUR.',
      'THE PAIR RESETS WHEN THE RIGHT REACHES THREE.',
      '',
      'THE REGULATOR RUNS AT FULL THROUGHPUT IN EXACTLY ONE STATE:',
      'THE STATE FROM WHICH THE NEXT CYCLE, WHATEVER IT IS, RESETS',
      'THE PAIR.',
      '',
      'SET THE PAIR.',
    ].join('\n'),
    promptTranslated: [
      'SCRUBBER REGULATOR — MANUAL MODE',
      '',
      'THE REGULATOR KEEPS TWO TALLIES.',
      'THE LEFT ONE GOES UP WHEN A PASS IS REJECTED.',
      'THE RIGHT ONE GOES UP WHEN A PASS IS ACCEPTED.',
      'BOTH TALLIES CLEAR WHEN THE LEFT REACHES FOUR.',
      'BOTH TALLIES CLEAR WHEN THE RIGHT REACHES THREE.',
      '',
      'IT RUNS AT FULL THROUGHPUT IN EXACTLY ONE STATE: THE ONE',
      'WHERE THE VERY NEXT PASS CLEARS THE TALLIES NO MATTER',
      'WHICH WAY IT GOES.',
      '',
      'SET THE PAIR.',
    ].join('\n'),
    // `full count` is in accept[] and it is NOT a cheat code — it is the panel confirming the player
    // got there the fast way. The purest statement of the act's thesis: the alien hardware and the
    // thing the player has watched ten thousand times are the same object.
    accept: ['3-2', '3 2', '32', '3,2', 'three two', '3 and 2', 'full', 'full count', 'three-two',
      'three and two'],
    near: [
      { match: ['2-3', '2 3', '23', 'two three', 'two-three'], lineId: 'p3.reversed' },
      { match: ['4-3', '4 3', '43', 'four three', 'four-three'], lineId: 'p3.resetValues' },
    ],
    hints: [
      'THE STATE YOU WANT IS ONE STEP BELOW BOTH RESETS AT ONCE.',
      'THE LEFT COUNTER IS BALLS. THE RIGHT IS STRIKES.',
      'IT IS A FULL COUNT.',
    ],
    unlocksLabel: 'Regulator override: every Oxygen scrubber runs at +25% throughput.',
    ignoredLabel: 'Buy more scrubbers — pure Salvage.',
    attemptsToBypass: 6,
    attemptCooldownSeconds: 60,
  },

  {
    id: 'manifest',
    name: 'Recovered Ration Manifest',
    artifact: 'Recovered Ration Manifest',
    phase: 'lifeSupport',
    inputKind: 'number',
    inputLabel: 'CYCLE',
    prompt: [
      'RECOVERED FROM THE HULK AT 60 KM. WATER DAMAGE THROUGHOUT.',
      '',
      '  MANIFEST — PROVISIONS',
      '  LOADED AT DEPARTURE .......... 2,400 UNITS',
      '  CREW ......................... 6',
      '  DRAW ......................... 1 UNIT PER CREW PER CYCLE',
      '  RESUPPLY ..................... NONE SCHEDULED',
      '',
      '  LOG, CYCLE 200 (HANDWRITTEN):',
      '  "two of us went on."',
      '',
      'STATE THE CYCLE ON WHICH THE LAST UNIT WAS DRAWN.',
    ].join('\n'),
    // No promptTranslated: there is no program vocabulary on this panel. It is a human document in
    // plain words, and that is the point of it — the only artifact in the act written by a hand.
    // The Lexicon Core has nothing to translate here and the engine falls back to `prompt`.
    //
    // Tolerance 1 accepts 499-501. "The cycle the last unit was drawn" versus "the cycle after which
    // none remained" is a READING ambiguity, not a comprehension failure, and §8.2 rules that
    // off-by-one is accepted rather than punished. A player who did the arithmetic correctly and
    // read the question a half-step differently has understood the artifact.
    answer: { value: 500, tolerance: 1 },
    near: [
      { value: 400, lineId: 'p4.heldAtSix' },
      { value: 600, lineId: 'p4.stepChange' },
    ],
    hints: [
      'THE DRAW RATE IS NOT CONSTANT.',
      'THE LOG LINE IS A CREW COUNT, NOT A EULOGY.',
      '1,200 UNITS REMAIN AT CYCLE 200. FOUR CREW DRAW THEM.',
    ],
    // Rate arithmetic with a step change: 6 x 200 = 1,200 drawn; 1,200 remain at 4/cycle = 300 more.
    // It teaches the `lifeSupport` skill in the phase that introduces it, on a worked example whose
    // stakes are somebody else's.
    unlocksLabel: 'Forecast readout: every resource row gains time-to-empty and time-to-full.',
    ignoredLabel: 'You watch bars instead of numbers.',
    attemptsToBypass: 6,
    attemptCooldownSeconds: 60,
  },

  {
    id: 'assistChain',
    name: 'Circuit Plate',
    artifact: 'Circuit Plate',
    phase: 'lunar',
    inputKind: 'sequence',
    inputLabel: 'ORDER',
    prompt: [
      'ASSIST CHAIN — FILE AN ORDER',
      '',
      'FOUR BODIES. YOU ARRIVE WITH 0 ENERGY.',
      'A BODY WILL NOT ACCEPT YOU BELOW ITS GATE.',
      'A BODY YOU HAVE PASSED ADDS ITS GAIN, ONCE.',
      '',
      '  BODY     GATE    GAIN',
      '  VESH       9       6',
      '  ORE        0       3',
      '  TIRRA     15       4',
      '  KAL        3       6',
      '',
      'FILE ALL FOUR IN ORDER.',
    ].join('\n'),
    promptTranslated: [
      'GRAVITY ASSIST CHAIN — FILE AN ORDER',
      '',
      'FOUR BODIES. YOU ARRIVE WITH 0 ENERGY.',
      'A BODY WILL NOT TAKE YOU UNLESS YOU ARRIVE WITH AT LEAST',
      'THE ENERGY IN ITS "NEEDS" COLUMN.',
      'EACH BODY YOU HAVE ALREADY SWUNG PAST GIVES YOU ITS',
      '"GIVES" ENERGY, ONCE.',
      '',
      '  BODY     NEEDS   GIVES',
      '  VESH       9       6',
      '  ORE        0       3',
      '  TIRRA     15       4',
      '  KAL        3       6',
      '',
      'FILE ALL FOUR IN ORDER.',
    ].join('\n'),
    // ORE (0) -> KAL (needs 3, have 3) -> VESH (needs 9, have 9) -> TIRRA (needs 15, have 15). The
    // only order that works, and it is rounding the bases: you cannot touch third before second, and
    // the energy you bring to each came from the last.
    sequence: ['ore', 'kal', 'vesh', 'tirra'],
    // Every token the panel will recognise as a body. A token outside this set is WRONG_KIND — the
    // player has typed something that is not on the plate at all, which is a different mistake from
    // filing the four bodies in the wrong order and gets a different answer.
    sequenceTokens: ['ore', 'kal', 'vesh', 'tirra'],
    hints: [
      'ONLY ONE BODY WILL ACCEPT YOU AT ZERO.',
      'YOU HAVE DONE THIS FOUR HUNDRED TIMES. YOU WERE NOT ALLOWED TO SKIP ONE THEN EITHER.',
      'ORE OPENS IT AT 3. KAL TAKES YOU TO 9. VESH TAKES YOU TO 15.',
    ],
    instrumentReadout: 'ASSIST LADDER SOLVED: 0 -> ORE +3 -> KAL +6 -> VESH +6 -> TIRRA. GATES MET '
      + 'AT EVERY STEP.',
    unlocksLabel: 'The assist route to the outer sites — materially cheaper in Fuel than a direct '
      + 'transfer.',
    ignoredLabel: 'Direct transfers at a large Fuel premium.',
    // §8.3 authored 8 here and argued that 8 is "deliberately above what a systematic player needs":
    // with positional feedback, 24 permutations collapse in three or four submissions. 6 preserves
    // that argument — a deducing player never reaches either number — and buys margin on ledger R9's
    // ratio, which the measurement clears at BOTH values but by only 0.007 at 8 on the adversarial
    // bound. The tuning block at the foot of this file has the run and is explicit that this is a
    // margin decision rather than a correction: restoring 8 after §7's launch ladder lands and the
    // Fuel coefficients are re-measured would not be undoing an error.
    attemptsToBypass: 6,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'theWindow',
    name: 'Departure Board',
    artifact: 'Departure Board',
    phase: 'lunar',
    inputKind: 'number',
    inputLabel: 'UNITS',
    prompt: [
      'DEPARTURE BOARD',
      '',
      'TWO BODIES SHARE A PLANE.',
      'THE INNER COMPLETES ONE CIRCUIT IN 12 UNITS.',
      'THE OUTER COMPLETES ONE CIRCUIT IN 20 UNITS.',
      '',
      'THE BOARD OPENS ONLY WHEN THE OUTER LEADS THE INNER BY ONE',
      'FIXED ANGLE. THAT ANGLE IS SATISFIED NOW.',
      '',
      'STATE THE INTERVAL UNTIL IT IS SATISFIED AGAIN.',
    ].join('\n'),
    promptTranslated: [
      'DEPARTURE BOARD',
      '',
      'TWO BODIES ORBIT IN THE SAME PLANE.',
      'THE INNER ONE COMPLETES ONE ORBIT IN 12 SECONDS.',
      'THE OUTER ONE COMPLETES ONE ORBIT IN 20 SECONDS.',
      '',
      'THE WINDOW IS OPEN ONLY WHEN THE OUTER ONE IS AHEAD OF THE',
      'INNER ONE BY ONE PARTICULAR ANGLE. IT IS AHEAD BY THAT',
      'ANGLE RIGHT NOW.',
      '',
      'STATE HOW LONG UNTIL IT IS AGAIN.',
    ].join('\n'),
    // The synodic period, 1 / (1/12 - 1/20) = 30. Correct physics: a transfer window recurs at the
    // synodic period whatever phase angle it needs, which is why the prompt says "leads by one fixed
    // angle" — without that line a physics-literate reader would hunt for the angle and conclude the
    // panel withheld a number, which §8.1 rule 1 forbids.
    //
    // Baseball: STEALING. You go when the lead is right, and if you miss it the lead comes back
    // around.
    answer: { value: 30, tolerance: 0.1 },
    near: [
      { value: 60, lineId: 'p6.synodicNotPeriod' },
      { value: 8, lineId: 'p6.differenceOfPeriods' },
      { value: 32, lineId: 'p6.notASum' },
    ],
    hints: [
      'THE ANSWER DOES NOT DEPEND ON WHAT THE ANGLE IS.',
      'WORK IN CIRCUITS PER UNIT, NOT UNITS PER CIRCUIT. SUBTRACT.',
      'ONE DIVIDED BY (1/12 MINUS 1/20).',
    ],
    instrumentReadout: 'RELATIVE ANGLE, LIVE. INNER GAINS 1/12 - 1/20 = 1/30 OF A CIRCUIT PER UNIT.',
    unlocksLabel: 'Launch-window readout — the next open window and the Fuel discount for waiting.',
    ignoredLabel: 'You launch at whatever phase angle you are at, at a Fuel premium.',
    attemptsToBypass: 6,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'releasePoint',
    name: 'Rendezvous Trainer',
    artifact: 'Rendezvous Trainer',
    phase: 'deepSpace',
    inputKind: 'number',
    inputLabel: 'UNITS UP TRACK',
    prompt: [
      'RENDEZVOUS TRAINER',
      '',
      'THE RECEIVER IS 8 UNITS DOWNRANGE, ON A TRACK PERPENDICULAR',
      'TO YOUR LINE OF SIGHT, MOVING AT 3 UNITS PER BEAT.',
      '',
      'YOUR VEHICLE HOLDS 5 UNITS PER BEAT FROM RELEASE.',
      'YOU MAY NOT STEER AFTER RELEASE.',
      '',
      'STATE HOW FAR UP THE RECEIVER\'S TRACK YOU AIM.',
    ].join('\n'),
    promptTranslated: [
      'RENDEZVOUS TRAINER',
      '',
      'THE RECEIVER IS 8 KILOMETRES AWAY, CROSSING YOUR LINE OF',
      'SIGHT AT A RIGHT ANGLE, MOVING AT 3 KILOMETRES PER SECOND.',
      '',
      'YOUR VEHICLE HOLDS 5 KILOMETRES PER SECOND FROM RELEASE.',
      'YOU CANNOT STEER AFTER RELEASE.',
      '',
      'STATE HOW FAR ALONG HIS PATH YOU AIM.',
    ].join('\n'),
    // Constant-bearing intercept: 8^2 + (3t)^2 = (5t)^2 -> t = 2, receiver has moved 6. The 3-4-5 is
    // not hidden. Baseball: THE PITCH, AND EVERY THROW — you commit before you can see the result,
    // and you throw where he is going to be. The wording asks for "how far up the receiver's track"
    // rather than "the release point" because naming the exact scalar is cheaper than adjudicating a
    // reading (§8.2).
    answer: { value: 6, tolerance: 0.1 },
    near: [
      { value: 2, lineId: 'p7.thatIsWhen' },
      { value: 10, lineId: 'p7.pathLength' },
      { value: 8, lineId: 'p7.aimedAtHim' },
    ],
    hints: [
      'HE WILL NOT BE THERE WHEN YOU ARRIVE.',
      'SOLVE FOR THE TIME FIRST. YOUR PATH AND HIS TRACK MAKE A RIGHT TRIANGLE.',
      'TWO BEATS. HE MOVES 3 A BEAT.',
    ],
    unlocksLabel: 'Rendezvous assist: docking with a salvage hulk yields +50% Salvage.',
    ignoredLabel: 'Less Salvage per hulk — purely a rate.',
    // §8.3 authored 10; 7 here. This is the largest single contributor to the brute-forcer's wall
    // time among the graded puzzles (90s cooldown, and the highest count), so it is where a unit of
    // counter buys the most margin on ledger R9's ratio — 4.5 of the 16 minutes the reduction saves
    // across the act come from this row alone. See the tuning block for why margin, and not a failed
    // measurement, is the reason.
    attemptsToBypass: 7,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'filedArcs',
    name: 'Trajectory File',
    artifact: 'Trajectory File',
    phase: 'deepSpace',
    inputKind: 'word',
    inputLabel: 'ARC',
    prompt: [
      'FOUR ARCS ON FILE.',
      '',
      '  ARC ONE     DEPART 3.1 · CAPTURE 0.9 · DEPART 0.9 · ARRIVE 3.1',
      '  ARC TWO     DEPART 3.2 · CORRECT 0.1 · ARRIVE 3.0',
      '  ARC THREE   DEPART 3.0 · CORRECT 0.1 · NO ARRIVAL ON FILE',
      '  ARC FOUR    DEPART 3.4 · CAPTURE 1.1 · HOLD · DEPART 1.1',
      '',
      'THE VEHICLE CARRIES NO CAPTURE STAGE.',
      'THE VEHICLE IS EXPECTED BACK.',
      '',
      'NAME THE ARC.',
    ].join('\n'),
    promptTranslated: [
      'FOUR TRAJECTORIES ON FILE.',
      '',
      '  ARC ONE     LEAVE 3.1 · ENTER ORBIT 0.9 · LEAVE 0.9 · RETURN 3.1',
      '  ARC TWO     LEAVE 3.2 · COURSE CORRECTION 0.1 · RETURN 3.0',
      '  ARC THREE   LEAVE 3.0 · COURSE CORRECTION 0.1 · NO RETURN ON FILE',
      '  ARC FOUR    LEAVE 3.4 · ENTER ORBIT 1.1 · WAIT · LEAVE 1.1',
      '',
      'THE VEHICLE CANNOT ENTER ORBIT ANYWHERE.',
      'THE VEHICLE IS EXPECTED BACK.',
      '',
      'NAME THE ARC.',
    ].join('\n'),
    // The free return: departure burn plus a mid-course correction, no capture, because the geometry
    // brings you back. Baseball: A HOME RUN — a trajectory that leaves and returns without a
    // rendezvous. Both stated conditions bind, and that is the whole puzzle.
    accept: ['arc two', 'two', '2', 'arc 2'],
    near: [
      { match: ['arc three', 'three', '3', 'arc 3'], lineId: 'p8.noWayHome' },
    ],
    hints: [
      'TWO CONDITIONS ARE STATED BELOW THE FILE. BOTH BIND.',
      'A CAPTURE IS A RENDEZVOUS. YOU CANNOT PERFORM ONE.',
      'TWO ARCS HAVE NO CAPTURE. ONLY ONE COMES BACK.',
    ],
    unlocksLabel: 'Free-return survey probe — reads the next site\'s yields before you commit Fuel '
      + 'to a crewed launch.',
    ignoredLabel: 'You commit blind.',
    // FOUR EQUALS THE NUMBER OF OPTIONS, CONSCIOUSLY, and it is the one count ledger R9's retune did
    // NOT touch. A player who tries all four arcs has, in a real sense, read the board; setting it
    // to 10 would only make an honest brute-forcer wait for a result they had already earned. It is
    // also already the cheapest row in §8.7's table, so lowering it buys the ratio nothing.
    attemptsToBypass: 4,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'theWall',
    name: 'Final Certification',
    artifact: 'Final Certification',
    phase: 'majors',
    inputKind: 'word',
    inputLabel: 'NAME',
    prompt: [
      'FINAL CERTIFICATION.',
      '',
      'ONE EVENT. TWO BODIES.',
      '',
      'THE FIRST CROSSES THE BOUNDARY AND IS NOT RECOVERED.',
      'NO INSTRUMENT FOLLOWS IT. NOTHING IS SENT AFTER IT.',
      '',
      'THE SECOND COMPLETES THE FOUR-BURN CIRCUIT AT WALKING PACE,',
      'WITH NO OPPOSITION, AND ARRIVES AT THE ORIGIN.',
      '',
      'THE PROGRAM SCORES BOTH.',
      'IT HAS ONE NAME FOR BOTH.',
      '',
      'NAME IT.',
    ].join('\n'),
    promptTranslated: [
      'FINAL CERTIFICATION.',
      '',
      'ONE EVENT. TWO BODIES.',
      '',
      'THE FIRST CROSSES THE EDGE AND IS NOT RECOVERED.',
      'NOTHING FOLLOWS IT. NOTHING IS SENT AFTER IT.',
      '',
      'THE SECOND GOES ALL FOUR STOPS ROUND THE ORBIT AT WALKING',
      'PACE, WITH NOBODY TRYING TO STOP IT, AND GETS BACK TO',
      'WHERE IT STARTED.',
      '',
      'THE PROGRAM SCORES BOTH.',
      'IT HAS ONE NAME FOR BOTH.',
      '',
      'NAME IT.',
    ].join('\n'),
    // The act in one prompt. The ball leaves and never comes back — the outfield wall is the
    // heliopause, and nobody has hit one over it. The runner completes the four-burn circuit at a
    // trot, unopposed, and arrives home. One name, two trajectories.
    accept: ['home run', 'homer', 'homerun', 'home-run', 'hr', 'dinger', 'tater', 'long ball',
      'longball', 'four bagger', 'four-bagger', 'moon shot', 'moonshot', 'out of park',
      'out of the park', 'over wall', 'over the wall', 'gone'],
    wrongKind: [
      { match: ['grand slam', 'grandslam', 'slam'], lineId: 'p9.fourRunners' },
      { match: ['foul ball', 'foul'], lineId: 'p9.notScored' },
      { match: ['heliopause', 'free return', 'free-return', 'escape trajectory'],
        lineId: 'p9.ourWords' },
    ],
    hints: [
      'WE DID NOT INVENT THIS WORD. YOU DID.',
      'ONE OF THE TWO BODIES IS A PERSON.',
      'THE SECOND BODY IS A RUNNER AND HE IS NOT HURRYING. WHY NOT?',
    ],
    // IT GATES NOTHING AT ALL, and that is the strongest available compliance with Decision 3.6.
    // Its reward is entirely narrative: a player who never solves it still crosses, and the program
    // certifies them as PERSISTENT rather than as APTITUDE CONFIRMED — described accurately as
    // someone who kept trying. §10 owns both strings; this row owns neither.
    unlocksLabel: 'APTITUDE CONFIRMED — the crossing is certified, not merely fuelled.',
    ignoredLabel: 'The crossing still happens the moment the Fuel threshold is met, and the program '
      + 'certifies you as PERSISTENT.',
    attemptsToBypass: 10,
    attemptCooldownSeconds: 150,
  },
];

// ---------------------------------------------------------------------------------------------
// THE INSTRUMENT SHOP (§8.5). EVERY ITEM IS A PERMANENT CAPABILITY, NOT A PER-PUZZLE CONSUMABLE.
// A decoder that translates a whole class of artifact is a better purchase than a hint for the same
// reason a collector is a better purchase than a click: it changes what the rest of the act feels
// like. Hints are the impulse buy; items are the plan.
//
// EVERY EFFECT IS A DECLARED KEY THE ENGINE READS GENERICALLY — `freeHintTier`, `translatesPrompts`,
// `cooldownMultiplier`, `readoutPuzzles`, `enablesSimulate`. No item id appears anywhere in
// src/engine/puzzles.js, so a seventh instrument is a row here and nothing else.
//
// RELATIVE PRICING MAKES THE TWO FREE-HINT ITEMS STRUCTURALLY ROI-POSITIVE AGAINST THE FULL LADDER,
// AND THAT IS A PROPERTY, NOT A MISPRICING. Anything bought cheap in `lifeSupport` and redeemed
// against `deepSpace` and `majors` hints captures a 13-26x income ramp. Repricing is the wrong fix —
// costing the Scorecard against the hints it replaces puts it near 50,000, unreachable in the very
// phase where a player is still learning the act's grammar and most needs it. A player only "saves"
// a hint they would otherwise have bought: against the full ladder both look like free money,
// against how most people play they are close to a wash.
const PUZZLE_ITEMS = [
  {
    id: 'flightManual',
    name: 'Flight Manual, Fragment 3',
    description: 'Three surviving pages of a manual for hardware that was obsolete when it was '
      + 'written. It explains what each class of panel is FOR. It never says what to type.',
    availableFrom: 'lifeSupport',
    itemMinutes: 1.5,
    cost: 3100, // round2sf(1.5 * 60 * 34.2)
    effectLabel: 'Tier-1 hint free on every puzzle, forever.',
    freeHintTier: 1,
    // Absent freeHintPuzzles means EVERY puzzle. Distinct from an empty array, which would mean
    // none — a distinction worth one comment because the two are one keystroke apart.
  },
  {
    id: 'lexiconCore',
    name: 'Lexicon Core',
    description: 'A translation stack, mostly intact. It renders the program\'s vocabulary into '
      + 'yours: BEATS become seconds, BAND UNITS become degrees, a CIRCUIT becomes an orbit.',
    availableFrom: 'lifeSupport',
    itemMinutes: 2.5,
    cost: 5100, // round2sf(2.5 * 60 * 34.2)
    effectLabel: 'Prompts render in translation. Changes no answer.',
    translatesPrompts: true,
    // ITS SALVAGE ROI IS ZERO BY CONSTRUCTION and that is deliberate: it saves ATTEMPTS, and
    // attempts are cooldown minutes. Both currencies count, and this is the item that trades the
    // one the other items do not.
  },
  {
    id: 'recoveredScorecard',
    name: 'Recovered Scorecard',
    description: 'A water-damaged scorecard from a 1974 minor-league game, pulled out of the '
      + 'salvage. It prints the program\'s vocabulary against the one you already know.',
    availableFrom: 'lifeSupport',
    itemMinutes: 4,
    cost: 8200, // round2sf(4 * 60 * 34.2)
    effectLabel: 'Tier-2 hint free on every baseball-key puzzle.',
    freeHintTier: 2,
    // The six-of-nine with a baseball answer wearing operational clothes, plus P9. P2 and P4 are
    // excluded because their keys are observation and rate arithmetic — a scorecard has nothing to
    // say about either, and giving it a free hint there would make it the strictly-better Manual.
    freeHintPuzzles: ['circuitConfirmation', 'regulator', 'assistChain', 'theWindow', 'releasePoint',
      'filedArcs', 'theWall'],
  },
  {
    id: 'dopplerRangefinder',
    name: 'Doppler Rangefinder',
    description: 'An instrument rather than a document. Pointed at a panel, it reads back the '
      + 'quantity the panel is describing but does not print.',
    availableFrom: 'lunar',
    itemMinutes: 2,
    cost: 12000, // round2sf(2 * 60 * 99.5)
    effectLabel: 'Reveals the hidden quantity on any artifact that has one.',
    // The three artifacts with a quantity that can be instrumented rather than deduced. It does not
    // solve them: it draws the accept band to scale, prints the assist ladder, shows the relative
    // angle. A player still has to read the answer off it.
    readoutPuzzles: ['zonePlate', 'assistChain', 'theWindow'],
  },
  {
    id: 'governorBypass',
    name: 'Attempt Governor Bypass',
    description: 'A shunt across the panel\'s own patience. The program notices and does not '
      + 'appear to mind.',
    availableFrom: 'deepSpace',
    itemMinutes: 2,
    cost: 53000, // round2sf(2 * 60 * 445)
    effectLabel: 'Halves the submission cooldown on every puzzle, present and future.',
    cooldownMultiplier: 0.5,
    // THE BRUTE-FORCER'S ITEM, priced to be reachable before the expensive puzzles. §8.7's measured
    // run assumes it is bought as soon as `deepSpace` income allows, because leaving it out of that
    // run would make the 1.3x ratio unfalsifiable — see this file's tuning block, which reports the
    // ratio both with and without it for exactly that reason.
  },
  {
    id: 'plotTable',
    name: 'Inertial Plot Table',
    description: 'A bench that will run your answer against the panel\'s own model before the panel '
      + 'sees it. It takes its time and it tells you nothing you did not ask.',
    availableFrom: 'deepSpace',
    itemMinutes: 3,
    cost: 80000, // round2sf(3 * 60 * 445)
    effectLabel: 'SIMULATE beside SUBMIT: test an answer with no attempt recorded and no cooldown '
      + 'consumed. A run reports PASS or FAIL and nothing else.',
    enablesSimulate: true,
    simulateSeconds: 20,
    // THE MOST EXPENSIVE THING IN THE ACT BECAUSE IT REMOVES RISK, which is worth more than removing
    // difficulty. The 20 seconds and the bare PASS/FAIL are what stop it from strictly dominating
    // SUBMIT: PASS/FAIL carries no ordering, so a search driven by SIMULATE is LINEAR over the
    // candidate set, where SUBMIT returns direction and is therefore logarithmic. Measured crossover
    // is in the tuning block — simulate wins on small candidate sets, submit wins on large ones, and
    // neither dominates, which is what §8.5 requires of it.
    //
    // §5.8 cites "the Plot Table at 12,000" as the sink scheduled at `deepSpace`'s flat point. The
    // item is still scheduled there; the figure is superseded by the derived 80,000, which is what
    // makes it function as the relief §5.8 wants it to be.
  },
];

// ---------------------------------------------------------------------------------------------
// TUNING: THE BRUTE-FORCE RATIO (ledger R9), MEASURED.
//
// R9 retires §8.6's "never worse than 1.5x" clause and rules that `attemptsToBypass` comes down
// until the MEASURED ratio of a zero-solve, zero-hint run to a median run is <= 1.3. The arithmetic
// behind the ceiling: the stretched act is 3.85 h, and 1.5x of that is 5.8 h, which breaches §12
// criterion 8's 5-hour ceiling. 1.3x is 5.0 h — exactly on it. R9 also states that a ratio asserted
// rather than measured does not discharge the obligation, so everything below is a run.
//
// HOW IT WAS MEASURED. A `node` harness, 30 runs, deterministic injected rng (mulberry32, seeded),
// phase durations sampled uniformly inside §5.2's authored bands (aftermath 20-30, lifeSupport
// 45-60, lunar 60-80, deepSpace 60-90 min). Per-puzzle bypass wall time is NOT arithmetic in the
// harness: it mashes attemptBruteForce() against a synthetic clock advancing one second at a time
// and reads the instant `bypassed` flips out of listPuzzles(), so the figures measure the shipped
// cooldown clamp, the shipped counter and the shipped Governor Bypass halving. Sampled solver act:
// median 223.4 min, range 206.5-246.0.
//
// THE FIRST ATTEMPT IS FREE, WHICH IS WHY THE WALL TIMES ARE (n-1) COOLDOWNS AND NOT n. A fresh
// puzzle has no `nextAttemptAtClock`, so attempt 1 lands immediately and only the remaining n-1 are
// governed. §8.7's table quotes n x cooldown (P1 as "4.5 min"); measured, P1 at 6 attempts is 3.75
// min. Every §8.7 row is therefore ~one cooldown pessimistic, which is worth knowing before anyone
// reconciles this block against that table and concludes something has drifted.
//
// TWO MODELS ARE REPORTED, AND WHICH ONE IS THE GATE MATTERS.
//
//   MEASURED RATIO — the metric §8.7 asks for. Its line 2720 states the requirement exactly: "the
//     simulation must measure the BLOCKING fraction, not the total." No phase gate is a puzzle, so a
//     bypass is on the critical path only while the capability it unlocks is a tax the player is
//     currently paying. Each puzzle carries a blocking coefficient and the cost is coefficient x
//     wall time, capped at the duration of the phase whose tax it removes.
//
//   UPPER BOUND — every graded-phase bypass minute counted as fully blocking, which no puzzle in
//     §8.3 actually is. Reported because a coefficient is an estimate and a bound is not: it holds
//     even if every coefficient below were wrong in the same direction at once.
//
// P9 is excluded from both figures. It is in `majors`, past the finish line the ratio is measured
// to, and §8.3 is explicit that it gates nothing at all.
//
//   Configuration                          MEASURED (median/worst)   UPPER BOUND (median/worst)
//   shipped counts, no Bypass  [THE GATE]  1.096 / 1.104             1.199 / 1.215
//   shipped counts, Bypass owned           1.048 / 1.052             1.100 / 1.108
//   §8.3's authored counts, no Bypass      1.134 / 1.145             1.271 / 1.293
//
// ALL THREE ROWS CLEAR 1.3, INCLUDING §8.3's AUTHORED COUNTS — SO STATE PLAINLY WHAT MOVED THEM.
// The measurement did not force a reduction; R9 anticipated one and the run does not require it.
// What the run does show is MARGIN: at the authored counts the upper bound reaches 1.293 on the
// fastest sampled act, which is 0.007 from the ceiling, and four of the eight blocking coefficients
// are estimates against a §7 that has not shipped. A tuning number that clears its limit by less
// than a percent, on a model whose inputs are half estimated, is one re-measurement away from being
// wrong. The shipped counts clear by 0.085 on the same adversarial bound. That is the whole
// argument for the reduction and it is a margin argument, not a correction — anyone who restores
// §8.3's counts after §7 lands and re-measures is not undoing an error.
//
// The reduction is also cheap by §8.3's own reasoning: `attemptsToBypass` is a CEILING ON THE WORST
// CASE, not a pace. §8.3 says so about P5 directly ("deliberately above what a systematic player
// needs" — with positional feedback, 24 permutations collapse in three or four submissions). A
// player who deduces never reaches the counter at either value, so lowering it changes nothing they
// experience. R9 permits no other dial: the cooldowns are also the anti-spam rate limit and they
// set §8.2's binary-search price, so they were not touched.
//
//   Puzzle  §8.3  now  cooldown  measured wall  blocking coeff  source of the coefficient
//   P1      6     5    45s        3.00 min      0.00            unlocks an index: information only
//   P2      6     5    45s        3.00 min      0.35            retry burn on out-of-band insertion
//   P3      8     6    60s        5.00 min      0.50            +25% scrubber throughput
//   P4      8     6    60s        5.00 min      0.00            forecast readout: information only
//   P5      8     6    90s        7.50 min      0.80            assist route Fuel premium
//   P6      8     6    90s        7.50 min      0.70            launch-window Fuel discount
//   P7      10    7    90s        9.00 min      0.60            +50% Salvage per hulk
//   P8      4     4    90s        4.50 min      0.30            survey probe: you commit blind
//   P9      10    10   150s      22.50 min      n/a             gates nothing; `majors`
//                              graded total
//                                 44.50 min     (was 60.50 min at §8.3's counts)
//
// THE COEFFICIENTS ARE THE LOAD-BEARING INPUT AND HALF OF THEM ARE ESTIMATES, so they are itemised
// rather than averaged. P1, P4 and P9 are 0 because §8.3's "if ignored" line for each is information
// only — a feed announcement, a bar instead of a number, an ending string. P3 and P7 are rate taxes
// and their coefficients are read off the rates §8.3 names (+25% of one module's throughput, +50% of
// one Salvage source). P2, P5, P6 and P8 are FUEL taxes, and §7's launch ladder has not shipped, so
// their magnitudes are ESTIMATED from §8.3's own language — "materially cheaper in Fuel", "a large
// Fuel premium", "a Fuel premium", "you commit blind". THE STORY THAT LANDS §7's LAUNCH LADDER MUST
// RE-MEASURE with real Fuel costs rather than trust this line. The upper bound is what makes that
// safe to defer, because it holds whatever the four estimates turn out to be.
//
// THE GATE FIGURE IS THE NO-BYPASS ONE, DELIBERATELY. §8.7 specifies the measured run as one where
// the archetype buys the Attempt Governor Bypass as soon as `deepSpace` income allows, and that run
// is reported above — but an anti-soft-lock guarantee that depends on the player affording a
// 53,000-Salvage item is not a guarantee. Both are published so the gate does not rest on a
// purchase, which is the same reason §8.7 gives for including it at all: leaving it out entirely
// would make the ratio unfalsifiable in the other direction.
//
// THE PER-PHASE CONSTRAINT (§8.7: bypass wall time for all puzzles in a phase <= 50% of that
// phase's authored duration) holds with room at these counts:
//
//   aftermath     6.0 min / 20-30 min = 20-30%   (§8.7 quoted 30-45% at its own counts)
//   lifeSupport  10.0 min / 45-60 min = 17-22%   (quoted 27-36%)
//   lunar        15.0 min / 60-80 min = 19-25%   (quoted 30-40%)
//   deepSpace    13.5 min / 60-90 min = 15-23%   (quoted 23-35%)
//
// SIMULATE DOES NOT DOMINATE SUBMIT (§8.7's last check), MEASURED. A SUBMIT costs 90s on a
// `deepSpace` puzzle and returns DIRECTION, so a numeric search is logarithmic: 90 x log2(N). A
// SIMULATE costs 20s and returns a bare PASS/FAIL, which carries no ordering, so a simulate-driven
// search is LINEAR: 20 x N/2. Crossover measured at N = 52 candidates — below it SIMULATE is
// faster, above it SUBMIT is. Neither strictly dominates on any numeric puzzle, which is exactly the
// property §8.5 asks the 20 seconds and the bare PASS/FAIL to produce. Do not "improve" the Plot
// Table by shortening the run or adding direction to its result; either one collapses this.
//
// WHY THE MEASURED RATIO IS SO FAR UNDER THE CEILING, stated so nobody "fixes" it upward: cooldowns
// run CONCURRENTLY with generators, modules and contracts. A player waiting out a 90-second governor
// is not idle, they are playing the rest of the game. The 95 minutes in §8.7's table is wall time
// the player spends inside the act, not wall time added to it. R9 correctly removed the offset §8.6
// leaned on — the brute-forcer's banked hint ladder is 135,634 against a lifetime earn of 2.81M,
// i.e. 4.8%, real but not decisive. What actually keeps the ratio small is that five of the nine
// unlocks are conveniences or information, and only four of them touch Fuel at all.
// ---------------------------------------------------------------------------------------------

// Lookup helpers. Finds, not logic — the same shape as getModuleDefinition() in
// data/actSevenModulesConfig.js, and for the same reason: every consumer would otherwise write its
// own `.find()` and one of them would forget the null.
function getPuzzleDefinition(puzzleId) {
  return ACT_SEVEN_PUZZLES.find((puzzle) => puzzle.id === puzzleId) || null;
}

function getPuzzleItemDefinition(itemId) {
  return PUZZLE_ITEMS.find((item) => item.id === itemId) || null;
}

module.exports = {
  ACT_SEVEN_PUZZLES,
  PUZZLE_ITEMS,
  FEEDBACK_LINES,
  HINT_TIER_SECONDS,
  HINT_COSTS,
  PHASE_SALVAGE_RATE,
  PUZZLE_CURRENCY,
  getPuzzleDefinition,
  getPuzzleItemDefinition,
};
