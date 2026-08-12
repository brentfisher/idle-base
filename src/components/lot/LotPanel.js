const React = require('react');
const { useGame } = require('../../state/GameContext');
const { collectorsPerSecond } = require('../../engine/income');
const { getActConfig } = require('../../engine/progression');
const { getActIntroBeat } = require('../../data/storyBeats');
const { formatNumber } = require('../../utils/formatNumber');
const LotShop = require('./LotShop');

// The whole of Act I: a caps counter, one button, and a shop that reveals itself as the
// player earns their way into it. No tabs, and no stat the player has not earned yet.
//
// The button is NOT here. It used to be, which is why it scrolled away with the panel in
// Acts I and II while Act III's copy sat pinned to the bottom of the screen — and in Act II,
// where the wall renders above the lot, "scrolls away" meant most of a page down. It is now
// rendered once by AppShell in both of its branches, inside the sticky .hustle-bar. Rendering
// it here as well would credit twice per visual press.
function LotPanel() {
  const { state } = useGame();
  const act = getActConfig(state.progression.act);
  const perSecond = collectorsPerSecond(state);
  const beat = getActIntroBeat(state.progression.act);

  return (
    <div className="lot-panel">
      <div className="lot-header">
        <span className="lot-act">{act.name}</span>
        <span className="lot-caps">{formatNumber(state.wallet.caps)}</span>
        <span className="lot-caps-label">bottle caps</span>
        {perSecond > 0 && <span className="lot-rate">+{perSecond.toFixed(1)} / sec</span>}
      </div>

      <LotShop />

      {beat && <p className="lot-objective">{beat.objective}</p>}
    </div>
  );
}

module.exports = LotPanel;
