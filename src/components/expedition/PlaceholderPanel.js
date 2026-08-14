const React = require('react');
const { getActSevenPanel, ACT_SEVEN_PLACEHOLDER_NOTE } = require('../../data/actSevenPanels');

// The body every Act VII tab renders until the story that owns it lands. Render-only, and it
// decides nothing: the heading and the blurb are looked up from data/actSevenPanels.js by id, so
// no player-facing string literal appears anywhere in this directory.
//
// It exists as a shared body with six thin wrappers around it rather than as six copies, and the
// wrappers exist rather than a single component the PANELS map points at six times, for the reason
// engine/colony.js gives for having been created early: every later story then edits a file that
// is already in the right place with the right name, and nothing has to be moved or re-imported at
// the moment somebody is also writing a mechanic. Replacing one is deleting one `return` line.
//
// Reuses `.panel` and `.muted`, which every other panel in the app uses. NO NEW CSS: styles/global.css
// ends inside an `@media (max-width: 640px)` block, so an appended rule is silently mobile-only,
// and a placeholder is nowhere near a good enough reason to walk into that.
function PlaceholderPanel({ panelId }) {
  const panel = getActSevenPanel(panelId);
  // Defensive rather than decorative: the id comes from a sibling module's list, and a typo in a
  // wrapper would otherwise be a crash on a null dereference inside a tab the player just opened.
  if (!panel) return null;

  return (
    <div className="panel">
      <h2>{panel.title}</h2>
      <p className="muted">{panel.blurb}</p>
      <p className="muted">{ACT_SEVEN_PLACEHOLDER_NOTE}</p>
    </div>
  );
}

module.exports = PlaceholderPanel;
