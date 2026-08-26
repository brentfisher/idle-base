const React = require('react');
const { inFlightReadout } = require('../../engine/launch');
const { OVER_THE_WALL_DESTINATION_ID } = require('../../data/actSevenSitesConfig');
const { listSites } = require('../../engine/sites');
const {
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
} = require('../../data/launchSceneConfig');

// Act VII's crossing, drawn. The ladder as the diamond it is named after, the committed burn as an
// arc between two rungs, and the fifth burn leaving the plane of the field entirely.
//
// IT IS A VIEW OF THE SIMULATION AND NEVER A SECOND COPY OF IT. Every position on the arc comes from
// engine/launch.js's `inFlightReadout(state).progress` — the same figure the countdown reads — on
// every frame. The scene has no clock, no timer, and no opinion about where the vehicle is. That is
// not fastidiousness: `advance()` is called identically by the live tick and by the offline
// catch-up, so a scene that animated against its own clock would disagree with the engine for
// exactly as long as a player was away, and an eight-hour absence would replay a transit that had
// already resolved.
//
// The requestAnimationFrame loop below is not a second clock. It advances PRESENTATION only —
// camera drift, particle decay, the vehicle's roll — none of which the simulation knows or cares
// about. The distinction to hold when editing this file: anything the engine would need to know
// about comes from the engine; anything that would look identical if it were absent may be local.
//
// ITS ABSENCE IS A DESIGNED STATE, NOT A FAILURE. No WebGL, a narrow viewport, a reduced-motion
// preference, an unreachable CDN, a file that fails its integrity check, or a throw anywhere inside
// the renderer all land in the same place: the panel renders exactly what it rendered before this
// file existed. Nothing on this screen may ever exist only inside the scene.

// ---------------------------------------------------------------------------------------------
// GETTING THE RENDERER
// ---------------------------------------------------------------------------------------------

// One in-flight promise for the whole app, so two mounts do not fetch twice and a remount after a
// failure does not retry forever. Resolves with `window.THREE` or rejects; every caller treats a
// rejection as the absent state.
let threePromise = null;

function loadThree() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('no document'));
  }
  if (window.THREE) return Promise.resolve(window.THREE);
  if (threePromise) return threePromise;

  threePromise = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = THREE_URL;
    // BOTH OF THESE OR NEITHER. `integrity` is what makes the browser refuse a file that does not
    // hash to the expected value, and `crossorigin` is what allows it to check at all — an SRI hash
    // on a cross-origin script without CORS is silently unenforced, which is worse than none
    // because it looks like protection.
    script.integrity = THREE_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', function () {
      if (window.THREE) resolve(window.THREE);
      else reject(new Error('three loaded without a global'));
    });
    // Fires for a network failure, a blocked request, AND an integrity mismatch. The three are
    // indistinguishable from here and want the same answer, so nothing tries to tell them apart.
    script.addEventListener('error', function () {
      threePromise = null;
      reject(new Error('three failed to load'));
    });
    document.head.appendChild(script);
  });
  return threePromise;
}

// Decided ONCE, before anything is constructed. A scene that checked its own viability while
// building would be half-built when it found out.
function sceneSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.innerWidth < MIN_VIEWPORT_WIDTH) return false;
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    return !!gl;
  } catch (err) {
    return false;
  }
}

function sceneHeight() {
  const raw = (window.innerHeight || 640) * HEIGHT_FRACTION;
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(raw)));
}

function positionOf(siteId) {
  return SITE_POSITIONS[siteId] || null;
}

// How high the arc rides. The fifth burn's lift is not a bigger number of the same kind: its
// destination is not on the plane, so the arc leaves the plane.
function liftFor(originSiteId, destinationSiteId) {
  if (destinationSiteId === OVER_THE_WALL_DESTINATION_ID) return ARC_LIFT_FINAL;
  const rung = LADDER_ORDER.indexOf(originSiteId);
  return ARC_LIFT_BASE + Math.max(0, rung) * ARC_LIFT_PER_RUNG;
}

// ---------------------------------------------------------------------------------------------
// FRAMING THE CANVAS THAT IS ACTUALLY THERE
// ---------------------------------------------------------------------------------------------

