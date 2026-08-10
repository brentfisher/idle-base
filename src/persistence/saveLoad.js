const STORAGE_KEY = 'idle-base-save-v1';
// Bumped to 2 by the odyssey progression change: the state shape is reorganized around acts
// and there is no migration path, so every v1 save is read and discarded (design doc,
// "Save compatibility"). The storage key deliberately does not change, so old saves are
// cleaned up on load rather than lingering in localStorage forever.
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
