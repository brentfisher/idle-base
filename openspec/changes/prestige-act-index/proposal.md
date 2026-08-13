## Why

`resetForPrestige()` ends with `enterAct({ ... }, FINAL_ACT_INDEX)`. `FINAL_ACT_INDEX` is
`ACTS.length - 1`, which is 5 today — and 5 also happens to be Act VI, the act prestige is
supposed to return the player to. One constant is currently doing two unrelated jobs and getting
both right by coincidence.

The coincidence ends the moment `data/acts.js` grows a seventh entry. `FINAL_ACT_INDEX` becomes 6
and every prestige teleports the player into Act VII, skipping the crossing that Act VII exists to
gate. The same defect sits one line away in `progression.js`: `ACT_INITIALIZERS[FINAL_ACT_INDEX]`
zeroes `prestige.runStats`, which is a prestige-floor concern (see below) wearing the last-act
name.

This is a latent bug, not a tidy-up, and it must land before any story appends to `ACTS`. It
carries no Act VII content and is independently shippable today.

**This preserves a prior decision; it does not overturn one.**
`changes/odyssey-progression-architecture/design.md` **Decision 4** already ruled that prestige
resets to the Act VI index and that the odyssey is played exactly once per save. Nothing here
revisits that ruling. This change is what keeps Decision 4 *true* once Act VI stops being the last
act: it changes only which named constant expresses prestige's semantics, never the semantics.

## What Changes

- `src/data/acts.js` exports a new `PRESTIGE_ACT_INDEX`, a literal `5`, alongside the existing
  `FINAL_ACT_INDEX = ACTS.length - 1`, with a comment recording that the two mean different things
  and are equal today only by coincidence.
- `src/engine/prestige.js` — `resetForPrestige()` calls `enterAct(..., PRESTIGE_ACT_INDEX)`,
  imported from `../data/acts`. `prestige.js` no longer reads `FINAL_ACT_INDEX` at all.
- `src/engine/progression.js` — the `ACT_INITIALIZERS` entry that zeroes `prestige.runStats` is
  re-keyed from `FINAL_ACT_INDEX` to `PRESTIGE_ACT_INDEX` and renamed
  `zeroRunStatsAtPrestigeFloor`. **This is in scope by implication, not scope creep**: Decision 4
  lists "Entering the final act zeroes `prestige.runStats`" as a *consequence of the prestige-floor
  decision*, not as a property of being last. The zeroing exists so `calculateLegacyPoints()` does
  not divide odyssey-wide revenue into the first payout, and that payout is gated by the `prestige`
  unlock at Act VI. Leaving it keyed to `FINAL_ACT_INDEX` would ship a change titled "prestige stops
  depending on being the last act" with prestige still depending on being the last act.
- `src/engine/progression.js` — `checkActTransition()`'s loop comment is rewritten. It currently
  justifies the loop with "Act VI declares no exit, so this can never run past the final act";
  both halves stop being true under a seventh act. The replacement states the invariant that
  actually survives: the last transition is player-gated.
- **Not changed:** the loop's own `while (working.progression.act < FINAL_ACT_INDEX ...)` bound.
  That call site is genuinely about the end of the authored arc and must keep tracking
  `ACTS.length - 1`. Two constants now live in one file and the rename must not sweep this one up.
- **No behaviour change of any kind.** Both constants are 5 today, so the change is
  byte-identical by construction and is verified as such (see design.md).

## Capabilities

### New Capabilities

None. This introduces no capability and changes no requirement.

### Modified Capabilities

None. Prestige's observable behaviour — which act it returns to, what it resets, what it keeps —
is unchanged in every particular, deliberately. `.openspec.yaml` therefore sets `skip_specs: true`:
specs describe behaviour, and no behaviour changes here. Inventing a requirement to satisfy
validation would misrepresent the change.

## Impact

- `src/data/acts.js` — one new exported constant plus its comment block. `getActConfig()` untouched.
- `src/engine/prestige.js` — one import line, one call argument.
- `src/engine/progression.js` — one `ACT_INITIALIZERS` key and function name, one comment block
  rewritten.
- No component, reducer, action or persistence file is touched. `meta.version` is **not** bumped;
  `persistence/saveLoad.js` discards on mismatch and no save shape changes here.
- Unblocks: any story that appends a seventh entry to `ACTS`.
