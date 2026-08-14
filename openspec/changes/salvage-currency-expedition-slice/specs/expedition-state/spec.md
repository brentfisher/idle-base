## ADDED Requirements

### Requirement: The expedition slice holds the odyssey's capacity-bounded consumables

Game state SHALL carry a single top-level expedition slice holding the odyssey's progression phase,
its four capacity-bounded consumable resources (Power, Oxygen, Provisions and Fuel), and the
collections the odyssey accumulates: owned modules, reached sites, puzzle progress, active contracts
and launch records. Each resource SHALL be recorded as a current amount together with the capacity
that bounds it, so a resource can be full as well as empty.

These consumables SHALL NOT be currencies. A currency is monotonic, spendable and displayed as a
header chip; a consumable is filled and drained against a ceiling and can carry a negative net rate.

#### Scenario: A new game starts with an empty expedition

- **WHEN** a new game is created
- **THEN** the expedition slice is present with every collection empty, every resource at zero, and
  the initial phase set

#### Scenario: Fuel begins with no tank

- **WHEN** a new game is created
- **THEN** Fuel's capacity is zero, distinct from a resource that has a tank which happens to be
  empty, so no Fuel can be stored until a tank is built

### Requirement: The expedition slice is readable when absent from a save

Every read of the expedition slice SHALL go through a defaulting accessor that returns a complete,
fully-shaped expedition. The accessor MUST tolerate the slice being entirely absent, being an empty
object, or carrying only some of its keys, and MUST NOT mutate what it is handed.

Saves are never migrated: a version mismatch discards the save. Introducing this slice therefore
MUST NOT change the save version, and a save written before the slice existed MUST load and continue
to play.

#### Scenario: Loading a save written before the expedition existed

- **WHEN** a save from any earlier act, carrying no expedition slice, is loaded
- **THEN** the save is accepted rather than discarded, the expedition reads as a complete empty
  expedition, and the simulation continues to advance normally

#### Scenario: Loading a save carrying a partially populated expedition

- **WHEN** the slice is present but missing keys added after that save was written
- **THEN** the accessor supplies the missing keys at their defaults and preserves the stored values
  of the keys that are present, including a stored capacity of zero

#### Scenario: A resource key missing from a stored save

- **WHEN** the stored resources record omits one of the four resources
- **THEN** the accessor still returns all four, so no reader has to guard a resource lookup
