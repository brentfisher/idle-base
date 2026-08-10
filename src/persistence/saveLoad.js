const STORAGE_KEY = 'idle-base-save-v1';
// v2 replaced the single `cash` number with `wallet: { caps, coins, cash }`. There is no
// migration by design — loadGame() discards any save whose version differs.
const CURRENT_VERSION = 2;

function saveGame(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save game', err);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.meta || parsed.meta.version !== CURRENT_VERSION) {
      console.warn('Save missing or version mismatch, starting a fresh game');
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load save, starting a fresh game', err);
    return null;
  }
}

function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear save', err);
  }
}

module.exports = { saveGame, loadGame, clearSave, STORAGE_KEY };
