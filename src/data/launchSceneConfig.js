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

// ---------------------------------------------------------------------------------------------
// THE CAMERA
// ---------------------------------------------------------------------------------------------

// NO ABSOLUTE CAMERA POSITION LIVES HERE, AND THAT IS THE POINT. The first version of this file
// declared `radius: 96, height: 52` — one framing, measured against a wide desktop canvas, and on a
// 390px phone (a ~322x300 canvas) the diamond covered about a third of the frame's width and a
// sixth of its height. A picture nobody can read is worse than no picture, and it failed on the
// width the whole act is designed against.
//
// What is declared instead is WHAT THE FRAME MUST CONTAIN — a radius in world units — and the
// component solves for the camera that contains it, at `resize()`, from the canvas it is actually
// rendering into. Three things adapt, all of them continuous in the canvas's shape rather than
// switched at a breakpoint, because a breakpoint is a cliff a tablet falls off:
//
//   1. THE FIELD OF VIEW WIDENS on a narrow canvas. A perspective camera's `fov` is VERTICAL, so
//      the horizontal angle is `atan(tan(fov/2) * aspect)` — at 2.2:1 that is 47 degrees and at
//      1.1:1 it is 28. Half the horizontal coverage disappears on a phone before the camera has
//      moved at all. Widening the vertical fov until the horizontal angle reaches
//      `narrowHorizontalFov` buys that coverage back.
//   2. THE CAMERA LOOKS FURTHER DOWN on a near-square canvas. The ladder is a nearly flat subject:
//      seen from a low angle it is a thin band on screen no matter how close the camera stands, so
//      a tall canvas's height is unusable at the oblique angle a wide one wants. A disc of radius R
//      seen at pitch p is R tall on screen and R·sin(p) deep, so raising the camera is the only
//      thing that fills a square frame with a flat subject.
//   3. THE CAMERA WALKS IN until the framing radius fits the tighter of the two axes.
//
// `standoff` is the floor under all of it and is not a nicety: a camera close enough to fill a
// square canvas with a 26-unit diamond stands about where the rungs do, and the nearest rung then
// renders several times the size of the furthest. The ladder stops reading as a ladder.
const CAMERA = {
  // The vertical field of view on a comfortably wide canvas, and the two figures that widen it on a
  // narrow one. `maxFov` is a distortion ceiling — past roughly this angle the near edge of the
  // infield bows and the diamond stops looking like a diamond.
  fov: 52,
  narrowHorizontalFov: 76,
  maxFov: 68,

  // The camera's height as a ratio of its horizontal distance from the point it is looking at, and
  // the two aspect ratios those are pinned to. Between them it is a straight interpolation. Note
  // that the ratios are the ONLY thing that sets the viewing angle — the distance is solved for, so
  // the ladder is read from the same angle whatever the canvas does to the distance.
  elevationWide: 0.54,
  elevationNarrow: 0.85,
  aspectWide: 2,
  aspectNarrow: 1.1,

  // Radians per second of a slow drift. Slow enough to read as parallax rather than as motion —
  // this sits on a screen a player may leave open for twelve minutes.
  spin: 0.055,

  // Breathing room around the fitted radius, so the thing being framed does not touch the edge.
  margin: 1.08,
  // The closest the camera may stand, as a multiple of the framing radius. See the note above.
  standoff: 1.35,

  // How far the camera retreats over the final burn — a FRACTION OF THE FRAMED DISTANCE rather than
  // a number of world units, so the retreat is the same gesture whatever the canvas framed to.
  pullDistance: 1.15,
  pullElevation: 0.25,
  pullSeconds: 3,

  // Reframing is eased rather than cut, so a zoom press or a rotated phone is a move rather than a
  // jump. `easeSnap` is what makes it TERMINATE: an exponential ease never arrives, and the render
  // loop stops only when nothing is moving, so within this much of the target the camera is placed
  // exactly on it and the loop is allowed to go back to sleep.
  ease: 3.5,
  easeSnap: 0.25,
};

// The one term that reads the canvas's WIDTH rather than its shape. Two canvases can share an
// aspect ratio and be a phone and a monitor; the smaller one has fewer pixels to spend on the same
// picture, so it gives up a little of the surround to make what is left bigger. Interpolated
// between these two widths and capped at `FIT_TIGHTEN`, because a second uncapped term interacting
// with the fit above would be untunable.
const FIT_REFERENCE_WIDTH = 620;
const FIT_NARROW_WIDTH = 320;
const FIT_TIGHTEN = 0.1;

// ---------------------------------------------------------------------------------------------
// THE TWO FRAMINGS
// ---------------------------------------------------------------------------------------------

// What the zoom control switches between. `radius` is the half-extent, in world units, the frame
// must contain — NOT a camera position; the camera that contains it is solved for per canvas.
//
// PER-SESSION UI STATE AND NOTHING ELSE. Which framing is selected is not saved, is not in the
// reducer, and is not a fact about the run — it is where the player is standing to look at it. A
// zoom level in the save file would be a preference the save format has to carry forever.
const FRAMINGS = {
  // The whole ladder: five rungs end to end with the wall behind them. The radius is a little wider
  // than the diamond itself so the wall's arc lands just inside the frame rather than being cropped
  // to a stripe.
  wide: {
    id: 'wide',
    radius: 38,
    target: [0, 2, -6],
    followsBurn: false,
  },
  // The burn. A committed burn is framed on ITS OWN ARC — the midpoint of the curve, at half the
  // chord plus `arcPadding` — so what fills the frame is the crossing rather than the ladder.
  // `radius` is the fallback for a ladder with nothing in the air, and `minRadius` keeps a short
  // hop from putting the camera on top of the vehicle.
  close: {
    id: 'close',
    radius: 22,
    target: [0, 2, -6],
    followsBurn: true,
    arcPadding: 1.25,
    minRadius: 16,
  },
};

// The order the control cycles through, and where it starts. Read rather than hardcoded in the
// component so a third framing would be a line here and nothing else — and so that no component
// contains the string 'wide'.
const ZOOM_ORDER = ['wide', 'close'];
const DEFAULT_ZOOM_ID = 'wide';

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
  // Shown while the renderer is being fetched, and replaced by the scene or by nothing at all —
  // never by an error.
  loading: 'Plotting the burn…',
  // The zoom control's face, keyed by the framing PRESSING IT WOULD SELECT rather than by the one
  // currently showing. A control that names its current state reads as a status line and gets
  // pressed by people who wanted the thing it already says.
  zoomTo: {
    wide: 'Wide',
    close: 'Close',
  },
  // The accessible name. The face is one word because the control is 40px wide and sits over the
  // picture; a screen reader gets the sentence the sighted player infers from the context.
  zoomHint: 'Change how close the crossing is framed',
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
  FIT_REFERENCE_WIDTH,
  FIT_NARROW_WIDTH,
  FIT_TIGHTEN,
  FRAMINGS,
  ZOOM_ORDER,
  DEFAULT_ZOOM_ID,
  SPARK_COUNT,
  STAR_COUNT,
  MAX_PIXEL_RATIO,
  MIN_VIEWPORT_WIDTH,
  HEIGHT_FRACTION,
  MIN_HEIGHT,
  MAX_HEIGHT,
  launchSceneCopy,
};
