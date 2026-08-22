## ADDED Requirements

### Requirement: An over-fillable threshold is presented as a band, never as a binary

Where a committed spend may be over-filled beyond its minimum — and where over-filling buys the
player something — the presentation SHALL render the full range between the minimum and the ceiling,
together with the current holding's position within it. It SHALL NOT reduce the state to a met /
not-met indication.

The decision the player is being given is *when* to commit, not *whether*. That decision exists only
if the room above the minimum is visible; a surface that reports "requirement met" has reported the
one fact that was never in question and has deleted the one that was.

The ceiling SHALL be read from the same computation that enforces the spend, and SHALL NOT be
re-derived in the presentation layer from the minimum and a multiplier. Where the multiplier is
authored once precisely so that two figures cannot drift apart, restating it in a component
reintroduces that drift where no measurement will catch it.

#### Scenario: The holding sits between the minimum and the ceiling

- **WHEN** the player holds more than the minimum but less than the ceiling
- **THEN** the minimum, the ceiling and the current holding are all rendered, and the holding's
  position between them is shown

#### Scenario: The holding is exactly at the minimum

- **WHEN** the player holds exactly the minimum
- **THEN** the surface is committable, and what over-filling would buy is stated as absent rather
  than itemised as a list of zero-valued effects

#### Scenario: The ceiling moves

- **WHEN** the derivation that produces the ceiling is retuned
- **THEN** every figure and every position on the surface moves with it, with no edit to the
  presentation layer

### Requirement: What over-filling buys is shown before the commit, from the enforcing computation

The surface SHALL itemise the benefits the current over-fill would purchase, and SHALL do so before
the control that commits, using figures produced by the same computation that will apply them.

A benefit disclosed only after the irreversible action has been taken cannot inform the decision it
describes. A benefit computed independently for display can advertise terms the commit does not
honour.

Where a particular commit legitimately purchases none of a given benefit, that absence SHALL be
stated rather than omitted. An absent figure on a high-stakes surface reads as a defect at the moment
the player is reading most carefully.

#### Scenario: Over-filled, with benefits to itemise

- **WHEN** the holding exceeds the minimum
- **THEN** each benefit is rendered with the figure the commit will apply

#### Scenario: A commit for which one benefit does not apply at all

- **WHEN** a benefit is structurally zero for this particular commit rather than merely unearned
- **THEN** the surface says so in words, and does not silently drop the line

### Requirement: An irreversible spend states what it consumes before the control that triggers it

Where committing consumes more than the stated minimum, the surface SHALL state what is actually
consumed, in full, positioned before the control and at no lesser visual emphasis than the
surrounding text. The statement SHALL be reachable without opening a confirmation.

The control SHALL NOT commit directly. It SHALL open a confirmation surface, and only that surface
SHALL dispatch, so that a mis-press costs nothing.

The confirmation SHALL remain gated on the action still being permitted at render time, not on the
fact that it was opened. Between the press and the render, a simulation tick may have changed whether
the action is legal, and a confirmation must never ask the player to confirm something that would now
be refused.

#### Scenario: The consumed amount exceeds the stated minimum

- **WHEN** committing consumes the whole band rather than the minimum
- **THEN** the surface states that before the control, and the confirmation states it again with the
  actual figures

#### Scenario: The action becomes illegal while the confirmation is open

- **WHEN** the action would now be refused by the engine
- **THEN** the confirmation does not render

#### Scenario: The confirmation is dismissed

- **WHEN** the player dismisses the confirmation by any route
- **THEN** no state changes

### Requirement: Wording about a consuming action stays true under later capacity increases

Where a spend is clamped to a band and holdings above that band survive it, the surface SHALL NOT
describe the spend as consuming everything the player holds. It SHALL name the band, and SHALL state
what remains when anything does.

A system that later sells optional storage above the band makes the looser wording false, and false
in the direction that presents a purchasable upgrade as a trap. The amount that survives SHALL be
supplied by the layer that enforces the clamp, not subtracted in the presentation layer, so there is
one place that knows the clamp exists.

#### Scenario: Holdings exceed the band

- **WHEN** the player holds more than the band can take
- **THEN** the spend is shown as the band's ceiling, the surviving remainder is named, and the
  progress indication is clamped rather than overflowing

#### Scenario: Holdings are within the band

- **WHEN** the player holds no more than the band can take
- **THEN** no remainder is claimed and no surviving-amount line is rendered

### Requirement: A committed action in progress is presented from its own record

Where a committed action runs over a window, its presentation SHALL be sourced from the record of
that action, and SHALL NOT be derived from the offer or shop row that started it.

The two diverge in both directions. An offer row is priced from current holdings, so during the
window it describes a hypothetical *next* action rather than the one under way. And an offer row may
cease to exist entirely once the action is committed — which, for a final or terminal action, would
leave the surface blank for the whole of the window it exists to display.

The remaining time SHALL be computed against the simulation clock by the layer that owns the record,
never by a presentation-side timer and never from wall-clock time. Any boundary accessor that
deliberately excludes overdue or malformed records — because it feeds the simulation's own stepping —
SHALL NOT be used as the source, since it reports no boundary for exactly the malformed records the
presentation must still render.

#### Scenario: An action is under way and the offer row still resolves

- **WHEN** the shop row still exists but describes a different, hypothetical action
- **THEN** the surface renders the record's figures, and the row's figures appear nowhere

#### Scenario: The final committed action, after which no offer remains

- **WHEN** the offer list is empty because the action committed was the last one available
- **THEN** the surface still names the action, its destination and its remaining time

#### Scenario: A record with a malformed or missing completion boundary

- **WHEN** the record carries no usable completion boundary
- **THEN** the remaining time renders as a finite value and the surface reads as completing, rather
  than rendering an infinity or a non-number

#### Scenario: A malformed simulation clock

- **WHEN** the stored clock is not a number
- **THEN** the remaining time is still finite

### Requirement: A capability gated at zero capacity explains the gate rather than reporting the number

Where a resource has zero capacity and is therefore discarded as produced, a surface whose subject
depends on accumulating that resource SHALL state that condition and what removes it, rather than
rendering the target as merely distant.

Zero capacity is categorically different from a low reading: the target is not being approached
slowly, it is unreachable. A numeric readout of "0 of 0" is accurate and communicates none of that.
The explanation SHALL be gated on the capacity reported by the simulation rather than on ownership of
any particular unlock, so it remains correct if a second route to capacity is ever added, and any
unlock it names SHALL be read from that unlock's own definition rather than restated.

#### Scenario: Capacity is zero

- **WHEN** the resource's capacity is zero
- **THEN** the surface states that nothing can be accumulated, names what removes the gate, and
  positions that explanation before the target it explains

#### Scenario: Capacity has been raised above zero

- **WHEN** any source of capacity exists
- **THEN** the explanation is absent

### Requirement: A capability fixed by permanent investment is never rendered as degraded by transient shortage

Where a capability is a function of permanent build state alone, no part of the surface SHALL dim,
qualify, warn on, or condition that capability on the current state of a shared resource pool.

Where such a capability governs an action already in progress, the surface SHALL state in words that
a shortage cannot affect it. This is the point at which a player under pressure is most likely to
assume otherwise, and an unstated invariant is one the player cannot act on.

#### Scenario: A total shortage during a committed action

- **WHEN** every shared resource is exhausted while the action is under way
- **THEN** the remaining time, the destination and the stated guarantee are unchanged

#### Scenario: A shortage while the action is being considered

- **WHEN** resources are short before commit
- **THEN** the capability figure is rendered identically to how it renders under no shortage
