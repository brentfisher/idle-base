## ADDED Requirements

### Requirement: Optional objectives pay a fraction of the threshold they shorten

An optional objective's reward SHALL be declared as a percentage of the gating threshold currently
being filled, and SHALL NOT be declared as an absolute quantity.

The thresholds are owned by the progression ladder and are retuned there. An objective carrying a
hand-typed absolute would silently stop being worth the fraction it was designed to be worth the
first time a threshold moved, and no build step or type check can detect that. Declaring the
percentage and resolving it against the ladder makes the two incapable of drifting.

The reward SHALL be resolved onto the offer at the moment it is offered, so the terms the player
accepted are the terms that pay.

The sum of every reward obtainable against a single threshold SHALL NOT exceed 40% of that
threshold. The baseline duration of every phase is derived assuming **zero** objectives are run, so
the ceiling bounds how far an engaged player may compress a phase relative to a player who ignores
the board entirely.

#### Scenario: A retuned threshold moves the payouts with it

- **WHEN** a gating threshold is changed in configuration
- **THEN** every objective's reward against that threshold changes in proportion, with no other edit

#### Scenario: The ceiling holds at every rung

- **WHEN** every reward available against any one threshold is summed, including the largest possible
  draw of any randomised reward
- **THEN** the total is no more than 40% of that threshold

### Requirement: Only unaccepted offers lapse, and lapsing costs nothing

An offer that has not been accepted MAY carry a deadline. An objective that HAS been accepted SHALL
NOT carry one and SHALL NOT be capable of lapsing.

An accepted objective is inside a window that advances with the clock whether or not the player is
present. Attaching a deadline to it would make the reward contingent on vigilance, which is the one
thing an idle game may not require.

When an offer lapses, or when an accepted objective is voided by the player breaking its own terms,
the instance SHALL be removed and its identity recorded as missed. A missed identity SHALL remain
eligible to be re-offered on the same terms with a longer window, and SHALL be preferred over
repeating an offer the board has already shown.

No lapse, void or abandonment SHALL debit any resource, remove any possession, or reduce the total
reward still obtainable against the current threshold.

#### Scenario: An accepted objective survives an absence

- **WHEN** a player accepts an objective and returns after a long absence
- **THEN** the objective has either completed or is still running, and has not lapsed

#### Scenario: A lapse returns as a rescheduled offer

- **WHEN** an offer lapses unaccepted and the board later refreshes
- **THEN** the same objective may be offered again at the same reward with a longer window

#### Scenario: Breaking the terms costs only the objective

- **WHEN** a player breaks the terms of an accepted objective
- **THEN** nothing is debited and the objective becomes eligible to be offered again

### Requirement: A reward that does not fit is refused, never truncated

Claiming a reward SHALL be refused when crediting it would exceed the capacity of the store it is
paid into. The refusal SHALL leave the objective claimable indefinitely.

Capped stores discard what overflows them. A reward credited into a nearly full store would
therefore be silently and permanently destroyed at the exact moment it was earned — the most
damaging possible outcome, because it is invisible.

The capacity compared against SHALL be the capacity derived from what the player currently owns, and
SHALL NOT be a capacity value read from the save. Stored ceilings are ignored everywhere else in the
expedition for the same reason: they freeze at whatever they were when written and cannot reflect a
retune or a later acquisition.

The refusal SHALL be reported on the offer listing with its reason, so the player can see that the
reward is waiting rather than missing.

#### Scenario: A full store refuses the claim

- **WHEN** a reward is larger than the free space in the store it pays into
- **THEN** the claim is refused, nothing is credited, and the objective remains claimable

#### Scenario: Emptying the store makes the claim legal

- **WHEN** the player spends down the store or raises its ceiling
- **THEN** the same objective becomes claimable and pays in full

### Requirement: Objectives complete during catch-up but never pay during it

Simulation SHALL be able to advance and complete an accepted objective while the player is absent. A
completed objective SHALL enter a claimable state and SHALL NOT credit any reward until the player
claims it.

Completing offline is the genre's promise. Paying offline is not: an unattended credit risks the
overflow refusal above at the moment nobody can respond to it, would emit player-facing notifications
from inside a simulation that may resolve eight hours in one pass, and spends the only moment the
reward is dramatically worth anything.

Because nothing is credited during simulation, advancing the same span twice SHALL produce the same
result — the resolver SHALL be idempotent by construction rather than by bookkeeping.

#### Scenario: Two objectives complete during one absence

- **WHEN** a player accepts two objectives and returns after both windows have closed
- **THEN** both are claimable, and no reward has been credited

#### Scenario: Replaying a span changes nothing

- **WHEN** the same elapsed span is advanced twice over the same starting state
- **THEN** the second pass leaves the objectives unchanged

### Requirement: Objective upkeep is a consumer term resolved before the rate solve

An objective that draws resources while it runs SHALL contribute its draw to the demand side of the
colony's rate solve, before the solve runs and before the next resource boundary is computed.

The rate model is exact only because every rate is constant within a step and every instant a rate
changes is reported as a boundary. A draw folded in after the solve is a consumer the ration was not
solved against: the boundary would be computed at the wrong instant, or not at all, and during a long
absence a pre-crossing rate would be applied across the whole span. That is the precise failure the
solve exists to prevent, so the ordering is a requirement and not an implementation detail.

The draw SHALL be scaled by the same draw multiplier that scales every other life-support consumer.

#### Scenario: A drawing objective moves the boundary

- **WHEN** an objective drawing a resource is accepted
- **THEN** the reported instant at which that resource next reaches a boundary moves earlier

#### Scenario: A drawing objective cannot push a resource through zero mid-step

- **WHEN** an objective's draw would exhaust a resource during a long step
- **THEN** the step stops at the exhaustion instant and the resource clamps at zero rather than
  going negative

### Requirement: The board is derived from a state seed and holds still

Which offers appear on the board SHALL be determined by a generator seeded from state, and SHALL NOT
be drawn from an unseeded source of randomness.

The board is recomputed on every render that the tick loop causes. An unseeded draw would reroll the
visible offers many times a second, and would not survive a reload or reproduce in a headless run.

Any randomness in an objective's terms SHALL be drawn once, at acceptance, and stored on the
instance, so it cannot be re-rolled by reloading. Randomness SHALL enter the engine as a defaulted
parameter so a deterministic generator can be injected.

#### Scenario: The board survives a reload

- **WHEN** the game is reloaded without the clock advancing
- **THEN** the board shows the same offers

#### Scenario: A randomised reward cannot be re-rolled

- **WHEN** a player accepts an objective with a randomised reward, then reloads
- **THEN** the reward is the value drawn at acceptance

### Requirement: The board contributes no boundary and writes no state outside its own act

Every entry point of the objective board SHALL abstain when the expedition is not live, returning the
state it was given by identity and contributing no event boundary.

The board's next-refresh time defaults to zero, which correctly means "a refresh may happen now" and
is a legitimate stored value. Unguarded it is also a boundary in the past for every save in every
earlier act, which would step simulation to it, run a refresh, and materialise expedition state into
saves that have none.

A refresh only fills empty slots. When no slot is empty the board SHALL contribute no boundary, so an
untouched board across a long absence costs no iterations.

#### Scenario: An earlier act is untouched

- **WHEN** a save from before the expedition exists is advanced
- **THEN** no expedition state is written and the next event time is unchanged

#### Scenario: A full board is not an event

- **WHEN** the board's slots are all occupied
- **THEN** no refresh boundary is proposed, however long the absence
