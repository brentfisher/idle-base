## Purpose

Defines how the player advances through the game's ordered acts, how features become available
as acts are reached, and how the endgame prestige loop relates to that progression.

## ADDED Requirements

### Requirement: Ordered act progression

The game SHALL present its content as an ordered sequence of acts. The player begins at the
first act and advances one act at a time. Progression SHALL be one-directional during normal
play — the player never returns to an earlier act.

#### Scenario: Advancing on meeting an exit condition

- **WHEN** the player satisfies the current act's exit condition
- **THEN** the game advances to the next act, records that the act was entered, and presents the
  new act's objective to the player

#### Scenario: Exit condition not yet met

- **WHEN** the player has not satisfied the current act's exit condition
- **THEN** the game remains in the current act and no features belonging to later acts become
  available

### Requirement: Cumulative feature unlocking

Each act SHALL declare the features it unlocks. The set of available features at any time is the
cumulative union of all features unlocked by the current act and every act before it. Features
unlocked in an earlier act MUST remain available for the rest of the game.

#### Scenario: Feature becomes available on entering its act

- **WHEN** the player enters an act that unlocks a feature
- **THEN** that feature becomes available and is presented to the player as newly available

#### Scenario: Previously unlocked features persist

- **WHEN** the player advances to a later act
- **THEN** every feature unlocked by any earlier act remains available

#### Scenario: Retuning which act unlocks a feature

- **WHEN** the game's act configuration is changed so that a feature unlocks at a different act
- **AND** an existing save is loaded
- **THEN** the available feature set reflects the new configuration without requiring a save
  migration

### Requirement: Locked content is absent, not merely hidden

Content belonging to a future act SHALL NOT be presented to the player in any form — not as a
disabled, greyed-out, or teaser element. Player-visible game content for a future act MUST NOT
exist in game state until the act that introduces it is entered.

#### Scenario: A future act's interface is not shown

- **WHEN** the player is in an act that has not unlocked a given feature
- **THEN** no navigation entry, placeholder, or preview for that feature appears anywhere in the
  interface

#### Scenario: A future act's content is not simulated

- **WHEN** the player is in an act before the one that introduces a piece of content
- **THEN** that content does not exist in game state and the simulation runs without it, without
  error

### Requirement: Act transitions during offline catch-up

Act transitions SHALL be evaluated during offline progress catch-up on the same terms as during
live play. A player MUST NOT be held at an act boundary merely because the condition was
satisfied while the game was not open.

#### Scenario: Exit condition satisfied while away

- **WHEN** the player closes the game during one act
- **AND** enough time passes offline that the act's exit condition is satisfied by accrued
  progress
- **THEN** on returning, the player is in the next act, and the events of the transition are
  available to review

### Requirement: Prestige returns to the final act

The prestige reset SHALL return the player to the final act, never to an earlier one. Prestige
resets run-scoped progress but MUST NOT revoke any feature unlocked during the progression, and
MUST NOT require the player to replay earlier acts.

#### Scenario: Prestiging from the final act

- **WHEN** the player performs a prestige reset
- **THEN** run-scoped progress resets, all previously unlocked features remain available, and
  the player remains in the final act

#### Scenario: Run statistics scope

- **WHEN** the player enters the final act for the first time
- **THEN** the run statistics that determine prestige rewards begin accumulating from that
  point, so that progress made during earlier acts does not inflate the first prestige reward
