## ADDED Requirements

### Requirement: The status display reports rates the simulation produced, never rates it derived

Any display of a resource's rate, remaining runway or warning state SHALL be derived from a
single simulation solve, and SHALL perform no solve of its own. The boundary helper that feeds
such a display SHALL reshape the simulation's output only; it MUST NOT recompute a rate, however
faithfully.

This is a correctness requirement rather than an efficiency one. A second copy of the rate
arithmetic is correct on the day it is written and wrong the first time either copy changes, and
it fails silently by producing a plausible number. A display that reports forty seconds of runway
while the simulation crosses the boundary in four is worse than a display with no runway at all.

#### Scenario: Displayed rates match the simulation exactly

- **WHEN** any resource rate or capacity is shown to the player
- **THEN** it is the identical value the simulation solved for that resource in the same step

#### Scenario: A rationed colony reports one ration everywhere

- **WHEN** the colony's rationing factor is below full
- **THEN** the rate credited, the rate integrated against and the rate displayed are the same
  number

### Requirement: A capacity-bounded resource is displayed against its ceiling, with the sign of its net rate

A capacity-bounded consumable SHALL be displayed as its current amount against the capacity that
bounds it, together with the direction of travel and a warning when it is close to exhaustion. The
ceiling SHALL always be shown, including when it is zero — a resource with no storage built yet is
a real state, not a missing value.

Whether a resource is rising, falling, warning, full or exhausted SHALL be decided by the
simulation layer and handed to the display already resolved. The display SHALL apply no threshold
and make no comparison of its own, because "what counts as falling" is a rules question the moment
anyone wants a hysteresis band.

#### Scenario: A draining resource warns while the player can still act

- **WHEN** a resource will be exhausted within the authored warning window
- **THEN** it is shown in its warning state, and the window is no longer than the time needed to
  afford the purchase that relieves it

#### Scenario: A resource with no storage is not an alarm

- **WHEN** a resource has a capacity of zero because its storage has not been built
- **THEN** it is displayed in a neutral state, not as exhausted

#### Scenario: The ceiling is visible at a glance

- **WHEN** any capacity-bounded resource is displayed
- **THEN** both the current amount and the bounding capacity are shown, along with a proportional
  meter

### Requirement: Exhausted is a different state from exhausting

A resource resting at zero with no means of recovery SHALL be reported as a distinct state from
one that is falling toward zero, and SHALL NOT be shown with a countdown.

The simulation pins the net rate of a resource held against a boundary to exactly zero, which is
what makes that state stable rather than an endless sequence of microscopic crossings. A display
that divides the amount by that pinned rate would report a countdown of zero forever, and would
show the same colour for "you have ninety seconds to fix this" and "this has been broken for an
hour" — the two most different things the display can say.

#### Scenario: An exhausted resource reports no runway

- **WHEN** a resource is at zero and its net rate is not positive
- **THEN** its remaining runway is reported as absent rather than as zero, and it is shown in the
  exhausted state rather than the warning state

#### Scenario: Recovery leaves the exhausted state

- **WHEN** the player buys production that lifts a previously exhausted resource's net rate above
  zero
- **THEN** the resource leaves the exhausted state on the next display

## MODIFIED Requirements

### Requirement: The status display shows only what the current stage can still change

The persistent status display SHALL show only figures that remain meaningful in the current stage.
When a stage suspends the competition, every figure derived from it — the record, the season, the
standing, the audience and the trophy badge — SHALL be suppressed rather than frozen on screen,
and the space SHALL be reused by the figures that stage does change.

The condition SHALL be read from the stage's own resolved rules, not from the stage's ordinal, so
any stage or era that suspends the competition inherits the behaviour without a further change.

Space in this display is contested at the target phone width, so a stage introducing new figures
SHALL swap them for suppressed ones rather than appending. Figures that remain true in every stage
— elapsed time, the next scheduled event — SHALL persist across the swap.

#### Scenario: A frozen competition hides its own figures

- **WHEN** the current stage suspends the competition
- **THEN** the record, season, audience and trophy figures are absent from the display, rather
  than showing values that can no longer change

#### Scenario: The stage indicator is reused, not duplicated

- **WHEN** a stage suspends the competition and has a progression indicator of its own
- **THEN** that indicator occupies the slot the era indicator used, and both are never shown at
  once

#### Scenario: Unsuspended stages are untouched

- **WHEN** the current stage does not suspend the competition
- **THEN** every existing figure is displayed exactly as before, and no resource readout appears

#### Scenario: The display remains readable at the target width

- **WHEN** the display is rendered at the target phone width of 390px
- **THEN** no content scrolls the page horizontally
