# Act V — the pennant exit that was never implemented

## Why

**Act V could not be left.** It declared `exit: { id: 'minorsPennantWon' }` in `data/acts.js`, and
that string appeared **nowhere else in `src/`** — no entry in `EXIT_PREDICATES`, and no writer
anywhere. So `isExitSatisfied()` fell through to `progression.milestones.minorsPennantWon`, which
nothing could ever set, and `checkActTransition()`'s loop broke at act 4 forever.

Reported as *"my save seems to be stuck in the Sandlot Era, even after win conditions"*, and the era
half is the tell: `prestige` unlocks in Act VI and `era` advances only inside `resetForPrestige()`,
so a save stuck in Act V can never prestige and the header's era pill reads "Sandlot Era"
permanently. The era was the symptom; the exit was the cause.

**The act could not deliver what its description promised either.** It read *"Fill a 10,000-seat
stadium and win the minor-league pennant."* Act V declares `playoffTeams: 0`, so no bracket is ever
built; championships are awarded only from `resolved.champion` on the playoff path
(`tickEngine.js`), so `runStats.championships` can never increment in Act V. And the capacity half
was never read by anything. Measured before the fix: six simulated hours, eighteen seasons, a
40,000-seat stadium and a 95-rated roster — still Act V, zero championships, empty milestones.

## What Changes

| File | Change |
|---|---|
| `engine/progression.js` | **`EXIT_PREDICATES.minorsPennantWon` registered** — the fix. Reads the shared "finished first" recap |
| `engine/standings.js` | **New `finishedFirstLastSeason(state)`** — one reader of the field, shared by Acts III and V |
| `engine/littleLeague.js` | `hasWonLittleLeagueTitle()` delegates to it instead of re-reading the field |
| `data/acts.js` | Act V's exit description corrected; `titleName` added to Acts III and V |
| `data/feedMessages.js` | **New `topOfTheTable(seasonNumber, titleName)`** — the trophy line |
| `engine/tickEngine.js` | Emits it at the offseason when the act names a trophy and the player took it |

**The exit is now: finish first in a minor-league season.** Exactly Act III's shape, through exactly
Act III's reader — both acts declare `playoffTeams: 0`, so topping the table *is* the trophy.

**No balance moves.** No cost, window, strength band or season length changes. The act ends on
something it already simulates.

## Capabilities

### Modified Capabilities

- `game-progression/act-exit-conditions`: an act's declared exit must be evaluable by the engine,
  and must describe something the act can actually produce.

## Impact

- **Existing stuck saves recover with no migration — but not automatically.** The predicate is a
  pure read of `season.lastOffseasonSummary`, so a save sitting in Act V leaves it **the first time
  it finishes a season in first place**. A stuck save with a mid-table roster stays in Act V until
  the player invests enough to top the table, which is the act working as designed rather than a
  residue of the bug. Nothing is reset and no save is discarded.
- **Act III is unchanged in behaviour** — same predicate result, one fewer copy of the read — and
  now narrates its own title, which it never did before.
- **Act VI is untouched.** It has a real bracket and keeps narrating `championshipWon`; the new line
  is gated on `titleName`, which only the acts with no postseason set.

## The boundaries this newly exposes

Before this fix **nothing had ever crossed into Act VI or Act VII through play** — those paths were
reachable only by calling `enterAct()` directly from a script. Both were driven end to end after the
fix, from an Act VI arrived at by playing out of Act V:

| Step | Result |
|---|---|
| Act V → VI, by finishing first | crossed, with a coherent season, schedule and standings |
| Act VI restores a postseason | `playoffTeams` back above 0; `playoffs` unlocked |
| A championship through the bracket | won, and narrated as `Champions!` |
| The call-up offered, then accepted | milestone written, Act VII reached on the next tick |
| Act VII landed in | `aftermath`, five sites resolved, Home Plate colonized, four resources, season frozen |
| An hour of Act VII afterwards | runs clean, still act 6 |

## Out of Scope

- **The 10,000-seat clause is dropped rather than implemented.** Nothing read it, and gating the
  exit on capacity as well would be a pacing change to an act whose budget has never been measured.
  Flagged for the owner rather than decided here.
- **Act V still has no postseason.** Adding `playoffTeams` to it would change the act's shape and
  its pacing; the exit now matches the act as built.
- **`cardPacks`** — Act III unlocks a feature id that exists nowhere in `src/`, the same class of
  defect as this one but harmless (the tab simply never appears). Not fixed here.
