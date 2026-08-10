// Presentation state for the progressive UI reveal: which tabs have been seen (the NEW
// badge) and which story cards have already been shown. Unlock state itself is derived,
// never stored (design.md Decision 5).

function markTabSeen(state, action) {
  if (state.progression.seenTabs.includes(action.tabId)) return state;
  return {
    ...state,
    progression: { ...state.progression, seenTabs: [...state.progression.seenTabs, action.tabId] },
  };
}

function markStoryBeatSeen(state, action) {
  if (state.progression.storyBeatsSeen.includes(action.beatId)) return state;
  return {
    ...state,
    progression: { ...state.progression, storyBeatsSeen: [...state.progression.storyBeatsSeen, action.beatId] },
  };
}

module.exports = { markTabSeen, markStoryBeatSeen };
