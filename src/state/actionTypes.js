module.exports = {
  TICK: 'TICK',
  APPLY_OFFLINE_PROGRESS: 'APPLY_OFFLINE_PROGRESS',
  DISMISS_OFFSEASON_SUMMARY: 'DISMISS_OFFSEASON_SUMMARY',
  // Closes the welcome-back screen by setting `state.returnSummary` to null. A SEPARATE ACTION FROM
  // THE OFFSEASON DISMISSAL ABOVE, not a mode on it: the two screens report different things (an
  // absence versus a season rollover), are produced by different code, and can be pending at the
  // same time — a player away nine hours can come back to both.
  //
  // Dismissal is the ONLY thing that clears the slice. APPLY_OFFLINE_PROGRESS carries an existing
  // summary forward when the elapsed time is below balanceConfig.returnSummaryMinSeconds, which is
  // what makes the mount dispatch idempotent under React 18's dev double-invoke; see
  // engine/offlineProgress.js.
  DISMISS_RETURN_SUMMARY: 'DISMISS_RETURN_SUMMARY',
  ACKNOWLEDGE_VICTORY: 'ACKNOWLEDGE_VICTORY',
  ACCEPT_CALL_UP: 'ACCEPT_CALL_UP',

  SEARCH_LOT: 'SEARCH_LOT',
  BUY_LOT_ITEM: 'BUY_LOT_ITEM',
  DISMISS_STORY_BEAT: 'DISMISS_STORY_BEAT',

  RESOLVE_WALL_BALL_CHALLENGE: 'RESOLVE_WALL_BALL_CHALLENGE',
  BUY_WALL_BALL_UPGRADE: 'BUY_WALL_BALL_UPGRADE',

  BUY_CONCESSION: 'BUY_CONCESSION',

  BUY_SPONSORSHIP: 'BUY_SPONSORSHIP',
  PLACE_BOOKIE_WAGER: 'PLACE_BOOKIE_WAGER',
  // A prop bet is a separate action from the moneyline wager above, not an extra field on it:
  // the two are priced by different rules (a prop's odds are rolled per-offer, the moneyline's
  // are derived from the matchup) and share nothing but the wallet.
  PLACE_PROP_BET: 'PLACE_PROP_BET',

  SET_TICKET_PRICE: 'SET_TICKET_PRICE',
  BUY_POWERUP: 'BUY_POWERUP',
  UPGRADE_STADIUM: 'UPGRADE_STADIUM',

  BUY_STAT_UPGRADE: 'BUY_STAT_UPGRADE',

  // The same purchase, repeated until the wallet or the cap stops it. A separate action rather than
  // a `count` field on the one above, because the two are different player intents and refuse for
  // different reasons: a single buy is "one more point", and this is "spend what I have on this
  // stat" — which is the thing a player wants after being away long enough for the money to pile
  // up, and which they otherwise do by clicking the same chip fourteen times.
  //
  // It carries no count. How many is a rules question about prices the player cannot see the curve
  // of, so the reducer works it out by actually making the purchases; see rosterActions.js.
  BUY_STAT_UPGRADE_MAX: 'BUY_STAT_UPGRADE_MAX',
  // Buying a record and handing it to a kid are ONE action, not two, because they are one
  // decision made through one control: `playerId: null` buys into the team's crate, a `playerId`
  // sets who walks up to it (and `songId: null` sets nobody). See engine/walkupSongs.js.
  SET_WALKUP_SONG: 'SET_WALKUP_SONG',
  START_CAMP: 'START_CAMP',
  EXECUTE_TRADE: 'EXECUTE_TRADE',

  PRESTIGE_RESET: 'PRESTIGE_RESET',
  BUY_PERK: 'BUY_PERK',

  // Act VII's fabrication shop (PRD §6.4) — the act's one Salvage sink. ONE action, because a
  // module is only ever bought: nothing in this act sells, scraps or refunds one, and the colony is
  // a throttle rather than a ratchet (data/actSevenModulesConfig.js measures that no module is ever
  // removed even under total starvation). A SELL_MODULE that had to exist would change the shape of
  // engine/colony.js's solve, not just add a branch here.
  //
  // Carries `offerId` and not `moduleId`, matching BUY_LOT_ITEM and FILL_STANDING_ORDER: it is the
  // id of a row the shop offered, and every shop in this game names it the same way.
  BUY_MODULE: 'BUY_MODULE',

  // Act VII's contract board. THREE ACTIONS AND NOT ONE WITH A MODE, because they are three
  // different decisions made through three different controls and they refuse for different
  // reasons: accepting is bounded by the two-slot ceiling, claiming is bounded by what fits in the
  // tank, and abandoning is never refused for anything but "there is nothing there". Folding them
  // into one action would mean one reducer branch that has to re-derive which of the three the
  // player meant. See engine/contracts.js.
  //
  // There is deliberately no CLICK-side action here. Innings Limit detects the click by comparing
  // `clicker.totalClicks` at the window boundary against the value sealed at accept, so the click
  // reducer needs no knowledge of contracts at all.
  ACCEPT_CONTRACT: 'ACCEPT_CONTRACT',
  CLAIM_CONTRACT: 'CLAIM_CONTRACT',
  ABANDON_CONTRACT: 'ABANDON_CONTRACT',

  // Act VII's post-game (PRD §7.8). The endless ladder of standing orders that moves Earth up the
  // majors board — the last purchase in the game, and the only one that spends two currencies at
  // once (Salvage through the wallet, Fuel through engine/colony.js). See engine/board.js.
  //
  // A PURCHASE AND NOT A TIMED COMMITMENT, which is why there is one action here and not the
  // accept/claim/abandon trio the contract board needs: there is no window to open, nothing to
  // hold, and nothing to walk away from. It resolves entirely inside the dispatch.
  FILL_STANDING_ORDER: 'FILL_STANDING_ORDER',

  // Act VII's site ladder (PRD §7.1, §7.2). Colonizing a rung, and building the one pad tier that
  // rung may hold — the act's other Salvage sink, and the only purchase in the game that adds a
  // PERMANENT draw on a shared pool rather than a one-off cost. See engine/sites.js.
  //
  // ONE ACTION FOR TWO KINDS OF BUILD, because they are one kind of ROW. An offer id is
  // `<buildingId>@<siteId>` and engine/sites.js's OFFER_SEPARATOR note argues that the prefix IS
  // the `buildingId` that gets stored, so there is one vocabulary and no mapping table anywhere.
  // A COLONIZE_SITE / BUILD_PAD pair here would make the dispatcher decide which of the two it had
  // pressed, which is a rules question the engine answers by parsing the id it emitted.
  //
  // It is a PURCHASE and not a completion. It opens a build window; engine/sites.js's
  // resolveBuilds() is the single path that finishes one, run from advance() so an eight-hour
  // offline return grants it exactly once.
  //
  // Carries `offerId` and not `siteId`, matching BUY_MODULE, BUY_LOT_ITEM and FILL_STANDING_ORDER:
  // it is the id of a row the shop offered, and every shop in this game names it the same way.
  BUY_SITE_BUILD: 'BUY_SITE_BUILD',

  // Act VII's launches (PRD §7.3). The act's one irreversible spend, and the only purchase in the
  // game that dumps a whole tank rather than a price — committing spends everything up to the
  // launch band's ceiling, not the threshold, and there is no change.
  //
  // ONE ACTION AND NO CANCEL. There is deliberately no ABORT_LAUNCH beside this, and the absence is
  // the design rather than a gap: §7.3 makes the burn a commitment, engine/launch.js takes no rng
  // so a committed burn always arrives, and a recall would turn the overshoot decision into a
  // free option. The confirm surface in components/expedition/LaunchPanel.js is where the decision
  // is reversible; after the dispatch it is not.
  //
  // Carries `offerId` and not `destinationSiteId`, matching BUY_SITE_BUILD, BUY_MODULE and
  // BUY_LOT_ITEM: it is the id of a row the shop offered, and every shop in this game names it the
  // same way. engine/launch.js's offer id is also the stored record's id, so the burn in the log
  // can be traced straight back to the row that started it.
  COMMIT_LAUNCH: 'COMMIT_LAUNCH',

  // Act VII's artifact puzzles (PRD §8). Five ids rather than one because each is a different
  // player event with different economics: a typed answer is graded and costs an attempt, the
  // manual operation spends the governor's cooldown, the bench simulates without either, and the
  // two purchases spend different currencies. Collapsing them behind one id would put the branch
  // in the reducer and hide which of the five §8.7 paths a save actually took.
  SUBMIT_PUZZLE_ANSWER: 'SUBMIT_PUZZLE_ANSWER',
  OPERATE_PUZZLE_MANUALLY: 'OPERATE_PUZZLE_MANUALLY',
  SIMULATE_PUZZLE_ANSWER: 'SIMULATE_PUZZLE_ANSWER',
  BUY_PUZZLE_HINT: 'BUY_PUZZLE_HINT',
  BUY_PUZZLE_INSTRUMENT: 'BUY_PUZZLE_INSTRUMENT',

  MARK_TAB_SEEN: 'MARK_TAB_SEEN',
  SET_TEAM_NAME: 'SET_TEAM_NAME',

  // Late-game caps sink: once the franchise runs on cash, the caps a player is still
  // collecting buy pacing modifiers rather than nothing. See engine/capsShop.js.
  BUY_CAPS_UPGRADE: 'BUY_CAPS_UPGRADE',

  LOAD_SAVE: 'LOAD_SAVE',
  HARD_RESET: 'HARD_RESET',
};
