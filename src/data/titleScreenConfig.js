// Every authored word on the two framing screens — the title screen a brand new save opens on, and
// the welcome-back screen a returning player lands on — plus the act-by-act description of the
// backdrop that sits behind both of them.
//
// Components render this file; they never contain prose (PRD §6.3). That rule is why the awkward
// bits below are FUNCTIONS rather than templates the component fills in: the capped-absence
// sentence has to name two durations in one breath and read like English, and a component
// assembling that from three string fragments would be prose living in components/ under another
// name. data/playoffsConfig.js's seasonOutcomeParts() and data/feedMessages.js's playoffRoundLabel()
// are the precedent.

const { MAX_PIXEL_RATIO } = require('./launchSceneConfig');

// -------------------------------------------------------------------------------------------
// THE TITLE SCREEN
// -------------------------------------------------------------------------------------------

// DELIBERATELY NOT THE SAME WORDS AS THE ACT I STORY CARD (data/storyBeats.js `act-1-intro`). The
// two screens play back to back — title, then Start, then the card — so anything said twice reads
// as a bug. The card does the scene: Mr. Dorsey, the caps, kneeling down in the dust. This screen
// only names the game and says how long the road is, so that the card still gets to open on
// something the player has not read yet.
const titleScreenCopy = {
  // Matches the document title in public/index.html. If one moves, move the other.
  name: 'Idle Base',
  tagline: 'An idle baseball odyssey.',
  premise: [
    'A vacant lot behind a hardware store, a penny a bottle cap, and a whole summer to spend '
      + 'on it.',
    'Everything after that — the wall, the league, the lights, and whatever is left when the '
      + 'baseball runs out — you build one afternoon at a time.',
  ],
  startLabel: 'Start in the lot',
};

// -------------------------------------------------------------------------------------------
// THE WELCOME-BACK SCREEN
// -------------------------------------------------------------------------------------------

// THE HONESTY REQUIREMENT LIVES IN THIS OBJECT, and it is the reason the screen exists at all.
//
// Offline progress is capped (data/balanceConfig.js `offlineCapSeconds`). A player who closes the
// tab on Friday and opens it on Monday was away for three days and earned eight hours. A screen
// that showed only the income would be telling that player, by omission, that three days of the
// game happened — and the next thing they do is check their balance against that belief and
// conclude the game took something from them.
//
// So `cappedProse()` states BOTH figures in the same paragraph: how long they were gone, and how
// much of it actually ran. Neither number is useful without the other, which is why they are not
// two separate lines a layout change could separate.
//
// NEITHER FIGURE IS HARDCODED HERE, and the cap is not written out as "eight hours" anywhere in
// this file. `simulatedSeconds` IS the applied cap, so the sentence names the policy off the number
// the engine actually used. A prose literal would go stale silently the day the cap moves.
const returnSummaryCopy = {
  title: 'Welcome back',
  dismissLabel: 'Back to it',
  earnedHeading: 'Earned while you were gone',
  storageHeading: 'In storage now',

  // The ordinary case: everything they were away for was simulated.
  awayProse: function awayProse(awayText) {
    return [`You were away for ${awayText}, and all of it ran.`];
  },

  // The capped case. Two sentences, both figures, no arithmetic asked of the player.
  cappedProse: function cappedProse(awayText, simulatedText) {
    return [
      `You were away for ${awayText}, but only the first ${simulatedText} of that was simulated.`,
      `Offline progress stops at ${simulatedText}. The rest of your time away earned nothing, and `
        + `everything below is that ${simulatedText} — not the full ${awayText}.`,
    ];
  },

  // Shown when `currencies` and `resources` are both empty. The absence is still worth a screen:
  // it answers the question the player opened the tab with.
  nothingMovedLine: 'Nothing moved while you were gone.',

  // THE SECOND HONEST LINE. Act VII's consumables have capacity ceilings (data/actSevenConfig.js),
  // so the figures in `resources` are what the tanks HOLD, not what was produced — a tank that
  // filled two hours in kept producing into nothing. Saying "you gained this much oxygen" would be
  // a precise-looking lie in exactly the case the player is most likely to check.
  storageCaveat:
    'These are tank levels, not production. Anything made after a tank filled up spilled, so a '
    + 'full tank may be hiding a good deal more than it shows.',
};

