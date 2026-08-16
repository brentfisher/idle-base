## ADDED Requirements

### Requirement: Destinations form a strictly ordered ladder that cannot be skipped

The expedition SHALL present its destinations as an ordered sequence of rungs. A destination becomes
available only in rung order, so the legal target of any departure is always the lowest unreached
rung. "One departure in flight at a time" SHALL therefore be a consequence of the ordering rather
than a rule enforced separately.

Ladder order SHALL be taken from configuration, never from the order records happen to appear in a
save, so a reordered or hand-edited collection cannot change the ordering the whole progression
rests on.

#### Scenario: The next rung is the only destination offered

- **WHEN** the player has reached rung N and not rung N+1
- **THEN** rung N+1 is the only destination that may be targeted, and no higher rung may be

#### Scenario: A reordered save does not reorder the ladder

- **WHEN** a save holds its destination records in an order that differs from configuration
- **THEN** the ladder is presented in configured order and progression is unaffected

### Requirement: A destination record stores only what cannot be derived

A stored destination record SHALL carry its identifier, whether it has been reached, whether it has
been colonized, its built platform tier, the identifier of any build in progress, and that build's
completion time — and SHALL NOT store anything derivable from configuration.

Rung, upkeep, production, capability flags, capacity grants and every cost SHALL be resolved from
configuration on each read. This codebase does not migrate saves, so a denormalized value is frozen
at the moment it was written and a retune would reach new saves while silently skipping existing
ones.

A destination that is reached and colonized before the act begins SHALL require no stored record at
all, its initial state being declared in configuration.

#### Scenario: A balance change reaches an existing save

- **WHEN** a destination's upkeep or capacity grant is retuned
- **THEN** an existing save reflects the new value on its next simulation step, with no migration

#### Scenario: The starting destination exists without a record

- **WHEN** a fresh save carries an empty destination collection
- **THEN** the starting destination is still reached, colonized and carries its starting platform

### Requirement: Destination records are read strictly and a corrupt build reads as idle

The reached, colonized and in-progress fields SHALL be interpreted by exact boolean comparison
rather than by truthiness, because these values arrive from a save file and every truthy non-boolean
is corruption. Nothing in the act can un-reach a destination, so a wrongly-granted arrival is
unrecoverable by play.

A record carrying a build identifier without a finite completion time SHALL be treated as having no
build at all. That pairing is load-bearing: the identifier is what makes a site busy and the
completion time is what makes it finish, so a record with one and not the other is permanently
occupied and can never complete — a soft-lock on that rung and every rung above it. Reading the pair
as idle converts a corrupt save into a lost build rather than a dead run.

#### Scenario: A mangled reached flag does not grant arrival

- **WHEN** a save carries a non-boolean truthy value in the reached field
- **THEN** the destination is treated as unreached

#### Scenario: A build with no completion time does not strand the site

- **WHEN** a save carries a build identifier with no finite completion time
- **THEN** the site is treated as idle and may start a new build

### Requirement: One build per destination at a time

A destination SHALL have at most one build in progress. Colonization and platform construction SHALL
share the single build slot and the single completion time.

This bounds the number of pending completion boundaries to the number of destinations, so a long
offline return contributes at most one wake boundary per destination rather than one per build.
Owning more destinations SHALL therefore increase build throughput, making expansion a reason to
expand.

#### Scenario: A busy destination offers nothing

- **WHEN** a destination has a build in progress
- **THEN** no further build is offered for it and any purchase targeting it is refused

#### Scenario: Separate destinations build in parallel

- **WHEN** two colonized destinations each start a build
- **THEN** both progress simultaneously and both may complete within a single step

### Requirement: Build resolution is idempotent by construction

Completing a build SHALL clear both the build identifier and the completion time, so that replaying
the resolution finds nothing to do. Resolution SHALL return the state object it was given by
identity when nothing completed.

Simulation runs identically live and on load, differing only in elapsed time, and a single offline
iteration may span many hours. A resolution keyed on elapsed windows rather than on pending records
would colonize a destination twice on a long return, or grant two platform tiers, or debit nothing
and grant everything.

A completed platform build SHALL take its tier from the stored build identifier rather than by
incrementing the current tier, so that a hand-edited save or a future grant by another route cannot
produce an off-by-one capability. An unrecognized build identifier SHALL grant nothing and be
cleared, costing the player the spend rather than stranding the destination permanently.

#### Scenario: A replayed resolution changes nothing

- **WHEN** build resolution runs twice against the same state
- **THEN** the second call returns the first call's state by identity

#### Scenario: An eight-hour return completes each build exactly once

- **WHEN** a catch-up spans several build windows
- **THEN** each pending build completes once and grants its effect once

#### Scenario: An unrecognized build is cleared rather than stranded

