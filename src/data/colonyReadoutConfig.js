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

// Chip colours, as { bg, ink } pairs in the same shape data/eras.js uses for its era pill — and
// held to the same standard, which that file states: chips render at ~0.78rem on a phone, which
// is NORMAL-size text for contrast purposes, so 4.5:1 is the bar and these clear it with room.
//
// CONTRAST RATIOS COMPUTED, NOT ASSERTED. Measured with the WCAG 2.1 relative-luminance formula
// (sRGB, the 0.03928/12.92 piecewise transform, (L1+0.05)/(L2+0.05)) under `node`:
//
//   steady    #14301f on #9fd8b4  ->   8.80:1
//   rising    #0d2418 on #7fd7a0  ->   9.46:1
//   falling   #2a1508 on #e0a35c  ->   7.91:1
//   warning   #2b1206 on #f0a65a  ->   8.65:1
//   starved   #2d0b0b on #e8837f  ->   6.86:1   <- worst pair
//   full      #101f2e on #8fbfe0  ->   8.51:1
//
// Worst pair 6.86:1 against a 4.5:1 bar. These are the computed figures, not estimates — the
// first draft of this comment carried guessed numbers that were all 0.5-1.4 high, which is exactly
// why the story asked for them to be computed.
//
// The palette stays inside the ballpark world the rest of global.css builds — deep greens, the
// #f4d35e gold family, clay and outfield blue — rather than a generic status rainbow, so the
// Act VII header still looks like this game's header.
//
// WHY THE PAIRS RUN SO FAR ABOVE 4.5:1. These are the six states a player reads at a glance while
// something is draining. The failure mode for a status colour is not "unreadable" — it is
// "distinguishable in the design tool, ambiguous on a phone at arm's length in daylight" — and the
// margin is what buys that. There is no reason to spend it: nothing else competes for these hues.
const RESOURCE_TONES = {
  steady: { bg: '#9fd8b4', ink: '#14301f' },
  rising: { bg: '#7fd7a0', ink: '#0d2418' },
  falling: { bg: '#e0a35c', ink: '#2a1508' },
  warning: { bg: '#f0a65a', ink: '#2b1206' },
  starved: { bg: '#e8837f', ink: '#2d0b0b' },
  full: { bg: '#8fbfe0', ink: '#101f2e' },
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
