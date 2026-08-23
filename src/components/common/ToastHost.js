const React = require('react');
const { useGame } = require('../../state/GameContext');
const { crewJoinLine, challengeLine, gameResultLine, gamesAwayLine, misadventureFor } = require('../../data/toastMessages');

const TOAST_MS = 4200;
// Only ever a handful on screen. A burst (three kids at once off one long offline return)
// stacks rather than queues, so nothing is waiting behind something else to be seen.
const MAX_TOASTS = 3;

// A batch of games gets ONE toast, whatever its size. See the note on useTransitionToasts()
// below: an eight-hour catch-up resolves a whole season inside one advance(), so the schedule
// index can jump by fifteen in a single render. One-per-game would be exactly the storm the
// derive-don't-store design exists to prevent, and MAX_TOASTS would silently discard all but
// the last three of them anyway — which would report three arbitrary games as if they were
// the only ones. A summary is both smaller and more honest.
//
// TWO RATHER THAN ONE, because a live game may say two things: the result, and the misadventure
// that sometimes accompanies it. It is still a cap on the LIVE branch only — the batch branch
// produces exactly one summary and never a misadventure, so a fifteen-game catch-up cannot reach
// this number from the other direction.
const MAX_GAME_TOASTS = 2;

// Opponent names live on the league, not on the schedule slot, which carries only an id. Not
// prose — the strings are the league's own team names — so the lookup belongs here rather than
// in data/toastMessages.js.
function opponentName(state, teamId) {
  const teams = (state.league && state.league.teams) || [];
  const team = teams.find((t) => t.id === teamId);
  return team && team.name ? team.name : 'the visitors';
}

// Toasts are DERIVED from state transitions, never stored in state, and that is the whole
// design. The obvious alternative — pushing toast entries into the save the way engine/feed.js
// does — fires a storm on load: advance() resolves a whole season inside one iteration during
// an eight-hour catch-up, so every crew member and every game would toast at once, describing
// things that happened overnight. Watching for a *change* since the last render means a
// reloaded save is simply the new baseline and nothing is announced.
function useTransitionToasts(state) {
  const [toasts, setToasts] = React.useState([]);
  const seq = React.useRef(0);
  const prev = React.useRef(null);

  const crewSize = (state.crew || []).length;
  const wallBall = state.wallBall || { wins: 0, losses: 0 };
  const decided = wallBall.wins + wallBall.losses;
  const act = state.progression ? state.progression.act : 0;

  // state.season is null through Acts I-II and the hook runs unconditionally, so -1 is the
  // "there is no season" sentinel. It matters that it is not 0: the Act III transition creates
  // a season at scheduleIndex 0, and reading a missing season as 0 would make that transition
  // look like a game had been played.
  const season = state.season || null;
  const scheduleIndex = season ? season.scheduleIndex || 0 : -1;
  const seasonNumber = season ? season.seasonNumber || 0 : -1;

  React.useEffect(() => {
    const snapshot = { crewSize, decided, act, scheduleIndex, seasonNumber, lastResult: wallBall.lastResult };
    // First render establishes the baseline; a reload must not replay what already happened.
    if (prev.current === null) {
      prev.current = snapshot;
      return;
    }
    const before = prev.current;
    prev.current = snapshot;

    const added = [];
    if (snapshot.decided > before.decided && wallBall.lastResult) {
      added.push({ tone: wallBall.lastResult.won ? 'good' : 'bad', text: challengeLine(wallBall.lastResult) });
    }
    for (let i = before.crewSize; i < snapshot.crewSize; i += 1) {
      const member = state.crew[i];
      added.push({ tone: 'crew', text: crewJoinLine(member, i) });
    }

    // Games. Guarded in this order and it has to be this order:
    //   1. No season now, or no season last time (Acts I-II, and the Act III transition into
    //      one) — the index is a sentinel, not a count, and comparing it means nothing.
    //   2. The season number changed — the offseason rebuilds the schedule and resets
    //      scheduleIndex to 0, so the index has gone BACKWARDS past games that were played in
    //      a schedule that no longer exists. Nothing to announce; the new season is just the
    //      new baseline.
    //   3. Only then is the index difference a count of games finished.
    const seasonHeld = season && before.seasonNumber >= 0 && snapshot.seasonNumber === before.seasonNumber;
    const finished = seasonHeld ? snapshot.scheduleIndex - before.scheduleIndex : 0;
    const gameToasts = [];

    if (finished === 1) {
      // The completed game is the slot the index just moved off.
      const gameIndex = snapshot.scheduleIndex - 1;
      const slot = season.schedule[gameIndex];
      if (slot && slot.played) {
        gameToasts.push({
          tone: slot.result === 'win' ? 'good' : 'bad',
          text: gameResultLine(slot, opponentName(state, slot.opponentTeamId)),
        });
        // Whatever else was going on around the game. Roughly one in four, derived from the season
        // and the game index so a given game always says the same thing — see
        // data/toastMessages.js for why it is hashed rather than rolled.
        //
        // ON THE LIVE SINGLE-GAME BRANCH ONLY, AND DELIBERATELY NOT ON THE BATCH ONE BELOW. An
        // eight-hour return resolves a whole season in one advance(), and a joke about a dog on
        // the field four hours ago is a joke about nothing the player was there for. The batch
        // branch stays one honest summary.
        //
        // It is pushed as a SEPARATE toast rather than appended to the result line: the result is
        // what the player is waiting for and must stay one line at 390px, and MAX_TOASTS keeps the
        // pair from ever becoming a stack.
        const aside = misadventureFor(snapshot.seasonNumber, gameIndex, act);
        if (aside) gameToasts.push({ tone: 'odd', text: aside });
      }
    } else if (finished > 1) {
      // The batch branch, and the reason MAX_GAME_TOASTS exists. Count them, say it once.
      let wins = 0;
      let losses = 0;
      for (let i = Math.max(0, before.scheduleIndex); i < snapshot.scheduleIndex; i += 1) {
        const slot = season.schedule[i];
        if (!slot || !slot.played) continue;
        if (slot.result === 'win') wins += 1;
        else losses += 1;
      }
      if (wins + losses > 0) gameToasts.push({ tone: 'game', text: gamesAwayLine(wins, losses) });
    }

    // The cap, applied rather than merely intended. The live branch produces at most two (a result
    // and its misadventure) and the batch branch exactly one, so this changes nothing today — it is
    // what keeps that true if a third branch is ever added.
    added.push(...gameToasts.slice(0, MAX_GAME_TOASTS));

    if (added.length === 0) return;

    setToasts((current) => {
      const stamped = added.map((t) => {
        seq.current += 1;
        return { ...t, id: `toast-${seq.current}`, born: Date.now() };
      });
      return [...current, ...stamped].slice(-MAX_TOASTS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSize, decided, act, scheduleIndex, seasonNumber]);

  // One sweep, not a timer per toast: a timer per toast leaks when several land together.
  React.useEffect(() => {
    if (toasts.length === 0) return undefined;
    const sweep = setInterval(() => {
      const now = Date.now();
      setToasts((current) => current.filter((t) => now - t.born < TOAST_MS));
    }, 400);
    return () => clearInterval(sweep);
  }, [toasts.length]);

  return toasts;
}

function ToastHost() {
  const { state } = useGame();
  const toasts = useTransitionToasts(state);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

module.exports = ToastHost;
