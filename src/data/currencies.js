// The three currencies in state.wallet, and how each is written.
//
// Extracted out of components/layout/HeaderStats.js, which owned this list privately, once a
// second and then a third place needed it: the manual click button (whose currency is per-act
// overridable — see engine/clicker.js) and Act III's concessions shop. A component that
// hardcodes a currency name is a bug waiting for the act that changes it, which is exactly
// what happened to the click button when Act III started paying cash.
//
// Ordered cheapest-first: the last unlocked entry is the act's own currency.
const CURRENCIES = [
  { id: 'caps', label: 'Caps', symbol: '' },
  { id: 'coins', label: 'Coins', symbol: '' },
  { id: 'cash', label: 'Cash', symbol: '$' },
];

function getCurrency(currencyId) {
  return CURRENCIES.find((c) => c.id === currencyId) || CURRENCIES[0];
}

module.exports = { CURRENCIES, getCurrency };
