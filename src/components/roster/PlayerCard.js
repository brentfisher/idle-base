const React = require('react');
const StatBar = require('../common/StatBar');
const UpgradeButton = require('./UpgradeButton');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { playerOverall } = require('../../engine/strength');
const { listPickerOptions, songSummaryFor } = require('../../engine/walkupSongs');
const { CAMP_SWAP_COPY } = require('../../data/campProgramsConfig');
const { WALKUP_COPY } = require('../../data/walkupSongsConfig');
const { formatDuration } = require('../../utils/formatNumber');

const POSITION_STATS = {
  P: ['pitching', 'defense', 'contact', 'power', 'speed'],
  DEFAULT: ['power', 'contact', 'speed', 'defense'],
};

// The dropdown the whole feature is named after. Connected rather than fed by props, exactly as
// UpgradeButton is: it is one control per card and the list it renders depends on the whole
// roster (who is already holding which record), which RosterPanel would otherwise have to
// recompute fifteen times and thread down.
//
// It lists OWNED records only. Buying happens up in the crate, where the price and the
// description are both visible — a <select> on a phone is the one control a thumb can brush past
// by accident, and a shop that charges 4,800 cash on a scroll gesture is not a shop.
function WalkupPicker({ player }) {
  const { state, dispatch } = useGame();
  const { none, groups } = listPickerOptions(state, player);

  // No groups is the "no walk-up song" row on its own: either the crate is empty, or everything in
  // it is a pitching record and this is a shortstop. Rendering a one-option dropdown would be a
  // control the player cannot use, on the densest screen in the game, fifteen times over.
  if (groups.length === 0) return <div className="muted wu-empty">{WALKUP_COPY.emptyCrate}</div>;

  return (
    <label className="wu-picker">
      <span className="wu-picker-label">{WALKUP_COPY.pickerLabel}</span>
      <select
        className="wu-select"
        value={player.walkupSongId || ''}
        onChange={(event) =>
          dispatch({
            type: actionTypes.SET_WALKUP_SONG,
            playerId: player.id,
            // '' is the "no song" row. Normalized to null here so the engine sees one falsy
            // shape rather than two.
            songId: event.target.value || null,
          })
        }
      >
        {/* Ungrouped and first, so the way to take a record OFF a kid is never buried under a
            heading. Its value is '' and it is what the <select> matches when nobody is assigned. */}
        <option value={none.id}>{none.label}</option>
        {/* <optgroup> AND NOT A DISABLED <option>, which is the whole reason the heading is safe to
            add: an optgroup label cannot be selected or focused, where a disabled option can still
            be landed on by keyboard in some browsers. The grouping and its order are the engine's
            (listPickerOptions) — this renders them and chooses nothing. */}
        {groups.map((group) => (
          <optgroup key={group.stat} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// `statCap` / `upgradeAmount` are resolved once by RosterPanel. `standInName` and `coveringFor`
// are the two halves of an active training-camp swap; both are null on every other card.
// `walkupUnlocked` is Act IV's gate, resolved once by RosterPanel off getUnlockedFeatures the way
// every other feature is gated; defaulting to false keeps this component renderable standalone.
function PlayerCard({
  player,
  clock,
  statCap = 100,
  upgradeAmount = 2,
  standInName = null,
  coveringFor = null,
  walkupUnlocked = false,
}) {
  // The stat list follows `position`, and a stand-in covering the mound genuinely has position
  // 'P' for the duration, so their card grows a pitching row while they are there and loses it
  // again when they go back to the bench. That is deliberate: pitching IS half their rating while
  // they are standing on the mound, so it is the stat the player should be able to buy.
  const stats = POSITION_STATS[player.position] || POSITION_STATS.DEFAULT;
  // playerOverall() applies the walk-up bonus itself, at read time, so this number and the number
  // teamStrength() feeds into the win probability are the same number by construction — the card
  // is not adding the bonus on top of a rating the simulation computed without it.
  const overall = Math.round(playerOverall(player));
  // Null for a player with no song, which is everybody before Act IV and everybody on a save
  // written before the crate existed.
  const walkup = songSummaryFor(player);
  const inCamp = !!player.campStatus;
  const campRemaining = inCamp ? Math.max(0, player.campStatus.completesAtClock - clock) : 0;

  // "Am I done with this guy?" — the question underneath the whole complaint. Derived from the
  // same list the card draws, so the badge can never disagree with the bars above it.
  const fullyUpgraded = stats.every((stat) => player.stats[stat] >= statCap);

  return (
    <div className={`card player-card${fullyUpgraded ? ' is-fully-upgraded' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{player.name}</strong>
        <span className="muted">
          {player.position} {player.isStarter ? '' : '(bench)'}
        </span>
      </div>
      <div className="muted">
        OVR {overall} · Age {player.age} · Season {player.seasonsPlayed}/{player.retireAtSeasons}
      </div>
      {fullyUpgraded && <div className="player-maxed-banner">FULLY UPGRADED — every stat at {statCap}</div>}
      {inCamp && (
        <div className="muted" style={{ color: '#f4d35e' }}>
          In camp — {formatDuration(campRemaining)} left
        </div>
      )}
      {standInName && <div className="camp-swap-note">{CAMP_SWAP_COPY.awayCoveredBy(standInName)}</div>}
      {coveringFor && (
        <div className="camp-swap-note">{CAMP_SWAP_COPY.coveringFor(coveringFor.name, player.position)}</div>
      )}
      {/* The bars below stay RAW, and this line is why that is not a contradiction: the bar is
          the number you buy and the number the cap applies to, and the song is a multiplier on
          top of it that is already inside the OVR two lines up. Printing a boosted bar would
          make the FULLY UPGRADED badge and the MAX chips lie about a stat the player cannot
          actually raise any further. */}
      {walkupUnlocked && (
        <div className="wu-row">
          {walkup && (
            <div className="wu-now-playing">
              <span className="wu-now-title">{walkup.title}</span>
              <span className="muted"> — {walkup.artist}</span>
              {walkup.effect && <span className="wu-now-effect"> {walkup.effect}</span>}
            </div>
          )}
          <WalkupPicker player={player} />
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        {stats.map((stat) => (
          <div key={stat} className="stat-upgrade-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <StatBar
                label={stat}
                value={player.stats[stat]}
                max={statCap}
                showCap
                nextStep={Math.min(upgradeAmount, statCap - player.stats[stat])}
              />
            </div>
            <UpgradeButton
              playerId={player.id}
              stat={stat}
              currentValue={player.stats[stat]}
              statCap={statCap}
              upgradeAmount={upgradeAmount}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = PlayerCard;
