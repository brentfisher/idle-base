const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { listSites, listOffers } = require('../../engine/sites');
const { sitesCopy, statusFor } = require('../../data/actSevenSitesPanelConfig');

// The affiliate ladder — each site a base, each base a pad, and every one of them a permanent bill
// (PRD §6.4, §7.1, §7.2). The screen that answers *where am I*, against the Launch tab's *can I go*.
// §6.4 splits them on that question and defends the split as a tab-budget decision.
//
// TWO SOURCES, NEVER ONE DERIVED FROM THE OTHER, and that is this file's central constraint rather
// than a preference. engine/sites.js says it in as many words: listSites() is "where am I",
// including sites with a build already running and sites finished with, while listOffers() is "what
// can I buy right now" — "a panel needs both and computing either from the other loses information
// the player is looking at". Filtering the ladder for buyable rows would drop the pad tiers already
// built and the builds already running; deriving the ladder from the offers would drop every site
// the player has finished with, which is most of the ladder by the end of the act.
//
// THE POINT OF THE SCREEN IS THE UPKEEP. §7.2's design is that expanding must be a DECISION and not
// a purchase, and the only thing that makes it one is the permanent draw on the shared pool. So:
//
//   * a purchasable row LEADS with what it will cost per second, before what it unlocks. That is
//     Decision 9 of openspec/changes/act-seven-site-ladder and it is a design decision, not a
//     formatting choice — engine/sites.js's describePadEffect() assembles the string in that order
//     for exactly this reason, and this file renders that string ABOVE the description rather than
//     below it so the ordering survives the trip to the screen.
//   * a colonized row prints its running bill in full, split three ways: the colony's own upkeep,
//     the pad's upkeep AFTER the site's `upkeepFactor`, and production. The Warning Track is
//     deliberately cheap to establish (6.0 minutes of income) and ruinous to sustain (a 6.0
//     factor), and a player who cannot see that has not been given the decision §7.2 is built
//     around.
//
// IT DECIDES NOTHING AND MULTIPLIES NOTHING. Every rate on this screen arrives already resolved
// from listSites(), which bills the pad through the same padUpkeepAt() engine/colony.js charges
// through — so the panel cannot quote a price the network is not actually paying. Every cost and
// every affordability flag arrives already resolved from listOffers(). The only computation in this
// file is choosing which blocks to render, and the words themselves live in
// data/actSevenSitesPanelConfig.js.
//
// THE LADDER IS INERT TODAY AND THAT IS CORRECT. A site is reached only by a launch, and
// engine/launch.js is a later story, so listOffers() correctly returns zero rows and Home Plate is
// the only colonized site. Everything below is written to read honestly in that state — a lone
// colonized rung, four destinations above it, and one authored sentence where the shop will be —
// and to come alive unchanged the moment a burn lands somewhere new. Nothing here stubs a launch.
//
// WHAT IS DELIBERATELY NOT HERE:
//
//   METERS. STORY-034's `.v7-meter` is sitting in the shared primitives and it is the wrong element
//   on this screen. §7.4 rules that Act VII has ONE resource pool and not one per site; a bar drawn
//   beside a site reads as that site's stock, which is precisely the thing the ruling says does not
//   exist. Rates only, with `poolNote` saying so in words.
//
//   ANY READING OF SATISFACTION. Reach comes from `reachesRung`, which engine/sites.js computes
//   from the built pad tier and nothing else, and no line here dims, warns or conditions on how the
//   colony is doing. §7.2's sharpest rule is that a starved network launches LATER and never
//   SHORTER, and a screen that greyed out a reach figure during a shortage would be teaching the
//   player the opposite of the rule the engine holds.

// One labelled group of rates on a ladder row. Renders nothing at all when the group is empty,
// which is the common case and not a defensive branch: Home Plate has no upkeep and no pad upkeep,
// and every other site has no production. A "Produces: —" line on four rows would be four
// repetitions of §7.1's point ("the Warning Track producing nothing is the design") made as an
// absence of data rather than as a fact.
function SiteRates({ label, rates, tone, format }) {
  if (rates.length === 0) return null;
  return (
    <div className="v7-site-line">
      <span className="v7-site-line-label">{label}</span>
      {rates.map((rate) => (
        <span key={rate.resourceId} className={'v7-rate ' + tone}>{format(rate)}</span>
      ))}
    </div>
  );
}

