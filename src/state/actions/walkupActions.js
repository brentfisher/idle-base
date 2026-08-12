const { setWalkupSong } = require('../../engine/walkupSongs');

// Act IV's walk-up songs. No act transition check here, unlike lotActions/wallBallActions:
// nothing in the crate can satisfy Act IV's exit, which is a win rate accumulated over two full
// seasons — a song nudges that, it cannot complete it.
//
// The engine returns null for every refusal it knows about (unknown record, already owned, cannot
// afford it, a pitching record handed to a shortstop, or a selection that changes nothing), and
// refusal here is the unchanged state — exactly the shape concessionsActions.buyConcession has.
function setWalkupSongAction(state, action) {
  const next = setWalkupSong(state, { playerId: action.playerId, songId: action.songId });
  if (!next) return state;
  return next;
}

module.exports = { setWalkupSongAction };
