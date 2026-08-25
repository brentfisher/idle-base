// A LIVE END-TO-END CHECK of the leaderboard, driving the SHIPPED client rather than a stub.
//
//   LEADERBOARD_ACCESS_KEY=... node scripts/live-leaderboard-check.js
//
// IT WRITES TO BOTH REAL BOARDS. One player (via identify) and one entry per board, named
// `test-delete-me` so it is obvious in the vendor dashboard and easy to remove. With the boards in
// `unique` mode a re-run overwrites those same rows rather than adding more, so this is safe to
// repeat — but it is not something to run against boards people are actually competing on without
// saying so.
//
// THE TWO BOARDS SORT IN OPPOSITE DIRECTIONS, and that is a DASHBOARD SETTING rather than anything
// this script or the client can assert:
//
//   idle-base-runs       DESCENDING — a higher derived score wins.
//   idle-base-act-seven  ASCENDING  — a LOWER time wins, because it is a fastest-Act-VII board.
//
// BOTH BOARDS MUST ALREADY EXIST IN THE DASHBOARD or the act-seven half of this script 404s on
// every call. Creating `idle-base-act-seven` is a dashboard action with two settings the client can
// neither make nor detect: sort ASCENDING (above), and `unique` mode — which is what makes re-running
// this script overwrite its own row instead of adding one more every time.
//
// So the Act VII section below verifies that the seconds arrived and that the facts survived; it
// CANNOT verify the ordering, because the vendor returns whatever the dashboard is configured to
// return and there is no request parameter to override it. If the act-seven board ever comes back
// with the slowest run on top, the fix is in the dashboard and not in this repo.
//
// WHY IT IS NOT A UNIT TEST. This repo has no test framework and deliberately does not add one
// (openspec/config.yaml). More to the point, the thing worth checking here cannot be checked
// offline: persistence/leaderboardClient.js once sent the access key as `x-talo-access-key`
// instead of `Authorization: Bearer`, and forty stubbed assertions all passed while every real
// request would have failed authentication. A stub agrees with whatever the client believes. This
// script is the one that can disagree.
//
// The key is never printed, and every assertion below is about behaviour rather than about the
// key's value.
global.LEADERBOARD_ACCESS_KEY = process.env.LEADERBOARD_ACCESS_KEY || '';

// Resolved from this file's own location rather than hard-coded, so the script drives the checkout
// it was RUN FROM. With a hard-coded absolute path it silently tests the main working copy while you
// sit in a git worktree — passing on code you did not write.
const path = require('path');
const R = path.join(__dirname, '..', 'src') + path.sep;
const client = require(R + 'persistence/leaderboardClient');
const { runScore } = require(R + 'engine/score');
const { PAR } = require(R + 'data/scoreConfig');
const { BOARDS } = require(R + 'data/leaderboardConfig');

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures += 1; console.log('FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
  else console.log('ok    ' + label + (detail ? '  -> ' + detail : ''));
}

// A plausible finished run: every act cleared exactly at par, so the clamp sees a ratio of 1.0 and
// the score lands on the round 1,000 the weights are designed to sum to.
const TEST_UUID = 'live-test-player';
const card = {
  runId: 'live-test-run',
  actSeconds: { 0: PAR[0], 1: PAR[1], 2: PAR[2], 3: PAR[3], 4: PAR[4], 5: PAR[5], 6: PAR[6] },
  achievements: ['first-collector', 'wall-runner', 'fifth-burn', 'odyssey'],
  complete: true,
  totalSeconds: Object.values(PAR).reduce((a, b) => a + b, 0),
  counters: { integrityViolations: 0 },
  reachedAct: 6,
};