// THE CONFIG DECLARES WHAT THE FRAME MUST CONTAIN; EVERYTHING BELOW SOLVES FOR THE CAMERA THAT
// CONTAINS IT. See the CAMERA block in data/launchSceneConfig.js for why — the short version is
// that a camera position measured against a desktop canvas is a camera position measured against
// one canvas, and this act is designed against a 390px phone.
//
// All of it is presentation and all of it is therefore allowed to be local. The line that matters
// in this file is drawn elsewhere: position along the arc comes from the engine every frame, and
// nothing here touches it.

function clamp01(n) {
  return n < 0 ? 0 : (n > 1 ? 1 : n);
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function framingFor(zoomId) {
  return FRAMINGS[zoomId] || FRAMINGS[DEFAULT_ZOOM_ID];
}

// The control cycles rather than toggles, so a third framing is a line in ZOOM_ORDER and no change
// here — and so the component never contains the name of a framing.
function nextZoomId(zoomId) {
  const at = ZOOM_ORDER.indexOf(zoomId);
  return ZOOM_ORDER[(at + 1) % ZOOM_ORDER.length];
}

// Everything the canvas's own shape decides, solved once per resize rather than per frame. Pure: it
// reads the box and the config and nothing else.
function solveFraming(width, height) {
  const aspect = height > 0 ? width / height : 1;

  // The vertical field of view. `fov` in three.js is VERTICAL, so a narrow canvas silently loses
  // horizontal coverage — widening the vertical angle until the horizontal one reaches
  // `narrowHorizontalFov` is what gives it back, and `maxFov` stops that becoming a fisheye.
  const wantedHalfTanV = Math.tan(radians(CAMERA.narrowHorizontalFov) / 2) / Math.max(aspect, 0.001);
  const baseHalfTanV = Math.tan(radians(CAMERA.fov) / 2);
  const ceilingHalfTanV = Math.tan(radians(CAMERA.maxFov) / 2);
  const halfTanV = Math.min(ceilingHalfTanV, Math.max(baseHalfTanV, wantedHalfTanV));
  const halfTanH = halfTanV * aspect;

  // The viewing angle. A square-ish canvas is looked at from higher up, because a flat subject seen
  // from low down cannot fill a tall frame at any distance.
  const towardNarrow = clamp01(
    (CAMERA.aspectWide - aspect) / (CAMERA.aspectWide - CAMERA.aspectNarrow)
  );
  const elevation = lerp(CAMERA.elevationWide, CAMERA.elevationNarrow, towardNarrow);

  // The one term that reads absolute width rather than shape: a small canvas gives up a little of
  // the surround so that what remains is bigger. Capped in the config; see the note there.
  const towardSmall = clamp01(
    (FIT_REFERENCE_WIDTH - width) / (FIT_REFERENCE_WIDTH - FIT_NARROW_WIDTH)
  );

  return {
    fov: (2 * Math.atan(halfTanV) * 180) / Math.PI,
    aspect: aspect,
    halfTanV: halfTanV,
    halfTanH: halfTanH,
    elevation: elevation,
    tighten: 1 - FIT_TIGHTEN * towardSmall,
  };
}

// How far back the camera must stand for a subject of this radius to fit the tighter of the two
// axes. The vertical requirement is the smaller of the pair for a near-flat subject: a disc of
// radius R seen at pitch p is R wide on screen and only R·sin(p) tall, which is exactly why the
// elevation above adapts rather than the distance alone.
function distanceFor(fit, radius) {
  const pitchSin = fit.elevation / Math.hypot(1, fit.elevation);
  const byWidth = radius / fit.halfTanH;
  const byHeight = (radius * pitchSin) / fit.halfTanV;
  const fitted = Math.max(byWidth, byHeight) * CAMERA.margin * fit.tighten;
  return Math.max(radius * CAMERA.standoff, fitted);
}

// ---------------------------------------------------------------------------------------------
// THE SCENE
// ---------------------------------------------------------------------------------------------

// Everything three.js touches lives inside this factory, so the component below never holds a
// renderer, a geometry or a material — it holds one object with three methods, and disposal is one
// call rather than a list somebody will eventually forget to extend.
function buildScene(THREE, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.void);
  scene.fog = new THREE.FogExp2(PALETTE.void, 0.0065);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 900);
  scene.add(new THREE.AmbientLight(0x2a3446, 1.0));
  const key = new THREE.PointLight(0xffd9b0, 1.5, 260);
  key.position.set(30, 46, 40);
  scene.add(key);

  const disposables = [];
  function track(obj) {
    if (obj.geometry) disposables.push(obj.geometry);
    if (obj.material) disposables.push(obj.material);
    return obj;
  }

  // Stars. Points rather than a texture so the field parallaxes honestly as the camera drifts.
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 200 + Math.random() * 420;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(track(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfd8e8, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.85,
  }))));

  // The infield, dim on purpose: it is what the eye reads position against, not a thing to look at.
  const infield = track(new THREE.Mesh(
    new THREE.CircleGeometry(46, 64),
    new THREE.MeshBasicMaterial({ color: PALETTE.grass, transparent: true, opacity: 0.09 })
  ));
  infield.rotation.x = -Math.PI / 2;
  infield.position.y = -1.2;
  scene.add(infield);

  // Chalk between consecutive rungs, and a faint line closing the circuit back to Home Plate.
  function chalk(a, b, opacity) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2]),
    ]);
    scene.add(track(new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: PALETTE.chalk, transparent: true, opacity: opacity,
    }))));
  }
  for (let i = 0; i < LADDER_ORDER.length - 1; i++) {
    const a = positionOf(LADDER_ORDER[i]);
    const b = positionOf(LADDER_ORDER[i + 1]);
    if (a && b) chalk(a, b, 0.22);
  }
  const first = positionOf(LADDER_ORDER[0]);
  const last = positionOf(LADDER_ORDER[LADDER_ORDER.length - 1]);
  if (first && last) chalk(last, first, 0.1);

  // The wall. The only thing in the scene that is not a place you can stand.
  const wall = track(new THREE.Mesh(
    new THREE.CylinderGeometry(70, 70, 15, 48, 1, true, Math.PI * 0.72, Math.PI * 0.62),
    new THREE.MeshBasicMaterial({
      color: PALETTE.amber, transparent: true, opacity: 0.11, side: THREE.DoubleSide,
    })
  ));
  wall.position.set(0, 5, -8);
  scene.add(wall);

  // The rungs.
  const bodies = {};
  LADDER_ORDER.forEach(function (siteId, i) {
    const at = positionOf(siteId);
    if (!at) return;
    const group = new THREE.Group();
    group.position.set(at[0], at[1], at[2]);
    const core = track(new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1 + i * 0.28, 2),
      new THREE.MeshStandardMaterial({
        color: PALETTE.body, emissive: 0x8a7f5f, emissiveIntensity: 0.3,
        roughness: 0.75, metalness: 0.1, flatShading: true,
      })
    ));
    group.add(core);
    const halo = track(new THREE.Mesh(
      new THREE.RingGeometry(3.2 + i * 0.34, 3.6 + i * 0.34, 40),
      new THREE.MeshBasicMaterial({
        color: PALETTE.fuel, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
      })
    ));
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);
    scene.add(group);
    bodies[siteId] = { core: core, halo: halo };
  });

  // The vehicle, its light, its trail and its sparks.
  const vehicle = track(new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 2.6, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffe9d8, emissive: PALETTE.flare, emissiveIntensity: 1.4, roughness: 0.4,
    })
  ));
  vehicle.visible = false;
  scene.add(vehicle);

  const burnLight = new THREE.PointLight(PALETTE.flare, 0, 90);
  scene.add(burnLight);

  const TRAIL_MAX = 600;
  const trailPos = new Float32Array(TRAIL_MAX * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  scene.add(track(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    color: PALETTE.flare, transparent: true, opacity: 0.9,
  }))));
  let trailCount = 0;

  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkVel = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  scene.add(track(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffb26b, size: 0.6, transparent: true, opacity: 0.9, sizeAttenuation: true,
  }))));
  let sparkHead = 0;

  let curve = null;
  let curveKey = '';
  let pull = 0;
  let spin = 0;

  // The canvas's own contribution to the framing, re-solved on every resize and read every frame.
  // Seeded with a square so a draw that somehow beat the first resize still renders something
  // sensible rather than dividing by zero.
  let fit = solveFraming(1, 1);
  // The EASED framing: where the camera is now, as against where the current zoom wants it. Null
  // until the first frame places it, because easing in from zero would open every panel visit with
  // a swoop nobody asked for. Both are compared for exact equality below, which is only safe
  // because CAMERA.easeSnap snaps them — see there.
  let distance = null;
  const lookAt = new THREE.Vector3();
  const wantLookAt = new THREE.Vector3();
  let framingSettled = true;

  // `view` is what the component hands in every frame: the engine's readout, plus the overshoot the
  // player is currently dialling on an UNCOMMITTED burn. Both may be null.
  function update(view, dt) {
    spin += dt * CAMERA.spin;

    const flight = view && view.flight;
    const overshoot = view && Number.isFinite(view.overshoot) ? view.overshoot : 1;

    // The arc is rebuilt only when the burn changes, not per frame.
    if (flight) {
      const key2 = flight.originSiteId + '>' + flight.destinationSiteId;
      if (key2 !== curveKey) {
        const a = positionOf(flight.originSiteId);
        const b = positionOf(flight.destinationSiteId);
        if (a && b) {
          const from = new THREE.Vector3(a[0], a[1], a[2]);
          const to = new THREE.Vector3(b[0], b[1], b[2]);
          const mid = from.clone().add(to).multiplyScalar(0.5);
          mid.y += liftFor(flight.originSiteId, flight.destinationSiteId);
          curve = new THREE.QuadraticBezierCurve3(from, mid, to);
          curveKey = key2;
          trailCount = 0;
          trailGeo.setDrawRange(0, 0);
        }
      }
    } else {
      curveKey = '';
      curve = null;
      trailCount = 0;
      trailGeo.setDrawRange(0, 0);
      vehicle.visible = false;
      burnLight.intensity = 0;
    }

    if (flight && curve) {
      // THE ENGINE'S OWN PROGRESS FIGURE. Not interpolated, not advanced here.
      const t = Math.max(0, Math.min(1, flight.progress));
      const p = curve.getPoint(t);
      const ahead = curve.getPoint(Math.min(t + 0.01, 1));
      vehicle.visible = true;
      vehicle.position.copy(p);
      vehicle.lookAt(ahead);
      vehicle.rotateX(Math.PI / 2);
      burnLight.position.copy(p);
      // A fuller tank throws more of itself away, so overshoot is visible as heat.
      burnLight.intensity = 2.4 * Math.max(1, flight.overshootRatio || 1);

      if (trailCount < TRAIL_MAX) {
        trailPos[trailCount * 3] = p.x;
        trailPos[trailCount * 3 + 1] = p.y;
        trailPos[trailCount * 3 + 2] = p.z;
        trailCount++;
        trailGeo.setDrawRange(0, trailCount);
        trailGeo.attributes.position.needsUpdate = true;
      }

      const heat = 1 + Math.round(((flight.overshootRatio || 1) - 1) * 10);
      for (let k = 0; k < heat; k++) {
        sparkPos[sparkHead * 3] = p.x;
        sparkPos[sparkHead * 3 + 1] = p.y;
        sparkPos[sparkHead * 3 + 2] = p.z;
        const spread = 1.6 + heat * 0.4;
        sparkVel[sparkHead * 3] = (Math.random() - 0.5) * spread;
        sparkVel[sparkHead * 3 + 1] = (Math.random() - 0.5) * spread;
        sparkVel[sparkHead * 3 + 2] = (Math.random() - 0.5) * spread;
        sparkLife[sparkHead] = 1;
        sparkHead = (sparkHead + 1) % SPARK_COUNT;
      }

      if (flight.destinationSiteId === OVER_THE_WALL_DESTINATION_ID) {
        pull = Math.min(1, pull + dt / CAMERA.pullSeconds);
      }
    } else {
      pull = Math.max(0, pull - dt / CAMERA.pullSeconds);
    }

    // Rungs already reached read brighter. `reachedRungs` is the engine's count, not a tally kept
    // here — the scene does not know how far the player has got except by being told.
    const reached = view && Number.isFinite(view.reachedRungs) ? view.reachedRungs : 0;
    LADDER_ORDER.forEach(function (siteId, i) {
      const body = bodies[siteId];
      if (!body) return;
      body.core.rotation.y += dt * (0.22 + i * 0.03);
      body.halo.rotation.z += dt * 0.3;
      const lit = i <= reached;
      body.halo.material.opacity = lit ? 0.32 : 0.12;
      body.core.material.emissiveIntensity = lit ? 0.5 : 0.2;
    });

    // The preview: an uncommitted burn dialled hotter shows a hotter field, so the trade is visible
    // before the commit rather than only after it.
    if (!flight && overshoot > 1) {
      burnLight.intensity = (overshoot - 1) * 3;
      burnLight.position.set(0, 8, 0);
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt * 0.9;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // ---- THE CAMERA ------------------------------------------------------------------------
    // Which framing is selected arrives on `view` like everything else, but unlike everything else
    // on it, it is not the engine's. It is where the player is standing to look at the crossing —
    // presentation, per-session, and nothing the simulation could ever disagree with. Contrast
    // `flight.progress` above, which is the engine's and is never adjusted here.
    const framing = framingFor(view && view.zoom);
    let wantRadius = framing.radius;
    wantLookAt.set(framing.target[0], framing.target[1], framing.target[2]);
    if (framing.followsBurn && curve) {
      // THE ARC'S MIDDLE, NOT THE VEHICLE. Both would put the burn in the centre of the frame, but
      // the midpoint changes only when the burn does, whereas the vehicle steps forward once per
      // engine tick — and a camera chasing a target that steps once a second lurches once a second.
      // Framing the arc also keeps both ends of the crossing on screen, which is the thing the
      // close view is for.
      curve.getPoint(0.5, wantLookAt);
      const span = curve.v0.distanceTo(curve.v2) / 2;
      wantRadius = Math.max(framing.minRadius, span * framing.arcPadding);
    }
    const wantDistance = distanceFor(fit, wantRadius);

    if (distance === null) {
      distance = wantDistance;
      lookAt.copy(wantLookAt);
    } else {
      const k = 1 - Math.exp(-dt * CAMERA.ease);
      distance += (wantDistance - distance) * k;
      lookAt.lerp(wantLookAt, k);
      // SNAPPED, NOT ASYMPTOTIC, AND THE IDLE PAUSE DEPENDS ON IT. An exponential ease never
      // arrives; `animating()` keeps the loop awake until the framing has settled; so without a
      // snap the loop would run for as long as the panel is open and Decision 4 would be gone.
      if (Math.abs(wantDistance - distance) < CAMERA.easeSnap) distance = wantDistance;
      if (lookAt.distanceTo(wantLookAt) < CAMERA.easeSnap) lookAt.copy(wantLookAt);
    }
    framingSettled = distance === wantDistance && lookAt.equals(wantLookAt);

    // The retreat over the final burn, as a fraction of whatever this canvas framed to rather than
    // as a fixed number of world units — so it reads as the same gesture on a phone and a monitor.
    const elevation = fit.elevation + pull * CAMERA.pullElevation;
    const standOff = distance * (1 + pull * CAMERA.pullDistance);
    const horizontal = standOff / Math.hypot(1, elevation);
    camera.position.set(
      lookAt.x + Math.sin(spin) * horizontal,
      lookAt.y + horizontal * elevation,
      lookAt.z + Math.cos(spin) * horizontal
    );
    camera.lookAt(lookAt);

    renderer.render(scene, camera);
  }

  // Called with the canvas's CSS box on mount and on every window resize. It is where the framing
  // is decided: the fov, the viewing angle and the distance all come out of THIS box rather than
  // out of a constant measured against somebody's monitor.
  function resize(width, height) {
    renderer.setSize(width, height, false);
    fit = solveFraming(width, height);
    camera.fov = fit.fov;
    camera.aspect = height > 0 ? width / height : 1;
    camera.updateProjectionMatrix();
  }

  // Act VII sessions run for hours and this panel is entered and left repeatedly. A renderer that
  // leaked a context per visit would degrade the act it decorates.
  function dispose() {
    disposables.forEach(function (d) {
      if (d && typeof d.dispose === 'function') d.dispose();
    });
    disposables.length = 0;
    starGeo.dispose();
    trailGeo.dispose();
    sparkGeo.dispose();
    renderer.dispose();
  }

  // Is anything still moving? An idle ladder is a still picture, and a still picture does not need
  // sixty frames a second. `pull` decays toward 0 after the final burn and the sparks decay after
  // any burn, so both keep the loop alive until they have finished rather than freezing mid-fade.
  function animating(view) {
    if (view && view.flight) return true;
    // A zoom press and a rotated phone both leave the camera mid-move. Without this the loop would
    // stop on the frame after the change and freeze the reframing halfway.
    if (!framingSettled) return true;
    if (pull > 0.001) return true;
    for (let i = 0; i < SPARK_COUNT; i++) if (sparkLife[i] > 0) return true;
    return false;
  }

  return { update: update, resize: resize, dispose: dispose, animating: animating };
}

