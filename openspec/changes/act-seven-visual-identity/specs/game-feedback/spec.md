## ADDED Requirements

### Requirement: An act that suspends the sport presents a distinct visual identity

An act that freezes the sporting simulation SHALL present a visually distinct palette from the
acts that precede it, applied from the moment its shell mounts.

The palette SHALL be applied by toggling a single class on the document body, keyed on the rule the
act declares about itself rather than on its index — so any later act or era declaring the same rule
inherits the treatment without a separate registration. It SHALL be removed when that rule no longer
holds, because returning to an earlier act with a stale class would paint the earlier act in the
later act's colours.

Application SHALL NOT be sequenced behind the transition animation. That animation plays once, at
the act boundary, so a player who reloads directly into the act never sees it — a palette waiting on
it would leave that player in the previous act's colours permanently.

The page ground SHALL be repainted at the document root as well as the body, because the root
carries its own ground and the body does not always cover the viewport on a short page.

#### Scenario: Reloading directly into the act

- **WHEN** a player loads a save that is already in the act, without the transition playing
- **THEN** the act's palette is present on first paint, with no frame of the previous act's ground

#### Scenario: Leaving the act restores the previous palette

- **WHEN** the run returns to an act that does not declare the rule
- **THEN** the class is removed and the previous palette applies with no residue

#### Scenario: A short page shows no previous-act ground

- **WHEN** the act renders content shorter than the viewport
- **THEN** no strip of the previous act's ground is visible below it

### Requirement: Colour tokens are declared where every consumer can resolve them

Palette tokens SHALL be declared at the document root and merely applied by the activating class.

Custom properties inherit downward only, so a token declared on the body cannot be resolved by a
rule targeting the root element. Declared on the body, the root-level ground rule would silently
fall through to a hard-coded fallback and the two grounds would diverge the first time the token was
retuned. Declaration at the root costs nothing, because a custom property is inert until referenced
and every reference is scoped to the activating class.

#### Scenario: Retuning the ground moves both grounds

- **WHEN** the page-ground token's value is changed
- **THEN** both the body ground and the root ground change with it, with no second edit

### Requirement: A chip that sets its background inline keeps its label's inherited ink

Where a chip's background is supplied inline from data, its label SHALL inherit that chip's ink
rather than being assigned a fixed colour by a palette rule.

Such chips carry backgrounds spanning a wide luminance range, and their inks are chosen and measured
per background. A palette rule that assigns one fixed label colour across all chips is more specific
than the rules establishing that inheritance, and silently overrides them — producing labels far
below the legibility floor on the brightest fills, including the chips reporting resource
starvation.

Every text pair rendered in a chip SHALL clear the project's measured contrast floor, and the ratios
SHALL be computed rather than asserted.

#### Scenario: A label on a bright inline background stays legible

- **WHEN** a chip's background is supplied inline and its fill is light
- **THEN** the label inherits that chip's ink and the pair clears the contrast floor

#### Scenario: Adding a palette rule for chip labels does not regress inline chips

- **WHEN** a palette rule assigns a default label colour for chips
- **THEN** chips with inline backgrounds are excluded, at equal or greater specificity

### Requirement: The progression phase is shown as a coloured pill driven by data

The act's current phase SHALL be presented as a coloured pill, occupying the same slot the
pre-existing chapter indicator uses rather than adding a second element beside it — the two express
the same kind of fact and are never both true.

Pill colours SHALL be authored as data in the same shape the existing chapter indicator uses, not as
a style rule per phase, so that adding a phase requires no change to the rendering path.

An unrecognized phase SHALL render with no colour applied and its raw identifier shown. The phase is
recomputed from a predicate ladder each step and self-heals, so an unknown value is transient:
colouring it as though it were a real phase would assert something false, and hiding it would drop
the signal entirely.

Consecutive phases SHALL be far apart in hue, because an indicator whose change goes unnoticed has
not indicated anything.

#### Scenario: Each phase shows its own colour

- **WHEN** the run is in any recognized phase
- **THEN** the pill renders that phase's authored colours and its label

#### Scenario: An unrecognized phase degrades honestly

- **WHEN** the stored phase matches no authored pill
- **THEN** the pill renders uncoloured with the raw identifier, and is corrected on the next step

#### Scenario: Adding a phase needs no rendering change

- **WHEN** a new phase and its pill are authored in data
- **THEN** it renders without any edit to the component