- **WHEN** a save carries a build identifier matching no known build
- **THEN** the slot is cleared, nothing is granted, and the destination may build again

### Requirement: The build wake boundary abstains rather than returning zero

The earliest pending completion SHALL be published to the simulation's wake-boundary contributor
list, returning positive infinity when nothing is pending — never zero, null or undefined. A zero
boundary pins the simulation step at zero and exhausts the iteration safety cap without advancing
the clock, silently discarding the remainder of a returning player's elapsed time.

Completion times already in the past SHALL be excluded from the boundary. Such a record is not a
future event, and proposing it costs an iteration on a step of nothing even though resolution clears
it in the same pass.

The contributor SHALL guard its own slice and return infinity for every save that has no
destinations, so acts without an expedition pay nothing.

#### Scenario: Nothing pending yields no boundary

- **WHEN** no destination has a build in progress
- **THEN** the contributor returns positive infinity

#### Scenario: An overdue build does not propose a zero-length step

- **WHEN** a pending build's completion time is already in the past
- **THEN** it is excluded from the boundary and resolution clears it in the same pass

### Requirement: Reach is a function of built platform tier alone

How far a departure may travel SHALL be determined solely by the platform tier actually built at the
point of departure, and SHALL NOT depend on current resource satisfaction, stock levels or any rate.

A starved network SHALL depart later, never shorter. A capability that degraded under starvation
would be destruction with extra steps, and it would arrive while the player was away — starvation
occurs during an offline catch-up as readily as during play. A player returning to find a departure
they spent a session preparing for is no longer legal has been punished for stopping playing.
Starvation costs rate; it never costs capability.

Exactly one platform tier SHALL be buildable at a given rung, so a player cannot buy a platform
reaching a rung they may not legally travel to and take on permanent upkeep for no capability.

#### Scenario: A starved colony retains its reach

- **WHEN** the colony's resources are pinned at zero and every rate is throttled
- **THEN** every destination's reach is unchanged

#### Scenario: A rung offers only its own tier

- **WHEN** the player views buildable platforms at a colonized destination
- **THEN** exactly one tier is offered, and it reaches exactly the next rung

### Requirement: Departure capacity is derived from the departing threshold

Each destination's fuel capacity grant SHALL be computed as a fixed multiple of the threshold of the
departure that *leaves* that destination, rather than authored as a separate value.

The overshoot band must be structural rather than a coincidence between two independently tuned
tables: authored twice, a retune moves one and not the other and the depart-now-or-hold decision
silently stops existing. Authored once and multiplied, it cannot drift.

The starting destination's grant SHALL be withheld until the player owns storage for that resource.
The starting destination is reached at time zero, so an ungated grant would supply departure
capacity from the first second of the act and allow the first threshold to be crossed well before
its intended beat, taking that time from the phase it belongs to.

#### Scenario: Every destination's tank matches its departing threshold

- **WHEN** any destination's grant is compared against the threshold of the departure leaving it
- **THEN** the grant is exactly the configured multiple of that threshold

#### Scenario: The gating resource cannot be banked before the first tank

- **WHEN** the player owns no storage for the departure-gating resource
- **THEN** its ceiling is zero, and buying the first tank raises it by the tank's grant plus the
  starting destination's withheld grant together

### Requirement: Colonization and platforms are purchased through the shared shop contract

Destination purchases SHALL be offered through the same contract as other purchasable rows —
listing, purchase, resolution and wake boundary — with cost, ownership and affordability resolved
before presentation so no consumer recomputes them.

Every gate SHALL be re-checked at purchase using the same predicate the listing used, because a rule
enforced only where the button is drawn is not enforced. Refusal SHALL be signalled by returning
nothing rather than by raising, so an action the player could not have taken through the interface
is a no-op.

Unavailable rows SHALL be omitted from the listing rather than shown disabled, matching the
established rule that locked content is not rendered at all.

The presented effect SHALL lead with the permanent upkeep the purchase imposes, because expansion is
intended as a decision rather than a purchase, and the decision is the permanent draw on the shared
pool. A destination that is deliberately cheap to establish and ruinous to sustain SHALL make that
visible before purchase.

Listing "where the player is" and listing "what may be bought now" SHALL be separate operations,
because neither is derivable from the other without losing information the player is looking at.

#### Scenario: A gate refused in the listing is refused at purchase

- **WHEN** a purchase is submitted for a row the listing would not have shown
- **THEN** the purchase is refused and state is unchanged

#### Scenario: A malformed purchase identifier is refused

- **WHEN** a purchase is submitted with an identifier that does not parse
- **THEN** nothing is written and the purchase is refused

#### Scenario: An unreachable rung is not previewed

- **WHEN** the player views the listing during an early phase
- **THEN** rows for rungs not yet reachable are absent rather than shown disabled