// ---------------------------------------------------------------------------------------------
// THE COMPONENT
// ---------------------------------------------------------------------------------------------

function LaunchScene({ state, previewOvershoot }) {
  const canvasRef = React.useRef(null);
  const viewRef = React.useRef(null);
  // Set by the effect once the scene exists. Called on any render whose view differs, so a stopped
  // loop restarts for the thing that changed rather than running forever in case something does.
  const wakeRef = React.useRef(null);
  const [status, setStatus] = React.useState(function () {
    return sceneSupported() ? 'loading' : 'off';
  });
  // WHICH FRAMING IS SHOWING, AND IT IS NOT SAVED. It is not a fact about the run — no engine
  // module can see it, no reducer holds it, and the save format does not carry it. React state
  // rather than a ref because the button's own face changes with it, and a ref would not re-render
  // the button; the render loop is woken separately, below.
  const [zoom, setZoom] = React.useState(DEFAULT_ZOOM_ID);

  // The engine's answer, refreshed on every React render and read by the loop. A ref rather than
  // state because the loop must not re-subscribe sixty times a second.
  const flight = inFlightReadout(state);
  // The furthest rung reached, asked of the engine's own listing rather than derived from the
  // expedition slice. `expedition.sites` is an ARRAY of records, not a map keyed by id, and a
  // component reaching into it by key would silently find nothing and light no rung at all —
  // which is the kind of wrong that looks like a design choice.
  const reachedRungs = listSites(state).reduce(function (highest, site) {
    return site && site.reached && Number.isFinite(site.rung) ? Math.max(highest, site.rung) : highest;
  }, 0);
  const previous = viewRef.current;
  viewRef.current = {
    flight: flight,
    reachedRungs: reachedRungs,
    overshoot: previewOvershoot,
    zoom: zoom,
  };
  // What counts as a change worth waking for. Progress is deliberately included: it moves once per
  // tick, which is exactly when a stopped loop needs to redraw the vehicle a second further along.
  //
  // ZOOM IS HERE FOR THE SAME REASON, and it is the reason it lives on `viewRef` at all: the loop
  // STOPS when the ladder is idle, so a zoom change that only mutated a ref would set the camera's
  // target and then never draw a frame that moved toward it. The press would do nothing.
  const changed = !previous
    || !!previous.flight !== !!flight
    || (flight && previous.flight && previous.flight.progress !== flight.progress)
    || previous.reachedRungs !== reachedRungs
    || previous.overshoot !== previewOvershoot
    || previous.zoom !== zoom;
  if (changed && wakeRef.current) wakeRef.current();

  React.useEffect(function () {
    if (status === 'off') return undefined;
    let cancelled = false;
    let built = null;
    let raf = 0;
    let last = 0;

    loadThree().then(function (THREE) {
      if (cancelled || !canvasRef.current) return;
      try {
        built = buildScene(THREE, canvasRef.current);
      } catch (err) {
        setStatus('off');
        return;
      }
      setStatus('ready');

      const fitToCanvas = function () {
        if (!canvasRef.current || !built) return;
        const width = canvasRef.current.clientWidth || 1;
        built.resize(width, sceneHeight());
        // AND WAKE. A resize both re-solves the framing and clears the drawing buffer, so an idle
        // ladder that is not redrawn afterwards is a stale camera on a blank canvas. This is the
        // rotated-phone case design.md left open; it costs one frame and only when the box moves.
        if (wakeRef.current) wakeRef.current();
      };
      fitToCanvas();
      window.addEventListener('resize', fitToCanvas);

      // ONE FRAME IMMEDIATELY, before any scheduling. The ladder is a picture worth having the
      // moment the panel opens, and a scene that waited for the first animation frame would show
      // black on a tab that happens to be backgrounded — which is also how this was found.
      const draw = function (dt) {
        try {
          built.update(viewRef.current, dt);
          return true;
        } catch (err) {
          setStatus('off');
          return false;
        }
      };
      draw(0);

      // THE LOOP RUNS ONLY WHILE SOMETHING IS MOVING. Decision 4's "an idle scene costs one static
      // frame, not sixty a second" is this function: with no burn in the air and the sparks faded,
      // the loop draws a last frame and STOPS. It is woken again by `wake()` below when React hands
      // in a view that differs — a burn committed, an arrival landed, an overshoot dialled.
      //
      // This screen is one a player may leave open for the twelve minutes of a fifth burn, on a
      // phone. A still picture costing nothing is the correct behaviour for most of that time.
      const frame = function (now) {
        if (document.hidden) { last = now; raf = window.requestAnimationFrame(frame); return; }
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
        last = now;
        if (!draw(dt)) { raf = 0; return; }
        if (built.animating(viewRef.current)) {
          raf = window.requestAnimationFrame(frame);
        } else {
          raf = 0;
        }
      };

      wakeRef.current = function () {
        if (raf || !built) return;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      };
      wakeRef.current();

      built.cleanupResize = function () { window.removeEventListener('resize', fitToCanvas); };
    }).catch(function () {
      // Unreachable CDN, blocked request, or a file that failed its integrity check. All three are
      // the same answer: no scene, no error on screen, panel unchanged.
      if (!cancelled) setStatus('off');
    });

    // DISPOSAL IS VERIFIED, NOT ASSUMED. Measured in the browser across three panel visits: three
    // renderers built, three disposed, nothing left in the document. Worth knowing if you go to
    // check it yourself — three r128 assigns `dispose` to each renderer INSTANCE rather than to
    // `WebGLRenderer.prototype`, so a prototype patch counts nothing and reads as a leak that is
    // not there. Wrap the constructor and patch the instance.
    return function () {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      if (built) {
        if (built.cleanupResize) built.cleanupResize();
        built.dispose();
      }
    };
  }, [status === 'off']);

  if (status === 'off') return null;

  // The zoom control exists ONLY WHILE THE SCENE DOES. It is part of the picture, not part of the
  // panel: `status === 'off'` returned null a few lines up, and it is withheld while the renderer
  // is still being fetched because a fetch that fails ends at that same null. Decision 3 says the
  // panel with no scene is exactly the panel as it was, and a control that outlived the thing it
  // controls would be the first exception to it.
  const upcoming = nextZoomId(zoom);

  return (
    <div className="v7-launch-scene" style={{ height: sceneHeight() + 'px' }}>
      <canvas ref={canvasRef} className="v7-launch-canvas" />
      {status === 'ready'
        ? (
          <button
            type="button"
            className="v7-launch-zoom"
            aria-label={launchSceneCopy.zoomHint}
            onClick={function () { setZoom(upcoming); }}
          >
            {launchSceneCopy.zoomTo[upcoming]}
          </button>
        )
        : null}
      {status === 'loading'
        ? <span className="v7-launch-scene-note muted">{launchSceneCopy.loading}</span>
        : null}
    </div>
  );
}

// A throw anywhere below this point degrades to the absent state rather than taking the Launch panel
// down with it. The panel is the act's most important screen; a picture on it may not be able to
// break it.
class LaunchSceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.warn('Launch scene disabled', err);
  }

  render() {
    if (this.state.failed) return null;
    return <LaunchScene state={this.props.state} previewOvershoot={this.props.previewOvershoot} />;
  }
}

module.exports = LaunchSceneBoundary;
module.exports.LaunchScene = LaunchScene;
module.exports.sceneSupported = sceneSupported;
module.exports.loadThree = loadThree;
