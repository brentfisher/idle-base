const React = require('react');
const Modal = require('../common/Modal');
const ActBackdrop = require('./ActBackdrop');
const actionTypes = require('../../state/actionTypes');
const { useGame } = require('../../state/GameContext');
const { getCurrency } = require('../../data/currencies');
const { formatNumber, formatDuration } = require('../../utils/formatNumber');
const { returnSummaryCopy } = require('../../data/titleScreenConfig');

// The screen a returning player lands on, and the one place in the game that has to answer "what
// happened while I was gone?" without flattering the answer.
//
// IT READS `state.returnSummary` AND COMPUTES NOTHING. The engine decides how long the absence was,
// how much of it was simulated, which currencies moved and in what order; this file formats that and
// stops. The contract:
//
//   state.returnSummary === null | undefined      nothing to show
//   { awaySeconds, simulatedSeconds, capped,      capped === simulatedSeconds < awaySeconds
//     currencies: [{ id, label, amount }],        already filtered to what moved, already ordered
//     resources:  [{ id, label, amount }], at }   Act VII consumables, same
//
// Guarded on falsiness rather than on `=== null` because the field does not exist in older saves or
// in a state built before the engine half of this landed, and `undefined` has to mean the same thing
// as `null` or the screen would throw on exactly those saves.
function ReturnSummary() {
  const { state, dispatch } = useGame();
  const summary = state.returnSummary;
  if (!summary) return null;

  const currencies = Array.isArray(summary.currencies) ? summary.currencies : [];
  const resources = Array.isArray(summary.resources) ? summary.resources : [];

  // BOTH DURATIONS, ALWAYS COMPUTED, and the capped case names both of them in one paragraph.
  //
  // This is the entire reason the screen exists. Offline progress is capped, so a player who was
  // away for three days had eight hours of it simulated. A screen that showed the income and left
  // the absence unmentioned would be claiming, by omission, that three days of the game happened —
  // and the very next thing that player does is check the number against that belief and conclude
  // the game took something from them. Saying it plainly costs one sentence and is the difference
  // between a cap and a theft.
  //
  // The words are in data/titleScreenConfig.js; neither duration is written out there, because
  // `simulatedSeconds` IS the applied cap and a prose literal would go stale the day it moves.
  const awayText = formatDuration(summary.awaySeconds);
  const simulatedText = formatDuration(summary.simulatedSeconds);
  const prose = summary.capped
    ? returnSummaryCopy.cappedProse(awayText, simulatedText)
    : returnSummaryCopy.awayProse(awayText);

  const actIndex = state.progression ? state.progression.act : 0;
  const eraIndex = state.prestige ? state.prestige.era : 0;

  // Currencies carry a symbol ($ for cash, nothing for the rest) and are GAINS, so they take a sign.
  // Resources do not: they are tank levels, and a `+` in front of one would be the exact claim the
  // caveat below exists to refuse.
  function renderRow(entry, signed) {
    const symbol = signed ? getCurrency(entry.id).symbol : '';
    const prefix = signed ? '+' : '';
    return (
      <li className="ledger-row" key={entry.id}>
        <span className="ledger-label">{entry.label}</span>
        <span className="ledger-amount">{prefix + symbol + formatNumber(entry.amount)}</span>
      </li>
    );
  }

  // No `onClose` on the Modal, so the backdrop is inert and the button below is the only way out.
  // Dismissing clears engine state rather than merely hiding a card, so it is worth a deliberate
  // tap — and it keeps this screen's shape identical to the title screen's.
  return (
    <Modal>
      <div className="screen-card">
        <div className="screen-banner">
          {/* Act-keyed, and this is the screen that makes the act axis worth having: a first-run
              title screen is always Act I, but a returning player can be anywhere in the arc, and
              the picture behind "Welcome back" is the cheapest reminder of what they were in the
              middle of. Absent whenever WebGL is — the screen below does not depend on it. */}
          <ActBackdrop actIndex={actIndex} eraIndex={eraIndex} />
          <div className="screen-banner-text">
            <h1 className="screen-title">{returnSummaryCopy.title}</h1>
          </div>
        </div>

        <div className="screen-prose">
          {prose.map(function (paragraph, index) {
            return <p key={index}>{paragraph}</p>;
          })}
        </div>

        {currencies.length > 0 && (
          <div className="screen-ledger">
            <h3 className="screen-ledger-head">{returnSummaryCopy.earnedHeading}</h3>
            <ul className="ledger-list">
              {currencies.map(function (entry) { return renderRow(entry, true); })}
            </ul>
          </div>
        )}

        {resources.length > 0 && (
          <div className="screen-ledger">
            <h3 className="screen-ledger-head">{returnSummaryCopy.storageHeading}</h3>
            <ul className="ledger-list">
              {resources.map(function (entry) { return renderRow(entry, false); })}
            </ul>
            {/* THE SECOND HONEST LINE, and it is gated on there being resources at all so that the
                six acts with no tanks never see a caveat about tanks. Act VII's consumables have
                capacity ceilings, so these figures are what the tanks HOLD and not what was made —
                a tank that filled two hours into the absence kept producing into nothing. */}
            <p className="screen-caveat muted">{returnSummaryCopy.storageCaveat}</p>
          </div>
        )}

        {/* Both lists empty. Still worth a screen: it answers the question the player opened the
            tab with, and it is the one case where an empty card would read as a broken one. */}
        {currencies.length === 0 && resources.length === 0 && (
          <p className="screen-prose-quiet">{returnSummaryCopy.nothingMovedLine}</p>
        )}

        <button
          type="button"
          className="btn screen-action"
          onClick={function () { dispatch({ type: actionTypes.DISMISS_RETURN_SUMMARY }); }}
        >
          {returnSummaryCopy.dismissLabel}
        </button>
      </div>
    </Modal>
  );
}

module.exports = ReturnSummary;