// -------------------------------------------------------------------------------------------
// THE BACKDROP, ACT BY ACT
// -------------------------------------------------------------------------------------------

// *** THE SCREEN CHANGES WITH THE ACT THE PLAYER IS IN. THIS TABLE IS THAT CHANGE. ***
//
// The two framing screens share one WebGL backdrop, and which one draws is keyed on
// `state.progression.act` (0-6). The reason it is keyed on the act and not fixed is the
// welcome-back screen: a title screen alone is always Act I, so an act axis would be decoration.
// A returning player can be anywhere in the arc, and the picture behind "Welcome back" saying
// where they left off is the cheapest possible reminder of what they were in the middle of.
//
// Each row is read by components/layout/ActBackdrop.js and nothing else. A row is:
//
//   actIndex  the act it belongs to; the array is indexed by it and the two must agree.
//   id        stable identifier, used in nothing but logs and this table's own readability.
//   motif     which builder in ActBackdrop.js draws the furniture. The set of legal values is
//             that file's SHAPE_BUILDERS map, and an unknown motif draws ground and motes only —
//             a plainer picture, never a crash.
//   palette   sky (background AND fog), ground, accent (the one lit colour), mote.
//   ground    opacity of the ground plane, 0 to hide it entirely (Act VII has no ground).
//   camera    where the eye stands and what it points at: { height, lookAt, distance }, in world
//             units. PER-ACT rather than one shared framing, and it was one shared framing until
//             the scenes were looked at: the banner is a wide, ~170px-tall strip, so a camera
//             composed for Act II's 34-unit-tall brick wall puts Act III's flat infield down in the
//             bottom fifth of the frame — behind the title text, which is exactly where the picture
//             stops being a picture. Lowering `lookAt` tilts the eye down and lifts ground-level
//             furniture toward the middle; raising it makes room for something tall.
//   motes     the drifting particle field: how many, how far they spread, how fast they rise.
//             The pool is allocated once at build time and never grows, so `count` is a real
//             per-device cost and the numbers stay small on purpose.
//   note      why this act looks the way it does. Kept in the data rather than in the component
//             because the mapping IS the design, and a reader should be able to learn the whole
//             scheme from this file without opening any JSX.
//
// THE SCHEME, IN ONE LINE: the ground rises from dirt to grass and the light goes from noon to
// floodlights to no sun at all. Act I is lit by the sky. Acts V and VI are lit by towers somebody
// paid for. Act VII has neither, and that is the point of Act VII.
const BACKDROPS = [
  {
    actIndex: 0,
    id: 'lot',
    motif: 'lot',
    palette: { sky: 0x2b2a20, ground: 0x6b5636, accent: 0xd8a13c, mote: 0xcbb68a },
    ground: 0.5,
    camera: { height: 9.5, lookAt: 5, distance: 34 },
    motes: { count: 90, spread: 60, rise: 1.6, size: 0.5 },
    note:
      'Act I is a lot nobody mows behind the hardware store on Vine. Flat dirt, the store\'s back '
      + 'wall as a dark slab on the horizon, bottle caps lying where Mr. Dorsey threw them, and '
      + 'dust in the air because a nine-year-old on his knees is what is stirring it up.',
  },
  {
    actIndex: 1,
    id: 'wall',
    motif: 'wall',
    palette: { sky: 0x2a211d, ground: 0x5e4a30, accent: 0xc4553a, mote: 0xe8e2d2 },
    ground: 0.45,
    camera: { height: 9.5, lookAt: 9, distance: 34 },
    motes: { count: 70, spread: 46, rise: 1.1, size: 0.45 },
    note:
      'Act II is the loading dock wall and the strike zone somebody chalks on it every spring. '
      + 'Brick fills the frame — it is the whole act — and the motes are chalk rather than dust, '
      + 'because at this point the dirt is not what is getting kicked around.',
  },
  {
    actIndex: 2,
    id: 'sandlot',
    motif: 'sandlot',
    palette: { sky: 0x1d3524, ground: 0x2f6a3a, accent: 0xf4d35e, mote: 0xa9d6b0 },
    ground: 0.55,
    camera: { height: 9.5, lookAt: 2.5, distance: 32 },
    motes: { count: 60, spread: 70, rise: 0.7, size: 0.4 },
    note:
      'Act III is the first time there are chalk lines somebody else drew. Grass arrives here — '
      + 'the ground turns from the lot\'s brown to a field\'s green — and the accent is the '
      + 'trophy yellow the rest of the UI already uses for anything won.',
  },
  {
    actIndex: 3,
    id: 'travel',
    motif: 'travel',
    palette: { sky: 0x15302a, ground: 0x2c6440, accent: 0xf0b429, mote: 0x9fc6a9 },
    ground: 0.55,
    camera: { height: 10, lookAt: 2.5, distance: 36 },
    motes: { count: 60, spread: 90, rise: 0.6, size: 0.4 },
    note:
      'Act IV is Ashland on a Saturday: the same diamond, seen from further back, with the row of '
      + 'station wagons parked along the outfield fence and their headlights still on. The field '
      + 'has not changed. The number of people who drove to it has.',
  },
  {
    actIndex: 4,
    id: 'minors',
    motif: 'minors',
    palette: { sky: 0x0e2436, ground: 0x1f5a35, accent: 0xffe9a8, mote: 0x8fb4cf },
    ground: 0.6,
    camera: { height: 9.5, lookAt: 3.5, distance: 34 },
    motes: { count: 80, spread: 80, rise: 1.2, size: 0.4 },
    note:
      'Act V is the first night game. Two towers, and the sky goes blue-black behind them — this '
      + 'is where the light in these pictures stops coming from the sun and starts coming from '
      + 'something with a power bill. The motes are the bugs around the lamps.',
  },
  {
    actIndex: 5,
    id: 'majors',
    motif: 'majors',
    palette: { sky: 0x081a2c, ground: 0x1c6338, accent: 0xfff2c4, mote: 0xbfd6ea },
    ground: 0.65,
    camera: { height: 9.5, lookAt: 3.5, distance: 34 },
    motes: { count: 100, spread: 96, rise: 1.0, size: 0.4 },
    note:
      'Act VI is the bowl: a ring of stands all the way around and a full crown of lights above '
      + 'it. Everything you have done was to get here, so it is the brightest picture in the set '
      + 'and the only one where the field is completely enclosed.',
  },
  {
    actIndex: 6,
    id: 'expedition',
    motif: 'expedition',
    // Deliberately close to data/launchSceneConfig.js's PALETTE without importing it: that file's
    // colours are tuned for a scene the player reads POSITIONS off, and this one is decoration. The
    // family resemblance is the point; a shared constant would couple a backdrop to a simulation.
    palette: { sky: 0x05070f, ground: 0x000000, accent: 0xffd9b0, mote: 0xcfd8e8 },
    // No ground. There is no field any more, and the missing plane is the loudest thing on the
    // screen for a player who has seen the other six.
    ground: 0,
    camera: { height: 9.5, lookAt: 4, distance: 34 },
    motes: { count: 140, spread: 140, rise: 0.15, size: 0.5 },
    note:
      'Act VII is after the teardown. Stars, the four rungs of the ladder laid out in the shape '
      + 'of the infield they are named after, and a burn arc lifting off the plane of the field. '
      + 'The ballpark is gone and the geometry it left behind is not.',
  },
];

