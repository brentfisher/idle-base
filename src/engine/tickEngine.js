const balanceConfig = require('../data/balanceConfig');
const { computeModifiers, resolveRules } = require('./modifiers');
const { totalIncomePerSecond } = require('./income');
const { pendingFeedBeats } = require('./narrative');
const { creditWallet } = require('./wallet');
const { simulateGame } = require('./gameSim');
const { playerOverall, getTeamStrength } = require('./strength');
const {
  PLAYER_TEAM_ID,
  driftLeagueStrength,
  resetStandings,
  generateSeasonSchedule,
  pickAiPairingsForSlot,
  buildTradeWindows,
} = require('./schedule');
const { applyGameResult, sortStandings } = require('./standings');
const { generateBracket, resolveCurrentRound } = require('./playoffs');
const { generateTradeCandidates } = require('./tradeDeadline');
const { processCampCompletions } = require('./trainingCamp');
const { checkRetirements } = require('./retirement');
const { checkActTransition, getUnlockedFeatures } = require('./progression');
const { recordTravelSeason } = require('./travelBall');
const { settleWager, refundOpenWager } = require('./bookie');
const { newlyAvailableSponsors, markSponsorsAnnounced } = require('./sponsorships');
const { integrateColony, nextColonyThresholdClock } = require('./colony');
const { resolveBuilds, nextBuildClock, writeExpeditionPhase } = require('./sites');
const { winPurseForAct, playoffPurseForAct } = require('../data/winPurseConfig');
const { createFeedEntry, appendFeedEntries } = require('./feed');
const { effectiveSecondsPerGame, effectiveSecondsPerPlayoffRound } = require('./pacing');
const {
  feedMessages,
  powerupDisplayName,
  campProgramDisplayName,
  playoffRoundLabel,
} = require('../data/feedMessages');

function teamDisplayName(working, teamId) {
  if (teamId === PLAYER_TEAM_ID) return 'home side';
  const team = working.league.teams.find((t) => t.id === teamId);
  return team ? team.name : 'unknown club';
}

// generateBracket() halves each round down to a single final, so it requires a power-of-2
// field. `playoffTeams` was hardcoded to balanceConfig's 4 before rules resolution made it
// authorable, and an odd size (6 teams, or 8 declared in a 6-team little league) builds a
// bracket whose final match never gets both slots filled — leaving the season stuck in the
// playoffs phase forever. Round down to the nearest power of 2; anything under 2 means no
// postseason at all, which is what `playoffTeams: 0` declares.
function playoffFieldSize(declared, availableTeams) {
  const n = Math.min(declared || 0, availableTeams);
  if (n < 2) return 0;
  return 2 ** Math.floor(Math.log2(n));
}

// Winning a game pays. The amount is act-scaled and every number behind it, including the
// arithmetic that says it can never become the primary income stream, lives in
// data/winPurseConfig.js — this file only decides WHEN a purse is owed, which is the same
// division of labour resolveRules() has with data/acts.js.
//
// The act index is read defensively: `progression` is absent in a save written before the
// odyssey existed, and a garbage index resolves to the table's fallback rather than throwing.
// runOffseasonTransition() below reads it the same way, for the same reason.
function actIndexOf(working) {
  const act = working.progression && working.progression.act;
  return typeof act === 'number' && Number.isFinite(act) ? act : 0;
}

function addRevenue(working, revenue) {
  return {
    ...working,
    wallet: creditWallet(working.wallet, 'cash', revenue),
    prestige: {
      ...working.prestige,
      runStats: { ...working.prestige.runStats, totalRevenue: working.prestige.runStats.totalRevenue + revenue },
    },
  };
}

