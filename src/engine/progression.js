// The progression engine (PRD §6.1). Pure — no React, no DOM.
//
// SCAFFOLDING NOTE: STORY-004 owns this module. Only what Act I needs is implemented.
const { ACTS, getActConfig } = require('../data/acts');

// Unlocks are derived, never stored (design doc, Decision 5): the cumulative union of the
// `unlocks` arrays for acts 0..actIndex, computed on read. Retuning which act unlocks a
// feature therefore takes effect on existing saves with no migration.
function getUnlockedFeatures(actIndex) {
  const features = [];
  for (let i = 0; i <= actIndex && i < ACTS.length; i += 1) {
    getActConfig(i).unlocks.forEach((feature) => {
      if (!features.includes(feature)) features.push(feature);
    });
  }
  return features;
}

function isFeatureUnlocked(actIndex, feature) {
  return getUnlockedFeatures(actIndex).includes(feature);
}

// Act entry is the initializer boundary (design doc, Decision 2): each act creates the
// content it introduces, so nothing a player has not reached exists in state.
function enterAct(state, actIndex) {
  const act = getActConfig(actIndex);
  const next = {
    ...state,
    progression: {
      ...state.progression,
      act: actIndex,
      actEnteredAtClock: state.clock,
    },
  };
  return typeof act.initialize === 'function' ? act.initialize(next) : next;
}

// Called once per advance() iteration after phase handling, and again eagerly by any
// action that can satisfy an exit predicate, so the transition is immediate rather than
// waiting up to a full tick. Idempotent.
function checkActTransition(state) {
  if (!state.progression) return state;
  const act = getActConfig(state.progression.act);
  if (typeof act.exit !== 'function') return state;
  if (!act.exit(state)) return state;

  const nextIndex = state.progression.act + 1;
  if (nextIndex >= ACTS.length) return state; // no further act authored yet
  return enterAct(state, nextIndex);
}

module.exports = { getActConfig, getUnlockedFeatures, isFeatureUnlocked, enterAct, checkActTransition };
