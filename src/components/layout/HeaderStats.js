const React = require('react');
const { useGame } = require('../../state/GameContext');
const { computeModifiers } = require('../../engine/modifiers');
const { totalIncomePerSecond } = require('../../engine/income');
const { getUnlockedFeatures } = require('../../engine/progression');
const { resolveRules } = require('../../engine/modifiers');
const { expeditionSlice } = require('../../engine/colony');
const ResourceChips = require('./ResourceChips');
const { findNextEventClock } = require('../../engine/tickEngine');
const { winPct } = require('../../engine/standings');
const { PLAYER_TEAM_ID } = require('../../engine/schedule');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');
const { getEraConfig } = require('../../data/eras');
const { CURRENCIES } = require('../../data/currencies');
const { getPhasePill } = require('../../data/actSevenPalette');

const PHASE_LABELS = { regular: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason' };

// Act VII's phase, for the pill that takes over the era pill's slot. Labels live here beside the
// season's for the same reason those do — they are the header's own vocabulary for a state, not
// prose the narrative owns.
const EXPEDITION_PHASE_LABELS = {
  aftermath: 'Aftermath',
  lifeSupport: 'Life Support',
  lunar: 'Lunar',
  deepSpace: 'Deep Space',
  majors: 'The Majors',
};

function formatAmount(currency, value) {
  return `${currency.symbol}${formatNumber(value)}`;
}

// Rates and per-tick gains are often fractional — an early collector earns well under
// one cap per second — and formatNumber() truncates those to a flat 0.
function formatFine(currency, value) {
  const digits = value > 0 && value < 10 ? value.toFixed(1) : formatNumber(value);
  return `${currency.symbol}${digits}`;
}

// state.wallet is STORY-001's. Until it lands cash still lives at the top level; read
// through rather than mirroring, so the chip tracks the value the tick engine writes.
function readWallet(state) {
  if (state.wallet) return state.wallet;
  return { caps: 0, coins: 0, cash: state.cash };
}

// The player's row out of the season standings, or null. There are three separate ways for
// this to be absent and they all have to collapse to the same nothing: state.season is null
// for the whole of Acts I–II, a season built by an older build may carry no standings array
// at all (saves are never migrated, so a two-week-old save is a shape this code has to
// survive), and the player row itself only exists once resetStandings() has run.
//
// Absent is deliberately NOT rendered as 0-0. A season that has begun and been played to a
// 0-0 record is a real, informative state — you have played no games yet — and printing the
// same thing when there is simply no standings table would quietly tell the player a lie
// about a league they may not even have unlocked.
function readRecord(state) {
  if (!state.season || !Array.isArray(state.season.standings)) return null;
  const row = state.season.standings.find((r) => r.teamId === PLAYER_TEAM_ID);
  if (!row) return null;
  return { wins: row.wins || 0, losses: row.losses || 0 };
}

function HeaderStats() {
  const { state } = useGame();
  const era = getEraConfig(state.prestige.era);
  // THE ONE QUESTION THIS HEADER ASKS ABOUT ACT VII, and it asks it of the rules rather than of
  // the act index. `seasonFrozen` is the act rule that retires the baseball SIMULATION (see
  // data/acts.js), so it is exactly the condition under which the record, the season chip and the
  // era pill stop meaning anything — the league is still in state, still valid, and no longer
  // moving. Reading resolveRules() rather than progression.act means an era or a later act that
  // freezes the league gets the same header for free, and it is the only sanctioned way to read an
  // overridable value (conventions.md).
  const frozen = !!resolveRules(state).seasonFrozen;
  const modifiers = computeModifiers(state);
  const wallet = readWallet(state);
  const rates = totalIncomePerSecond(state, modifiers);

  // Which currencies matter right now. The act's own currency stays visible even at
  // zero (a new act starts empty); earlier ones drop out once spent to nothing. If the
  // unlock table ever names contributors rather than currencies we fail open to
  // whatever the player actually holds instead of rendering an empty header.
  const unlocked = getUnlockedFeatures(state.progression ? state.progression.act : undefined);
  const unlockedCurrencies = CURRENCIES.filter((c) => unlocked.includes(c.id));
  const held = CURRENCIES.filter((c) => wallet[c.id] > 0 || rates[c.id] > 0);
  const candidates = unlockedCurrencies.length > 0 ? unlockedCurrencies : held;
  const primary = candidates[candidates.length - 1];
  const shownCurrencies = candidates.filter((c) => c === primary || wallet[c.id] > 0 || rates[c.id] > 0);

  // Per-tick gains, for the floating +N. Snapshotted in a ref rather than state so a
  // gain costs no extra render. Gains are only recomputed when the clock moves, so a
  // re-render triggered by a player action mid-tick keeps showing the same number —
  // but the baseline still absorbs what that action spent, otherwise the purchase
  // would net out the following tick's income and swallow one gain.
  const gainRef = React.useRef({ clock: null, wallet: null, gains: {} });
  if (gainRef.current.clock !== state.clock) {
    const previous = gainRef.current.wallet;
    const gains = {};
    if (previous) {
      CURRENCIES.forEach((c) => {
        const delta = (wallet[c.id] || 0) - (previous[c.id] || 0);
        if (delta > 0) gains[c.id] = delta;
      });
    }
    gainRef.current = { clock: state.clock, wallet, gains };
  } else {
    gainRef.current.wallet = wallet;
  }
  const gains = gainRef.current.gains;

  // The countdown reads the clock the tick loop steps to. It is Infinity whenever
  // nothing discrete is pending — correct in the early acts, where income is a rate
  // the loop integrates in one step — so the bar is simply absent rather than full.
  // The span is captured when the target changes, since state records no start time.
  const nextEventClock = state.season ? findNextEventClock(state) : Infinity;
  const countdownRef = React.useRef({ target: null, span: 1 });
  let countdown = null;
  if (Number.isFinite(nextEventClock)) {
    if (countdownRef.current.target !== nextEventClock) {
      countdownRef.current = { target: nextEventClock, span: Math.max(1, nextEventClock - state.clock) };
    }
    const remaining = Math.max(0, nextEventClock - state.clock);
    const progress = Math.max(0, Math.min(1, 1 - remaining / countdownRef.current.span));
    countdown = { remaining, progress };
  } else if (countdownRef.current.target !== null) {
    countdownRef.current = { target: null, span: 1 };
  }
  // The stadium and the season are absent, not zero, until their act creates them.
  //
  // The record is folded INTO the season chip rather than added beside it. The header is
  // sticky and already spends most of a 390px phone on chips (see the mobile block in
  // global.css, which had to shrink this row once already); an eighth chip would have cost a
  // whole row back. Folding costs nothing and in fact wins width back, because "S3 · 4-2" is
  // both shorter and more informative than "Season 3 · Regular Season" — the phase was the
  // least useful thing in the chip, since the regular season is where a player spends nearly
  // the entire game and "Regular Season" therefore reads as a constant. So the phase is now
  // shown only when it is NOT the regular season, i.e. only when it is news. The long form
  // survives intact in the tooltip, along with the win percentage, for anyone who hovers.
  const record = readRecord(state);
  const seasonTitle = state.season
    ? `Season ${state.season.seasonNumber} · ${PHASE_LABELS[state.season.phase]}` +
      (record ? ` · ${record.wins}-${record.losses} (${winPct(record).toFixed(3)})` : '')
    : null;

  return (
    <div className="header-stats">
      {/* Re-keyed on the clock, which only a TICK changes, so the pulse restarts on
          every tick and stops dead if the simulation ever does. */}
      <span className="heartbeat" key={state.clock} title="Simulation running" />
      <span className="title">⚾ Idle Base</span>

      {shownCurrencies.map((c) => (
        <span className="stat-chip currency-chip" key={c.id}>
          <span>
            <span className="label">{c.label}</span>
            {formatAmount(c, wallet[c.id] || 0)}
          </span>
          <span className="currency-rate">+{formatFine(c, rates[c.id] || 0)}/s</span>
          {gains[c.id] > 0 && (
            <span className="floating-gain" key={`${c.id}-${state.clock}`}>
              +{formatFine(c, gains[c.id])}
            </span>
          )}
        </span>
      ))}

      {/* THIS IS A SWAP, NOT AN ADDITION. Header space is already contested on a 390px screen —
          the mobile block in global.css records a row that had to be shrunk once already — and
          four resource chips cannot simply be appended to seven existing ones.

          What goes is what a frozen league makes meaningless: the record and season chip (no games
          are being played), reputation and capacity (nothing is drawing a crowd), and the champions
          badge (that run is over; the trophy is what got you here). What arrives is the four
          consumables and a phase pill in the era pill's slot. The clock and the countdown stay in
          both worlds, because time still passes and events are still scheduled. */}
      {!frozen && (
        <span className="stat-chip">
          <span className="label">Reputation</span>
          {Math.round(state.reputation)}
        </span>
      )}
      {!frozen && state.stadium && (
        <span className="stat-chip">
          <span className="label">Capacity</span>
          {formatNumber(state.stadium.capacity)}
        </span>
      )}
      {frozen && <ResourceChips />}
      <span className="stat-chip">
        <span className="label">Clock</span>
        {formatDuration(state.clock)}
      </span>
      <span
        className="stat-chip countdown-chip"
        title={countdown ? 'Time until the next scheduled event' : 'Nothing scheduled — income is accruing'}
      >
        <span className="label">Next</span>
        {countdown ? formatDuration(countdown.remaining) : '—'}
        {countdown && (
          <span className="countdown-track">
            <span className="countdown-fill" style={{ width: `${(countdown.progress * 100).toFixed(1)}%` }} />
          </span>
        )}
      </span>
      {!frozen && state.season && (
        <span className="stat-chip season-chip" title={seasonTitle}>
          <span className="label">S{state.season.seasonNumber}</span>
          {record && (
            <span className="season-record">
              {record.wins}-{record.losses}
            </span>
          )}
          {state.season.phase !== 'regular' && (
            <span className="season-phase">{PHASE_LABELS[state.season.phase]}</span>
          )}
        </span>
      )}
      {/* Coloured from the era config rather than a per-era class, because getEraConfig()
          synthesises eras past the authored five and there is no bounded set of class names
          to write. */}
      {!frozen && (
        <span
          className="stat-chip era-chip"
          style={{ background: era.pill.bg, color: era.pill.ink }}
          title={era.description}
        >
          <span className="label">Era</span>
          {era.name}
        </span>
      )}
      {/* The era pill's SLOT, reused rather than a new chip added beside it. The two say the same
          kind of thing — "which chapter of the game is this" — and they are never both true, so
          they are one element wearing two hats. Keeping the era-chip class means it inherits the
          pill's shape and weight without a second rule in global.css.

          An unrecognized phase falls back to the raw id rather than to nothing: expedition.phase is
          self-healing and a corrupt value is one tick from repair, so showing the odd string for
          that tick is better than a pill that silently vanishes. */}
      {frozen && (
        <span
          className="stat-chip era-chip phase-chip"
          /* Coloured inline from data/actSevenPalette.js by exactly the path the era chip above
             uses, because the two are one slot wearing two hats and a second mechanism here would
             be a second thing to keep in sync. getPhasePill() returns null for an unrecognized id
             and the spread then contributes nothing, leaving the chip its default ground — which
             pairs with the raw-id fallback below: a corrupt phase is one tick from self-repair, so
             showing it uncoloured is honest, and painting it as though it were a real phase is not. */
          style={getPhasePill(expeditionSlice(state).phase) ? {
            background: getPhasePill(expeditionSlice(state).phase).bg,
            color: getPhasePill(expeditionSlice(state).phase).ink,
          } : undefined}
          title="How far into the odyssey this run has come"
        >
          <span className="label">Phase</span>
          {EXPEDITION_PHASE_LABELS[expeditionSlice(state).phase] || expeditionSlice(state).phase}
        </span>
      )}
      {!frozen && state.hasWonLeagueThisRun && <span className="stat-chip">🏆 Champions this run</span>}
    </div>
  );
}

module.exports = HeaderStats;
