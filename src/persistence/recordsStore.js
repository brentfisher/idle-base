// The career record: finished runs, the achievements collected across all of them, and the
// posting profile. A SECOND localStorage key, deliberately, and the separation is the decision
// (PRD §3.2) rather than tidiness.
//
// saveLoad.js holds `idle-base-save-v1` and clearSave() removes it. Clearing the save is one of
// the two ways a run ENDS (PRD §3.7) — so a career record living inside the save would be deleted
// by the very act that completes the run worth recording. Nothing here is ever touched by
// clearSave(), and that is the property to preserve if either file is refactored.
//
// ITS OWN VERSION, NOT saveLoad's. The two files version independently because they answer to
// different pressures: the save's shape follows the simulation and was already wiped once
// deliberately (odyssey design, "Save compatibility"), while this holds a player's history and
// should outlive several of those. Reading a mismatched version here returns the empty career
// rather than throwing, for the same reason the game tolerates an absent slice: a player whose
// history cannot be read should still be able to play.
const STORAGE_KEY = 'idle-base-records-v1';
const CURRENT_VERSION = 1;

// The shape a fresh machine reads, and the shape every failure path answers with. Present-and-
// empty rather than null throughout, matching state/initialState.js's rule for collections the
// callers dereference unconditionally.
function emptyRecords() {
  return {
    version: CURRENT_VERSION,
    // Completed run cards, promoted by STORY-044. Unordered here — ranking is a read-time
    // question and engine/score.js owns it (PRD §3.3: the score is derived, never stored).
    runs: [],
    // Achievement ids earned across every run. Career-scoped and never taken away (PRD §3.2),
    // which is exactly what state.achievements is NOT — that one is per-run.
    achievements: [],
    // Who this machine posts as (PRD §3.1/§4). `playerUuid` is generated once and is the stable
    // identity handed to the leaderboard's identify call; `displayName` is the mutable label the
    // board shows; `aliasId` is what that call gives back. Absent `aliasId` is not an error — it
    // means identify has not run yet, and the posting path runs it.
    profile: { displayName: '', playerUuid: null, aliasId: null, postedRunIds: [] },
  };
}

// Defaulted field by field rather than spread over `emptyRecords()`, because the failure this
// guards is a HAND-EDITED or half-written key, not just an absent one. A `runs` that parsed as a
// string would survive a spread and break every reader downstream.
function normalizeRecords(parsed) {
  const empty = emptyRecords();
  if (!parsed || typeof parsed !== 'object') return empty;
  const profile = (parsed.profile && typeof parsed.profile === 'object') ? parsed.profile : {};
  return {
    version: CURRENT_VERSION,
    runs: Array.isArray(parsed.runs) ? parsed.runs : empty.runs,
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : empty.achievements,
    profile: {
      displayName: typeof profile.displayName === 'string' ? profile.displayName : '',
      playerUuid: typeof profile.playerUuid === 'string' ? profile.playerUuid : null,
      aliasId: typeof profile.aliasId === 'string' ? profile.aliasId : null,
      postedRunIds: Array.isArray(profile.postedRunIds) ? profile.postedRunIds : [],
    },
  };
}

// Never throws and never returns null: a career that cannot be read is an EMPTY career, because
// the alternative is a records screen that crashes the app it is a footnote to. Same try/catch and
// console.warn shape as saveLoad.js — one rule for reading localStorage in this repo, not two.
//
// A version mismatch reads as empty rather than being migrated, matching saveLoad.js's stance.
// Unlike the save, though, nothing here is DELETED on mismatch: the raw key is left alone so a
// future version can still choose to read it.
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRecords();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CURRENT_VERSION) {
      console.warn('Records missing or version mismatch, starting an empty career');
      return emptyRecords();
    }
    return normalizeRecords(parsed);
  } catch (err) {
    console.warn('Failed to load records', err);
    return emptyRecords();
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRecords(records)));
  } catch (err) {
    console.warn('Failed to save records', err);
  }
}

// Separate from saveLoad.js's clearSave() and never called by it. Clearing the save ends a run;
// clearing the career throws away every run there has ever been, which is a different decision
// and needs its own deliberate press.
function clearRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear records', err);
  }
}

module.exports = {
  STORAGE_KEY,
  CURRENT_VERSION,
  emptyRecords,
  normalizeRecords,
  loadRecords,
  saveRecords,
  clearRecords,
};
