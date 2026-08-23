// Tuning and palette for the Act VII resource readout — the header chips (PRD §6.6) and, as of
// STORY-035, the Ops panel's rate rows (§6.4).
//
// Everything the readout decides is a number, and a number inline in an engine or a component is
// a bug — so both the warning threshold and the chip colours live here.
//
// BOTH SURFACES ARE CLASSIFIED FROM THIS ONE FILE, and that is the reason resourceTone() below and
// rateClass() at the foot of it are neighbours rather than one living beside each caller. They read
// the same row and answer the same question — which state is this resource in — and the two would
// eventually disagree about it if they were written a component apart. They differ only in what
// they hand back, because the header paints inline `{ bg, ink }` pairs and the panel wears
// STORY-034's `--v7-*` classes; the priority ORDER is the design, and it is stated once.

// How close to empty counts as a warning, in seconds of remaining runway.
//
// NINETY SECONDS, AND THE FIGURE IS DERIVED RATHER THAN CHOSEN. The relieving purchase for every
// bus shortfall in the opening phase is the RTG rung — the cheapest row in the act — and the
// measured time to afford one from a standing start in `aftermath` is roughly 90 seconds. A
// warning is only useful if it arrives while the player can still act on it, so the threshold is
// the cost of the fix, not a round number.
//
// It is deliberately not longer. Act VII's whole economy is resources crossing boundaries; a
// threshold of five minutes would light the chip during ordinary play and teach the player to
// ignore it, which is strictly worse than no warning.
const RESOURCE_WARNING_SECONDS = 90;

// Float slack for "is this at capacity". The colony integrates in continuous steps and clamps at
// the ceiling, so a resource parked at its cap lands a hair under it as often as exactly on it.
// Without the slack the FULL badge would flicker on and off every tick.
const RESOURCE_FULL_EPSILON = 1e-6;

// Chip colours. `{ bg, ink, accent }` — a dark ground, one readable ink, and a per-state ACCENT
// that the meter fill, the rate and the chip's edge all take.
//
// ---------------------------------------------------------------------------------------------
// THIS TABLE WAS SIX SATURATED PASTEL FILLS AND IT WAS REPLACED. WHY.
// ---------------------------------------------------------------------------------------------
// The original pairs were bright grounds with dark ink — #9fd8b4, #e0a35c, #e8837f and so on — in
// the { bg, ink } shape data/eras.js uses for the era pill, and every one of them cleared 4.5:1 by
// a wide margin. They were still wrong, and reported as such: "these look bad, let's make them more
// legible."
//
// TWO SEPARATE FAULTS, and the contrast arithmetic could not have caught either.
//
// 1. THEY BELONGED TO THE WRONG ACT. Act VII's visual identity is a rule and not a mood: cold,
//    near-monochrome, with exactly ONE warm colour — the amber instrument glow — and everything
//    else blue-grey (see the `--v7-*` tokens in styles/global.css and the palette note in
//    conventions). Four saturated pastels sitting in that header were four of the brightest objects
//    on a screen otherwise built out of #0e1622, and they read as belonging to the ballpark the act
//    had just torn down. The comment they replace argued the opposite in as many words — "the
//    Act VII header still looks like this game's header" — and that was the mistake: at this point
//    in the game it is not supposed to.
//
// 2. FOUR CHIPS AT MAXIMUM SALIENCE IS NO SALIENCE AT ALL. A status colour has one job, which is to
//    make the ONE resource in trouble jump out of the row. When every chip is a filled block, the
//    starved one is competing with three healthy ones for the same attention, and the reading a
//    player actually needs — "which of these four is the problem" — is the hardest one on the chip.
//    Now the quiet states are quiet: a resource at rest is grey text on the panel's own ground, and
//    a colour in this row means something is happening.
//
// The ink is the same on every chip because legibility should not be a function of state, and the
// state is carried by the accent instead — on the meter fill, on the signed rate, and on the chip's
// border, which is three channels rather than one and none of them colour-only (the rate carries a
// sign, the meter carries a length, and the badge text says the word).
//
// CONTRAST RATIOS COMPUTED, NOT ASSERTED, the same way the table before it did — WCAG 2.1 relative
// luminance (sRGB, the 0.03928/12.92 piecewise transform, (L1+0.05)/(L2+0.05)), under `node`,
// against the #0a1018 chip ground:
//
//   ink       #dbe6f2   15.10:1     <- every chip's text, whatever state it is in
//   steady    #9db4cc    8.94:1
//   rising    #5ad1a0   10.05:1
//   falling   #ffb340   10.70:1
//   warning   #ff8a66    8.25:1
//   starved   #ff6b57    6.81:1     <- worst pair
//   full      #6fa8d0    7.44:1
//
// Worst pair 6.81:1 against a 4.5:1 bar (chips render at ~0.78rem, which is normal-size text for
// contrast purposes). The accents are the act's own `--v7-*` tokens wherever one exists —
// `--v7-good`, `--v7-accent`, `--v7-drain`, `--v7-alert` — so the header and the Ops panel are
// literally the same four colours meaning the same four things. `full` and `steady` are the two
// states the panel has no token for and are the only literals here.
//
// THE ESCALATION IS THE POINT OF THE ORDER: amber (falling — you have time), then drain (warning —
// the time is nearly gone), then alert (starved — it is gone). A player who learns the ramp on the
// Ops panel reads it in the header without being taught twice.
const RESOURCE_CHIP_GROUND = '#0a1018';
const RESOURCE_CHIP_INK = '#dbe6f2';

