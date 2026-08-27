const balanceConfig = require('../data/balanceConfig');
const { CURRENCIES } = require('../data/currencies');
const { EXPEDITION_RESOURCES } = require('../data/actSevenConfig');
const { advance } = require('./tickEngine');
const { balanceOf } = require('./wallet');
const { expeditionSlice } = require('./colony');

// REAL time away, uncapped — what the wall clock says. Split out from the capped figure below
// because the two answer different questions and the welcome-back screen needs BOTH: three days
// away and eight hours simulated is a sentence the player is owed, and it cannot be said from
// one number. Floors at 0 so a clock that moved backwards (a corrected system time, a save
// stamped in the future) reads as "no time passed" rather than as negative progress.
function computeElapsedSeconds(fromTimestamp, now) {
  return Math.max(0, (now - fromTimestamp) / 1000);
}

// THE INSTANT THE GAME WAS LAST ALIVE, and the base every figure below is measured from.
//
// `meta.lastSaveTimestamp` is NOT it, despite the name. Grep it: the only two things that write it
// are createInitialState() and this file. persistence/saveLoad.js's saveGame() serializes state
// without stamping it, and state/actions/seasonActions.js's tick() advances `lastTickTimestamp`
// only. So `lastSaveTimestamp` actually means "the instant of the last MOUNT", and on the second
// mount `now - lastSaveTimestamp` is the whole previous SESSION plus the absence after it.
//
// That is wrong for both halves of this file. For the summary it breaks the threshold outright: ten
// minutes of play followed by a five-second reload measures 605 seconds and throws up a
// welcome-back screen for an absence that did not happen. For the catch-up it is worse and older —
// advance() was being handed the previous session's duration a second time, re-crediting income the
// live tick had already paid.
//
// `lastTickTimestamp` IS kept current: every TICK writes it, so it is at most one tick-interval
// behind the moment the tab stopped running, and this file stamps both on the way out. The later of
// the two is therefore the true edge of the last live second, and it is read as `Math.max` of the
// pair rather than as `lastTickTimestamp` alone so that a save predating the tick stamp, or one
// where the two have somehow diverged the other way, still measures forward from whichever is real.
//
// BOTH THE SUMMARY AND advance()'s INPUT USE THIS ONE BASE, and they have to. `simulatedSeconds` is
// defined as what advance() was actually given and `capped` as `simulatedSeconds < awaySeconds`; on
// two different bases a simulated span can exceed the absence it is supposedly a truncation of, and
// `capped` — the one field the screen cannot afford to get wrong — becomes meaningless.
//
// Number.isFinite on each stamp, never `||`, and the failure it refuses is the one written up at
// length over normalizeResource() in engine/colony.js: an undefined or corrupt stamp makes this NaN,
// `advance(state, NaN)` exits its loop on the first iteration because `NaN > 0` is false, and a NaN
// `awaySeconds` is then written into state and persisted. Falling back to `now` means such a save
// reads as "no time has passed" — it loses a catch-up it could not have computed anyway, and it
// plays.
function lastActiveTimestamp(meta, now) {
  const stamps = [];
  if (meta && Number.isFinite(meta.lastTickTimestamp)) stamps.push(meta.lastTickTimestamp);
  if (meta && Number.isFinite(meta.lastSaveTimestamp)) stamps.push(meta.lastSaveTimestamp);
  if (stamps.length === 0) return now;
  return Math.max.apply(null, stamps);
}

// What advance() is actually given. Kept as its own exported function with its original signature
// and meaning; computeElapsedSeconds() above was added beside it rather than folded into it.
function computeCappedElapsedSeconds(lastSaveTimestamp, now) {
  return Math.min(computeElapsedSeconds(lastSaveTimestamp, now), balanceConfig.offlineCapSeconds);
}

// The wallet half of the return summary: one row per currency that MOVED, in data/currencies.js's
// own order and carrying its own label. Iterating that table rather than the wallet's keys is what
// makes the order and the labels one fact in one place — the same argument the header note in
// data/currencies.js makes about components that hardcode a currency name.
//
// MEASURED ACROSS advance(), never re-derived from rates. A rate multiplied by elapsed seconds
// would disagree with what the player actually has: rates change repeatedly during a catch-up
// (collectors bought by nothing, powerups expiring, an act boundary crossed, the colony's
// satisfaction solve re-rationing), and a summary that disagrees with the header is worse than no
// summary at all.
//
// A NEGATIVE ROW IS A REAL ROW and is kept with its sign. Nothing in the game reduces a currency
// below zero (engine/wallet.js's hard invariant), but a catch-up can still spend — Act VII's
// standing orders and contract upkeep both debit — and hiding that would make the screen a lie by
// omission. Only an EXACT zero is dropped: no float epsilon, because creditWallet() returns the
// wallet by identity when the credit is zero and nothing writes a currency it did not touch, so an
// untouched balance comes back bit-for-bit equal rather than nearly equal.
function walletDeltaRows(beforeWallet, afterWallet) {
  return CURRENCIES.reduce((rows, currency) => {
    const amount = balanceOf(afterWallet, currency.id) - balanceOf(beforeWallet, currency.id);
    if (amount !== 0) rows.push({ id: currency.id, label: currency.label, amount });
    return rows;
  }, []);
}

