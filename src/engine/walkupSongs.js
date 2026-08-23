// Walk-up songs: what can be bought, who is allowed to walk up to it, and what buying it does.
// Pure — no React, no DOM, no randomness. Every number comes from data/walkupSongsConfig.js,
// never from here, the same split engine/concessions.js has with data/concessionsConfig.js.
//
// Same contract components/concessions/ConcessionsPanel.js has with engine/concessions.js:
// listCrate() and listPickerOptions() return presentation-ready lists with cost, ownership,
// affordability and eligibility already decided, and the components render them without
// recomputing any of it.
const {
  WALKUP_SONGS,
  WALKUP_CURRENCY,
  WALKUP_COPY,
  WALKUP_ALL_STATS,
  getWalkupSong,
} = require('../data/walkupSongsConfig');
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
// EXCLUSIVITY. One record, one kid. Fiction aside (two players do not share a walk-up song), this
// is the balance backbone — without it a single 2,400-cash purchase would put +10% power on all
// nine position starters, and a whole lineup would cost one purchase instead of ten.
//
// A SPOKEN-FOR RECORD IS NOT OFFERED, WHERE IT USED TO BE STOLEN. The first version of this file
// let assignSong() do the handover itself: the picker listed every owned record, labelled the ones
// somebody else was using "with Marcus", and quietly took it off Marcus if you chose it. The
// argument was that "go and un-set the other kid first" is two trips through a dropdown on a phone.
//
// It was the wrong trade, and the reason is what a <select> is. A dropdown is a list of things you
// may have, and every row in it that is already taken is a row that does nothing but re-state the
// same fact fifteen times over — once per card — while being one thumb-brush away from silently
// removing a bonus from a player on a different part of the screen, with no confirmation and no
// undo. The record is the scarce thing, so scarcity belongs where the records are: taken records
// leave every OTHER player's picker entirely (listPickerOptions), assignSong() refuses a steal
// outright rather than performing it, and the crate row that says who has it grows the one control
// that takes it back (WALKUP_COPY.takeBack). The two trips are still two trips; they now both
// happen in the crate, which is the screen the player already opens to think about records, and
// neither of them can happen by accident.
//
// The picker still lists the record its OWN player is holding — that is how you take it off him
// without going to the crate at all, and it is what the <select> must match its own value against.

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
//
// WALKUP_ALL_STATS SHORT-CIRCUITS TO TRUE, and this one line is what makes the B-side ladder work
// at all. The sentinel is deliberately not a key of STAT_WEIGHTS (engine/strength.js keeps its rows
// summing to 1.0), so the lookup below returns 0 for it and every gate in this file that asks
// "can this player use this record" would answer no. There are five of them and they fail in five
// different ways: assignSong() REFUSES the assignment outright, listPickerOptions() never lists the
// record, its `inert` flag appends "does nothing here" to a record that does everything,
// listCrate() labels it pitchers-only, and songSummaryFor() blanks the effect on the roster card.
// One of those is a silent no-op the player pays 4,800 cash for. Hence the check here, in the one
// place all five read.
function songCountsFor(position, stat) {
  if (stat === WALKUP_ALL_STATS) return true;
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
//
// A B-side gets its own sentence from the config rather than "+6% all", which reads as a string
// that was cut off. Both branches take their prose from WALKUP_COPY for the house reason: no
// player-facing wording is assembled in an engine.
function describe(song) {
  const percent = Math.round(song.bonus * 100);
  if (song.stat === WALKUP_ALL_STATS) return WALKUP_COPY.allStatsEffect(percent);
  return `+${percent}% ${song.stat}`;
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
      // The holder's ID, and it is what makes the crate row's "take it back" control possible at
      // all: releasing a record is an assignment of NO song to the player who has it, which is
      // setWalkupSong({ playerId: holder.id, songId: null }) — an action that already exists and
      // already has a reducer case. Carried here rather than looked up in the component, because a
      // component that searched the roster for whoever is holding a record would be a second
      // implementation of holderOf() that can disagree with the name printed beside it.
      heldById: holder ? holder.id : null,
      // The boosted stat, carried raw AND as a display tag. Raw so the component can key a colour
      // off it without parsing the label back apart; tagged so the wording stays in data/.
      stat: song.stat,
      statTag: WALKUP_COPY.statTag(song.stat),
    };
  })
    // UNOWNED FIRST, THEN OWNED, EACH CHEAPEST FIRST — and the first half of that is the point.
    //
    // Sorting on cost alone left bought records sitting among the unbought ones, so the row under
    // the cursor changed identity after every purchase: a player coming back to a full wallet had
    // to re-find the next record after each click, eighteen times. Sinking what you already own
    // means buying the cheapest promotes the next-cheapest into the same slot, and the whole crate
    // can be cleared without moving the pointer.
    //
    // It also keeps the two row SHAPES apart. An owned row renders a <span> where an unowned row
    // renders a <button>; interleaved, any height difference between them shifts the buy targets
    // around unpredictably. With every button above every span, the block of targets is contiguous.
    //
    // Unaffordable rows stay in place and stay disabled rather than sinking too — they are still
    // the next thing to save for, and a list that reordered itself as income arrived would be the
    // same moving-target problem wearing a different hat.
    .sort((a, b) => (a.owned === b.owned ? a.cost - b.cost : (a.owned ? 1 : -1)));
}

