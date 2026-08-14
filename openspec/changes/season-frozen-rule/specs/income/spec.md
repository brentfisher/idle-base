## Purpose

Defines how the game accrues income over time from the set of sources the player has unlocked,
and guarantees that time spent away from the game is credited on the same terms as time spent
watching it.

## ADDED Requirements

### Requirement: Suspension conditions are scoped to the source they describe

A condition that suspends income SHALL be scoped to the source whose behavior it describes, and
MUST NOT suspend any other source. Adding a further suspension condition to one source MUST NOT
change the rate of any other source, and MUST NOT require a stage-level branch in the simulation
loop.

This generalizes the existing off-season rule: the off-season is one condition that suspends
competition-derived revenue, and a suspended competition is another. Both are properties of that
one source.

#### Scenario: A suspended competition suspends only competition revenue

- **WHEN** the competition is suspended for the current progression stage
- **THEN** competition-derived revenue accrues at zero, and every other unlocked income source
  continues to accrue at its normal rate

#### Scenario: A stage with no competition still earns

- **WHEN** the player is in a stage where the competition is suspended and holds sources unrelated
  to competition
- **THEN** those sources accrue normally, and the player's total income is non-zero

#### Scenario: Suspension is reported consistently everywhere a rate is shown

- **WHEN** the competition is suspended and the player views any display of current income rates
- **THEN** every such display reports the same suspended rate as the simulation credits, with no
  possibility of the two disagreeing

#### Scenario: No stage suspends the competition by default

- **WHEN** the player is in any stage that does not declare the competition suspended
- **THEN** competition-derived revenue accrues exactly as it did before this capability existed,
  including its existing off-season suspension
