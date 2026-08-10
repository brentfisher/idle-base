const React = require('react');
const { useGame } = require('../../state/GameContext');
const { computeModifiers } = require('../../engine/modifiers');
const { totalIncomePerSecond } = require('../../engine/income');
const { getUnlockedFeatures } = require('../../engine/progression');
const { findNextEventClock } = require('../../engine/tickEngine');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');
const { getEraConfig } = require('../../data/eras');

// Ordered cheapest-first: the last unlocked entry is the act's own currency.
const CURRENCIES = [
  { id: 'caps', label: 'Caps', symbol: '' },
  { id: 'coins', label: 'Coins', symbol: '' },
  { id: 'cash', label: 'Cash', symbol: '$' },
];

const PHASE_LABELS = { regular: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason' };

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

function HeaderStats() {
  const { state } = useGame();
  const era = getEraConfig(state.prestige.era);
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
  const phaseLabel = state.season
    ? { regular: 'Regular Season', playoffs: 'Playoffs', offseason: 'Offseason' }[state.season.phase]
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

      <span className="stat-chip">
        <span className="label">Reputation</span>
        {Math.round(state.reputation)}
      </span>
      {state.stadium && (
        <span className="stat-chip">
          <span className="label">Capacity</span>
          {formatNumber(state.stadium.capacity)}
        </span>
      )}
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
      {state.season && (
        <span className="stat-chip">
          <span className="label">Season</span>
          {state.season.seasonNumber} · {PHASE_LABELS[state.season.phase]}
        </span>
      )}
      <span className="stat-chip">
        <span className="label">Era</span>
        {era.name}
      </span>
      {state.hasWonLeagueThisRun && <span className="stat-chip">🏆 Champions this run</span>}
    </div>
  );
}

module.exports = HeaderStats;
