## ADDED Requirements

### Requirement: The module catalogue is authored data with a published measurement

The set of buildable modules SHALL be authored configuration, not logic. Every rate, base cost and
growth exponent SHALL live in that configuration; no such number may appear in the simulation or in
a component.

A module's price SHALL grow geometrically with the number of copies already owned, in the same
shape the rest of the game already uses for repeatable purchases, and SHALL be rounded once at the
boundary so the price shown, the affordability check and the debit are the same integer.

The catalogue SHALL carry, alongside the rows, the measured result of driving them: the time to the
first automation by manual input alone, the share of income the manual click represents at stated
points, the phase's flat point, and the unlock that relieves it. Where a measurement fails to meet
its target, the catalogue SHALL record the failure and the reason rather than omitting it.

#### Scenario: A partial catalogue is inert, not broken

- **WHEN** the catalogue holds rows for only some phases
- **THEN** phases with no rows produce nothing, solve to zero rates, and leave the simulation
  provably unchanged for saves that never reach them

#### Scenario: A price is the same number everywhere it appears

- **WHEN** a module's price is shown, checked for affordability, and charged
- **THEN** all three are the identical integer

### Requirement: Currency production is recorded separately from resource production

A module's production of the spendable currency SHALL be recorded under a key distinct from its
production of capacity-bounded resources. The currency is monotonic and spendable; the resources
fill and drain against a ceiling. A reader iterating a module's resource production MUST NOT
encounter the currency.

#### Scenario: The currency is never treated as a bounded resource

- **WHEN** any consumer iterates a module's declared resource production
- **THEN** the spendable currency does not appear in that iteration, and no ceiling, net rate or
  boundary clock is ever computed for it

### Requirement: Module purchase follows the shop contract

The module shop SHALL expose a listing that returns presentation-ready rows with price, quantity
owned and affordability already resolved, and a purchase operation returning either new state or a
refusal. The rendering layer SHALL recompute none of it and SHALL decide nothing about
availability, price or affordability.

Purchase SHALL be refused — as a refusal, not an error — for an unknown module, one whose phase the
run has not reached, or one the player cannot afford. Every debit SHALL pass through the wallet, so
no currency can fall below zero structurally rather than by a check at the call site.

A row's stated effect SHALL be derived from the same authored rates the simulation reads, so the
shop cannot advertise a number the simulation does not honour.

#### Scenario: An unaffordable purchase changes nothing

- **WHEN** the player attempts to buy a module costing more than they hold
- **THEN** the purchase is refused and the state is unchanged

#### Scenario: Spending everything leaves zero, never less

- **WHEN** the player buys a module costing exactly their balance
- **THEN** the purchase succeeds and the balance is zero

#### Scenario: Buying a copy raises the price of the next

- **WHEN** the player buys a copy of a module
- **THEN** the listed price of the next copy is the authored growth factor higher

### Requirement: Module availability is a phase rank that fails open

A module SHALL become available when the run has reached **at least** the phase it names, and SHALL
remain available in every later phase — a ladder whose lower rungs disappear is one a returning
player cannot climb.

Availability SHALL fail open at both edges: a module naming no phase, and a run whose recorded
phase is unrecognized, SHALL both be treated as available. The recorded phase is self-healing and
is recomputed each simulation step, so an unrecognized value is a corrupt save one step from
repair; withholding the only place the currency can be spent for that step is the one failure this
gate must never cause.

Modules the run has not reached SHALL be omitted from the listing entirely rather than shown
disabled.

#### Scenario: Early modules stay buyable later

- **WHEN** the run has advanced several phases past a module's stated phase
- **THEN** that module is still listed and still purchasable

#### Scenario: A corrupt phase does not empty the shop

- **WHEN** the recorded phase is not one the configuration knows
- **THEN** every module is listed, rather than none

#### Scenario: Unreached modules are not teased

- **WHEN** the run has not reached a module's stated phase
- **THEN** that module does not appear in the listing at all
