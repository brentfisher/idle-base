const React = require('react');
// THE LOADER IS NOT WRITTEN TWICE. components/expedition/LaunchScene.js already owns the only
// three.js fetch in the app — pinned version, SRI hash, `crossorigin`, one in-flight promise cached
// for the whole process — and openspec/config.yaml's second bounded-network clause is written about
// THAT function, not about "each place that wants a canvas". Requiring it here means two scenes
// share one script tag, one cache entry, and one failure path.
//
// `sceneSupported()` comes with it for the same reason. It is the single capability predicate,
// decided ONCE before anything is constructed: reduced motion, viewport width, and a real WebGL
// context. A second copy would be a second answer to the same question, and the one that drifted
// would be the one nobody was looking at.
const { loadThree, sceneSupported } = require('../expedition/LaunchScene');
const {
  resolveBackdrop,
  BACKDROP_HEIGHT_FRACTION,
  BACKDROP_MIN_HEIGHT,
  BACKDROP_MAX_HEIGHT,
  BACKDROP_FOG_DENSITY,
  BACKDROP_SETTLE_SECONDS,
  MAX_PIXEL_RATIO,
} = require('../../data/titleScreenConfig');

// The act-keyed picture behind the title screen and the welcome-back screen. WHICH picture is
// data/titleScreenConfig.js's BACKDROPS table; that file is the note on the scheme and this one is
// only the machinery that draws it.
//
// ABSENCE IS A DESIGNED STATE, NOT A FAILURE — the same rule LaunchScene.js states and for a
// stronger reason. That scene decorates a panel; this one decorates the screen with the button that
// STARTS THE GAME. Every one of: no WebGL, `prefers-reduced-motion: reduce`, a viewport under the
// minimum, an unreachable CDN, a blocked request, a failed integrity check, and a throw anywhere
// inside the renderer, resolves to this component rendering `null`. The screen above it is complete
// without it — the name, the premise and the button are ordinary DOM and never depend on a frame
// being drawn. A player whose browser cannot render a triangle must still be able to start.

function backdropHeight() {
  const raw = (window.innerHeight || 640) * BACKDROP_HEIGHT_FRACTION;
  return Math.max(BACKDROP_MIN_HEIGHT, Math.min(BACKDROP_MAX_HEIGHT, Math.round(raw)));
}

// The infield, in world units, shared by the four acts that have one. Home plate is nearest the
// camera; the diamond recedes. Acts III-VI draw the SAME four points and differ only in what is
// standing around them, which is the whole visual argument of the middle of the game.
const HOME = [0, 0, 11];
const FIRST = [13, 0, -1];
const SECOND = [0, 0, -13];
const THIRD = [-13, 0, -1];

