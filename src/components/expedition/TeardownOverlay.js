const React = require('react');
const { useGame } = require('../../state/GameContext');
const { getActConfig } = require('../../engine/progression');
const { getStoryBeat } = require('../../data/storyBeats');

const TEARDOWN_BEAT_ID = 'act-7-teardown';

// THE SEQUENCE IS DERIVED FROM THE ACT TRANSITION AND NEVER STORED, and that is the whole design.
// This file is components/common/ToastHost.js's argument applied to a one-shot cutscene, and it is
// worth restating because the failure mode here is worse than a toast storm.
//
// advance(state, deltaSeconds) runs live and on load with only deltaSeconds differing, and one
// iteration can span eight hours. The obvious alternative — a `teardownPlayed` flag written into
// the save — has three problems, in increasing order of how much they hurt:
//
//   1. It is a migration. Saves are never migrated (persistence/saveLoad.js discards on version
//      mismatch), so the flag has to be read through a defaulting accessor forever.
//   2. It is a second source of truth for "which act are we in", and progression.act is already
//      the first one.
//   3. It can DESYNC. A player who crosses the boundary and closes the tab mid-sequence has the
//      milestone set but not the flag, and comes back to a teardown for a league that is already
//      gone — or, with the writes in the other order, never sees it at all.
//
// Watching for a CHANGE since the last render has none of that. prev.current === null is the
// baseline case: first mount, and every reload, records where we are and plays nothing. An
// eight-hour catch-up that crossed the boundary while the tab was closed therefore plays nothing
// either, which is correct — the crossing is a deliberate button press (STORY-020), so a player
// cannot cross while away. What it does guarantee is the harder property: a catch-up that crosses
// the boundary *within one advance()* moves the act index once, so this fires once, not once per
// crossed trigger.
//
// THE TRIGGER IS `hides`, NOT AN ACT INDEX. The sequence depicts the baseball tabs being retired,
// and `hides` is literally the config that retires them (data/acts.js). Reading the config asks
// the exact question — "did we just enter an act that takes tabs away?" — where a hardcoded 6
// would be a second place that knows the arc's shape and would silently follow the wrong act if
// an Act VIII were ever appended.
function tearsDownTabs(actIndex) {
  const act = getActConfig(actIndex);
  return !!(act && act.hides && act.hides.length > 0);
}

function TeardownOverlay() {
  const { state } = useGame();
  const actIndex = state.progression ? state.progression.act : 0;

  // `playing` is view state and local on purpose — it is "is an overlay on screen right now",
  // which nothing outside this component can act on and nothing should survive a reload.
  const [playing, setPlaying] = React.useState(false);
  const prev = React.useRef(null);

  React.useEffect(() => {
    if (prev.current === null) {
      prev.current = actIndex;
      return;
    }
    const before = prev.current;
    prev.current = actIndex;
    // Forward crossings only. The act index cannot go backwards today, but prestige rewrites it
    // (PRESTIGE_ACT_INDEX) and a future act could too — and a teardown that plays while the
    // player is going the other way would be actively confusing.
    if (actIndex > before && tearsDownTabs(actIndex) && !tearsDownTabs(before)) {
      setPlaying(true);
    }
  }, [actIndex]);

  const beat = getStoryBeat(TEARDOWN_BEAT_ID);
  if (!playing || !beat) return null;

  // NOT OBSERVED IN A REAL BROWSER. The unmount path below is reasoned, not tested — there is no
  // test runner here and no headless DOM, so `animationend` firing on the backdrop has never been
  // watched happen. It is recoverable rather than a softlock if it does not: the skip button and a
  // backdrop click both dismiss, and neither depends on the event. Worth one manual crossing to
  // confirm, and worth knowing that this is the component's entire automatic exit.
  //
  // onAnimationEnd is an EVENT, not a timer. There is no setTimeout here and no second tick
  // source: the CSS owns the duration, and the one animation on the backdrop is the longest, so
  // its end is the sequence's end. onAnimationEnd bubbles from children, so the guard on
  // currentTarget is what stops a line finishing early from dismissing the whole thing.
  const finish = (e) => {
    if (e && e.target !== e.currentTarget) return;
    setPlaying(false);
  };

  return (
    <div
      className="teardown-backdrop"
      onAnimationEnd={finish}
      onClick={() => setPlaying(false)}
      role="presentation"
    >
      <div className="teardown-box">
        <h2>{beat.title}</h2>
        <div className="teardown-seam" />
        {beat.prose.map((paragraph, i) => (
          <p className="teardown-line" key={i}>
            {paragraph}
          </p>
        ))}
        <div className="teardown-seam" />
        <div className="teardown-seam" />
        {/* Rendered from the first frame and never animated in: a repeat viewing has to be
            skippable in under a second, and the backdrop is tappable for the same reason. */}
        <button className="btn secondary teardown-skip" onClick={() => setPlaying(false)}>
          {beat.skipLabel}
        </button>
      </div>
    </div>
  );
}

module.exports = TeardownOverlay;
