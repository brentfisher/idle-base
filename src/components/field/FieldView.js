const React = require('react');
const { useGame } = require('../../state/GameContext');
const { POSITIONS, FIELDING_POSITIONS } = require('../../data/positions');
const PlayerIcon = require('./PlayerIcon');
const { teamStrength } = require('../../engine/strength');
const { computeModifiers } = require('../../engine/modifiers');
const { buildReplay, BASES, MOUND } = require('../../engine/gameReplay');

// How long each batter's beat holds on screen. The whole replay is bounded by the beat count
// in engine/gameReplay.js (at most 7 per half), so the longest possible replay is ~14s.
const BEAT_MS = 950;

// The most recently played slot, or null. Used only to notice that a NEW one appeared.
function lastPlayedGame(state) {
  if (!state.season) return null;
  const played = state.season.schedule.filter((g) => g.played);
  if (played.length === 0) return null;
  const slot = played[played.length - 1];
  const team = state.league && state.league.teams.find((t) => t.id === slot.opponentTeamId);
  const [a, b] = (slot.score || '0-0').split('-').map(Number);
  return {
    key: `${state.season.seasonNumber}:${played.length}`,
    opponentName: team ? team.name : 'the visitors',
    isHome: slot.isHome,
    won: slot.result === 'win',
    scoreFor: a,
    scoreAgainst: b,
  };
}

// Plays the last result out on the diamond, one batter at a time.
//
// Entirely presentational: it reads a game the engine already decided and animates it. The
// simulation never waits for this, which is what keeps an eight-hour offline catch-up (a whole
// season resolved inside one advance() iteration) from having to care that a replay exists.
function useGameReplay(state) {
  const [replay, setReplay] = React.useState(null);
  const [beatIndex, setBeatIndex] = React.useState(0);
  const lastKey = React.useRef(null);

  const game = lastPlayedGame(state);
  const gameKey = game && game.key;
  // Held in a ref so the effect below depends on the key alone: it must fire when a new game
  // is played, not every time the roster re-renders.
  const rosterRef = React.useRef(state.roster);
  rosterRef.current = state.roster;

  React.useEffect(() => {
    if (!gameKey) return undefined;
    // First render of an existing save would otherwise replay a game the player watched
    // before they reloaded.
    if (lastKey.current === null) {
      lastKey.current = gameKey;
      return undefined;
    }
    if (lastKey.current === gameKey) return undefined;
    lastKey.current = gameKey;

    setReplay(buildReplay(game, rosterRef.current));
    setBeatIndex(0);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);

  React.useEffect(() => {
    if (!replay) return undefined;
    if (beatIndex >= replay.beats.length) {
      const done = setTimeout(() => setReplay(null), BEAT_MS);
      return () => clearTimeout(done);
    }
    const next = setTimeout(() => setBeatIndex((i) => i + 1), BEAT_MS);
    return () => clearTimeout(next);
  }, [replay, beatIndex]);

  const beat = replay && replay.beats[Math.min(beatIndex, replay.beats.length - 1)];
  return { replay, beat, finished: !!replay && beatIndex >= replay.beats.length };
}

function FieldView() {
  const { state } = useGame();
  const modifiers = computeModifiers(state);
  const strength = teamStrength(state.roster, modifiers);
  const dh = state.roster.find((p) => p.position === 'DH' && p.isStarter);
  const bench = state.roster.filter((p) => !p.isStarter);
  const { replay, beat, finished } = useGameReplay(state);

  const nextGameIn = state.season && state.season.phase === 'regular'
    ? Math.max(0, Math.ceil(state.season.nextGameAtClock - state.clock))
    : null;

  const ballTo = beat ? beat.ball.to : MOUND;
  const runnerBase = beat ? BASES[beat.runnerTo] : BASES[0];

  return (
    <div className="panel">
      <h2>Home Field</h2>
      <p className="muted">
        Team strength: {strength.toFixed(1)} (drives win probability and fan appeal)
        {modifiers.strengthMult > 1 && (
          <> · reputation is worth +{Math.round((modifiers.strengthMult - 1) * 100)}%</>
        )}
      </p>

      <div className={`field-view${replay ? ' playing' : ''}`}>
        <svg className="field-svg" viewBox="0 0 100 100">
          <rect x="0" y="0" width="100" height="100" fill="#1f4d2a" />
          <path d="M 50 90 L 8 28 A 62 62 0 0 1 92 28 Z" fill="#2a6338" />
          <polygon points="50,90 74,64 50,42 26,64" fill="#8a6a4a" stroke="#eef3ec" strokeWidth="0.4" />
          <line x1="50" y1="90" x2="8" y2="28" stroke="#eef3ec" strokeWidth="0.4" />
          <line x1="50" y1="90" x2="92" y2="28" stroke="#eef3ec" strokeWidth="0.4" />
          <rect x="48.5" y="88.5" width="3" height="3" fill="#eef3ec" transform="rotate(45 50 90)" />

          {POSITIONS.filter((pos) => FIELDING_POSITIONS.includes(pos.id)).map((pos) => {
            const player = state.roster.find((p) => p.position === pos.id && p.isStarter);
            // During a replay the fielder nearest the ball leans toward it, so the defence
            // reads as reacting rather than standing still.
            const near = beat && Math.hypot(pos.x - ballTo.x, pos.y - ballTo.y) < 12;
            return (
              <PlayerIcon
                key={pos.id}
                x={near ? pos.x + (ballTo.x - pos.x) * 0.35 : pos.x}
                y={near ? pos.y + (ballTo.y - pos.y) * 0.35 : pos.y}
                position={pos.id}
                player={player}
                active={!!near}
              />
            );
          })}

          {replay && (
            <>
              <circle className="replay-runner" cx={runnerBase.x} cy={runnerBase.y} r="2.6" />
              <circle className={`replay-ball${beat && beat.kind === 'hit' ? ' hit' : ''}`} cx={ballTo.x} cy={ballTo.y} r="1.7" />
            </>
          )}
        </svg>

        {replay && (
          <div className={`replay-overlay${finished ? ' done' : ''}`}>
            <span className="replay-half">{beat ? beat.half : ''}</span>
            <span className="replay-text">
              {finished
                ? `${replay.won ? 'Won' : 'Lost'} ${replay.scoreFor}-${replay.scoreAgainst} against ${replay.opponentName}.`
                : beat && beat.text}
            </span>
          </div>
        )}
      </div>

      {!replay && nextGameIn !== null && (
        <p className="muted">Next game in {nextGameIn}s.</p>
      )}

      <h3>Dugout</h3>
      <div className="card-grid">
        {dh && (
          <div className="card">
            <strong>DH</strong> — {dh.name}
          </div>
        )}
        {bench.map((p) => (
          <div className="card" key={p.id}>
            <span className="muted">Bench · {p.position}</span>
            <br />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = FieldView;
