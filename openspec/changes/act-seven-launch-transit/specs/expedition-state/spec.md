## ADDED Requirements

### Requirement: A committed departure always arrives and never forfeits its spend

The outcome of a committed departure SHALL be fully determined at the moment of commitment. No
randomness SHALL enter the departure, transit or arrival path, and a departure SHALL NOT be capable
of failing, falling short, or returning less than it promised.

Simulation runs identically live and during an offline catch-up, so any randomness inside it is
resolved while the player is absent — producing an outcome they cannot see, influence or audit, and
which is indistinguishable from a defect. Penalising a player for stopping playing is the one
outcome an idle game may never produce.

Where a meaningful choice exists it SHALL be presented at commitment time, when the player is
present, and its consequences SHALL be a pure function of state observable before committing.

#### Scenario: The same commitment always yields the same arrival

- **WHEN** the same state commits the same departure twice
- **THEN** both produce an identical arrival time and identical grants

#### Scenario: An offline return never loses a committed departure

- **WHEN** a player commits a departure and returns after a long absence
- **THEN** the departure has arrived, with the full effect promised at commitment

### Requirement: Committing spends the entire held reserve, not the threshold

Committing a departure SHALL consume the whole of the gating resource held at the origin, not merely
the threshold required. No remainder SHALL be returned.

The reserve's ceiling is a fixed multiple of the departure threshold, so a player may bank a surplus
before committing. Spending only the threshold would make that surplus a leftover and banking it
pointless; spending all of it makes the surplus a decision — depart now, or depart later and further
for the same act of waiting.

The benefit of the surplus SHALL be a deterministic function of the ratio of the amount held to the
threshold, with no stored state of its own, so the trade is legible before it is taken and
reproducible afterwards.

#### Scenario: Banking above the threshold shortens the transit

- **WHEN** a player commits holding more than the threshold
- **THEN** the transit is shorter and any arrival grant larger, in proportion to the ratio held

#### Scenario: No change is returned

- **WHEN** a departure is committed
- **THEN** the origin's held reserve is zero afterwards

### Requirement: Thresholds are read from the destination ladder, never restated

The departure engine SHALL read each threshold from the site configuration that declares it, and
SHALL NOT define its own copy of any threshold.

The reserve ceiling at each site is derived as a fixed multiple of that site's departing threshold.
A second, independently authored copy of the threshold would let a retune move one and not the
other, which silently collapses the overshoot band the derivation exists to guarantee.

The threshold declared at a site SHALL be understood as the threshold of the departure *leaving*
that site, not one arriving at it.

#### Scenario: Retuning a threshold moves the band with it

- **WHEN** a site's departing threshold is changed in configuration
- **THEN** both the departure requirement and the reserve ceiling change together

### Requirement: Arrival is recorded through the ladder's single writer

Arrival SHALL mark its destination reached by calling the site engine's exported writer rather than
by modifying a site record directly, so that site records retain exactly one author.

That writer SHALL be idempotent and return state unchanged when the destination is already reached,
because arrival resolution is replayed on every catch-up and a second call must be a no-op rather
than a second assertion of the same fact.

#### Scenario: A replayed arrival does not re-mark the destination

- **WHEN** arrival resolution runs again against a state whose destination is already reached
- **THEN** state is returned unchanged

### Requirement: In-flight and completed departures are one list

A departure SHALL be recorded as a single entry carrying its destination and a resolved flag. An
unresolved entry is a departure under way; the same entry resolved is that departure afterwards.
There SHALL NOT be separate collections for in-flight and historical departures.

Predicates that turn on a departure having been committed SHALL key on the entry **existing** rather
than on its resolved state, which keeps them monotone: progression cannot fall back at the moment a
departure lands, and nothing needs a second definition of "in flight".

#### Scenario: Progression does not regress when a departure resolves

- **WHEN** a departure that grants a progression phase resolves
- **THEN** the phase granted at commitment still holds afterwards

### Requirement: Departure resolution is idempotent and abstains cleanly

Resolution SHALL complete only entries whose arrival time has passed and SHALL return the state
object it was given by identity when nothing was due.

The arrival wake boundary SHALL return positive infinity when nothing is pending — never zero, null
or undefined — because a zero boundary pins the simulation step and exhausts the iteration safety
cap without advancing the clock, discarding the remainder of a returning player's elapsed time. It
SHALL guard its own slice so that acts without an expedition pay nothing.

Resolution SHALL run before progression is recomputed within the same iteration, because an arrival
is an input to the progression predicate; resolving afterwards leaves a returning player one
iteration behind the rung they occupy.

#### Scenario: Nothing pending yields no boundary

- **WHEN** no departure is in flight
- **THEN** the contributor returns positive infinity and resolution returns state by identity

#### Scenario: A long return resolves each arrival exactly once

- **WHEN** a catch-up spans one or more arrivals
- **THEN** each resolves once, in clock order, and re-running the same span changes nothing

### Requirement: At most one departure is in flight, as a consequence of the ladder

The only legal destination SHALL be the lowest unreached rung. A second concurrent departure is
therefore not merely disallowed but has nowhere to go, and the restriction SHALL be enforced as a
single refusal check rather than by a queue or scheduler that could disagree with the ladder.

#### Scenario: A second departure is refused while one is in flight

- **WHEN** a departure is committed and another is attempted
- **THEN** the second is refused and state is unchanged

### Requirement: The gating resource is spent through the colony, not the wallet

The departure spend SHALL be debited through the expedition's own resource path, because the gating
resource is a colony consumable rather than a wallet currency.

Routing it through the wallet would place a consumable in a ledger with different clamping and
different reporting, so the header, the panel and the engine could disagree about how much of it
exists. Commitment spends an amount the player provably holds, so no path here can drive a resource
below zero.

#### Scenario: Committing does not touch the wallet

- **WHEN** a departure is committed
- **THEN** every wallet currency is unchanged and only the expedition resource is reduced
