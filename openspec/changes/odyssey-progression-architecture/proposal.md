## Why

Idle Base currently opens with every system unlocked — a full professional roster, a 12-team
league, stadium economics, training camp, trades, playoffs and prestige, all on eight tabs from
the first frame — so nothing is earned, no system ever arrives as new, and the once-per-second
simulation is invisible to the player. This change establishes the architectural spine that lets
the game be restructured as a six-act progression (PRD `docs/PRD-incremental-odyssey.md`),
recording the cross-cutting decisions **before** implementation begins so that nine parallel
story branches do not each answer them differently.

This is a decision record for architecture that spans the whole codebase. Individual acts and
features are separate changes; this one exists so they share a foundation.

## What Changes

- **BREAKING**: `state.cash` becomes `state.wallet = { caps, coins, cash }`. Three currencies
  succeed each other across the acts (caps → coins → cash).
- **BREAKING**: the save format bumps to `v2`. `persistence/saveLoad.js` discards saves whose
  `meta.version` does not match, so all existing `idle-base-save-v1` saves are wiped. No
  migration is written — see design.md for the rationale.
- Tick income is generalized from a single hardcoded ticket-revenue call into an unlockable
  **income-source list** (`engine/income.js`), summed per currency. Existing ticket revenue
  becomes one contributor among several, unchanged internally.
- A **progression** capability is introduced: a declarative act config (`data/acts.js`, shaped
  like the existing `data/eras.js`) plus `engine/progression.js` owning act state, derived
  feature unlocks, and act transitions.
- **Locked content does not exist rather than being hidden.** Player-visible content
  (`stadium`, `league`, `season`, `playoffs`) is `null` until the act that creates it. Tick-loop
  collections (`roster`, `powerups`, `prestige.runStats`) are present-and-empty from t=0.
- A single `resolveRules(state)` helper replaces ad-hoc `era.rules` reads and the direct
  `balanceConfig` reads that currently bypass overrides entirely.
- Prestige is redefined to reset to the **Act VI floor**, never below it — the odyssey is played
  once per save; eras remain the endgame replay axis.
- The simulation becomes observable: a capped event feed written by the tick engine, plus a
  visible heartbeat, next-event countdown and per-currency rates.
- A hard invariant is established: **no mechanic may reduce a currency below zero, and the
  manual click action can never be removed.** This is the mechanical guarantee that no sequence
  of gambling losses can soft-lock a save.

## Capabilities

### New Capabilities

- `progression` — acts, feature unlocking, act transitions, and the relationship between
  progression and prestige.
- `currency` — the multi-currency wallet, currency succession across acts, and the
  never-below-zero invariant.
- `income` — how income accrues per currency from unlocked sources, and the requirement that
  offline catch-up credit identically to live ticking.
- `game-feedback` — the requirement that a running simulation be observable without interaction.

### Modified Capabilities

None. `openspec/specs/` is empty; this is the first change recorded in this repo, so every
capability above is new.

## Impact

**Affected code** — the engine and state layers most heavily:

- `src/engine/tickEngine.js` — the most contended file; `advance()`, `addRevenue`,
  `runOffseasonTransition`, and the `playoffTeams` read all change.
- `src/engine/modifiers.js` — gains `resolveRules()`; the composition chain extends to
  `act ← era ← perks ← powerups`.
- `src/engine/income.js`, `src/engine/progression.js`, `src/data/acts.js` — new.
- `src/state/initialState.js` — the state shape changes substantially.
- `src/state/actions/*.js`, `src/persistence/saveLoad.js`, `src/components/layout/*` — wallet
  rename, save version, tab gating and header feedback.
- `src/engine/economy.js` — **not** modified; it is wrapped by an income contributor instead.

**Not affected**: the game remains client-only with no backend, no new runtime dependencies, and
no test framework (the repo has none; adding one is out of scope here).

**Sequencing**: `engine/tickEngine.js` and `state/initialState.js` are each touched by several
of the implementing stories, so the work is ordered in dependency waves rather than fanned out
in parallel. See tasks.md.
