const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const {
  clickLabel,
  clickValue,
  baseClickValue,
  clickCurrency,
  clickChargeSeconds,
  clickCooldownRemaining,
  clickCooldownProgress,
} = require('../../engine/clicker');
const { getCurrency } = require('../../data/currencies');
const { formatNumber } = require('../../utils/formatNumber');

// The manual income action. This button is rendered in every act and is never removed — it is
// the anti-softlock guarantee (PRD §6.4). Acts differ in one respect only, and all three behaviours
// are the engine's rather than this file's:
//
//   * Acts I and II declare nothing. The button is always ready and always pays in full.
//   * Acts III-VI declare `clickCooldownSeconds`. The button spends a few seconds DISABLED after
//     each press — a rate limit rather than a gate, since the wait is fixed, small, always elapsing
//     and clamped by engine/clicker.js to the current act's own cooldown.
//   * Act VII declares `clickChargeSeconds`. The button is NEVER disabled and the press pays the
//     fraction of the window that has elapsed, so the second line below shows a value that CLIMBS
//     rather than a countdown. Pressing early is allowed and simply worth less.
//
// Every number here is read from that engine; nothing in this file decides pacing.
//
// The currency is read, not assumed. This used to print "caps" unconditionally, which was
// correct only for as long as no act overrode `clickCurrency`; Act III pays cash, and the
// button would otherwise have credited one thing while promising another.
//
// NO TIMER, and no local state. The game ticks once a second (balanceConfig.tickIntervalMs)
// and every tick re-renders this, so the fill and the countdown are pure functions of
// state.clock. A setInterval here would be a second clock to keep in sync with the first.
function SearchLotButton() {
  const { state, dispatch } = useGame();
  const currency = getCurrency(clickCurrency(state));
  const remaining = clickCooldownRemaining(state);
  const charging = clickChargeSeconds(state) > 0;
  // A charging act is never blocked, so `ready` there is about how the button READS rather than
  // whether it works: the fill still crosses the button, and a part-charged press is still a press.
  const ready = charging || remaining === 0;

  return (
    <button
      type="button"
      className={`lot-click-button${ready ? '' : ' cooling'}${charging ? ' charging' : ''}`}
      disabled={!ready}
      onClick={() => dispatch({ type: actionTypes.SEARCH_LOT })}
    >
      {/* Absolutely positioned, so it paints behind the two lines of text without ever being
          laid out beside them. This is a mobile clicker: the button must not resize or reflow
          between ready and cooling, or a rapid tapper's thumb lands somewhere else mid-tap. */}
      <span
        className="lot-click-fill"
        style={{ transform: `scaleX(${clickCooldownProgress(state)})` }}
        aria-hidden="true"
      />
      {/* The label never changes — it is what anchors the button's identity and its height.
          Only the second line swaps, and it swaps one single line for another. */}
      <span className="lot-click-label">{clickLabel(state)}</span>
      <span className="lot-click-value">
        {charging ? (
          // The value CLIMBS as the window fills, and the full value is shown beside it so the
          // player can see what they are leaving on the table without being told to wait. No
          // countdown: nothing is being withheld, and a timer would say otherwise.
          <>
            +{currency.symbol}
            {formatNumber(clickValue(state))}
            <span className="lot-click-of"> of {formatNumber(baseClickValue(state))}</span>
          </>
        ) : ready ? (
          <>
            +{currency.symbol}
            {formatNumber(clickValue(state))} {currency.symbol ? '' : currency.label.toLowerCase()}
          </>
        ) : (
          // Ceil, matching the wall's "Next kid steps up in Ns" — a countdown that reads 0s
          // while still disabled looks broken.
          `Ready in ${Math.ceil(remaining)}s`
        )}
      </span>
    </button>
  );
}

module.exports = SearchLotButton;