// Integrates a per-second income bundle over `step` seconds and credits each currency.
// Cash still flows through addRevenue() so prestige.runStats.totalRevenue keeps tracking it;
// caps and coins land in state.wallet (STORY-001 owns that field — see initialState.js).
function creditIncome(working, incomePerSecond, step) {
  let next = working;

  const cash = incomePerSecond.cash * step;
  if (cash > 0) next = addRevenue(next, cash);

  const caps = incomePerSecond.caps * step;
  const coins = incomePerSecond.coins * step;
  if (caps > 0 || coins > 0) {
    const wallet = next.wallet || { caps: 0, coins: 0, cash: 0 };
    next = { ...next, wallet: creditWallet(creditWallet(wallet, 'caps', caps), 'coins', coins) };
  }

  // Salvage, Act VII's currency. THIS FUNCTION READS NAMED KEYS AND DOES NOT ITERATE THE BUNDLE,
  // which is why adding a contributor to engine/income.js is not enough on its own — the rate was
  // computed and silently dropped until this block existed. Anything added to
  // totalIncomePerSecond() needs a line here or it does nothing at all.
  //
  // Guarded on `> 0` for the same reason the caps/coins block is: below Act VII the rate is
  // structurally zero, and crediting zero would write a `salvage` key into the wallet of every
  // save in existence. Saves are never migrated, so a shape change on a path every tick travels
  // is not a small thing — and it would also break the by-identity return that lets an unchanged
  // tick be proven unchanged by reference equality.
  const salvage = (incomePerSecond.salvage || 0) * step;
  if (salvage > 0) {
    next = { ...next, wallet: creditWallet(next.wallet || {}, 'salvage', salvage) };
  }

  return next;
}

function expirePowerups(working) {
  const before = working.powerups.active;
  const active = before.filter((p) => p.expiresAtClock == null || p.expiresAtClock > working.clock);
  if (active.length === before.length) return working;
  const expired = before.filter((p) => !active.includes(p));
  return appendFeedEntries(
    { ...working, powerups: { ...working.powerups, active } },
    expired.map((p) => createFeedEntry(working.clock, 'powerup', feedMessages.powerupExpired(powerupDisplayName(p.id))))
  );
}

function updatePeakRating(working) {
  const starters = working.roster.filter((p) => p.isStarter);
  if (starters.length === 0) return working;
  const rating = starters.reduce((sum, p) => sum + playerOverall(p), 0) / starters.length;
  if (rating <= working.prestige.runStats.peakOverallRating) return working;
  return {
    ...working,
    prestige: { ...working.prestige, runStats: { ...working.prestige.runStats, peakOverallRating: rating } },
  };
}

// ---------------------------------------------------------------------------------------------
// Event-clock contributors.
//
// findNextEventClock() answers "when does the next discrete thing happen?", and its answer is
// what bounds the step advance() takes. Until this list existed it was a twelve-line if-chain
// with four hardcoded sources, in what is already the most contended file in the codebase for
// parallel work. Act VII then queued four more sources onto it — colony resource boundaries,
// launch arrivals and site builds, puzzle cooldowns, and contract windows — which is four
// separate branches editing the same twelve lines, i.e. four hand-resolved merge conflicts in
// shared control flow.
//
// So the chain became a registration list, for the same reason and in the same shape that
// engine/income.js is a list of per-contributor rate functions (odyssey design.md Decision 1:
// "every new act would edit a conditional that every other act also touches"). APPEND a
// contributor below; do not reach back into findNextEventClock().
//
// The contract every contributor must honour:
//
//   * Pure `(state) => clock | Infinity`. No mutation, no Date.now(), no bare Math.random() —
//     this runs inside the offline catch-up as well as the live tick, and the two must agree.
//
//   * Guard your OWN slice. Every contributor runs on every iteration in every act, including
//     acts where its slice does not exist yet, so a contributor whose state is absent returns
//     Infinity rather than throwing. (`season` is null until Act III; the Act VII slices are
//     null until later still.)
//
//   * Return Infinity — never 0, null or undefined — when nothing is pending. This is
//     load-bearing, not tidiness. Infinity from every contributor makes findNextEventClock()
//     return Infinity, which makes advance() take the ENTIRE remaining span as a single step
//     and integrate income across it in one pass. That is what resolves an 8h offline return
//     (28,800s) in a handful of iterations instead of hitting safetyCapIterations (2,000) and
//     silently discarding seven hours of a returning player's progress — see odyssey design.md
//     Decision 1, "income must be rate-integrated, not event-driven". A contributor that
//     returns 0 for "nothing pending" pins the step at zero and burns the whole iteration
//     budget doing nothing.
// ---------------------------------------------------------------------------------------------

