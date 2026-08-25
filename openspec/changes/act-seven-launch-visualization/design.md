## Context

See proposal.md — Why. The constraints that shape the approach, all of them pre-existing:

- **One runtime dependency.** `package.json` lists React and nothing else, and `openspec/config.yaml`
  states that as a project fact. `dist/bundle.js` is already 956KB and webpack warns about it on
  every build.
- **One clock.** `engine/tickEngine.js: advance()` is called identically by the 1s tick and by
  `engine/offlineProgress.js`. Any time-driven mechanic that does not fold into it silently fails to
  apply during catch-up. This is the single most-repeated rule in the repo.
- **Strict layering.** `src/engine/` is pure — no React, no DOM. WebGL is a DOM API, so none of this
  belongs there.
- **A phone-shaped surface.** Act VII's tab bar was converted to a scroll-snapped single row to
  survive 390px. The act is designed against that width.
- **A CSS hazard with teeth.** `src/styles/global.css` ENDS inside `@media (max-width: 640px)`. A
  rule appended at EOF is silently desktop-invisible, builds clean, and looks correct in the diff.
  MERGE-NOTES records it firing three times during the Act VII panel wave.
- **No test framework.** Verification is a node harness plus running the app.

The harness this design implements is published and approved: *The Diamond Run*, which draws the
ladder as a tilted diamond, the burn as an arc between rungs, and the fifth burn leaving the field.
Its geometry, palette and pacing are the reference; nothing below reopens those choices.

## Goals / Non-Goals

**Goals**
- The crossing is a *view* of `engine/launch.js`, holding no state the engine owns.
- The overshoot trade is visible as a change to the crossing before the commit.
- The panel is complete and correct with the scene absent, on any device, always.
- The bundle cost is bounded, stated, and measured rather than estimated.

**Non-Goals**
- Not a replacement for any figure on the panel. Every number stays.
- Not interactive beyond the controls that already exist. No camera the player drives, no clicking
  sites — this is a readout, not a viewport.
- Not used anywhere else in the game. Acts I–VI are untouched.
- Not a physical simulation. The arc is authored geometry, not orbital mechanics; the act's transit
  windows are hand-tuned numbers and the picture illustrates them rather than deriving them.

## Decisions

### Decision 1 — SUPERSEDED by Decision 7. `three` is loaded from a CDN, not bundled

The measurement below stands and is worth keeping — it is how the project learned that tree-shaking
is off — but the dependency is no longer taken. See Decision 7.

### Decision 1 (original) — Take `three` as a dependency, tree-shaken, rather than hand-rolling WebGL

**Chosen**: add `three` and import only the named symbols used, so webpack's tree-shaking drops the
rest of the library.

**Alternatives considered**

- *Raw WebGL.* No dependency, and it fits the repo's ethos exactly. Rejected on maintenance cost: the
  scene needs a perspective camera, a depth-sorted transparent pass, a points system and a Bézier
  path, and hand-written shader/matrix code for those is several hundred lines that nobody in this
  repo will want to touch again. The dependency is the cheaper long-term liability.
- *2D canvas.* Cheapest of all and genuinely viable — the diamond could be drawn in projection. Rejected
  because the fifth burn's whole point is leaving the plane of the field, and a 2D projection makes
  that the one thing it cannot show.
- *Inline the harness build.* What the artifact does (589KB of UMD `three`, inlined). Correct for a
  sandbox that blocks CDNs, wrong for the app: it defeats tree-shaking entirely.

**The cost is a measurement, not an estimate.** A task below records the bundle before and after. If
the tree-shaken addition exceeds **250KB minified**, the decision is reopened rather than shipped —
that is a gate, not a hope.

#### MEASURED 2026-08-25 — the gate passes, but only after a build-config change

| Build | `dist/bundle.js` | Δ |
|---|---|---|
| baseline, `modules: 'commonjs'` (as shipped) | 1,035,258 | — |
| **+ `three`, `modules: 'commonjs'`** | 1,775,678 | **+723 KB** ❌ |
| baseline, `modules: false` | 1,034,790 | −468 |
| **+ `three`, `modules: false`** | 1,164,755 | **+127 KB** ✅ |

