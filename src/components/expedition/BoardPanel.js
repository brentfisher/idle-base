const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { boardSummary, listOffers } = require('../../engine/board');
const { boardCopy } = require('../../data/actSevenBoardConfig');
// THE SAME TABLE THE PLAYER LEARNED IN ACT III, not a second one that looks like it (PRD §7.8).
// Extracted from components/league/StandingsPanel.js by this story for exactly this import; the
// argument is at its definition and it is the shortest statement of `conventions.md`'s reuse
// pillar in the codebase.
const StandingsTable = require('../league/StandingsTable');

// Act VII's ending — the majors standings board (PRD §7.8).
//
// RENDER ONLY, AND UNUSUALLY LITERALLY SO. Every number on this screen and every sentence in it
// comes back resolved from engine/board.js and data/actSevenBoardConfig.js: the sorted rows,
// Earth's rank, the line that rank earned, the itemized breakdown that produced the record, the
// order's price in two currencies and whether it can be met. This file computes nothing, formats
// nothing that was not handed to it formatted, and holds no state. The last screen of the game
// decides as little as the first one did.
//
// THERE IS NO CLOCK ON THIS PANEL AND THAT IS DELIBERATE. `placement()` is measured to the instant
// the fifth burn was committed, so the board is frozen at the run that produced it and only the
// standing orders move it afterwards. A player who leaves the tab open does not watch their own
// season decay.

// One line of the account: what the input was, what the run did, and what it bought.
function BreakdownRow({ row }) {
  return (
    <li className="v7-board-line">
      <span className="v7-board-line-label">{row.label}</span>
      <span className="v7-board-line-detail">{row.detail}</span>
      <span className="v7-board-line-wins">{boardCopy.breakdownWins(row.wins)}</span>
    </li>
  );
}

// The post-game ladder (AC #5). A REPEATABLE PURCHASE and not a timed build, which is why this is a
// button and not a progress bar — the argument is in data/actSevenBoardConfig.js and the short
// version is that a timed order would inherit the entire offline-safety burden for no design gain.
//
// The button is disabled on `affordable`, which the engine resolves against BOTH currencies. A row
// lit by the Salvage half alone would refuse on press, which is the one thing a shop row may never
// do.
function StandingOrder({ offer, onBuy }) {
  return (
    <div className={'v7-row' + (offer.affordable ? '' : ' is-unaffordable')}>
      <div className="v7-row-main">
        <div className="v7-row-name">{offer.name}</div>
        <div className="v7-row-effect">{offer.effect}</div>
        {offer.shortfall ? <div className="v7-row-effect">{offer.shortfall}</div> : null}
      </div>
      <button type="button" className="v7-row-cost" disabled={!offer.affordable} onClick={onBuy}>
        {offer.priceLabel}
      </button>
    </div>
  );
}

function BoardPanel() {
  const { state, dispatch } = useGame();
  const summary = boardSummary(state);
  const offers = listOffers(state);

  return (
    <div className="panel">
      <h2>{boardCopy.title}</h2>
      <p className="muted">{boardCopy.subtitle}</p>
      <p className="muted">{boardCopy.seasonLine(summary.games)}</p>

      <StandingsTable
        rows={summary.rows}
        highlightId={summary.earthId}
        teamHeading={boardCopy.teamHeading}
      />

      {/* The line the run earned. Under the table rather than over it, because the table is the
          answer and this is what the Office wrote in the margin next to it. */}
      <p className="v7-board-line-earned">{summary.line}</p>

      <h3>{boardCopy.breakdownTitle}</h3>
      <p className="muted">{boardCopy.breakdownNote}</p>
      <ul className="v7-board-breakdown">
        {summary.placement.breakdown.map((row) => (
          <BreakdownRow key={row.id} row={row} />
        ))}
      </ul>

      {/* Omitted entirely rather than rendered empty when the engine returns no row — the act's
          rule everywhere (engine/sites.js states it) is that unavailable content is not drawn. */}
      {offers.length > 0 ? (
        <React.Fragment>
          <h3>{boardCopy.ordersTitle}</h3>
          {offers.map((offer) => (
            <StandingOrder
              key={offer.id}
              offer={offer}
              onBuy={() => dispatch({ type: actionTypes.FILL_STANDING_ORDER, offerId: offer.id })}
            />
          ))}
        </React.Fragment>
      ) : null}
    </div>
  );
}

module.exports = BoardPanel;
