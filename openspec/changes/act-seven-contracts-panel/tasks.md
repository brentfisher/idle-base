# Tasks — the Contracts panel

## 1. The engine

- [x] **Untouched.** `engine/contracts.js` needed no change: STORY-030 emits a fully
      presentation-ready row (§9.6) and this story found nothing missing from it.
- [x] Confirmed `listOffers()` had no consumer anywhere in `src/` before this change, and that the
      three actions were wired to the reducer but reachable from nothing.
- [x] Confirmed only three statuses ever reach the row list — a claimed instance is REMOVED and its
      id written to `completedIds`, so there is no "done" row the panel must filter.

## 2. The panel

- [x] `ContractsPanel.js` renders real content; `PlaceholderPanel` is no longer imported.
- [x] The board renders from `listOffers()`; the panel resolves no payout and no availability.
- [x] Each row shows what it asks for (`terms`) and what it pays, from the engine's values.
- [x] **The payout is `effect` and NEVER `payoutFuel`/`payoutSalvage`** (design Decision 1) —
      asserted mechanically against comment-stripped source.
- [x] Accept / File it / Drop dispatch through `state/actions/contractActions.js`; each control is
      gated on the engine's own flag; a refused action is a no-op by identity.
- [x] The refusal sentence is rendered verbatim rather than the row being silently disabled
      (Decision 5).
- [x] A `state` contract draws no bar (Decision 4), and the test lives in the config because it is a
      rules question.
- [x] The offer deadline is omitted where there is none, and cannot survive acceptance — the engine
      nulls it (§9.4).
- [x] **An offered `window`/`expedition` row shows no progress at all**, because the engine's
      fallback reports a clock that is not running (Decision 7). Other kinds keep theirs.
- [x] **Walking away is labelled and explained per status** — Decline/Drop, and only the accepted
      row's note promises the slot back (Decision 8).
- [x] **No makeup badge.** The name and the brief already say it twice (Decision 9).
- [x] An empty board renders its authored sentence, not an empty div.
- [x] **No `Date.now()`, no timer.** Every duration arrives already formatted from the engine,
      measured against `state.clock`.
- [x] **The row's `phase` is never drawn** — ledger R3 (Decision "what is not here").

## 3. The framing — §6.4's optional tab

- [x] `optionalNote` above every row, at full ink, never `.muted`.
- [x] `panelIntro` rendered beneath it — STORY-030 authored it for this screen; it is rendered, not
      restated — and the two say different things (Decision 3).
- [x] The slot cap stated from `MAX_ACTIVE_CONTRACTS` rather than spelled, so a retune moves it.
- [x] No row wears `--v7-alert` for an ordinary state; the offer deadline is muted, not urgent.
- [x] Drop is an outline button and NOT `danger`. §9.4 attaches no penalty, and the panel says so —
      a player who suspects one hoards a slot on an assignment they cannot finish.

## 4. The words

- [x] `contractCopy` extended in `data/actSevenContractsConfig.js` rather than a new panel config
      file (Decision 2). No player-facing string literal anywhere in the component.
- [x] `statusFor()` and `showsBar()` follow `actSevenSitesPanelConfig.js`'s pattern — an `id` rides
      along so the stylesheet keys on it without the component mapping words to class names.

## 5. Retiring the placeholder — the last of the six

- [x] `components/expedition/PlaceholderPanel.js` **deleted**.
- [x] `blurb`, `title`, `getActSevenPanel` and `ACT_SEVEN_PLACEHOLDER_NOTE` removed from
      `data/actSevenPanels.js`. **Decided by grep, not by the story's prose** — which predicted
      `title` would survive and it did not, because every panel authors its own `<h2>` (Decision 6).
- [x] The five per-row paragraphs arguing `blurb` was kept "because the field is part of this list's
      shape" were removed with the field they were defending.
- [x] `id` and `label` kept — `TabNav` spreads them, `AppShell`'s `PANELS` is keyed by id.
- [x] A comment-stripped sweep of every `.js` file under `src/` finds no remaining reader of any
      removed symbol. Comments are stripped because the file's own header now argues these symbols
      have no reader, and an unstripped sweep finds the argument and calls it one.
- [x] **The three id lists re-verified in both directions** — the check §6.4 asks for because two of
      the three fail SILENTLY and `npm run build` catches neither (Decision 6a).

## 6. CSS

- [x] `.v7-contract*` as ONE contiguous block inside `body.expedition`, above the trailing
      `@media (max-width: 640px)`, with the placement warning every Act VII block carries. This is
      the last of the six and the hazard has fired twice during the wave; it did not fire here.