// The two season contributors below are gated on `seasonFrozen`, and that gate is the least
// obvious half of the freeze rule — it looks redundant against the guard in advance() and it is
// not.
//
// A frozen season's `nextGameAtClock` is left where it was and never rescheduled, so within
// seconds it sits permanently in the past. advance() would keep choosing it as the next event,
// compute `step = max(0, past - now)` = 0, resolve nothing (the phase block is skipped), and come
// round again on the same target — burning all 2,000 safetyCapIterations without decrementing
// `remaining` by a single second. Income is gated on `step > 0`, so nothing would accrue either.
// The result is a frozen *app*, which is the exact failure mode freezing the season instead of
// nulling it exists to avoid. Powerup expiry and camp completion are deliberately NOT gated:
// they are clock-driven rather than baseball, and they keep running while frozen.
//
// The gate lives inside each contributor rather than in findNextEventClock() because guarding
// your own slice is this list's contract (above) — a later contributor must never have to know
// that some other function is filtering on its behalf. Rules are resolved here rather than
// passed in so the exported signature is unchanged, which means no call site can forget the
// gate: components/layout/HeaderStats.js calls findNextEventClock(state) for its countdown and
// gets frozen behaviour with no edit, counting down to whichever non-season event is pending and
// falling back to Infinity only when nothing is. That reading stays honest because the chip is
// worded for events in general ("Time until the next scheduled event"), not for the next game.
// Two resolveRules() calls per loop iteration, against a module-memoized acts lookup, is not
// measurable.
function nextGameAtClock(state) {
  if (!state.season || state.season.phase !== 'regular') return Infinity;
  if (resolveRules(state).seasonFrozen) return Infinity;
  return state.season.nextGameAtClock;
}

function nextPlayoffRoundAtClock(state) {
  if (!state.season || state.season.phase !== 'playoffs' || !state.season.playoffs) return Infinity;
  if (resolveRules(state).seasonFrozen) return Infinity;
  return state.season.playoffs.nextRoundAtClock;
}

// A permanent powerup carries `expiresAtClock: null` and is deliberately not a candidate —
// it never expires, so it is never an event. Matches the same `!= null` test expirePowerups()
// uses above, and the two must keep agreeing or the loop steps to an expiry that never fires.
function nextPowerupExpiryAtClock(state) {
  const active = (state.powerups && state.powerups.active) || [];
  const candidates = [];
  active.forEach((p) => {
    if (p.expiresAtClock != null) candidates.push(p.expiresAtClock);
  });
  return candidates.length ? Math.min(...candidates) : Infinity;
}

function nextCampCompletionAtClock(state) {
  const roster = state.roster || [];
  const candidates = [];
  roster.forEach((p) => {
    if (p.campStatus) candidates.push(p.campStatus.completesAtClock);
  });
  return candidates.length ? Math.min(...candidates) : Infinity;
}

const EVENT_CLOCK_CONTRIBUTORS = [
  nextGameAtClock,
  nextPlayoffRoundAtClock,
  nextPowerupExpiryAtClock,
  nextCampCompletionAtClock,
  // Act VII's colony (engine/colony.js). The first contributor that is not a scheduled event at
  // all: it is the earliest instant at which a CONTINUOUS quantity reaches a boundary and its rate
  // therefore changes. Registered as an append, exactly as this list's contract asks — nothing
  // above this line was touched to add it.
  //
  // It abstains (Infinity) for every act before Act VII and for every Act VII colony with no
  // modules owned, which today is all of them, so the shipped game's step sizes are unchanged.
  nextColonyThresholdClock,
  // Act VII's site builds (engine/sites.js): colonization windows and pad builds, which share one
  // `readyAtClock` per site because a site's crew can only do one thing at a time. At most one
  // boundary per site, so the whole ladder contributes at most five over an eight-hour catch-up.
  //
  // Appended, exactly as this list's contract asks — nothing above this line was touched. It
  // abstains on the cheapest possible test (`slice.sites.length === 0`), which is every save in
  // every act until the player commits their first launch.
  nextBuildClock,
];

// The Infinity seed is the empty-case answer, so there is no "nothing pending" branch to write.
function findNextEventClock(working) {
  return EVENT_CLOCK_CONTRIBUTORS.reduce(
    (soonest, contributor) => Math.min(soonest, contributor(working)),
    Infinity
  );
}