(async () => {
  check('the client is configured', client.isConfigured());

  const score = runScore(card);
  check('the test card scores a clean 1,000 + achievements',
    score.total === 1000 + 5 + 15 + 60 + 80, String(score.total));
  check('and the clamp accepts it', client.implausibleReason(card) === null,
    String(client.implausibleReason(card)));

  console.log('\n--- CALL 1: identify ---');
  const identified = await client.identifyPlayer(TEST_UUID);
  check('identify succeeded', identified.ok === true, identified.reason || '');
  check('and returned an alias id', !!identified.aliasId, identified.aliasId || '');

  console.log('\n--- CALL 2: submit ---');
  const posted = await client.submitRun(card, identified.aliasId, 'test-delete-me', score.total);
  check('the run posted', posted.ok === true, posted.reason || '');

  console.log('\n--- CALL 3: read it back ---');
  const board = await client.fetchEntries();
  check('the board reads back', board.ok === true, board.reason || '');
  const mine = (board.entries || []).find((e) => {
    const props = e.props || [];
    return Array.isArray(props) && props.some((p) => p && p.key === 'runId' && p.value === card.runId);
  });
  check('our entry is ON the board', !!mine);
  if (mine) {
    check('with the score we sent', mine.score === score.total, String(mine.score));
    const props = {};
    (mine.props || []).forEach((p) => { props[p.key] = p.value; });
    check('and the name we sent', props.name === 'test-delete-me', props.name);
    check('the per-act FACTS survived the round trip',
      props.actSeconds && Object.keys(JSON.parse(props.actSeconds)).length === 7,
      props.actSeconds ? Object.keys(JSON.parse(props.actSeconds)).length + ' acts' : 'missing');
    check('so the run can be RE-SCORED from the board alone (PRD §3.3)',
      runScore({ actSeconds: JSON.parse(props.actSeconds),
        achievements: (props.achievements || '').split(','),
        complete: props.complete === '1', reachedAct: 6 }).total === score.total);
    console.log('\n    entry as it sits on the wall:',
      JSON.stringify({ score: mine.score, name: props.name, complete: props.complete }));
  }

  console.log('\n--- idempotence: post the same run again ---');
  const again = await client.submitRun(card, identified.aliasId, 'test-delete-me', score.total);
  check('a resubmission succeeds', again.ok === true, again.reason || '');
  const board2 = await client.fetchEntries();
  const count = (board2.entries || []).filter((e) => (e.props || [])
    .some((p) => p && p.key === 'runId' && p.value === card.runId)).length;
  check('and `unique` mode leaves ONE row, not two', count === 1, count + ' rows');

  console.log('\n--- the clamp refuses an impossible run, live ---');
  const cheat = { ...card, runId: 'live-test-cheat', actSeconds: { 0: 1 } };
  const refused = await client.submitRun(cheat, identified.aliasId, 'should-not-appear', 999999);
  check('an impossible card is refused before any request',
    refused.ok === false && refused.reason.indexOf('refused-') === 0, refused.reason);
  const board3 = await client.fetchEntries();
  check('and never reaches the board',
    !(board3.entries || []).some((e) => (e.props || [])
      .some((p) => p && p.key === 'runId' && p.value === 'live-test-cheat')));

  // --- THE SECOND BOARD: fastest Act VII ------------------------------------------------------
  // Same player, same alias, same card. What changes is the board and the number in `score`: Act
  // VII's seconds instead of the run's derived total. Read it, post to it, read it back — the same
  // three steps the all-time board just went through, because a second board is only worth having
  // if it is the same round trip.
  console.log('\n--- ACT VII BOARD: read it before we post ---');
  const before7 = await client.fetchEntries('actSeven');
  check('the act-seven board reads back', before7.ok === true, before7.reason || '');
  check('and it is a DIFFERENT board from the all-time one',
    BOARDS.actSeven.internalName !== BOARDS.allTime.internalName,
    BOARDS.actSeven.internalName);

  console.log('\n--- ACT VII BOARD: submit the time ---');
  const posted7 = await client.submitActSevenTime(card, identified.aliasId, 'test-delete-me');
  check('the Act VII time posted', posted7.ok === true, posted7.reason || '');

  console.log('\n--- ACT VII BOARD: read it back ---');
  const board7 = await client.fetchEntries('actSeven');
  check('the act-seven board reads back after the post', board7.ok === true, board7.reason || '');
  const mine7 = (board7.entries || []).find((e) => (e.props || [])
    .some((p) => p && p.key === 'runId' && p.value === card.runId));
  check('our Act VII entry is on it', !!mine7);
  if (mine7) {
    // The whole point of the second board: the SCORE FIELD HOLDS SECONDS here, not a score.
    check('and its score is Act VII\'s SECONDS, not the run total',
      mine7.score === card.actSeconds[6] && mine7.score !== score.total, String(mine7.score));
    const props7 = {};
    (mine7.props || []).forEach((p) => { props7[p.key] = p.value; });
    check('carrying the same facts as the all-time row',
      props7.runId === card.runId && props7.name === 'test-delete-me'
      && props7.actSeconds && Object.keys(JSON.parse(props7.actSeconds)).length === 7,
      Object.keys(props7).join(','));
    // Not an ordering assertion — see the header. This only records what the dashboard is doing so
    // a misconfigured board is visible in the output rather than silently ranking backwards.
    const scores7 = (board7.entries || []).map((e) => e.score);
    console.log('\n    act-seven board, in the order the vendor returned it: '
      + JSON.stringify(scores7)
      + (scores7.length > 1
        ? (scores7[0] <= scores7[scores7.length - 1]
          ? '  (ascending — fastest first, as the dashboard should be set)'
          : '  (DESCENDING — check the board\'s sort setting in the dashboard)')
        : '  (one row: nothing to infer about the sort yet)'));
  }

  console.log('\n--- ACT VII BOARD: a run that never reached Act VII ---');
  // Acts I and II only. Plausible, submittable to the all-time board, and meaningless on this one.
  const shortRun = { ...card, runId: 'live-test-short', actSeconds: { 0: PAR[0], 1: PAR[1] } };
  const noSeven = await client.submitActSevenTime(shortRun, identified.aliasId, 'should-not-appear');
  check('is refused without a request', noSeven.ok === false && noSeven.reason === 'no-act-seven',
    noSeven.reason);
  // And the clamp still comes FIRST: an impossible card is refused as impossible, not as incomplete.
  const cheat7 = await client.submitActSevenTime(cheat, identified.aliasId, 'should-not-appear');
  check('while an impossible card is refused as impossible, not as missing Act VII',
    cheat7.ok === false && cheat7.reason.indexOf('refused-') === 0, cheat7.reason);
  const board7b = await client.fetchEntries('actSeven');
  check('and neither reached the act-seven board',
    !(board7b.entries || []).some((e) => (e.props || []).some((p) => p && p.key === 'runId'
      && (p.value === 'live-test-short' || p.value === 'live-test-cheat'))));

  console.log('\n--- an unknown board key is a caller bug, not a request ---');
  const unknown = await client.fetchEntries('actNine');
  check('fetchEntries refuses a key that is not in BOARDS',
    unknown.ok === false && unknown.reason === 'unknown-board', unknown.reason);

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  console.log('All-time board now holds ' + ((board3.entries || []).length) + ' entr'
    + ((board3.entries || []).length === 1 ? 'y' : 'ies') + '; act-seven board holds '
    + ((board7b.entries || []).length) + '.');
  process.exit(failures === 0 ? 0 : 1);
})();
