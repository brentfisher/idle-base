# Design — the site ladder, colonization, launch pads and the phase writer

## Decision 1: The record stores six fields and everything else is resolved from config

A stored site record is `{ id, reached, colonized, launchPadTier, buildingId, readyAtClock }` and
nothing more. Rung, upkeep, production, capability flags, the Fuel grant and every cost are looked
up from `data/actSevenSitesConfig.js` on every read.

This codebase never migrates a save. Anything denormalized into one is frozen at the value it had
the day it was written, so a retune would reach new saves and silently skip every existing one.
Resolving from config on read means a balance edit lands on every save on the next tick.

It also lets Home Plate exist with **no stored record at all**: `reachedAtStart` and
`colonizedAtStart` live on the definition, so a fresh Act VII save carries an empty `sites` array
and still has a colonized rung 0 with a pad on it.

**Where the shape lives.** `resolvedSites()` is in `engine/colony.js`, not in `engine/sites.js`.
Three modules need a resolved site and only one of them is the sites engine; putting the shape in
`sites.js` would close a require cycle through `colony.js`.

**Corruption is read strictly.** `=== true` throughout rather than truthiness, because these fields
arrive from a save file and the truthy-but-not-`true` values are all corruption. A mangled
`reached: {}` must not silently colonize a site the player never flew to — nothing in the act can
un-reach a site, so the failure is unrecoverable by play.

**`buildingId` without a finite `readyAtClock` reads as idle.** That pairing is load-bearing rather
than tidy: `buildingId` is what makes a site busy, `readyAtClock` is what makes it finish, and a
record with the first and not the second is a site permanently occupied and unable to complete — a
soft-lock on that rung and every rung above it. Reading the pair as idle turns a corrupt save into
a lost build instead of a dead run.

## Decision 2: The offer id carries the `buildingId` that gets stored

An offer id is `<buildingId>@<siteId>` — `colonize@onDeck`, `padTier3@firstBase`.

§7.7 specifies `buildingId` as `'colonize'` or `'padTier3'`, so making the offer id carry it means
`purchase()` writes the value it parsed rather than translating through a mapping table. One
vocabulary, nothing to keep in sync, and a build in progress can be traced back to the row that
started it by reading the save.

`parseOfferId` returns null for anything malformed rather than a partial parse. `purchase()` is
reachable from a dispatch, so this is real input validation: a `split()` returning one element would
otherwise hand an undefined site id to a lookup that answers "no such site" for the right reason by
accident.

## Decision 3: Every gate is re-checked in `purchase()`, not trusted from the listing

`candidateBuildFor()` is the single definition of what is legal, and both `listOffers()` and
`purchase()` call it. An engine that only enforces a rule in the function that *draws the button* is
not enforcing it at all.

The re-check is free precisely because it is the same function — there is no second copy to drift.

Refusal is `null` from the engine and an unchanged state from the reducer: an action the player
could not have taken through the UI is a no-op, not an error.

**Unavailable rows are omitted, not disabled**, matching every other shop in this game — locked
features are not rendered at all. A greyed-out Warning Track row during `lifeSupport` would spoil
three phases of the ladder in one screen.

## Decision 4: `resolveBuilds()` is idempotent by construction, not by a guard

A completed build clears `buildingId` and `readyAtClock`, so a replayed step finds nothing to do and
returns the state it was handed **by identity**.

This matters far more than it looks. `advance()` runs identically live and on load, with only
`deltaSeconds` differing, and one offline iteration can span eight hours. A completion path that
fired per-elapsed-*window* instead of per-pending-*record* would colonize a site twice on a long
return, or grant two pad tiers, or debit nothing and grant everything.

Ordering within a call does not matter and cannot: one build per site, and no build's completion is
an input to another's. Two sites finishing inside the same step both complete in one pass, which
keeps the offline iteration count at O(sites) rather than O(builds).

The identity return is the same discipline `integrateColony()` follows, for the same two reasons: it
makes "an 8h `advance()` with no builds pending is byte-for-byte unchanged" provable by reference
equality, and it keeps the tick loop from materialising an `expedition` slice into the six acts that
have no use for one.

