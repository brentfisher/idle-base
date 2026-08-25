## ADDED Requirements

### Requirement: A rendered crossing is a view of the simulation, never a second copy of it

Where a launch in transit is drawn, the drawing SHALL derive every position, duration and figure
from the same computation that resolves the launch. It SHALL NOT hold a clock, a timer, an
interpolation of its own between ticks, or any tuning number restated from configuration.

The reason is the invariant the whole act is built on: a launch resolves inside `advance()`, which
is called identically by the live tick and by the offline catch-up, and a surface that animated
against its own clock would disagree with the simulation for exactly as long as a player was away.
A crossing that reads 40% complete while the engine has already resolved the arrival is not a
cosmetic defect — it is two answers to "where am I", and the act has one.

#### Scenario: The player returns from an offline absence mid-transit

- **WHEN** a player closes the tab mid-transit and returns after the arrival clock has passed
- **THEN** the arrival has resolved and the scene shows the crossing complete, with no replay of the
  transit that happened while they were away

#### Scenario: A transit window is retuned

- **WHEN** the authored transit window for a leg changes
- **THEN** the rendered crossing takes correspondingly longer or shorter, with no edit to the
  rendering layer

#### Scenario: The rendered position is queried against the engine

- **WHEN** the scene draws the vehicle at a fraction of the arc
- **THEN** that fraction is the engine's own progress figure for the launch, not a value the scene
  advanced itself

### Requirement: The overshoot trade is shown as a change to the crossing, before the commit

Where a player is choosing how much to over-fill a launch, the rendered crossing SHALL respond to
that choice before the launch is committed, and the response SHALL express both halves of the trade:
a hotter burn and a shorter one.

The band is already presented numerically and correctly. What no figure conveys is that the two
effects are one decision — spending more arrives sooner — and a picture that changed only its colour
would be decoration rather than information.

#### Scenario: The player raises the overshoot before committing

- **WHEN** the overshoot selection is raised while a launch is uncommitted
- **THEN** the drawn arc's traversal shortens in proportion to the transit reduction the engine
  would apply, and the burn is drawn more intensely

#### Scenario: The overshoot sits at the floor

- **WHEN** the overshoot is at its floor, buying nothing
- **THEN** the crossing is drawn at its unmodified duration and intensity, with nothing implying a
  bonus that was not purchased

### Requirement: The final burn is drawn as a departure, not an arrival

Where the committed launch's destination is not a site on the ladder, the crossing SHALL be drawn as
leaving the ladder, and SHALL NOT terminate on a rendered destination body.

The act's ending is authored as a departure with no arrival — the paperwork is filed in two
different buildings — and a scene that landed the fifth burn on a glowing sphere would contradict
the one piece of fiction the ending turns on.

#### Scenario: The fifth burn is committed

- **WHEN** a launch is committed whose destination is the over-the-wall destination
- **THEN** the crossing departs the plane of the ladder and passes beyond it, and no arrival is drawn

#### Scenario: Any other burn is committed

- **WHEN** a launch is committed toward a site on the ladder
- **THEN** the crossing terminates at that site and the site is shown as reached

### Requirement: The crossing is optional, and its absence changes nothing else

The rendered crossing SHALL be treated as an enhancement to a surface that is complete without it.
Where it cannot be rendered — no WebGL context, a viewport too small to seat it, a player who has
asked for reduced motion, or a failure inside the renderer — the surface SHALL present exactly what
it presents today, with no error, no empty frame, and no loss of any figure.

Every number the player needs to make and understand a launch decision SHALL remain present and
authoritative whether or not the scene renders. The scene is never the only place a fact appears.

#### Scenario: The device cannot provide a WebGL context

- **WHEN** the renderer cannot acquire a context
- **THEN** the panel renders its full existing readout and controls, and nothing on screen reports a
  failure

#### Scenario: The renderer's code cannot be fetched

- **WHEN** the rendering library is unavailable — the player is offline, the network fails, or the
  fetched file does not match its expected integrity hash
- **THEN** the panel renders its full existing readout and controls, the fetched file is never
  executed if it failed its integrity check, and nothing on screen reports a failure

#### Scenario: The player has asked for reduced motion

- **WHEN** the operating system reports a reduced-motion preference
- **THEN** no animated crossing plays, and the panel remains fully usable and fully informative

#### Scenario: The renderer throws mid-flight

- **WHEN** an error occurs inside the rendering layer at any point
- **THEN** the error does not propagate to the panel, the panel continues to function, and the
  simulation is unaffected

### Requirement: The crossing is built for a phone first

The rendered crossing SHALL be dimensioned, budgeted and scheduled for a small touchscreen as its
primary target, not adapted to one afterwards.

The act's surfaces are already constrained by a 390px viewport — its tab bar was reduced to a
scroll-snapped single row for that reason — and a scene that assumed a desktop would be the first
thing in the act to break the constraint the rest of it was designed against.

#### Scenario: The panel is viewed on a narrow viewport

- **WHEN** the panel is rendered on a viewport at the width the act's other surfaces are designed for
- **THEN** the scene occupies a bounded portion of the panel, the readout and controls remain
  reachable without the scene displacing them, and the page does not scroll horizontally

#### Scenario: The scene is not being looked at

- **WHEN** the Launch panel is not the visible panel, or the document is hidden
- **THEN** the scene consumes no per-frame work

#### Scenario: The device reports a high pixel density

- **WHEN** the device's pixel ratio exceeds what the scene budgets for
- **THEN** the scene renders at its budgeted ratio rather than the device's, trading sharpness for a
  frame rate the device can hold
