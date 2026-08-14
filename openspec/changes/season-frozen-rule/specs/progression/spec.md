## Purpose

Defines the staged progression the player moves through, what each stage may override about how
the game behaves, and how the game's content comes into and goes out of active play as stages
change.

## ADDED Requirements

### Requirement: A stage may suspend the competition without destroying it

A progression stage SHALL be able to declare the competition suspended. While suspended, the
simulation MUST NOT resolve fixtures, MUST NOT progress the competition through its phases, and
MUST NOT begin a new competition cycle.

Suspension is not deletion. All content the competition is made of — the current competition and
its schedule and standings, the league of opposing sides, the player's roster, the venue and any
active temporary bonuses — SHALL remain present in state, unmodified and structurally valid, for
the entire time the competition is suspended. Nothing may be emptied, reshaped, or replaced with
an absent value.

This is a hard requirement rather than a preference. Removing the competition instead of
suspending it makes the whole game render as though the player had never reached the stage that
created it, because absence of a competition is already how the game recognizes a player who has
not got one yet.

#### Scenario: The competition stops progressing

- **WHEN** a stage that suspends the competition is active and simulated time passes
- **THEN** no fixture is resolved, no elimination round is decided, no new competition cycle
  begins, and the recorded standings do not change

#### Scenario: The content survives intact

- **WHEN** a stage that suspends the competition is active and an arbitrary amount of simulated
  time passes
- **THEN** the competition, the league, the roster and the venue are all still present and
  structurally valid, and the competition and league are byte-for-byte what they were when the
  suspension began

#### Scenario: The rest of the game is not suspended with it

- **WHEN** a stage that suspends the competition is active
- **THEN** the clock continues to advance, non-competition income continues to accrue, temporary
  bonuses still expire on schedule, timed player-development activities still complete, and stage
  transitions still fire

#### Scenario: Suspension does not stall the simulation

- **WHEN** a stage that suspends the competition is active and the simulation is asked to advance
  by a long duration in a single call
- **THEN** the full duration elapses on the clock and is credited, rather than the simulation
  stalling on a competition event that will never be resolved

#### Scenario: Away time is treated identically

- **WHEN** the player returns after being away while the competition was suspended
- **THEN** the credited result is the same as if the same duration had elapsed with the game open

#### Scenario: An unsuspended stage is unaffected

- **WHEN** the player is in any stage that does not declare the competition suspended
- **THEN** the competition progresses exactly as it did before this capability existed

### Requirement: Suspension is a stage override resolved like every other rule

Whether the competition is suspended SHALL be resolved through the same layered rule resolution
that governs every other stage-overridable value, with a declared default of "not suspended" at
the base layer. It MUST NOT be read from the base configuration directly, and a stage declaring
"not suspended" explicitly MUST be honored as an explicit value rather than being treated as
though it had declared nothing.

#### Scenario: A stage turns suspension on

- **WHEN** a stage declares the competition suspended
- **THEN** the resolved rules report it as suspended for the whole time that stage is active

#### Scenario: The default is declared, not implied

- **WHEN** no stage and no replay tier declares anything about suspension
- **THEN** the resolved rules report the competition as not suspended, from the declared base
  value rather than from the absence of a value

#### Scenario: Save compatibility

- **WHEN** a save written before this capability existed is loaded
- **THEN** it loads unchanged and is not discarded, because no persisted state shape has changed