// One rung. Every site appears, in ladder order, whatever state it is in — an unreached site is a
// DESTINATION and gets its full name, its `where` and its authored description, because §7.1's
// ladder is the promise the act is making and a row reduced to a padlock would read as a paywall on
// a place the game is trying to make the player want.
function SiteRow({ site }) {
  const status = statusFor(site);

  return (
    <div className={'v7-site is-' + status.id}>
      <div className="v7-site-head">
        <span className="v7-site-rung">{sitesCopy.rungLabel(site.rung)}</span>
        <span className="v7-site-name">{site.name}</span>
        <span className={'v7-site-status is-' + status.id}>{status.label}</span>
      </div>
      <div className="v7-site-where">{site.where}</div>
      <div className="v7-site-description">{site.description}</div>

      {/* THE BILL, AND ONLY WHERE THERE IS ONE. Gated on `colonized` because that is what
          engine/colony.js gates the CHARGE on — a site you have flown past but not paid for has no
          colony on it and nothing to keep alive. Printing a prospective bill here would put a rate
          on screen that the network is not paying, and the place a player is meant to weigh that
          number is the shop row below, which leads with it. */}
      {site.colonized ? (
        <div className="v7-site-lines">
          <SiteRates
            label={sitesCopy.upkeepLabel}
            rates={site.upkeep}
            tone="is-drain"
            format={sitesCopy.upkeepRate}
          />
          {/* Kept apart from the colony's own upkeep rather than summed with it, because the two
              scale by different rules and that asymmetry IS `upkeepFactor`: a colony feeds itself,
              a pad has to be fed from the network, and distance is what that costs. One combined
              figure would hide the entire reason the Warning Track is the act's hard decision. */}
          <SiteRates
            label={sitesCopy.padUpkeepLabel}
            rates={site.padUpkeep}
            tone="is-drain"
            format={sitesCopy.upkeepRate}
          />
          {/* Home Plate's 2.0 O2/s — the only free atmosphere in the game (§5.6, §7.1) and the only
              site production term in the act. Visibly a supply and not a draw: `is-good` against
              the upkeep lines' `is-drain`, and a leading plus against their minus. */}
          <SiteRates
            label={sitesCopy.producesLabel}
            rates={site.produces}
            tone="is-good"
            format={sitesCopy.produceRate}
          />
        </div>
      ) : null}

      {/* The pad, and how far it throws. Gated on a pad EXISTING rather than always rendered,
          because siteReach() answers 0 for a site with no pad and "reaches rung 0" on four rows is
          worse than silence — it would state a capability where there is none.

          `reachesRung` is the engine's number, read straight off the row. It is never recomputed
          from `launchPadTier` here: two implementations of "how far does tier N throw" is exactly
          the off-by-one that engine/sites.js's applyCompletedBuild() refuses to introduce on the
          write side, and the read side has no better excuse. */}
      {site.launchPadTier > 0 ? (
        <div className="v7-site-pad">
          <span className="v7-site-pad-name">{site.padName}</span>
          <span className="v7-site-reach">{sitesCopy.reachLabel(site.reachesRung)}</span>
        </div>
      ) : null}

      {/* One build per site at a time (§7.7) — a rule the player should be able to SEE, which is
          why the running build gets its own line on the row that is busy rather than a global
          "something is building" notice. Keyed on `buildingId` rather than on the label, so a
          `buildingId` no pad tier answers to still reads as a busy site; the copy owns that
          fallback sentence. */}
      {site.buildingId ? (
        <div className="v7-site-build">
          {sitesCopy.buildingLabel(site.buildLabel, site.buildSecondsRemaining)}
        </div>
      ) : null}
    </div>
  );
}

