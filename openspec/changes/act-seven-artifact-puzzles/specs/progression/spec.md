## ADDED Requirements

### Requirement: No artifact gates progress, and no stage transition depends on one

No artifact SHALL be a precondition of any stage transition. The conditions that advance the
expedition through its phases SHALL remain resource and site conditions only.

What an artifact grants SHALL be a capability or the removal of a recurring cost, never raw progress.
For every artifact there SHALL be a stated consequence of leaving it unresolved, and that consequence
SHALL be a cost, a rate, or information the player does without — never a door that does not open.

The final artifact SHALL gate nothing at all: the act's ending SHALL occur on its resource condition
alone, and the artifact SHALL affect only how that ending is described.

#### Scenario: A player who ignores every artifact still finishes

- **WHEN** a player never opens the artifact listing and never resolves a single artifact
- **THEN** every phase transition occurs on its own conditions, the act reaches its ending, and the
  only differences are the costs paid and the information not shown

#### Scenario: No configuration of artifact state blocks a transition

- **WHEN** any combination of resolved, bypassed and untouched artifacts is held
- **THEN** no stage transition is unreachable

### Requirement: A resolved artifact is one fact; how it was resolved is a separate one

Resolving an artifact — by answering it or by exhausting its attempt allowance — SHALL record a
single milestone that does not distinguish the two routes. Every capability gated on that artifact
SHALL read that milestone, and SHALL therefore be structurally incapable of treating the two routes
differently.

Whether the artifact was answered SHALL be recorded as a *separate* milestone, read only by the
narrative that describes the player's performance.

Whether it was answered without purchasing hints SHALL NOT be stored as a third milestone. That
question SHALL be answered by a published predicate over existing state, so that no stored flag can
drift from the record it summarises.

#### Scenario: A gated capability cannot tell the two routes apart

- **WHEN** one player answers an artifact and another exhausts its attempt allowance
- **THEN** both hold the same milestone, and every capability gated on that artifact behaves
  identically for both

#### Scenario: The narrative can tell them apart

- **WHEN** the ending text is selected
- **THEN** it can distinguish how many artifacts were answered from how many were merely resolved,
  because the second milestone records only the former

#### Scenario: Unaided solving is derived, never stored

- **WHEN** any system needs to know whether an artifact was answered without purchased hints
- **THEN** it calls the published predicate, and no separate stored flag exists that could disagree
  with the underlying record

## MODIFIED Requirements

### Requirement: Scheduled boundaries are contributed, and the empty answer is infinity

The simulation SHALL determine its next step boundary by reducing over a list of contributors, each
of which reports the earliest instant at which it has something pending. A contributor SHALL be added
by appending to that list; adding one SHALL NOT require editing the reduction itself.

Every contributor SHALL guard its own state, SHALL be pure, and SHALL report **infinity** when it has
nothing pending. A contributor MUST NOT report zero, a null, or nothing at all: a zero pins the
simulation's step length at zero and exhausts its iteration limit without advancing time.

A contributor whose pending instant is derived from stored state SHALL derive it from the same
clamped value the player is shown, so that the boundary and the display cannot disagree, and SHALL
exclude instants that have already passed rather than reporting them as pending.

This extends the existing contributor-list requirement with the two conditions that a boundary read
from stored, defaultable state must satisfy — the default is zero, and zero is the one value a
contributor may never report.

#### Scenario: A contributor with a defaulted deadline never reports zero

- **WHEN** state holds records whose pending-instant field is absent and therefore defaults to zero
- **THEN** the contributor reports infinity for those records, and the simulation's step length is
  unaffected

#### Scenario: A boundary agrees with what the player is shown

- **WHEN** a stored deadline is further away than the current configuration allows and is clamped for
  display
- **THEN** the boundary is contributed at the clamped instant, not at the stored one

#### Scenario: Adding a contributor changes no existing step

- **WHEN** a new contributor is appended and the state it guards is absent, as it is for every stage
  before the one that introduces it
- **THEN** it reports infinity and every step length in the game is unchanged
