// What a win is worth, in cash, per act.
//
// Until this file existed, winning a baseball game in a baseball game paid nothing. The
// standings moved, the feed said so, and the wallet did not notice. Every act's cash came from
// somewhere other than the field — stands in Act III, sponsors in Act IV, the gate from Act V
// on — which is the correct shape for an idle game and the wrong shape for a player who just
// went 8-1 and has nothing to show for it.
//
// So: a purse. engine/tickEngine.js credits it in resolveGameSlot() the moment the fixture
// resolves, through the same addRevenue() the income rates use, so it counts toward
// prestige.runStats.totalRevenue like every other dollar the team earns.
//
// WHY THIS IS A CONFIG FILE AND NOT A RULE. The clean home for this would be a key on the
// `rules` object each act declares in data/acts.js, resolved by resolveRules() alongside
// gamesPerSeason and secondsPerGame. It is keyed by act index here instead, which is the same
// information reached a different way. If a later story moves it onto act.rules, the numbers
// and the reasoning below travel unchanged.
//
// ---------------------------------------------------------------------------
// What the passive economy actually is, which is not what you would guess
// ---------------------------------------------------------------------------
// Sizing a purse against "the gate" would be wrong, because there is no gate. engine/income.js
// gates ticketing on `state.stadium`, and NOTHING creates a stadium: Act V declares the
// `ticketing` and `stadium` unlocks but has no entry in the ACT_INITIALIZERS registry in
// engine/progression.js, so `stadium` is the `null` initialState.js set until the player
// prestiges (engine/prestige.js builds one on reset). Verified by running advance() for the
// full 8-hour cap from a bare Act V and a bare Act VI entry: cash income was zero in both.
//
// So from Act III to the end of the game, cash comes from exactly three places: the click, the
// concession stands, and the sponsor board — and the last two are CARRIED FORWARD, because
// nothing ever removes them. A player who bought everything arrives in Act V with 105/sec of
// stands and ~295/sec of sponsors before the reputation multiplier, call it 400/sec, and that
// figure is the yardstick every number below is measured against. When Act V's initializer
// lands and the gate finally opens, every ratio here only gets smaller, which is the safe
// direction to be wrong in.
//
// ---------------------------------------------------------------------------
// Sizing: a reward, never the income stream
// ---------------------------------------------------------------------------
// Two tests per act. A full season of wins should pay roughly ONE of that act's real
// purchases — so the purse is felt at the scale the player is already shopping at — and the
// purse's per-second equivalent (purse x win rate / secondsPerGame) should be a small fraction
// of the boards above. Season lengths from data/acts.js:
//
//   ACT III — six games at 25s, a 150-second season. The cheapest sink is a 120 lemonade table
//   and the fully-upgraded click pays 16. At 40 a win is two and a half clicks and a third of a
//   table; a swept season is 240, or two tables. Per-second equivalent at the ~55% win rate the
//   [22, 32] band was measured at: 0.88/sec — under half of what the FIRST lemonade table pays,
//   and 0.8% of the full 105/sec stand board.
//
//   ACT IV — fifteen games at 40s, a 600-second season. Camp programs and stat upgrades sit
//   around 300, the first sponsor is 2,500. At 250 a win is one stat upgrade, and the nine-win
//   season the act's 60% exit asks for pays 2,250 — just under signing Dorsey's, who then pays
//   that back fifteen times over in a single season. Per-second equivalent 3.75/sec against
//   130/sec of stands plus one sponsor: under 3%.
//
//   ACT V — twenty-four games at 50s, a 1,200-second season. The stadium ladder is 2,000 then
//   3,200 then 5,120, which is also the three upgrades that take a 5,000-seat park to the
//   10,000 the act's exit names. At 800 a fourteen-win season pays 11,200: that whole ladder,
//   once, across a full season — one act-long goal, not one per game. Per-second equivalent
//   9.6/sec against a carried-in 400/sec board: 2.4%.
//
//   ACT VI — thirty-three games at 60s, a 1,980-second season. A late stadium upgrade is
//   ~21,000 and a stat upgrade near the cap is ~4,600. At 2,500 a win is half a stat upgrade
//   and a twenty-win season is 50,000, about two stadium upgrades. Per-second equivalent
//   25/sec, or ~6% of the same 400/sec board. This is the one act where the purse is visible
//   rather than negligible, and that is deliberate: Act VI is the act the player replays.
//
// Deliberately NOT multiplied by modifiers.revenueMult. Prestige eras scale revenue, and a
// purse that scaled with them would turn a reward into one more multiplier to farm. It is a
// fixed, legible number the player reads straight off the feed entry.
//
// A player who has bought NOTHING has no passive income at all, in any act, so for them the
// purse is 100% of income. That is not a failure of these numbers, it is the same role the
// click has always played: a floor that guarantees recovery, bounded by the act's own pacing
// rather than by how fast the player can press a button.
//
// ---------------------------------------------------------------------------
// The offline worst case
// ---------------------------------------------------------------------------
// advance() resolves whole seasons inside one iteration of an 8-hour catch-up
// (balanceConfig.offlineCapSeconds is 28,800s), so the ceiling is every game slot in eight
// hours, won at whatever rate the act's strength band allows. MEASURED rather than multiplied
// out, by running advance() for the full cap against a real entry into each act — 20 runs each,
// mean and range, because simulateGame() is a coin weighted by strength and a single run of a
// thousand fixtures still swings by a factor of four. Purse cash only, with every other income
// source at zero:
//
//   Act III  1,152 slots ->    12,252 mean (4,860 - 23,750). Every run crossed into Act IV
//                              partway, which is the act transition firing mid-catch-up.
//   Act IV     720 slots ->    14,300 mean (6,500 - 22,750). Promoted little leaguers against
//                              a [42, 60] band lose most of what they play, and that is the act.
//   Act V      576 slots ->   171,320 mean (103,200 - 280,000)
//   Act VI     480 slots -> 1,196,875 mean (1,122,500 - 1,242,500), from a deliberately
//                              overpowered club winning nearly everything plus thirteen
//                              postseasons — the true ceiling, and the tight range says so.
//
// Against the 400/sec board a fully-shopped player carries, eight hours pays 11,520,000. So
// even the Act VI ceiling is about a tenth of what the things they bought paid them while they
// were asleep, and every earlier act is a rounding error. THAT is the property to preserve if
// these numbers are ever retuned: an offline return must never be a purse windfall.
//
// The legacy-point path is clear too. calculateLegacyPoints() divides totalRevenue by 100,000,
// so the Act VI ceiling above is worth 12 points — against the 650 that same run's thirteen
// championships award. The purse cannot become a prestige-farming strategy.
//
// ONE KNOWN SIDE EFFECT, recorded rather than corrected. Act IV's pacing table in data/acts.js
// was measured with no purse at all. A nine-win travel season now also pays 2,250, which is
// about seven stat upgrades, so the "stat upgrades only" column there may come in a little
// under its recorded 31 minutes. It is self-limiting — the purse pays winners, and the runs
// that column worries about were winning 10% of their games — so nothing is retuned here. But
// whoever next re-measures Act IV should know the baseline moved under them.
const WIN_PURSE_BY_ACT = {
  2: 40, // Act III — Little League
  3: 250, // Act IV — Travel Ball
  4: 800, // Act V — The Minors
  5: 2500, // Act VI — The Big Leagues
};

