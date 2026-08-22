# Act VII — the Contracts panel: the optional board, and the end of the placeholders

## Why

`engine/contracts.js` shipped with STORY-030 and its `listOffers()` has had **no consumer at all**
since the day it landed. Twelve contracts, a three-slot board, a two-slot acceptance ceiling, a
makeup-game rescheduler and five authored refusal sentences have been running in the tick loop with
nowhere on screen that says so. The three actions (`ACCEPT_CONTRACT`, `CLAIM_CONTRACT`,
`ABANDON_CONTRACT`) were wired to the reducer and reachable from nothing.

The design constraint is not the rows, it is **the framing**. §6.4 makes `contracts` the only purely
*optional* tab in the act — a player who never opens it still finishes, slowly, which is Decision 3.6
applied to the fuel economy. An opportunity and a chore are the same list of rows and differ only in
how the screen presents them. A board opening with "3 assignments outstanding" would convert an offer
into an obligation and make every player who ignores it feel behind, which is the precise failure
§9.1 guards against.

**This is also the sixth and last panel**, so `PlaceholderPanel.js` loses its final consumer.

## What Changes

| File | Change |
|---|---|
| `components/expedition/ContractsPanel.js` | **Rewritten.** The board from `listOffers()`, rendered verbatim |
| `data/actSevenContractsConfig.js` | `contractCopy` extended with the panel's furniture — title, the optional statement, the slot cap, `statusFor()`, `showsBar()`, the three control labels |
| `components/expedition/PlaceholderPanel.js` | **Deleted.** Its last consumer is gone |
| `data/actSevenPanels.js` | `blurb`, `title`, `getActSevenPanel` and `ACT_SEVEN_PLACEHOLDER_NOTE` removed — every one had exactly one reader and it was the placeholder. `id` and `label` survive |
| `styles/global.css` | The `.v7-contract*` rules, inside `body.expedition`, above the trailing mobile block |

**No engine change at all.** `engine/contracts.js` is untouched: STORY-030 emitted a fully
presentation-ready row and this story found nothing missing from it. No balance moves.

## Capabilities

### New Capabilities

- `game-feedback/expedition-contracts-panel`: how a system of *optional* opportunities is presented
  so it does not read as an obligation — and how a surface renders a payout whose value is
  deliberately not yet known.

## Impact

- **Act VII is complete.** Six panels plus the standings board; no `PlaceholderPanel` remains in the
  codebase.
- **The three id lists were re-verified**, which §6.4 asks for because two of the three fail
  silently: a missing key in AppShell's `PANELS` renders nothing, a missing `TabNav` entry makes the
  tab unreachable, and `npm run build` catches neither. All seven ids agree in both directions.
- **`data/actSevenPanels.js` shrank to what it is for.** Five rows each carried a paragraph arguing
  `blurb` was kept "because the field is part of this list's shape". The moment the last reader went,
  those paragraphs were defending a field against its own absence of purpose; the fields and the
  paragraphs went together.

## Out of Scope

- **No engine change.** If a figure this panel needed were missing, that would be a gap in STORY-030
  to raise. Nothing was missing.
- **No board-refresh surface.** `nextOfferAtClock` is the board's own rotation clock and the player
  meets its result — a new offer appearing — rather than a countdown to it. A timer to the next
  refresh would turn an optional board into something to wait for, which is the framing this whole
  panel is built to avoid.
- **No history of filed contracts.** `contractBoard.completedIds` is a payout-once ledger, not a
  trophy case, and `EventFeed` already reports each claim as it happens.
