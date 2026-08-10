function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function weightedAverage(pairs) {
  // pairs: [[value, weight], ...]
  let total = 0;
  let weightSum = 0;
  for (const [value, weight] of pairs) {
    total += value * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

module.exports = { clamp, lerp, weightedAverage };
