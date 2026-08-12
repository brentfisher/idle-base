// Reducer handlers for the team-identity slice.

const { sanitizeTeamName } = require('../../engine/identity');

// The only place a team name is written. Sanitizing HERE rather than only in the input handler
// is the same contract clampStake has in engine/wallBall.js: the UI is convenience, the reducer
// is the guarantee. A dispatch from a devtools console, a replayed action, or a future second
// entry point cannot put an angle bracket or a 400-character banner into the save.
//
// An unusable name stores `null`, never `''`. `null` is the value initialState.js starts with
// and the one getTeamName() reads as "never named", so clearing the field returns the player to
// 'Your Team' instead of leaving an empty string that every table would render as a blank cell.
function setTeamName(state, action) {
  const clean = sanitizeTeamName(action.name);
  const next = clean === '' ? null : clean;
  // Submitting the name it already has — which the editor makes easy, since it opens prefilled
  // — returns the identical state object, so the save is untouched and nothing re-renders.
  if (state.teamName === next) return state;
  return { ...state, teamName: next };
}

module.exports = { setTeamName };