**A completed build reads its tier from the stored `buildingId`, never `launchPadTier + 1`.** An
increment would be a second statement of what was bought, and the two could disagree — a hand-edited
save, or a future story granting a tier by another route, would produce an off-by-one reach. An
unrecognized `buildingId` grants nothing and is cleared: that costs the player the Salvage they
already spent, which is bad, against leaving the site permanently occupied, which is a soft-lock.

## Decision 5: `nextBuildClock()` excludes overdue builds

The contributor contract (`engine/tickEngine.js`) is: pure, guards its own slice, and returns
`Infinity` — never 0, null or undefined — when nothing is pending. Returning 0 pins `advance()`'s
step at zero and burns all 2,000 `safetyCapIterations` without moving the clock, silently discarding
the rest of a returning player's eight hours.

The overdue filter is why this is not a one-liner. A record whose `readyAtClock` is already in the
past is not a *future* event; proposing it makes `step` zero for that iteration, and while
`resolveBuilds()` at the foot of the same iteration does clear it, the loop has burned an iteration
on a step of nothing. It costs one line to avoid, and the case is reachable for real — a build
committed at the same instant a step boundary lands, or a hand-edited save.

## Decision 6: The phase writer abstains before Act VII, and that early return is not an optimisation

`writeExpeditionPhase()` returns early when `resolvedSites()` is empty, which it is for every act
before Act VII.

Without that return, an Act I save — which carries no `expedition` key at all — would have a slice
materialised into it on the very first tick, on every save in existence. `npm run build` catches
none of that. It is the same failure `integrateColony()`'s identity-return comment exists to
prevent.

For the same reason `resolvedSites()` is gated on the `ops` feature the Salvage faucet already uses,
and `nextColonyThresholdClock` now abstains on "no modules **and** no sites" rather than on modules
alone — it was otherwise about to abstain from a boundary it exists to report.

## Decision 7: `lunar` turns on arrival, `deepSpace` turns on commit

The asymmetry is deliberate (§7.6). A site whose `reachedPhase` is a given phase grants it on
**arrival**; a site whose `commitPhase` is a given phase grants it when a launch is **committed**,
not when it lands.

The teardown beat is the burn itself, so the eight-minute dead transit belongs to the budget of the
phase it opens rather than the one it closes — `lunar` would otherwise pay for eight minutes in
which nothing about `lunar` is happening.

The commit predicate reads the launch **log**, which is the same list in-flight launches live in: a
record with `resolved: false` is a burn under way and one with `resolved: true` is the same burn
afterwards. Because the phase turns on the record *existing* rather than on its state, the predicate
is monotone — the phase cannot fall back when the launch resolves, and nothing needs to be told what
"in flight" means twice.

It runs correctly against the empty list it has today. The rung is wired now rather than later
because the ladder must be complete for the rank comparison above it to be meaningful.

## Decision 8: The pad-by-id map is built at module load, against the local convention

`data/actSevenConfig.js` records that a load-time capture has twice made a test pass for the wrong
reason, and `engine/colony.js` scans its catalogue on every call for exactly that reason.

The difference is what the map is keyed on. The module catalogue is content a harness legitimately
injects into; the five pad tiers are the act's *structure* — there is no sixth pad and nothing
appends one at runtime. If that ever stops being true, this becomes a scan.

## Decision 9: The shop row leads with the upkeep

`describeColonizeEffect()` and `describePadEffect()` put the permanent draw first.

§7.2's design is that expanding must be a **decision** and not a purchase, and what makes it one is
the permanent draw on the shared pool. A row leading with what a site unlocks and burying what it
costs per second would be selling the player something. The Warning Track is the case that makes it
concrete — cheap to establish, ruinous to sustain — and a player who cannot see that before buying
has not been given the decision the section is built around.

The effect string is assembled from the same config the solve reads, so the shop cannot advertise a
number the engine does not honour. A pad's reach is stated as a **rung** rather than a site name
because the top pad reaches past the end of the ladder, where there is no destination to name.

## Decision 10: `markSiteReached()` is exported so `engine/launch.js` does not write records itself

STORY-028 resolves transits, and arrival is the one thing outside this file that must change a site
record. Exporting a writer keeps site records with a single author and keeps the shape note in
`engine/colony.js` true in one place.

It is idempotent and returns state by identity when the site is already reached: arrival resolution
is replayed on every offline catch-up, and a second call must be a no-op rather than a second write
of the same fact.
