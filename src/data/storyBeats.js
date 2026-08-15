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
  {
    id: 'act-4-intro',
    kind: 'actIntro',
    actIndex: 3,
    title: 'Travel Ball',
    prose: [
      'A man in a windbreaker watched the whole last game from behind the backstop and did not '
        + 'clap once. Afterwards he asked your mother whether you could get to Ashland on a '
        + 'Saturday.',
      'So now there are eight clubs and fifteen games and a station wagon that smells like wet '
        + 'infield dirt. Somebody\'s dad keeps a book of everything you have ever done at the '
        + 'plate. Somebody\'s uncle stands by the fence and quietly takes bets on it.',
      'Nobody here cares that you won a six-game season against three teams from your own town. '
        + 'They want to know what you hit over a summer.',
    ],
    objective: 'Win 60% of your games across two full travel seasons.',
  },

  // --- Act VII: the call-up ---
  //
  // A `callUp` beat is not an `actIntro`: it is the copy for the OFFER, shown before the act it
  // describes and only to a player who has won a championship. It is not recorded in
  // storyBeatsSeen, because the offer is re-made after every subsequent title — declining is never
  // permanent (PRD §3.2), and a seen-ledger would make the first decline final.
  //
  // The two-step shape is load-bearing rather than decorative. `prose` sells the crossing;
  // `confirm` has one job, which is to state plainly that it is one-way, and it is the only screen
  // whose accept button actually dispatches. A player who mis-taps the first button gets a sentence
  // telling them what they are about to lose, and a way out that is not the destructive one.
  //
  // STORY-033 owns the final wording of the Act VII narrative and will rewrite the prose here. The
  // beat id, the shape of the object and the two-step structure are this story's and should
  // survive that rewrite — what changes is the words.
  {
    id: 'act-7-offer',
    kind: 'callUp',
    actIndex: 6,
    title: 'There is a man here from the league office',
    prose: [
      'He waited until the trophy was handed over and the photographers had gone, and then he '
        + 'introduced himself, and he did not give the name of any league you have heard of.',
      'He says baseball was never only baseball. He says the reflexes, the arm, the way you read '
        + 'a ball off a bat in the first tenth of a second — those were an aptitude test, and the '
        + 'whole planet has been sitting the test for a hundred and fifty years without being '
        + 'told. He says Earth is a farm team.',
      'He says there is a call-up. He says it is not a promotion so much as a transfer, and that '
        + 'if you take it there is a great deal of work waiting and not much of it looks like a '
        + 'ballgame.',
    ],
    acceptLabel: 'Ask him what the work is',
    confirm: {
      title: 'This one is one-way',
      prose: [
        'Accepting ends the franchise. The league keeps playing without you — the season, the '
          + 'roster, the stadium and the prestige ladder all stop being yours, and nothing in the '
          + 'game brings them back.',
        'Your titles stay won. Everything else here you are leaving behind on purpose.',
      ],
      acceptLabel: 'Accept the call-up',
      declineLabel: 'Not yet',
    },
  },

  // --- Act VII: the teardown ---
  //
  // A `teardown` beat is the copy for the sequence that plays once, when the act flips and the
  // baseball shell is retired. It is NOT recorded in storyBeatsSeen and nothing about the sequence
  // is stored: the overlay is derived from the act transition the same way toasts are derived in
  // components/common/ToastHost.js, so a reload is simply a new baseline and replays nothing.
  //
  // Three lines, and three is the budget rather than an accident. The sequence runs 4.6s; a fourth
  // line either makes it longer than an idle game has any business being, or gives each line too
  // little time to read on a phone.
  //
  // STORY-033 owns the final wording of the Act VII narrative and will rewrite the prose here.
  // The beat id and the three-line shape are this story's and should survive that rewrite.
  {
    id: 'act-7-teardown',
    kind: 'teardown',
    actIndex: 6,
    title: 'The lights go out over the infield',
    prose: [
      'They do not tear the stadium down. They simply stop coming to it.',
      'The league plays on without you — the box scores still print, somewhere, in a town that '
        + 'is no longer yours to manage.',
      'What is waiting is not a ballpark.',
    ],
    skipLabel: 'Skip',
  },
];

function getStoryBeat(beatId) {
  return STORY_BEATS.find((beat) => beat.id === beatId) || null;
}

function getActIntroBeat(actIndex) {
  return STORY_BEATS.find((beat) => beat.kind === 'actIntro' && beat.actIndex === actIndex) || null;
}

module.exports = { STORY_BEATS, getStoryBeat, getActIntroBeat };
