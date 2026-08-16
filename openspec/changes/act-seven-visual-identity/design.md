# Design — the expedition palette and the Act VII CSS section

## Decision 1: The CSS section is a structural owner, and it lands before the panels

`styles/global.css` ends inside an `@media (max-width: 640px)` block. Anything appended after it is
scoped to phones and invisible on desktop, and nothing in the toolchain catches it — `npm run build`
passes, the diff reads correctly, and the rule silently does not exist.

Two sections already carry a warning about this, and two shipped stories walked into it anyway.
Rather than write the warning a third time, this change creates the **one** `body.expedition`
section, above that block, that STORY-035…040 add their rules inside.

That is why this story is sequenced first rather than sequenced by preference: four panel stories
appending CSS in parallel is a four-way conflict on the file whose wrong resolution is invisible in
review.

## Decision 2: Tokens on `:root`, application on `body.expedition`

The obvious shape — declare `--v7-*` inside `body.expedition`, since that is where they apply — has
a defect that only shows up on one selector.

`html, body` both carry the ballpark ground (`global.css:5-13`), and `body` does not always cover
the viewport on a short page, so the page ground has to be repainted on `html` too. Custom
properties inherit **downward only**: a token declared on `body` is not visible to a rule targeting
`html`. Written that way, `html:has(body.expedition) { background: var(--v7-bg) }` never resolves
the token, falls through to whatever literal is supplied as a fallback, and the two grounds drift
apart the first time `--v7-bg` is retuned. The failure is a strip of outfield green under an
otherwise black page — cosmetic, intermittent, and exactly the kind of thing that survives review.

Declaring at `:root` costs nothing. A custom property is inert until something references it, and
everything referencing these is scoped to `body.expedition`.

## Decision 3: `:has()` is used once, and its degradation is stated

`html:has(body.expedition)` is the only way to reach `html` from a class the React tree owns without
a second mechanism (a second stylesheet, or writing to `documentElement` as well as `body`, both of
which add a thing to keep in sync).

Where `:has()` is unsupported the rule does not apply and the green strip returns on short pages.
That is a cosmetic degradation rather than a broken act, and it is the acceptable failure for the
one selector in this file with a support floor. Stated in the comment so a future reader does not
"fix" it by duplicating the class onto `documentElement`.

## Decision 4: The pill is data, the tokens are not

Split on who reads them. `--v7-*` are consumed by stylesheets, so they are CSS. The phase pill is
consumed by `HeaderStats` at render time, so it is data in `src/data/`.

`{ bg, ink }` matches `data/eras.js` deliberately: the phase pill occupies the era pill's slot, the
two say the same kind of thing ("which chapter of the game is this"), and they are never both true.
One slot wearing two hats, rendered through one inline-style path — a second mechanism here would be
a second thing to keep in sync.

`getPhasePill()` returns **null** for an unrecognized id rather than a default pill. `expedition.phase`
is self-healing — `engine/sites.js` recomputes it from a predicate ladder every tick and writes only
on a difference — so an unknown id is one tick from repair. Painting it as though it were a real
phase would assert something false; hiding it would lose the signal. An uncoloured chip showing the
raw id is the honest middle, and it is what `HeaderStats` already does with the label.

## Decision 5: The label-contrast rule is specificity, not taste

`body.expedition .stat-chip .label` is three classes deep. It outranks:

- `.era-chip .label { color: inherit }` — which exists because "the default label colour is close to
  invisible on a mid-tone fill"
- `.resource-chip .label` — which sets opacity and **deliberately does not set a colour**, so the
  label rides the tone's own measured ink

Both chips take their background **inline** from data. Overriding their label colour with a fixed
muted blue-grey drops them onto bright pastel fills. Measured in the browser before the fix: **1.02,
1.32 and 1.59:1** on the four resource chips — the ones that report whether the colony is starving.

The fix restates both selectors at equal depth inside the palette. The general rule, written into
the comment: **any chip that sets its background inline must keep `color: inherit` for its label.**

## Decision 6: `seasonFrozen`, on mount, with a real cleanup

Keyed on `resolveRules(state).seasonFrozen` rather than an act index, matching `HeaderStats.js:74` —
the rule is what the act declares about itself, so a later act or era that freezes the season is
covered without an index to remember.

Run as a plain mount effect rather than sequenced after the teardown. The overlay plays once, on the
act flip; a player who reloads directly into Act VII never sees it, and a palette waiting on it would
leave that player on ballpark green permanently. During the crossing the ordering is moot — the
overlay is an opaque `inset: 0`.

The cleanup is not decorative: prestige returns the player to Act VI with the same component tree
mounted, and a class left behind would paint the ballpark in expedition black.

## Decision 7: The click button is in scope

`SearchLotButton` renders outside the tab switch in every act (§6.6), so it survives the teardown
untouched — and in Act VII it is the Salvage faucet and therefore the act's anti-softlock guarantee.
Leaving it ballpark green would put the most-pressed control on the screen in the colours of the
game that just ended.

Its bright frame stays a frame. The existing `.cooling` rules argue at length that a button which
loses its bright edge reads as one that has been switched off, and that recharging must never be
signalled by something fading. Amber replaces the gold; the behaviour is unchanged.