// ---------------------------------------------------------------------------------------------
// THE MOTIFS
// ---------------------------------------------------------------------------------------------
//
// One function per `motif` value in the BACKDROPS table. Each is handed a tiny drawing API (below)
// and adds furniture to an already-built stage of ground and drifting motes. Nothing here animates:
// every builder runs once, at build time, and the only per-frame work in this file is the camera
// drift and the mote pool.
//
// AN UNKNOWN MOTIF IS NOT AN ERROR. buildScene() looks the id up and skips it if it is missing, so a
// typo in the data table costs the furniture and leaves the ground, the motes and the palette — a
// plainer picture rather than a black rectangle or a throw.
const SHAPE_BUILDERS = {
  // Act I. A dark slab on the horizon is the back of the hardware store; the caps are flat discs
  // lying where they were thrown, scattered rather than placed because nobody arranged them.
  lot: function lot(api) {
    api.box(120, 16, 2, 0x1a1710, 1, 0, 8, -34);
    api.box(120, 1.4, 2.4, api.palette.accent, 0.25, 0, 16.4, -34);
    for (let i = 0; i < 22; i++) {
      const x = (Math.random() - 0.5) * 46;
      const z = 12 - Math.random() * 34;
      api.disc(0.55, api.palette.accent, 0.55 + Math.random() * 0.35, x, 0.05, z);
    }
    // Ragweed: three strokes each, no leaves. At this size a plant is a gesture.
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * 54;
      const z = 10 - Math.random() * 36;
      const h = 1.2 + Math.random() * 2.2;
      api.line([[x, 0, z], [x + (Math.random() - 0.5), h, z]], 0x4c5a33, 0.55);
    }
  },

  // Act II. The brick fills the frame because in Act II the wall IS the frame. Mortar courses are
  // lines rather than geometry, and the strike zone is the one white thing on the screen.
  wall: function wall(api) {
    api.box(132, 34, 2, 0x50241c, 1, 0, 17, -26);
    for (let i = 1; i < 12; i++) {
      const y = (34 / 12) * i;
      api.line([[-66, y, -24.9], [66, y, -24.9]], 0x2e1611, 0.55);
    }
    // The chalk box somebody redraws every spring. Drawn as four strokes rather than a rectangle
    // outline so the corners overshoot slightly, the way a hand-drawn one does.
    const l = -4.6;
    const r = 4.6;
    const b = 7.5;
    const t = 16.5;
    const z = -24.7;
    api.line([[l - 0.4, b, z], [r + 0.4, b, z]], api.palette.mote, 0.85);
    api.line([[l - 0.4, t, z], [r + 0.4, t, z]], api.palette.mote, 0.85);
    api.line([[l, b - 0.5, z], [l, t + 0.5, z]], api.palette.mote, 0.85);
    api.line([[r, b - 0.5, z], [r, t + 0.5, z]], api.palette.mote, 0.85);
    api.disc(1.1, api.palette.accent, 0.5, 2.2, 0.06, 6);
  },

  // Act III. The first chalk anybody else drew: foul lines, base paths, four bases and a backstop.
  sandlot: function sandlot(api) {
    api.diamond(0.7);
    api.backstop(0.45);
  },

  // Act IV. The same diamond from further back, plus the row of station wagons along the fence with
  // their headlights still on. The field did not change; the number of people who drove to it did.
  travel: function travel(api) {
    api.diamond(0.6);
    api.backstop(0.3);
    api.line([[-46, 0.1, -30], [46, 0.1, -30]], 0x1c3a26, 0.9);
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 10 + (Math.random() - 0.5) * 2.5;
      api.box(6.4, 2.6, 3.2, 0x14251c, 1, x, 1.3, -34);
      api.glow(api.palette.accent, x - 2.4, 1.6, -32.2, 1.6, 0.5);
      api.glow(api.palette.accent, x + 2.4, 1.6, -32.2, 1.6, 0.5);
    }
  },

  // Act V. The first night game — two towers, and from here on the light in these pictures is paid
  // for rather than given.
  minors: function minors(api) {
    api.diamond(0.75);
    api.backstop(0.4);
    api.tower(-30, -26);
    api.tower(30, -26);
    api.line([[-52, 0.1, -32], [52, 0.1, -32]], 0x16402a, 0.9);
  },

  // Act VI. The bowl. The only backdrop in the set where the field is completely enclosed, and the
  // brightest, because everything the player has done was to get here.
  majors: function majors(api) {
    api.diamond(0.85);
    api.ring(52, 12, 0x11293c, 0.85, -2);
    api.ring(54, 0.6, api.palette.accent, 0.3, 10);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      api.glow(api.palette.accent, Math.cos(a) * 54, 13.5, Math.sin(a) * 54 - 2, 3.4, 0.9);
    }
  },

  // Act VII. The teardown already happened. What is left is the ladder, laid out in the shape of
  // the infield it is named after, and a burn arc leaving the plane of the field. Deliberately the
  // same vocabulary as components/expedition/LaunchScene.js without sharing a line of its code:
  // that scene is a VIEW OF THE SIMULATION and this one is a picture.
  expedition: function expedition(api) {
    const rungs = [HOME, FIRST, SECOND, THIRD];
    for (let i = 0; i < rungs.length; i++) {
      const a = rungs[i];
      const b = rungs[(i + 1) % rungs.length];
      api.line([a, b], api.palette.mote, 0.16);
      // Bodies rather than point sprites, and growing outward along the ladder the way
      // components/expedition/LaunchScene.js's rungs do. A glow is layered over each one so the
      // ladder still reads as lit at banner size, where a 2-unit solid is barely three pixels.
      api.rock(1.5 + i * 0.45, api.palette.accent, 0.8, a[0], a[1] + 1.4, a[2]);
      api.glow(api.palette.accent, a[0], a[1] + 1.4, a[2], 4.5 + i * 1.2, 0.55);
    }
    // The fifth burn: an arc that starts on the diamond and does not come back down to it. It has
    // to travel SIDEWAYS as well as up — an earlier version interpolated between two points that
    // shared an x, so it drew a dead vertical line and read as a mast rather than as a departure.
    const arc = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      arc.push([
        -18 + t * 44,
        1.2 + Math.sin(t * Math.PI * 0.85) * 9 + t * t * 22,
        4 - t * 22,
      ]);
    }
    api.line(arc, api.palette.accent, 0.5);
  },
};