`babel.config.js` sets `@babel/preset-env` to `modules: 'commonjs'`, so Babel rewrites every ESM
import to CommonJS **before webpack sees it** — and webpack cannot tree-shake or code-split what
reaches it as CommonJS. The named-import discipline this decision asks for is therefore inert today:
importing twenty-six symbols from `three` pulls the entire library.

Two consequences, and the second is bigger than this change:

1. **The gate is passable.** With `modules: false`, `three` costs 127 KB against a 250 KB budget.
2. **Tree-shaking has been off for the whole project.** The app's own code barely moves (−468 bytes,
   because it is hand-written CommonJS that was never shakeable), so nothing is currently being lost
   — but every future dependency pays the same 5.7× penalty this one did.

`modules: false` is safe for a CommonJS codebase — webpack consumes CommonJS natively, and the
measured baseline build above is byte-for-byte equivalent. It is nonetheless a project-wide build
change, and `openspec/config.yaml` is emphatic that this repo is CommonJS by convention, so it is
**not** something this change should make unilaterally. Task 1.3 is blocked on that decision.

Code-splitting `three` into a lazily-loaded chunk was also measured and does **not** work today for
the same root cause: Babel rewrites `import()` to `Promise.resolve().then(() => require())`, which
webpack inlines. It becomes available with `modules: false` and is the natural follow-up if 127 KB
on first load is still judged too much for a mobile-first game. `openspec/config.yaml`'s "React is the only runtime dependency" line is
updated in the same change that makes it false, which is the same discipline STORY-046 applied to the
"no network calls" line.

### Decision 2 — The scene reads progress from the engine and never advances anything itself

`engine/launch.js` already resolves transit and already exposes an in-flight readout — STORY-039
added `inFlightReadout()` for precisely this kind of consumer. The scene asks it where the vehicle is
and draws that.

The renderer still runs a `requestAnimationFrame` loop, and that is not a second clock: it advances
*presentation only* — camera drift, particle decay, the vehicle's roll. Position along the arc comes
from `state.clock` every frame. The distinction to hold: **anything the simulation would need to know
about comes from the engine; anything that would look identical if it were absent may be local.**

*Alternative considered*: interpolate between ticks for smoothness. Rejected — it is the first step
toward the scene having an opinion about where the vehicle is, and an offline return is where that
opinion becomes visibly wrong.

### Decision 3 — Absent is a first-class state, decided once, before anything is constructed

A single predicate decides whether the scene renders at all: WebGL availability, viewport width,
`prefers-reduced-motion`, and a caught construction failure. When it says no, `LaunchPanel` renders
exactly what it renders today.

Implemented as an error boundary plus a capability check, so a throw *inside* the renderer at any
later point degrades to the same state rather than taking the panel down. A visualization that can
crash the act's most important screen is worse than no visualization.

*Alternative considered*: a static fallback image. Rejected as invented content — the panel is
already complete without the scene, and the honest fallback is the thing that was there before.

### Decision 4 — Budgeted for a phone, and paused whenever it is not being watched

- Pixel ratio capped at 2 regardless of device.
- Particle pool fixed and pre-allocated; no allocation during a flight.
- The loop stops when the panel unmounts, when the document is hidden, and when no launch is in
  flight and no overshoot is being adjusted — an idle scene costs one static frame, not sixty a
  second.
- Every GPU resource disposed on unmount. Act VII sessions run for hours and the panel is entered and
  left repeatedly; a renderer that leaked a context per visit would degrade the act it decorates.

### Decision 5 — Geometry and palette are data, and the ladder is read, never restated

`src/data/launchSceneConfig.js` holds the diamond's positions, the palette and the pacing. It holds
**no threshold, no transit window and no overshoot number** — those are read from
`data/actSevenSitesConfig.js` and `data/actSevenLaunchConfig.js` at use. The repo's standing argument
applies unchanged: two copies of a threshold is a retune that moves one and not the other.

### Decision 6 — CSS goes above the final mobile media query, and the task asserts it

Not a style note. The hazard has fired three times in this act. The task that adds the container's
styles also asserts the block's line numbers sit above the file's last `@media (max-width: 640px)`,
mechanically, the way STORY-045 did.

### Decision 7 — Load `three` from a CDN at runtime, pinned and integrity-checked

