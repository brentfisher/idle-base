const { getStoryBeat } = require('../../data/storyBeats');

// Records a story card as seen so it does not reappear on reload.
function dismissStoryBeat(state, action) {
  if (!getStoryBeat(action.beatId)) return state;
  if (state.progression.storyBeatsSeen.includes(action.beatId)) return state;
  return {
    ...state,
    progression: {
      ...state.progression,
      storyBeatsSeen: [...state.progression.storyBeatsSeen, action.beatId],
    },
  };
}

module.exports = { dismissStoryBeat };
