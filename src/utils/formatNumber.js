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

// ROLLS INTO HOURS PAST SIXTY MINUTES, which it did not until the Records tab needed it. Every
// caller before that measured a cooldown or a build — seconds and minutes — so `291m 40s` was
// unreachable and the missing branch cost nothing. Act VII's par is 4h 51m, and a duration nobody
// can read at a glance is not a duration.
//
// Seconds are dropped once hours are involved, deliberately: at that scale they are noise, and the
// three-part form is wider than the columns that print it.
function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m <= 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

module.exports = { formatNumber, formatCash, formatDuration };