// ERA IS ACKNOWLEDGED, CHEAPLY, AND ONLY WHERE IT MEANS ANYTHING. Prestige eras (data/eras.js) do
// not exist until a player has won and banked a run, and the acts they replay are VI and VII — so
// tinting anything earlier would be tinting a screen no era-1 player will ever see. Only the rows
// that opt in with `eraTinted` are touched, and the effect is one colour: the light in the park.
// Index by era, cycling, so an extrapolated era beyond the authored table still lands somewhere.
const ERA_ACCENTS = [0xfff2c4, 0xd8dee9, 0xa8d8ff, 0xffc9a8, 0xc9f0d8];

// The one function every caller uses. TOTAL over 0-6 and over anything else: an act index that is
// out of range, missing, or not a number clamps into the table rather than returning null, because
// every caller's fallback for null would be "draw nothing", and a backdrop that silently vanishes
// for one act is indistinguishable from the WebGL-absent state it is supposed to be different from.
function resolveBackdrop(actIndex, eraIndex) {
  const raw = Number.isFinite(actIndex) ? Math.floor(actIndex) : 0;
  const index = Math.max(0, Math.min(BACKDROPS.length - 1, raw));
  const backdrop = BACKDROPS[index];
  if (!backdrop.eraTinted) return backdrop;
  const era = Number.isFinite(eraIndex) && eraIndex > 0 ? Math.floor(eraIndex) : 0;
  const accent = ERA_ACCENTS[era % ERA_ACCENTS.length];
  return Object.assign({}, backdrop, {
    palette: Object.assign({}, backdrop.palette, { accent: accent }),
  });
}

