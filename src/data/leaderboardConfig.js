// The shared board's constants and copy. engine/ knows nothing about any of this — the leaderboard
// is a persistence-layer concern (persistence/leaderboardClient.js), for the same reason
// saveLoad.js is: it talks to the outside world, and the simulation does not.

// Talo's managed cloud (PRD §3.1). We host NOTHING: no server, no container, no database, no
// serverless function, and no self-hosted copy of the vendor's own open source. If a leaderboard
// problem's answer is "we could run a small service", the answer is no.
const API_BASE = 'https://api.trytalo.com/v1';

// The board's internal name, as created in the vendor dashboard. One all-time board is the simplest
// thing that works; per-act boards are the obvious follow-up and cost nothing but more names here.
const BOARD_NAME = 'idle-base-runs';

// The alias service Talo files this identity under. `username` rather than `steam` or `epic`
// because there is no platform account behind it — see IDENTIFIER_ below.
const ALIAS_SERVICE = 'username';

// Every request is abandoned after this. The board is never load-bearing (PRD §7.2): a slow one
// costs a quiet line on one block of one screen, and a request the game is still holding open when
// the player closes the tab is worse than no board at all.
const REQUEST_TIMEOUT_MS = 8000;

// The display name's cap. Long enough for a name, short enough that one row cannot push a board
// off a 390px screen.
const MAX_NAME_LENGTH = 24;

// How many rows the board block renders. Talo pages at 50; asking for one page is asking for all of
// them at this game's size.
const BOARD_PAGE_SIZE = 50;

const leaderboardCopy = {
  // Said on the screen, not buried in a tooltip (PRD §3.1). Every client-side leaderboard puts a
  // writable key in the bundle, ours included, so scores are posted rather than verified. A board
  // that implied otherwise would be lying to the people reading it.
  unverifiedNote: 'Posted by players, not verified by anyone. Treat it as a wall, not a ranking.',
  pending: 'Fetching the board…',
  failed: 'Could not reach the board. Your own runs above are unaffected.',
  notConfigured: 'No board is configured for this build.',
  empty: 'Nobody has posted a run yet.',
};

module.exports = {
  API_BASE,
  BOARD_NAME,
  ALIAS_SERVICE,
  REQUEST_TIMEOUT_MS,
  MAX_NAME_LENGTH,
  BOARD_PAGE_SIZE,
  leaderboardCopy,
};