// The per-player dropdown: the "no song" row, then every OWNED record this player's position can
// actually use, GROUPED BY THE STAT EACH ONE BOOSTS and cheapest first inside each group. Unowned
// records are not listed — buying happens in the crate above, where the price and the description
// are visible, and never by brushing a <select> on a phone into spending 4,800 cash.
//
// RETURNS `{ none, groups }` RATHER THAN A FLAT LIST. The stat a record boosts is the only thing a
// player is actually choosing on, and it used to be visible only inside each row's effect string —
// so a crate with a dozen records was a wall of song titles to read through. The grouping is
// resolved here rather than in the component for the reason every shop in this act follows: the
// component renders rows and decides nothing about how they are ordered.
//
// GROUP ORDER IS `statWeights()`'s KEY ORDER, WHICH IS DERIVED AND NOT RESTATED. That is the same
// order components/roster/PlayerCard.js draws the stat BARS in on the same card — a pitcher reads
// pitching, defense, contact, power, speed and everybody else reads power, contact, speed, defense
// — so the dropdown and the bars beneath it agree by construction. Restating the order here would
// be a second copy that drifts the first time a position's weights are retuned, and it is why the
// picker deliberately orders differently for a pitcher than for a shortstop. The B-side block is
// the one exception and it is placed EXPLICITLY, first, below: WALKUP_ALL_STATS is not a key of
// statWeights() and must not reach the orphan path at the foot of this function, which means "this
// record does nothing for this player" and is the opposite of what a B-side is.
//
// RECORDS SOMEBODY ELSE IS USING ARE NOT LISTED AT ALL. See the EXCLUSIVITY note at the head of the
// file for the argument; the mechanical consequence is that this list is now per-player in a second
// way — two cards side by side offer different records — and that assignSong() below can be a
// straight refusal, because nothing this function returns can ever be a steal.
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
    // SPOKEN FOR, SO NOT ON OFFER. The `|| this player holds it` half is not optional: without it
    // the record a player is currently walking up to would be filtered out of his own dropdown, the
    // <select> would have no option matching its own value, and the browser would display the first
    // row instead — the card claiming he has no song while the state says he has one. That is the
    // same failure mode the training-camp clause above exists to prevent, reached from the other
    // direction, and it is also how a player is taken OFF a record from his own card.
    .filter((song) => {
      const holder = holderOf(roster, song.id);
      return !holder || holder.id === player.id;
    })
    .sort((a, b) => a.cost - b.cost)
    .map((song) => {
      const inert = !songCountsFor(player.position, song.stat);
      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        // The stat this record boosts, carried so the grouping above keys on the record itself
        // rather than on parsing it back out of the effect string.
        stat: song.stat,
        effect: describe(song),
        selected: player.walkupSongId === song.id,
        inert,
        // THE STAT COMES FIRST, before the title, and that is the whole answer to "I can't tell
        // which stat I'm boosting". The <optgroup> headings below say the same thing and are the
        // better answer on paper — but iOS renders a <select> as a native picker wheel that
        // frequently does not surface optgroup labels at all, and the phone is the target device
        // (see the Mobile section of conventions). So the grouping stays for every browser that
        // honours it, and the tag makes each row answer the question on its own.
        label: `${WALKUP_COPY.statTag(song.stat)} · ${song.title} — ${song.artist} (${describe(song)})` +
          `${inert ? WALKUP_COPY.inertSuffix : ''}`,
      };
    });

  // The remove affordance, and it stays UNGROUPED and first. Its `id` is '' so it matches the
  // <select>'s own `value` when the player has no song — putting it inside a group would still
  // work, but a heading over a single "no walk-up song" row reads as a category with one record in
  // it rather than as the way to take a record off somebody.
  const none = {
    id: '',
    title: WALKUP_COPY.noSong,
    artist: '',
    effect: '',
    selected: !player.walkupSongId,
    inert: false,
    label: WALKUP_COPY.noSong,
  };

  // One block per stat that actually has a record in it. A group with nothing in it is dropped
  // rather than rendered empty — a heading over no rows is the shape of a bug, and which stats are
  // represented depends entirely on what the player has bought.
  //
  // THE B-SIDES ARE PLACED FIRST, EXPLICITLY. They cannot come from statWeights() — WALKUP_ALL_STATS
  // is not one of its keys and deliberately never will be (engine/strength.js keeps each row summing
  // to 1.0) — so without this line they would fall through to the orphan path below, whose meaning
  // is "this record does nothing for this player". First rather than last because a record that
  // moves every bar on the card is the answer to a question the player has not narrowed down yet,
  // and because it is the most expensive block: putting it at the bottom of a wheel that has to be
  // SCROLLED on a phone is how a shop hides its own top rung.
  const groups = [WALKUP_ALL_STATS]
    .concat(Object.keys(statWeights(player.position)))
    .map((stat) => ({
      stat,
      label: WALKUP_COPY.statGroup(stat),
      options: options.filter((option) => option.stat === stat),
    }))
    .filter((group) => group.options.length > 0);

  // A record that is listed but does NOT count for this position — the training-camp stand-in case
  // above — belongs to no group in `statWeights(player.position)`, so it would silently vanish from
  // a dropdown that only rendered the groups. It is appended under its own heading instead, because
  // the whole reason that row is listed is so the player can move him OFF it.
  const grouped = new Set(groups.reduce((all, g) => all.concat(g.options.map((o) => o.id)), []));
  const orphans = options.filter((option) => !grouped.has(option.id));
  if (orphans.length > 0) {
    orphans.forEach((orphan) => {
      const existing = groups.find((g) => g.stat === orphan.stat);
      if (existing) existing.options.push(orphan);
      else groups.push({ stat: orphan.stat, label: WALKUP_COPY.statGroup(orphan.stat), options: [orphan] });
    });
  }

  return { none, groups };
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
    // The same chip the crate rows carry, so the card and the shop label a record identically.
    statTag: WALKUP_COPY.statTag(song.stat),
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

  // A RECORD SOMEBODY ELSE IS USING IS REFUSED, NOT TAKEN. listPickerOptions() no longer offers
  // one, so this is unreachable through the UI and is exactly the kind of refusal the house rule
  // describes: an action the player could not have made through the interface is a no-op, not an
  // error. It is not therefore dead code — it is what keeps a stale render from silently stripping
  // a bonus off a player somewhere else on the screen, which is the failure the steal could produce
  // and the reason it went away. The way to move a record is to take it back in the crate first.
  if (holderOf(state.roster, songId)) return null;

  return { ...state, roster: state.roster.map((p) => (p.id === playerId ? { ...p, walkupSongId: songId } : p)) };
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


