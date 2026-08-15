## ADDED Requirements

### Requirement: Resource ceilings are derived from owned storage, never stored

Every capacity-bounded resource's ceiling SHALL be recomputed from the player's holdings on each
read — a base value plus the sum of the grants declared by owned storage modules, plus, for the
resource that gates departures, the grants carried by reached destinations. A stored ceiling SHALL
NOT be treated as authoritative.

This is the same rule the unlocked-feature set follows, for the same reason: a stored ceiling is a
second source of truth, so retuning a storage grant would otherwise require migrating a save format
that has no migration path. Derived, a balance change takes effect on every existing save on the
next simulation step.

A recomputed ceiling can only equal or exceed what a save previously recorded, because the terms it
sums are the holdings that justified it. The integration step SHALL clamp every resource to its
ceiling unconditionally regardless, so even an inconsistent save yields a disappointing colony
rather than an impossible one.

The destination term SHALL be written even while no destination can yet be reached, summing over an
empty collection. Encoding one source now and discovering the second later is how a superseded
single-source design gets reintroduced by accident.

#### Scenario: Buying storage raises the ceiling immediately

- **WHEN** the player buys a storage module granting capacity for a resource
- **THEN** that resource's ceiling rises by the grant on the next read, with nothing written to
  state to make it so

#### Scenario: A stored ceiling does not override the derived one

- **WHEN** a save carries a recorded ceiling that disagrees with the player's storage holdings
- **THEN** the derived ceiling is used, and the resource is clamped to it

#### Scenario: The gating resource cannot be banked before its first tank

- **WHEN** the player owns no storage for the resource that gates departures
- **THEN** its ceiling is zero and any production is discarded by the clamp

### Requirement: Storage grants capacity and never a rate

A storage module SHALL declare a capacity grant and SHALL declare neither production nor
consumption. Its entire effect is on the clamp: it changes how long a surplus can be banked and how
much runway a deficit has before it pins, and changes no rate.

Storage SHALL be priced with a steeper growth exponent than any producer, because a producer bought
repeatedly multiplies a rate while a tank bought repeatedly buys only time — and time is worth
having only up to the length of a session.

#### Scenario: Owning only storage leaves every rate at zero

- **WHEN** the colony owns storage modules and nothing else
- **THEN** every resource's net rate is zero and only the ceilings differ from a bare colony

### Requirement: A module may require a quantity of other modules before it can be built

A module SHALL be able to declare prerequisites as quantities of other modules, and SHALL be
withheld from the listing and refused by purchase until they are met. The check SHALL be enforced
at purchase as well as in the listing, because a rule enforced only where the button is drawn is
not enforced.

This exists as a **pacing control that cannot be waited out**. Where a threshold must not be
reachable before a given point in a phase, price alone cannot hold it — a player who saves arrives
early regardless of cost. A prerequisite expressed as cumulative spend on individually worthwhile
purchases can only be reached by playing that far.

#### Scenario: The gated module is invisible below its prerequisite

- **WHEN** the player holds one fewer than a required quantity
- **THEN** the gated module does not appear in the listing, and purchasing it is refused

#### Scenario: Meeting the prerequisite opens the row

- **WHEN** the player reaches every required quantity
- **THEN** the gated module appears and is purchasable on ordinary affordability terms

### Requirement: A module may require a reached destination declaring a capability

A module SHALL be able to require that some reached destination declares a named capability, and
SHALL be withheld until one does. This mechanism replaces per-destination output multipliers, which
are incoherent with a single global resource pool: the colony sums a list and does not know how many
destinations exist.

This gate SHALL **fail closed** when no destination is recorded. That is deliberately the opposite
of the phase gate, which fails open: an unrecognized phase is a corrupt value one step from
self-repair, whereas an empty destination list is the accurate statement that nothing has been
reached. Failing open would offer the cheapest production in the game from the opening minute.

#### Scenario: Capability-gated modules are unbuyable before colonization

- **WHEN** no destination has been reached
- **THEN** every module requiring a destination capability is absent from the listing and refused by
  purchase, even in a phase that otherwise offers it

#### Scenario: Reaching a destination opens only what it declares

- **WHEN** a reached destination declares one capability but not another
- **THEN** modules requiring the declared capability become available and modules requiring the
  other remain withheld

## MODIFIED Requirements

### Requirement: A starved colony throttles and recovers, and destroys nothing

When demand for a resource exceeds supply, the colony SHALL ration every consumer of that resource
in proportion, SHALL pin the exhausted resource's net rate to exactly zero, and SHALL leave every
owned module in place. No module may be removed, no holding may go negative, and no state may be
made unrecoverable by running out of anything.

Rationing SHALL be **monotone in supply**: adding a single generator of the scarce resource SHALL
strictly improve the ration and everything downstream of it. There must be no configuration in
which adding supply leaves the colony no better off, because that is a local minimum a player
cannot reason their way out of.

Full recovery SHALL require the deficit to be genuinely covered. Restoring the ration to full is a
matter of arithmetic, not of a single purchase — the guarantee is that every step toward it helps.

#### Scenario: A starved colony keeps producing at a reduced rate

- **WHEN** a resource is exhausted and its consumers are rationed
- **THEN** those consumers continue to produce at the rationed fraction rather than stopping, and
  the exhausted resource's net rate is exactly zero

#### Scenario: Nothing is lost while starved

- **WHEN** the colony runs starved for a prolonged period
- **THEN** every owned module is still owned and no holding has gone negative

#### Scenario: One generator always helps

- **WHEN** the player adds a single generator of the scarce resource to a starved colony
- **THEN** the ration and every rate depending on it are strictly better than before

#### Scenario: Covering the deficit restores the colony fully

- **WHEN** the player adds enough production to meet demand
- **THEN** the ration returns to full, the resource refills to its ceiling, and dependent rates
  return to their unthrottled values