// Acts VI and VII are the two a prestiged player replays, so they are the two that opt in. Set as a
// post-hoc flag rather than a key in the rows above so that the rule — "eras only reshape the acts
// eras can reach" — is stated once, here, instead of being two booleans a reader has to notice.
BACKDROPS[5].eraTinted = true;
BACKDROPS[6].eraTinted = true;

// -------------------------------------------------------------------------------------------
// BACKDROP TUNING
// -------------------------------------------------------------------------------------------

// A banner across the top of a modal card, not a hero. It has to leave room for a title, two
// paragraphs and a button inside `.modal-box`'s 85dvh on a 390x844 phone, which is where these
// numbers come from: 0.2 * 844 = 169px, comfortably inside the max.
const BACKDROP_HEIGHT_FRACTION = 0.2;
const BACKDROP_MIN_HEIGHT = 110;
const BACKDROP_MAX_HEIGHT = 200;

// FOG DENSITY, AND IT IS A MEASURED NUMBER RATHER THAN A TASTEFUL ONE. `FogExp2` blends by
// exp(-(density * depth)^2), and the furniture in these scenes sits a long way back: the camera is
// at z = 34 and Act I's hardware-store slab is at z = -34, so its depth is ~68. At an early value of
// 0.016 that left about 31% of the slab visible, and Act VI's ring of lights at depth ~88 about 14%
// — which is to say the two backdrops whose notes promise the most were dissolving into a flat
// gradient. 0.0065 is components/expedition/LaunchScene.js's value, arrived at against the same
// world scale and the same camera distance, and it is reused here rather than re-guessed.
//
// It still has to be nonzero: the ground plane is 400 units square and without fog it ends in a hard
// horizontal line across a banner that is only ~170px tall.
const BACKDROP_FOG_DENSITY = 0.0065;

// THE LOOP STOPS AFTER THIS MANY SECONDS OF NOTHING CHANGING, and then the backdrop is a still
// picture until something wakes it (the act changing under a returning player, or a rotate).
//
// It needs saying because it is not the rule components/expedition/LaunchScene.js uses. That scene
// stops when the SIMULATION is idle, which it can do because its motion is driven by engine state.
// A drifting mote field has no idle state — it would run at sixty frames a second for as long as
// the card was on screen, which for a welcome-back screen someone opens and walks away from is
// unbounded. So this one settles instead: the picture is alive while it is being looked at and
// costs nothing a few seconds later. Both screens are dismissed in well under this.
const BACKDROP_SETTLE_SECONDS = 24;

module.exports = {
  titleScreenCopy,
  returnSummaryCopy,
  BACKDROPS,
  ERA_ACCENTS,
  resolveBackdrop,
  BACKDROP_HEIGHT_FRACTION,
  BACKDROP_MIN_HEIGHT,
  BACKDROP_MAX_HEIGHT,
  BACKDROP_FOG_DENSITY,
  BACKDROP_SETTLE_SECONDS,
  // Re-exported, NOT redefined: the cap on device pixel ratio is a property of the hardware and not
  // of either scene, and two copies would drift. data/launchSceneConfig.js owns it.
  MAX_PIXEL_RATIO,
};
