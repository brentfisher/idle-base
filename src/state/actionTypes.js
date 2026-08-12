module.exports = {
  TICK: 'TICK',
  APPLY_OFFLINE_PROGRESS: 'APPLY_OFFLINE_PROGRESS',
  DISMISS_OFFSEASON_SUMMARY: 'DISMISS_OFFSEASON_SUMMARY',
  ACKNOWLEDGE_VICTORY: 'ACKNOWLEDGE_VICTORY',

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
  // Buying a record and handing it to a kid are ONE action, not two, because they are one
  // decision made through one control: `playerId: null` buys into the team's crate, a `playerId`
  // sets who walks up to it (and `songId: null` sets nobody). See engine/walkupSongs.js.
  SET_WALKUP_SONG: 'SET_WALKUP_SONG',
  START_CAMP: 'START_CAMP',
  EXECUTE_TRADE: 'EXECUTE_TRADE',

  PRESTIGE_RESET: 'PRESTIGE_RESET',
  BUY_PERK: 'BUY_PERK',

  MARK_TAB_SEEN: 'MARK_TAB_SEEN',
  SET_TEAM_NAME: 'SET_TEAM_NAME',

  // Late-game caps sink: once the franchise runs on cash, the caps a player is still
  // collecting buy pacing modifiers rather than nothing. See engine/capsShop.js.
  BUY_CAPS_UPGRADE: 'BUY_CAPS_UPGRADE',

  LOAD_SAVE: 'LOAD_SAVE',
  HARD_RESET: 'HARD_RESET',
};
