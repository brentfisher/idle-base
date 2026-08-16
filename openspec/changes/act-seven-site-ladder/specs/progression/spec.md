## ADDED Requirements

### Requirement: The expedition phase has exactly one writer

The act's phase SHALL be written by exactly one module. Other modules MAY supply the pure predicates
that decide a phase and MAY read the resulting value, but SHALL NOT write it.

Parallel per-phase milestone flags SHALL NOT be introduced alongside the phase field. Two sources of
truth for how far into the act a run has progressed is a race that surfaces only on a real save,
where one of the two is always the one a given gate happens to read.

#### Scenario: A consumer reading the phase does not write it

- **WHEN** a feature gate or reveal consults the phase
- **THEN** it reads the stored value and no write occurs from that path

### Requirement: The phase is stored but recomputed every step, and self-heals

The phase SHALL be recomputed from a pure predicate ladder on every simulation step and written back
only when the computed value differs from the stored one.

This is the compromise between a stored field and a purely derived one, and it buys a specific
property: an old save, a hand-edited save, or a save that crossed a boundary during a long offline
catch-up all converge to the correct phase on the next step without a migration.

The recomputation SHALL select the **highest-ranked** phase whose predicate holds, scanning from the
top of the ladder downward, rather than stopping at the first unsatisfied predicate. The predicates
are not guaranteed to be nested, so a save satisfying a later phase but not an earlier one would be
pinned at the initial phase forever by a first-failure scan. Selecting the highest satisfied rung
means a save can under-report its progress for a single step and never permanently.

The initial phase SHALL be the fallback rather than a tested condition — the run is in the initial
phase until it is demonstrably not.

#### Scenario: A hand-edited phase is corrected

- **WHEN** a save stores a phase later than its predicates support
- **THEN** the next step rewrites it to the highest phase whose predicate holds

#### Scenario: A non-nested save is not pinned

- **WHEN** a save satisfies a later phase's predicate but not an earlier one
- **THEN** the later phase is selected rather than the run being held at the initial phase

#### Scenario: An unchanged phase writes nothing

- **WHEN** the recomputed phase equals the stored phase
- **THEN** state is returned by identity and nothing is written

### Requirement: Phase gates compare rank and never equality

Every gate keyed on the phase SHALL be expressed as "at least phase P" rather than "is phase P".

Content revealed at a phase must remain available afterwards. A rung that vanished from under a
player the moment they progressed past it would be a ladder nobody could climb; early purchasable
rows in particular must stay purchasable for the rest of the act.

#### Scenario: Early content survives later phases

- **WHEN** the run advances beyond the phase that revealed a row
- **THEN** that row remains listed and purchasable

### Requirement: Phase boundaries are declared as data

Which phase a destination grants, and whether it grants on arrival or on departure commitment, SHALL
be declared on the destination in configuration rather than by naming destination identifiers in the
phase logic. The writer SHALL be a loop over the declared phase sequence.

A phase granted on **arrival** turns when the destination is reached. A phase granted on **departure
commitment** turns when a departure toward that destination is committed, not when it lands, so that
a long dead transit is budgeted to the phase it opens rather than the one it closes — the closing
phase would otherwise pay for a stretch in which nothing about it is happening.

The commitment predicate SHALL turn on the existence of the departure record rather than on its
resolved state, which makes it monotone: the phase cannot fall back when the departure resolves, and
nothing needs a second definition of what "in flight" means.

#### Scenario: Adding a phase-granting destination requires no logic change

- **WHEN** a destination declares that it grants a phase
- **THEN** the phase turns on that destination without any identifier appearing in the writer

#### Scenario: A phase granted on commitment does not fall back on arrival

- **WHEN** a departure granting a phase is committed and later resolves
- **THEN** the phase holds across both, without regressing

### Requirement: The phase writer abstains outside its act

The phase writer SHALL return the state it was given by identity when the run has no destinations,
which is every save before the act that introduces them.

Without this the writer would materialise an expedition slice into every save in existence on its
first step, including acts that have no use for one. A compile or bundle step cannot detect this.

For the same reason, resolution of destinations SHALL be gated on the same unlocked feature that
gates the act's currency faucet, and the colony's threshold boundary SHALL abstain only when there
are neither modules nor destinations — abstaining on modules alone would withhold a boundary it
exists to report.

#### Scenario: A pre-act save is untouched

- **WHEN** the phase writer runs against a save from an earlier act
- **THEN** the same state object is returned and no expedition slice is created