function resolveGameSlot(working, modifiers) {
  const slot = working.season.schedule[working.season.scheduleIndex];
  const playerStrength = getTeamStrength(working, modifiers, PLAYER_TEAM_ID);
  const oppStrength = getTeamStrength(working, modifiers, slot.opponentTeamId);
  const result = simulateGame(playerStrength, oppStrength);
  const purse = result.aWins ? winPurseForAct(actIndexOf(working)) : 0;

  let standings = applyGameResult(working.season.standings, PLAYER_TEAM_ID, result.aWins, result.scoreA, result.scoreB);
  standings = applyGameResult(standings, slot.opponentTeamId, !result.aWins, result.scoreB, result.scoreA);

  const remainingAiIds = working.league.teams.map((t) => t.id).filter((id) => id !== slot.opponentTeamId);
  const { pairs } = pickAiPairingsForSlot(remainingAiIds, standings);
  pairs.forEach(([teamA, teamB]) => {
    const r = simulateGame(getTeamStrength(working, modifiers, teamA), getTeamStrength(working, modifiers, teamB));
    standings = applyGameResult(standings, teamA, r.aWins, r.scoreA, r.scoreB);
    standings = applyGameResult(standings, teamB, !r.aWins, r.scoreB, r.scoreA);
  });

  const schedule = working.season.schedule.map((g, i) =>
    i === working.season.scheduleIndex
      ? { ...g, played: true, result: result.aWins ? 'win' : 'loss', score: `${result.scoreA}-${result.scoreB}` }
      : g
  );
  const scheduleIndex = working.season.scheduleIndex + 1;

  let tradeWindows = working.season.tradeWindows.map((w) => ({
    ...w,
    open: !w.used && scheduleIndex >= w.openAtGame && scheduleIndex < w.closeAtGame,
  }));
  tradeWindows = tradeWindows.map((w) => {
    if (w.open && w.candidates.length === 0) {
      return { ...w, candidates: generateTradeCandidates(working, modifiers) };
    }
    if (!w.open && w.candidates.length > 0 && !w.used) {
      return { ...w, candidates: [] };
    }
    return w;
  });

  let season = {
    ...working.season,
    schedule,
    standings,
    scheduleIndex,
    tradeWindows,
    // The season's own `secondsPerGame` is what this act built the season with; the pace
    // multiplier is applied on top of it at read time (engine/pacing.js) rather than baked into
    // the season, so a caps-shop purchase shortens the very next gap without reshaping a season
    // in flight. At 1x — every act before the shop unlocks — this is the old expression exactly.
    nextGameAtClock: working.clock + effectiveSecondsPerGame(working.season.secondsPerGame, modifiers),
  };

  const entries = [
    createFeedEntry(
      working.clock,
      'game',
      feedMessages.gameResult(
        teamDisplayName(working, slot.opponentTeamId),
        slot.isHome,
        result.aWins,
        result.scoreA,
        result.scoreB,
        purse
      )
    ),
  ];

  if (scheduleIndex >= season.gamesPerSeason) {
    const sorted = sortStandings(standings);
    // Resolved, not balanceConfig: an act may declare `playoffTeams: 0` for a league with no
    // postseason, in which case `top` is empty and the season rolls straight to offseason.
    // `season.gamesPerSeason`/`secondsPerGame` above stay as-is on purpose — those were fixed
    // when this season was built, so a mid-season act change must not reshape a season in flight.
    const top = sorted.slice(0, playoffFieldSize(modifiers.rules.playoffTeams, sorted.length)).map((r) => r.teamId);
    if (top.includes(PLAYER_TEAM_ID)) {
      season.phase = 'playoffs';
      season.playoffs = {
        ...generateBracket(top),
        nextRoundAtClock:
          working.clock + effectiveSecondsPerPlayoffRound(modifiers.rules.secondsPerPlayoffRound, modifiers),
      };
    } else {
      season.phase = 'offseason';
    }
    entries.push(
      createFeedEntry(
        working.clock,
        'season',
        feedMessages.regularSeasonComplete(season.seasonNumber, season.phase === 'playoffs')
      )
    );
  }

  // The purse is credited HERE, inside the per-fixture resolution, rather than anywhere that
  // can see a season or a tick — and that is what makes it integrate across an offline
  // catch-up for free. advance() may resolve two hundred fixtures inside a single iteration,
  // and every one of them passes through this line exactly once, so the eight-hour path and
  // the one-second path cannot disagree about what a win paid.
  //
  // addRevenue() rather than a bare creditWallet(), because purse money is revenue like any
  // other: prestige.runStats.totalRevenue feeds calculateLegacyPoints(), and a dollar the team
  // earned on the field should count there the same as a dollar it earned selling lemonade.
  const afterGame = purse > 0 ? addRevenue({ ...working, season }, purse) : { ...working, season };

  // Act IV's Bookie settles against the game that was just played, whichever game that was.
  // Deliberately not matched on a game index — the offseason resets scheduleIndex to 0, so an
  // index-matched wager would pay out against a fixture in the following season. See
  // engine/bookie.js. A no-op in every act with no open wager, which is all of them but one.
  const hadWager = !!(working.bookie && working.bookie.wager);
  const played = settleWager(appendFeedEntries(afterGame, entries), result.aWins);
  if (!hadWager) return played;

  return appendFeedEntries(played, [
    createFeedEntry(working.clock, 'bookie', feedMessages.bookieSettled(played.bookie.lastResult)),
  ]);
}