- [x] Verified mechanically: the block's header precedes the file's last `@media (max-width: 640px)`
      and no rule in it is unscoped.
- [x] `.v7-meter` / `.v7-meter-fill` reused unchanged — no new primitive, no fork.
- [x] `flex-wrap` on both horizontal groups (the head row, the action row).
- [x] Buttons are 44px minimum height, matching `.v7-artifact-submit` and `.v7-launch-button` — one
      button shape in the act, not three.
- [x] No `!important`.
- [x] Contrast (WCAG relative luminance, all on the chip ground the card uses): ink/chip 15.10,
      muted/chip 7.38, accent/chip 10.70, good/chip 10.05, alert/chip 6.81, accent-ink/accent 10.60.
      No new pairing; all clear the 4.7 floor.

## 7. Verification

- [x] `npm run build` passes (3 pre-existing bundle-size warnings, unchanged).
- [x] Driven under `node` with a Babel require-hook, **165 assertions**, engine AND reducer AND mount
      (through `react-dom/server` inside a `GameContext`), across twelve fixtures. Harness deleted; the
      record is the `VERIFIED (STORY-040)` block at the foot of the component.
- [x] **An empty board**: the authored sentence, no buttons, all three preamble lines, and the
      optional statement asserted NOT to be `.muted`.
- [x] **A populated board**: `refreshBoard()` placed three offers; every name, brief, terms, payout
      string and progress label compared against the engine's row. The phase is asserted ABSENT.
- [x] **PTBNL**: the band is on screen, `+1000 Fuel` is not, and after accepting with a roll of 0.5
      the row quotes 1,125 and the panel shows it.
- [x] **Active and claimable**: accepting discharges the deadline; delivering and stepping
      `advanceContracts()` flips it claimable; claiming removes the instance, writes `completedIds`,
      and a replayed claim returns the identical object by `===`.
- [x] **Both actionable refusals rendered verbatim** — `slots` (a third offer with two open) and
      `tank` (a 900-Fuel payout into a colony with no tank), the latter returning the identical state
      object so a refused claim has taken nothing.
- [x] **The `state` kind**: no `.v7-meter` in the markup at all, while a quantity row in the same run
      draws one.
- [x] **Saves that must not throw**: no `expedition` key (and none materialised); a fresh Act I save;
      `clock: 'lots'` rendering with no `NaN` anywhere.
- [x] Purity: a full render plus `listOffers()` leave the state byte-for-byte unchanged.

## 8. Found in review, and fixed

- [x] **An offered window row printed "10:00 remaining" for a clock that was not running**, one line
      from `expiresLabel`'s real countdown — two opposite time semantics in identical treatment. The
      original harness asserted the panel printed what the engine returned, which is exactly the
      assertion that cannot notice this. Fixed by `showsProgress()`; nothing is lost, because those
      contracts state their window in their own `terms`.
- [x] **"The slot comes back" was false on an offered row.** The two-slot ceiling counts ACCEPTED
      assignments, so declining an offer returns nothing. Same class as STORY-039's Cryo wording: a
      sentence true in one state and false in another, invisible to an assertion that only checks
      the string is present.
- [x] **The makeup badge was a third statement of one fact.** Rendered a makeup fixture and found the
      name already reads "Makeup Game: Bus Trip" and the brief already opens "Rescheduled:". Badge
      and its CSS removed.
- [x] **The `majors` rotating row had no fixture**, and it is the only `kind` path any other fixture
      misses — `definitionFor()` merges the drawn template's kind over the base, so `rotating` never
      reaches `listOffers()`'s ternary. All five templates now rendered and asserted.

## 9. Found while building

- [x] **The claim fixture needed a Fuel Bladder, and that is a finding rather than setup.** Fuel's
      base capacity is 0 and `creditResource()` refuses rather than clamping, so on a fresh colony
      EVERY payout on this board is refused on `tank`. The first version of the fixture asserted
      nothing about claiming because of it. That refusal is now exercised deliberately as its own
      fixture, and it is the single most important sentence on the screen.

## 10. Out of scope, deliberately

- [ ] **No engine change and no balance change.** Nothing in `engine/contracts.js` or the twelve
      contracts moved.
- [ ] **No countdown to the next board refresh.** The player meets a new offer appearing, not a timer
      to it; a countdown would turn an optional board into something to wait for.
- [ ] **No history of filed contracts.** `completedIds` is a payout-once ledger, not a trophy case,
      and `EventFeed` already reports each claim.
