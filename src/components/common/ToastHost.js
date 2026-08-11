const React = require('react');
const { useGame } = require('../../state/GameContext');
const { crewJoinLine, challengeLine } = require('../../data/toastMessages');

const TOAST_MS = 4200;
// Only ever a handful on screen. A burst (three kids at once off one long offline return)
// stacks rather than queues, so nothing is waiting behind something else to be seen.
const MAX_TOASTS = 3;

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

  React.useEffect(() => {
    const snapshot = { crewSize, decided, act, lastResult: wallBall.lastResult };
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
    if (added.length === 0) return;

    setToasts((current) => {
      const stamped = added.map((t) => {
        seq.current += 1;
        return { ...t, id: `toast-${seq.current}`, born: Date.now() };
      });
      return [...current, ...stamped].slice(-MAX_TOASTS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSize, decided, act]);

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
