// Walk-up songs. Every number here lives in this file; engine/walkupSongs.js holds the rules and
// none of the tuning, the same split data/capsShopConfig.js has with engine/capsShop.js.
//
// WHY THIS EXISTS. From travel ball on, somebody's dad is running a PA system off a car battery
// and every kid gets eight seconds of a song on their way to the box. It is the first thing in
// the odyssey that is purely *yours* — the team name aside, nothing else the player buys is about
// a specific kid being a specific kid. So it is a per-player purchase with a per-player effect,
// and the effect is small enough that the reason to buy one is that it is funny.
//
// WHY ACT IV. Act III is nine-year-olds in a little league; there is no PA system and the act
// already has a shop of its own (data/concessionsConfig.js). Act IV is the first act with a
// tournament, a gate, and a man with a microphone. The unlock id below is registered in
// data/acts.js under Act IV, and `unlocks` are cumulative, so it stays on through Acts V and VI.
const WALKUP_UNLOCK_ID = 'walkup';

const WALKUP_CURRENCY = 'cash';

// The `stat` a B-side record declares, and the one value in that field that is NOT a key of
// player.stats. It is a sentinel, not a stat: engine/strength.js reads it as "apply this bonus to
// every stat" and engine/walkupSongs.js reads it as "every position can use this". It is exported
// so neither of them spells the string themselves — a typo'd 'all' in either file is a record that
// is silently inert in the simulation while the card claims a bonus, which is precisely the class
// of bug the note above about `fielding` is warning about.
const WALKUP_ALL_STATS = 'all';