// Acts I and II have no `state.season` at all, so no game can resolve in them and no purse can
// ever be looked up for them. This fallback therefore only ever answers a corrupt or
// out-of-range act index, and it answers with the SMALLEST purse in the table on purpose: a bad
// read should cost the player a little, never hand them an Act VI purse in a little league.
const FALLBACK_WIN_PURSE = 40;

// A playoff game is a bigger game, and the postseason is short — Act VI is the only act that
// declares a bracket at all (every other act sets `playoffTeams: 0`), and its bracket is two or
// three rounds at 90s each. Doubling cannot compound into anything: the absolute ceiling is one
// player win per round, so at most ~15,000 across an entire postseason. The rule is simply that
// a playoff win must never pay LESS than the regular-season game it replaced.
const PLAYOFF_PURSE_MULTIPLIER = 2;

function winPurseForAct(actIndex) {
  const purse = WIN_PURSE_BY_ACT[Math.floor(actIndex)];
  return typeof purse === 'number' ? purse : FALLBACK_WIN_PURSE;
}

function playoffPurseForAct(actIndex) {
  return Math.round(winPurseForAct(actIndex) * PLAYOFF_PURSE_MULTIPLIER);
}

module.exports = {
  WIN_PURSE_BY_ACT,
  FALLBACK_WIN_PURSE,
  PLAYOFF_PURSE_MULTIPLIER,
  winPurseForAct,
  playoffPurseForAct,
};
