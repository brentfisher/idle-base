## ADDED Requirements

### Requirement: The odyssey's currency is manufactured, and its rate is rationed by the colony

The odyssey's spendable currency SHALL be produced by owned modules rather than found, and every
module producing it SHALL itself consume capacity-bounded resources. A player MUST NOT be able to
grow that income without also growing the supply that feeds it.

The produced rate SHALL be scaled by the same rationing factor the colony simulation solves for
that module's inputs. A module whose inputs are unmet MUST produce proportionally less currency,
and a module with no inputs met MUST produce none.

This is what prevents the odyssey degenerating into a single purchase repeated: without the second
cost, the producing module is a pure multiplier on a resource nothing competes for, and the
rationing solve has nothing to ration.

#### Scenario: A fed colony pays its full rate

- **WHEN** the colony's owned producers have all their input demands met
- **THEN** the currency accrues at the sum of those producers' authored rates

#### Scenario: A starved colony pays nothing

- **WHEN** a producing module's required inputs are exhausted
- **THEN** that module contributes zero currency for as long as its inputs remain unmet

#### Scenario: One rate, reported identically everywhere

- **WHEN** the rationing factor is below full
- **THEN** the rate credited to the wallet, the rate the colony integrates against, and any rate
  shown to the player are the same number, derived from a single solve

### Requirement: The odyssey income source is gated by an unlocked feature, not by a stage index

The odyssey's income source SHALL be suspended until the feature that grants access to it is
unlocked, and that unlock SHALL be recomputed from configuration on every read rather than stored.
Retuning when the odyssey's economy opens MUST take effect on an existing save with no migration.

While suspended, the source SHALL contribute zero without performing the colony solve at all.

#### Scenario: Stages before the odyssey earn nothing from it

- **WHEN** the player is in any stage before the odyssey
- **THEN** the odyssey currency accrues at zero and no colony solve is performed

#### Scenario: The source is live from the moment the player can build

- **WHEN** the player enters the odyssey's opening phase
- **THEN** the income source is active, so the first module purchased begins paying immediately

## MODIFIED Requirements

### Requirement: The manual click pays a stage-authored amount

The manual click SHALL pay an amount authored by the current stage. A stage MAY declare a **flat**
per-press value, which SHALL replace the accumulated per-click calculation entirely rather than
scaling it. A stage that declares no flat value SHALL behave exactly as before, with the
accumulated value and any stage multiplier applied unchanged.

A flat value is required wherever the click is the player's only income for a meaningful opening
stretch: the accumulated per-click value varies by more than an order of magnitude between two
players who have reached the same stage, and an opening built on one button cannot tolerate that
spread. The difference between two minutes to a first automation and three seconds is the
difference between an opening and a cutscene.

The click SHALL remain ungated in every stage — a cooldown is a rate limit and is acceptable, a
gate is not. This is the guarantee that any state is recoverable in bounded time.

#### Scenario: A stage declaring a flat value pays it to everyone

- **WHEN** the player presses the click in a stage declaring a flat per-press value
- **THEN** the amount paid is that value, identical for every player regardless of accumulated
  per-click upgrades

#### Scenario: Stages without a flat value are unaffected

- **WHEN** the player presses the click in any stage that declares no flat value
- **THEN** the amount paid is the accumulated per-click value times the stage multiplier, exactly
  as before

#### Scenario: The flat click is never upgraded

- **WHEN** the player progresses through the odyssey
- **THEN** the click's value does not change; every improvement to income is a module purchase
  instead