// ---------------------------------------------------------------------------------------------
// THE SCENE
// ---------------------------------------------------------------------------------------------

// A SOFT ROUND DOT, DRAWN ONCE PER SCENE, and the reason every light in these backdrops looks like
// a light. `PointsMaterial` with no map renders each point as a hard SQUARE — which is invisible at
// mote size and unmistakable at the size a floodlight bank or an Act VII rung wants to be, where it
// reads as a bug rather than as a lamp. One 64px radial gradient shared by every Points material in
// the scene costs one texture upload and removes the whole problem.
//
// Returns null rather than throwing if a 2D context is unavailable — a headless canvas, a hardened
// browser — and every caller treats null as "no map", which is the square dot again but still a
// picture. The texture is tracked for disposal like anything else.
function dotTexture(THREE) {
  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  } catch (err) {
    return null;
  }
}

// Everything three.js touches lives inside this factory, exactly as in LaunchScene.js, so the
// component below holds one object with four methods and never a renderer, a geometry or a
// material. Disposal is one call rather than a list somebody eventually forgets to extend.
function buildScene(THREE, canvas, backdrop) {
  const palette = backdrop.palette;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  // Capped at 2. A modern phone reports 3, and rendering nine times the pixels for a decorative
  // banner is how a title screen becomes the most expensive frame in the game.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  // Fog in the background colour, so the far edge of the 400-unit ground plane dissolves instead of
  // ending in a hard line across a banner that is only ~170px tall. The density is a measured value
  // shared with the Launch scene — see BACKDROP_FOG_DENSITY in data/titleScreenConfig.js for what
  // gets lost when it is too high, which is most of Acts I and VI.
  scene.fog = new THREE.FogExp2(palette.sky, BACKDROP_FOG_DENSITY);

  // Defaulted rather than required, so a row added to the table without a `camera` key gets a
  // usable framing instead of a NaN camera matrix and a blank canvas.
  const framing = backdrop.camera || { height: 9.5, lookAt: 4, distance: 34 };
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

  // No lights anywhere in this file, and that is a choice rather than an omission: every material
  // below is MeshBasicMaterial, so the picture is silhouettes and flat colour. It reads correctly at
  // banner size, it costs nothing on a weak GPU, and it removes an entire class of "renders black on
  // that one device" from a screen the player cannot get past.
  const disposables = [];
  function track(obj) {
    if (obj.geometry) disposables.push(obj.geometry);
    if (obj.material) disposables.push(obj.material);
    return obj;
  }

  const dot = dotTexture(THREE);
  if (dot) disposables.push(dot);
  // Every Points material in the scene shares the one dot. `depthWrite: false` stops a near light
  // punching a hole in the one behind it, which is what a crown of sixteen overlapping lamps does
  // otherwise.
  function pointsMaterial(color, size, opacity) {
    const spec = {
      color: color, size: size, sizeAttenuation: true, transparent: true, opacity: opacity,
      depthWrite: false,
    };
    if (dot) spec.map = dot;
    return new THREE.PointsMaterial(spec);
  }

  // The drawing API handed to the motif builders. Every primitive the seven motifs need and nothing
  // else; anything a builder cannot express with these belongs in a new helper here rather than in
  // raw three.js calls scattered through the table above.
  const api = {
    palette: palette,
    box: function box(w, h, d, color, opacity, x, y, z) {
      const mesh = track(new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity })
      ));
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    },
    disc: function disc(r, color, opacity, x, y, z) {
      const mesh = track(new THREE.Mesh(
        new THREE.CircleGeometry(r, 12),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity })
      ));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    },
    line: function line(points, color, opacity) {
      const vecs = points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      const geo = new THREE.BufferGeometry().setFromPoints(vecs);
      scene.add(track(new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: opacity,
      }))));
    },
    // A single fat point. Cheaper than a sphere and, at this size, indistinguishable from one —
    // which is the whole reason floodlights and headlights are drawn this way.
    glow: function glow(color, x, y, z, size, opacity) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x, y, z]), 3));
      scene.add(track(new THREE.Points(geo, pointsMaterial(color, size, opacity))));
    },
    // A faceted lump. Flat-shaded (no lights in this file), so it reads as a silhouette with a
    // clean edge rather than as a sphere — which is what Act VII's ladder wants.
    rock: function rock(radius, color, opacity, x, y, z) {
      const mesh = track(new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius, 0),
        new THREE.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity })
      ));
      mesh.position.set(x, y, z);
      scene.add(mesh);
    },
    ring: function ring(radius, height, color, opacity, y) {
      const mesh = track(new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 40, 1, true),
        new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide,
        })
      ));
      mesh.position.set(0, y + height / 2, -2);
      scene.add(mesh);
    },
    // The four bases, the base paths, and the two foul lines run out past the fence. Shared by every
    // act that has an infield so that Acts III-VI are visibly the same field.
    diamond: function diamond(opacity) {
      const bases = [HOME, FIRST, SECOND, THIRD];
      for (let i = 0; i < bases.length; i++) {
        api.line([bases[i], bases[(i + 1) % bases.length]], palette.accent, opacity * 0.5);
        api.disc(1.05, palette.accent, opacity, bases[i][0], 0.06, bases[i][2]);
      }
      api.line([HOME, [46, 0.05, -32]], palette.accent, opacity * 0.55);
      api.line([HOME, [-46, 0.05, -32]], palette.accent, opacity * 0.55);
    },
    backstop: function backstop(opacity) {
      for (let i = 0; i < 3; i++) {
        const y = 1.8 + i * 1.8;
        api.line([[-9, y, 17], [-6, y, 20], [6, y, 20], [9, y, 17]], palette.mote, opacity);
      }
    },
    tower: function tower(x, z) {
      api.line([[x, 0, z], [x, 18, z]], 0x33424f, 0.9);
      api.box(7, 3.4, 0.6, 0x1b2833, 1, x, 19.6, z);
      for (let i = 0; i < 6; i++) {
        api.glow(palette.accent, x - 2.6 + i * 1.05, 19.6, z + 0.5, 2.6, 0.95);
      }
    },
  };

  // The ground. `ground: 0` omits it entirely, which is Act VII's whole statement, so the plane is
  // not merely made transparent — it is never built, and there is nothing to dispose.
  if (backdrop.ground > 0) {
    const plane = track(new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({
        color: palette.ground, transparent: true, opacity: backdrop.ground,
      })
    ));
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
  }

  // THE MOTE FIELD, PRE-ALLOCATED AND FIXED. Two typed arrays sized once at build time and mutated
  // in place forever after: nothing in the frame loop allocates, so a banner left open does not
  // hand the garbage collector a job sixty times a second on a phone.
  const moteCount = Math.max(0, backdrop.motes.count);
  const motePos = new Float32Array(moteCount * 3);
  const moteRise = new Float32Array(moteCount);
  const spread = backdrop.motes.spread;
  const CEILING = 30;
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * spread;
    motePos[i * 3 + 1] = Math.random() * CEILING;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * spread - 6;
    moteRise[i] = backdrop.motes.rise * (0.4 + Math.random());
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = pointsMaterial(palette.mote, backdrop.motes.size, 0.65);
  if (moteCount > 0) scene.add(new THREE.Points(moteGeo, moteMat));

  const build = SHAPE_BUILDERS[backdrop.motif];
  if (build) build(api);

  // Seconds since the last wake. `animating()` reads it, and it is reset rather than accumulated
  // forever so that a woken loop gets a fresh settle window.
  let sinceWake = 0;
  let elapsed = 0;

  function update(dt) {
    sinceWake += dt;
    elapsed += dt;

    // The framing comes from the act's own row (data/titleScreenConfig.js `camera`), not from a
    // constant here: a banner composed for a 34-unit brick wall drops a flat infield behind the
    // title text. The drift is added on top and is bounded, with no target and nothing to arrive
    // at — it exists so the picture is not a screenshot, and anything faster competes with the text.
    camera.position.set(
      Math.sin(elapsed * 0.11) * 4.5,
      framing.height + Math.sin(elapsed * 0.07) * 0.8,
      framing.distance
    );
    camera.lookAt(0, framing.lookAt, -6);

    for (let i = 0; i < moteCount; i++) {
      const y = motePos[i * 3 + 1] + moteRise[i] * dt;
      // Wrap rather than respawn: a mote that reaches the ceiling reappears at the floor with the
      // same x and z, so the field stays evenly distributed without a per-frame random call.
      motePos[i * 3 + 1] = y > CEILING ? 0 : y;
    }
    if (moteCount > 0) moteGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = height > 0 ? width / height : 1;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    disposables.forEach(function (d) {
      if (d && typeof d.dispose === 'function') d.dispose();
    });
    disposables.length = 0;
    moteGeo.dispose();
    moteMat.dispose();
    renderer.dispose();
  }

  // See BACKDROP_SETTLE_SECONDS in data/titleScreenConfig.js for why this is a timer and not an
  // "is the simulation moving" test the way LaunchScene.js's is. A mote field has no idle state, so
  // the settle window is what stops the loop; after it the banner is a still picture until `wake()`.
  function animating() {
    return sinceWake < BACKDROP_SETTLE_SECONDS;
  }

  function restartSettle() {
    sinceWake = 0;
  }

  return {
    update: update,
    resize: resize,
    dispose: dispose,
    animating: animating,
    restartSettle: restartSettle,
  };
}

