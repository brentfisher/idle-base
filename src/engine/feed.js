const { generateId } = require('../utils/randomUtils');
const { FEED_CAP } = require('../data/feedMessages');

// state.feed is stored oldest-first (chronological), matching the order advance() resolves
// events; the renderer reverses for newest-first display. Keeping the stored order
// chronological means a long offline catch-up appends naturally and the trim always drops
// the oldest entries.
function createFeedEntry(clock, category, text) {
  return { id: generateId('feed'), clock: Math.round(clock), category, text };
}

// The cap is applied on *every* write, never accumulated-then-trimmed, so the array cannot
// grow past FEED_CAP even when a single offline advance() resolves hundreds of events.
function appendFeedEntries(state, entries) {
  if (!entries || entries.length === 0) return state;
  const feed = state.feed || [];
  const next = [...feed, ...entries];
  return { ...state, feed: next.length > FEED_CAP ? next.slice(next.length - FEED_CAP) : next };
}

function appendFeedEntry(state, clock, category, text) {
  return appendFeedEntries(state, [createFeedEntry(clock, category, text)]);
}

module.exports = { createFeedEntry, appendFeedEntries, appendFeedEntry };
