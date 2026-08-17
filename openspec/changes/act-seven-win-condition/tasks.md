# Tasks — the win condition, the majors board, and the standing orders

## 1. The fifth burn

- [x] `OVER_THE_WALL_RUNG` (derived as `ACT_SEVEN_SITES.length`, never typed) and
      `OVER_THE_WALL_DESTINATION_ID` in `data/actSevenSitesConfig.js`.
- [x] **No `reachesWall` flag.** `padTier5.reachesRung: 5` stays the only input to reach, and reach
      stays one comparison — the file asked for this by name.
- [x] `beyondTheWall()` in `engine/launch.js`: a four-field pseudo-row (`id`, `rung`, `label`,
      `colonizeCost: 0`) so `currentLeg`, `blockedReasonFor`, `listOffers` and `purchase` need no
      `isWall` branch anywhere.
- [x] The wall's label and leg description in `data/actSevenLaunchConfig.js` — the entry whose
      absence that file recorded as load-bearing until this story.
- [x] Guarded on the launch log, not on the milestone: the last burn in the game cannot be offered
      twice, and the shop does not ask progression whether it may still sell something.
- [x] `colonizeCost: 0` is correct rather than a placeholder — overshoot on the final burn buys the
      shorter transit and no Salvage, and the ratio is read by the board instead.

## 2. The win condition and the phase

- [x] `purchase()` sets `progression.milestones.overTheWall` on the wall offer, in the same call
      that writes the launch record. **A commit, not an arrival.**
- [x] `withOverTheWallMilestone()` is idempotent, returns state by identity when already set, and
      does not materialise a `progression` slice.
- [x] `overTheWallGrants(state, slice)` gains its second clause: milestone set **and** no wall
      record still unresolved. Written as an absence so a hand-edited save fails open.
- [x] Act VII keeps `exit: null`. `overTheWall` collides with no act's exit id (checked against
      `EXIT_PREDICATES` and every `exit.id` in `data/acts.js`).
- [x] **No second phase path.** `writeExpeditionPhase()` is still the single writer and still
      recomputes from the predicate ladder every tick.
- [x] `resolveArrivals()` and `nextArrivalClock()` unchanged — the wall record is an ordinary
      unresolved launch, so **nothing is appended to `EVENT_CLOCK_CONTRIBUTORS`.**
- [x] `currentLaunchThreshold()`'s comment updated: its premise moved (the first branch now fires
      before the commit) and its answer did not — 42,000 either way, verified because
      `engine/contracts.js` multiplies `payoutPct` against it.

## 3. The placement

- [x] New pure `engine/board.js`: `placement`, `standings`, `boardSummary`, plus the shop pair.
- [x] New `data/actSevenBoardConfig.js`: nine rival systems, every weight and threshold, the order
      ladder, the placement lines and all prose. **No numbers and no strings in the engine.**
- [x] Five inputs, all deterministic, **no rng anywhere**: elapsed minutes, artifacts (unaided /
      hinted / bypassed / unresolved), contracts on the payout-once ledger, peak net Fuel/s, and the
      mean overshoot ratio across every burn — plus standing orders.
- [x] Returns a **breakdown**, not a score: seven rows that sum exactly to the win column, so the
      board says which line the run earned. Rounded once, at the end.
- [x] Elapsed time measured to the **commit**, not to `state.clock` — a finished run's board does
      not drift while the tab is open.
- [x] The act's zero is `progression.actEnteredAtClock`, which already existed. No second clock.
- [x] `peakFuelRate` sampled inside `integrateColony` where the solve already happened; monotone, so
      replay-safe by construction, and structurally unable to materialise a slice into six acts.
- [x] Budgets total 137.6 against the top rival's 141 — a perfect run finishes **second**, and the
      standing orders are what take it to first.

## 4. The board panel, reusing the standings layout

- [x] `components/league/StandingsTable.js` **extracted** from `StandingsPanel` — the six columns,
      the `.me` highlight and the overflow scroller.
