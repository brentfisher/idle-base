// Act unlocks. STORY-004 owns this file and moves the table into data/acts.js
// (design Decision 3), where unlocks are declared per act and getUnlockedFeatures()
// unions acts 0..actIndex on read (Decision 5 — nothing about unlocks is persisted).
// This stand-in exists so the header can decide which currencies are relevant to the
// current act; each act lists both its currency id and its income contributor so
// either vocabulary resolves.
const ACT_UNLOCKS = [
  ['caps', 'collectors', 'click'],
  ['wallBallDues'],
  ['coins', 'concessions'],
  ['sponsorships'],
  ['cash', 'ticketing'],
  ['prestige'],
];

const FINAL_ACT_INDEX = ACT_UNLOCKS.length - 1;

// Extrapolation-safe like getEraConfig: an index past the table (or a missing one,
// which is what a pre-progression save looks like) resolves to the final act.
function getUnlockedFeatures(actIndex) {
  const index =
    typeof actIndex === 'number' && actIndex >= 0 ? Math.min(Math.floor(actIndex), FINAL_ACT_INDEX) : FINAL_ACT_INDEX;
  const features = [];
  for (let i = 0; i <= index; i += 1) {
    ACT_UNLOCKS[i].forEach((feature) => {
      if (!features.includes(feature)) features.push(feature);
    });
  }
  return features;
}

module.exports = { getUnlockedFeatures, FINAL_ACT_INDEX };
