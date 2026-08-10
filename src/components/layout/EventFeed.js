const React = require('react');
const { useGame } = require('../../state/GameContext');
const { FEED_CATEGORIES } = require('../../data/feedMessages');
const { formatDuration } = require('../../utils/formatNumber');

// Renders state.feed newest-first. The buffer is stored oldest-first by the engine, and
// is capped at FEED_CAP entries on write, so this never renders more than ~50 rows even
// after an 8-hour offline catch-up.
function EventFeed() {
  const { state } = useGame();
  const feed = state.feed || [];
  const newestFirst = feed.slice().reverse();

  return (
    <div className="panel event-feed">
      <h2>Broadcast Feed</h2>
      {newestFirst.length === 0 ? (
        <p className="muted">Nothing to report yet — the first game of the season is coming up.</p>
      ) : (
        <ul className="feed-list">
          {newestFirst.map((entry) => {
            const category = FEED_CATEGORIES[entry.category] || FEED_CATEGORIES.game;
            return (
              <li className={`feed-item feed-${entry.category}`} key={entry.id}>
                <span className="feed-icon" title={category.label} role="img" aria-label={category.label}>
                  {category.icon}
                </span>
                <span className="feed-text">{entry.text}</span>
                <span className="feed-time">{formatDuration(Math.max(0, state.clock - entry.clock))} ago</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

module.exports = EventFeed;
