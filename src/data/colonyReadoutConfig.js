// Tuning and palette for the Act VII header resource readout (PRD §6.6).
//
// Everything the readout decides is a number, and a number inline in an engine or a component is
// a bug — so both the warning threshold and the chip colours live here.

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

module.exports = {
  RESOURCE_WARNING_SECONDS,
  RESOURCE_FULL_EPSILON,
  RESOURCE_TONES,
  resourceTone,
};
