## ADDED Requirements

### Requirement: The terminal destination is not a place, and requires no second kind of reach

The final departure SHALL target a destination that has no record, no establishment cost and no
arrival effects, and SHALL be gated by the SAME single reach comparison that gates every earlier
departure.

Reach is one comparison — the capability built at the origin against the ordinal of the destination
— and introducing a distinct flag for the terminal case would make it two. The terminal destination
SHALL therefore present the same minimal shape every other destination presents, so that listing,
gating, pricing and committing traverse one code path with no special case.

The terminal ordinal SHALL be derived from the length of the destination ladder rather than written
as a literal, so that extending the ladder moves the terminus with it.

Arrival at the terminal destination SHALL require no special handling: existing lookups that find no
matching place SHALL abstain on their own guards, granting nothing.

The terminal departure SHALL be offered at most once per run, determined from the departure log
rather than from the achievement record.

#### Scenario: The terminal departure is gated by built capability alone

- **WHEN** the origin's built capability is below the terminal ordinal
- **THEN** the departure is refused with a reason naming the capability to build

#### Scenario: Arrival grants nothing and breaks nothing

- **WHEN** the terminal departure resolves
- **THEN** no place is marked reached and no grant is paid, and the operation completes normally

#### Scenario: The terminal departure cannot be committed twice

- **WHEN** the terminal departure has already been committed
- **THEN** no departure is offered thereafter

### Requirement: The run's final standing is deterministic, itemized and computed from the run

The run's final standing SHALL be a pure function of the run's recorded history, with no randomness
of any kind, so that the same save produces the identical standing on every evaluation and across
reloads.

Its inputs SHALL be quantities the player influenced: elapsed time within the act, how each puzzle
was resolved (unaided, assisted, or exhausted), completed optional contracts, the best production
rate the network reached, and the commitment margins chosen across the run's departures.

The standing SHALL be returned as an ITEMIZED account, not an opaque score. Each input SHALL carry
its own contribution in the same unit as the final result, and the contributions SHALL sum exactly
to it, so that the player can audit the final screen against their own run.

Elapsed time SHALL be measured to the moment the act was won, not to the present, so that a finished
run's standing does not change while the player idles afterwards.

Where an input's history was never recorded, the standing SHALL report it as unrecorded and score it
at zero rather than estimating a value.

#### Scenario: The same run always produces the same standing

- **WHEN** a finished run's standing is evaluated twice
- **THEN** both evaluations produce identical placements, contributions and text

#### Scenario: The itemization reconciles

- **WHEN** the standing is computed
- **THEN** the listed contributions sum exactly to the reported result

#### Scenario: A finished standing does not drift while idle

- **WHEN** an arbitrary interval passes after the act is won, with no further purchases
- **THEN** the standing is unchanged

### Requirement: The terminal stage is a post-game state, not a new content area

Reaching the terminal stage SHALL leave every existing system running: established places remain
live, their upkeep continues to be charged, and the manual income action remains available.

The terminal stage SHALL offer an endless, repeatably purchasable commitment that consumes both the
wallet currency and the capped consumable, and whose accumulated count feeds back into the run's
final standing so the tail advances the player rather than merely absorbing surplus.

The uncapped currency's price MAY compound without limit. The capped consumable's price SHALL be
bounded below the maximum the player can hold, so that the ladder can never become permanently
unaffordable — an unaffordable terminal ladder is a dead end in the only content the stage has.

Purchases spending two resources SHALL sequence the refusing debit first, so that a purchase which
cannot complete cannot consume one resource while granting nothing.

No reset, replay or prestige axis SHALL be introduced by this change.

#### Scenario: The endless ladder never becomes unaffordable

- **WHEN** the ladder is advanced arbitrarily far
- **THEN** the capped consumable's price remains within what the player can hold

#### Scenario: A refused purchase consumes nothing

- **WHEN** a purchase is attempted with one of the two resources insufficient
- **THEN** the purchase is refused and neither resource is consumed

#### Scenario: The post-game advances the standing

- **WHEN** commitments are filled in the terminal stage
- **THEN** the run's final standing improves accordingly

### Requirement: Reaching the terminal stage leaves the suspended league untouched

Entering or occupying the terminal stage SHALL NOT resume, reset, rebuild or delete the suspended
league simulation. Its records, standings, schedule and roster SHALL remain exactly as the
suspension left them.

The final standing is presented in the same layout as the league's own table and its rows are
deliberately shape-compatible with the league's records, which is precisely what makes accidental
reading from — or writing into — the suspended slice possible. The terminal stage's logic SHALL
therefore have no reference to the league's identifiers or writers at all, so that the guarantee is
structural rather than incidental.

#### Scenario: A long catch-up across the win leaves the league identical

- **WHEN** a catch-up spanning both the commitment and its resolution is simulated
- **THEN** the suspended league's records, standings, schedule and roster are unchanged

#### Scenario: Post-game purchases do not touch the league

- **WHEN** a terminal-stage commitment is filled
- **THEN** the suspended league is unchanged
