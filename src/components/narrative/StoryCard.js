const React = require('react');
const Modal = require('../common/Modal');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');

// A full-screen act-intro card. All prose comes from data/storyBeats.js; nothing authored
// lives in this file.
function StoryCard({ beat }) {
  const { dispatch } = useGame();

  return (
    <Modal
      title={beat.title}
      closeLabel="Begin"
      onClose={() => dispatch({ type: actionTypes.DISMISS_STORY_BEAT, beatId: beat.id })}
    >
      <div className="story-card">
        {beat.prose.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        <div className="story-objective">
          <span className="label">Objective</span>
          <span>{beat.objective}</span>
        </div>
      </div>
    </Modal>
  );
}

module.exports = StoryCard;
