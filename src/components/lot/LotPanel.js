const React = require('react');
const { useGame } = require('../../state/GameContext');
const actionTypes = require('../../state/actionTypes');
const { COLLECTOR_TIERS, CLICK_UPGRADES, collectorCost } = require('../../data/lotConfig');
const { KIT_ITEMS } = require('../../data/kitConfig');
const { ownedCollectorCount } = require('../../state/actions/clickerActions');
const { formatNumber } = require('../../utils/formatNumber');

// Act I — The Vacant Lot. The Hustle button at the top of this panel is the manual income
// action; it stays mounted and enabled for the whole game (PRD §6.4), which is why the
// panel remains reachable after Act I ends.
function LotPanel() {
  const { state, dispatch } = useGame();
  const caps = Math.floor(state.wallet.caps);
  const inLot = state.progression.act === 0;

  return (
    <div className="panel">
      <h2>{inLot ? 'The Vacant Lot' : 'Hustle'}</h2>
      <p className="muted">
        {inLot
          ? 'Behind the hardware store. There is money in the dirt if you know where to look.'
          : 'You never stop digging. It is worth less than it used to be, and it always works.'}
      </p>

      <button className="btn hustle-button" onClick={() => dispatch({ type: actionTypes.HUSTLE })}>
        {inLot ? 'Search the lot' : 'Hustle'}
        <span className="hustle-yield">+{formatNumber(state.clicker.perClick)} caps</span>
      </button>
      <p className="muted">{formatNumber(state.clicker.totalClicks)} digs so far.</p>

      <h3>Help</h3>
      <div className="card-grid">
        {COLLECTOR_TIERS.map((tier) => {
          const owned = ownedCollectorCount(state, tier.id);
          const cost = collectorCost(tier, owned);
          return (
            <div className="card" key={tier.id}>
              <strong>{tier.name}</strong>
              {owned > 0 && <span className="muted"> x{owned}</span>}
              <p className="muted">{tier.description}</p>
              <p className="muted">+{tier.capsPerSecond} caps/sec each</p>
              <button
                className="btn"
                disabled={caps < cost}
                onClick={() => dispatch({ type: actionTypes.BUY_COLLECTOR, tierId: tier.id })}
              >
                Recruit — {formatNumber(cost)} caps
              </button>
            </div>
          );
        })}

        {CLICK_UPGRADES.map((upgrade) => {
          const owned = state.kit.purchasedClickUpgradeIds.includes(upgrade.id);
          return (
            <div className="card" key={upgrade.id}>
              <strong>{upgrade.name}</strong>
              <p className="muted">{upgrade.description}</p>
              <p className="muted">+{upgrade.perClickBonus} caps per dig</p>
              <button
                className="btn"
                disabled={owned || caps < upgrade.cost}
                onClick={() => dispatch({ type: actionTypes.BUY_CLICK_UPGRADE, upgradeId: upgrade.id })}
              >
                {owned ? 'Owned' : `Buy — ${formatNumber(upgrade.cost)} caps`}
              </button>
            </div>
          );
        })}
      </div>

      <h3>Starter Kit</h3>
      <p className="muted">Glove, ball and bat. All three, and you can go find a wall.</p>
      <div className="card-grid">
        {KIT_ITEMS.filter((item) => item.act === 0).map((item) => {
          const owned = state.kit.ownedItemIds.includes(item.id);
          return (
            <div className="card" key={item.id}>
              <strong>{item.name}</strong>
              <p className="muted">{item.description}</p>
              <button
                className="btn"
                disabled={owned || caps < item.cost}
                onClick={() => dispatch({ type: actionTypes.BUY_KIT_ITEM, itemId: item.id })}
              >
                {owned ? 'Owned' : `Buy — ${formatNumber(item.cost)} caps`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

module.exports = LotPanel;
