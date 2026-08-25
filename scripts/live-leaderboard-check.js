// A LIVE END-TO-END CHECK of the leaderboard, driving the SHIPPED client rather than a stub.
//
//   LEADERBOARD_ACCESS_KEY=... node scripts/live-leaderboard-check.js
//
// IT WRITES TO THE REAL BOARD. One player (via identify) and one entry, named `test-delete-me` so
// it is obvious in the vendor dashboard and easy to remove. With the board in `unique` mode a
// re-run overwrites that same row rather than adding another, so this is safe to repeat — but it
// is not something to run against a board people are actually competing on without saying so.
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

const R = '/Users/brent/idle-base/src/';
const client = require(R + 'persistence/leaderboardClient');
const { runScore } = require(R + 'engine/score');
const { PAR } = require(R + 'data/scoreConfig');

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

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  console.log('Board now holds ' + ((board3.entries || []).length) + ' entr'
    + ((board3.entries || []).length === 1 ? 'y' : 'ies') + '.');
  process.exit(failures === 0 ? 0 : 1);
})();
