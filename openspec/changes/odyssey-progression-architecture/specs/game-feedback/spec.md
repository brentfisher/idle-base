## Purpose

Defines the requirement that a continuously running simulation be observable to the player, so
that progress, pending events, and everything that happened while away are visible rather than
inferred from changing totals.

## ADDED Requirements

### Requirement: The running simulation is visibly active

The interface SHALL make it apparent that the simulation is running, without requiring the
player to interact or to compare numbers over time.

#### Scenario: Observing an idle screen

- **WHEN** the player looks at the game for a few seconds without interacting
- **THEN** visible motion tied to the simulation's advancement indicates the game is running

#### Scenario: Elapsed time is visible

- **WHEN** the player views the interface
- **THEN** the elapsed game time is displayed in a human-readable form

### Requirement: Simulation events are narrated

Meaningful events produced by the simulation SHALL be recorded and presented to the player as a
readable, ordered account of what happened, rather than being reflected only as changes to
totals.

#### Scenario: An event occurs during play

- **WHEN** the simulation resolves a meaningful event
- **THEN** a corresponding entry describing it becomes visible to the player without switching
  views

#### Scenario: The record is bounded

- **WHEN** many events accumulate over a long session or a long absence
- **THEN** the retained record is capped at a bounded size and the interface remains responsive

### Requirement: Offline progress is accounted for

On returning from an absence, the player SHALL be able to see what occurred while they were
away, as an ordered account rather than only a net change in totals.

#### Scenario: Returning after a long absence

- **WHEN** the player returns after an absence during which many events resolved
- **THEN** the events that occurred are available to review in order, bounded by the retained
  record's cap

### Requirement: Pending events are visible

When the simulation has a scheduled upcoming event, the interface SHALL show progress toward it.
When no event is scheduled, the interface MUST degrade gracefully rather than displaying an
invalid or misleading indicator.

#### Scenario: An event is scheduled

- **WHEN** the simulation has a next scheduled event
- **THEN** progress toward that event is displayed and advances as time passes

#### Scenario: No event is scheduled

- **WHEN** the simulation has no scheduled upcoming event
- **THEN** the indicator is absent or shown in a defined empty state, and never displays an
  invalid value, a permanently full indicator, or a runaway timer

### Requirement: Income is legible as a rate

Each currency the player can earn SHALL display its current rate of accrual alongside its
balance, so the effect of an upgrade or purchase is observable immediately.

#### Scenario: Viewing a currency

- **WHEN** the player views a currency they can currently earn
- **THEN** its balance and its current per-second rate of accrual are both displayed

#### Scenario: Rate changes after a purchase

- **WHEN** the player makes a purchase that changes an income rate
- **THEN** the displayed rate updates to reflect the new value
