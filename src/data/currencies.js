// The currencies in state.wallet, and how each is written.
//
// Extracted out of components/layout/HeaderStats.js, which owned this list privately, once a
// second and then a third place needed it: the manual click button (whose currency is per-act
// overridable — see engine/clicker.js) and Act III's concessions shop. A component that
// hardcodes a currency name is a bug waiting for the act that changes it, which is exactly
// what happened to the click button when Act III started paying cash.
//
// Ordered cheapest-first: the last unlocked entry is the act's own currency.
//
// Salvage is Act VII's (the odyssey — docs/PRD-act-seven-farm-team.md) and appends for that reason,
// not because it is dearest in any absolute sense. It is an ordinary currency: monotonic, earned,
// spent, a header chip. The odyssey's four CONSUMABLES — Power, Oxygen, Provisions, Fuel — are
// deliberately NOT here: they have capacity ceilings and signed net rates, which is a different
// shape, and they live in state.expedition instead (data/actSevenConfig.js).
const CURRENCIES = [
  { id: 'caps', label: 'Caps', symbol: '' },
  { id: 'coins', label: 'Coins', symbol: '' },
  { id: 'cash', label: 'Cash', symbol: '$' },
  { id: 'salvage', label: 'Salvage', symbol: '' },
];

function getCurrency(currencyId) {
  return CURRENCIES.find((c) => c.id === currencyId) || CURRENCIES[0];
}

module.exports = { CURRENCIES, getCurrency };
