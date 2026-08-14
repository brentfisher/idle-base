// Reducer handlers for the progression slice.

// Records that the player has now looked at a tab, which clears its NEW badge for good.
// Returns state untouched when the tab is already seen so a repeat visit costs no re-render
// and seenTabs can never accumulate duplicates.
function markTabSeen(state, action) {
  const tabId = action.tabId;
  if (!tabId) return state;
  if (state.progression.seenTabs.indexOf(tabId) !== -1) return state;
  return {
    ...state,
    progression: {
      ...state.progression,
      seenTabs: [...state.progression.seenTabs, tabId],
    },
  };
}

// The Act VI→VII crossing, and the only writer of the `callUpAccepted` milestone anywhere in the
// codebase. data/acts.js names it as Act VI's exit and engine/progression.js has no predicate for
// it, so isExitSatisfied() reads this milestone directly — meaning this one function is the entire
// mechanism by which the authored arc's last boundary can ever be crossed.
//
// IT DOES NOT FLIP THE ACT. checkActTransition() does that, on the next tick, from tickEngine.
// Flipping here would run the act's initializer inside a reducer and skip repairMissingSeason(),
// and it would put the boundary on a code path that offline catch-up does not travel. The
// separation is the same one every other exit already relies on; this one just happens to be set
// by a button rather than earned by play.
//
// Idempotent by construction: a second dispatch writes `true` over `true`. The milestone is set
// rather than counted for that reason — there is nothing here that a replayed action could
// double up.
//
// It also acknowledges the victory, and that is not scope creep. The offer is rendered INSIDE the
// championship modal, whose visibility is `championships > victoryAcknowledgedCount`. Setting the
// milestone alone would leave that modal on screen through the transition, so the player would
// accept the call-up and then be looking at a trophy popup for a league they just left. Both
// writes belong to the same player action, so they belong in the same reducer case; no new stored
// state is introduced by either (PRD §3.2).
function acceptCallUp(state) {
  return {
    ...state,
    progression: {
      ...state.progression,
      milestones: { ...state.progression.milestones, callUpAccepted: true },
    },
    prestige: { ...state.prestige, victoryAcknowledgedCount: state.prestige.runStats.championships },
  };
}

module.exports = { markTabSeen, acceptCallUp };
