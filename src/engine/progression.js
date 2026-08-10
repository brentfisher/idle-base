// Act progression queries. Pure — no React, no DOM (src/engine/ convention).
//
// PARTIAL STUB — STORY-004 owns this module and will add checkActTransition(state) and
// enterAct(state, actIndex). Only the two read-side queries the progressive tab reveal needs
// are implemented here; names and signatures match the agreed shared shapes exactly.
const { ACTS } = require('../data/acts');

// Clamp-and-extrapolate like getEraConfig, so an out-of-range act index (e.g. Decision 4 pins
// `progression.act` to the final act on prestige) can never throw.
function getActConfig(actIndex) {
  const index = Math.max(0, Math.floor(actIndex || 0));
  if (index < ACTS.length) return ACTS[index];
  const last = ACTS[ACTS.length - 1];
  return { ...last, id: index };
}

// Decision 5 — unlocks are derived, not stored: the cumulative union of the `unlocks` arrays for
// acts 0..actIndex, computed on read. Retuning which act unlocks a feature needs no migration.
function getUnlockedFeatures(actIndex) {
  const index = Math.max(0, Math.floor(actIndex || 0));
  const features = [];
  for (let i = 0; i <= index; i += 1) {
    const config = getActConfig(i);
    (config.unlocks || []).forEach((feature) => {
      if (features.indexOf(feature) === -1) features.push(feature);
    });
  }
  return features;
}

module.exports = { getActConfig, getUnlockedFeatures };
