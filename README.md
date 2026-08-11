# Idle Base

An idle baseball odyssey. You are nine years old, there is a vacant lot behind the hardware
store, and there is money in the dirt if you know where to look.

**Play it: https://brentfisher.github.io/idle-base/**

The game runs entirely in the browser and saves to `localStorage`, so it keeps your progress
between visits on the same device. It plays on a phone.

## The odyssey

Six acts, played once per save. Each one is a different game that happens to use the same
simulation, and each ends on a condition the engine can check rather than on a timer.

| Act | | Ends when |
|---|---|---|
| I | The Vacant Lot | You buy the Starter Kit — glove, ball and bat |
| II | Off the Wall | Five wall-ball wins and a crew of three |
| III | Little League | You finish first in a six-game season |
| IV | Travel Ball | You win 60% of your games across two full travel seasons |
| V | The Minors | *(not built yet)* |
| VI | The Big Leagues | *(not built yet)* |

Acts I–IV are playable. Act V is declared in `src/data/acts.js` but has no initializer, so a
save that finishes Act IV stops there.

## Running it locally

```sh
npm install
npm start      # webpack dev server on http://localhost:8080
npm run build  # production bundle into dist/
```

## How it is put together

Plain CommonJS, no TypeScript, no test runner. React only in `src/components/`.

| Directory | What lives there |
|---|---|
| `src/data/` | Configuration and authored prose. Numbers and copy, never logic. |
| `src/engine/` | The simulation. Pure functions — no React, no DOM, no `localStorage`. |
| `src/state/` | The reducer, its actions, and the shape of a save. |
| `src/components/` | React. Renders what the engine says; decides nothing itself. |
| `openspec/` | Change proposals and specs. |
| `docs/` | The PRD the acts are built against. |

Two conventions carry most of the weight:

- **Engine modules are pure and headless.** Every mechanic can be driven from a Node script
  with a seeded random number generator, which is how the acts are balanced — the tuning
  comments in `src/data/acts.js` record the measurements, not opinions.
- **Presentation-ready views.** An engine module exports a `view()` that has already decided
  cost, affordability, odds and availability; the component renders it and recomputes none of
  it. `engine/wallBall.js`'s `challengeView` is the pattern.

## Deployment

`.github/workflows/pages.yml` builds the bundle and publishes it to GitHub Pages on every push
to `master`. The build output is never committed — `dist/` stays gitignored and the workflow
produces it fresh, so what is served is always what the source builds.