**Chosen**: inject a `<script>` tag for a pinned UMD build of `three` when the scene is about to
render, and read `window.THREE`. It is not in `package.json`, not in `bundle.js`, and not fetched by
any player who never opens the Launch panel in Act VII.

**What this buys**
- **Zero bundle cost.** `dist/bundle.js` is unchanged — the 723 KB / 127 KB question stops mattering
  and `babel.config.js` is not touched. The tree-shaking finding is recorded above for whenever the
  project does want to act on it, but nothing here depends on it.
- **A UMD build sidesteps the module problem entirely.** Babel rewrites `import()` to a `require()`
  webpack inlines, which is why lazy-loading the npm package did not work. A classic script tag
  needs neither, and the repo's CommonJS convention is untouched — the loader is ordinary
  `require`/`module.exports` like every other file.
- **The version is the one that was approved.** The pinned build is byte-identical to the one the
  published harness renders with, so what ships is what was signed off.

**What it costs, stated plainly**
- **A third party is now in the render path.** If the CDN is unreachable, the scene does not render.
  That is survivable only because Decision 3 already makes absence a designed state rather than a
  failure — the panel is complete without it. It would be an unacceptable risk for anything the
  player needs.
- **The scene does not render offline.** This is an idle game that works offline by design;
  everything else continues to. The scene is the one part that needs the network, and it is the one
  part nobody needs.
- **The player's IP reaches the CDN.** One more third party alongside the leaderboard, and it is
  contacted only on the panel that uses it — never on load, never in Acts I–VI.

**Non-negotiable: pin the exact version and carry an SRI hash.** A CDN script without `integrity` is
arbitrary third-party code executing in the player's browser, and a mutable `@latest` URL is a
supply-chain compromise waiting to be someone else's decision. `crossorigin="anonymous"` is required
for the integrity check to be enforced.

*Alternatives considered*: bundling (Decision 1 — costs 723 KB today, or a project-wide Babel change);
raw WebGL (no dependency at all, several hundred lines of matrix and shader code); vendoring the file
into the repo (no third party, but 603 KB committed to git and a manual update path forever).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| ~~Bundle growth~~ — resolved by Decision 7 | `three` is not bundled. `dist/bundle.js` is unchanged and `babel.config.js` is untouched |
| **The CDN is unreachable, or the player is offline** | The scene does not render and the panel is complete without it (Decision 3). This is the single largest new failure mode and it is designed for rather than mitigated |
| **A compromised CDN executes arbitrary code** | Exact version pin plus an SRI `integrity` hash and `crossorigin="anonymous"`; the browser refuses a file that does not match |
| **A second third party sees player IPs** | Contacted only on the panel that uses it, never on load, never before Act VII |
| **WebGL on low-end Android is unpredictable** | Decision 3 makes absence a designed state, not a failure; Decision 4 caps the work |
| **The scene and the readout disagree** | Decision 2 makes that structurally impossible: there is one source for position |
| **Battery drain during long Act VII sessions** | Decision 4's idle pause; the common case (watching a colony tick) renders nothing |
| **The scene becomes load-bearing by drift** — a fact appears only in the picture | The spec forbids it; the fallback path is the test, because anything only in the scene vanishes there |

## Migration Plan

None required. No state, no save format, no `meta.version`, no engine behaviour changes. The feature
is additive and its absence is a supported state, so a partial rollout is simply a build where the
scene does not render.

## Open Questions

1. ~~**Does the scene appear before a launch is committed, or only during transit?**~~ **RESOLVED —
   it appears before the commit**, and the spec settles it rather than taste: "the rendered crossing
   SHALL respond to that choice *before* the launch is committed" is a requirement, and it is
   unsatisfiable if the scene only exists during transit. So: the ladder renders statically when
   idle, and animates only in flight or while the overshoot control is being moved. The idle cost is
   one static frame per panel visit, which Decision 4's pause already budgets for.
2. **Should arrival be marked in the feed as well as in the scene?** The feed already narrates
   arrivals. Probably nothing to add — noted so it is decided rather than forgotten.
3. **What happens on a rotated phone?** The scene should reseat rather than distort, but the sensible
   aspect ratio for a landscape phone has not been measured. Deferred to implementation, where it can
   be looked at rather than guessed.
