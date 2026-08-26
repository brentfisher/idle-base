## Why

Act VII's five burns are the act's biggest moments and the least visible ones. A launch is committed
from a panel of numbers, spends between three and twelve minutes in transit as a countdown, and
arrives as a line of text. The transit window is the longest single stretch of waiting in the game —
the fifth burn alone is twelve minutes — and nothing on screen makes it feel like a crossing.

The overshoot decision has the same problem from the other end. `docs/PRD-act-seven-farm-team.md`
§7.3 builds a genuine trade — dump a fuller tank, arrive sooner, land a bigger grant — and STORY-039
discharged it as a band of figures above a commit button. The figures are correct and the trade is
invisible: nothing shows the player that a hotter burn is a *shorter* one.

A visual harness for this has been built and approved (`The Diamond Run`, published as an artifact).
It draws the ladder as the thing it is named after — a diamond, in orbit — and makes the arc, the
transit and the overshoot legible at a glance. This change is about bringing it into the app under
the constraints the app actually has.

## What Changes

- Act VII's Launch panel gains a **live scene of the crossing**: the site ladder as a tilted
  diamond, the committed burn as an arc between two rungs, and the vehicle's position on that arc
  driven by the same `state.clock` the countdown already reads.
- The **overshoot band becomes visible before the commit**: moving the overshoot control redraws the
  arc hotter and shorter, so the trade §7.3 authors is shown rather than described.
- The **fifth burn leaves the diamond**. Its destination is not a rung, and the scene says so: the
  arc departs the plane of the field and crosses the wall, with no arrival.
- A **fallback path that is not a degradation** — a device without WebGL, a viewport too small to
  seat a scene, or a player who has asked for reduced motion gets the panel exactly as it is today.
  The numbers remain the source of truth in every case.
- `three` is loaded **from a CDN at runtime**, pinned and integrity-checked, rather than added to
  `package.json`. React remains the project's only runtime dependency and `dist/bundle.js` is
  unchanged. What this trades is a third party in the render path and no scene offline — both
  survivable only because the panel is complete without the scene. See design.md Decision 7.

## Capabilities

### New Capabilities
- `game-feedback/expedition-launch-visualization`: what a rendered crossing must show, what it must
  never become the source of truth for, and how it must behave on a phone, on a device that cannot
  render it, and for a player who has asked for less motion.

### Modified Capabilities
<!-- None. The launch panel's existing requirements (game-feedback/expedition-launch-panel) are
     preserved exactly: this change adds a surface beside them and changes none of them. The
     fallback requirement below is what makes that literally true — with the scene absent, the panel
     that spec describes is what renders. -->

## Impact

- **New**: `src/components/expedition/LaunchScene.js` (the renderer), `src/data/launchSceneConfig.js`
  (geometry, palette, timing, and every threshold it reads).
- **Modified**: `src/components/expedition/LaunchPanel.js` (mounts the scene above the existing
  readout), `src/styles/global.css` (scene container — above the file's final
  `@media (max-width: 640px)` block, see design.md), `openspec/config.yaml` (records the CDN as the
  second third-party contact, alongside the leaderboard). **Not** `package.json`.
- **Read, not modified**: `engine/launch.js` for transit, arcs and the overshoot band;
  `data/actSevenSitesConfig.js` for the ladder and its thresholds;
  `data/actSevenLaunchConfig.js` for the transit windows and the band's slope. The scene computes
  none of these.
- **Bundle**: unchanged. Measured while evaluating the alternative: bundling `three` would have cost
  723 KB today, or 127 KB after a project-wide Babel change. design.md Decision 1 keeps that
  measurement, because it revealed that webpack tree-shaking is disabled repo-wide.
- **Not affected**: the tick loop, the save format, `meta.version`, every act before Act VII, and
  every existing Launch panel requirement.