function resolvePlayoffRound(working, modifiers) {
  const playedRoundIndex = working.season.playoffs.currentRoundIndex;
  const resolved = resolveCurrentRound(working.season.playoffs, (teamId) => getTeamStrength(working, modifiers, teamId));
  let season = { ...working.season, playoffs: { ...working.season.playoffs, ...resolved } };
  let prestige = working.prestige;
  let hasWonLeagueThisRun = working.hasWonLeagueThisRun;

  const roundLabel = playoffRoundLabel(playedRoundIndex, resolved.rounds.length);
  // The bracket keeps resolving after the player is eliminated, so a player match may not exist.
  const playerMatch = resolved.rounds[playedRoundIndex].find(
    (m) => m.teamA === PLAYER_TEAM_ID || m.teamB === PLAYER_TEAM_ID
  );
  // A playoff win pays too, and pays more — see PLAYOFF_PURSE_MULTIPLIER in
  // data/winPurseConfig.js. Leaving the postseason unpaid would mean the best games of the run
  // were the only ones worth nothing, and a player who noticed would be right to be annoyed.
  const wonPlayoffGame = !!playerMatch && playerMatch.winner === PLAYER_TEAM_ID;
  const purse = wonPlayoffGame ? playoffPurseForAct(actIndexOf(working)) : 0;

  const entries = [];
  if (playerMatch) {
    const playerIsA = playerMatch.teamA === PLAYER_TEAM_ID;
    entries.push(
      createFeedEntry(
        working.clock,
        'playoffs',
        feedMessages.playoffGameResult(
          roundLabel,
          teamDisplayName(working, playerIsA ? playerMatch.teamB : playerMatch.teamA),
          playerMatch.winner === PLAYER_TEAM_ID,
          playerIsA ? playerMatch.scoreA : playerMatch.scoreB,
          playerIsA ? playerMatch.scoreB : playerMatch.scoreA,
          purse
        )
      )
    );
  } else {
    entries.push(createFeedEntry(working.clock, 'playoffs', feedMessages.playoffRoundElsewhere(roundLabel)));
  }

  if (resolved.champion) {
    season.phase = 'offseason';
    if (resolved.champion === PLAYER_TEAM_ID) {
      prestige = {
        ...prestige,
        runStats: { ...prestige.runStats, championships: prestige.runStats.championships + 1 },
      };
      hasWonLeagueThisRun = true;
      entries.push(
        createFeedEntry(working.clock, 'championship', feedMessages.championshipWon(season.seasonNumber))
      );
    } else {
      entries.push(
        createFeedEntry(
          working.clock,
          'championship',
          feedMessages.championshipLost(teamDisplayName(working, resolved.champion))
        )
      );
    }
  } else {
    season.playoffs.nextRoundAtClock =
      working.clock + effectiveSecondsPerPlayoffRound(modifiers.rules.secondsPerPlayoffRound, modifiers);
  }

  const resolvedState = { ...working, season, prestige, hasWonLeagueThisRun };
  return appendFeedEntries(purse > 0 ? addRevenue(resolvedState, purse) : resolvedState, entries);
}

