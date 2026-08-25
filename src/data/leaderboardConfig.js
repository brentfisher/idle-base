// The shared board's constants and copy. engine/ knows nothing about any of this — the leaderboard
// is a persistence-layer concern (persistence/leaderboardClient.js), for the same reason
// saveLoad.js is: it talks to the outside world, and the simulation does not.

// Talo's managed cloud (PRD §3.1). We host NOTHING: no server, no container, no database, no
// serverless function, and no self-hosted copy of the vendor's own open source. If a leaderboard
// problem's answer is "we could run a small service", the answer is no.
const API_BASE = 'https://api.trytalo.com/v1';

// THE BOARDS, keyed by the name the app refers to them by. PRD §9.5 asked "one board or several?"
// and answered that per-act boards cost nothing but leaderboard names on the vendor side — this is
// that follow-up, and this table is the whole of it. ENTRIES DO NOT MOVE BETWEEN BOARDS, which is
// why adding one is cheap and renaming one is not: `internalName` is the board's identity in the
// vendor dashboard, and changing it points the client at an empty board rather than migrating the
// old rows.
//
// `metric` is a LABEL FOR THE CALLER, not something the client acts on. The vendor stores a single
// numeric `score` per entry whatever it means; `seconds` versus `score` is how the UI knows whether
// to render a row as a duration or a total.
//
// THE ASCENDING SORT ON `actSeven` IS A DASHBOARD SETTING AND NOT SOMETHING THIS CLIENT CONTROLS.
// The act-seven board is configured "ascending" in the vendor dashboard so the FASTEST Act VII wins,
// the opposite of the all-time board where a higher score wins. There is no request parameter for
// it and no code here that can enforce it: post a time to a board somebody flipped to descending and
// the slowest run sits on top, silently. It is recorded here because this table is the only place a
// reader would think to look for it.
const BOARDS = {
  allTime: { key: 'allTime', internalName: 'idle-base-runs', metric: 'score' },
  actSeven: { key: 'actSeven', internalName: 'idle-base-act-seven', metric: 'seconds' },
};

// The all-time board's internal name, still exported on its own because it was the only board when
// the client was written and callers (and the harnesses) name it directly. Derived from BOARDS
// rather than repeated, so the two cannot drift apart.
const BOARD_NAME = BOARDS.allTime.internalName;

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

  boardHeading: 'The wall',
  scoreColumn: 'Score',
  // THE PROMPT, asked once per finished run and worded as a CHOICE rather than a call to action.
  // Posting sends a name to a third party; that is not something to nudge anybody into, and the
  // first thing the body says is that declining costs the player nothing.
  promptHeading: 'Post this run?',
  promptBody: 'Your finished run is saved here either way. Posting puts your score and your splits '
    + 'on the shared wall, under whatever name you type.',
  nameLabel: 'Name on the wall',
  namePlaceholder: 'Anything you like',
  // Said where the name is typed rather than in a policy page nobody opens.
  nameNote: 'Shown to everyone. Nothing else about you is sent.',
  postAction: 'Post it',
  declineAction: 'No thanks',
  posting: 'Posting…',
  posted: 'Posted. It may take a moment to appear on the wall.',
  postFailed: 'That did not go through. Your run is still saved here.',
};

module.exports = {
  API_BASE,
  BOARDS,
  BOARD_NAME,
  ALIAS_SERVICE,
  REQUEST_TIMEOUT_MS,
  MAX_NAME_LENGTH,
  BOARD_PAGE_SIZE,
  leaderboardCopy,
};
