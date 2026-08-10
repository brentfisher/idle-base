let idCounter = 0;
function generateId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(array) {
  return array[randInt(0, array.length - 1)];
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Roughly bell-shaped noise in [-spread, spread], centered on 0.
function jitter(spread) {
  const a = Math.random();
  const b = Math.random();
  return (a - b) * spread;
}

module.exports = { generateId, randInt, randFloat, pick, shuffle, jitter };
