const React = require('react');
const { formatCash } = require('../../utils/formatNumber');

// If `cost` is provided, the button auto-disables when `cash` is below it and shows the price.
// `cash` is the caller-supplied balance to compare against — pass whichever wallet currency
// this cost is denominated in (e.g. `state.wallet.cash`), not the whole wallet.
function Button({ children, onClick, cost, cash, disabled, variant, title }) {
  const cantAfford = cost != null && cash != null && cash < cost;
  const isDisabled = disabled || cantAfford;
  const className = ['btn', variant].filter(Boolean).join(' ');
  return (
    <button className={className} onClick={onClick} disabled={isDisabled} title={title}>
      {children}
      {cost != null && <> — {formatCash(cost)}</>}
    </button>
  );
}

module.exports = Button;
