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
  // THIS BEAT IS IN EARTH'S VOICE, AND IT IS THE LAST THING IN THE GAME THAT IS. Everything from
  // the teardown onward is written as a document filed by the Outer Circuit's Office of Player
  // Development (PRD §10.1): passive, quantified, flat. The offer is not, and must not be — it
  // happens on this side of the crossing, on a ballfield, in the ten minutes after a trophy
  // presentation, and it is delivered by a man standing at a fence. The register switch IS the
  // teardown. Rewrite this in the Office's voice and the switch has nothing left to switch from.
  //
  // The man is not a new character. He is Act IV's scout — "a man in a windbreaker watched the
  // whole last game from behind the backstop and did not clap once" (act-4-intro, above). Act VII
  // spends six acts' worth of setup rather than inventing a narrator; the folder he opens here is
  // the file he opened on the player at nine, and act-7-ellis eventually shows it from his side.
  {
    id: 'act-7-offer',
    kind: 'callUp',
    actIndex: 6,
    title: 'The man in the windbreaker is still here',
    prose: [
      'The photographers get their picture and leave. The man in the windbreaker does not. He was '
        + 'behind the backstop at Ashland when you were twelve and he did not clap then either, '
        + 'and he has been standing at the fence for an hour with a folder under his arm.',
      'He opens it. The top sheet is a scouting report and it is about you, and the date on it is '
        + 'the summer you were nine — a lot behind a hardware store, four hours, bottle caps '
        + 'sorted by hand. There is forty years of paper under that sheet and none of it was filed '
        + 'in this county.',
      'It takes him four minutes and he never raises his voice. The game was never only a game. '
        + 'The arm, the reflexes, the way you read a ball off the bat in the first tenth of a '
        + 'second — that is the test, this whole planet has been sitting it for a hundred and '
        + 'forty-one years, and somebody has been keeping the results. There is a call-up. Not a '
        + 'promotion, he says. A transfer. And the work at the other end does not look much like a '
        + 'ballgame.',
    ],
    acceptLabel: 'Ask him what the work is',
    confirm: {
      // Flat, short, and deliberately not in anybody's voice. This screen is a confirmation for a
      // destructive, unrepeatable action; atmosphere here would be a way of not saying the thing.
      title: 'This one is one-way',
      prose: [
        'Accepting ends the franchise. The league keeps playing without you — the season, the '
          + 'roster, the stadium and the prestige ladder all stop being yours, and nothing in the '
          + 'game brings them back.',
        'Your titles stay won. Everything else here you are leaving on purpose. If this is not the '
          + 'year, he will be at the next one — the offer comes back with every title you win.',
      ],
      acceptLabel: 'Accept the call-up',
      declineLabel: 'Not yet',
    },
  },

  // --- Act VII: the Office ---
  //
  // EVERY BEAT BELOW IS A DOCUMENT. Nobody in this act speaks TO the player conversationally and
  // nothing is dramatised; the comedy and the dread come from the same place, which is a flat
  // administrative voice handling something enormous as routine volume (PRD §10.1). The rules, for
  // anyone editing this section:
  //
  //   * Passive voice for the Office, active for Ellis. That is the only tell and it is enough.
  //   * No exclamation marks. No second-person imperative dressed as encouragement. No
  //     "congratulations."
  //   * Numbers wherever a number is available. The Office quantifies things that should not be
  //     quantified: distances, decades, a career, a planet.
  //   * NEVER EXPLAIN THE METAPHOR. The Office assumes the player already knows what a pitch is;
  //     it has no idea the player thinks it is a sport.
  //   * Nothing generically sci-fi. If a line could appear in any other space game, it is wrong.
  //
  // `trigger` is a predicate id resolved by engine/narrative.js — it is LOGIC and deliberately not
  // a function here, because data/ holds no logic. `mode` is 'card' (a StoryCard, dismissed by the
  // player) or 'feed' (one line appended to the event feed). Default is 'card'.
  //
  // TRIGGERS ARE LEVEL PREDICATES, NEVER EDGES — "phase is at least lunar", never "phase just
  // became lunar". An eight-hour catch-up that crosses four triggers inside one advance()
  // iteration satisfies four predicates, and the storyBeatsSeen ledger is what stops any of them
  // firing twice. This is engine/sponsorships.js's announcedOfferIds argument applied to prose.

  {
    id: 'act-7-teardown',
    kind: 'teardown',
    actIndex: 6,
    mode: 'card',
    trigger: 'callUpAccepted',
    title: 'Signal Acquired',
    // THREE LINES, AND THREE IS A TIMING CONSTRAINT, NOT A STYLE CHOICE. The teardown overlay's
    // CSS sequence runs 4.6s (see the feature section in styles/global.css); a fourth line either
    // overruns it or gives each line too little time to read on a phone. If this ever needs a
    // fourth, the CSS has to move first.
    //
    // No explanation here on purpose (PRD §10.2, movement 1): signal loss, a form header, a
    // designation the player does not recognise, and one button. The reveal is paced across the
    // whole of `aftermath` and the player must stay ahead of the text.
    prose: [
      'CARRIER LOST — LOCAL BROADCAST — 00:00:04',
      'CARRIER ACQUIRED — OUTER CIRCUIT RELAY 9 — 00:00:00',
      'Good evening. This transmission has been waiting one hundred and forty-one years for a '
        + 'qualifying result. You produced one at 21:14 local. Do not adjust anything.',
    ],
    objective: 'Acknowledge.',
    skipLabel: 'Skip',
  },

  // Keeps `kind: 'actIntro'` and `actIndex: 6` so getActIntroBeat() and AppShell raise it with
  // ZERO change — reuse before invention.
  {
    id: 'act-7-intro',
    kind: 'actIntro',
    actIndex: 6,
    mode: 'card',
    title: 'Affiliate 9',
    prose: [
      'INTAKE — OUTER CIRCUIT, OFFICE OF PLAYER DEVELOPMENT — AFFILIATE 9 (CLASS: ROOKIE)',
      'You are receiving this because a development program on your affiliate has returned a '
        + 'qualifying result. The program is the one you have been playing. It is not a sport. It '
        + 'was never registered as a sport. It was registered, in the year you would call 1885, as '
        + 'a control-system aptitude curriculum, and it was seeded on this affiliate because a '
        + 'species that is *taught* a control system forgets it and a species that is *made to '
        + 'play* one does not.',
      'Everything you know how to do, you can still do. The Office wishes to be clear that nothing '
        + 'has been taken from you and nothing was faked. The pitch is a burn. The catch is a '
        + 'rendezvous. You are extremely good at both. You are simply, as of this evening, aware '
        + 'of it.',
      'There is a crossing available. It is one way, it is confirmed, and it does not have a date '
        + 'on it because it does not need one. First you will have to build something that can '
        + 'leave.',
    ],
    objective: 'Bring the site back online.',
  },

  // THE ELLIS CARD IS THE ACT'S PAYLOAD and it lands only because movements 2 and 3 refused to
  // explain anything. Note the register: Ellis never writes a letter, he files a report, and the
  // warmth leaks through the form fields. "I said I was there for the pitching" is a scout
  // declining to say the true thing in a box that does not have room for it.
  {
    id: 'act-7-ellis',
    kind: 'office',
    actIndex: 6,
    mode: 'card',
    trigger: 'phaseAtLeastLifeSupport',
    title: 'Territory 9',
    prose: [
      'SCOUTING FILE 9-0001 — OPENED 40 YEARS AGO — AREA SCOUT: ELLIS, TERRITORY 9',
      'First observed this player at nine years of age, in a vacant lot behind a hardware store on '
        + 'Vine, sorting bottle caps by hand for approximately four hours. Recommended continued '
        + 'monitoring. No action requested at that time.',
      'Observed subsequently: a chalk strike zone on a loading dock. A six-game season in a '
        + 'uniform that did not fit. Fifteen games a summer in a station wagon. I attended most of '
        + 'these. I was asked once, by the subject\'s mother, whether I was somebody\'s father. I '
        + 'said I was there for the pitching.',
      'It is customary at this point to append a projection. Mine has not changed in thirty-one '
        + 'years, and the Office has queried it twice as unrealistic. I have declined to revise it '
        + 'both times.',
    ],
    objective: 'Reach the Moon.',
  },

  {
    id: 'act-7-life-support',
    kind: 'office',
    actIndex: 6,
    mode: 'card',
    trigger: 'phaseAtLeastLifeSupport',
    title: 'Class A',
    prose: [
      'ASSIGNMENT — AFFILIATE 9 — LIFE SUPPORT, THEN TRANSIT',
      'Air, water, food, power. The Office is aware that your affiliate regards these as a '
        + 'humanitarian matter. They are logistics. Every one of them is a rate, every rate has a '
        + 'sign, and the only question the Office has ever asked of a site is whether the sign is '
        + 'positive when nobody is looking at it.',
      'You have been doing this since you were eleven, with a snack table behind a chain-link '
        + 'fence. The quantities have changed. Nothing else about it has.',
    ],
    objective: 'Fill a transit requisition and leave the surface.',
  },

  {
    id: 'act-7-first-launch',
    kind: 'office',
    actIndex: 6,
    mode: 'card',
    trigger: 'anyLaunchDeparted',
    title: 'Departure Confirmed',
    prose: [
      'TRANSIT — AFFILIATE 9 — VEHICLE 1 — DEPARTED',
      'Your requisition has been filled and your vehicle has left the surface. The Office notes, '
        + 'for the file, that this is the first object ever launched from this affiliate by a '
        + 'member of the program rather than by its host civilisation.',
      'Four burns. In the order you were taught. You did not require the order to be explained.',
    ],
    objective: 'Colonise it.',
  },

  {
    id: 'act-7-deep-space',
    kind: 'office',
    actIndex: 6,
    mode: 'card',
    trigger: 'phaseAtLeastDeepSpace',
    title: 'Double-A',
    prose: [
      'RECLASSIFICATION — AFFILIATE 9 — CLASS AA — WITH NOTES ON DISTANCE',
      'From here the Office must be candid about scale, because the next requisition will look '
        + 'like an error and it is not one. Everything you have done so far has been on the '
        + 'infield. You are now being asked to play the gap.',
      'Your affiliate\'s coverage of the program includes a phrase the Office has always found '
        + 'unusually exact: *the warning track*. A strip of different ground, laid deliberately, so '
        + 'that a player running full speed at something he cannot see will feel it under his feet '
        + 'before he reaches it. We did not put that in the curriculum. Somebody down there worked '
        + 'it out.',
    ],
    objective: 'Reach the outer sites.',
  },

  {
    id: 'act-7-majors',
    kind: 'office',
    actIndex: 6,
    mode: 'card',
    trigger: 'phaseAtLeastMajors',
    title: 'The Show',
    prose: [
      'FILE 9-0001 — CLOSED — ELLIS, TERRITORY 9',
      'Subject has crossed. Territory 9 is now, by the Office\'s own definition, an affiliate that '
        + 'has produced. I am required to note that this occurs in roughly one territory in nine '
        + 'thousand and that I am therefore not a good scout, I am a lucky one, and I have never '
        + 'once believed that.',
      'I am not going with you. Somebody has to stay and watch the lot.',
    ],
    objective: 'Everything after this is yours.',
  },

  // --- Act VII: the mapping, delivered as corrections to the player's terminology ---
  //
  // MOVEMENT 3 OF THE REVEAL (PRD §10.2), and the whole of it. The player types the baseball word;
  // the Office substitutes the operational one. It never once says "baseball was actually
  // spaceflight" — the mapping is the reader's to notice, and every one of these lines would be
  // ruined by a sentence explaining it.
  {
    id: 'act-7-first-salvage',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'anySalvageEarned',
    title: 'Intake, materials',
    prose: [
      'Materials received and graded. The Office notes that you have been picking useful things '
        + 'out of dirt with your hands since you were nine and that this is, against expectation, '
        + 'a scouted attribute.',
    ],
  },
  {
    id: 'act-7-mapping-pitch',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'threeModulesOnline',
    title: 'Terminology',
    prose: [
      'Correction, for the file: the word you are using is *pitch*. The instrument is a burn. '
        + 'Thrust along a vector, committed to before the result is visible. You have thrown, by '
        + 'our count, forty-one thousand of them. Nobody has ever had to explain a burn to you and '
        + 'nobody is going to start now.',
    ],
  },
  {
    id: 'act-7-mapping-catch',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'sixModulesOnline',
    title: 'Terminology',
    prose: [
      'Correction, for the file: *catch*. The instrument is a rendezvous — matching a body already '
        + 'on a ballistic arc, at the one moment the two of you occupy the same point. You were '
        + 'taught this at seven, with a glove, by an adult who believed he was passing an '
        + 'afternoon.',
    ],
  },
  {
    id: 'act-7-mapping-wall',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'fuelCapacityExists',
    title: 'Terminology',
    prose: [
      'Correction, for the file: *the wall*. The instrument is the heliopause. Your affiliate\'s '
        + 'coverage describes it as four hundred feet in centre. That is a scale model and it is '
        + 'the only one your species has ever been given. Nobody has hit one over it.',
    ],
  },
  {
    id: 'act-7-first-colony',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'anySiteColonized',
    title: 'Register entry',
    prose: [
      'Entered in the register. Your organisation now operates two affiliates. This is one more '
        + 'than it operated this morning and one fewer than the Office requires before it will '
        + 'assign you a class.',
    ],
  },
  {
    id: 'act-7-lunar',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'phaseAtLeastLunar',
    title: 'Reclassification',
    prose: [
      'Reclassification: Class A. Reclassification carries no ceremony, no stipend and no change '
        + 'to your assignment. It changes the letterhead. You will find that it changes how the '
        + 'letterhead is read.',
    ],
  },
  {
    id: 'act-7-first-puzzle',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'anyPuzzleSolvedUnaided',
    title: 'Additional observations',
    prose: [
      'Additional observations, Ellis, Territory 9: subject solved it cold. I want it in the '
        + 'record that nobody sold him the answer, because the Office will assume somebody did.',
    ],
  },
  {
    id: 'act-7-hint-bought',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'anyHintBought',
    title: 'Expense',
    prose: [
      'Explanation purchased, salvage debited. For the avoidance of doubt: buying the answer is a '
        + 'normal instrument, it is used constantly at every level of this organisation, and it is '
        + 'not recorded anywhere a promotion board can see it.',
    ],
  },
  {
    id: 'act-7-contract-first',
    kind: 'office',
    actIndex: 6,
    mode: 'feed',
    category: 'office',
    trigger: 'anyContractClaimed',
    title: 'Credited',
    prose: [
      'Assignment credited against your transit requisition. You are now, formally, filing. Most '
        + 'players never file. Most players are also still on their affiliate.',
    ],
  },

  // --- Act VII: the dispatches — the frozen league, carrying on ---
  //
  // THE EMOTIONAL PAYLOAD OF THE ACT. The league did not stop existing because the player left:
  // `season`, `league`, `roster` and `stadium` are all still in state, frozen exactly as the
  // championship left them (data/acts.js `seasonFrozen`). These report on it from very far away,
  // at long intervals, with the light lag getting worse — which is the only reason the delay is
  // printed in every one of them.
  //
  // MECHANICALLY THESE ARE ORDINARY FEED BEATS, NOT A SECOND SYSTEM. Their trigger is a clock
  // offset from progression.actEnteredAtClock, they fire through the same pendingStoryBeats()
  // against the same storyBeatsSeen ledger as everything above, and this section introduces no
  // second ledger to keep in sync.
  //
  // EMIT ALL DUE DISPATCHES DURING A CATCH-UP, IN ORDER. The usual instinct — collapse a burst to
  // the newest, the way ToastHost collapses a run of games — would destroy the arc, and the arc is
  // the only reason these lines exist. There is no storm risk: seven dispatches in an entire run,
  // each firing at most once ever, against a FEED_CAP of 50.
  {
    id: 'act-7-dispatch-1',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes35',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 14 minutes: your club has filled your position. The signing was described '
        + 'in local coverage as *sensible*.',
    ],
  },
  {
    id: 'act-7-dispatch-2',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes80',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 41 minutes: they finished third. The write-up mentions you in the eleventh '
        + 'paragraph, as a comparison.',
    ],
  },
  {
    id: 'act-7-dispatch-3',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes130',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 2 hours: they have renamed the grounds. Not after you. After a man who paid '
        + 'for the lights.',
    ],
  },
  {
    id: 'act-7-dispatch-4',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes180',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 6 hours: they won it. There is footage. Somebody in the crowd is wearing '
        + 'your number, and is too young to have seen you wear it.',
    ],
  },
  {
    id: 'act-7-dispatch-5',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes230',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 2 days: a record of yours went this season. It stood eleven years. The '
        + 'Office observes that eleven years is longer than most things.',
    ],
  },
  {
    id: 'act-7-dispatch-6',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'actMinutes280',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 3 weeks: the league has expanded to sixteen clubs. The vacant lot behind '
        + 'the hardware store on Vine is a parking structure. The wall is still there. Somebody '
        + 'has redrawn the strike zone.',
    ],
  },
  {
    id: 'act-7-dispatch-7',
    kind: 'dispatch',
    actIndex: 6,
    mode: 'feed',
    category: 'dispatch',
    trigger: 'phaseAtLeastMajors',
    title: 'Relay 9',
    prose: [
      'Relay 9, delayed 4 years, 61 days. They are still playing. Every evening, in the summer, in '
        + 'several thousand places at once, on a field laid out to the dimensions of a four-burn '
        + 'transfer, by people who have not been told and do not need to be. The Office has never '
        + 'seen a curriculum take like this one. Nothing is required of you.',
    ],
  },
];

function getStoryBeat(beatId) {
  return STORY_BEATS.find((beat) => beat.id === beatId) || null;
}

function getActIntroBeat(actIndex) {
  return STORY_BEATS.find((beat) => beat.kind === 'actIntro' && beat.actIndex === actIndex) || null;
}

module.exports = { STORY_BEATS, getStoryBeat, getActIntroBeat };
