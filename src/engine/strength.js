function playerOverall(player) {
  const s = player.stats;
  if (player.position === 'P') {
    return s.pitching * 0.5 + s.defense * 0.2 + s.contact * 0.15 + s.power * 0.1 + s.speed * 0.05;
  }
  // Pitching is intentionally near-irrelevant for position players (see playerFactory.js),
  // so it's excluded here rather than dragging every non-pitcher's rating down.
  return s.power * 0.3 + s.contact * 0.3 + s.speed * 0.2 + s.defense * 0.2;
}

// Starters only — bench depth doesn't count toward on-field strength, which is what
// gives roster (trade/upgrade) decisions weight.
function teamStrength(roster, modifiers) {
  const starters = roster.filter((p) => p.isStarter);
  if (starters.length === 0) return 0;
  const avg = starters.reduce((sum, p) => sum + playerOverall(p), 0) / starters.length;
  const mult = modifiers ? modifiers.strengthMult : 1;
  return avg * mult;
}

module.exports = { playerOverall, teamStrength };