- [x] It takes rows and a `highlightId`, not state: `PLAYER_TEAM_ID` and `resolveTeamName()` stay in
      the league panel, so this is one shared component and not one component with two modes.
- [x] `StandingsPanel` renders through it with unchanged behaviour.
- [x] The board reuses `sortStandings()` and `winPct()` from `engine/standings.js` rather than
      restating what a standings table is ordered by.
- [x] `components/expedition/BoardPanel.js` renders resolved rows, the earned line, the breakdown
      and the order row. It computes nothing.
- [x] `board` registered in all four places: `ACT_SEVEN_PANELS`, `unlocks`,
      `unlockedBy: { board: 'majors' }`, and AppShell's `PANELS` — **declared last**, because
      `visibleTabs[0]` is the fallback tab.
- [x] Act VII styles added **above** the file's final `@media (max-width: 640px)` block in
      `global.css`; `table.standings` is re-coloured into the act's palette and never re-laid-out.

## 5. The standing orders

- [x] A repeatable purchase, not a timed build: no `readyAtClock`, no contributor, no resolver, and
      an offline return cannot advance it by one order.
- [x] Salvage compounds (1.18) and **Fuel is capped** at half the Warning Track's tank — Fuel has a
      ceiling and a geometric Fuel price would soft-lock the only content in `majors`.
- [x] Salvage through `engine/wallet.js`; Fuel through `engine/colony.js`'s `spendResource()`.
- [x] **The refusing debit goes first.** Fuel is spent before the wallet is touched, so a purchase
      that cannot complete cannot take the player's Salvage and give them nothing.
- [x] The slice is read back off the fuel-spent state, never off the state passed in.
- [x] Gated on `phaseRank >= majors`, failing **closed** on an unrecognized phase — failing open
      would put the ending's shop in front of a player who has not finished the act.
- [x] `FILL_STANDING_ORDER`, `state/actions/boardActions.js`, one reducer branch; `null` from the
      engine is unchanged state from the reducer.
- [x] The sites stay live, the click stays, and the orders feed back into the placement, so the tail
      is a ladder rather than a sink with no effect.

## 6. Out of scope, stated rather than omitted

- [x] **No reset or replay axis.** §14 item 6's Service Time is sketched in `design.md` and left
      unbuilt so this ships.

## 7. Verification (driven under `node`, the repo's substitute for a test runner)

- [x] The offer appears only with The Swing built: without it, `blockedReason` is "The pad here does
      not throw that far. Build The Swing first."
- [x] **Commit sets the milestone and does not move the phase**; the tank goes to 0, the record is
      `resolved: false`, and a second commit is refused with `null`.
- [x] **Arrival moves the phase to `majors`** through `writeExpeditionPhase()` alone, and a repeated
      call returns state by identity.
- [x] A hand-edited save carrying the milestone and no launch record promotes to `majors` at once
      rather than being stranded in transit forever.
- [x] Pre-Act-VII saves are returned by identity; no `expedition` slice is materialised.
- [x] **Placement is deterministic**: the same finished run evaluated twice is identical across all
      ten rows, the rank, the earned line and every breakdown row.
- [x] Spread measured across three archetypes — 9th / 6th / 2nd — and six standing orders take a
      perfect run to first.
- [x] **AC #6, the frozen league**: `season`, `league` and `roster` are identical *by reference*
      across an 8h `advance()` spanning both the commit and the arrival, and `seasonFrozen` is still
      set afterwards. Filling an order in `majors` is likewise inert.
- [x] **An 8h `advance()` across the win does not storm**: one wall record, five launch records, no
      duplicates, one phase promotion, `peakFuelRate` monotone, and a replay of the identical span
      produces the identical log.
- [x] **§12's five-hour ceiling, optimal-buyer run — the measurement STORY-028 deferred here and
      STORY-031 re-confirmed.** The act is won at **291.8 minutes = 4.86 hours** against the
      5.00-hour ceiling. **It holds, by eight minutes.** Recorded in full in
      `data/actSevenSitesConfig.js` with the policy, the ladder and the bias direction; nothing was
      retuned to produce it.
- [x] `npm run build` passes.
