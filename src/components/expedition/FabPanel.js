const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { listOffers, listGoals } = require('../../engine/actSevenModules');
const { fabCopy, FAB_SECTION_ORDER, getFabSection } = require('../../data/actSevenFabConfig');

// The fabrication shop — generators, scrubbers, farms and tanks, and the act's one Salvage sink
// (PRD §6.4). The screen that makes Act VII a game rather than a faucet with nothing under it.
//
// RENDER ONLY, AND THE STRICTEST CASE OF IT IN THE ACT. engine/actSevenModules.js is the house shop
// contract's reference implementation and hands back rows with the price at the current owned
// count, the owned count itself, and affordability ALREADY RESOLVED against the wallet. This file
// recomputes none of the three. A component that re-derives affordability is the canonical bug
// `conventions.md` names, and it is worse here than anywhere else in the game: the price is
// `baseCost x growth^n`, so a second implementation of it would disagree with the debit at some
// value of n and the shop would start refusing rows it had drawn as affordable.
//
// components/lot/LotShop.js is the pair this is written against, and components/expedition/
// BoardPanel.js is the Act VII one — the row markup here is STORY-034's `.v7-row` primitives, which
// exist so Fab and Sites draw the SAME row rather than two that nearly match. Extend them; the
// additions this story made are marked as such in styles/global.css.
//
// THE THREE GATES REACH THIS FILE AS THREE DIFFERENT SHAPES, and that is the design content of the
// screen rather than an implementation detail:
//
//   * PHASE — the row is simply not in listOffers(). Nothing to render, and nothing here knows the
//     row exists. "The reveal is the reward" (AppShell.js): a greyed-out Fusion Ring in the
//     aftermath is three phases of spoiler.
//   * SITE CAPABILITY — likewise absent, and it FAILS CLOSED where the phase gate fails open. Do
//     not preview these. Drawing the Solar Wing before On-Deck is colonized would advertise the
//     cheapest Power in the act from minute one and delete the `lunar` phase's central beat; the
//     engine's comment on meetsSiteCapability() argues the asymmetry in full.
//   * SPEND (`requires`) — the row is withheld from the offers but IS returned by listGoals(), with
//     its prerequisites resolved into progress. It gets its own section, below the shop, with no
//     button on it. This is the one gate worth naming, because it names things already on the board
//     that the player already wants — so stating it turns a locked row into a plan.
//
// Unaffordable is none of those: an unaffordable row is drawn, dimmed and disabled. It is a thing
// the player can have in ninety seconds, and hiding it would hide the reason to keep clicking.

// A buyable row. The button is disabled on the engine's `affordable`, so the only way to reach
// purchase()'s refusal is a stale render — which state/actions/fabActions.js turns into a no-op.
function ModuleOffer({ offer, onBuy }) {
  return (
    <div className={'v7-row' + (offer.affordable ? '' : ' is-unaffordable')}>
      <div className="v7-row-main">
        <div className="v7-row-name">
          {offer.name}
          {/* Only once one exists. A "0 built" chip on every row of a fresh shop is nine lines of
              the same non-fact, and the row already says it is unowned by having no chip. */}
          {offer.count > 0 ? <span className="v7-row-owned">{fabCopy.ownedLabel(offer.count)}</span> : null}
        </div>
        <div className="v7-row-effect">{offer.description}</div>
        {/* The rates, verbatim. A storage row's grant arrives from describeEffect() as
            "+250 max power" with NO `/s`, because a tank grants capacity and never a rate — the
            engine is careful about that and this file's job is not to undo it by decorating. */}
        <div className="v7-row-effect">{offer.effect}</div>
        {offer.note ? <div className="v7-row-note">{offer.note}</div> : null}
      </div>
      <button
        type="button"
        className="v7-row-cost"
        disabled={!offer.affordable}
        onClick={onBuy}
      >
        {fabCopy.costLabel(offer.cost)}
      </button>
    </div>
  );
}

// A row the spend gate is holding. No button, because there is nothing to press: a priced control
// that can only refuse is worse than no control. The price is still shown, as a target.
function ModuleGoal({ goal }) {
  return (
    <div className="v7-row is-locked">
      <div className="v7-row-main">
        <div className="v7-row-name">{goal.name}</div>
        <div className="v7-row-effect">{goal.effect}</div>
        {goal.note ? <div className="v7-row-note">{goal.note}</div> : null}
        {/* Every prerequisite, satisfied ones included and marked. A list that dropped what was
            already done would shrink as the player closed on it, so the target would appear to be
            getting smaller and then disappear — the engine emits `met` for exactly this. */}
        <div className="v7-row-needs">
          {goal.requirements.map((requirement) => (
            <span
              key={requirement.id}
              className={'v7-row-need' + (requirement.met ? ' is-met' : '')}
            >
              {fabCopy.requirementLabel(requirement)}
            </span>
          ))}
        </div>
      </div>
      <span className="v7-row-cost">{fabCopy.costLabel(goal.cost)}</span>
    </div>
  );
}

// ONE SECTION OF THE SHOP: everything that makes, holds or earns one thing, buyable rows first and
// the rows a spend gate is still holding back beneath them.
//
// THE LOCKED ROWS SIT WITH THE RESOURCE THEY WOULD PRODUCE, and that is the whole point of the
// regrouping rather than a tidy side effect. They used to be collected under one "Not yet buildable"
// heading at the foot of the panel, which answers the question "what else is there" perfectly and
// the question a player actually arrives with — "why do I have no Fuel" — not at all. The Fuel
// section now contains the Electrolysis Stack with `7 Fission Piles · 3/7` written on it, which is
// the answer, in the place the question is asked.
function FabSection({ section, offers, goals, onBuy }) {
  if (offers.length === 0 && goals.length === 0) return null;
  return (
    <section className="v7-fab-section">
      <h3 className="v7-fab-section-title">{section.label}</h3>
      {section.note ? <p className="muted v7-fab-section-note">{section.note}</p> : null}
      {offers.map((offer) => (
        <ModuleOffer key={offer.id} offer={offer} onBuy={() => onBuy(offer.id)} />
      ))}
      {goals.map((goal) => <ModuleGoal key={goal.id} goal={goal} />)}
    </section>
  );
}