// ---------------------------------------------------------------------------------------------
// VERIFIED — driven under `node` and through the real reducer; the picker and crate rows also
// rendered with react-dom/server. Part of the same 125-assertion run recorded in
// components/playoffs/PlayoffBracket.js.
//
// EXCLUSIVITY:
//   · a record held by one player is absent from every OTHER player's picker                PASS
//   · it is still listed in its own holder's picker — the <select> must match its own value  PASS
//   · an unheld record is still offered to everybody                                        PASS
//   · a steal dispatched through the reducer returns the IDENTICAL state object (refused)    PASS
//   · release (playerId: holder, songId: null) returns it to the crate, and it can then be
//     assigned to somebody else                                                             PASS
//   · listCrate() carries heldBy AND heldById, which is what makes the release control
//     possible without a second copy of holderOf() in a component                           PASS
//
// THE B-SIDES (stat: WALKUP_ALL_STATS):
//   · songCountsFor() answers true for 'P' and for DEFAULT on all four                      PASS
//   · playerOverall() gain is EXACTLY the declared bonus on a flat stat block, for every
//     one of the four (+3%, +4%, +5%, +6%) — the weights sum to 1.0, so a uniform bonus on
//     every term is that bonus on the average                                               PASS
//   · every price equals bonusPercent x 800, the file's own rule at weight 1.0              PASS
//   · the B-side block is FIRST in the picker, not in the orphan bucket (whose meaning is
//     "does nothing here")                                                                  PASS
//
// LEGIBILITY: the stat leads every option label ("POWER · Thunderstruck — …"), and the crate row
// and the roster card carry the same statTag                                                PASS
//
// The crate blurb no longer contains the sentence promising a steal                         PASS
// RosterPanel renders with `state.walkup` DELETED                                           PASS
// ---------------------------------------------------------------------------------------------
