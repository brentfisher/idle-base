## 1. Getting `three` to the browser without bundling it

- [x] 1.1 Record the current bundle size, so the cost of every option is measured rather than estimated. **Done: 1,035,258 bytes.**
- [x] 1.2 Evaluate bundling `three` and record the result. **Done: +723 KB as configured, +127 KB with `modules: false` — the finding is in design.md Decision 1, and `three` is NOT in `package.json`.**
- [x] 1.3 Supersede the bundling decision with a CDN load (design.md Decision 7); confirm `dist/bundle.js` is unchanged afterwards.
- [x] 1.4 Write `src/data/launchSceneConfig.js`'s CDN block: the exact pinned URL and its SRI hash. **Never a floating version tag** — a mutable URL makes a supply-chain compromise somebody else's decision.
- [x] 1.5 Write the loader in `src/components/expedition/LaunchScene.js`: inject the script once, `crossorigin="anonymous"` plus `integrity` so the browser enforces the hash, resolve `window.THREE`, and treat every failure as the absent state rather than an error. Concurrent callers share one in-flight load.
- [x] 1.6 Record in `openspec/config.yaml` that the game now contacts a second third party, when, and why it is safe to lose — alongside the leaderboard note STORY-046 added.

## 2. Scene configuration, holding no numbers that belong to the engine

- [x] 2.1 Create `src/data/launchSceneConfig.js` with the diamond's site positions, the palette, camera framing and pacing constants, ported from the approved harness.
- [x] 2.2 Assert by inspection that it contains **no threshold, no transit window and no overshoot constant** — those are read from `data/actSevenSitesConfig.js` and `data/actSevenLaunchConfig.js` at use (design.md Decision 5).
- [x] 2.3 Put every player-facing string the scene emits in this file, not in the component.

## 3. The renderer

- [x] 3.1 Create `src/components/expedition/LaunchScene.js`: star field, infield disc and chalk lines, the five site bodies, and the wall arc beyond Third.
- [x] 3.2 Draw the committed burn as a quadratic Bézier between the origin and destination rungs, with the vehicle's position taken from the engine's in-flight progress every frame — never advanced locally (design.md Decision 2).
- [x] 3.3 Drive the fifth burn's arc out of the plane of the ladder, terminating past the wall with **no arrival body** (spec: "The final burn is drawn as a departure, not an arrival").
- [x] 3.4 Make the arc respond to the uncommitted overshoot selection — shorter traversal and a hotter burn, in proportion to the reduction the engine would apply (spec: "The overshoot trade is shown as a change to the crossing").
- [x] 3.5 Pre-allocate the particle pool; allocate nothing during a flight.
- [x] 3.6 Cap `setPixelRatio` at 2 regardless of device.
- [x] 3.7 Stop the loop on unmount, on `document.hidden`, and when idle with no overshoot adjustment in progress; dispose every geometry, material, texture and the renderer itself on unmount (design.md Decision 4).

## 4. Absence as a designed state

- [x] 4.1 Write the single capability predicate: WebGL context available, viewport wide enough, `prefers-reduced-motion` not set. Decide once, before constructing anything (design.md Decision 3).
- [x] 4.2 Wrap the scene in an error boundary so a throw at any later point degrades to the same absent state rather than taking the panel down.
- [x] 4.3 Confirm that with the scene absent the Launch panel renders **exactly** what it renders today — no error text, no empty frame, no missing figure. **Verified live in three ways: WebGL disabled, reduced motion forced, and a throw injected into the renderer. In all three the readout renders in full, the app stays alive, and no error text appears.**

## 5. Wiring it into the panel

- [x] 5.1 Mount the scene in `src/components/expedition/LaunchPanel.js` above the existing readout, changing none of the panel's existing content or controls.
- [x] 5.2 Add the scene container's styles to `src/styles/global.css` **above the file's final `@media (max-width: 640px)` block**, and assert the line numbers mechanically (design.md Decision 6).
- [x] 5.3 Bound the scene's height so the readout and controls stay reachable at 390px without the scene displacing them, and ensure the page never scrolls horizontally.

## 6. Verification

- [x] 6.1 Write a node harness asserting the layering rules: the scene imports nothing from `src/engine/` that mutates, no `Date.now()` or `setInterval` in the scene, and no threshold or transit constant restated in `launchSceneConfig.js`.
- [x] 6.2 Drive an offline return across an arrival in a scratch script and confirm the engine has resolved it and the scene reports the crossing complete, with no replay (spec scenario).
- [x] 6.3 Run the app: scene renders against a seeded in-flight burn (83,718 lit pixels, brightest [255,255,205]), readout intact beneath it, no horizontal scroll. **Not yet driven through all five legs by hand — the burn was seeded rather than played, and the fifth burn's departure is asserted by the harness rather than watched.**
- [x] 6.4 Force the absent path three ways — reduced motion, a disabled WebGL context, and a thrown error inside the renderer — and confirm the panel is complete each time.
- [x] 6.5 Confirm the idle panel renders one static frame rather than a continuous loop, and that leaving and re-entering the panel repeatedly does not accumulate GPU contexts.
- [x] 6.6 Record the final bundle size against 1.1 in the PR. **1,035,258 -> 1,050,987 (+15,729 bytes), all of it this feature's own code; `three` is not in the bundle.**
