// The shared board. THE ONLY CODE IN THIS REPO THAT TALKS TO THE NETWORK.
//
// IT LIVES IN persistence/ AND NOT IN engine/, and that is layering rather than filing. `fetch` is
// a DOM API and engine/ is pure simulation — no React, no DOM, no storage — so an engine module
// that reached the network would break the property that makes the whole simulation drivable from
// a node harness. persistence/ is already the layer that talks to the outside world (saveLoad.js,
// recordsStore.js); this is the same layer, one hop further out.
//
// NOTHING HERE IS EVER CALLED FROM advance(). A tick that made a request would make hundreds during
// an offline catch-up.
//
// WE HOST NOTHING (PRD §3.1, §8). This is a third-party API on its managed free tier — Talo, chosen
// on free-tier headroom and its alias model. No server of ours, no database, no proxy, not even a
// tiny one "to hide the key". The key cannot be hidden: it ships in a JavaScript bundle, and
// pretending otherwise is the arms race the design refuses to enter.
//
// SO THE BOARD IS A SHARED WALL AND NOT A RANKING. `x-talo-alias` IDENTIFIES a player; it does not
// AUTHENTICATE one. Submitted scores are not trustworthy, the screen says so
// (data/leaderboardConfig.js `unverifiedNote`), and the guards below refuse the impossible rather
// than pretending to verify the plausible.
const {
  API_BASE,
  // BOARDS, not BOARD_NAME: every path below is built from a board record now, and the standalone
  // all-time name stays exported from data/ only for callers written before there were two boards.
  BOARDS,
  ALIAS_SERVICE,
  REQUEST_TIMEOUT_MS,
  BOARD_PAGE_SIZE,
} = require('../data/leaderboardConfig');
const { SPEED_CAP, FLOOR, PAR } = require('../data/scoreConfig');

// Act VII is the seventh act and therefore index SIX. The record card keys `actSeconds` by the same
// zero-based index engine/score.js and data/scoreConfig.js's PAR use, so the per-act board for
// "Act VII" reads actSeconds[6]. Named rather than written as a bare 6 at the two places it is
// needed, because `actSeconds[6]` and "Act VII" being the same act is exactly the kind of off-by-one
// a reader should not have to re-derive.
const ACT_SEVEN_INDEX = 6;

// The access key, injected at build time by webpack's DefinePlugin from LEADERBOARD_ACCESS_KEY.
//
// NOT FOR SECRECY — it is public by construction, and anyone can read it out of the bundle. It is
// injected so that ROTATING it is a build rather than an edit to a source file (PRD §9.4), and so
// that a fork or a local dev build simply has no board rather than posting into someone else's.
//
// `typeof` guarded because DefinePlugin leaves the identifier undefined when the env var is unset,
// and a bare reference would be a ReferenceError at module load — which would take the app down on
// a build nobody configured a board for.
function accessKey() {
  // eslint-disable-next-line no-undef
  return typeof LEADERBOARD_ACCESS_KEY === 'string' ? LEADERBOARD_ACCESS_KEY : '';
}

function isConfigured() {
  return accessKey().length > 0;
}

// Board keys are resolved HERE and nowhere else, so no caller ever builds a leaderboard URL out of a
// string it was handed. An unknown key is a caller bug rather than a network condition, and it comes
// back as a refusal before any request: posting to a board name the dashboard has never heard of
// would 404 on the vendor's side, and a typo'd key deserves a reason that says which of the two
// happened. Returns null for anything not in the table.
function boardFor(boardKey) {
  const board = BOARDS[boardKey];
  return board || null;
}

