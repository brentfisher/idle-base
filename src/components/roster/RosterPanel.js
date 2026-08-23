const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const PlayerCard = require('./PlayerCard');
const { resolveRules } = require('../../engine/modifiers');
const { campSwap, standInFor } = require('../../engine/trainingCamp');
const { getUnlockedFeatures } = require('../../engine/progression');
const { listCrate } = require('../../engine/walkupSongs');
const { WALKUP_UNLOCK_ID, WALKUP_COPY } = require('../../data/walkupSongsConfig');
const { formatCash } = require('../../utils/formatNumber');

// The team's record crate. It sits above the roster and not on the cards because ownership is
// TEAM-WIDE — a record is bought once and then handed around (see engine/walkupSongs.js) — so
// eighteen prices repeated on fifteen cards would be the same shop drawn fifteen times.
//
// Collapsed by default, and that is a screen-budget decision rather than a stylistic one: the
// Roster tab is the densest in the game (fifteen cards, four or five upgrade rows each) and an
// open eighteen-row list would push the actual roster off a 390px screen entirely. The toggle
// says how many records are still for sale, so the player can tell there is something here
// without opening it.
function RecordCrate() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = React.useState(false);
  const crate = listCrate(state);
  const forSale = crate.filter((song) => !song.owned).length;

  return (
    <section className="wu-crate">
      <h3 className="wu-crate-head">{WALKUP_COPY.crateHeading}</h3>
      <p className="muted wu-crate-blurb">{WALKUP_COPY.crateBlurb}</p>
      <button type="button" className="btn secondary wu-crate-toggle" onClick={() => setOpen(!open)}>
        {open ? WALKUP_COPY.crateClose : WALKUP_COPY.crateOpen(forSale)}
      </button>
      {open && (
        <ul className="wu-crate-list">
          {crate.map((song) => (
            <li key={song.id} className={`wu-crate-row${song.owned ? ' owned' : ''}`}>
              <div className="wu-crate-song">
                {/* THE STAT, FIRST AND AS A CHIP. The effect string on the right already said it,
                    at the end of a line of prose, in the corner a thumb covers — which is the
                    complaint. `stat` is carried raw alongside the tag so the chip can take its
                    colour from the stat without parsing the label back apart, and so the B-side
                    chip (WALKUP_ALL_STATS) can be the one that looks different. */}
                <span className={`wu-stat-chip stat-${song.stat}`}>{song.statTag}</span>
                <span className="wu-crate-title">{song.title}</span>
                <span className="muted"> — {song.artist}</span>
                <span className="wu-crate-desc">{song.description}</span>
              </div>
              <div className="wu-crate-buy">
                <span className="wu-crate-effect">
                  {song.effect}
                  {song.pitchersOnly && <span className="muted"> · {WALKUP_COPY.pitchersOnly}</span>}
                </span>
                {song.owned ? (
                  // An owned record is not a disabled button, for the same reason a maxed stat is
                  // a MAX chip and not a greyed-out upgrade (see UpgradeButton): a disabled button
                  // asks the player to work out WHY. It says who has it, which is the only thing
                  // left worth knowing about a record you already own.
                  //
                  // AND, WHEN SOMEBODY HAS IT, THE WAY TO GET IT BACK. The picker no longer steals
                  // (engine/walkupSongs.js EXCLUSIVITY), so this button is the only route from "on
                  // that kid" to "on this one" — without it a record assigned to a bench player
                  // would be unreachable from every card in the game. It dispatches the assignment
                  // action already used by every dropdown, with the HOLDER's id and no song, which
                  // is what "put it back in the crate" is in this state shape.
                  <span className="wu-crate-owned">
                    {song.heldBy ? WALKUP_COPY.heldBy(song.heldBy) : WALKUP_COPY.unassigned}
                    {song.heldById && (
                      <button
                        type="button"
                        className="btn secondary wu-crate-release"
                        title={WALKUP_COPY.takeBackTitle(song.heldBy)}
                        onClick={() =>
                          dispatch({ type: actionTypes.SET_WALKUP_SONG, playerId: song.heldById, songId: null })
                        }
                      >
                        {WALKUP_COPY.takeBack}
                      </button>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn secondary wu-crate-price"
                    disabled={!song.affordable}
                    onClick={() =>
                      // playerId omitted: this buys into the crate and assigns it to nobody. The
                      // dropdown on each card is where it gets handed to a kid.
                      dispatch({ type: actionTypes.SET_WALKUP_SONG, songId: song.id })
                    }
                  >
                    {formatCash(song.cost)}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RosterPanel() {
  const { state } = useGame();
  const starters = state.roster.filter((p) => p.isStarter);
  const bench = state.roster.filter((p) => !p.isStarter);

  // Gated exactly the way every other feature is: derived from the act index, never stored, so a
  // save that crosses into Act IV grows the crate with no migration. `progression` is guarded
  // because engine/progression.js does the same — a save predating the slice must not white-screen
  // the roster.
  const walkupUnlocked = getUnlockedFeatures(state.progression ? state.progression.act : undefined).includes(
    WALKUP_UNLOCK_ID
  );

  // Resolved once here and passed down, the way StandingsPanel resolves playoffTeams: an act or
  // era may move the ceiling, and every bar, badge and button on this screen has to be reading
  // the same number the reducer enforces.
  const rules = resolveRules(state);

  // A starter at camp is sitting in the Bench group and their stand-in is up in Starters, which
  // looks like a bug unless both cards say why. Only one camp runs at a time (campSlots), so this
  // is a single lookup rather than a per-card one.
  const camper = state.roster.find((p) => p.campStatus) || null;
  const swap = camper ? campSwap(camper) : null;
  const standIn = camper ? standInFor(state.roster, camper) : null;

  const renderCard = (p) => (
    <PlayerCard
      key={p.id}
      player={p}
      clock={state.clock}
      statCap={rules.statCap}
      upgradeAmount={rules.statUpgradeAmount}
      standInName={camper && p.id === camper.id && standIn ? standIn.name : null}
      coveringFor={swap && standIn && p.id === standIn.id ? camper : null}
      walkupUnlocked={walkupUnlocked}
    />
  );

  return (
    <div className="panel">
      <h2>Roster</h2>
      <p className="muted">
        Spend cash to upgrade individual stats. Better starters win more games and draw bigger crowds. Every stat
        tops out at {rules.statCap} — the bar shows how far off that is, and a maxed stat says MAX instead of a
        price.
      </p>
      {walkupUnlocked && <RecordCrate />}
      <h3>Starters</h3>
      <div className="card-grid roster-grid">{starters.map(renderCard)}</div>
      <h3>Bench</h3>
      <div className="card-grid roster-grid">{bench.map(renderCard)}</div>
    </div>
  );
}

module.exports = RosterPanel;
