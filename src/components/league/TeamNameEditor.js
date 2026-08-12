const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const {
  getTeamName,
  hasCustomTeamName,
  sanitizeTeamName,
  MAX_TEAM_NAME_LENGTH,
} = require('../../engine/identity');

// The team-name affordance, sitting on the League tab because that is the first screen where
// the player's team is a thing with a row of its own rather than an implied "you".
//
// Two rules fight each other here and the resolution is worth stating. The reducer sanitizes
// every write (state/actions/identityActions.js), so this component is convenience only. But
// sanitizeTeamName() collapses whitespace and trims, which means running it on every keystroke
// makes a space untypable — "Red" + space trims straight back to "Red" and the player can never
// reach "Red Sox". So the DRAFT is held raw, exactly as typed, and the sanitizer runs only for
// the preview line and at dispatch. The player sees what they will get without being fought.
function TeamNameEditor() {
  const { state, dispatch } = useGame();
  const current = getTeamName(state);
  const named = hasCustomTeamName(state);

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  // What the reducer would actually store. '' means "nothing usable in there", which the
  // reducer treats as a request to fall back to the default rather than as a name.
  const preview = sanitizeTeamName(draft);

  function open() {
    // Prefilled with the current name, so renaming is an edit rather than a retype. A player
    // who has never named their team starts empty rather than with 'Your Team' to delete.
    setDraft(named ? current : '');
    setEditing(true);
  }

  function commit(event) {
    event.preventDefault();
    dispatch({ type: actionTypes.SET_TEAM_NAME, name: draft });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="team-identity">
        <span className="team-identity-name">{current}</span>
        <button type="button" className="btn secondary team-identity-edit" onClick={open}>
          {named ? 'Rename' : 'Name your team'}
        </button>
      </div>
    );
  }

  return (
    <form className="team-identity editing" onSubmit={commit}>
      <input
        className="team-identity-input"
        type="text"
        value={draft}
        // Generous next to the sanitizer's 24, because the raw draft may hold characters that
        // will be stripped. The preview below is the honest count.
        maxLength={MAX_TEAM_NAME_LENGTH * 2}
        placeholder="e.g. Riverside Rockets"
        aria-label="Team name"
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="team-identity-preview muted">
        {/* A live preview rather than a validation error: typing an emoji or an angle bracket
            simply does not appear, and the player can see that instead of being told off. */}
        {preview === ''
          ? `Letters, numbers, spaces. Up to ${MAX_TEAM_NAME_LENGTH} characters.`
          : `Shows as “${preview}” · ${preview.length}/${MAX_TEAM_NAME_LENGTH}`}
      </div>
      <div className="team-identity-actions">
        <button type="submit" className="btn">
          Save
        </button>
        <button type="button" className="btn secondary" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

module.exports = TeamNameEditor;