// Every request goes through here, and NOTHING THROWN ESCAPES IT. A rejected promise, a CORS
// failure, an offline machine, a 500, a timeout: all of them come back as `{ ok: false }` and a
// single console.warn in saveLoad.js's house style. The board is a footnote on one block of one
// screen, and no footnote may take the game down or interrupt a run.
//
// The timeout is an AbortController rather than a Promise.race, so the request is actually
// abandoned rather than merely ignored — a page that closes with requests still open is the thing
// REQUEST_TIMEOUT_MS exists to prevent.
async function request(path, options = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not-configured' };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const response = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      // `Authorization: Bearer`, NOT a bespoke `x-talo-access-key` header. This shipped wrong and
      // would have failed authentication against every endpoint on the first real request — the
      // cost of writing a client against a vendor's endpoint reference without an account to try
      // it on. docs.trytalo.com/docs/http/authentication is the source: the access key is a bearer
      // token, and `x-talo-alias` (below, on the submit) is the separate player header.
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + accessKey(),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) {
      console.warn('Leaderboard request failed', path, response.status);
      return { ok: false, reason: 'status-' + response.status };
    }
    return { ok: true, data: await response.json() };
  } catch (err) {
    console.warn('Leaderboard request failed', path, err);
    return { ok: false, reason: 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// CALL ONE OF TWO. `POST .../entries` requires an `x-talo-alias` header, so the alias has to EXIST
// before the first submission — posting a run is identify-then-post, never one call.
//
// `write:players` on the key is what lets this CREATE the player rather than 404 on a first-time
// poster. All four scopes are needed: read:players, write:players, read:leaderboards,
// write:leaderboards.
//
// THE IDENTIFIER IS A LOCAL UUID, NOT THE TYPED NAME. Names are mutable and they collide; the alias
// carries the display name while the uuid stays the stable identity. That is what makes a returning
// player update their own row instead of minting a second one, and it is why re-identifying on a
// later run costs nothing.
async function identifyPlayer(playerUuid) {
  if (!playerUuid) return { ok: false, reason: 'no-uuid' };
  const query = '?service=' + encodeURIComponent(ALIAS_SERVICE)
    + '&identifier=' + encodeURIComponent(playerUuid);
  const result = await request('/players/identify' + query);
  if (!result.ok) return result;
  const alias = result.data && (result.data.alias || result.data);
  const aliasId = alias && (alias.id || alias.aliasId);
  if (!aliasId) return { ok: false, reason: 'no-alias' };
  return { ok: true, aliasId: String(aliasId), alias };
}

// THE PLAUSIBILITY CLAMP, and it REFUSES rather than flags. A card that describes an impossible run
// is not submitted at all: posting it with an asterisk would put a score nobody can beat at the top
// of a board that has no way to take it down.
//
// The bounds are data/scoreConfig.js's SPEED_CAP and FLOOR — the same two constants engine/score.js
// caps the score with. One bound, two uses, and no second copy: a clamp that drifted from the
// scoring rule would refuse runs the score considers ordinary.
//
// It tests the FACTS, not the total. A card carries per-act seconds, so an act cleared in less than
// FLOOR seconds or faster than SPEED_CAP times par is checkable directly; a submitted total is not
// checkable against anything.
function implausibleReason(card) {
  if (!card) return 'no-card';
  if (!card.runId) return 'no-run-id';
  // A partial run is not submitted (PRD §4, STORY-043): it has gaps that make it incomparable, and
  // a board is nothing but comparison.
  const actSeconds = card.actSeconds || {};
  const indices = Object.keys(actSeconds);
  if (indices.length === 0) return 'nothing-recorded';
  for (let i = 0; i < indices.length; i += 1) {
    const actIndex = indices[i];
    const seconds = actSeconds[actIndex];
    const par = PAR[actIndex];
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'bad-duration';
    if (seconds < FLOOR) return 'below-floor';
    if (par > 0 && par / Math.max(seconds, FLOOR) > SPEED_CAP) return 'above-speed-cap';
  }
  if ((card.counters || {}).integrityViolations > 0) return 'integrity';
  return null;
}

// THE WIRE FORMAT, written once for every board there will ever be. Both submissions below carry the
// SAME `props` — the same six facts about the same run — and differ only in which board they land on
// and what number went in `score`. That is deliberate: a row on the act-seven board has to be
// re-scorable and identifiable by exactly the means a row on the all-time board is, or the second
// board becomes a set of anonymous numbers nobody can trace back to a run.
//
// `score` is the ONLY field the vendor sorts on, and what it means is per-board (data/
// leaderboardConfig.js `metric`): a derived total on the all-time board, a duration in seconds on
// the act-seven one. The props are what make either intelligible a year from now.
function postEntry(internalName, card, aliasId, displayName, score) {
  return request('/leaderboards/' + encodeURIComponent(internalName) + '/entries', {
    method: 'POST',
    headers: { 'x-talo-alias': aliasId },
    body: {
      score,
      props: [
        { key: 'name', value: String(displayName || '') },
        { key: 'runId', value: String(card.runId) },
        { key: 'actSeconds', value: JSON.stringify(card.actSeconds || {}) },
        { key: 'achievements', value: (card.achievements || []).join(',') },
        { key: 'complete', value: card.complete ? '1' : '0' },
        { key: 'totalSeconds', value: String(card.totalSeconds || 0) },
      ],
    },
  });
}

// CALL TWO OF TWO. Posts the card's FACTS in `props`, not just the total: PRD §3.3 makes the score
// derived, so a stored number could never be re-checked or re-scored, whereas stored per-act
// seconds and achievement ids can be both. The score goes in `score` because the vendor sorts on
// it; the facts are what make the row mean anything later.
//
// `unique` mode on the board (set in the vendor dashboard) updates an existing entry rather than
// appending, so one client cannot flood the board.
async function submitRun(card, aliasId, displayName, score) {
  const refusal = implausibleReason(card);
  if (refusal) return { ok: false, reason: 'refused-' + refusal };
  if (!aliasId) return { ok: false, reason: 'no-alias' };
  return postEntry(BOARDS.allTime.internalName, card, aliasId, displayName, score);
}

// THE PER-ACT BOARD, and the ONE thing that differs from submitRun() is what goes in `score`: the
// seconds Act VII took, rather than the run's derived total. Lower is better there, and the board is
// sorted ascending in the vendor dashboard to say so — a setting this client cannot see or enforce
// (see data/leaderboardConfig.js).
//
// THE SAME CLAMP RUNS FIRST, and it must: a run whose acts are impossible is not made plausible by
// looking at only one of them, and a board that refused a cheated total while accepting the cheated
// split would be the easier of the two to farm. So the order is clamp, then act, then alias — a card
// that is both implausible AND missing Act VII comes back `refused-*`, never `no-act-seven`.
//
// After the clamp returns null, every act PRESENT in `actSeconds` is already a finite number at or
// above FLOOR — implausibleReason() returns 'bad-duration' otherwise. So the finite check below can
// only ever fire on an ABSENT key: it is an absence test wearing a validity test's clothes, and it
// is written this way so a card that never reached Act VII (the common case — most runs end earlier)
// is refused locally rather than posting a NaN or an undefined to the board.
async function submitActSevenTime(card, aliasId, displayName) {
  const refusal = implausibleReason(card);
  if (refusal) return { ok: false, reason: 'refused-' + refusal };
  const seconds = (card.actSeconds || {})[ACT_SEVEN_INDEX];
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return { ok: false, reason: 'no-act-seven' };
  }
  if (!aliasId) return { ok: false, reason: 'no-alias' };
  return postEntry(BOARDS.actSeven.internalName, card, aliasId, displayName, seconds);
}

// The board itself. Read-only, and its failure is a quiet line rather than an error state — the two
// local blocks above it on the Records tab are unaffected by anything that happens here.
//
// The default is 'allTime' because that is the board that existed first and the one RecordsPanel
// still asks for with no argument; adding a second board must not become an edit to every caller of
// the first.
async function fetchEntries(boardKey = 'allTime') {
  const board = boardFor(boardKey);
  if (!board) return { ok: false, reason: 'unknown-board' };
  const result = await request(
    '/leaderboards/' + encodeURIComponent(board.internalName) + '/entries?page=0'
  );
  if (!result.ok) return result;
  const entries = (result.data && (result.data.entries || result.data)) || [];
  return { ok: true, entries: Array.isArray(entries) ? entries.slice(0, BOARD_PAGE_SIZE) : [] };
}

module.exports = {
  isConfigured,
  identifyPlayer,
  submitRun,
  submitActSevenTime,
  fetchEntries,
  implausibleReason,
};
