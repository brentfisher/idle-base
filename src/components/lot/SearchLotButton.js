const React = require('react');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const {
  clickLabel,
  clickValue,
  clickCurrency,
  clickCooldownRemaining,
  clickCooldownProgress,
} = require('../../engine/clicker');
const { getCurrency } = require('../../data/currencies');
const { formatNumber } = require('../../utils/formatNumber');

// The manual income action. This button is rendered in every act and is never removed — it is
// the anti-softlock guarantee (PRD §6.4). From Act III to Act VI it spends a few seconds disabled
// after each press, which is a rate limit rather than a gate: the wait is fixed, small and always
// elapsing, and engine/clicker.js clamps it to the current act's own cooldown so it cannot
// become a lockout. Acts I, II and VII declare no cooldown at all and never disable — the `ready`
// branch below is the whole of their behaviour. Every number here is read from that engine;
// nothing in this file decides pacing.
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
  const ready = remaining === 0;

  return (
    <button
      type="button"
      className={`lot-click-button${ready ? '' : ' cooling'}`}
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
        {ready ? (
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
