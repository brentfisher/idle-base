# Design — launch commit, transit, arrivals and the overshoot

## Decision 1: No rng, anywhere, and the reason is the offline loop

`conventions.md` says randomness enters an engine as a defaulted `rng` parameter so behaviour can be
driven headlessly with a deterministic generator. This engine goes further and takes **none**.

`advance()` runs identically live and on load, differing only in elapsed time. Anything random
inside it is therefore rolled during an offline catch-up, in front of nobody, with no possibility of
the player seeing, influencing or auditing it. A burn that "fell short" while the tab was closed is
a loss the player cannot distinguish from a bug, and in an idle game punishing someone for closing
the tab is the one move that is never available.

So a committed launch **always arrives and never loses the Fuel**. The interesting decision is moved
to commit time, where the player is present, and made deterministic there.

## Decision 2: Committing spends the whole tank

The tank at every site holds `1.6 × departingThreshold` by derivation (ledger R1). Committing dumps
**all** of it, not the threshold — there is no change.

That single rule is what makes the extra 60% a decision. If commit spent exactly the threshold, the
surplus would be a leftover and banking it would be pointless; spending it all means the player
chooses between *go now* and *go faster with a grant*, and both are defensible. The overshoot is a
pure function of `fuelHeld / threshold`, so the choice is legible before it is made and reproducible
after.

## Decision 3: Thresholds are read from the site config, never restated

`data/actSevenSitesConfig.js` names this file in its own header and tells it to read
`departingThreshold` rather than copy it. Two hand-typed copies of one threshold is exactly the
drift the 1.6× tank derivation was written to foreclose — retune one and the overshoot band silently
stops being a band.

`departingThreshold` is the threshold of the launch **leaving** a site, not arriving at it. Home
Plate carries L1's 1,200 because L1 departs from Home Plate. The tank you fill is the tank at the
place you are standing.

## Decision 4: Arrival is written through `engine/sites.js`, not here

`sites.markSiteReached()` exists for this file — its comment says so — and is the single writer of
`reached`. Calling it rather than writing the record keeps site records with one author and keeps
the record-shape note in `engine/colony.js` true in one place rather than two.

It is idempotent and returns state by identity when the site is already reached, which composes with
Decision 5 below: arrival resolution is replayed on every offline catch-up and a second call must be
a no-op rather than a second write of the same fact.

## Decision 5: `resolveArrivals` is idempotent by construction

A resolved launch carries `resolved: true` and is never reconsidered, so a replayed step finds
nothing due and returns the state object it was handed **by identity**.

This is the same discipline `resolveBuilds()` and `integrateColony()` follow, for the same reason: it
makes "an 8h `advance()` with nothing pending is byte-for-byte unchanged" provable by reference
equality, and it keeps the tick loop from materialising an `expedition` slice into the six acts that
have no use for one.

The log and the in-flight state are **one list**. A record with `resolved: false` is a burn under
way; the same record with `resolved: true` is that burn afterwards. Two lists would need a migration
between them and would give the `deepSpace` predicate two places to look.

## Decision 6: Arrivals resolve before the phase writer, and beside builds

Ordering inside the loop body is deliberate. An arrival marks a site `reached`, which is the input to
the `lunar` predicate — resolving after `writeExpeditionPhase()` would leave a returning player one
whole iteration behind the rung they are standing on.

Ordering against `resolveBuilds()` is genuinely irrelevant, and that is stated in the code rather
than left to be rediscovered: a build is only ever committed by the player, so no arrival inside
`advance()` can start one, and no completing build can land a burn. They share nothing but the clock.

## Decision 7: The wake boundary abstains with Infinity and contributes at most one

The contributor contract is: pure, guards its own slice, and returns `Infinity` — never 0, null or
undefined — when nothing is pending. Returning 0 pins `advance()`'s step at zero and burns all 2,000
`safetyCapIterations` without moving the clock, silently discarding the rest of a returning player's
hours.

It abstains on the cheapest possible test (`slice.launches.length === 0`), which is every save in
every act until the first commit, and contributes **at most one** boundary ever afterwards: only one
launch can be in flight, because the ladder is strictly ordered and there is never a second legal
destination.

## Decision 8: One in flight is a consequence, not a scheduler

The legal destination is always the lowest unreached rung (§7.3), so there is never a second thing
to launch at. "Already in flight" is therefore a single refusal check rather than a queue, and the
invariant is upheld by the ladder rather than by bookkeeping that could disagree with it.

## Decision 9: Fuel debits through the colony, not the wallet

Fuel lives in `expedition.resources`, not `state.wallet`. `colony.spendResource` is the debit path;
`engine/wallet.js` is not. Routing a consumable through the wallet would put it in a ledger with
different clamping and different reporting, and the header would start disagreeing with the panel
about how much Fuel exists.

Committing spends a threshold the player provably holds, so no path here can take a resource below
zero — the guarantee the site-ladder change's Decision 6 states.
