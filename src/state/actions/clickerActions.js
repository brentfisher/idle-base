const { applyClick } = require('../../engine/clicker');

// The manual income action — Act I's "Search the lot", and Hustle from Act II on. It is
// never gated off; see engine/clicker.js.
function searchLot(state) {
  return applyClick(state);
}

module.exports = { searchLot };
