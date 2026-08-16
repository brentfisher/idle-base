// Act VII's phase pills — PRD §6.8.
//
// The tokens themselves (`--v7-*`) live in styles/global.css, because a CSS custom property is
// CSS. What lives HERE is the one part of §6.8 that a component has to read at runtime: the pill
// colour for the current phase. It is data for exactly the reason data/eras.js:11-14 gives for the
// era pill — a component matching on the phase id, or a CSS class per phase, would both have to be
// edited by whatever story adds a sixth phase, and the pill is the element most likely to be
// forgotten in that edit. `{ bg, ink }` is eras.js's shape, deliberately: HeaderStats renders both
// through the same slot and the same inline-style path, so the two can never need different code.
//
// THE PALETTE, AND WHY IT IS THIS PALETTE. The ballpark is warm and saturated — green ground,
// gold, clay, outfield blue. Act VII is cold and near-monochrome, with exactly one warm colour in
// it: the amber accent, which is the instrument glow. Everything the player buys or reads is
// amber; everything else is blue-grey. The phase pills are the one place that rule is relaxed,
// because a pill's whole job is to be told apart from the four other pills at a glance.
//
// CONTRAST. Every pair below clears the 4.7:1 floor eras.js set for itself, and the ratios are
// COMPUTED rather than eyeballed — WCAG relative luminance, ink against bg. The reason is the one
// eras.js states and it applies harder here: chips render at 0.78rem on a phone, which is
// normal-size text for contrast purposes, so anything under 4.5:1 is unreadable in sunlight on the
// bus. Recompute rather than adjust by eye if any value moves; the arithmetic is in the block at
// the foot of this file.
//
// THE ORDER IS A SEQUENCE, NOT A SET. Consecutive picks sit far apart on the colour wheel, for the
// reason eras.js:76-79 gives — "a teal that becomes a slightly different teal" fails at being
// noticed, and a phase change the player does not notice is a phase change that did not happen.
//
// ONE DELIBERATE EXCEPTION: lunar bone (hue ~44°) and majors gold (hue ~46°) are nearly the same
// hue. They are not consecutive — dusk violet sits between them — saturation separates them at a
// glance, and the near-rhyme is the point. Bone is what gold looks like with the life bleached out,
// and getting the gold back is the whole arc of the act.
const ACT_SEVEN_PHASE_PILLS = {
  // Ash green — the ballpark's own colour, drained. The one phase that still remembers what the
  // game used to be, which is why it is the only pill with any green left in it.
  aftermath: { bg: '#8a9a91', ink: '#0a1014' },
  // Oxygen cyan: the colour of a gauge you are watching rather than a place you are.
  lifeSupport: { bg: '#4fb3c4', ink: '#04161a' },
  // Regolith bone.
  lunar: { bg: '#cfc7b6', ink: '#14181f' },
  // Dusk violet — furthest from everything before it, and the only pill with no analogue anywhere
  // else in the game.
  deepSpace: { bg: '#9b86e0', ink: '#0d0a1c' },
  // THE GAME'S OWN GOLD, AND ACT VI'S EXACT PAIR (#f4d35e on #14210f — see the era pills in
  // data/eras.js and `.tab-nav button.active` in styles/global.css). The last phase is the only
  // place the ballpark palette returns, because the majors is the thing baseball was always the
  // farm team for. Do not "harmonise" this one with the four above it; its being borrowed is the
  // entire point.
  majors: { bg: '#f4d35e', ink: '#14210f' },
};

// Returns the pill for a phase, or null when the id is unrecognized.
//
// NULL RATHER THAN A DEFAULT PILL, and the caller is expected to render an uncoloured chip in that
// case. `expedition.phase` is self-healing — engine/sites.js recomputes it from a predicate ladder
// every tick and writes only on a difference — so an unknown id is one tick from repair. Falling
// back to a real colour would paint a corrupt value as though it were a phase; falling back to
// nothing would hide it. An uncoloured chip showing the raw id is the honest middle, and it is what
// HeaderStats already does with the label.
function getPhasePill(phaseId) {
  return ACT_SEVEN_PHASE_PILLS[phaseId] || null;
}

// ---------------------------------------------------------------------------------------------
// MEASURED — WCAG 2.x relative-luminance contrast, ink on bg, computed rather than eyeballed.
//
//   phase         bg        ink       ratio    floor
//   aftermath     #8a9a91   #0a1014   6.5:1    4.7 OK
//   lifeSupport   #4fb3c4   #04161a   7.6:1    4.7 OK
//   lunar         #cfc7b6   #14181f   10.6:1   4.7 OK
//   deepSpace     #9b86e0   #0d0a1c   6.4:1    4.7 OK
//   majors        #f4d35e   #14210f   11.4:1   4.7 OK
//
// Lowest pair is deepSpace at 6.4:1, which clears the floor by 1.7 and the WCAG AA normal-text
// threshold (4.5) by 1.9. The check, if it needs rerunning: L = 0.2126R + 0.7152G + 0.0722B over
// channels linearised as c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4, then
// (Llighter + 0.05) / (Ldarker + 0.05).
// ---------------------------------------------------------------------------------------------

module.exports = { ACT_SEVEN_PHASE_PILLS, getPhasePill };