// The Act VII half, in data/actSevenConfig.js's order and carrying its labels, on the same rules.
//
// `amount` IS A STOCK DELTA — the difference between what was in the tank when the player left and
// what is in it now. It is NOT production, and it UNDERSTATES whenever a tank filled and vented
// during the catch-up: the four consumables have capacity ceilings (data/actSevenConfig.js), so a
// colony that made 900 Power into a 100-capacity buffer that was already at 60 reports +40. That is
// the honest reading of "what changed while you were gone" and it is deliberately not dressed up as
// anything else. Do not rename this field to anything that implies output, and do not add a
// produced-total beside it derived from rates — see the note on walletDeltaRows() above for why a
// re-derivation would disagree with the tank the player is looking at.
//
// Read through expeditionSlice() rather than off the raw state, because a save written before Act
// VII shipped has no `expedition` key at all and the slice is the one place that defaults the shape
// (engine/colony.js). Both sides go through it, so a pre-Act-VII save reads as four zeroed tanks on
// both sides and produces no rows.
function resourceDeltaRows(beforeState, afterState) {
  const beforeResources = expeditionSlice(beforeState).resources;
  const afterResources = expeditionSlice(afterState).resources;
  return EXPEDITION_RESOURCES.reduce((rows, resource) => {
    const amount = afterResources[resource.id].amount - beforeResources[resource.id].amount;
    if (amount !== 0) rows.push({ id: resource.id, label: resource.label, amount });
    return rows;
  }, []);
}

// The shape components/ renders. Built here and stored on state rather than recomputed at render
// time, because the two wallets it diffs exist only for the duration of this call.
//
// `capped` IS THE LOAD-BEARING FIELD. Away three days with an eight-hour cap means the screen must
// be able to say what actually happened instead of implying three days of income; every other field
// is decoration next to that one.
function buildReturnSummary(beforeState, afterState, awaySeconds, simulatedSeconds, at) {
  return {
    awaySeconds,
    simulatedSeconds,
    capped: simulatedSeconds < awaySeconds,
    currencies: walletDeltaRows(beforeState.wallet, afterState.wallet),
    resources: resourceDeltaRows(beforeState, afterState),
    at,
  };
}

// Whether there is a welcome-back screen to show. TOTAL by design — it runs on the mount render
// path, against a state that may have come straight out of localStorage, so a null state, an absent
// key (every save written before this shipped) and a malformed stored value all have to answer
// `false` rather than throw.
function hasReturnSummary(state) {
  const summary = state && state.returnSummary;
  if (!summary || typeof summary !== 'object') return false;
  return Array.isArray(summary.currencies) && Array.isArray(summary.resources);
}

// Applies elapsed wall-clock time (since the last live second — see lastActiveTimestamp() above)
// through the same advance() used for live ticking, then re-stamps save metadata and records what
// the player missed. Idempotent: safe to call twice with increasing `now` values (e.g. React 18 dev
// double-invoke) — see hooks/useGameTick.js.
//
// IDEMPOTENCE, AND WHERE IT LIVES. The first call consumes the whole absence and stamps BOTH
// timestamps to `now`, so the second call's elapsed time is the milliseconds between the two
// dispatches — far below `returnSummaryMinSeconds` — and takes the branch that CARRIES THE EXISTING
// SUMMARY FORWARD UNCHANGED. It does not clear it and it does not overwrite it with a second,
// near-empty summary of the same absence. That rule lives here, in the one function that knows how
// much time it just consumed, rather than in the reducer where it would be something a future
// action had to remember.
//
// The same branch is why a summary survives a quick reload: a player who was away three days,
// closed the tab without dismissing the screen and came back ten seconds later still has an
// undismissed summary of an absence that really happened. Carrying it is the behaviour, not an
// oversight — the only thing that clears it is DISMISS_RETURN_SUMMARY.
//
// `now` is passed in and is the ONLY clock this file has. Nothing in engine/ may call Date.now().
function applyOfflineProgress(state, now) {
  const awaySeconds = computeElapsedSeconds(lastActiveTimestamp(state.meta, now), now);
  const elapsedSeconds = Math.min(awaySeconds, balanceConfig.offlineCapSeconds);
  const before = state.wallet.cash;
  const next = advance(state, elapsedSeconds);
  const revenueEarned = next.wallet.cash - before;

  // `state.returnSummary || null` on the below-threshold branch normalizes an absent key to null in
  // the same expression that carries an existing summary forward. Adding this slice did NOT bump
  // meta.version, following the `salvage` wallet key in state/initialState.js: a save written before
  // it exists simply has no `returnSummary`, reads as null here, and loads and plays exactly as
  // before. persistence/saveLoad.js discards on a version mismatch and there is no migration path,
  // so a bump would delete every existing player's game to add a screen.
  const returnSummary =
    awaySeconds >= balanceConfig.returnSummaryMinSeconds
      ? buildReturnSummary(state, next, awaySeconds, elapsedSeconds, now)
      : state.returnSummary || null;

  return {
    state: {
      ...next,
      returnSummary,
      meta: { ...next.meta, lastSaveTimestamp: now, lastTickTimestamp: now },
    },
    // `elapsedSeconds` is still the CAPPED figure this function has always returned, and
    // `revenueEarned` is still cash-only. `awaySeconds` is additive beside them. Callers that want
    // the whole picture read state.returnSummary.
    summary: { elapsedSeconds, revenueEarned, awaySeconds },
  };
}

module.exports = {
  lastActiveTimestamp,
  computeElapsedSeconds,
  computeCappedElapsedSeconds,
  buildReturnSummary,
  hasReturnSummary,
  applyOfflineProgress,
};
