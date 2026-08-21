## ADDED Requirements

### Requirement: The ladder of places and the list of purchases are presented from separate sources

A screen presenting a progression ladder of places SHALL render the ladder and the purchasable rows
from two separate accessors, and SHALL NOT derive either from the other.

The two answer different questions. The ladder is "where am I" and includes places with a build
already running and places the player has finished with; the purchase list is "what can I buy right
now". Filtering the ladder down to its buyable entries drops every place already established —
which, late in the progression, is all of them — and deriving the purchase list from the ladder
requires re-implementing every availability gate in the presentation layer, where it will disagree
with the purchase path the first time any gate changes.

Every place SHALL appear on the ladder in its authored order whatever its state, and a place not yet
reached SHALL be presented as a destination — with its name, its location and its description —
rather than as a locked, empty or errored row.

#### Scenario: A place already established still appears

- **WHEN** a place has been reached, established, and has nothing further to build on it
- **THEN** it is present on the ladder with its state shown, and absent from the purchase list

#### Scenario: A place not yet reached reads as a destination

- **WHEN** a place has not been reached
- **THEN** its name, location and description are rendered, and no availability gate is restated in
  the presentation layer

#### Scenario: A place with a build running

- **WHEN** a build is under way at a place
- **THEN** the ladder row names that build and shows the time remaining, and the place offers no
  further purchase until it completes

### Requirement: A purchase carrying a permanent running cost states that cost before what it buys

Where establishing or upgrading a place imposes a permanent draw on a shared pool, the purchasable
row SHALL state that running cost **before** the capability the purchase unlocks, and SHALL NOT
present the running cost with less visual emphasis than the row's descriptive text.

Ordering alone is not sufficient and neither is emphasis alone. A row that leads with the running
cost but renders it in the same de-emphasised style as flavour text has buried it without moving it;
a row that emphasises it but places it last has moved it without leading with it. The purpose is to
make expansion a decision rather than a purchase, and a player who cannot see the recurring cost at
the moment of pressing the button has not been given that decision.

#### Scenario: A row for a cheap place with a ruinous running cost

- **WHEN** a place is inexpensive to establish and carries a high permanent draw
- **THEN** the draw is the first thing on the row after its name, and is rendered at full emphasis

#### Scenario: A one-off purchase elsewhere is unaffected

- **WHEN** a purchase's cost is paid once and does not recur
- **THEN** its row may open with what the thing is, because there is no ongoing cost to lead with

### Requirement: A capability set by a built structure is never presented as reduced by resource pressure

Where a capability is defined as a function of what the player has built and explicitly not of the
current supply of any resource, the presentation SHALL source that capability from the accessor that
computes it, SHALL NOT recompute it from the underlying stored value, and SHALL NOT provide any
dimmed, warned, degraded or conditional variant of it.

A starved network is throttled and never diminished: it acts later, never less far. Resource
starvation can arrive during an offline catch-up as readily as during play, so a capability
presented as degraded by supply would be telling the player that closing the tab took something away
from them. Recomputing the capability in the presentation layer additionally creates a second
implementation of the same mapping, which is the class of defect the write path already refuses.

A capability figure SHALL be omitted entirely, rather than shown as zero, where no structure
providing it has been built.

#### Scenario: The colony is starving

- **WHEN** every resource is rationed and every net rate is negative
- **THEN** the capability figure is unchanged and carries no warning or dimming of any kind

#### Scenario: No structure has been built

- **WHEN** a place has no structure providing the capability
- **THEN** no capability figure is rendered for it, rather than a figure of zero

### Requirement: A running cost shown to the player is the running cost the simulation charges

A figure presented as a recurring cost SHALL be resolved through the same function the simulation
charges through, and SHALL NOT be computed in the presentation layer from its constituent parts.

Where a cost is a base rate scaled by a per-place factor, that multiplication has exactly one
implementation. A second one written in the presentation layer agrees on the day it is written and
diverges the first time the scaling rule changes, producing a screen that advertises a price the
simulation is not charging — the single failure this screen exists to avoid.

Costs that scale by different rules SHALL be presented as separate labelled lines rather than
summed, because the difference between them is the mechanical content of the scaling factor.

Recurring costs SHALL be shown only where they are actually charged. Where the simulation begins
charging on establishment, a place that has been reached but not established SHALL show no recurring
cost, and the figure the player needs in order to decide SHALL instead appear on the purchasable row.

#### Scenario: The screen and the simulation agree

- **WHEN** a place is established with a structure whose cost is scaled by that place's factor
- **THEN** the rates rendered for it equal the change in the simulation's demand for that place

#### Scenario: Reached but not established

- **WHEN** a place has been reached and not yet established
- **THEN** no recurring cost is shown on its ladder row, and its purchasable row leads with that
  cost

### Requirement: A shared pool is never presented as a per-place stockpile

Where the progression uses a single shared resource pool rather than one pool per place, the ladder
SHALL present per-place rates only, SHALL NOT render a stock-against-capacity meter on a place, and
SHALL state the single-pool rule in words rather than relying on the absence of a meter to imply it.

A list of places each showing quantities is the shape a player reads as a set of stockpiles. The
absence of a bar is not a statement; a sentence is.

#### Scenario: Several places are established

- **WHEN** more than one place is established and drawing on the pool
- **THEN** each shows its rates, none shows a stock meter, and the shared-pool rule is stated on the
  screen

### Requirement: Both empty states are rendered as authored sentences

A screen whose ladder or whose purchase list can legitimately be empty SHALL render its section
heading and an authored sentence in that state, rather than omitting the section.

Both empty states are reachable and neither is an error: the purchase list is empty whenever nothing
new is within reach, which includes the whole of the progression's opening, and the ladder is empty
on every save that has not entered the act. A section that disappears when it is empty teaches the
player that the screen sometimes has a lower half and sometimes does not; a sentence that explains
what would populate it is a direction to go.

The sentence for an empty purchase list SHALL remain true both before anything has been reached and
after everything has been built.

#### Scenario: Nothing is within reach

- **WHEN** no place is reachable and no structure is buildable
- **THEN** the purchase section renders with its heading and its authored sentence, and no rows

#### Scenario: A save that has not entered the act

- **WHEN** the ladder resolves to no places at all
- **THEN** the ladder section renders its authored sentence, the screen does not throw, and no place
  is named

#### Scenario: A save missing the act's state entirely

- **WHEN** the save carries no state slice for the act
- **THEN** the screen renders from defaults and the save is not given a slice as a side effect of
  rendering

### Requirement: Time remaining and other clock-derived figures are resolved outside the presentation layer

A figure derived by comparing a stored timestamp against the simulation clock SHALL be resolved
where the clock is already guarded, and SHALL NOT be computed in the presentation layer.

A stored clock is a value from a file on the player's disk. Every clock read in the simulation
guards for a non-finite value because a non-finite number reaching a rate propagates into the
advance loop and freezes the run permanently, with no play that repairs it. A subtraction written in
the presentation layer skips that guard.

An unrecognized build identifier SHALL render as work under way rather than as its raw identifier,
and SHALL NOT be presented as an error.

#### Scenario: A save with a corrupt clock

- **WHEN** the stored clock is not a finite number
- **THEN** the time remaining renders as a duration rather than as a non-finite value

#### Scenario: A build identifier nothing answers to

- **WHEN** a place stores a build identifier no definition matches
- **THEN** the row shows that work is under way with its time remaining, and never shows the raw
  identifier
