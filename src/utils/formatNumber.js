function formatNumber(value) {
  const n = Math.trunc(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}${abs}`;
  const units = ['K', 'M', 'B', 'T'];
  let unitIndex = -1;
  let scaled = abs;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  return `${sign}${scaled.toFixed(scaled < 10 ? 2 : 1)}${units[unitIndex]}`;
}

function formatCash(value) {
  return `$${formatNumber(value)}`;
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

module.exports = { formatNumber, formatCash, formatDuration };
