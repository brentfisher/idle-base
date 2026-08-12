// Walk-up songs: what can be bought, who is allowed to walk up to it, and what buying it does.
// Pure — no React, no DOM, no randomness. Every number comes from data/walkupSongsConfig.js,
// never from here, the same split engine/concessions.js has with data/concessionsConfig.js.
//
// Same contract components/concessions/ConcessionsPanel.js has with engine/concessions.js:
// listCrate() and listPickerOptions() return presentation-ready lists with cost, ownership,
// affordability and eligibility already decided, and the components render them without
// recomputing any of it.
const { WALKUP_SONGS, WALKUP_CURRENCY, WALKUP_COPY, getWalkupSong } = require('../data/walkupSongsConfig');
const { statWeights } = require('./strength');
const { canAfford, debitWallet } = require('./wallet');

// ---------------------------------------------------------------------------
// The ownership model, and why it is split across two places
// ---------------------------------------------------------------------------
// A record is bought ONCE FOR THE TEAM and lives in `state.walkup.owned`. Which kid walks up to
// it is stored on the PLAYER, as `player.walkupSongId`. Three reasons, in order of how much they
// mattered:
//
// 1. RETIREMENT. Act IV is the act that turns retirement on, at a retireAtSeasonsRange of [3, 6]
//    (data/acts.js) — kids age out of travel ball constantly and by design. Under per-player
//    ownership every purchase would be deleted by the act's own churn, so the feature would be a
//    sink that punishes you for engaging with the mechanic sitting next to it. Team-wide, a kid
//    ages out and his record goes back in the crate for the next one, which is also just what
//    happens to a CD in a dugout.
//
// 2. THE SIMULATION AND THE CARD CANNOT DISAGREE. engine/strength.js reads the assignment
//    straight off the player object, so every existing caller of playerOverall() — the roster
//    card, the field icons, the trade panel, the training-camp comparison (which rates a
//    SYNTHETIC `{ ...candidate, position }`, and carries the field along in the spread),
//    peakOverallRating, and teamStrength() feeding the win probability — picks the bonus up with
//    no signature change and no chance of one of them being missed. A `state.walkup.assignments`
//    map would have needed every one of those call sites to be handed state.
//
// 3. NOTHING EVER HAS TO BE CLEANED UP. A retired, traded or prestiged-away player takes their
//    assignment with them when they leave the roster array, and the crate — a plain list of ids —
//    survives untouched. engine/prestige.js spreads `...state` and replaces `roster`, so a
//    prestige keeps the crate exactly as it keeps the concessions stands and the caps shop, and
//    clears every assignment for free. There is no reconciliation pass anywhere in this file.
//
// EXCLUSIVITY. One record, one kid: assigning a song that somebody else is using takes it off
// them. Fiction aside (two players do not share a walk-up song), this is the balance backbone —
// without it a single 2,400-cash purchase would put +10% power on all nine position starters, and
// a whole lineup would cost one purchase instead of ten. Assign() does the handover itself rather
// than refusing, because "go and un-set the other kid first" is two trips through a dropdown on a
// 390px screen, and the picker labels who currently holds each record so it is never a surprise.

// Every read of the walk-up slice goes through this. A save written before walk-up songs existed
// has no `walkup` key at all, and this codebase tolerates an absent slice rather than migrating
// it (see engine/concessions.js, engine/wallBall.js).
//
// LOAD-BEARING BEYOND DEFAULTING: setWalkupSong() spreads the value returned here when it writes
// the slice back, so a key this function forgets is a key every purchase silently deletes. Any
// field added to the slice must be added here in the same edit.
function walkupSlice(state) {
  const slice = (state && state.walkup) || {};
  return { owned: slice.owned || [] };
}

function ownsSong(state, songId) {
  return walkupSlice(state).owned.includes(songId);
}

// Which stats actually move a player of this position, read off the rating formula itself rather
// than restated here. Today this only ever excludes `pitching` from a position player, but it is
// written as a lookup so that re-weighting the formula re-filters the shop automatically instead
// of leaving a stale hard-coded exception behind.
function songCountsFor(position, stat) {
  return (statWeights(position)[stat] || 0) > 0;
}

// Whoever is currently walking up to this record, or null. Derived from the roster on every call,
// so it can never fall out of step with the assignments the way a stored index would.
function holderOf(roster, songId) {
  if (!songId || !Array.isArray(roster)) return null;
  return roster.find((p) => p.walkupSongId === songId) || null;
}

// "+10% power". One short line saying what the money does, in the same register as
// engine/concessions.js describe().
function describe(song) {
  return `+${Math.round(song.bonus * 100)}% ${song.stat}`;
}

// The crate, for the shop at the top of the roster screen: every record in the game, cheapest
// first, with ownership and affordability decided. Deliberately shows records the player cannot
// yet afford rather than revealing them progressively — by Act IV this is the sixth shop they
// have seen, and a list you can plan a lineup against is worth more than a surprise.
function listCrate(state) {
  const roster = (state && state.roster) || [];
  return WALKUP_SONGS.map((song) => {
    const owned = ownsSong(state, song.id);
    const holder = owned ? holderOf(roster, song.id) : null;
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      description: song.description,
      effect: describe(song),
      cost: song.cost,
      currency: WALKUP_CURRENCY,
      owned,
      affordable: canAfford(state && state.wallet, WALKUP_CURRENCY, song.cost),
      // A pitching record is worth more per percent than anything else in the crate and is also
      // the only kind that can be useless, so the card says so before the money is spent rather
      // than after, when the dropdown it was bought for turns out not to list it.
      pitchersOnly: !songCountsFor('DEFAULT', song.stat),
      heldBy: holder ? holder.name : null,
    };
  }).sort((a, b) => a.cost - b.cost);
}

