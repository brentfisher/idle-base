## Why

The odyssey's seventh act stops being a baseball game. It needs the baseball simulation to *stop*,
and today the only way to stop it is to remove it — which does not work. `advance()` dereferences
`state.season` on every loop iteration, and `AppShell` early-returns a pre-season shell whenever
`!state.season`, so nulling the season slice does not hide the franchise tabs, it takes the whole
app down the Act I/II path. The league, roster, stadium and powerups the player spent hours
building would vanish along with it.

There is also an honest-fiction reason, and it is the better one: the league did not stop existing
because the player left it. One of Act VII's best narrative beats is a background feed line, hours
in, reporting that your former club finished third. That beat requires the league to still be
there.

This change adds the mechanism — a resolvable `seasonFrozen` rule — so the act that consumes it can
be built against something that already exists and is already verified.

## What Changes

- A new resolvable rule `seasonFrozen`, declared in `data/balanceConfig.js` as an explicit `false`
  and layered through the existing `resolveRules()` chain (`balanceConfig ← act.rules ← era.rules`).
  It is never read off `balanceConfig` directly, because it is a value an act overrides.
- When resolved true, `advance()` skips the entire season-phase block: no fixture is resolved, no
  playoff round turns over, no offseason transition rolls the season forward.
- When resolved true, `findNextEventClock()` stops offering season events as step targets. This is
  not cosmetic and not redundant with the guard above — see design.md, Decision 2. Without it the
  tick loop deadlocks on a stale `nextGameAtClock` and the clock itself stops advancing.
- When resolved true, the `ticketing` income contributor pays zero. The gate lives *inside* the
  contributor, alongside the `phase !== 'offseason'` gate that is already there for the same
  reason. Every other contributor keeps paying.
- `season`, `league`, `roster`, `stadium` and `powerups` remain in state untouched and valid.
  Nothing is nulled, emptied or reshaped, and the save version is **not** bumped.
- No act declares `seasonFrozen` yet, so every act shipping today resolves it to `false` and
  behaves exactly as before. This is verified, not asserted — see design.md, Verification.

Not breaking. No new dependency, no component change, no state-shape change, no save migration.

## Relationship to `odyssey-progression-architecture`

This change **extends** that change; it revises nothing in it.

Its Decision 1 established that a condition suspending one income source belongs inside that
source's contributor rather than as a branch in `advance()`, and moved the off-season gate into
`ticketing` on exactly that reasoning. `seasonFrozen` is a second suspension condition on the same
contributor, admitted under the same rule. Decision 1's contributor table is unchanged — no
contributor is added, removed or re-scoped, and `ticketing` still "wraps existing
`revenuePerSecond()` unchanged".

Its `income` spec already carries `Requirement: Source-specific suspension rules`, whose scenario
is written about the off-season specifically. This change generalizes that requirement rather than
replacing it. Its scenario *An override to a zero or disabling value* likewise already settles the
question this change would otherwise have to re-litigate — that an override to a disabling value is
honored as explicit rather than treated as unset — which is the justification for declaring
`seasonFrozen: false` in `balanceConfig` as a real base layer instead of relying on `undefined`
happening to be falsy.

Its Decision 3 required `resolveRules(state)` to distinguish "not overridden" from "overridden to a
falsy value". `seasonFrozen` is the first rule whose *base* value is falsy, so it is the first one
that would be silently broken by a `||` fallback. It is layered by spread, like every other rule.

## Capabilities

### New Capabilities

- `income`: extended with the requirement that a suspension condition on one source is scoped to
  that source. (`openspec/specs/` is empty — the odyssey change is still in flight and unarchived —
  so this is recorded as a new delta rather than a modification.)
- `progression`: extended with the requirement that a stage may suspend the competition simulation
  without destroying it, and that suspending it must not suspend the passage of time.

### Modified Capabilities

None. No requirement recorded anywhere is invalidated or contradicted by this change.

## Impact

**Affected code** — three files, engine and data only:

- `src/data/balanceConfig.js` — declares `seasonFrozen: false` as the base layer.
- `src/engine/tickEngine.js` — `findNextEventClock()` and the season-phase block in `advance()`;
  imports `resolveRules` alongside the `computeModifiers` it already imports.
- `src/engine/income.js` — the `ticketing` contributor.

**Deliberately not affected**:

- `src/engine/modifiers.js` — `resolveRules()` already layers arbitrary keys by spread; a new rule
  needs no change there. That is the point of the helper.
- `src/engine/offlineProgress.js` — it calls `advance()`, so it inherits the behaviour. Verified
  through that path anyway rather than assumed.
- `src/components/**` — `findNextEventClock()` keeps its one-argument signature, so
  `HeaderStats.js` gets correct frozen behaviour (no countdown bar) with no edit.
- `src/data/acts.js` — this change adds the mechanism only. The Act VII story declares the rule.
- `src/persistence/saveLoad.js` — no state-shape change, so no version bump and no save wipe.
