// effectType matches a key in the modifiers bundle (engine/modifiers.js).
// durationSeconds: null = permanent (one-time purchase, tracked in purchasedPermanentIds).
// durationSeconds: number = timed buff; buying again while active refreshes the timer.
const POWERUPS = [
  {
    id: 'hot_dog_deluxe',
    name: 'Hot Dog Deluxe Menu',
    description: 'Upgraded concessions permanently boost ticket revenue.',
    cost: 800,
    effectType: 'revenueMult',
    value: 0.08,
    durationSeconds: null,
  },
  {
    id: 'front_office_analytics',
    name: 'Front Office Analytics',
    description: 'Smarter scouting permanently lowers stat upgrade costs.',
    cost: 1800,
    effectType: 'upgradeCostMult',
    value: -0.1,
    durationSeconds: null,
  },
  {
    id: 'team_bus_upgrade',
    name: 'Team Bus Upgrade',
    description: 'Less travel fatigue permanently boosts team strength.',
    cost: 1500,
    effectType: 'strengthMult',
    value: 0.05,
    durationSeconds: null,
  },
  {
    id: 'sports_psychologist',
    name: 'Sports Psychologist',
    description: 'Players recover from training camp faster, permanently.',
    cost: 1200,
    effectType: 'campSpeedMult',
    value: 0.15,
    durationSeconds: null,
  },
  {
    id: 'scouting_network',
    name: 'Scouting Network',
    description: 'Permanently improves the quality of generated rookies.',
    cost: 2000,
    effectType: 'rookieQualityMult',
    value: 0.1,
    durationSeconds: null,
  },
  {
    id: 'local_radio_ads',
    name: 'Local Radio Ad Blitz',
    description: 'A 30-minute wave of buzz boosts attendance.',
    cost: 400,
    effectType: 'attendanceMult',
    value: 0.2,
    durationSeconds: 1800,
  },
  {
    id: 'fireworks_night',
    name: 'Fireworks Night',
    description: 'A 15-minute promotion boosts ticket revenue.',
    cost: 250,
    effectType: 'revenueMult',
    value: 0.15,
    durationSeconds: 900,
  },
  {
    id: 'rally_towels',
    name: 'Rally Towels Giveaway',
    description: 'A 10-minute giveaway boosts attendance.',
    cost: 150,
    effectType: 'attendanceMult',
    value: 0.1,
    durationSeconds: 600,
  },
];

module.exports = { POWERUPS };
