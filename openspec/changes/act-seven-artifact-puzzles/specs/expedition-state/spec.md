## ADDED Requirements

### Requirement: Recovered artifacts are authored content with three independent routes past each

The expedition SHALL present a set of recovered artifacts, each posing a question the player answers.
Every prompt, every accepted answer, every hint and every line of feedback SHALL be authored content;
none of it may appear in the rules or in the rendering layer.

Every artifact SHALL offer three independent routes to its capability:

1. answering it correctly;
2. purchasing its hints, of which there SHALL be a fixed number of escalating tiers; and
3. repeated attempts, after a bounded number of which the artifact SHALL yield its capability
   regardless of whether any answer was correct.

The third route SHALL require no correct answer, no currency and no prior purchase, so that it
remains open to a player holding nothing.

An artifact's prompt SHALL contain every quantity its answer requires. No answer may depend on
information the player must have read elsewhere, and every answer SHALL be verifiable by the player
against the printed prompt before it is submitted.

#### Scenario: A player who solves nothing and buys nothing still gains every capability

- **WHEN** a player repeatedly attempts every artifact without ever answering correctly and without
  holding any currency
- **THEN** each artifact eventually yields its capability, and the player finishes the act with the
  same capabilities available to a player who answered all of them

#### Scenario: Every quantity an answer needs is on the artifact

- **WHEN** a player reads any artifact's prompt
- **THEN** every quantity required to derive the accepted answer appears in that prompt, and the
  player can confirm their own answer against it without submitting

#### Scenario: An artifact reveals only when its phase is reached

- **WHEN** the expedition has not yet reached the phase an artifact belongs to
- **THEN** that artifact is absent from the listing entirely rather than shown disabled

#### Scenario: An unrecognised phase reveals rather than hides

- **WHEN** the expedition's phase is absent or not recognised
- **THEN** artifacts are revealed rather than withheld, so that a save one step from repairing itself
  is never denied the route that requires nothing

### Requirement: Answer acceptance tolerates how the player writes the answer

Answer acceptance SHALL be insensitive to formatting that does not change meaning: letter case,
surrounding and internal whitespace, punctuation, articles, the several characters that render as a
dash or a minus sign, and the separators a player might place between the parts of an ordered answer.

A numeric answer SHALL be accepted within an authored tolerance, and that tolerance SHALL be
recorded alongside a statement of the reading ambiguity it exists to absorb. Where an answer can be
read two defensible ways that differ by a step, both SHALL be accepted.

A worded answer SHALL be accepted from an authored list of equivalents, including the everyday name
for the concept where one exists.

#### Scenario: The same answer written several ways is accepted identically

- **WHEN** a player submits an answer differing from an accepted form only in case, spacing,
  punctuation, separators or an article
- **THEN** it is accepted exactly as the canonical form would be

#### Scenario: An off-by-one reading is accepted rather than punished

- **WHEN** an answer's wording admits two readings a step apart and the player submits either
- **THEN** both are accepted, because the difference is a reading ambiguity and not a failure to
  understand the artifact

### Requirement: Attempts are governed by a bounded, self-correcting cooldown

After an attempt that does not resolve an artifact, further attempts on that artifact SHALL be
refused until a cooldown elapses. The refusal SHALL be a refusal and not an error, so that a repeated
or duplicated submission cannot record two attempts.

The remaining wait SHALL be clamped to the cooldown the current configuration declares. A stored
deadline longer than that — from a hand-edited save, from a retune that shortened the cooldown, or
from an item bought mid-wait that halves it — SHALL never produce a longer lockout than the artifact
in front of the player states.

An absent deadline SHALL read as ready, so that an artifact never attempted is attemptable
immediately.

#### Scenario: A stale deadline cannot outlast the configured cooldown

- **WHEN** a stored deadline is further away than the currently configured cooldown allows
- **THEN** the remaining wait is the configured cooldown, and the artifact becomes attemptable at
  that point rather than at the stored deadline

#### Scenario: A second submission during the wait changes nothing

- **WHEN** a submission is made while the cooldown is still running
- **THEN** it is refused, the attempt count is unchanged, and the deadline is unchanged

#### Scenario: A resolved artifact accepts no further attempts

- **WHEN** an artifact has been resolved by either route
- **THEN** further submissions to it are refused and its state is unchanged

### Requirement: Instruments are permanent capabilities sold under the shop contract

The expedition SHALL offer purchasable instruments, each a permanent capability rather than a
per-artifact consumable. The listing SHALL return rows with cost, ownership and affordability already
resolved, and purchase SHALL return either new state or a refusal — for an unknown instrument, one
whose phase the run has not reached, one already owned, or one the player cannot afford.

Every instrument's effect SHALL be expressed as declared properties of the instrument itself, so that
adding an instrument is an authoring change and requires no change to the rules that apply it.

Every debit SHALL pass through the single wallet path the rest of the game uses, including a debit of
zero where an owned instrument has made a purchase free.

#### Scenario: A free hint tier is still a wallet transaction

- **WHEN** an owned instrument has made a hint tier free and the player buys that tier while holding
  no currency
- **THEN** the purchase succeeds, the balance is unchanged, and no second path by which currency
  could move was used

#### Scenario: An instrument cannot be bought twice

- **WHEN** the player purchases an instrument they already own
- **THEN** the purchase is refused and neither their balance nor their holdings change

### Requirement: Artifact state tolerates its own total absence

Every read of artifact state SHALL tolerate the absence of the expedition entirely, not merely the
absence of the artifact records within it. A save that predates this capability SHALL read as a
player who has attempted nothing, bought nothing and resolved nothing, and SHALL render without
error.

A stored value of the wrong type — a count that is not a number, a deadline that is not finite —
SHALL read as its default rather than propagate.

#### Scenario: A save from before the expedition existed opens cleanly

- **WHEN** a save with no expedition whatsoever is loaded and the artifact listing is requested
- **THEN** it returns the artifacts available at the opening phase, each with no attempts, no hints
  purchased and no cooldown running

### Requirement: The simulation loop never writes artifact state

Artifact attempt counts, resolutions and purchases SHALL advance only from a player action. The
passage of time — including a single catch-up step spanning many hours after the game was closed —
SHALL NOT record an attempt, resolve an artifact, purchase anything, or produce any notification
arising from artifact state.

#### Scenario: A long absence resolves nothing

- **WHEN** the player returns after many hours away and the elapsed time is credited in one step
- **THEN** every artifact holds exactly the attempts, hints and resolutions it held when the player
  left