// ---------------------------------------------------------------------------
// What a song does
// ---------------------------------------------------------------------------
// `stat` is a key of `player.stats` — power, contact, speed, defense or pitching (see
// engine/playerFactory.js: randomStatsForPosition). Note DEFENSE, not "fielding": the stat block
// has never had a `fielding` key and a song naming one would be silently inert.
//
// `bonus` is a fraction applied to that stat AT READ TIME, in engine/strength.js, and is never
// written back into player.stats. That is deliberate and it is the whole reason the mechanic is
// clean: changing a player's song, or handing it to somebody else, takes the bonus with it in the
// same instant, with nothing to unwind. It also means the bonus cannot be laundered through the
// stat cap — buying a song at 100 power does not raise the stored 100, so it cannot be banked and
// then re-boosted, and the "FULLY UPGRADED" badge on the roster card still means what it says.
//
// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
// Priced against the sink a song directly substitutes for: the stat upgrade sitting on the same
// card. engine/economy.js charges `150 * 1.22 ** ((value - 5) / 5)` for +2 to one stat, so at a
// mid-Act-IV stat of 50 an upgrade is ~890 cash for +2, i.e. ~445 per stat point.
//
// A stat point is worth `weight` of a point of overall rating, where the weights are the rating
// coefficients in engine/strength.js (power/contact 0.30 and speed/defense 0.20 for a position
// player, pitching 0.50 for a pitcher). So a song's price is:
//
//     cost = bonusPercent * 800 * weight        (rounded to a readable 50)
//
// which is 240 cash per percent on power or contact, 160 on speed or defense, and 400 on
// pitching. Check that against the ladder it replaces: "Sugar, We're Goin Down" is +10% power,
// which at power 50 is +5 power, and buying +5 power through the upgrade chip at that level costs
// 150 * (1.22**9 + 1.22**9.4 + 1.22**9.8) = 2,924. The song is 2,400. The same +7 power bought at
// power 70 costs 9,002 through the chip, and the song still costs 2,400. So at the stat levels a
// travel-ball roster actually sits at, a song is a slight discount on the upgrades — and it gets
// steadily better as the stats climb, because a percentage grows with the number under it while
// the upgrade curve grows against you. At the 100 cap the upgrade chip says MAX and the song is
// the only thing left that moves the number at all. That shape is intended: this is a late,
// permanent, per-player luxury that a player grows into.
//
// AND IT MUST NOT WIN THE ACT. Act IV exits on a 60% win rate over two seasons, so the honest
// question is what a fully-scored lineup is worth. teamStrength() averages ten starters, so one
// song moves team strength by a tenth of what it moves its own player: +10% power on one kid at
// power 50 is +1.5 to his rating and +0.15 to the team's. Measured on a representative Act IV
// lineup (position players at 50 across the board, a pitcher at 70 pitching, team strength
// 50.22), a record on every one of the ten starters is:
//   cheapest ten records  — 12,300 cash — +1.69% team strength
//   dearest ten records   — 21,600 cash — +2.93% team strength
//   the entire crate      — 31,150 cash — (only ten can be assigned at once)
//
// Compare the act's actual strength sink, which a reader will find and should not be surprised
// by: The Tournament Trophy (data/actFourConfig.js) is 3,000 cash for 25 reputation, which at
// balanceConfig.reputationStrengthPerPoint is +10% team strength — four times the whole jukebox
// for a sixth of the money. That is not an error in this file. Reputation is a capped one-time
// ladder of three deals and it is the act's designed answer to "my team is not good enough";
// songs are an uncapped per-player trinket, and if they were priced to compete with reputation
// they would be the answer instead, which would both trivialise the exit and turn a joke into
// homework. A player who buys every song still has to buy the trophy.
//
// SONG TITLES AND ARTIST NAMES ARE FACTUAL REFERENCES and are used as such. No lyric — and no
// paraphrase of a lyric — appears anywhere in this file. The descriptions are about the walk to
// the box, which is the joke anyway.
const WALKUP_SONGS = [
  {
    id: 'babyShark',
    title: 'Baby Shark',
    artist: 'Pinkfong',
    stat: 'contact',
    bonus: 0.03,
    cost: 700,
    description:
      'Every kid under six in the bleachers stands up. Every kid over six sits down. The at-bat lasts four pitches and the song does not stop.',
  },
  {
    id: 'dangerZone',
    title: 'Danger Zone',
    artist: 'Kenny Loggins',
    stat: 'speed',
    bonus: 0.05,
    cost: 800,
    description:
      'He comes out of the dugout at a jog he cannot sustain and has to stand around at the plate looking dangerous until the horns finish.',
  },
  {
    id: 'whoLetTheDogsOut',
    title: 'Who Let the Dogs Out',
    artist: 'Baha Men',
    stat: 'defense',
    bonus: 0.05,
    cost: 800,
    description:
      'The infield barks. The umpire has asked twice for the infield to stop barking. The infield has not stopped barking.',
  },
  {
    id: 'cottonEyeJoe',
    title: 'Cotton Eye Joe',
    artist: 'Rednex',
    stat: 'speed',
    bonus: 0.06,
    cost: 950,
    description:
      'Nobody can hear the third-base coach over a fiddle, which turns out to be an advantage roughly half the time.',
  },
  {
    id: 'kungFuFighting',
    title: 'Kung Fu Fighting',
    artist: 'Carl Douglas',
    stat: 'defense',
    bonus: 0.06,
    cost: 950,
    description:
      'He does the thing with his hands on the way to the box. He has done the thing with his hands every single at-bat since April.',
  },
  {
    id: 'barbieGirl',
    title: 'Barbie Girl',
    artist: 'Aqua',
    stat: 'power',
    bonus: 0.04,
    cost: 950,
    description:
      'Chosen to make the opposing pitcher laugh, which it does, right up until the ball is over the fence and nobody is laughing.',
  },
  {
    id: 'mamboNo5',
    title: 'Mambo No. 5',
    artist: 'Lou Bega',
    stat: 'contact',
    bonus: 0.05,
    cost: 1200,
    description:
      'Horns, a countdown of names, and a batter who steps out after every pitch so it gets to play a little longer.',
  },
  {
    id: 'ymca',
    title: 'Y.M.C.A.',
    artist: 'Village People',
    stat: 'defense',
    bonus: 0.08,
    cost: 1300,
    description:
      'The entire visiting bench does the letters. They did not mean to. It is very hard not to. The manager is furious.',
  },
  {
    id: 'eyeOfTheTiger',
    title: 'Eye of the Tiger',
    artist: 'Survivor',
    stat: 'contact',
    bonus: 0.06,
    cost: 1450,
    description:
      'The single most predictable choice on the roster, selected without irony by a twelve-year-old who has never once doubted it.',
  },
  {
    id: 'myHeartWillGoOn',
    title: 'My Heart Will Go On',
    artist: 'Celine Dion',
    stat: 'defense',
    bonus: 0.09,
    cost: 1450,
    description:
      'A tin whistle drifts across a field in a town three hours from home while your shortstop takes his stance. Nobody has recovered.',
  },
  {
    id: 'sandstorm',
    title: 'Sandstorm',
    artist: 'Darude',
    stat: 'speed',
    bonus: 0.1,
    cost: 1600,
    description:
      'The PA kid found the build-up and loops it. The at-bat has now been about to happen for ninety seconds.',
  },
  {
    id: 'thunderstruck',
    title: 'Thunderstruck',
    artist: 'AC/DC',
    stat: 'power',
    bonus: 0.08,
    cost: 1900,
    description:
      'Somebody put this on for a leadoff hitter who weighs ninety pounds and it has been working ever since, which nobody can explain.',
  },
  {
    id: 'carelessWhisper',
    title: 'Careless Whisper',
    artist: 'George Michael',
    stat: 'contact',
    bonus: 0.08,
    cost: 1900,
    description:
      'Eight seconds of saxophone and a batter who refuses to make eye contact with anyone. Puts the whole park off, including the umpire.',
  },
  {
    id: 'freeBird',
    title: 'Free Bird',
    artist: 'Lynyrd Skynyrd',
    stat: 'speed',
    bonus: 0.12,
    cost: 1900,
    description:
      'Somebody in the stands yells for it, and the PA kid, who has waited his whole life for this, plays all of it.',
  },
  {
    id: 'sugarWereGoinDown',
    title: "Sugar, We're Goin Down",
    artist: 'Fall Out Boy',
    stat: 'power',
    bonus: 0.1,
    cost: 2400,
    description:
      'Everyone born within eight years of this record knows exactly where the drums come in, and so does your cleanup hitter.',
  },
  {
    id: 'theFinalCountdown',
    title: 'The Final Countdown',
    artist: 'Europe',
    stat: 'power',
    bonus: 0.12,
    cost: 2900,
    description:
      'Saved for late innings, which is fine, except he also uses it in the first inning of a Tuesday game against nobody.',
  },
  // ---------------------------------------------------------------------------
  // THE B-SIDES — one record, every stat
  // ---------------------------------------------------------------------------
  // `stat: WALKUP_ALL_STATS` is not a sixth stat. It is a record whose bonus is applied to EVERY
  // key of the player's stat block at once (engine/strength.js: walkupStatMultiplier), which is
  // why engine/walkupSongs.js special-cases it in songCountsFor() rather than looking it up in
  // STAT_WEIGHTS, where it deliberately does not appear.
  //
  // WHY IT IS PRICED HIGHER THAN ANYTHING ABOVE IT, AND WHY THAT IS THE SAME LINE. The pricing
  // rule at the head of this file is `cost = bonusPercent * 800 * weight`, where `weight` is the
  // stat's share of the rating in engine/strength.js. The weights of a position player sum to
  // 1.00 (0.30 + 0.30 + 0.20 + 0.20) and so do a pitcher's (0.50 + 0.20 + 0.15 + 0.10 + 0.05), so
  // a record that moves all of them at once has a weight of exactly 1.00 and prices at 800 cash
  // per percent — 2x the dearest thing in the crate (pitching, 400) and 5x the cheapest (speed
  // and defense, 160). Nothing about the ladder is bent to fit these four in.
  //
  // It also means the top rung lands where the old top rung already was. "Chariots of Fire" is
  // +6.00% of a player's whole rating, exactly, whoever he is — a uniform percentage on every
  // term of a weighted average that sums to 1.0 is that percentage on the average. "Enter
  // Sandman" is +12% of a stat carrying half a pitcher's rating, which is +6.00% on a flat stat
  // block and drifts with how lopsided the pitcher is: measured on the representative Act IV arm
  // below (pitching 70, everything else 50) it is +7.00%. Both cost 4,800. So the dearest record
  // in the game is still the dearest record in the game, and this is the version of it that a
  // shortstop is allowed to buy — slightly weaker than the pitching record on the one player who
  // can use that, identical on paper, and available to the other nine.
  //
  // WHAT A FULL SET IS WORTH, measured the same way the block above measures the rest of the
  // crate (ten starters, position players at 50 across the board, a pitcher at 70 pitching, team
  // strength 50.22): teamStrength() averages ten starters, so +6% on each of ten is +6.00% team
  // strength for 48,000 cash. Compare the act's own strength sink — The Tournament Trophy is
  // +10% for 3,000 — and the shape the file already defends holds: the whole jukebox, bought
  // twice over, is still worth less than the three reputation deals and costs sixteen times as
  // much. A player who buys every B-side still has to buy the trophy.
  //
  // THE JOKE IS THE POINT, and it is a different joke from the records above. Those are songs a
  // kid PICKED to sound like somebody. These are the four records that were already in the crate
  // when somebody's dad found it, and a twelve-year-old walking to the box to any one of them is
  // funnier than the same kid walking out to AC/DC. Nobody chose these. They were simply there.
  {
    id: 'aThousandMiles',
    title: 'A Thousand Miles',
    artist: 'Vanessa Carlton',
    stat: WALKUP_ALL_STATS,
    bonus: 0.03,
    cost: 2400,
    description:
      'The piano starts and the entire infield, both teams, plays it on their knees. Play stops. Nobody involved can explain later why this happened.',
  },
  {
    id: 'fiveHundredMiles',
    title: "I'm Gonna Be (500 Miles)",
    artist: 'The Proclaimers',
    stat: WALKUP_ALL_STATS,
    bonus: 0.04,
    cost: 3200,
    description:
      'Eleven parents sing the counting part. They are not in agreement about which part it is. He has not left the on-deck circle.',
  },
  {
    id: 'totalEclipseOfTheHeart',
    title: 'Total Eclipse of the Heart',
    artist: 'Bonnie Tyler',
    stat: WALKUP_ALL_STATS,
    bonus: 0.05,
    cost: 4000,
    description:
      'Eight seconds is not enough of this song and everyone knows it. The man on the PA lets it run. The umpire waits. The at-bat is now an event.',
  },
  {
    id: 'chariotsOfFire',
    title: 'Chariots of Fire',
    artist: 'Vangelis',
    stat: WALKUP_ALL_STATS,
    bonus: 0.06,
    cost: 4800,
    description:
      'He walks to the box in slow motion. He has decided to do this. It takes eleven seconds and he commits to every one of them, and honestly the other dugout respects it.',
  },
  // The two pitching songs. Pitching is worth 0.50 of a pitcher's rating and exactly 0.00 of
  // anybody else's (engine/strength.js: STAT_WEIGHTS), so these are the strongest per-percent
  // songs in the crate and also the only ones that can be a no-op — which is why the picker
  // refuses to offer them to a position player rather than selling a kid a song that does
  // nothing. Priced at the 0.50 weight accordingly, and there is only ever one pitcher in a
  // starting lineup, so the crate can hold both and the team can still only use one at a time.
  {
    id: 'wildThing',
    title: 'Wild Thing',
    artist: 'The Troggs',
    stat: 'pitching',
    bonus: 0.08,
    cost: 3200,
    description:
      'Every adult in the park gets the reference. The pitcher does not. He has decided it is about him personally, and honestly, it is working.',
  },
  {
    id: 'enterSandman',
    title: 'Enter Sandman',
    artist: 'Metallica',
    stat: 'pitching',
    bonus: 0.12,
    cost: 4800,
    description:
      'The gate opens on the intro and a twelve-year-old walks in from the bullpen like he is being paid by the hour. Nobody in the other dugout says a word.',
  },
];

