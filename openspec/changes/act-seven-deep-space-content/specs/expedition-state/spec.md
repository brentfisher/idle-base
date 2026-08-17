## ADDED Requirements

### Requirement: A colonized site's upkeep is withdrawn from the stocks, not only claimed against the ration

A colonized site's upkeep — its colony base upkeep, plus its pad's upkeep scaled by that site's
distance factor — SHALL be counted BOTH in the demand the ration is solved against AND in the draw
withdrawn from the stocks each step. The two SHALL NOT diverge.

Counting upkeep in only one of the two produces a network that is billed in the denominator of the
ration and refunded in the numerator of the stock: satisfaction falls while the stocks behave as
though nothing were being consumed. Every downstream pacing number — time-to-empty, the boundary
clock, the rate the header reports — is then computed from a colony that does not exist, and no
build or assertion catches it because both halves are individually well-formed.

The draw SHALL be scaled by the same life-support draw multiplier that scales the demand, and SHALL
NOT be reduced by the load-follow throttle. A site is not a producer: it has no output to back off
from, and its consumption does not fall because a stock is near its ceiling. Throttling it would make
the network cheapest exactly when it is richest.

#### Scenario: A colonized site consumes what it claims

- **WHEN** a network holds generators, a colonized site and a pad on that site
- **THEN** the reported net rate of each resource equals gross production minus a draw that includes
  that site's and that pad's upkeep
- **AND** the net rate is strictly less than gross for every resource the site or pad consumes

#### Scenario: Upkeep does not back off when a stock is full

- **WHEN** a resource sits at its ceiling and its producers throttle back
- **THEN** the site and pad upkeep withdrawn from the stocks is unchanged

#### Scenario: An uncolonized site that has been reached costs nothing

- **WHEN** a site has been reached but not colonized
- **THEN** it contributes nothing to either demand or draw

### Requirement: Upkeep is derived from configuration on every read, never frozen into a save

A site record SHALL store only what the player did to that site. Its upkeep, its distance factor, its
production and its capability flags SHALL be resolved from configuration on every read.

Saves are never migrated in this codebase — a save whose version differs is discarded and there is no
migration function — so any value denormalized into a stored record is frozen at whatever it held the
day it was written. A balance correction to upkeep would then apply to new games only: invisible to
the person who made it, and permanent for the player who has been playing longest.

#### Scenario: A correction to upkeep reaches a save already in flight

- **WHEN** the configured upkeep of a site or a pad tier changes
- **THEN** an existing save reflects the new figure on its next tick, with no migration and no
  version bump

### Requirement: Starvation costs rate, never capability

No shortfall in any resource SHALL reduce how far a launch can reach, remove anything the player has
bought, or refuse a purchase the player can afford. A starved network SHALL launch later, never
shorter.

Reach is a function of the built pad tier alone. A reach that degraded under starvation would be
destruction with extra steps — and destruction that can occur while the player is asleep, which is
the one outcome an idle game may never produce.

#### Scenario: A network drained by a new site keeps its reach

- **WHEN** colonizing a site drives every net rate negative and the stocks drain
- **THEN** every previously legal destination remains legal, and every built pad retains its tier

#### Scenario: A fully starved network recovers by building

- **WHEN** every buffer is exhausted and the ration has collapsed
- **THEN** nothing owned has been removed, and adding one generator raises the ration
