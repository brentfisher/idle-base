const { applyClick } = require('../../engine/clicker');

// The manual income action — Act I's "Search the lot", and Hustle from Act II on. It is never
// gated off; from Act III it is rate-limited, which is not the same thing. applyClick() owns
// that distinction and returns the state untouched while the click is cooling, so this stays
// the one-line pass-through it has always been rather than growing a second opinion about
// whether the press was allowed. See engine/clicker.js.
function searchLot(state) {
  return applyClick(state);
}

module.exports = { searchLot };
