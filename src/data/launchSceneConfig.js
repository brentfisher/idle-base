// Act VII's launch scene — geometry, palette, pacing, and where the renderer comes from.
//
// WHAT IS NOT HERE, AND MUST NEVER BE: a threshold, a transit window, an overshoot constant, or a
// site's label. All of those are read at use from data/actSevenSitesConfig.js and
// data/actSevenLaunchConfig.js. The rule the whole act is built on applies here with no exception —
// two copies of a threshold is a retune that moves one and not the other — and a scene is a
// particularly bad place to keep the second copy, because nothing measures a picture.
//
// What IS here is the picture's own vocabulary: where a rung sits in space, what colour a burn is,
// how far the camera stands back. None of it means anything to the simulation.

// ---------------------------------------------------------------------------------------------
// THE RENDERER, FROM A CDN
// ---------------------------------------------------------------------------------------------

// `three` is NOT a dependency of this project. It is fetched at runtime, once, by the panel that
// needs it, and never by a player who does not open that panel. See the change's design.md
// Decision 7 for the argument; the short version is that bundling it costs 723KB today, the whole
// game is 1,010KB, and the scene is decoration on a screen that is complete without it.
//
// PINNED TO AN EXACT VERSION AND CARRYING AN INTEGRITY HASH, and neither is optional. A floating
// `@latest` URL makes the next release of a third-party library into arbitrary code running in a
// player's browser, chosen by somebody who has never heard of this game. The browser refuses to
// execute a file whose hash does not match, and `crossorigin` is what lets it check.
//
// This exact build is the one the approved harness renders with — verified byte-identical — so what
// ships is what was signed off on.
const THREE_URL = 'https://unpkg.com/three@0.128.0/build/three.min.js';
const THREE_INTEGRITY = 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';

// ---------------------------------------------------------------------------------------------
// THE DIAMOND
// ---------------------------------------------------------------------------------------------

// Where each rung sits, keyed by the site id engine/sites.js uses. The shape is the act's own joke
// told in geometry: the ladder is named after a diamond, so it is drawn as one, tilted in orbit.
// `beyondTheWall` is not a site and never renders a body — it is where the fifth burn's arc goes,
// which is out and away rather than to anything.
const SITE_POSITIONS = {
  homePlate: [0, 0, 26],
  onDeck: [-19, 2.5, 12],
  firstBase: [22, 1.5, 4],
  secondBase: [2, 4, -22],
  thirdBase: [-24, 3, -6],
  beyondTheWall: [6, 16, -78],
};

// Drawn in this order so the chalk lines connect consecutive rungs. Read rather than assumed: a
// ladder that grew a sixth rung would need a position above and an entry here, and would otherwise
// simply not be drawn — which is a missing line, not a crash.
const LADDER_ORDER = ['homePlate', 'onDeck', 'firstBase', 'secondBase', 'thirdBase'];

const PALETTE = {
  void: 0x05070d,
  chalk: 0xe8dcc0,
  grass: 0x2f6b4a,
  flare: 0xff7a3c,
  fuel: 0x4fd6e0,
  amber: 0xc9a227,
  body: 0xd8cfae,
};

// The arc's height above the plane of the field. The fifth burn's is not a bigger number of the
// same kind — it is the one arc that leaves the plane, because its destination is not on it.
const ARC_LIFT_BASE = 12;
const ARC_LIFT_PER_RUNG = 5;
const ARC_LIFT_FINAL = 46;

const CAMERA = {
  fov: 52,
  radius: 96,
  height: 52,
  // Radians per second of a slow drift. Slow enough to read as parallax rather than as motion —
  // this sits on a screen a player may leave open for twelve minutes.
  spin: 0.055,
  // How far the camera retreats over the final burn, as a multiple of the figures above.
  pullRadius: 120,
  pullHeight: 46,
  pullSeconds: 3,
};

// Fixed pool, allocated once. A particle system that allocated during a flight would stutter
// exactly when the eye is on it.
const SPARK_COUNT = 260;
const STAR_COUNT = 2600;

// The ceiling on device pixel ratio. A phone reporting 3 renders at 2 and keeps its frame rate;
// sharpness is the cheaper thing to give up.
const MAX_PIXEL_RATIO = 2;

// Below this width the scene is not drawn at all. The act's surfaces are designed for 390px and the
// scene needs more room than a readout does to say anything; under it, the panel is better off with
// the space.
const MIN_VIEWPORT_WIDTH = 360;

// The scene's height on screen, as a fraction of viewport height, clamped. Bounded so the readout
// and the commit control stay reachable without scrolling past a picture.
const HEIGHT_FRACTION = 0.34;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 340;

const launchSceneCopy = {
  // The only string the scene contributes. Shown while the renderer is being fetched, and replaced
  // by the scene or by nothing at all — never by an error.
  loading: 'Plotting the burn…',
};

module.exports = {
  THREE_URL,
  THREE_INTEGRITY,
  SITE_POSITIONS,
  LADDER_ORDER,
  PALETTE,
  ARC_LIFT_BASE,
  ARC_LIFT_PER_RUNG,
  ARC_LIFT_FINAL,
  CAMERA,
  SPARK_COUNT,
  STAR_COUNT,
  MAX_PIXEL_RATIO,
  MIN_VIEWPORT_WIDTH,
  HEIGHT_FRACTION,
  MIN_HEIGHT,
  MAX_HEIGHT,
  launchSceneCopy,
};
