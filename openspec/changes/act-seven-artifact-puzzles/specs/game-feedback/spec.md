## ADDED Requirements

### Requirement: Every submitted answer receives graded feedback, never a bare rejection

Every submission SHALL be graded into exactly one of five outcomes: accepted; near; the wrong kind of
thing; outside the answerable range; and nothing submitted. No submission may be answered only with
an indication that it was wrong.

The grading SHALL be reported as an outcome together with a **key** identifying the line to show and
the facts that line needs. It SHALL NOT be reported as an assembled sentence, so that the prose
remains authored content and the same wrong answer cannot be phrased two ways by two displays.

A line identified for an outcome that has no authored prose SHALL fall back to the general line for
that outcome rather than displaying nothing or an unresolved placeholder.

#### Scenario: A wrong answer is told how it is wrong

- **WHEN** a player submits any answer that is not accepted
- **THEN** the response identifies which of the four unsuccessful outcomes applies, and the player is
  shown a line describing that outcome rather than an undifferentiated refusal

#### Scenario: Prose never crosses out of authored content

- **WHEN** any submission is graded
- **THEN** the result carries an outcome and a key, and every player-visible sentence is looked up
  from authored content

### Requirement: Numeric answers always report direction

An artifact answered with a number SHALL report, for every unaccepted submission at any distance,
whether the submitted figure was low or high.

This makes such artifacts searchable by bisection, which is intended: bisection is the manual route
for a number and it is priced by the attempt cooldown rather than forbidden. Direction SHALL NOT be
withheld to make an artifact harder.

#### Scenario: A far-off number still gets a direction

- **WHEN** a player submits a number far outside the accepted range
- **THEN** the response reports that it was low or that it was high

### Requirement: Ordered answers report how many parts are correctly placed

An artifact answered with an ordered sequence SHALL report, for every unaccepted submission, the
number of parts that were in their correct position out of the total expected. It SHALL NOT report a
warmer-or-colder judgement in place of that count.

A submission containing a part that is not one of the artifact's stated options SHALL be graded as
the wrong kind of thing, distinctly from a submission that uses the right parts in the wrong order,
and that check SHALL be made before any positional count is reported.

#### Scenario: A misordered sequence gets a positional count

- **WHEN** a player submits the correct parts in an incorrect order
- **THEN** the response reports how many were in position out of the total, which is enough
  information for a careful player to converge in a few submissions

#### Scenario: An unrecognised part is not reported as a near miss

- **WHEN** a submission contains something that is not one of the artifact's stated options
- **THEN** it is graded as the wrong kind of thing rather than given a positional count

### Requirement: A player who understood more than was asked is answered on their own terms

Authored content SHALL be able to attach a specific response to a specific wrong answer, and that
response SHALL take precedence over the general line for its outcome.

These responses exist for the player whose answer reflects a *correct* reading of a different
question, and SHALL name the distinction rather than merely deny the answer.

#### Scenario: A defensible wrong answer is named, not denied

- **WHEN** a player submits a wrong answer for which authored content provides a specific response
- **THEN** that response is shown in place of the general line for its outcome

### Requirement: Unpurchased hint text is never carried to the rendering layer

An artifact's presentation SHALL include every hint tier with its price, whether it has been
purchased, and whether it is affordable. The hint's **text** SHALL be absent unless that tier has
been purchased.

#### Scenario: An unpurchased hint carries no prose

- **WHEN** the artifact listing is produced for a player who has bought no hints
- **THEN** every tier appears with price and affordability resolved, and no tier carries any text

### Requirement: Verification without penalty reports only success or failure

Where the player holds the capability to test an answer without submitting it, that test SHALL record
no attempt, SHALL NOT consume the submission cooldown, and SHALL report only whether the answer
would be accepted — with no direction and no positional count.

The test SHALL be subject to its own separate delay, and the combination of that delay with its
bare result SHALL leave neither the tested route nor the submitted route strictly faster than the
other for searching a range of candidates.

#### Scenario: Testing costs no attempt

- **WHEN** the player tests an answer without submitting it
- **THEN** the attempt count is unchanged, the submission cooldown is unchanged, and the result
  states only success or failure

#### Scenario: Neither route dominates

- **WHEN** the two routes are compared as search strategies over ranges of candidate answers
- **THEN** each is faster than the other over some range, so that holding the capability is a choice
  rather than a strict replacement for submitting