// Player-facing prose lives here, never in a component (house rule). The picker is a <select>,
// so its "nothing" option needs a label rather than a blank row — a blank row in a dropdown reads
// as a rendering bug, and this reads as a choice.
const WALKUP_COPY = {
  noSong: 'No walk-up song',
  pickerLabel: 'Walk-up',
  crateHeading: 'The Record Crate',
  // REWRITTEN WHEN THE STEAL WENT AWAY. It used to promise that handing a record over took it off
  // the kid who had it, which is no longer what happens: a record that is spoken for is not offered
  // to anybody else at all (engine/walkupSongs.js listPickerOptions), and the way to move one is to
  // take it back here first. The blurb is the only place that rule is stated before the player runs
  // into it, so it says where the button is rather than merely that the record is taken.
  crateBlurb:
    "Somebody's dad runs the PA off a car battery, and everybody gets eight seconds on the way to the box. Buy a record once and it stays in the crate — then give it to whichever kid has earned it. One record, one kid: a song somebody is already using is off the board until you take it back, which you do right here.",
  // Covers both "the crate is empty" and "the crate has records but none this kid can use" — a
  // shortstop is never offered a pitching record — so it must not claim the crate is empty.
  emptyCrate: 'Nothing in the crate for this one yet.',
  pitchersOnly: 'pitchers only',
  heldBy: (name) => `with ${name}`,
  // The crate is collapsed by default, so the closed label has to carry the whole invitation AND
  // the reason to accept it — a count of what is still for sale. A function for the same reason
  // heldBy is one: the number belongs in the sentence, not concatenated onto it in a component.
  crateOpen: (forSale) => `Flip through the crate — ${forSale} still for sale`,
  crateClose: 'Close the crate',
  // What an owned record says when nobody is walking up to it. Deliberately not "unassigned",
  // which is inventory language for a thing that is a stack of CDs in a dugout.
  unassigned: 'in the crate',
  // The control that takes a record back off a kid, on the crate row that names him. It exists
  // because the picker no longer steals: without it, a record assigned to a bench kid would be
  // permanently unreachable from every other card in the game, which is a dead end and not a rule.
  // Phrased as an instruction to the man with the crate rather than as a state change ("unassign"),
  // for the same reason `unassigned` above is not called that.
  takeBack: 'take it back',
  takeBackTitle: (name) => `Take this record back off ${name} — it returns to the crate for anybody`,
  // Appended to a picker option that is real but does nothing for this player — see
  // listPickerOptions() in engine/walkupSongs.js for the training-camp case that produces one.
  inertSuffix: ' — does nothing here',

  // THE HEADING OVER EACH BLOCK OF THE PICKER, so a crate with a dozen records reads as "here are
  // the power ones" rather than as a wall of titles. The stat a record boosts is the only thing a
  // player is choosing on, and it was previously visible only inside each row's effect string.
  //
  // Rendered as an <optgroup> label rather than as a row, which is what makes it a heading rather
  // than a trap: an <optgroup> label CANNOT be selected or focused by keyboard, where a disabled
  // <option> can still be landed on in some browsers. listPickerOptions()'s long note on the
  // training-camp case is about exactly this class of bug — a <select> displaying something other
  // than its own value — and a selectable heading would be a new way to cause it.
  //
  // CAPITALISED, WHILE THE STAT BARS ON THE SAME CARD STAY LOWERCASE, and that is a boundary
  // rather than an oversight. components/common/StatBar.js renders `label={stat}` raw, so every
  // bar in the game says "power"; giving stats a display-name vocabulary means touching every bar
  // on every screen, which is its own change. A heading inside a dropdown is a sentence-level
  // label and reads wrong in lower case, so it is capitalised here and the bars are left alone.
  //
  // WALKUP_ALL_STATS IS NOT A STAT AND MUST NOT BE TITLE-CASED INTO ONE. "All" over a block of
  // records reads as a filter that is currently off — as in "all songs" — which is the opposite of
  // what that block is. It gets a phrase instead, and the phrase says what the records in it do.
  statGroup: (stat) =>
    stat === WALKUP_ALL_STATS ? 'Every stat' : stat.charAt(0).toUpperCase() + stat.slice(1),

  // THE STAT, AS A LABEL THE EYE CAN LAND ON. The complaint this exists for is "I can't tell which
  // stat I'm boosting": the stat was previously legible only inside an effect string at the end of
  // a row of prose, and inside an <optgroup> heading — and iOS's native <select> wheel frequently
  // renders optgroup labels not at all, so on the target device the grouping was invisible. It is
  // therefore ALSO printed first inside every option's own label (see listPickerOptions), and drawn
  // as a chip on the crate rows and on the roster card.
  //
  // SHORT AND UPPER-CASE, because it is a tag and not a sentence — the same reason the MAX chip on
  // the same screen is three letters. The stat bars underneath stay lower-case; see the note on
  // statGroup above for why that boundary is deliberate.
  statTag: (stat) => (stat === WALKUP_ALL_STATS ? 'EVERY STAT' : stat.toUpperCase()),

  // What a B-side does, in the effect slot where every other record says "+8% power". Spelled out
  // rather than rendered as "+6% all", which reads as a truncation or a typo.
  allStatsEffect: (percent) => `+${percent}% to every stat`,
};

// Tolerates null/undefined/garbage rather than throwing: this is called with
// `player.walkupSongId` on every rating computation, and the overwhelming majority of players in
// the game — every AI-facing lookup, every bench kid, every roster on a save written before this
// shipped — have no such field at all.
function getWalkupSong(songId) {
  if (!songId) return null;
  return WALKUP_SONGS.find((song) => song.id === songId) || null;
}

module.exports = {
  WALKUP_UNLOCK_ID,
  WALKUP_CURRENCY,
  WALKUP_ALL_STATS,
  WALKUP_SONGS,
  WALKUP_COPY,
  getWalkupSong,
};
