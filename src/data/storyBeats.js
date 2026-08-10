// Authored act prose. Kept out of components so the narrative layer is config, like every
// other authored value in src/data/.
//
// Act-entry beats render as a full-screen card (components/common/Modal.js) once each,
// tracked by progression.storyBeatsSeen.

const ACT_ENTRY_BEATS = [
  {
    id: 'act0',
    act: 0,
    title: 'The Vacant Lot',
    body: [
      'You are nine years old, it is the first week of summer, and the lot behind the hardware store is yours by right of arriving first.',
      'There is money in the dirt if you know where to look. Bottle caps, mostly. It adds up.',
    ],
    objective: 'Search the lot until you can afford a glove, a ball, and a bat.',
  },
  {
    id: 'act1',
    act: 1,
    title: 'Off the Wall',
    body: [
      'The wall runs the length of the loading dock, and somebody chalked a strike zone on it before you were born.',
      'Word gets around that you have your own bat now. By noon there is a line, and everyone in it has caps to put on it.',
    ],
    objective: 'Win 5 challenges and pull together a crew of 3.',
  },
  {
    id: 'act2',
    act: 2,
    title: 'Little League',
    body: [
      'A man with a clipboard watched you take the Paperboy for everything he had, and asked whether you had ever played on a real team.',
      'The jerseys match. There is a schedule taped inside the dugout. Your crew is on the bench behind you.',
    ],
    objective: 'Play out a season and win the league.',
  },
  {
    id: 'act3',
    act: 3,
    title: 'Travel Ball',
    body: [
      'Hotel lobbies at six in the morning, gas money collected in an envelope, and a coach who keeps a spreadsheet.',
      'The other teams have been doing this for years. It shows.',
    ],
    objective: 'Build a program worth scouting.',
  },
  {
    id: 'act4',
    act: 4,
    title: 'The Minors',
    body: [
      'Bus leagues. A real gate, a scoreboard that mostly works, and a name on the back of the jersey.',
      'Nobody here is a kid anymore.',
    ],
    objective: 'Earn the call-up.',
  },
  {
    id: 'act5',
    act: 5,
    title: 'The Big Leagues',
    body: [
      'The show. Everything you built, at full scale, in front of everyone.',
      'Somewhere behind a hardware store there is still a chalk rectangle on a brick wall.',
    ],
    objective: 'Win it all. Then do it again, differently.',
  },
];

function getActEntryBeat(actIndex) {
  return ACT_ENTRY_BEATS.find((beat) => beat.act === actIndex) || null;
}

module.exports = { ACT_ENTRY_BEATS, getActEntryBeat };
