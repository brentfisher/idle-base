const React = require('react');
const Modal = require('../common/Modal');
const ActBackdrop = require('./ActBackdrop');
const { useGame } = require('../../state/GameContext');
const { titleScreenCopy } = require('../../data/titleScreenConfig');

// The screen a brand new save opens on. It names the game, frames the arc in two lines, and offers
// one button.
//
// WHETHER IT SHOWS AT ALL IS NOT THIS COMPONENT'S DECISION — see components/layout/AppShell.js,
// which latches the freshness test in local state at mount. It has to be latched there rather than
// recomputed here: `useGameTick()` dispatches an offline-progress action on its first effect and
// then ticks once a second, so `state.clock === 0` is true for roughly one render and a screen that
// re-read it would dismiss itself before the player had finished reading it. Local state, not the
// save, because a title screen is not a fact about the run.
//
// `onStart` is the only way out. There is no `onClose` passed to Modal on purpose, so the backdrop
// is inert: the one thing on this screen that starts a game is the button that says it will.
function TitleScreen({ onStart }) {
  const { state } = useGame();
  // A brand new save is always Act I and era 0, so today this is always the vacant lot. It is read
  // from state anyway rather than hardcoded, because ReturnSummary renders the same banner for a
  // player who could be anywhere in the arc, and one of the two reading its act from a constant is
  // how the two screens would drift apart.
  const actIndex = state.progression ? state.progression.act : 0;
  const eraIndex = state.prestige ? state.prestige.era : 0;

  return (
    <Modal>
      <div className="screen-card">
        {/* The banner bleeds to the card's edges and the name sits on top of it. Both children
            occupy the same CSS grid cell (styles/global.css), so when the backdrop is absent —
            no WebGL, reduced motion, a narrow viewport, a CDN that did not answer — the row
            collapses to the height of the text and the screen is complete without it. */}
        <div className="screen-banner">
          <ActBackdrop actIndex={actIndex} eraIndex={eraIndex} />
          <div className="screen-banner-text">
            <h1 className="screen-title">{titleScreenCopy.name}</h1>
            <p className="screen-tagline">{titleScreenCopy.tagline}</p>
          </div>
        </div>

        <div className="screen-prose">
          {titleScreenCopy.premise.map(function (paragraph, index) {
            return <p key={index}>{paragraph}</p>;
          })}
        </div>

        {/* Full width and 48px tall rather than Modal's own right-aligned footer button. This is
            the only tap target on the screen and it is the first one the player ever makes. */}
        <button type="button" className="btn screen-action" onClick={onStart}>
          {titleScreenCopy.startLabel}
        </button>
      </div>
    </Modal>
  );
}

module.exports = TitleScreen;