function runOffseasonTransition(working, modifiers) {
  // The offseason transition is where the next season's shape is decided, so it is the one place
  // rules are re-resolved: balanceConfig <- act.rules <- era.rules (see engine/modifiers.js).
  const rules = modifiers.rules;

  // Retirement is an Act IV unlock (data/acts.js), so it must not run before Act IV — a
  // nine-year-old does not announce his retirement, and until this gate existed one did, in
  // roughly one Act III run in six. The gate skips the whole call rather than the replacement
  // branch inside it, because that function also ages every player: see engine/retirement.js.
  const retirementUnlocked = getUnlockedFeatures(
    working.progression ? working.progression.act : 0
  ).indexOf('retirement') !== -1;
  const { roster, retired, rookies } = retirementUnlocked
    ? checkRetirements(working.roster, modifiers, rules.retireAtSeasonsRange)
    : { roster: working.roster, retired: [], rookies: [] };

  const wonChampionship = !!(working.season.playoffs && working.season.playoffs.champion === PLAYER_TEAM_ID);
  const playerRow = working.season.standings.find((s) => s.teamId === PLAYER_TEAM_ID);

  // Topping the table, which in a league with no postseason (Act III declares `playoffTeams: 0`)
  // IS the title. Captured here because the standings this reads are reset three lines below —
  // by the time an exit predicate runs, the evidence is gone. See engine/littleLeague.js.
  const finishedFirst = sortStandings(working.season.standings)[0].teamId === PLAYER_TEAM_ID;

  const leagueTeams = driftLeagueStrength(working.league.teams, rules.aiTeamStrengthRange);
  const gamesPerSeason = rules.gamesPerSeason;
  const schedule = generateSeasonSchedule(leagueTeams, gamesPerSeason);
  const standings = resetStandings(leagueTeams);
  const tradeWindows = buildTradeWindows(gamesPerSeason, rules.tradeWindows).map((w) => ({
    ...w,
    open: false,
    used: false,
    candidates: [],
  }));

  const summary = {
    seasonNumber: working.season.seasonNumber,
    wins: playerRow ? playerRow.wins : 0,
    losses: playerRow ? playerRow.losses : 0,
    madePlayoffs: !!working.season.playoffs,
    wonChampionship,
    finishedFirst,
    retired,
    rookies: rookies.map((r) => ({ id: r.id, name: r.name, position: r.position })),
  };

  const entries = [];
  retired.forEach((p) => {
    entries.push(createFeedEntry(working.clock, 'roster', feedMessages.playerRetired(p.name, p.position)));
  });
  rookies.forEach((p) => {
    entries.push(createFeedEntry(working.clock, 'roster', feedMessages.rookieSigned(p.name, p.position)));
  });
  entries.push(
    createFeedEntry(
      working.clock,
      'season',
      feedMessages.seasonRollover(summary.seasonNumber, summary.wins, summary.losses)
    )
  );

  const rolled = appendFeedEntries({
    ...working,
    roster,
    league: { teams: leagueTeams },
    season: {
      seasonNumber: working.season.seasonNumber + 1,
      phase: 'regular',
      gamesPerSeason,
      scheduleIndex: 0,
      schedule,
      // Resolved, not balanceConfig: hardcoding these reverted per-act/era pacing to 60s at the
      // first offseason transition, silently undoing the pacing applied when the act was entered.
      secondsPerGame: rules.secondsPerGame,
      // Stored unmodified, sped up at read time — same split as the in-season line above.
      nextGameAtClock: working.clock + effectiveSecondsPerGame(rules.secondsPerGame, modifiers),
      standings,
      tradeWindows,
      playoffs: null,
      offseasonSummaryPending: true,
      lastOffseasonSummary: summary,
    },
  }, entries);

  // Two things an act may need to do with a season that just ended, both of them no-ops
  // outside the act that owns them, and both keyed on that act's own state rather than on an
  // act index the tick loop would have to know:
  //   * Act IV's win-rate exit accumulates the finished season into its record. A season
  //     counts when it FINISHES, which is what "two full travel seasons" means.
  //   * An open Bookie wager cannot survive into the next season — the schedule it named is
  //     gone — so it is refunded rather than voided. See engine/bookie.js.
  return refundOpenWager(recordTravelSeason(rolled, summary));
}

