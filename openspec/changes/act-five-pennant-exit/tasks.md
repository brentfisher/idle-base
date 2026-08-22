# Tasks — the Act V pennant exit

## 1. The stall

- [x] Diagnosed: `minorsPennantWon` was declared in `data/acts.js` and referenced **nowhere else in
      `src/`** — no `EXIT_PREDICATES` entry, no writer. `isExitSatisfied()` fell through to a
      milestone nothing could set.
- [x] Measured before the fix: six simulated hours in Act V, 18 seasons, a 40,000-seat stadium and a
      95-rated roster — still act 4, `championships: 0`, `season.playoffs: null`, `milestones: {}`.
- [x] Confirmed the act could not deliver its stated exit either: `playoffTeams: 0` means no bracket
      is built, and `championships` only increments from `resolved.champion` on the playoff path.
- [x] Confirmed the reported symptom's chain: `prestige` unlocks in Act VI, `era` advances only in
      `resetForPrestige()`, so a stuck save reads "Sandlot Era" forever.
- [x] Validated the other six boundaries — all fire correctly. Act V was the only stall.

## 2. The fix

- [x] `EXIT_PREDICATES.minorsPennantWon` registered in `engine/progression.js`, reading the recap.
- [x] **A predicate, not a milestone**, per the rule at the head of that block: the fallback is for
      unimplemented exits and for Act VI's `callUpAccepted`, where one player action is the whole
      mechanism. A pennant is earned.
- [x] `finishedFirstLastSeason(state)` added to `engine/standings.js` — one reader for both acts.
- [x] `hasWonLittleLeagueTitle()` delegates to it; Act III keeps its own name for its own trophy.
- [x] Reads the recap and not the live standings, because `runOffseasonTransition()` resets the
      standings three lines after computing `finishedFirst`.

## 3. The note

- [x] `titleName` added to `data/acts.js` for the two acts that end on the standings — Act III's
      "the little-league title", Act V's "the pennant".
- [x] `feedMessages.topOfTheTable(seasonNumber, titleName)` added.
- [x] `tickEngine.js` emits it at the offseason, **before** the rollover line so the feed reads in
      the order it happened, gated on the act naming a trophy.
- [x] Act IV stays quiet (no postseason, but its exit is an accumulated win rate) and Act VI keeps
      narrating `championshipWon` through its own bracket.

## 4. The description

- [x] Act V's exit description corrected from "Fill a 10,000-seat stadium and win the minor-league
      pennant" to what the act actually ends on.
- [x] The 10,000-seat clause is **dropped rather than implemented** — nothing read it, and gating on
      capacity would be a pacing change to an act with no measured budget. Raised, not decided.

## 5. Verification

- [x] `npm run build` passes.
- [x] Driven under `node`, **69 assertions** across two harnesses (the exits, and the boundaries
      this fix newly exposes), all passing. Both deleted.
- [x] **Every act in the arc ends** when its exit is satisfied as the act describes it — all six
      boundaries plus Act VII confirmed terminal.
- [x] **And none ends early**: every act held at its own index when its exit was unsatisfied, and
      second place specifically does not take the pennant.
- [x] **One reader**: Act III's predicate and Act V's return identical results through
      `finishedFirstLastSeason`, and it is false for no season, no recap and a `null` recap.
- [x] **A real Act V playthrough crosses** — and the feed carries `First place. Season 1 ends with
      the pennant.` tagged `championship`, with prestige unlocked on the far side.
- [x] **The trophy and the crossing land on the SAME tick**, asserted against the state one tick
      earlier: the act does not end a season late. Exactly one pennant line is ever emitted.
- [x] **21 simulated minutes is a LOWER BOUND, not a pacing measurement.** The harness re-invests in
      the roster every step, because both acts unlock retirement and a one-time boost decays to
      mid-table over a dozen seasons. It bounds a player who keeps buying; it says nothing about a
      typical run, and this act's budget has never been measured.
- [x] **The 5 → 6 and 6 → 7 boundaries driven end to end**, from an Act VI arrived at BY PLAY rather
      than by `enterAct()` — before this fix nothing had ever crossed into either through play.
      Act VI restores a real postseason, a championship is won through the bracket and narrated, the
      call-up is offered and accepted, Act VII is reached with `aftermath`, five resolved sites, a
      colonized Home Plate, four resources and a frozen season, and an hour of Act VII runs clean.
- [x] `getActConfig()` confirmed to clamp at both ends and never return undefined, and Act VII's
      `seasonFrozen: true` confirmed to keep the offseason — and so the new trophy line — from ever
      running there.
- [x] **Act III is unchanged**: still ends in a real run, narrates its own title, and never claims
      the pennant.

## 6. Found while fixing

- [x] **Retirement washes out a one-time roster boost**, which is why the first end-to-end fixture
      proved nothing: both acts unlock retirement, so boosted starters age out over a dozen seasons
      and the team decays to mid-table. The run now re-invests each step, standing in for a player
      who keeps buying.
- [x] Two harness bugs corrected rather than reported as defects: Act IV's fixture used
      `recentSeasons` where the field is `seasons`, and feed entries are `{ category, text }` rather
      than `{ type, message }`. Act IV was never broken.

## 7. Out of scope

- [ ] **No postseason for Act V.** Adding one changes the act's shape and pacing.
- [ ] **No capacity gate on the exit** — see section 4.
- [ ] **`cardPacks`**: Act III unlocks a feature id that exists nowhere in `src/` — the same class of
      defect as this one, but harmless. Flagged, not fixed.
