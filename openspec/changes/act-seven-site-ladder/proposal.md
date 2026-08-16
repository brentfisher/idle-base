# Act VII — the site ladder, colonization, launch pads and the phase writer

## Why

STORY-025 landed a module ladder whose capacity sum has a term for sites and no sites to sum. The
act's economy works; the act's *spine* does not exist yet.

**The spine is one sentence: to launch further you must colonize, and a colony is what lets you
build the places you launch from.** Five rungs, strictly ordered. You cannot skip second base — and
the fiction and the gating are the same sentence, which is the mapping this act has been paying out
since it was named.

Without this change there is nowhere to go, `expedition.phase` is a field nothing recomputes, and
the Fuel term STORY-025 deliberately wrote against an empty list stays empty.

## What changes

| File | Change |
|---|---|
| `data/actSevenSitesConfig.js` | The five-rung ladder, the five pad tiers, upkeep and capability flags, the derived tank floor |
| `engine/sites.js` | **New.** The shop (`listOffers`/`purchase`/`resolveBuilds`/`nextBuildClock`), reach, and the phase writer |
| `engine/colony.js` | `resolvedSites()` — the record shape, joined to config on every read; site upkeep and production in the ration |
| `engine/tickEngine.js` | `nextBuildClock` on STORY-017's contributor list; `writeExpeditionPhase` once per iteration |
| `engine/actSevenModules.js` | Site capability flags resolved through the same records |
| `data/actSevenConfig.js` | The phase list, `phaseRank`, and the over-the-wall milestone id |

## The decisions worth arguing about

**Reach is a function of built pad tier alone — never of current satisfaction.**

This is the sharpest rule in §7.2 and it is Decision 3.3 applied to a capability. A pad whose reach
degraded when the colony ran short of Power would be destruction with extra steps, and worse, it is
destruction that arrives *while the player is asleep* — starvation happens during an offline
catch-up as readily as during play. A player who returns to find the burn they spent forty minutes
filling for is no longer legal has been punished for closing the tab.

**Starvation costs RATE. It never costs a CAPABILITY.** `siteReach()` is therefore a pure function
of one stored integer, which forecloses the whole "why can't I launch, I could yesterday" bug class
by construction rather than by testing for it.

**One build per site at a time.** A site's crew can only do one thing. That is a design constraint
as much as a simplification: owning four sites means four builds run in parallel, so the network's
build throughput is itself a reason to colonize. It also collapses colonization windows and pad
windows into a single `readyAtClock` per site — one `findNextEventClock` contributor instead of two,
and at most five boundaries in an eight-hour catch-up against a cap of 2,000.

**`engine/sites.js` is the single writer of `expedition.phase`, and the scan takes the
highest-satisfied rung rather than stopping at the first unsatisfied one.**

The field is stored because §4 binds it, but it is recomputed from a pure predicate ladder every
`advance()` and written only when it differs. Highest-satisfied is what makes this *self-healing*
rather than merely recomputed: the predicates are not guaranteed to be nested, so a save that
satisfies `lunar` but not `lifeSupport` would be pinned at `aftermath` forever by a first-failure
scan. Taking the highest satisfied rung means a save can under-report its progress for one tick and
never permanently.

Ledger **R4** refused §6's request for parallel `phaseLifeSupport` / `phaseLunar` milestones for
this reason — two sources of truth for "how far into the act are we" is a race that surfaces only on
somebody's real save, and one of the two is always the one a given gate happens to read.

**Every gate is a rank comparison, never an equality test.** "At least `lunar`", not "is `lunar`".
The fabrication shop's `aftermath` rows are the concrete case: they must stay buyable forever, and a
rung that vanishes from under a player the moment they progress past it is a ladder nobody can
climb.

**Exactly one pad tier is buildable per rung — the narrow reading of §7.2.**

§7.2's "buildable at" column and its per-site max-tier table only agree if a tier-N pad sits on rung
N-1. The loose reading lets a player buy a pad reaching a rung they cannot legally fly to:
permanent upkeep for no capability, which is Decision 3.3 broken by omission rather than by intent.

**The tank floor is derived, not authored.** `fuelCapacityOnArrival = 1.6 × departingThreshold` —
the one piece of arithmetic this data file is allowed to do. §7.3's argument is that the overshoot
band must be *structural* rather than a coincidence between two sections' tuning; two hand-typed
numbers drift apart the day either is retuned, and the launch-now-or-hold decision quietly stops
existing. Note `departingThreshold` is the threshold of the launch *leaving* the site, not arriving
at it: the tank you fill is the tank at the place you are standing.

**Costs are recomputed against the measurement, not copied from ledger R2.** R2 is a
*reconciliation*, not a measurement — it recomputed §7.5's estimate-derived costs against §5.2's
authored bands, themselves an authored table. STORY-025 then measured the ladder and found
`lifeSupport` earning 2.6× its §5.3 budget. Copying R2 forward would inherit the exact class of
error R2 was written to correct, one layer down. What is held is R2's stated *intent* — minutes of
income at that beat — with the cost recomputed from what the economy actually pays.

Colonizing the Warning Track stays deliberately **cheap to establish and ruinous to sustain**: 6.0
minutes of income against a 6.0 `upkeepFactor`. That inversion is the site's whole character and
§7.5 asks explicitly that it survive retuning. It has.

## Verified, and what is deferred

Verified exhaustively: the 1.6× tank floor at all five sites, one pad tier per rung, and Home Plate's
Fuel grant staying withheld until a tank is owned — 0 capacity at act start, 2,320 on the first
400-unit Bladder, the two grants arriving together on the purchase ledger R1 says should carry them.
`resolveBuilds()` idempotent by identity, `nextBuildClock()` never returning 0, the phase writer
healing a hand-edited `majors` back to `lunar` and abstaining outside Act VII entirely.

**The minutes-of-income figures are deliberately not measured here.** Every purchase this change
prices happens in `lunar` or later; a site is reached only by a launch, and launches are STORY-028.
`listOffers()` correctly returns zero rows for the whole of `aftermath` and `lifeSupport`, so a run
measuring the cost ladder on this branch would have to synthesise the arrival times it was pricing
against. Ledger **R8** puts later stories on the measurement, and STORY-028 is the first branch on
which this ladder can be played at all.

Naming: every name added here — Home Plate, the On-Deck Circle, the bases, the Warning Track, and
the Sandlot / Mound / Long Toss / Cutoff / Swing pads — is a term the sport already owns, so
`data/actSevenNamingConfig.js`'s one prohibition is satisfied without exception.