// A purchasable row, in the house shop shape — the same `.v7-row` primitives Fab and the standing
// order board draw, because engine/sites.js emits the same contract engine/actSevenModules.js does.
//
// THE EFFECT STRING SITS ABOVE THE DESCRIPTION, WHICH IS THE ONE PLACE THIS ROW DIFFERS FROM
// FabPanel's. That string leads with the upkeep (Decision 9) and the ordering is the design; a
// module's row can afford to open with what the thing is, because a module's cost is paid once and
// is over. A site's is not.
function SiteOffer({ offer, onBuy }) {
  return (
    <div className={'v7-row' + (offer.affordable ? '' : ' is-unaffordable')}>
      <div className="v7-row-main">
        <div className="v7-row-name">{offer.name}</div>
        <div className="v7-site-offer-effect">{offer.effect}</div>
        <div className="v7-row-effect">{offer.description}</div>
        <div className="v7-row-note">{sitesCopy.buildTimeNote(offer.buildSeconds)}</div>
      </div>
      {/* Disabled on the engine's `affordable`, so the only way to reach purchase()'s refusal is a
          stale render — which state/actions/sitesActions.js turns into a no-op by identity. */}
      <button
        type="button"
        className="v7-row-cost"
        disabled={!offer.affordable}
        onClick={onBuy}
      >
        {sitesCopy.costLabel(offer.cost)}
      </button>
    </div>
  );
}