function FabPanel() {
  const { state, dispatch } = useGame();
  const offers = listOffers(state);
  const goals = listGoals(state);

  // Grouped here, ordered by the config. The section id arrives ON each row from the engine — this
  // file never inspects a module definition to decide where a row goes, which is the same rule that
  // keeps every other number on this panel the engine's.
  //
  // A row whose section is unrecognised still renders, under whatever `other` is called, because a
  // shop that silently drops a row a player has paid attention to is worse than an odd heading.
  const grouped = {};
  offers.forEach((offer) => {
    grouped[offer.section] = grouped[offer.section] || { offers: [], goals: [] };
    grouped[offer.section].offers.push(offer);
  });
  goals.forEach((goal) => {
    grouped[goal.section] = grouped[goal.section] || { offers: [], goals: [] };
    grouped[goal.section].goals.push(goal);
  });

  const sections = FAB_SECTION_ORDER
    .map((id) => ({ section: getFabSection(id), rows: grouped[id] }))
    .filter((entry) => entry.section && entry.rows);

  const nothingAtAll = offers.length === 0 && goals.length === 0;

  return (
    <div className="panel">
      <h2>{fabCopy.title}</h2>
      <p className="muted">{fabCopy.subtitle}</p>

      {nothingAtAll ? <p className="muted">{fabCopy.emptyNote}</p> : null}

      {sections.map((entry) => (
        <FabSection
          key={entry.section.id}
          section={entry.section}
          offers={entry.rows.offers}
          goals={entry.rows.goals}
          onBuy={(offerId) => dispatch({ type: actionTypes.BUY_MODULE, offerId: offerId })}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// VERIFIED (STORY-036), under `node`. This repo has no test runner and `npm run build` transforms
// JSX without ever MOUNTING it, so a throw on mount ships with a green build — STORY-032 hit
// exactly that. Both harnesses below were run and then deleted; what they asserted is the record.
//
// ENGINE, driving listOffers/listGoals/purchase directly (60 assertions):
//   * fresh `aftermath` at 0 Salvage returns 7 rows, ALL unaffordable and none owned — the shop is
//     populated rather than empty, which is the AC that makes the act's first minute legible. No
//     `lifeSupport` row and neither site-gated row leaks.
//   * `lifeSupport` with 3 Fission Piles: fuelBladder and electrolysisStack are absent from offers
//     and present in goals, each naming `Fission Pile 3/7` and `Hydroponics Bay 0/7` by LABEL. The
//     two lists are disjoint on every fixture. purchase('fuelBladder') returns null.
//   * At 7 and 7 both rows move into offers and the goals list empties.
//   * SITE GATE, BOTH DIRECTIONS, which is the check that fails green if written lazily: in `lunar`
//     with no colonized site Solar Wing is absent from offers AND goals; with On-Deck
//     `reached: true, colonized: false` it is STILL absent (flying past a place does not let you
//     build there); with it colonized it appears. Ice Harvester stays absent until First Base is
//     colonized. And under a save whose progression has not reached Act VII, resolvedSites() is
//     empty and the gate is still closed.
//   * An unrecognized phase reveals 22 of the 26 rows (all but the 2 site-gated and the 2 spend-
//     gated) and the site gate stays shut — the documented asymmetry, still asymmetric.
//   * purchase() is pure (same input, same result, source untouched), debits exactly once
//     (200 -> 110 for the RTG), re-prices the second copy at 106, and the reducer returns the
//     IDENTICAL state object on refusal, by `===`.
//   * A save with the `expedition` key DELETED renders the 7 aftermath rows and buys against them.
//   * THE AFFORDABILITY BOUNDARY IS EXACT, checked because the two sides use different code:
//     listOffers() marks a row with `balanceOf(...) >= cost` and purchase() refuses with
//     `canAfford(...)`, and a strictness mismatch would be a row that draws affordable and then
//     refuses on press — the one thing a shop row may never do. At exactly 90 Salvage the RTG is
//     affordable, buys, and leaves 0; at 89 it is unaffordable and the reducer is a no-op; and the
//     same holds at 106 against the RE-PRICED second copy, which is the case a growth exponent
//     could break on its own. Buying the same row twice off one state refuses the second
//     identically, so "bought the tick it became affordable" cannot double-apply.
//
// RENDER, through react-dom/server with a GameContext holding each fixture (43 assertions):
//   * Every fixture mounts. For each, the markup contains every name the engine returned and NONE
//     of the names it withheld — asserted against the engine's own output rather than a hardcoded
//     list, because a hardcoded list cannot catch a component that recomputed a cost.
//   * Exactly one <button> per offer and zero on a goal row; the count of `disabled` buttons equals
//     the count of unaffordable offers; every cost string on the page is fabCopy.costLabel() of the
//     engine's number.
//   * `+250 max power` renders with NO `/s`, while the drone's `-1.5 power/s` keeps its.
//   * `Hydroponics Bay 7/7` carries `is-met` and `Fission Pile 3/7` does not.
// ---------------------------------------------------------------------------------------------

module.exports = FabPanel;
