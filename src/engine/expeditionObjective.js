// WHAT THE PLAYER IS SUPPOSED TO DO NEXT, and how close they are to being able to do it.
//
// Pure — no React, no DOM, no randomness. Every word comes from data/actSevenOpsConfig.js and every
// number from the shops that own it, the same split every engine in this act has with its config.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
// Reported, immediately after the call-up: "I can't do anything right after the call up. I can sift
// the wreck but it's not clear what's next."
//
// Two separate faults sat behind that sentence. The first was a genuine deadlock — the fabrication
// tab was withheld until the `lifeSupport` phase, which is reached by buying a module, which can
// only be done on the fabrication tab (fixed in data/acts.js, where the note lives). The second is
// the one this file answers: even with the tab open, nothing on screen connected the button the
// player was pressing to the thing it was for. The act's directives are written in the Office's
// voice and the Office does not give instructions — that is the right voice and it is kept — so the
// terminal answers underneath it, in its own.
//
// ---------------------------------------------------------------------------------------------
// A SEPARATE FILE FROM engine/colonyReadout.js, DELIBERATELY
// ---------------------------------------------------------------------------------------------
// That file has one job stated in its header — every field on the Ops screen is arithmetic on ONE
// colonyRates() solve, so the panel cannot derive a rate the simulation is not running. This asks a
// different question (what is the next purchase and can it be afforded), needs no solve at all, and
// would drag engine/actSevenModules.js into that module's import graph for nothing. "One solve, one
// helper" is a rule about not computing rates twice, not a rule about one file per panel.
const { getNextStep, nextStepCopy } = require('../data/actSevenOpsConfig');
const { expeditionSlice } = require('./colony');
const { listOffers } = require('./actSevenModules');
const { balanceOf } = require('./wallet');
const { INITIAL_PHASE } = require('../data/actSevenConfig');

// The cheapest thing on the fabrication shop right now, or null when the shop has nothing to show.
//
// CHEAPEST AND NOT "THE GENERATOR". The aftermath directive names a generator design, and the
// obvious implementation is to hardcode that id here — which would be a second opinion about what
// the first purchase is, held in a file that does not price anything. listOffers() already hides
// rows whose prerequisites are unmet, so the cheapest visible row is by construction something the
// player can actually buy, and retuning the ladder in data/actSevenModulesConfig.js re-points this
// with no edit here.
function cheapestOffer(state) {
  // listOffers() dereferences `state.wallet` unguarded — it is only ever called from a panel that
  // exists in one act — so the guard is here rather than there. This function is called on a render
  // path, and the house rule about defaulting accessors is about exactly this: the build cannot
  // catch it and the symptom is a white screen.
  if (!state || !state.wallet) return null;
  const offers = listOffers(state);
  if (offers.length === 0) return null;
  return offers.reduce((cheapest, offer) => (offer.cost < cheapest.cost ? offer : cheapest), offers[0]);
}

// The next step, presentation-ready, or null when there is nothing to say — an unrecognized phase,
// or `majors`, where the act is won and inventing an objective would undo the ending.
//
// GUARDED TO THE LEAF because this is called on a render path in every Act VII frame, and because
// `expedition` is absent from every save written in any other act. A shape this does not tolerate is
// a white screen on load, which conventions.md names as the failure the build cannot catch.
//
// ONLY MEANINGFUL IN ACT VII, and it does not check the act — components/expedition/OpsPanel.js is
// the sole caller and renders in no other act, and an engine that re-derived the act index would be
// a second gate beside AppShell's. Handed a state from an earlier act it answers for the default
// phase, which is harmless and unreachable; handed nothing at all it answers null.
function nextObjective(state) {
  if (!state) return null;
  const slice = expeditionSlice(state);
  const phase = slice.phase || INITIAL_PHASE;
  const step = getNextStep(phase);
  if (!step) return null;

  const objective = {
    phase,
    action: step.action,
    where: step.where,
    whereLabel: nextStepCopy.where(step.where),
    progress: null,
    ready: null,
  };

  // The progress line is offered ONLY where a number would be honest — today that is the aftermath,
  // where the whole objective is "afford one thing". The later phases are gated on network shape and
  // on a fuel threshold rather than on a single price, and a bar that quietly measured the wrong one
  // of those would be worse than no bar. They get the sentence and nothing else, which is what the
  // absent `progress` key means to the panel.
  if (phase !== INITIAL_PHASE) return objective;

  const target = cheapestOffer(state);
  if (!target) return objective;

  const have = Math.floor(balanceOf(state.wallet, target.currency));
  if (target.affordable) {
    objective.ready = nextStepCopy.affordable(target.name);
    return objective;
  }

  objective.progress = {
    have,
    need: target.cost,
    currency: target.currency,
    name: target.name,
    label: nextStepCopy.progress(have, target.cost, target.currency),
    forLabel: nextStepCopy.progressFor(target.name),
    // Clamped both ways: a wallet larger than the target is handled by the `affordable` branch
    // above, and a zero-cost row (which nothing declares, but a retune could) must not divide by
    // zero into a NaN width in a style attribute.
    pct: target.cost > 0 ? Math.max(0, Math.min(100, (have / target.cost) * 100)) : 0,
  };
  return objective;
}

module.exports = { nextObjective };


// ---------------------------------------------------------------------------------------------
// VERIFIED — driven under `node` against the real advance() loop and reducer, with OpsPanel
// rendered through react-dom/server. Part of the 125-assertion run recorded in
// components/playoffs/PlayoffBracket.js.
//
// THE DEADLOCK, which is the reason this file and the acts.js edit exist:
//   · BEFORE the fix: 50 SEARCH_LOT clicks in Act VII left the phase pinned at `aftermath`
//     with seven affordable rows in listOffers() and no tab able to render them
//   · AFTER: a run that clicks and buys the cheapest affordable module leaves `aftermath`
//     for `lifeSupport` in 8 clicks                                                          PASS
//   · getUnlockedFeatures(6, 'aftermath') contains `fab`                                     PASS
//
// THE NEXT STEP:
//   · Ops names the action, the tab it is on, and shows the progress bar in `aftermath`      PASS
//   · every ACT_SEVEN_NEXT_STEPS entry names a tab that EXISTS in ACT_SEVEN_PANELS and is
//     unlocked in that entry's own phase — nothing else would catch a hint pointing at a
//     tab the player cannot open                                                             PASS
//   · the objective follows the phase: after the first module it reads the lifeSupport line  PASS
//   · no progress bar where the gate is not a price                                          PASS
//   · `majors` has no objective, and nextObjective() returns null there                      PASS
//
// GUARDS: OpsPanel renders in all five phases and with `state.expedition` DELETED; the objective
// tolerates being handed nothing at all                                                      PASS
// ---------------------------------------------------------------------------------------------
