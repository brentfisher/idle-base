// The Records tab's prose. Every player-facing string on that screen lives here and none of them
// live in the component — the same rule feedMessages.js, toastMessages.js and storyBeats.js keep.
const { formatDuration } = require('../utils/formatNumber');

const recordsCopy = {
  title: 'The Record',
  blurb: 'How this run has gone, and how the ones before it went.',

  currentRunHeading: 'This run',
  scoreLabel: 'Score',
  // Shown under the total. Deliberately says where the number comes from rather than what it is
  // worth: the score is derived on every read (PRD §3.3), so it moves when the run moves, and a
  // player who does not know that reads a changing number as a bug.
  scoreNote: 'Recalculated from your splits every second. Beat par to score above weight.',

  splitsHeading: 'Act splits',
  parLabel: (seconds) => 'par ' + formatDuration(seconds),
  // THE ONE STRING THIS SCREEN CANNOT GET WRONG. An act with no entry on the card was played
  // before the card existed, or never played at all — and printing `0s` there would put the best
  // possible time in the game against an act nobody timed (PRD §4).
  notRecorded: 'not recorded',
  notPlayed: '—',
  inProgress: 'in progress',
  pointsLabel: (points) => points + ' pts',

  achievementsHeading: 'Achievements',
  // The career set, and the subtitle exists because the distinction is invisible otherwise: this
  // block never resets, while the SCORE beside it counts only what this run earned (PRD §6).
  achievementsNote: 'Kept for good, across every run. Your score counts only the ones earned in the run it belongs to.',
  achievementLocked: 'Not yet',
  achievementPoints: (points) => (points === 0 ? 'no points' : points + ' pts'),

  runsHeading: 'Finished runs',
  runsNote: 'Best score first.',
  runsEmpty: 'Nothing finished yet. A run ends when you go over the wall — or when you start over.',
  partialBadge: 'partial',
  // Said once, plainly, rather than as an asterisk on every row. A card with gaps in it cannot be
  // compared to a complete one, and the screen should say why rather than look inconsistent.
  partialNote: 'Some acts were played before the game started keeping time. Those runs are listed, not ranked.',
  incompleteBadge: 'unfinished',
  runTotalLabel: (seconds) => formatDuration(seconds) + ' total',

  emptyState: 'Nothing on the board yet. Finish an act and the first split lands here.',

  // STARTING OVER. Worded as what it does rather than as a warning, and the second step spells out
  // the one thing a player would be most surprised to lose and the one thing they keep.
  startOverHeading: 'Start over',
  startOverBody: 'Wipe this save and begin again from the vacant lot. Everything on this screen '
    + 'above — your finished runs and your achievements — is kept.',
  startOverAction: 'Start over',
  startOverConfirm: 'Yes, wipe it',
  startOverCancel: 'Keep playing',
  // The confirm step. Says what goes and what stays, in that order, because the thing that goes is
  // the thing the player is deciding about.
  startOverWarning: 'This deletes the run in progress. It is recorded above first, then it is gone.',
};

module.exports = { recordsCopy };
