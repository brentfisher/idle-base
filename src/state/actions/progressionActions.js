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

module.exports = { markTabSeen };
