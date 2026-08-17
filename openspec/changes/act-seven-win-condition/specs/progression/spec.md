## ADDED Requirements

### Requirement: The final act is won by an act of commitment, not by the passage of time

The terminal achievement of the final act SHALL be recorded at the instant the player commits the
last irreversible expenditure, and SHALL NOT be conditional on any subsequent elapsed interval,
resolution or arrival.

The game's last act belongs to the player rather than to a timer. Every earlier boundary in the
odyssey is offered rather than imposed, and the ending SHALL follow that rule: the last thing the
player does is press a button, and everything after it is the game's.

The record SHALL be written only on a path reachable by a player action, never from within the
simulation loop, so that the achievement cannot be resolved during an absence with nobody present to
see it.

The final act SHALL declare no exit. Recording this achievement SHALL NOT advance the player past
the final act, and its identifier SHALL NOT collide with any act's exit identifier.

#### Scenario: Committing records the achievement immediately

- **WHEN** the player commits the terminal expenditure
- **THEN** the achievement is recorded in the same operation that records the commitment

#### Scenario: The achievement is not reachable from the simulation loop

- **WHEN** an arbitrarily long catch-up is simulated for a player who has not committed
- **THEN** the achievement remains unrecorded

#### Scenario: Winning does not advance past the final act

- **WHEN** the achievement is recorded
- **THEN** the player remains in the final act, with no further act entered

### Requirement: The terminal stage is entered on resolution, one interval after the act is won

The run's stage SHALL advance to its terminal value when the achievement has been recorded AND no
commitment made toward it remains unresolved.

Winning and arriving are deliberately separated: the achievement belongs to the moment of decision,
while the terminal stage is a place the run arrives at. Collapsing them would delete the final
transit, which is the interval the entire act has been preparing for.

The stage SHALL continue to be recomputed from a single predicate ladder by a single writer, with
the achievement read as an INPUT to that ladder. No parallel stage flag SHALL be introduced.

The second condition SHALL be expressed as the absence of an unresolved commitment rather than the
presence of a resolved one, so that a save carrying the achievement with no commitment on record
resolves to the terminal stage rather than being stranded indefinitely.

#### Scenario: The stage holds during the final interval

- **WHEN** the achievement has been recorded and the commitment has not yet resolved
- **THEN** the stage remains at its previous value

#### Scenario: The stage advances on resolution

- **WHEN** the commitment resolves
- **THEN** the stage advances to its terminal value on the next recomputation

#### Scenario: A save with no commitment on record is not stranded

- **WHEN** a save carries the achievement but no corresponding commitment record
- **THEN** the stage resolves to its terminal value rather than waiting indefinitely
