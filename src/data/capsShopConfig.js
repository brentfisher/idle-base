// The late-game caps sink. Every number here lives in this file; engine/capsShop.js holds the
// rules and none of the tuning, the same split data/concessionsConfig.js has with
// engine/concessions.js.
//
// WHY THIS EXISTS. Caps are Act I's currency, and the game never stops paying them: collectors
// (data/collectorTiers.js), the crew's dues and the Act II hands (data/wallBallShopConfig.js)
// are all *rates*, so they keep accruing through every later act, multiplied by Respect
// (engine/income.js: respectCapsMultiplier). Act III's CAPS_UPGRADES were the answer to caps
// going dead once — but they cap out at 2600 caps, and a player arriving in Act V is earning
// on the order of 8-16 caps a second with nothing whatsoever to spend them on. The counter in
// the header just goes up. That is the complaint this file answers.
//
// A player fully bought in on caps income at Act V is earning roughly:
//   collectors 1.0/s + crew dues 0.75/s + hands 6.9/s = 8.65/s, times a Respect multiplier
//   that reaches 1.9 at the 60 Respect a full Act II crew banks => ~16/s.
// A partially-invested player is nearer 5/s. An Act V season is 24 games at 50 simulated
// seconds, so 1,200 seconds, so between 6,000 and 20,000 caps *per season*. Prices below are
// sized against that: the first rung of each ladder is affordable within a season for the
// 5/s player, and a maxed ladder is several seasons of the 16/s player's whole income. Caps
// should feel like they finally matter, not like a second cash economy.

// WHY ACT V. Act IV already opens two sinks of its own (the sponsor board and the bookie), and
// crowding a third into it would blunt both. Act V is where the game becomes a business, cash
// income arrives properly through ticketing, and the caps in the coffee can are unambiguously
// left over from being a kid — which is also the fiction these upgrades are told in. The
// unlock id is registered in data/acts.js.
const CAPS_SHOP_UNLOCK_ID = 'capsShop';

// Each entry is repeatable up to `maxCount`, priced per copy with `costGrowth` applied per copy
// already owned (identical to CONCESSION_STANDS), and contributes `bonus` additively to the
// named key in engine/modifiers.js on EVERY copy owned. So `bonusKey: 'gameSpeedMult'` with
// `bonus: 0.15` and 4 copies owned is +0.60, i.e. a 1.6x multiplier.
//
// Every key named here must exist in BONUS_KEYS in engine/modifiers.js or the purchase is
// silently inert — listOffers() refuses to show an upgrade whose key is unknown rather than
// selling a no-op.
const CAPS_UPGRADES = [
  // The headline request: make the games run quicker, and the gaps between them shorter. Both
  // are the same number — engine/tickEngine.js schedules the next game at
  // `clock + secondsPerGame`, and the on-field replay is sized from the same value — so one
  // multiplier shortens the wait and speeds the broadcast together. See engine/pacing.js.
  //
  // Capped at 5 copies for +0.75, a 1.75x pace. That is deliberate and it is the tightest
  // clamp in the shop: Act V's 24-game season at 50s is 20 minutes, and 1.75x brings it to
  // 11.4 — brisk, but still a season you watch rather than a number that resolves. Past about
  // 2x the box scores stop being readable and the game stops being a game about baseball.
  {
    id: 'groundsCrew',
    name: 'A Word With the Grounds Crew',
    description:
      'They drag the infield faster when there is a coffee can of caps in it for them. Nobody has ever explained why they want these.',
    bonusKey: 'gameSpeedMult',
    bonus: 0.15,
    cost: 2000,
    costGrowth: 1.85,
    maxCount: 5,
  },
  // The second half of "and in between": the offseason and the playoff gaps, which the pace
  // multiplier above also covers, are the dead air between the parts the player came for.
  // Folded into the same key rather than given its own — two speed sliders is one more thing
  // to reason about for no extra decision.

  // Caps buying cash is the trade the whole shop is built on: the childhood currency is still
  // worth something to the people who have been around the park since you were nine.
  {
    id: 'clubhouseGuy',
    name: 'The Clubhouse Guy Remembers You',
    description:
      'He was the clubhouse guy when you were twelve too. He still keeps the good bats back, and he still takes caps.',
    bonusKey: 'revenueMult',
    bonus: 0.08,
    cost: 3500,
    costGrowth: 1.9,
    maxCount: 4,
  },
  // Strength is the dearest and the shallowest ladder on purpose. Reputation, stat upgrades,
  // camp and the trade deadline are all already strength sinks priced in cash; letting caps
  // buy the same axis cheaply would make the cash economy optional, which is the opposite of
  // what Act V is for. +0.05 x 3 is +15%, a real but not decisive edge.
  {
    id: 'scoreboardKid',
    name: 'The Scoreboard Kid',
    description:
      'Twelve years old, hangs the numbers by hand, and watches every pitch of every game. He will tell you what he sees for a fistful of caps.',
    bonusKey: 'strengthMult',
    bonus: 0.05,
    cost: 6000,
    costGrowth: 2.1,
    maxCount: 3,
  },
  // Camp is gated on a slot and a clock rather than on money, so speeding it is the one thing
  // cash genuinely cannot buy — which makes it the right thing for a surplus currency to.
  {
    id: 'batboyShifts',
    name: 'Batboy Shifts, Split Two Ways',
    description:
      'The kid covers the drills you would otherwise have to sit through. He gets the caps and the stories.',
    bonusKey: 'campSpeedMult',
    bonus: 0.2,
    cost: 4500,
    costGrowth: 1.9,
    maxCount: 3,
  },
];

const CAPS_CURRENCY = 'caps';

function getCapsUpgrade(id) {
  return CAPS_UPGRADES.find((u) => u.id === id) || null;
}

module.exports = { CAPS_SHOP_UNLOCK_ID, CAPS_UPGRADES, CAPS_CURRENCY, getCapsUpgrade };
