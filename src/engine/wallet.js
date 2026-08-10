// The single place currency is added to or removed from state.wallet.
//
// HARD PROJECT INVARIANT (design.md Decision 6, PRD §6.4):
//   No mechanic may reduce a currency below zero.
// Every credit and debit in the game routes through here, so the floor is a property of
// the data path rather than something each call site has to remember.

const CURRENCIES = ['caps', 'coins', 'cash'];

function creditWallet(state, bundle) {
  const wallet = { ...state.wallet };
  CURRENCIES.forEach((currency) => {
    const amount = bundle[currency];
    if (!amount) return;
    wallet[currency] = Math.max(0, wallet[currency] + amount);
  });
  return { ...state, wallet };
}

function canAfford(state, currency, amount) {
  return state.wallet[currency] >= amount;
}

// Debits `amount` and never returns a negative balance. Callers should still gate on
// canAfford() so a shortfall is a rejected purchase rather than a silently free one.
function debitWallet(state, currency, amount) {
  return {
    ...state,
    wallet: { ...state.wallet, [currency]: Math.max(0, state.wallet[currency] - amount) },
  };
}

module.exports = { CURRENCIES, creditWallet, debitWallet, canAfford };
