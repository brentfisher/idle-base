// The only place a currency balance is written.
//
// HARD INVARIANT: no mechanic may reduce a currency below zero (PRD §6.4, design Decision 6).
// This is enforced here rather than at each call site so it is a property of the data path:
// debitWallet() floors at 0 whatever it is handed, so a call site that forgets to check
// affordability produces a poor game, never a negative balance. Act II's wagering is the
// mechanic that makes this load-bearing, but every act's spend routes through it.
//
// Pure — no React, no DOM. Operates on the wallet object, not on state, so the callers that
// also touch other slices (tickEngine's addRevenue keeps prestige.runStats in step) can
// compose it rather than work around it.
const CURRENCIES = ['caps', 'coins', 'cash'];

// Coerces anything that is not a usable amount to 0. A NaN reaching a balance is
// unrecoverable — every later comparison against it is false, so the balance can never be
// spent or repaired — which makes silent coercion the safe behaviour, not the sloppy one.
function sanitizeAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 0;
  return amount;
}

function balanceOf(wallet, currency) {
  if (!wallet) return 0;
  const value = wallet[currency];
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function creditWallet(wallet, currency, amount) {
  const credit = sanitizeAmount(amount);
  if (credit === 0) return wallet;
  return { ...wallet, [currency]: balanceOf(wallet, currency) + credit };
}

// Floors at zero. Returns the wallet, not a success flag — a call site that needs to refuse
// an unaffordable purchase asks canAfford() first (every one of them does).
function debitWallet(wallet, currency, amount) {
  const debit = sanitizeAmount(amount);
  if (debit === 0) return wallet;
  return { ...wallet, [currency]: Math.max(0, balanceOf(wallet, currency) - debit) };
}

function canAfford(wallet, currency, amount) {
  return balanceOf(wallet, currency) >= sanitizeAmount(amount);
}

module.exports = { CURRENCIES, balanceOf, creditWallet, debitWallet, canAfford };
