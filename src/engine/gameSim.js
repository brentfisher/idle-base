const balanceConfig = require('../data/balanceConfig');
const { randInt } = require('../utils/randomUtils');

// Elo-style win probability from a strength differential.
function winProbability(strengthA, strengthB, k = balanceConfig.eloK) {
  return 1 / (1 + 10 ** ((strengthB - strengthA) / k));
}

// Returns { aWins, scoreA, scoreB }. Symmetric — caller decides which side is "home".
function simulateGame(strengthA, strengthB) {
  const aWins = Math.random() < winProbability(strengthA, strengthB);
  const winnerScore = randInt(3, 7);
  let loserScore = randInt(1, 5);
  if (loserScore >= winnerScore) loserScore = Math.max(0, winnerScore - 1);
  return aWins
    ? { aWins: true, scoreA: winnerScore, scoreB: loserScore }
    : { aWins: false, scoreA: loserScore, scoreB: winnerScore };
}

module.exports = { winProbability, simulateGame };
