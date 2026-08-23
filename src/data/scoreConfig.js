// The score's tuning. engine/score.js holds the arithmetic and none of these numbers; this file
// holds the numbers and no arithmetic — the same split every other config in this directory keeps.
//
// RETUNING THIS FILE RE-SCORES EVERY RUN EVER PLAYED, and that is the property the whole design is
// built to keep (PRD §3.3: the score is DERIVED, never accumulated). A record card stores facts —
// seconds per act, achievement ids — and the number is computed on read. Nothing anywhere stores a
// total, so nothing anywhere can disagree with this file.

// PAR, in seconds: how long an act is MEANT to take. Hitting par scores exactly WEIGHT[act];
// beating it scores more, up to SPEED_CAP; missing it scores less, never below 0.
//
// Acts I-V are the authored bands in docs/PRD-incremental-odyssey.md §5, taken at their midpoints:
// 3-5 min, 8-12, 15-20, 25-35, 30-45. Those are DESIGN TARGETS AND NOT MEASUREMENTS — that PRD's
// own open question 1 says so ("Act durations are estimates… needs playtesting") — so they are the
// least trustworthy numbers in this file and the first thing to revisit once a real playthrough is
// timed (PRD §9.3).
//
// Act VI has no authored band at all; 45 minutes is an interpolation from "reaching Act VI takes
// ~1.5-2 hours" plus the seasons a championship takes to win. It is a guess and is marked as one.
//
// Act VII is the ONLY MEASURED ENTRY: STORY-032 timed the act end to end at 291.8 min = 4.86h
// against §12's five-hour ceiling, recorded in the story index. Rounded to 17,500s.
const PAR = {
  0: 240,
  1: 600,
  2: 1050,
  3: 1800,
  4: 2250,
  5: 2700,
  6: 17500,
};

// What an act is WORTH at par. Later acts weigh more, because a minute in Act VII is a minute spent
// on a system the player had to earn their way to. The seven sum to 1,000 at par, deliberately: the
// board is read against a round number, and a player who hits every par lands on it exactly.
//
// Against these, the thirteen achievements total 380 (data/achievementsConfig.js). That ratio is the
// tension PRD §6 describes — roughly a quarter of a perfect score comes from what you DID rather
// than how fast — and it is the number to move if the board starts rewarding only one of the two.
const WEIGHT = {
  0: 50,
  1: 75,
  2: 100,
  3: 125,
  4: 150,
  5: 200,
  6: 300,
};

// The ceiling on the speed ratio: three times par is the most any act can be worth, however fast it
// was cleared. Bounded rather than open because a corrupt clock, a degenerate strategy or a
// hand-edited save would otherwise mint a score nobody can beat honestly — and because
// STORY-046 reuses this same bound as the plausibility test before a run is submitted to the shared
// board. One constant, two uses, and no second copy of it anywhere.
const SPEED_CAP = 3.0;

// The divide guard, and the same bound stated from the other end: no act counts as having taken
// less than thirty seconds. It keeps `PAR / seconds` finite for a zero-length act without a special
// case, and it is what a submitted run is checked against alongside SPEED_CAP.
const FLOOR = 30;

module.exports = { PAR, WEIGHT, SPEED_CAP, FLOOR };