// Act IV's sponsor board changes when reputation crosses a threshold, and reputation moves in
// a reducer rather than in this loop — so there is no event to hang the narration off and it is
// checked every iteration instead. Cheap: three ids against a list, and both calls return the
// same object when nothing has changed, so a quiet second allocates nothing.
//
// Deliberately AFTER checkActTransition(), so the iteration that carries a player into Act IV
// is also the one that tells them Dorsey's is waiting — a tick later would be correct too, but
// during an offline catch-up "a tick later" can be the end of the catch-up.
//
// No feed storm is possible, and not because of FEED_CAP. There are three sponsors in the whole
// game and each can be announced at most once ever (engine/sponsorships.js keeps the ledger),
// so the absolute ceiling on this line across an entire run is three entries.
function announceSponsorOffers(working) {
  const newOffers = newlyAvailableSponsors(working);
  if (newOffers.length === 0) return working;

  const announced = markSponsorsAnnounced(working, newOffers.map((s) => s.id));
  return appendFeedEntries(
    announced,
    newOffers.map((s) => createFeedEntry(working.clock, 'sponsor', feedMessages.sponsorOffered(s.name)))
  );
}

// Act VII's feed beats: the terminology corrections and the seven Earth dispatches.
//
// EMITS EVERY DUE BEAT, IN ORDER, and does not collapse a burst. That is the opposite of what
// ToastHost does with a run of games and it is deliberate — the dispatches are an arc about time
// passing, so delivering only the newest tells the player the league moved on without ever
// showing it move. See the note on pendingFeedBeats() in engine/narrative.js.
//
// No storm is possible and, as with announceSponsorOffers() above, not because of FEED_CAP: there
// are sixteen feed beats in the entire act and each fires at most once ever against
// progression.storyBeatsSeen, so the absolute ceiling across a whole playthrough is sixteen
// entries against a cap of 50.
//
// The ledger write and the feed write are in the SAME returned object. Splitting them would leave
// a window where a beat is on screen but not recorded, and an interrupted tick would replay it.
function emitStoryFeedBeats(working) {
  const due = pendingFeedBeats(working);
  if (due.length === 0) return working;

  const marked = {
    ...working,
    progression: {
      ...working.progression,
      storyBeatsSeen: [...working.progression.storyBeatsSeen, ...due.map((beat) => beat.id)],
    },
  };
  return appendFeedEntries(
    marked,
    due.map((beat) => createFeedEntry(working.clock, beat.category || 'office', beat.prose[0]))
  );
}