const RESOURCE_TONES = {
  steady: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#9db4cc' },
  rising: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#5ad1a0' },
  falling: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#ffb340' },
  warning: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#ff8a66' },
  starved: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#ff6b57' },
  full: { bg: RESOURCE_CHIP_GROUND, ink: RESOURCE_CHIP_INK, accent: '#6fa8d0' },
};

// Which tone a row wears, in priority order. Ordered rather than a lookup because the states are
// not mutually exclusive — a resource can be falling AND inside the warning window — and the
// priority IS the design: what has already broken outranks what is about to, which outranks the
// direction of travel.
function resourceTone(row) {
  if (row.starved) return RESOURCE_TONES.starved;
  if (row.warning) return RESOURCE_TONES.warning;
  if (row.full) return RESOURCE_TONES.full;
  if (row.trend === 'falling') return RESOURCE_TONES.falling;
  if (row.trend === 'rising') return RESOURCE_TONES.rising;
  return RESOURCE_TONES.steady;
}

// Which STORY-034 modifier a signed rate wears on the Ops panel: `--v7-alert`, `--v7-drain`,
// `--v7-good`, or the muted default (PRD §6.4).
//
// THE PIN OUTRANKS THE SIGN, AND THAT ORDERING IS THE WHOLE REASON THIS FUNCTION EXISTS. A pinned
// resource reads 0/s, so on `trend` alone it is 'steady' and would be painted the same muted grey
// as a colony sitting comfortably at equilibrium — which is the one confusion the panel is built to
// prevent. Decision 3.3's promise is that a starved colony is throttled and never broken, and the
// player can only believe that promise if they can see the throttle. `--v7-alert` is the louder
// colour precisely because being clamped is the more serious state: falling means you have time,
// pinned means the time is already gone. The `.v7-rate` rules in styles/global.css say the same
// thing from the CSS side.
//
// It takes a ROW, not a net rate, for the reason conventions.md gives: a component that had to
// unpack `pinned` and `trend` and decide between them is a component deciding a rule, and it is the
// exact line that would need editing the day a fourth state is added.
//
// '' RATHER THAN A CLASS FOR THE DEFAULT. `.v7-rate` on its own is already the muted state, so the
// steady case wants no modifier at all — and returning a real class name for it would mean
// inventing an `is-steady` rule that only ever restated the base.
function rateClass(row) {
  if (row.pinned) return 'is-alert';
  if (row.trend === 'falling') return 'is-drain';
  if (row.trend === 'rising') return 'is-good';
  return '';
}

// The same question for the METER fill, and it is deliberately not the same answer.
//
// A rising rate gets no modifier here where it gets `is-good` above, because `.v7-meter-fill` is
// ALREADY `--v7-good` at rest — a bar that is filling is the ordinary case, and colouring it
// specially would leave the panel with no visual quiet at all. Only the two bad states are worth a
// colour on a 6px bar seen at a glance.
//
// The empty pin colours the meter and the capacity pin does not: at 'capacity' the bar is full,
// which is a picture that is already correct and already reassuring, and repainting it alarm-red
// would say the tank is broken when what is actually happening is that the tank is finished. The
// RATE beside it is where that surplus gets reported, which is what rateClass() is for.
function meterClass(row) {
  if (row.pinned === 'empty') return 'is-alert';
  if (row.trend === 'falling') return 'is-drain';
  return '';
}

module.exports = {
  RESOURCE_WARNING_SECONDS,
  RESOURCE_FULL_EPSILON,
  RESOURCE_TONES,
  resourceTone,
  rateClass,
  meterClass,
};


// ---------------------------------------------------------------------------------------------
// VERIFIED — the contrast figures in the block over RESOURCE_TONES are RECOMPUTED in the harness
// rather than trusted from the comment (the table they replaced carried guessed numbers once).
// Part of the 125-assertion run recorded in components/playoffs/PlayoffBracket.js.
//
//   · every tone supplies bg, ink AND accent — a missing accent is a chip that silently loses
//     its state colour and its meter                                                         PASS
//   · ink clears 4.5:1 on every tone (15.10:1 — it is one ink on one ground)                 PASS
//   · every accent clears 4.5:1 on the chip ground; worst is `starved` at 6.81:1             PASS
//   · resourceTone()'s priority survives the reshape: starved > warning > full > falling >
//     rising > steady                                                                        PASS
//   · ResourceChips threads `--resource-accent`, and HeaderStats renders whole                PASS
//
// LAYOUT, measured in a 390x844 iframe rather than assumed. The desktop sizing took
// `.header-stats` from 144px to 229px at that width — 85px on the target device, in the row the
// Mobile section records having had to shrink once already. The mobile block at the foot of
// global.css compacts the chips back: re-measured at 147px, with no horizontal overflow.
// ---------------------------------------------------------------------------------------------
