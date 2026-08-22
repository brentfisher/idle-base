const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { PERKS } = require('../../data/perksConfig');
const { getEraConfig } = require('../../data/eras');
const { calculateLegacyPoints } = require('../../engine/prestige');
const { formatCash, formatNumber } = require('../../utils/formatNumber');
const Modal = require('../common/Modal');

function PrestigePanel() {
  const { state, dispatch } = useGame();
  const [confirming, setConfirming] = React.useState(false);
  const currentEra = getEraConfig(state.prestige.era);
  const nextEra = getEraConfig(state.prestige.era + 1);
  const earnable = calculateLegacyPoints(state);
  // The two halves of the rating term, so the card can show the subtraction the payout performs.
  // `baseline` is null on a run that has not ticked since this shipped; the card then omits the
  // arrow rather than inventing a starting rating.
  const baseline = state.prestige.runStats.baselineOverallRating;
  const ratingGain = Math.max(0, state.prestige.runStats.peakOverallRating - (Number.isFinite(baseline) ? baseline : 0));

  return (
    <div className="panel">
      <h2>Prestige</h2>
      <p className="muted">
        Reset your run for a permanent boost. You keep legacy points, purchased perks, and advance to a new era with
        its own rules.
      </p>
      <div className="card">
        <div>
          Legacy Points: <strong>{formatNumber(state.prestige.legacyPoints)}</strong> (lifetime earned:{' '}
          {formatNumber(state.prestige.totalLegacyEarned)})
        </div>
        <div className="muted">
          Current era: {currentEra.name} — {currentEra.description}
        </div>
        {/* THE RATING LINE SHOWS THE GAIN, NOT THE PEAK, because the gain is what is paid for. It
            used to print the absolute peak beside a payout computed from it, and once the payout
            became a delta (engine/prestige.js) the two would have disagreed on screen — a card
            saying "peak rating 53.0" above a button offering +3. The baseline is named alongside
            it so the subtraction is visible rather than mysterious. */}
        <div className="muted">
          This run: {state.prestige.runStats.championships} championship(s), rating{' '}
          {ratingGain > 0 ? '+' + ratingGain.toFixed(1) : 'unchanged'}
          {Number.isFinite(baseline) ? ` (${baseline.toFixed(1)} → ${state.prestige.runStats.peakOverallRating.toFixed(1)})` : ''},{' '}
          {formatCash(state.prestige.runStats.totalRevenue)} earned.
        </div>
        {/* DISABLED AT ZERO, and that guards two different things. It closes the loop this fix is
            about — pressing Prestige repeatedly for a payout the run did not earn — and it also
            stops an accidental era burn: nothing anywhere decrements `prestige.era`, and
            data/eras.js's synthesised eras raise `aiStrengthMult` on every step, so a mis-click is
            a permanent difficulty increase with nothing banked in return. */}
        <button
          className="btn"
          style={{ marginTop: 8 }}
          disabled={earnable <= 0}
          title={earnable <= 0 ? 'Nothing banked yet — win a title, raise the team, or take some revenue first.' : undefined}
          onClick={() => setConfirming(true)}
        >
          Prestige Now (+{formatNumber(earnable)} legacy)
        </button>
        {earnable <= 0 && (
          <div className="muted" style={{ marginTop: 4 }}>
            Nothing banked yet. Prestige pays for what this run added — a title, a better team than
            you were handed, or revenue taken.
          </div>
        )}
      </div>

      <h3>Perk Tree</h3>
      <div className="card-grid">
        {PERKS.map((perk) => {
          const owned = state.prestige.purchasedPerks.includes(perk.id);
          const locked = perk.prerequisite && !state.prestige.purchasedPerks.includes(perk.prerequisite);
          const disabled = owned || locked || state.prestige.legacyPoints < perk.legacyCost;
          return (
            <div className="card" key={perk.id}>
              <strong>{perk.name}</strong>
              <div className="muted">{perk.description}</div>
              {locked && <div className="muted">Requires: {perk.prerequisite}</div>}
              <button
                className="btn secondary"
                disabled={disabled}
                onClick={() => dispatch({ type: actionTypes.BUY_PERK, perkId: perk.id })}
                style={{ marginTop: 6 }}
              >
                {owned ? 'Owned' : `${perk.legacyCost} legacy`}
              </button>
            </div>
          );
        })}
      </div>

      {confirming && (
        <Modal title="Prestige?" onClose={() => setConfirming(false)}>
          <p>
            This resets your cash, roster, stadium, and season progress. You'll earn{' '}
            <strong>{formatNumber(earnable)}</strong> legacy points and move into the <strong>{nextEra.name}</strong>{' '}
            era: {nextEra.description}
          </p>
          <button
            className="btn"
            onClick={() => {
              dispatch({ type: actionTypes.PRESTIGE_RESET });
              setConfirming(false);
            }}
          >
            Confirm Prestige
          </button>
        </Modal>
      )}
    </div>
  );
}

module.exports = PrestigePanel;