// The single place simulation happens. Called identically by the live 1s timer and by
// offlineProgress.js's load-time catch-up — just with a different deltaSeconds.
function advance(state, deltaSeconds) {
  let working = state;
  let remaining = deltaSeconds;
  let iterations = 0;

  while (remaining > 0 && iterations < balanceConfig.safetyCapIterations) {
    iterations += 1;
    const modifiers = computeModifiers(working);
    const nextEventClock = findNextEventClock(working);
    const step = nextEventClock === Infinity ? remaining : Math.min(remaining, Math.max(0, nextEventClock - working.clock));

    // Rate-integrated, never event-driven: one pass covers the whole step, so an 8h
    // offline return never approaches safetyCapIterations. Each contributor owns its own
    // gating — the offseason suspension now lives inside ticketing (see engine/income.js).
    if (step > 0) {
      working = creditIncome(working, totalIncomePerSecond(working, modifiers), step);
      // TWO INTEGRATION PATHS, DELIBERATELY, SHARING THE STEP AND NOTHING ELSE. The line above is
      // monotone currency accumulation: a bundle that is always >= 0, credited through a wallet
      // that structurally refuses a negative. The line below integrates SIGNED net rates against a
      // capacity clamp, from a fixed-point solve rather than a sum.
      //
      // Act VII's consumables cannot be forced through the first path. Doing so means either
      // splitting each into a produce-side and a consume-side income contributor — which loses the
      // satisfaction coupling that is the entire mechanic — or relaxing the invariant that
      // engine/wallet.js exists to hold. See engine/colony.js.
      //
      // This is a no-op returning `working` by identity for every act before Act VII and for every
      // colony with no modules owned, so it is exactly zero change to the shipped game.
      working = integrateColony(working, modifiers, step);
    }
    working = { ...working, clock: working.clock + step };
    remaining -= step;

    working = expirePowerups(working);
    const completingCamps = working.roster.filter(
      (p) => p.campStatus && p.campStatus.completesAtClock <= working.clock
    );
    working = { ...working, roster: processCampCompletions(working.roster, working.clock) };
    if (completingCamps.length > 0) {
      working = appendFeedEntries(
        working,
        completingCamps.map((p) =>
          createFeedEntry(
            working.clock,
            'camp',
            feedMessages.campCompleted(p.name, campProgramDisplayName(p.campStatus.programId))
          )
        )
      );
    }

    // ONE guard for the whole phase block rather than a check per branch: there is no season
    // at all until Act III creates one, and every branch below is a season phase transition.
    //
    // `seasonFrozen` suspends the same block from the other end — the act that stops being a
    // baseball game (Act VII) rather than the acts that are not one yet. No fixture resolves, no
    // playoff round turns over, no offseason rolls the season forward; `season`, `league`,
    // `roster`, `stadium` and `powerups` are left in state untouched and valid. Deliberately a
    // suspension and not a deletion: `advance()` dereferences `state.season` every iteration and
    // AppShell early-returns a pre-season shell when it is absent, so nulling the slice would
    // take the whole app down the Act I/II path instead of just the tabs.
    //
    // Everything outside this block keeps running while frozen, because none of it is baseball:
    // the clock advances, income accrues (minus ticketing, gated inside its own contributor —
    // see engine/income.js), powerups expire, camps complete and act transitions fire. The
    // resolved rule is read off `modifiers.rules`, never balanceConfig, because it is an act
    // override; every act shipping today leaves it false and takes this branch exactly as before.
    if (working.season && !modifiers.rules.seasonFrozen) {
      if (working.season.phase === 'regular' && working.clock >= working.season.nextGameAtClock) {
        working = resolveGameSlot(working, modifiers);
      }
      if (working.season.phase === 'playoffs' && working.season.playoffs && working.clock >= working.season.playoffs.nextRoundAtClock) {
        working = resolvePlayoffRound(working, computeModifiers(working));
      }
      if (working.season.phase === 'offseason') {
        working = runOffseasonTransition(working, computeModifiers(working));
      }
    }

    // Act VII's site builds, resolved before the phase is recomputed below, because completing a
    // build is one of the things that can move the phase. Both return `working` by identity when
    // there is nothing to do, so a quiet iteration allocates nothing and the six acts before Act
    // VII pay two cheap guards.
    //
    // Idempotent by construction: a completed build clears its `buildingId`, so replaying a step
    // finds nothing pending. That is what makes an offline return that crosses three build windows
    // resolve them once each rather than once per iteration.
    working = resolveBuilds(working);

    // THE SINGLE WRITER OF `expedition.phase` (PRD §7.7, ledger R4), recomputed from a pure
    // predicate ladder every iteration and written only when it differs. Nothing else in the
    // codebase may set this field.
    //
    // Inside the loop rather than after it, for the same reason checkActTransition() is: a phase
    // boundary crossed during an eight-hour catch-up must be crossed at the instant it happened,
    // not at the end of the span. A player who left in `lifeSupport` and returns in `deepSpace`
    // otherwise spends the whole absence gated out of the shops that should have been open.
    //
    // Last of the three because it reads what the other two just did.
    working = writeExpeditionPhase(working);

    working = updatePeakRating(working);
    // Inside the loop, so act transitions fire during offline catch-up too — a player who
    // closes the tab mid-act returns having actually crossed the boundary.
    working = checkActTransition(working);
    working = announceSponsorOffers(working);
    working = emitStoryFeedBeats(working);
  }

  return working;
}

// findNextEventClock is exported for display: the header's countdown bar reads the
// same value the loop steps to, rather than recomputing the schedule from state.
// getTeamStrength now lives in engine/strength.js — Act IV's Bookie prices a fixture before
// the tick loop plays it, and importing it from here would make the two modules circular.
// Re-exported so existing callers keep working.
module.exports = { advance, getTeamStrength, findNextEventClock };