// ---------------------------------------------------------------------------------------------
// THE COMPONENT
// ---------------------------------------------------------------------------------------------

function ActBackdrop({ actIndex, eraIndex }) {
  const canvasRef = React.useRef(null);
  const wakeRef = React.useRef(null);
  // Decided ONCE, in the state initializer, before a renderer or a geometry exists. A scene that
  // asked whether it was viable while building would already be half-built when it found out.
  //
  // This is also what makes the component server-safe: `sceneSupported()` returns false when there
  // is no `window`, so a server render is the absent state and never touches a DOM API.
  const [status, setStatus] = React.useState(function () {
    return sceneSupported() ? 'loading' : 'off';
  });

  // TOTAL over every act index, including a missing or out-of-range one — see resolveBackdrop().
  // There is deliberately no "no backdrop for this act" branch in this component, because a picture
  // that silently vanished for one act would be indistinguishable from the WebGL-absent state.
  const backdrop = resolveBackdrop(actIndex, eraIndex);

  // Rebuild when the act's picture changes, not when the act changes: two acts resolving to the
  // same row (they do not today) would not rebuild, and an era retint of the same row would.
  const backdropId = backdrop.id;
  const accent = backdrop.palette.accent;

  React.useEffect(function () {
    if (status === 'off') return undefined;
    let cancelled = false;
    let built = null;
    let raf = 0;
    let last = 0;

    loadThree().then(function (THREE) {
      if (cancelled || !canvasRef.current) return;
      try {
        built = buildScene(THREE, canvasRef.current, backdrop);
      } catch (err) {
        // A device that reports a WebGL context and then fails to build one. Same answer as every
        // other failure: no scene, no error on screen, the screen above unchanged.
        setStatus('off');
        return;
      }
      setStatus('ready');

      const fitToCanvas = function () {
        if (!canvasRef.current || !built) return;
        built.resize(canvasRef.current.clientWidth || 1, backdropHeight());
        // A resize clears the drawing buffer, so a settled banner that is not redrawn afterwards is
        // a blank rectangle. Waking costs one frame and only when the box actually moves.
        if (wakeRef.current) wakeRef.current();
      };
      fitToCanvas();
      window.addEventListener('resize', fitToCanvas);

      // ONE FRAME IMMEDIATELY, before any scheduling, so the banner is a picture the instant the
      // card opens rather than a black rectangle for one animation frame — which on a backgrounded
      // tab is not one frame but however long the tab stays backgrounded.
      const draw = function (dt) {
        try {
          built.update(dt);
          return true;
        } catch (err) {
          setStatus('off');
          return false;
        }
      };
      draw(0);

      const frame = function (now) {
        // Backgrounded tabs throttle rAF but do not always stop it. Skipping the draw while hidden
        // is what keeps a title screen left open behind another tab from costing anything.
        if (document.hidden) { last = now; raf = window.requestAnimationFrame(frame); return; }
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
        last = now;
        if (!draw(dt)) { raf = 0; return; }
        if (built.animating()) {
          raf = window.requestAnimationFrame(frame);
        } else {
          raf = 0;
        }
      };

      wakeRef.current = function () {
        if (!built) return;
        built.restartSettle();
        if (raf) return;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      };
      wakeRef.current();

      built.cleanupResize = function () { window.removeEventListener('resize', fitToCanvas); };
    }).catch(function () {
      // Unreachable CDN, a blocked request, or a file that failed its integrity check. All three
      // want the same answer and nothing tries to tell them apart.
      if (!cancelled) setStatus('off');
    });

    return function () {
      cancelled = true;
      wakeRef.current = null;
      if (raf) window.cancelAnimationFrame(raf);
      if (built) {
        if (built.cleanupResize) built.cleanupResize();
        built.dispose();
      }
    };
    // `backdrop` itself is excluded on purpose: resolveBackdrop() returns a fresh object for an
    // era-tinted act, so depending on it would rebuild the renderer on every render. The id and the
    // accent are the only two things about it that can actually change.
  }, [status === 'off', backdropId, accent]);

  if (status === 'off') return null;

  return (
    <div className="act-backdrop" style={{ height: backdropHeight() + 'px' }} aria-hidden="true">
      <canvas ref={canvasRef} className="act-backdrop-canvas" />
    </div>
  );
}

// A throw anywhere below this point degrades to the absent state rather than taking the screen down
// with it. This matters more here than it does for the Launch panel: the screen this decorates
// carries the button that starts the game, and a decorative canvas may not be able to stand between
// a player and that button.
class ActBackdropBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.warn('Act backdrop disabled', err);
  }

  render() {
    if (this.state.failed) return null;
    return <ActBackdrop actIndex={this.props.actIndex} eraIndex={this.props.eraIndex} />;
  }
}

module.exports = ActBackdropBoundary;
module.exports.ActBackdrop = ActBackdrop;
module.exports.SHAPE_BUILDERS = SHAPE_BUILDERS;
// Exported for the same reason LaunchScene.js exports `sceneSupported` and `loadThree`: so the
// three.js half can be driven without a browser. There is no test framework in this repo, so the
// only way to prove that all seven motifs BUILD — rather than merely that a function exists under
// each `motif` id — is to hand this a stand-in THREE and call it once per act. A builder that threw
// on the fourth act would be swallowed by the boundary above and read as "this act has no backdrop",
// which is the one failure mode the whole design is arranged to avoid.
module.exports.buildScene = buildScene;
