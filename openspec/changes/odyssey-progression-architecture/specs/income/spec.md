## Purpose

Defines how the game accrues income over time from the set of sources the player has unlocked,
and guarantees that time spent away from the game is credited on the same terms as time spent
watching it.

## ADDED Requirements

### Requirement: Income accrues from unlocked sources

Income SHALL accrue continuously from every income source the player has unlocked, credited to
each source's currency. Sources the player has not unlocked MUST contribute nothing. Adding a
new income source MUST NOT require changing how existing sources are credited.

#### Scenario: A single unlocked source

- **WHEN** the player has unlocked exactly one income source
- **THEN** that source's currency accrues at its defined rate and no other currency accrues

#### Scenario: Multiple unlocked sources across currencies

- **WHEN** the player has unlocked several income sources across different currencies
- **THEN** each currency accrues the summed rate of its own unlocked sources

#### Scenario: A locked source contributes nothing

- **WHEN** an income source belongs to an act the player has not reached
- **THEN** that source contributes zero and its absence causes no error

### Requirement: Source-specific suspension rules

Conditions that suspend one income source SHALL NOT suspend unrelated sources. In particular,
suspension of competition-derived revenue during an off-season MUST NOT halt income from sources
unrelated to competition.

#### Scenario: Off-season suspends only competition revenue

- **WHEN** the game enters an off-season period
- **THEN** revenue derived from competition is suspended, while unrelated income sources
  continue to accrue normally

### Requirement: Offline progress matches live progress

Time elapsed while the game is closed SHALL be credited on the same terms as time elapsed while
it is open, up to the defined offline cap. The total credited for a given elapsed duration MUST
match what continuous live play over the same duration would have produced.

#### Scenario: Returning after an absence

- **WHEN** the player returns after being away for a period within the offline cap
- **THEN** income credited for that period equals what the same period of continuous live play
  would have produced

#### Scenario: An absence longer than the cap

- **WHEN** the player returns after being away for longer than the offline cap
- **THEN** income is credited for the capped duration only, and the player is informed of what
  accrued

#### Scenario: A long absence with only rate-based income

- **WHEN** the player returns after a multi-hour absence during which only rate-based sources
  were active
- **THEN** the full capped duration is credited without truncation, regardless of any internal
  limit on how many discrete steps the simulation processes

### Requirement: Configurable game rules can be overridden per stage

Values that govern the pace and scale of play SHALL be overridable per progression stage, and an
override MUST remain in effect across the periodic transitions that occur within that stage.

#### Scenario: An override applies on entering a stage

- **WHEN** the player enters a stage that overrides a pacing or scale value
- **THEN** play proceeds using the overridden value rather than the default

#### Scenario: An override survives a periodic transition

- **WHEN** a stage with an overridden pacing value completes a cycle and begins the next one
- **THEN** the overridden value remains in effect and does not revert to the default

#### Scenario: An override to a zero or disabling value

- **WHEN** a stage overrides a value to zero in order to disable a feature
- **THEN** the override is honored as an explicit zero rather than being treated as unset
