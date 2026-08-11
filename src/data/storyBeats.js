// Every piece of authored act prose in the game. Components render beats; they never
// contain prose (PRD §6.3).
//
// An `actIntro` beat is shown as a full-screen story card the moment the player enters its
// act, then recorded in progression.storyBeatsSeen so it never reappears.
const STORY_BEATS = [
  {
    id: 'act-1-intro',
    kind: 'actIntro',
    actIndex: 0,
    title: 'The Vacant Lot',
    prose: [
      'You are nine years old. Behind the hardware store on Vine there is a lot nobody mows, '
        + 'full of ragweed and broken glass and the ghosts of a hundred summer afternoons.',
      'Mr. Dorsey throws his bottle caps out the back door. They work their way down into the '
        + 'dirt, and Tommy Reese pays a penny apiece for the good ones — the old painted kind '
        + 'with the cork still in them.',
      'So you kneel down in the dust, and you start looking.',
    ],
    objective: 'Buy the Starter Kit: a ball, a glove and a bat.',
  },
  {
    id: 'act-2-intro',
    kind: 'actIntro',
    actIndex: 1,
    title: 'Off the Wall',
    prose: [
      'The bat is thirty-one inches of taped-up ash and it rings when you hit one right. '
        + 'You know because you have hit exactly four of them right, all against the loading '
        + 'dock wall behind the store.',
      'Somebody chalked a strike zone on those bricks years ago. Somebody redraws it every '
        + 'spring. By noon there are six kids waiting their turn and all of them think they '
        + 'are better than you.',
      'They are not. Not yet. But caps are getting harder to find, and you are going to have '
        + 'to start winning them off people.',
    ],
    objective: 'Take on the wall — and the kids lined up in front of it.',
  },
  {
    id: 'act-3-intro',
    kind: 'actIntro',
    actIndex: 2,
    title: 'Little League',
    prose: [
      'Mr. Dorsey signs the form because somebody has to, and just like that the three kids '
        + 'who used to shag your foul balls behind the hardware store are on a roster with '
        + 'your name at the top of it.',
      'They give you uniforms that do not fit and a coach who works nights at the plant. Six '
        + 'games. Three other teams, and every one of them has been practising since March.',
      'The wall taught you to win a thing you bet on. This is different. This one you have to '
        + 'win with eight other kids, most of whom you did not choose.',
    ],
    objective: 'Finish first in the six-game Little League season.',
  },
];

function getStoryBeat(beatId) {
  return STORY_BEATS.find((beat) => beat.id === beatId) || null;
}

function getActIntroBeat(actIndex) {
  return STORY_BEATS.find((beat) => beat.kind === 'actIntro' && beat.actIndex === actIndex) || null;
}

module.exports = { STORY_BEATS, getStoryBeat, getActIntroBeat };
