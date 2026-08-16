# Act VII — the expedition palette, and a CSS section the panels can extend

## Why

**Act VII must not look like the ballpark**, and until now it did. Nothing in `src/` referenced
`--v7-bg`, `body.expedition` or any phase pill: PRD §6.8 was specified in full and shipped not at
all. A player won the championship, accepted the call-up, watched the game tear itself apart — and
landed on the same outfield green it was made of.

There is a second, larger reason this change exists now rather than as a later coat of paint.
`styles/global.css` **ends inside an `@media (max-width: 640px)` block**, so a rule appended to the
file is silently scoped to phones. It compiles, it reads correctly in a diff, it passes review, and
it does nothing on desktop. STORY-022 and STORY-023 both walked into exactly this (MERGE-NOTES
Phase 2, hazard 3: "a build that passes, a diff that looks right, and a teardown overlay plus a set
of resource chips that are unstyled on desktop").

Six panel stories are queued behind this one and every one of them needs CSS. Without a designated
section they would each append to the end of the file, producing a six-way conflict on the one file
whose wrong resolution is invisible.

## What changes

| File | Change |
|---|---|
| `styles/global.css` | The `:root` token block, the `body.expedition` section, and the shared panel primitives — all above the trailing mobile media query |
| `data/actSevenPalette.js` | **New.** The five phase pills in `{ bg, ink }`, plus the computed-ratio record |
| `components/layout/AppShell.js` | The effect that toggles `expedition` on `document.body` |
| `components/layout/HeaderStats.js` | The phase pill takes its colour from the palette |

## The decisions worth arguing about

**The palette is data; the tokens are CSS.** A CSS custom property is CSS, so `--v7-*` lives in
`global.css`. The one part a component must read at runtime — the pill colour for the current phase
— is data, for the reason `data/eras.js:11-14` gives about the era pill: a component matching on the
phase id, or a CSS class per phase, would both have to be edited by whatever story adds a sixth
phase, and the pill is the element most likely to be forgotten in that edit. `{ bg, ink }` is
`eras.js`'s shape deliberately, so `HeaderStats` renders both through one slot and one code path.

**Tokens are declared on `:root` and applied on `body.expedition`.** Custom properties inherit
downward only, so a token defined on `body` cannot be read by the `html` rule that repaints the page
ground — `var(--v7-bg)` would fall through to a literal, and retuning the ground would silently
leave the html ground behind. Declared at the root, both resolve the same token and cannot drift.
Declaring them costs nothing: a custom property is inert until referenced, and everything that
references these is scoped to `body.expedition`.

**One class on `<body>`, not a second stylesheet or a second shell.** The ballpark ground is painted
on `html, body` and `body` is the only element above the React root, so there is no way to reach it
from inside the tree. The alternatives are what **Decision 3.1** forbids.

**Keyed on `seasonFrozen`, not on an act index**, matching `HeaderStats.js:74`. The rule is what the
act declares about itself, so an era or a later act that also freezes the season gets the treatment
without anyone remembering to add an index.

**It applies on mount, not after the teardown.** The overlay plays once, on the act flip, so a
player who reloads directly into Act VII never sees it — a palette that waited for the teardown
would leave that player on ballpark green permanently. During the crossing the ordering is moot: the
overlay is an opaque `inset: 0`.

**The section owns shared primitives, not just colours.** A signed rate with a distinct starved
state, a stock-against-capacity meter, and a shop row are defined once here rather than six times by
the six panel stories that need them. Ops renders rates; Fab and Sites render shop rows against the
same house shop contract. Six independent inventions is how a system becomes six things that nearly
match.

## Measured

Every ratio is **computed** (WCAG relative luminance), not copied from §6.8 and not eyeballed. The
bar is the one `eras.js` sets for itself and the reason is its: chips render at 0.78rem on a phone,
which is normal-size text for contrast purposes, so anything under 4.5:1 is unreadable in sunlight.

| | Lowest pair | Floor |
|---|---|---|
| Phase pills | `deepSpace` **6.39:1** | 4.7 ✅ |
| Token text pairs | `--v7-alert` on panel **6.48:1** | 4.5 ✅ |
| Header chip labels, after the fix below | **6.86:1** | 4.5 ✅ |

**One regression was caught in the browser rather than shipped.** The blanket
`body.expedition .stat-chip .label` rule is three classes deep and outranks both
`.era-chip .label`'s `color: inherit` and `.resource-chip .label`'s *deliberate* omission of a
colour ("the tone's ink is already high-contrast against its bg ... so it cannot drop below the
measured ratio"). Measured live before the fix, the four resource labels fell to **1.02:1, 1.32:1
and 1.59:1** — muted blue-grey on a bright pastel fill, invisible, on the chips that report whether
the colony is starving. Both are now restated at equal specificity, with a note that any future chip
setting its background inline belongs in that list.

Verified in Chrome against an injected Act VII save: body class present, ground `#070b12`, panels
`#0e1622`, headings and active tab amber, the Life Support pill oxygen cyan, **no ballpark colour
left on any shell element**, and every `body.expedition` rule confirmed above the mobile block.

## Scope

**No panel body is touched.** All six tabs still render `PlaceholderPanel`; this changes only what
they look like when they arrive.
