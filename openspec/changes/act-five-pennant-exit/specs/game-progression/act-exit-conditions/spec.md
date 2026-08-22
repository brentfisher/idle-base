## ADDED Requirements

### Requirement: A declared stage exit must be evaluable by the engine that checks it

Where configuration declares the condition that ends a stage of progression, the engine SHALL have a
registered means of evaluating that condition, and the condition SHALL be satisfiable by play.

A configuration format that falls back to reading a stored flag when no evaluator is registered will
accept a stage whose exit nothing implements. The declaration looks complete, the fallback is
silent, and the result is a stage that can never be left — not a visible error, but a run that stops
progressing while continuing to simulate normally.

Where the fallback exists to serve stages whose implementation has not landed yet, a stage that ships
to players SHALL NOT rely on it unless a code path actually writes the flag it reads.

#### Scenario: A stage declares an exit with no evaluator and no writer

- **WHEN** the exit names a condition that has no registered evaluator
- **THEN** no stored flag satisfying it is ever written, and the stage cannot be left

#### Scenario: Every stage in the shipped arc

- **WHEN** each stage's exit condition is satisfied as that stage describes it
- **THEN** the stage ends and progression advances

#### Scenario: A stage whose exit is a deliberate player choice

- **WHEN** the exit is satisfied only by an explicit player action
- **THEN** a stored flag written by that action alone is the correct mechanism, and no evaluator is
  registered

### Requirement: A stage's stated exit must describe something the stage can produce

The description of a stage's exit SHALL name only outcomes the stage's own configuration can
generate.

A stage that describes a reward its rules do not implement — a postseason in a league configured
without one — asks the player to achieve something unreachable, and gives them no way to discover
that the goal is not merely difficult. Where the stated condition and the configured mechanics
disagree, the description or the mechanics SHALL be changed so they agree.

#### Scenario: A league configured without a postseason

- **WHEN** the stage's rules configure no postseason
- **THEN** its exit is not stated in terms of winning one, and finishing top of the standings is what
  the stage ends on

#### Scenario: A clause nothing reads

- **WHEN** part of a stated exit condition is not evaluated anywhere
- **THEN** it is removed from the description rather than left as an unenforced promise

### Requirement: One reader for a fact shared by more than one stage

Where two stages end on the same underlying fact, that fact SHALL be read through a single function
rather than re-derived in each stage's module.

The fact here is durable rather than incidental: the outcome is captured into a recap at the moment a
season rolls over and the live standings are reset immediately afterward, so any later reader must
use the recap. Two copies of that read are two places to get the timing wrong.

Each stage MAY keep its own name for the fact where the stages call it different things.

#### Scenario: Two stages ending on the standings

- **WHEN** each stage checks whether the player finished first
- **THEN** both resolve through the same reader, and each keeps the name its own stage uses

#### Scenario: The evidence has been reset

- **WHEN** the check runs after the standings have been reset for the new season
- **THEN** the reader consults the recap, which survives the reset

### Requirement: An earned progression outcome is announced when it happens

Where completing a stage's exit condition is an achievement rather than a choice, the run's activity
log SHALL record it at the moment it occurs, named as the stage names it.

The player is otherwise told only that a season rolled over, and the stage transition that follows
has no visible cause. Naming the achievement is what connects the two.

The announcement SHALL be driven by the stage's own configured name for the outcome, and a stage that
names no such outcome SHALL produce no announcement — so a stage that ends on something other than
topping the standings does not claim a trophy it never awarded.

#### Scenario: The player tops the standings in a stage that names its trophy

- **WHEN** the season ends with the player first
- **THEN** the log records it using that stage's name for the trophy, before the rollover entry

#### Scenario: A stage that ends on an accumulated measure

- **WHEN** the player tops the standings in a stage whose exit is an accumulated rate
- **THEN** no trophy is announced

#### Scenario: A stage with a real postseason

- **WHEN** the stage awards a championship through a bracket
- **THEN** it continues to announce that championship and does not also announce a standings trophy
