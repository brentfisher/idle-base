## Why

Act VII's premise is that the player already learned this material. Four hours of baseball were an
aptitude program, and the recovered hardware is that program's examination equipment. §8 of
`docs/PRD-act-seven-farm-team.md` turns that premise into nine artifacts that must be *understood*
rather than merely afforded — each a piece of orbital mechanics dressed as alien hardware, and each
solvable from the metaphor the player already has.

The failure mode this change exists to avoid is the moon-logic adventure puzzle, where the player is
not solving a problem but guessing what the author was thinking. The rule that keeps it out is
**the goal may be unclear; the feedback never is**, and the structural expression of that rule is
graded feedback: five codes, every wrong answer told *how* it was wrong, and no bare rejection
anywhere in the system.

The second thing this change owes the act is an anti-soft-lock guarantee. An unsolvable puzzle plus
a purchasable hint is a paywall with extra steps, and there is no money here — so the wall would be
the player's time taken without a trade. Every artifact therefore has **three independent ways past
it**, one of which requires no correct answer, no currency and no purchase.

This is also the act's **elastic sink**. Every other Salvage demand in Act VII is load-bearing for a
pacing table; this one is not, which makes it both the safest place to absorb a rebalance and the
first place to cut if the act's combined draw overruns.

## What changes

- **Nine artifacts** as authored content: prompts, translated prompts, accept lists, the empathy
  lines for near-misses, three hint tiers each, and the capability each one unlocks.
- **Graded feedback** on every submission — solved, near, wrong kind of thing, out of band, nothing
  entered — returned as a code and a key into an authored line table, never as a composed string.
  Numeric artifacts always give direction; sequence artifacts always give a positional count.
- **A hint ladder** of three tiers per artifact, priced as a duration of the phase's own income
  rather than as a constant, so a retune of the economy regenerates the prices instead of silently
  contradicting them.
- **An instrument shop** of six permanent capabilities, in the house shop contract.
- **An attempt governor**: submissions are rate-limited, and an artifact that has refused a player
  enough times gives up and grants its capability anyway.
- **A wake boundary** registered on the event-clock contributor list so a governor's expiry lands a
  simulation step rather than being noticed late.

## What does not change

- **No phase transition in the act becomes gated on an artifact.** The phase ladder is resource and
  site conditions, and remains so. A player who never opens the artifact tab still finishes the act.
- **No rate boundary moves.** The wake boundary added here changes no rate, so the
  linear-within-a-step property the colony solve depends on is untouched.
- **No offline behaviour changes.** Nothing in the simulation loop writes artifact state; attempts
  advance only from a player action, so an eight-hour catch-up cannot resolve an artifact, advance a
  counter, or fire a notification.
- **No rendering.** The artifact tab remains the placeholder the shell story shipped. This change
  lands the content and the rules; the panel, its actions and its action types are a later story,
  and the no-prose-in-a-row rule below is what keeps that story from being able to leak hints.

## Impact

- Affected capabilities: `expedition-state`, `game-feedback`, `progression`
- New: `src/data/actSevenPuzzlesConfig.js`, `src/engine/puzzles.js`
- Modified: `src/engine/tickEngine.js` — one append to the event-clock contributor list, not an edit
  to the function that reduces over it
