// Act VII's generation powerups (PRD §5.9). Same shape as data/powerupsConfig.js plus one field:
// `currency: 'salvage'`, because this is the first act whose shop is not priced in cash.
//
// `effectType` matches a key in the modifiers bundle. `durationSeconds: null` means permanent (a
// one-time purchase tracked in `powerups.purchasedPermanentIds`); a number means a timed buff that
// refreshes its timer if bought again while active.
//
// THEY REUSE state.powerups.active VERBATIM, which is the point. computeModifiers() already
// composes every active powerup into the bonus bundle and expirePowerups() in engine/tickEngine.js
// already retires them, offline catch-up included — so these ten entries need zero new machinery
// and inherit an expiry path that has been exercised for six acts.
//
// ---------------------------------------------------------------------------------------------
// WHY THE TIMED ONES ARE WORTH BUYING, AND IT IS NOT THE OUTPUT NUMBER.
//
// Every output multiplier is applied BEFORE the satisfaction solve (engine/colony.js reads them in
// grossProduction, which the file explains at length). That is what makes a Power powerup the
// right purchase in a crisis rather than a luxury in a surplus: raising gross Power raises the
// RATION, which un-throttles every consumer on the bus at once. A starved colony bought back to
// health by one Bus Reroute recovers its Salvage income, its Provisions, and its Oxygen together.
//
// Applied after the solve they would be worth a fraction of that — they would make a starved
// colony's Power number bigger without letting anything else use it. The ordering is the design.
// MEASURED, under `node`, on a deliberately POWER-STARVED colony — 6 RTGs (18 Pwr/s) against
// 30 Reclaimer Drones and 10 Hydroponics Bays drawing 95 Pwr/s, with the bus already at zero. This
// is the crisis these are sold for, and the numbers are the argument for the ordering above:
//
//   no powerup                      power ration 0.1513   Salvage 13.613/s
//   Bus Reroute        (+0.25 pwr)  power ration 0.1891   Salvage 17.017/s    (+25.0%)
//   Deep-Cycle         (+0.60 pwr)  power ration 0.2420   Salvage 21.782/s    (+60.0%)
//   Closed-Loop        (-0.12 draw) power ration 0.1719   Salvage 15.470/s    (+13.6%)
//   both draw permanents (-0.22)    power ration 0.1939   Salvage 17.453/s    (+28.2%)
//
// READ THE SALVAGE COLUMN. None of these is a Salvage powerup, and every one of them raised
// Salvage income — because raising the ration un-throttles the drones that were already owned.
// That is the whole point of applying output multipliers before the solve, and it is why a Power
// powerup is the correct purchase in a Power crisis rather than a consolation prize.
//
// The draw permanents compose sub-additively (-0.12 gives +13.6%, -0.22 gives +28.2%, not +24.9%)
// because a ration is a quotient, not a sum. Worth knowing before anyone prices a third one.
//
// A NULL RESULT WORTH KEEPING: on a PROVISIONS-starved colony the same Bus Reroute changes
// nothing at all — ration 0.2000 before and after. Correct, and not a bug: Power was not the
// binding constraint there, so more of it buys nothing. These are situational purchases, and a
// player who buys the wrong one has wasted their Salvage. That is the decision being sold.
// ---------------------------------------------------------------------------------------------
//
// COSTS ARE §5.9's, RESTATED AGAINST §5.2's MEASURED BANDS. The draft priced these against a scale
// roughly 11x too small, from the same error §8.4 records: the document assumed a mid-tier module
// cost ~5,000 for the whole act, when the act's lifetime earn is ~2.81M. These figures are the
// corrected ones.
//
// THEY ARE ELASTIC, NOT COMPULSORY. §5.3's budget rows do not include them, so a player who buys
// none of them still clears every phase on schedule. That is what makes them the safe place to
// absorb a rebalance — and it matters here, because STORY-025 measured `lifeSupport` earning 2.6x
// its §5.3 budget under an optimal buyer. This catalogue is one of the two sinks (with §8's hint
// ladder) that surplus is supposed to flow into. IF A LATER STORY RETUNES THE LADDER DOWN, THESE
// PRICES SHOULD BE RE-CHECKED BEFORE ANY COMPULSORY ROW IS TOUCHED.
const ACT_SEVEN_POWERUPS = [
  // --- Timed ---
  {
    id: 'bus_reroute',
    name: 'Bus Reroute',
    description: 'Shunts the good cable onto the loads that are actually asking for it.',
    cost: 2000,
    currency: 'salvage',
    effectType: 'powerOutputMult',
    value: 0.25,
    durationSeconds: 900,
  },
  {
    id: 'flush_the_lines',
    name: 'Flush the Lines',
    description: 'Blows the scale out of the scrubber stacks. Smells like a struck match for an hour.',
    cost: 2600,
    currency: 'salvage',
    effectType: 'oxygenOutputMult',
    value: 0.35,
    durationSeconds: 1200,
  },
  {
    id: 'grow_lamps',
    name: 'Grow Lamps',
    description: 'Everything under the racks gets a longer day than the sky is offering.',
    cost: 2600,
    currency: 'salvage',
    effectType: 'provisionsOutputMult',
    value: 0.35,
    durationSeconds: 1200,
  },
  {
    id: 'reclaimer_overclock',
    name: 'Reclaimer Overclock',
    description: 'Runs the drones past their duty cycle. They will need the rest afterwards.',
    cost: 3200,
    currency: 'salvage',
    effectType: 'salvageOutputMult',
    value: 0.5,
    durationSeconds: 600,
  },
  {
    id: 'deep_cycle_discharge',
    name: 'Deep-Cycle Discharge',
    description: 'Empties every cell you own into five minutes of not having to choose.',
    cost: 12000,
    currency: 'salvage',
    effectType: 'powerOutputMult',
    value: 0.6,
    durationSeconds: 300,
  },
  {
    id: 'debris_field_pass',
    name: 'Debris Field Pass',
    description: 'The belt comes back around. For five minutes there is more of it than there is time.',
    cost: 24000,
    currency: 'salvage',
    effectType: 'salvageOutputMult',
    value: 1.2,
    durationSeconds: 300,
  },
  {
    id: 'cryo_top_off',
    name: 'Cryo Top-Off',
    description: 'Runs the plant cold and hard for half an hour and asks no questions.',
    cost: 40000,
    currency: 'salvage',
    effectType: 'fuelOutputMult',
    value: 0.4,
    durationSeconds: 1800,
  },

  // --- Permanent ---
  // The two draw reductions carry NEGATIVE values, because lifeSupportDrawMult multiplies DEMAND
  // and lower is better. See the clamp comment in data/modifierKeysConfig.js — this is the one
  // direction in the modifier vocabulary that is inverted, and it is inverted here too.
  {
    id: 'closed_loop_recycling',
    name: 'Closed-Loop Recycling',
    description: 'Nothing leaves the hull that has not been asked twice whether it had to.',
    cost: 90000,
    currency: 'salvage',
    effectType: 'lifeSupportDrawMult',
    value: -0.12,
    durationSeconds: null,
  },
  {
    id: 'second_skin_seals',
    name: 'Second Skin Seals',
    description: 'The slow leak you stopped hearing about a month ago. It was never nothing.',
    cost: 210000,
    currency: 'salvage',
    effectType: 'lifeSupportDrawMult',
    value: -0.1,
    durationSeconds: null,
  },
  {
    id: 'the_gyre',
    name: 'The Gyre',
    description: 'You stop chasing the wreck and let the wreck come to you. It always does.',
    cost: 340000,
    currency: 'salvage',
    effectType: 'salvageOutputMult',
    value: 0.3,
    durationSeconds: null,
  },
];

module.exports = { ACT_SEVEN_POWERUPS };