// The per-player dropdown: the "no song" row, then every OWNED record this player's position can
// actually use, cheapest first. Unowned records are not listed — buying happens in the crate
// above, where the price and the description are visible, and never by brushing a <select> on a
// phone into spending 4,800 cash.
function listPickerOptions(state, player) {
  const roster = (state && state.roster) || [];
  const options = walkupSlice(state)
    .owned.map((songId) => getWalkupSong(songId))
    // A song id in the slice that this build no longer defines is dropped rather than rendered as
    // an empty row. Retuning the crate must never produce a blank line in a dropdown.
    //
    // The `|| already holds it` clause is not belt-and-braces: training camp temporarily rewrites
    // a stand-in's `position` to cover the mound (engine/trainingCamp.js), so a bench kid can be
    // handed a pitching record while he is standing there and then be sent back to shortstop when
    // the camp completes. Without this the <select> would have no option matching its own value,
    // the browser would silently display the first row instead, and the card would be claiming he
    // has no song while the state says he has one. It stays listed so he can be moved off it.
    .filter((song) => song && (songCountsFor(player.position, song.stat) || song.id === player.walkupSongId))
    .sort((a, b) => a.cost - b.cost)
    .map((song) => {
      const holder = holderOf(roster, song.id);
      const takenBy = holder && holder.id !== player.id ? holder.name : null;
      const inert = !songCountsFor(player.position, song.stat);
      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        effect: describe(song),
        selected: player.walkupSongId === song.id,
        // Named rather than hidden: the record is still choosable, and choosing it takes it off
        // the kid named here. See the EXCLUSIVITY note above.
        takenBy,
        inert,
        label:
          `${song.title} — ${song.artist} (${describe(song)})` +
          `${inert ? WALKUP_COPY.inertSuffix : ''}${takenBy ? ` ${WALKUP_COPY.heldBy(takenBy)}` : ''}`,
      };
    });

  const none = {
    id: '',
    title: WALKUP_COPY.noSong,
    artist: '',
    effect: '',
    selected: !player.walkupSongId,
    takenBy: null,
    inert: false,
    label: WALKUP_COPY.noSong,
  };
  return [none, ...options];
}

// What the roster card prints under the player's name, or null when they have no song. The card
// must not re-derive this from the config: the picker, the card and engine/strength.js all read
// the one assignment off the one player object.
// `effect` is null in the one case where the record is real but does nothing for this player — a
// pitching record left on a stand-in who has gone back to shortstop (see listPickerOptions). The
// card must not print "+12% pitching" beside a rating that does not contain it; the record is
// still named, because it is still the record he walks up to.
function songSummaryFor(player) {
  const song = getWalkupSong(player && player.walkupSongId);
  if (!song) return null;
  const inert = !songCountsFor(player.position, song.stat);
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    stat: song.stat,
    inert,
    effect: inert ? null : describe(song),
  };
}

function buySong(state, songId) {
  const song = getWalkupSong(songId);
  if (!song) return null;
  if (ownsSong(state, songId)) return null;
  if (!canAfford(state.wallet, WALKUP_CURRENCY, song.cost)) return null;

  const slice = walkupSlice(state);
  return {
    ...state,
    wallet: debitWallet(state.wallet, WALKUP_CURRENCY, song.cost),
    walkup: { ...slice, owned: [...slice.owned, songId] },
  };
}

// Assignment writes the roster and nothing else — no wallet, no crate. Moving a record between
// two kids is free forever; you paid for the record, not for the kid.
function assignSong(state, playerId, songId) {
  const player = (state.roster || []).find((p) => p.id === playerId);
  if (!player) return null;

  // Clearing is always allowed, even for a song this build no longer defines — otherwise a
  // retuned crate could strand a player holding an unselectable record.
  if (!songId) {
    if (!player.walkupSongId) return null;
    return { ...state, roster: state.roster.map((p) => (p.id === playerId ? { ...p, walkupSongId: null } : p)) };
  }

  const song = getWalkupSong(songId);
  if (!song) return null;
  if (!ownsSong(state, songId)) return null;
  if (!songCountsFor(player.position, song.stat)) return null;
  if (player.walkupSongId === songId) return null;

  // One pass does both halves of the handover: the new owner gets it, and whoever had it loses
  // it. Written as a single map so there is no window in which two players hold the same record.
  const roster = state.roster.map((p) => {
    if (p.id === playerId) return { ...p, walkupSongId: songId };
    if (p.walkupSongId === songId) return { ...p, walkupSongId: null };
    return p;
  });
  return { ...state, roster };
}

// The one entry point the reducer calls, and the reason walk-up songs need only one action type.
// `playerId: null` means "buy this record and leave it in the crate" (the shop button);
// a `playerId` means "this kid walks up to this record" (the dropdown), with `songId: null`
// meaning no song at all.
//
// Returns the new state, or null when the request is not permitted — unknown record, already
// owned, unaffordable, a pitching record handed to a shortstop, or a no-op. Mirrors
// engine/concessions.js purchase(): null means "refused", the reducer returns the state it was
// given, and no currency can go below zero regardless because the debit goes through
// engine/wallet.js.
function setWalkupSong(state, { playerId = null, songId = null } = {}) {
  if (playerId == null) return buySong(state, songId);
  return assignSong(state, playerId, songId);
}

module.exports = {
  walkupSlice,
  ownsSong,
  holderOf,
  songCountsFor,
  describe,
  listCrate,
  listPickerOptions,
  songSummaryFor,
  setWalkupSong,
  WALKUP_CURRENCY,
};
