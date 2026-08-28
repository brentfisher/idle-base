// `modules: false` HANDS MODULE FORMAT TO WEBPACK, and that is the whole of what it does here.
//
// It does NOT make this a CommonJS-or-ESM question for the source. Every file in src/ is
// hand-written CommonJS — `const x = require('./y')`, `module.exports = z` — and stays that way;
// openspec/config.yaml states that convention and nothing here changes it. Webpack consumes
// CommonJS natively, so those files are compiled exactly as before.
//
// WHAT IT CHANGES IS WHAT WEBPACK IS ALLOWED TO SEE. With `modules: 'commonjs'` Babel rewrote every
// ESM `import` into a `require()` BEFORE webpack ever received the file. `import`/`export` are
// static — the bundler can prove at build time which names are reachable and delete the rest —
// while `require()` is a function call whose argument can be computed at runtime, so nothing can be
// proven unused and everything is kept. Rewriting the first form into the second therefore disabled
// tree-shaking and code-splitting for the entire project, silently, for any dependency that ships
// ESM.
//
// MEASURED, on this repo, importing twenty-six named symbols from three.js:
//   modules: 'commonjs'  ->  +723 KB   (the whole library)
//   modules: false       ->  +127 KB   (the twenty-six and their reachable graph)
// The app's own code moved by 468 bytes between the two, because hand-written CommonJS was never
// shakeable either way. That is why this was safe to flip and why flipping it changes nothing
// today: the cost was always going to be paid by the NEXT bundled dependency.
//
// It also restores `import()` code-splitting. Under the old setting Babel turned a dynamic import
// into `Promise.resolve().then(() => require(...))`, which webpack inlines — so a lazily-loaded
// chunk was not merely unused, it was unavailable.
//
// ---------------------------------------------------------------------------------------------
// `runtime: 'classic'` IS PART OF THE SAME DECISION, AND THE APP DOES NOT BOOT WITHOUT IT.
//
// `runtime: 'automatic'` injects `import { jsx as _jsx } from "react/jsx-runtime"` at the top of
// every file containing JSX. Under the old `modules: 'commonjs'` that import was rewritten away and
// nobody noticed. Under `modules: false` it SURVIVES — and one ESM import is enough for webpack to
// classify the whole file as an ES module, at which point the `module.exports = X` every file in
// this repo ends with becomes illegal:
//
//     Error: ES Modules may not assign module.exports or exports.*
//     Use ESM export syntax, instead: ./src/state/GameContext.js
//
// That error is a RUNTIME one. `npm run build` compiled clean and the bundle got 420 bytes SMALLER;
// the page then rendered nothing at all. It is the exact failure FabPanel.js's verification note
// describes — a build transforms JSX without ever mounting it, so a throw on mount ships green —
// and it was caught by loading the page, not by any check that inspects the source.
//
// `classic` emits `React.createElement` instead, injecting nothing. Every file that renders JSX in
// this repo already opens with `const React = require('react')` (56 files do; all 52 components are
// among them), so the requirement is already met everywhere and no file changes.
//
// THE FOOTGUN THIS LEAVES, stated so the next person does not find it the hard way: a file may now
// be CommonJS or ESM but NOT BOTH. Adding a single `import` to a file that ends in
// `module.exports` reproduces the boot failure above. The repo's convention is unchanged — write
// CommonJS — and the one reason to reach for `import` is to pull named symbols from a bundled
// dependency you want tree-shaken, in which case that file uses `export` too.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] }, modules: false }],
    ['@babel/preset-react', { runtime: 'classic' }],
  ],
};
