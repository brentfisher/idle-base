## ADDED Requirements

### Requirement: A payout whose value is deliberately not yet known is presented only through the field that withholds it

Where a reward's final value is decided at a later moment than the one at which it is displayed, the
presentation SHALL render only the pre-composed description the resolving layer emits, and SHALL NOT
render the underlying numeric field the description was built from.

The numeric field in this situation is not a rounded or approximate version of the reward — it is a
basis figure that equals neither the disclosed range nor the eventual payment. Rendering it discloses
a precise number that is simply false, and it does so by bypassing the branch the resolving layer
wrote specifically to hold the disclosure rule. The failure is invisible in review: the field is
present on the row, correctly named, and reads as the obvious thing to display.

Once the value has been decided, the same description field SHALL carry the decided figure, so the
presentation needs no knowledge of which moment it is in.

#### Scenario: The reward is offered but not yet resolved

- **WHEN** the reward's value has not yet been decided
- **THEN** the disclosed range is rendered and the underlying basis figure appears nowhere on screen

#### Scenario: The reward has been resolved

- **WHEN** the value has been decided
- **THEN** the same description field carries the decided figure, with no branch in the presentation
  layer

#### Scenario: Every other reward on the same board

- **WHEN** a reward's value was never uncertain
- **THEN** it renders through the identical field, so no row is a special case

### Requirement: An optional system states that it is optional before it states what it offers

Where a system is designed so that a player who ignores it entirely still completes the experience,
the presentation SHALL state that plainly, above any listing, and SHALL NOT de-emphasise the
statement relative to the listing it qualifies.

An opportunity and an obligation are the same list of items and differ only in framing. A surface
that opens with a count of outstanding items converts an offer into a backlog and makes every player
who ignores it feel behind — which is the outcome the optional design exists to avoid.

Where the system also states that failing to complete an item already taken on carries no penalty,
that is a **different** statement and SHALL NOT substitute for it. A player can believe that
abandoning a taken item is free and still believe the system as a whole is expected of them.

#### Scenario: The listing is empty

- **WHEN** nothing is currently on offer
- **THEN** the optional statement is still rendered, and the empty listing reads as ordinary rather
  than as a fault

#### Scenario: The listing is full

- **WHEN** items are on offer
- **THEN** the optional statement is rendered above them at no lesser emphasis than the items

### Requirement: An optional system renders no state as urgent

Where items on an optional listing expire, lapse, or are rescheduled rather than lost, the
presentation SHALL NOT render any ordinary state — including an approaching deadline — in the visual
language it reserves for a fault or a loss.

A countdown dressed as an alarm promises a consequence the system does not impose. Where a lapsed
item is reissued later, the deadline is a scheduling detail and not a risk, and presenting it as a
risk teaches the player to treat an optional system as a timed one.

An action that discards an item SHALL NOT be presented as destructive where discarding carries no
penalty. A player who suspects a penalty will hold a limited slot on an item they cannot complete,
which is the only way an optional system of this shape can cost them anything.

#### Scenario: An offer approaching its deadline

- **WHEN** an offer will lapse shortly
- **THEN** the remaining time is rendered in the same de-emphasised treatment as other secondary
  detail

#### Scenario: The control that discards an item

- **WHEN** discarding is free
- **THEN** the control is not styled as destructive, and the absence of a penalty is stated

### Requirement: A condition is presented as an answer, not as a quantity

Where an objective is a condition that either holds or does not, the presentation SHALL NOT render a
proportional indicator for it. It SHALL render the resolving layer's stated answer.

A proportional bar asserts that a middle exists. For a condition there is none, and drawing one
invents a state the system does not model and cannot ever display consistently.

Which objectives are quantities and which are conditions SHALL be decided in the layer that authors
the objectives, not by a test written in the presentation layer — it is a question about the
objective, not about the screen.

#### Scenario: A conditional objective

- **WHEN** the objective is a condition
- **THEN** no proportional indicator is rendered anywhere on the row, and the stated answer is

#### Scenario: A quantitative objective on the same listing

- **WHEN** the objective is a quantity
- **THEN** a proportional indicator is rendered, so the absence on the conditional row reads as a
  decision rather than an omission

### Requirement: A refused action states the reason in the words the resolving layer authored

Where an action is unavailable, the presentation SHALL render the reason as supplied, and SHALL NOT
disable the control in silence or substitute its own wording.

Refusal reasons authored as sentences rather than as codes exist so that a surface can print them. A
player shown a disabled control with no explanation learns nothing; a player shown a code learns
less. Most refusals name something the player can go and change.

Where a refusal exists specifically to prevent an irreversible loss — a reward that cannot be
received because there is nowhere to put it — the presentation SHALL make clear that nothing has been
forfeited and that the action remains available later.

#### Scenario: A ceiling on concurrent commitments has been reached

- **WHEN** the player attempts to take on one more than the system permits
- **THEN** the row is rendered with its reason and its control is disabled

#### Scenario: A reward cannot currently be received

- **WHEN** accepting the reward would exceed the capacity that holds it
- **THEN** the reason is rendered, the action is refused without consuming anything, and the item
  remains claimable

### Requirement: Retiring a shared placeholder retires the fields that existed only to feed it

When the last consumer of a shared placeholder component is replaced, the fields in any registry that
existed solely to supply that placeholder SHALL be removed in the same change, together with any
commentary that justified retaining them.

A registry that outlives its reader becomes a set of strings no screen displays, which the next
reader must individually verify is dead. Commentary defending a field's retention becomes actively
misleading once the field's reason for existing has gone.

Which fields are dead SHALL be established by searching the codebase, not by relying on a prediction
recorded before the intervening work landed. Fields with live readers SHALL be kept.

#### Scenario: The last consumer of the placeholder is replaced

- **WHEN** no module imports the placeholder
- **THEN** the placeholder, its accessor, its shared note and every registry field with no other
  reader are removed together

#### Scenario: A field predicted to survive turns out to be dead

- **WHEN** a search shows the field's only reader was the placeholder
- **THEN** it is removed regardless of the earlier prediction

#### Scenario: Registry lists that must agree

- **WHEN** the registry is edited
- **THEN** its agreement with every other list keyed on the same ids is verified in both directions,
  because a disagreement in either produces a silent failure rather than a build error
