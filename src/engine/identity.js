// What the player's own team is called. Shared seam: the name is read by the standings, the
// bracket, the feed and the header, so it lives here rather than being re-derived at each
// call site the way the hardcoded 'Your Team' string used to be.
//
// Pure — no React, no DOM.

const { PLAYER_TEAM_ID } = require('./schedule');

const DEFAULT_TEAM_NAME = 'Your Team';
const MAX_TEAM_NAME_LENGTH = 24;

// Deliberately a whitelist, not a blacklist of "special chars". A blacklist has to anticipate
// every glyph that breaks a layout or reads as markup; a whitelist only has to say what a
// team name is. Letters, digits, spaces and the three punctuation marks that appear in real
// club names (Scranton/Wilkes-Barre, D'Iberville, Devil Rays) are in; everything else — angle
// brackets, emoji, control characters, combining marks — is dropped rather than rejected, so
// typing an excluded character is a no-op rather than an error message.
const ALLOWED = /[^A-Za-z0-9 '\-.]/g;

// Applied on every write, never only at the UI. Returns '' for anything unusable, and the
// caller treats '' as "keep the default" rather than as a name.
function sanitizeTeamName(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(ALLOWED, '')
    // Collapse runs of whitespace so a name cannot be padded into a layout-breaking width
    // out of characters that are individually legal.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEAM_NAME_LENGTH)
    .trim();
}

// The defaulting accessor every reader goes through. `null` means never named, which is what
// a save written before naming existed has — so the pre-naming display is preserved exactly
// and nothing has to migrate.
function getTeamName(state) {
  const stored = state && state.teamName;
  if (typeof stored !== 'string') return DEFAULT_TEAM_NAME;
  const clean = sanitizeTeamName(stored);
  return clean === '' ? DEFAULT_TEAM_NAME : clean;
}

// Whether the player has ever set a name, as distinct from what their name currently is.
// The naming UI uses this to decide between "Name your team" and "Rename".
function hasCustomTeamName(state) {
  return getTeamName(state) !== DEFAULT_TEAM_NAME;
}

// Any team id to a display name, which is the shape every table, bracket and schedule row
// actually wants. It used to be copy-pasted into StandingsPanel and PlayoffBracket as a local
// `teamName()` helper, and the two copies had already drifted — the bracket handled a missing
// id as 'TBD' (a bracket has empty slots before a round is seeded) and the standings did not.
// Keeping the union here means the next reader gets both behaviours for free.
function resolveTeamName(state, teamId) {
  if (!teamId) return 'TBD';
  if (teamId === PLAYER_TEAM_ID) return getTeamName(state);
  const teams = state && state.league && state.league.teams;
  const team = teams && teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

module.exports = {
  DEFAULT_TEAM_NAME,
  MAX_TEAM_NAME_LENGTH,
  sanitizeTeamName,
  getTeamName,
  hasCustomTeamName,
  resolveTeamName,
};
