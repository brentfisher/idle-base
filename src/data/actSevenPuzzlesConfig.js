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
  'p1.lastOnly': 'ONLY ONE OF THEM KEPT IT. ALL OF THEM WERE ISSUED ONE.',
  'p1.voided': 'YOU HAVE DROPPED A VOIDED CERTIFICATION. WE DO NOT.',
  // --- P2 ---
  'p2.earlierTremor': 'THAT IS THE TREMOR. THE PANEL ASKED FOR THE VENT.',
  'p2.offByOne': 'ONE YEAR LATE. THE FALL WAS THE YEAR BEFORE THAT.',
  // --- P3 ---
  'p3.otherTown': 'THAT ONE WENT UNDER FLOW. THE PANEL ASKED FOR THE ONE UNDER ASH.',
  'p3.thatIsTheMountain': 'THAT IS THE MOUNTAIN. THE PANEL ASKED FOR THE SETTLEMENT.',
  // --- P4 ---
  'p4.thatIsC': 'THAT IS C. THE GLYPH ON THE MANIFEST IS LARGER.',
  'p4.thatIsM': 'THAT IS M. THE GLYPH ON THE MANIFEST IS SMALLER.',
  // --- P6 ---
  'p6.thatIsTheVent': 'THAT IS THE COASTAL VENT. THE PANEL ASKED ABOUT THE DEPARTURE.',
  'p6.thatIsTheGap': 'THAT IS THE INTERVAL BETWEEN THE TWO FILES, NOT A YEAR.',
  // --- P7 ---
  'p7.mostMonths': 'THAT IS MOST MONTHS. THE PANEL SAID THIS ONE IS NOT MOST MONTHS.',
  'p7.thatIsTheMonth': 'THAT IS THE MONTH. THE PANEL ASKED FOR THE DAY.',
  // --- P8 ---
  'p8.wrongRiver': 'WRONG WATERCOURSE. THAT ONE RUNS THROUGH THE CAPITAL AND CROSSING IT DECIDED NOTHING.',
  'p8.thatIsTheMan': 'THAT IS THE COMMANDER. THE PANEL ASKED FOR THE BOUNDARY.',
  // --- P9 ---
  'p9.thatIsYou': 'THAT IS THE POPULATION UNDER CERTIFICATION. WE ASKED FOR THE PRECEDENT.',
  'p9.theOtherOne': 'THAT ONE WAS FILED EARLIER, AND BY THEM RATHER THAN BY US.',
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
  // -------------------------------------------------------------------------------------------
  // THE NINE, AS INCIDENT ARCHIVES.
  //
  // Each panel holds one Program record of an event on Earth, written in the Program's own
  // bureaucratic register — and each record supplies a CAUSE the historical account does not have.
  // A mountain vented because a vehicle vented on descent. The ground shook in a province because
  // something heavy left from it. The joke is causal inversion: the events are real and the
  // explanations are theirs.
  //
  // THE ANSWER IS ALWAYS IN THE PROMPT. Recognising the event makes a panel instant; not
  // recognising it costs a careful read and nothing else. That distinction is the whole design
  // rule here, and it is not a courtesy — a puzzle that requires outside knowledge is a paywall
  // made of somebody's schooling, and the hint ladder cannot buy its way past ignorance the way it
  // can buy its way past inattention.
  // -------------------------------------------------------------------------------------------

  {
    id: 'circuitConfirmation',
    name: 'Certification Plate',
    artifact: 'Certification Plate',
    phase: 'aftermath',
    inputKind: 'number',
    inputLabel: 'CANDIDATES',
    prompt: [
      "APTITUDE PROGRAM 7 \u2014 CERTIFICATION",
      "CANDIDATE POPULATION: SOL III",
      "ARCHIVE SEGMENT: LOCAL YEAR 69, FIRST RECKONING",
      "",
      "IN THAT LOCAL YEAR THE SEAT OF ADMINISTRATION WAS HELD,",
      "IN SEQUENCE, BY FOUR SEPARATE CANDIDATES.",
      "",
      "EACH WAS CERTIFIED ON TAKING THE SEAT.",
      "EACH CERTIFICATION WAS VOIDED WHEN THE NEXT WAS ISSUED.",
      "THE PROGRAM DOES NOT DEDUCT FOR A VOIDED CERTIFICATION.",
      "",
      "STATE THE NUMBER OF CERTIFICATIONS ISSUED.",
    ].join('\n'),
    promptTranslated: [
      "APTITUDE PROGRAM 7 \u2014 CERTIFICATION",
      "WHO WE WERE WATCHING: EARTH",
      "WHICH BIT OF THE ARCHIVE: THE YEAR 69 AD",
      "",
      "IN THAT ONE YEAR, FOUR DIFFERENT MEN HELD THE THRONE,",
      "ONE AFTER ANOTHER.",
      "",
      "WE SIGNED OFF ON EACH ONE AS HE TOOK IT.",
      "EACH SIGN-OFF WAS TORN UP WHEN THE NEXT MAN ARRIVED.",
      "WE DO NOT SUBTRACT FOR THE ONES WE TORE UP.",
      "",
      "HOW MANY SIGN-OFFS DID WE ISSUE?",
    ].join('\n'),
    // Tolerance 0, and the prompt states the four outright. This is the teaching puzzle: the
    // player must finish it believing the panels are ANSWERABLE, so nothing here is withheld.
    // What it teaches is the act's new lens — these are Earth's own records, kept by somebody
    // else, with the causes filled in wrong. The Year of the Four Emperors is a fact the prompt
    // hands over; recognising it is a bonus, not a gate.
    answer: { value: 4, tolerance: 0 },
    near: [
      { value: 1, lineId: 'p1.lastOnly' },
      { value: 3, lineId: 'p1.voided' },
    ],
    hints: [
      'THE ARCHIVE HAS ALREADY TOLD YOU HOW MANY THERE WERE.',
      'A VOIDED CERTIFICATION WAS STILL ISSUED. WE COUNTED IT.',
      'FOUR MEN. FOUR SIGN-OFFS. IT IS THE YEAR THAT IS FAMOUS, NOT THE SUM.',
    ],
    unlocksLabel: "The artifact index \u2014 later artifacts announce themselves in the feed.",
    ignoredLabel: "You find them by opening this tab.",
    attemptsToBypass: 5,
    attemptCooldownSeconds: 45,
  },

  {
    id: 'zonePlate',
    name: 'Insertion Gauge',
    artifact: 'Insertion Gauge',
    phase: 'aftermath',
    inputKind: 'number',
    inputLabel: 'LOCAL YEAR',
    prompt: [
      "DESCENT INCIDENT \u2014 VENT EVENT",
      "SITE: COASTAL PROVINCE, SOL III",
      "",
      "A VEHICLE VENTED ON DESCENT ABOVE AN INHABITED SLOPE.",
      "THE MOUNTAIN BENEATH IT WAS RECORDED AS THE SOURCE.",
      "WE DID NOT CORRECT THE RECORD.",
      "",
      "THE SETTLEMENTS BELOW WERE SEALED UNDER FALL WITHIN A DAY.",
      "THE ARCHIVE HOLDS THEM INTACT. WE CONSIDER THIS A CLEAN",
      "PRESERVATION AND HAVE LOGGED NO FAULT.",
      "",
      "A TREMOR SEVENTEEN YEARS EARLIER WAS ALSO OURS.",
      "IT IS FILED SEPARATELY AND IS NOT THE EVENT IN QUESTION.",
      "",
      "STATE THE LOCAL YEAR OF THE VENT.",
    ].join('\n'),
    promptTranslated: [
      "DESCENT INCIDENT \u2014 VENTING",
      "WHERE: A COASTAL PROVINCE ON EARTH",
      "",
      "ONE OF OUR VEHICLES VENTED WHILE COMING DOWN OVER A",
      "POPULATED HILLSIDE. THE MOUNTAIN UNDERNEATH GOT THE BLAME.",
      "WE LET IT.",
      "",
      "THE TOWNS BELOW WERE UNDER ASH INSIDE A DAY. THEY ARE",
      "PERFECTLY PRESERVED, WHICH WE HAVE RECORDED AS A SUCCESS.",
      "",
      "THE EARTHQUAKE SEVENTEEN YEARS BEFORE WAS ALSO US, BUT",
      "THAT IS A DIFFERENT FILE AND NOT WHAT WE ARE ASKING ABOUT.",
      "",
      "WHAT YEAR WAS THE VENTING?",
    ].join('\n'),
    // AD 79. The seventeen-years-earlier tremor is AD 62 — a real earthquake at Pompeii, and the
    // reason it is in the prompt at all: it makes 62 a NEAR miss rather than a wrong one, and a
    // player who answers it has read carefully and reached for the wrong file. That is exactly
    // the distinction §8.1 requires the feedback to draw.
    answer: { value: 79, tolerance: 0.05 },
    near: [
      { value: 62, lineId: 'p2.earlierTremor' },
      { value: 80, lineId: 'p2.offByOne' },
    ],
    hints: [
      'THE PROMPT GIVES YOU ONE YEAR AND ONE INTERVAL. IT IS ASKING FOR THE OTHER YEAR.',
      'THE TREMOR IS SEVENTEEN YEARS BEFORE THE VENT, NOT AFTER IT.',
      'A MOUNTAIN ABOVE A BAY, TWO TOWNS UNDER ASH, THE FIRST CENTURY. IT IS 79.',
    ],
    instrumentReadout: "ACCEPT BAND DRAWN TO SCALE: -4.0 ... +4.0. REJECTED ROWS SHOWN OUTSIDE IT.",
    unlocksLabel: "Insertion tolerance readout on the launch panel \u2014 see whether a filed trajectory is in band before committing Fuel.",
    ignoredLabel: "Out-of-band insertions cost a retry burn.",
    attemptsToBypass: 5,
    attemptCooldownSeconds: 45,
  },

  {
    id: 'regulator',
    name: 'Scrubber Regulator',
    artifact: 'Scrubber Regulator',
    phase: 'lifeSupport',
    inputKind: 'word',
    inputLabel: 'SETTLEMENT',
    prompt: [
      "ATMOSPHERIC RECOVERY \u2014 SAMPLE PROVENANCE",
      "",
      "THIS REGULATOR WAS RECOVERED FROM A SEALED SETTLEMENT",
      "ON SOL III, PRESERVED UNDER THE FALL DESCRIBED IN THE",
      "DESCENT INCIDENT FILE.",
      "",
      "TWO SETTLEMENTS WERE SEALED IN THAT EVENT.",
      "THE SECOND WAS TAKEN BY FLOW RATHER THAN BY FALL AND IS",
      "CATALOGUED UNDER A DIFFERENT PROVENANCE.",
      "",
      "THIS UNIT CAME FROM THE ONE UNDER ASH \u2014 THE LARGER, THE",
      "ONE YOUR OWN RECORDS NAME MOST OFTEN.",
      "",
      "STATE THE SETTLEMENT.",
    ].join('\n'),
    promptTranslated: [
      "AIR RECOVERY \u2014 WHERE THIS PART CAME FROM",
      "",
      "WE PULLED THIS REGULATOR OUT OF A TOWN ON EARTH THAT WAS",
      "SEALED UNDER THE ASH FROM THE VENTING INCIDENT.",
      "",
      "TWO TOWNS WENT THAT DAY. THE OTHER ONE WAS TAKEN BY THE",
      "FLOW RATHER THAN THE ASH, AND IT IS FILED SEPARATELY.",
      "",
      "THIS PART CAME FROM THE ASH ONE \u2014 THE BIGGER ONE, THE ONE",
      "YOUR OWN BOOKS TALK ABOUT MOST.",
      "",
      "NAME THE TOWN.",
    ].join('\n'),
    // POMPEII, with HERCULANEUM as the near miss — it is the other town, it was taken by
    // pyroclastic flow rather than ashfall, and the prompt says so. A player who answers it has
    // the right event and the wrong half of it, which is the most useful kind of wrong to be
    // told about precisely.
    accept: ['pompeii', 'pompei', 'pompeii italy'],
    near: [
      { match: ['herculaneum', 'ercolano'], lineId: 'p3.otherTown' },
      { match: ['vesuvius', 'mount vesuvius', 'vesuvio'], lineId: 'p3.thatIsTheMountain' },
    ],
    hints: [
      'THE PANEL WANTS A PLACE, NOT A MOUNTAIN AND NOT A YEAR.',
      'TWO TOWNS WERE BURIED. IT WANTS THE ONE UNDER ASH, NOT THE ONE UNDER FLOW.',
      'IT IS THE ONE WITH THE PLASTER CASTS AND THE BAKERIES. POMPEII.',
    ],
    unlocksLabel: "Regulator override: every Oxygen scrubber runs at +25% throughput.",
    ignoredLabel: "Buy more scrubbers \u2014 pure Salvage.",
    attemptsToBypass: 6,
    attemptCooldownSeconds: 60,
  },

  {
    id: 'manifest',
    name: 'Recovered Ration Manifest',
    artifact: 'Recovered Ration Manifest',
    phase: 'lifeSupport',
    inputKind: 'number',
    inputLabel: 'VALUE',
    prompt: [
      "SUPPLY MANIFEST \u2014 RECOVERED, PARTIAL",
      "",
      "THE ISSUING CLERK WROTE QUANTITIES IN THE LOCAL NOTATION,",
      "WHICH ENCODES NUMBER AS LETTER. THE PROGRAM DOES NOT",
      "STOCK A CONVERTER FOR EVERY POPULATION IT OBSERVES.",
      "",
      "THE COLUMN TOTAL IS RECORDED AS THE SINGLE GLYPH:",
      "",
      "        D",
      "",
      "THE SAME MANIFEST USES C AND M ELSEWHERE.",
      "THEY ARE NOT THE TOTAL.",
      "",
      "STATE THE VALUE OF THE GLYPH.",
    ].join('\n'),
    promptTranslated: [
      "SUPPLY LIST \u2014 RECOVERED, INCOMPLETE",
      "",
      "THE CLERK WROTE THE QUANTITIES IN THE LOCAL NUMBER SYSTEM,",
      "THE ONE THAT USES LETTERS. WE DO NOT CARRY A CONVERTER FOR",
      "EVERY POPULATION WE WATCH.",
      "",
      "THE TOTAL AT THE BOTTOM OF THE COLUMN IS ONE LETTER:",
      "",
      "        D",
      "",
      "C AND M APPEAR ELSEWHERE ON THE SAME LIST.",
      "NEITHER OF THEM IS THE TOTAL.",
      "",
      "WHAT IS THAT LETTER WORTH?",
    ].join('\n'),
    // Roman numerals, which is recognition rather than arithmetic — the distinction this whole
    // rewrite turns on. C and M are named in the prompt precisely so that answering 100 or 1000
    // is a near miss with an obvious correction, rather than a shot in the dark.
    //
    // Tolerance 0: a numeral has one value and there is no reading ambiguity to absorb.
    answer: { value: 500, tolerance: 0 },
    near: [
      { value: 100, lineId: 'p4.thatIsC' },
      { value: 1000, lineId: 'p4.thatIsM' },
    ],
    hints: [
      'THE PANEL IS NOT ASKING YOU TO ADD ANYTHING. IT IS ASKING WHAT ONE LETTER MEANS.',
      'THE OTHER TWO LETTERS IT NAMES ARE WORTH A HUNDRED AND A THOUSAND.',
      'IT SITS BETWEEN THEM. D IS FIVE HUNDRED.',
    ],
    unlocksLabel: "Forecast readout: every resource row gains time-to-empty and time-to-full.",
    ignoredLabel: "You watch bars instead of numbers.",
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
      "INCIDENT INDEX \u2014 SOL III, FIRST RECKONING",
      "",
      "FOUR RECORDS. THE INDEX WAS SHELVED BY PROVINCE AND HAS",
      "LOST ITS ORDER. RESTORE IT BY LOCAL YEAR, EARLIEST FIRST.",
      "",
      "  ORE    GROUND SHOCK, INLAND PROVINCE. LOCAL YEAR 200.",
      "  KAL    STRUCTURE COMMISSIONED AS A LANDING APRON.",
      "         OPENED LOCAL YEAR 80.",
      "  VESH   DESCENT VENT, COASTAL PROVINCE. LOCAL YEAR 79.",
      "  TIRRA  ADMINISTRATIVE TURNOVER, FOUR CANDIDATES.",
      "         LOCAL YEAR 69.",
      "",
      "STATE THE ORDER.",
    ].join('\n'),
    promptTranslated: [
      "INCIDENT LIST \u2014 EARTH, FIRST THOUSAND YEARS",
      "",
      "FOUR FILES. SOMEBODY SHELVED THEM BY PROVINCE AND THE",
      "ORDER IS GONE. PUT THEM BACK IN DATE ORDER, OLDEST FIRST.",
      "",
      "  ORE    EARTHQUAKE INLAND. YEAR 200.",
      "  KAL    THE BUILDING WE USED AS A LANDING PAD.",
      "         OPENED IN THE YEAR 80.",
      "  VESH   THE VENTING OVER THE COAST. YEAR 79.",
      "  TIRRA  FOUR MEN ON THE THRONE IN ONE YEAR. YEAR 69.",
      "",
      "PUT THEM IN ORDER.",
    ].join('\n'),
    // Every year is printed on the row it belongs to, so this is a sort and not a recall test —
    // and the four rows are the other four panels in this file, which is the point of putting it
    // fifth. A player who has solved P1 and P2 already knows two of these dates and is being
    // shown that the archive is one archive.
    sequence: ['tirra', 'vesh', 'kal', 'ore'],
    sequenceTokens: ['ore', 'kal', 'vesh', 'tirra'],
    hints: [
      'EVERY ROW CARRIES ITS OWN YEAR. NOTHING HERE HAS TO BE REMEMBERED.',
      'EARLIEST FIRST. THE SMALLEST YEAR IS 69.',
      'TIRRA 69, VESH 79, KAL 80, ORE 200.',
    ],
    instrumentReadout: "ASSIST LADDER SOLVED: 0 -> ORE +3 -> KAL +6 -> VESH +6 -> TIRRA. GATES MET AT EVERY STEP.",
    unlocksLabel: "The assist route to the outer sites \u2014 materially cheaper in Fuel than a direct transfer.",
    ignoredLabel: "Direct transfers at a large Fuel premium.",
    attemptsToBypass: 6,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'theWindow',
    name: 'Departure Board',
    artifact: 'Departure Board',
    phase: 'lunar',
    inputKind: 'number',
    inputLabel: 'LOCAL YEAR',
    prompt: [
      "DEPARTURE INCIDENT \u2014 GROUND EFFECT",
      "",
      "A HEAVY VEHICLE DEPARTED FROM AN INLAND PROVINCE OF",
      "SOL III UNDER FULL LOAD. THE APRON WAS RATED FOR IT.",
      "THE GROUND WAS NOT.",
      "",
      "SHOCK WAS FELT ACROSS THE PROVINCE AND RECORDED BY THE",
      "POPULATION AS A SEISMIC EVENT OF NATURAL ORIGIN.",
      "NO CORRECTION WAS ISSUED. NO CORRECTION IS PLANNED.",
      "",
      "THE COASTAL VENT IS A SEPARATE FILE, ONE HUNDRED AND",
      "TWENTY-ONE LOCAL YEARS EARLIER, AND IS NOT THIS EVENT.",
      "",
      "STATE THE LOCAL YEAR OF THE DEPARTURE.",
    ].join('\n'),
    promptTranslated: [
      "DEPARTURE INCIDENT \u2014 WHAT IT DID TO THE GROUND",
      "",
      "A HEAVY VEHICLE LIFTED OFF FROM INLAND ON EARTH, FULLY",
      "LOADED. THE PAD COULD TAKE IT. THE GROUND COULD NOT.",
      "",
      "THE SHOCK WAS FELT ACROSS THE WHOLE PROVINCE. THE PEOPLE",
      "THERE WROTE IT DOWN AS AN EARTHQUAKE.",
      "WE DID NOT CORRECT THEM AND WE ARE NOT GOING TO.",
      "",
      "THE COASTAL VENTING IS A DIFFERENT FILE, 121 YEARS EARLIER.",
      "THIS IS NOT THAT.",
      "",
      "WHAT YEAR DID IT LEAVE?",
    ].join('\n'),
    // 200, and the arithmetic is deliberately available rather than required: 79 + 121 is stated
    // in the prompt for a player who has solved P2, and P5 prints the year outright for one who
    // has not. Two routes to the same answer, neither of them a memory test.
    //
    // This is the incident the whole rewrite was specified from — an earthquake in AD 200 that
    // was a launch — so it gets the plainest telling in the file.
    answer: { value: 200, tolerance: 0.1 },
    near: [
      { value: 79, lineId: 'p6.thatIsTheVent' },
      { value: 121, lineId: 'p6.thatIsTheGap' },
    ],
    hints: [
      'THE PROMPT GIVES YOU ANOTHER YEAR AND THE DISTANCE FROM IT.',
      'THE COASTAL VENT IS 79. THIS EVENT IS 121 YEARS AFTER IT.',
      'IT IS THE YEAR 200. THE INDEX PLATE PRINTS IT OUTRIGHT IF YOU HAVE READ IT.',
    ],
    instrumentReadout: "RELATIVE ANGLE, LIVE. INNER GAINS 1/12 - 1/20 = 1/30 OF A CIRCUIT PER UNIT.",
    unlocksLabel: "Launch-window readout \u2014 the next open window and the Fuel discount for waiting.",
    ignoredLabel: "You launch at whatever phase angle you are at, at a Fuel premium.",
    attemptsToBypass: 6,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'releasePoint',
    name: 'Rendezvous Trainer',
    artifact: 'Rendezvous Trainer',
    phase: 'deepSpace',
    inputKind: 'number',
    inputLabel: 'DAY OF MONTH',
    prompt: [
      "DECERTIFICATION \u2014 SCHEDULED",
      "",
      "A CANDIDATE ADMINISTRATOR WAS DECERTIFIED BY HIS OWN",
      "ASSEMBLY. THE PROGRAM DID NOT ORDER IT AND DID NOT",
      "PREVENT IT. WE WERE PRESENT AND WE FILED IT.",
      "",
      "THE LOCAL CALENDAR MARKS A FIXED DAY IN EACH MONTH.",
      "IN MOST MONTHS THAT DAY FALLS ON THE THIRTEENTH.",
      "IN FOUR MONTHS \u2014 INCLUDING THE ONE IN QUESTION \u2014 IT",
      "FALLS TWO DAYS LATER.",
      "",
      "THE MONTH IN QUESTION IS THE THIRD.",
      "",
      "STATE THE DAY OF THE MONTH.",
    ].join('\n'),
    promptTranslated: [
      "REMOVAL FROM OFFICE \u2014 IT WAS IN THE DIARY",
      "",
      "ONE OF THE MEN WE HAD CERTIFIED WAS REMOVED BY HIS OWN",
      "SENATE. WE DID NOT ORDER IT AND WE DID NOT STOP IT.",
      "WE WERE THERE AND WE WROTE IT DOWN.",
      "",
      "THEIR CALENDAR MARKS ONE FIXED DAY EVERY MONTH.",
      "IN MOST MONTHS IT IS THE 13TH.",
      "IN FOUR MONTHS \u2014 INCLUDING THIS ONE \u2014 IT IS TWO DAYS LATER.",
      "",
      "THE MONTH IS MARCH.",
      "",
      "WHAT DAY OF THE MONTH?",
    ].join('\n'),
    // The Ides of March: the 15th, because March is one of the four months where the Ides fall on
    // the 15th rather than the 13th. The prompt states the rule and the exception, so 13 is the
    // near miss of somebody who read half of it — which is the most likely wrong answer and
    // therefore the one that most needs a specific line rather than a shrug.
    answer: { value: 15, tolerance: 0.1 },
    near: [
      { value: 13, lineId: 'p7.mostMonths' },
      { value: 3, lineId: 'p7.thatIsTheMonth' },
    ],
    hints: [
      'THE PANEL HAS TOLD YOU THE RULE AND THEN TOLD YOU THIS MONTH IS AN EXCEPTION.',
      'MOST MONTHS: THE 13TH. THIS ONE: TWO DAYS LATER.',
      'THE IDES OF MARCH. IT IS THE 15TH.',
    ],
    unlocksLabel: "Rendezvous assist: docking with a salvage hulk yields +50% Salvage.",
    ignoredLabel: "Less Salvage per hulk \u2014 purely a rate.",
    attemptsToBypass: 7,
    attemptCooldownSeconds: 90,
  },

  {
    id: 'filedArcs',
    name: 'Trajectory File',
    artifact: 'Trajectory File',
    phase: 'deepSpace',
    inputKind: 'word',
    inputLabel: 'CROSSING',
    prompt: [
      "FILED ARC \u2014 UNAUTHORISED",
      "",
      "A CANDIDATE COMMANDER CROSSED A BOUNDARY HE HAD BEEN",
      "FORBIDDEN TO CROSS, UNDER ARMS, WITH HIS FORMATION.",
      "",
      "THE BOUNDARY WAS A WATERCOURSE AND WAS TRIVIAL TO CROSS.",
      "ITS WIDTH IS NOT WHY IT IS IN THE ARCHIVE.",
      "IT IS IN THE ARCHIVE BECAUSE CROSSING IT COULD NOT BE",
      "UNDONE, AND HE CROSSED IT KNOWING THAT.",
      "",
      "THE PROGRAM FILES THIS ARC UNDER: COMMITTED, NO RETURN.",
      "IT IS THE SAME CLASSIFICATION YOUR FIFTH BURN WILL CARRY.",
      "",
      "NAME THE CROSSING.",
    ].join('\n'),
    promptTranslated: [
      "FILED TRAJECTORY \u2014 NOT AUTHORISED",
      "",
      "A COMMANDER WE WERE WATCHING CROSSED A LINE HE HAD BEEN",
      "ORDERED NOT TO CROSS, ARMED, WITH HIS ARMY BEHIND HIM.",
      "",
      "THE LINE WAS A SMALL RIVER AND EASY TO WADE.",
      "HOW WIDE IT WAS IS NOT WHY WE KEPT THE FILE.",
      "WE KEPT IT BECAUSE ONCE HE WAS ACROSS THERE WAS NO GOING",
      "BACK, AND HE KNEW THAT WHEN HE STEPPED IN.",
      "",
      "WE FILE THIS ONE AS: COMMITTED, NO RETURN.",
      "IT IS WHAT WE WILL FILE YOUR FIFTH BURN AS.",
      "",
      "NAME THE RIVER.",
    ].join('\n'),
    // The Rubicon, and it is here rather than anywhere else in the ladder for one reason: it is
    // the act's own ending described in somebody else's archive. The fifth burn is committed, has
    // no arrival, and cannot be undone. The panel says so outright — which is the closest this
    // file comes to telling the player what the act is about.
    accept: ['rubicon', 'the rubicon', 'rubicone'],
    near: [
      { match: ['tiber', 'the tiber', 'tevere'], lineId: 'p8.wrongRiver' },
      { match: ['caesar', 'julius caesar', 'gaius julius caesar'], lineId: 'p8.thatIsTheMan' },
    ],
    hints: [
      'THE PANEL WANTS THE BOUNDARY, NOT THE MAN AND NOT THE YEAR.',
      'A SMALL RIVER IN THE NORTH. THE CROSSING IS THE FAMOUS PART, NOT THE WATER.',
      'THE DIE IS CAST. IT IS THE RUBICON.',
    ],
    unlocksLabel: "Free-return survey probe \u2014 reads the next site's yields before you commit Fuel to a crewed launch.",
    ignoredLabel: "You commit blind.",
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
      "FINAL CERTIFICATION \u2014 PRECEDENT REQUIRED",
      "",
      "BEFORE A POPULATION IS CERTIFIED, THE PROGRAM CITES ONE",
      "PRIOR PROGRAM ON THE SAME WORLD.",
      "",
      "THE PRECEDENT: A SETTLEMENT WE CERTIFIED, SUPPLIED AND",
      "OBSERVED FOR TWELVE HUNDRED LOCAL YEARS. IT ADMINISTERED",
      "MOST OF THE KNOWN SURFACE. WE LOGGED ITS ROADS, ITS WATER",
      "AND ITS RECKONING OF NUMBER.",
      "",
      "WHEN IT FAILED WE DID NOT INTERVENE. WE FILED IT AND WE",
      "WAITED FOR THE NEXT ONE. YOU ARE THE NEXT ONE.",
      "",
      "EVERY OTHER PANEL IN THIS ARCHIVE IS ONE OF ITS RECORDS.",
      "",
      "NAME THE PRECEDENT.",
    ].join('\n'),
    promptTranslated: [
      "FINAL SIGN-OFF \u2014 WE NEED A PRECEDENT",
      "",
      "BEFORE WE CERTIFY A POPULATION WE HAVE TO CITE AN EARLIER",
      "PROGRAM ON THE SAME WORLD.",
      "",
      "THE PRECEDENT: A CITY WE CERTIFIED, SUPPLIED AND WATCHED",
      "FOR TWELVE HUNDRED YEARS. IT RAN MOST OF THE KNOWN WORLD.",
      "WE HAVE ITS ROADS, ITS WATER SYSTEM AND ITS NUMBERS ON FILE.",
      "",
      "WHEN IT FELL WE DID NOT STEP IN. WE FILED IT AND WAITED",
      "FOR THE NEXT ONE. YOU ARE THE NEXT ONE.",
      "",
      "EVERY OTHER PANEL HERE IS ONE OF ITS FILES.",
      "",
      "NAME IT.",
    ].join('\n'),
    // ROME, and the last panel is the one that says what the other eight were for: every incident
    // in this archive belongs to a civilisation that was certified, watched, and filed when it
    // ended. The player is told, in the alien's own flat register, that they are the second entry
    // in a list — which is the same joke the act opened with, aged two thousand years.
    //
    // EARTH is the near miss and it is the most interesting wrong answer in the file: it is what
    // a player reaches for when they have understood the frame but not the question. The line
    // tells them they are right about everything except which one is being cited.
    accept: ['rome', 'roma', 'the roman empire', 'roman empire', 'rome italy'],
    near: [
      { match: ['earth', 'sol iii', 'sol 3', 'terra'], lineId: 'p9.thatIsYou' },
      { match: ['carthage', 'karthago'], lineId: 'p9.theOtherOne' },
    ],
    hints: [
      'EVERY OTHER PANEL IN THIS ARCHIVE IS A RECORD OF THE SAME PLACE.',
      'AN ASH-BURIED TOWN, A LANDING APRON WITH TIERS, LETTERS FOR NUMBERS, A RIVER CROSSED.',
      'ALL ROADS. IT IS ROME.',
    ],
    unlocksLabel: "APTITUDE CONFIRMED \u2014 the crossing is certified, not merely fuelled.",
    ignoredLabel: "The crossing still happens the moment the Fuel threshold is met, and the program certifies you as PERSISTENT.",
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
