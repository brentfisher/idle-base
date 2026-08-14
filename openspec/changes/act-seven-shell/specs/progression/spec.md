## Purpose

Defines the staged progression the player moves through, what each stage may override about how
the game behaves, and how the game's content comes into and goes out of active play as stages
change.

## ADDED Requirements

### Requirement: A stage may retire the surfaces earlier stages introduced

A stage SHALL be able to declare that named surfaces are retired from that stage onward. A retired
surface MUST NOT be reachable by the player: it is absent from navigation, cannot be selected, and
is never rendered. Retirement SHALL be resolved on read from configuration, never persisted, so
that changing which stage retires which surface takes effect on an existing save with no migration.

Retirement SHALL take precedence over introduction wherever both name the same surface, regardless
of the order of the stages that declare them. Restoring a retired surface must be an explicit
authoring decision, never a side effect of two configuration edits colliding.

Only whole surfaces may be retired. A stage MUST NOT retire a capability that is a mechanic inside
a surface that remains in play, because the consumers of such a capability gate on its presence for
reasons unrelated to navigation.

#### Scenario: Every surface of the previous stage is retired at once

- **WHEN** the player is in a stage that retires every surface the earlier stages introduced
- **THEN** none of those surfaces appears in navigation and none of them can be reached, and the
  surfaces that stage introduces are the only ones the player can select

#### Scenario: Earlier stages are unaffected

- **WHEN** the player is in any stage before the one that retires surfaces
- **THEN** the set of available surfaces and capabilities is exactly what it was before any stage
  declared a retirement, element for element and in the same order

#### Scenario: Retiring a surface does not disable the mechanics that share its name

- **WHEN** a stage retires a surface whose name is also the name of an ongoing income source
- **THEN** that income continues to accrue, because income sources are gated on the content that
  produces them and never on whether a surface is reachable

### Requirement: The manual action is never retired

The manual action that the player can always take for income SHALL remain available in every
stage, including any stage that retires every other surface. It MUST NOT be possible to remove or
disable it through the retirement mechanism or through any stage configuration.

This is a hard invariant and not a default. The manual action is what guarantees that every state
is recoverable in bounded time, and it is most load-bearing in the stage that retires the most:
that stage's every purchase is priced in the currency the manual action pays.

#### Scenario: The action survives a total teardown

- **WHEN** the player is in a stage that retires every surface introduced before it
- **THEN** the manual action is still present, still rendered outside the surface switch, and still
  credits the currency that stage declares

### Requirement: A stage may reveal its own surfaces progressively from its own progression signal

A stage SHALL be able to declare that some of the surfaces it introduces appear only once the
player has reached a given point of that stage's internal progression. The comparison SHALL be an
ordered rank ("at least this far"), never an equality test against a single point, so that a
revealed surface stays revealed as the stage continues.

The point of internal progression SHALL be read from the stage's single existing progression
signal. A parallel set of flags mirroring that signal MUST NOT be introduced, because two sources
of truth for how far into a stage the player has got can disagree on a save that crossed a boundary
while the player was away.

Where the signal is absent or unrecognized, the gate SHALL fail open and reveal the surface. A gate
that exists only to schedule a reveal must never be the thing that makes a surface unreachable.

#### Scenario: The stage opens on a single surface

- **WHEN** the player enters the stage and its internal progression is at its starting point
- **THEN** only the surfaces with no reveal condition are available

#### Scenario: A surface appears as the stage progresses

- **WHEN** the stage's internal progression reaches the point a surface names
- **THEN** that surface becomes available, and it remains available at every later point

#### Scenario: An unrecognized progression value reveals rather than hides

- **WHEN** the stage's internal progression signal holds a value the ladder does not recognize
- **THEN** every gated surface is revealed, rather than any surface becoming unreachable

#### Scenario: Consumers that do not ask about surfaces are unaffected

- **WHEN** a consumer queries whether a mechanic is available without supplying a progression
  signal
- **THEN** it receives the same answer it received before progressive reveal existed

### Requirement: The default surface is derived from the stage

When the surface the player is on stops being available, the game SHALL fall back to the first
surface the current stage makes available. It MUST NOT fall back to a named surface, because any
named surface can be retired by some stage, and falling back to a retired one would render content
the stage exists to remove.

Where a stage makes no surface available at all, the game SHALL render no surface rather than
substituting one.

#### Scenario: Crossing into a stage while on a surface it retires

- **WHEN** the player is on a surface at the moment a stage change retires it
- **THEN** the first surface the new stage makes available is shown, and no reset of the player's
  selection is required for this to hold on every subsequent render

#### Scenario: The fallback is not the retired surface

- **WHEN** the player is in a stage that retires the surface the game previously used as its
  built-in fallback
- **THEN** that surface is not rendered under any circumstances

### Requirement: Records of which surfaces have been seen are never cleared

The record of which surfaces the player has already visited SHALL be append-only and MUST NOT be
cleared when a stage retires surfaces. Retired entries are simply never queried again.

#### Scenario: Newly revealed surfaces are marked as new

- **WHEN** a stage reveals a surface the player has never visited
- **THEN** that surface is marked as new, while the retired surfaces' entries remain recorded and
  unqueried
