## Purpose

The surface on which recovered artifacts are read, answered and got past: what it displays, which
controls it offers and when, and the rules that keep it a display rather than a second copy of the
artifact rules.

## ADDED Requirements

### Requirement: The artifact surface displays the artifacts a run has revealed

The surface SHALL display one card for each revealed artifact, and SHALL NOT display, list, outline
or otherwise indicate an artifact that has not been revealed.

Each card SHALL show the artifact's prompt, the capability it grants, what the player pays if they
leave it unresolved, and whether it is unresolved, accepted or released.

The surface SHALL determine none of this for itself. Which artifacts are revealed, what each prompt
says, what each is worth, what every price is, whether the player can afford it and whether a
submission is currently permitted are all decided elsewhere and displayed here as given.

#### Scenario: An artifact from a later stage of the expedition is not shown

- **WHEN** the run has not reached the stage at which an artifact is revealed
- **THEN** the surface shows no trace of that artifact, rather than a locked or greyed row

#### Scenario: A prompt is displayed as printed

- **WHEN** an artifact's prompt contains aligned columns
- **THEN** the alignment is preserved as displayed, because the player is expected to read figures
  out of it and check their own answer before submitting

#### Scenario: A save with no artifact record at all

- **WHEN** the surface is opened against a save that has never stored any artifact state
- **THEN** it displays the revealed artifacts as unresolved with no attempts recorded, and does not
  fail

### Requirement: Every unsuccessful submission is displayed as graded, never as a bare rejection

The surface SHALL display the graded outcome of the most recent submission for an artifact, using the
authored line identified by that grading.

The four unsuccessful outcomes — near, wrong kind of thing, outside the answerable range, and nothing
submitted — SHALL be distinguishable from one another as displayed, and not only by their wording. A
display that renders every unsuccessful outcome identically does not satisfy this requirement.

The surface SHALL NOT compose its own rejection, substitute its own wording for an authored line, or
display an unresolved placeholder from a line's template.

#### Scenario: A near miss and a wrong-kind answer do not read alike

- **WHEN** one artifact has been answered with a near miss and another with a real term for the wrong
  event
- **THEN** each displays its own authored line, and the two are visibly distinguished from each other
  as well as from an accepted answer

#### Scenario: A templated line is completed before it is displayed

- **WHEN** a graded outcome identifies a line containing placeholders for a positional count
- **THEN** the displayed line carries the counts, and no placeholder text reaches the player

### Requirement: Grading is not performed by the display

An answer SHALL be graded only as part of recording an attempt. The surface SHALL NOT grade, test,
score or otherwise evaluate an answer that has not been submitted.

Displayed feedback SHALL correspond to an attempt that was actually recorded. Where a submission is
refused — because the attempt governor is live, or the artifact is already resolved — no feedback
SHALL be displayed for it and the previously displayed feedback SHALL remain unchanged.

This exists because unlimited free grading removes the cost that prices a systematic search, which is
the mechanism that keeps the manual route from being strictly better than reasoning.

#### Scenario: A refused submission changes nothing

- **WHEN** a submission is made while the attempt governor is still live
- **THEN** no attempt is recorded, no currency moves, and the line already on screen is unchanged

### Requirement: Answer tolerance belongs to the grading, not to the field

The surface SHALL pass the player's entry onward exactly as typed, without trimming, case folding,
number parsing, or any other normalisation.

#### Scenario: A padded, mixed-case answer is accepted

- **WHEN** the player submits an accepted answer with surrounding spaces and inconsistent
  capitalisation
- **THEN** it is accepted, because tolerance is applied once, where the answer is checked

### Requirement: All three routes past an artifact are visible on every unresolved artifact

Each unresolved artifact SHALL simultaneously offer: a way to submit an answer; the hint ladder with
each tier's price; and a labelled control that records an attempt without an answer.

The surface SHALL also state, once and in words, that every artifact has three ways past it and that
leaving one unresolved never blocks the ending.

The control that records an attempt without an answer SHALL NOT be hidden, deferred until some number
of failures, or presented as a penalty.

#### Scenario: A player who cannot solve an artifact can see a way past it

- **WHEN** an unresolved artifact is displayed
- **THEN** the manual route is present with its own label and an explanation of what it does, next to
  the count of attempts recorded against the number at which the artifact is released

#### Scenario: The counter is shown without an invented time estimate

- **WHEN** the manual route is displayed
- **THEN** the attempts recorded and the number required are shown, and no projected wall-clock time
  to release is displayed

### Requirement: Only the next tier of the hint ladder can be purchased

The hint ladder SHALL display all tiers with their prices. Exactly one tier — the lowest unpurchased
one — SHALL carry a purchase control. Higher unpurchased tiers SHALL display their price with no
control.

Unpurchased hint text SHALL NOT be present in the displayed page in any form.

#### Scenario: A player cannot buy out of order

- **WHEN** the first tier has been purchased and the second and third have not
- **THEN** only the second tier offers a purchase, and the third shows its price as a target

#### Scenario: Unpurchased prose does not leak

- **WHEN** any artifact is displayed with unpurchased hints
- **THEN** the text of those hints appears nowhere in the rendered page

### Requirement: A resolved artifact reads as resolved, and how it was resolved is distinguished

An artifact resolved by an accepted answer and an artifact released after repeated attempts SHALL be
displayed differently from each other and from an unresolved one, and neither SHALL offer a
submission control.

An artifact solved with no hint purchased SHALL be marked as such, wherever that distinction is
recorded.

Release after repeated attempts SHALL NOT be presented as a failure.

#### Scenario: An unaided solve is marked

- **WHEN** an artifact is solved without any hint having been purchased
- **THEN** the surface marks it as unaided, and does not mark an artifact solved after a hint purchase

### Requirement: Countdowns are read from the simulation clock and never from a display timer

Every countdown displayed by the surface SHALL be derived from the simulation clock. The surface
SHALL NOT run a timer, poll, or read wall-clock time.

A governor that expires while the surface is open SHALL become ready without any manual refresh.

The surface SHALL cause no write to artifact state except from a player action, so that an offline
catch-up cannot advance an attempt count or resolve an artifact.

#### Scenario: A governor expires while the player is watching

- **WHEN** the attempt governor's remaining time reaches zero while the surface is displayed
- **THEN** the countdown is replaced by a ready state and the controls become usable, without the
  player reloading or switching tabs

#### Scenario: An eight-hour absence resolves nothing

- **WHEN** a player returns after a long absence to a save with an artifact mid-cooldown
- **THEN** no attempt has been recorded and no artifact has been resolved, and the artifact's governor
  reads as expired

### Requirement: The instrument shop is displayed in the same shop contract as the act's other shops

Instruments available at the run's current stage SHALL be displayed with their description, their
effect and their price. One the player cannot afford SHALL be displayed and unpurchasable rather than
hidden. One already owned SHALL keep its row and be marked as owned.

Instrument effects that change what the surface displays — a translated prompt, a free hint tier, a
shortened governor, an additional readout, a test bench — SHALL be reflected in the display without
the surface knowing which instrument produced them.

#### Scenario: An owned instrument's effect is visible on the artifacts it touches

- **WHEN** an instrument that translates prompts is owned
- **THEN** the affected artifacts display their translated prompts, and no answer changes