function SitesPanel() {
  const { state, dispatch } = useGame();
  // Both accessors reach the slice through engine/colony.js's expeditionSlice() rather than reading
  // `state.expedition` here, which is what makes this panel correct against a save with no
  // `expedition` key at all — saves are never migrated in this codebase, so absent must read as
  // empty, and it does so in the accessor and not in a guard on this line.
  const sites = listSites(state);
  const offers = listOffers(state);

  return (
    <div className="panel">
      <h2>{sitesCopy.title}</h2>
      <p className="muted">{sitesCopy.subtitle}</p>

      <h3>{sitesCopy.ladderTitle}</h3>
      <p className="muted">{sitesCopy.ladderNote}</p>
      <p className="muted">{sitesCopy.poolNote}</p>
      <p className="muted">{sitesCopy.reachNote}</p>

      {/* resolvedSites() returns [] on every save before Act VII, so the empty branch is reachable
          for real rather than defensively — the panel is routed by a tab that only Act VII reveals,
          but AppShell's PANELS map is not a proof and this component is one require away from any
          screen. A sentence rather than an empty div, for the reason FabPanel gives about a heading
          over nothing. */}
      {sites.length > 0
        ? sites.map((site) => <SiteRow key={site.id} site={site} />)
        : <p className="muted">{sitesCopy.emptyLadderNote}</p>}

      <h3>{sitesCopy.offersTitle}</h3>
      <p className="muted">{sitesCopy.offersNote}</p>

      {/* ZERO ROWS IS THE HONEST STATE TODAY AND IT IS NOT AN ERROR. A site is reached only by a
          launch, so before the first burn there is nothing to establish. The section is rendered
          anyway, with its authored line, because a shop that vanishes when it is empty teaches the
          player that the screen sometimes has a bottom half and sometimes does not — and this one
          gains its first row the moment L1 lands, without any edit here. */}
      {offers.length > 0
        ? offers.map((offer) => (
          <SiteOffer
            key={offer.id}
            offer={offer}
            onBuy={() => dispatch({ type: actionTypes.BUY_SITE_BUILD, offerId: offer.id })}
          />
        ))
        : <p className="muted">{sitesCopy.emptyOffersNote}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// VERIFIED (STORY-037), under `node`. This repo has no test runner and `npm run build` transforms
// JSX without ever MOUNTING it, so a throw on mount ships with a green build — STORY-032 hit
// exactly that and STORY-036 records it too. The harness below was run (99 assertions, all passing)
// and then deleted; what it asserted is the record. It drove the engine directly AND mounted this
// component through react-dom/server inside a GameContext, for six fixtures.
//
// FRESH ACT VII — the state the act actually opens in, and the one this story had to make read
// honestly:
//   * five rows in rung order 0..4, ZERO offers, and Home Plate the only colonized site. That is
//     the ladder working: a site is reached only by a launch and engine/launch.js is a later story.
//   * Home Plate carries the Sandlot at tier 1, `reachesRung` 1, no upkeep of either kind, and a
//     single production row of 2.0 Oxygen/s — the act's only free atmosphere, rendered as `+2.0
//     Oxygen/s` and never as an upkeep line.
//   * the four sites above it are `reached: false`, tier 0, reach 0. THE MARKUP CONTAINS NO
//     "Reaches rung 0" AT ALL, which is the check that the reach line is gated on a pad existing
//     rather than always drawn.
//   * every site's name, `where` and description is in the markup — asserted against the engine's
//     own return values rather than a hardcoded list, because a hardcoded list cannot catch a panel
//     that recomputed something. No <button> anywhere, and the authored empty-shop sentence.
//   * NO `v7-meter` IN THE MARKUP, asserted explicitly. §7.4's one-pool ruling, held by absence.
//
// A SITE REACHED (markSiteReached(state, 'onDeck')) — the state the panel comes alive in:
//   * exactly one offer, `colonize@onDeck`, 9,000 Salvage, and its effect string is
//     `-2 power/s, -1.5 oxygen/s, -1 provisions/s` — UPKEEP FIRST, rendered verbatim.
//   * IN THE SHOP HALF OF THE MARKUP, the effect string appears BEFORE the description. That is
//     Decision 9 and it was checked scoped to the shop half, because the ladder row above prints
//     the same description and an unscoped search passes for the wrong reason.
//   * the ladder row reads `Reached — no colony yet` and prints NO upkeep line, because
//     engine/colony.js bills on `colonized` and a rate on screen that the network is not paying
//     would be the panel lying in the direction that costs the player money.
//   * at 9,000 Salvage the button is enabled; at 8,999 the row carries `is-unaffordable` and the
//     button is `disabled`. The boundary is the engine's, not this file's.
//   * dispatching BUY_SITE_BUILD debits to 0, writes the build, and the offer LEAVES the shop while
//     the site is busy — "one build per site at a time" as the player meets it. The ladder row then
//     shows `Colonize The On-Deck Circle — 2m 0s left` against a clock of 60 on a 180s window.
//   * a REPLAYED purchase and a malformed offer id both come back from the reducer as the IDENTICAL
//     state object, by `===`.
//
// A PAD BUILT (onDeck at tier 2) — and this is the check that discriminates a read from a
// re-derivation:
//   * `reachesRung` is 2 and equals siteReach() called directly. The component never touches the
//     tier.
//   * base upkeep prints Power 2 / Oxygen 1.5 / Provisions 1, unscaled. Pad upkeep prints Power 1.8
//     / Provisions 0.48 — the Mound's 1.5 and 0.4 through On-Deck's 1.2 `upkeepFactor` — and the
//     two are separate labelled lines rather than one sum, because they scale by different rules.
//   * THE NUMBERS ON THE SCREEN EQUAL THE DELTA IN colonyRates().demand FOR THAT SITE, to within
//     1e-9, on Power and on Provisions. That is the assertion this whole design exists to be able
//     to make: the panel and the solve go through the same padUpkeepAt(), so the screen cannot
//     quote a price the network is not charging.
//   * 0.48 renders as `−0.5 Provisions/s`. One decimal place is the act's house rate format
//     (ResourceChips, OpsPanel) and the rounding is deliberate rather than a defect.
//
// THE TWO SAVES THAT MUST NOT THROW:
//   * `expedition` DELETED entirely: renders the full five-rung ladder and zero offers, and the
//     state object still has no `expedition` key afterwards — expeditionSlice() defaulted it
//     without materialising one.
//   * A FRESH ACT I SAVE, where resolvedSites() returns []: both accessors come back empty, the
//     panel renders the authored empty-ladder sentence, and the markup names NO site at all.
//
// CORRUPTION, because a save is a file on somebody's disk:
//   * a `buildingId` no pad tier answers to renders the copy's fallback line and NEVER the raw id.
//   * `clock: 'lots'` yields a FINITE `buildSecondsRemaining` rather than NaN, which is the whole
//     reason that subtraction lives in engine/sites.js and not here.
//
// PURITY: listSites(), listOffers() and a full render leave the state byte-for-byte unchanged.
// ---------------------------------------------------------------------------------------------

module.exports = SitesPanel;
