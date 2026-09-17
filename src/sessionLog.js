const LOG_KEY    = 'laneRunner.log';
const REPLAY_KEY = 'laneRunner.lastReplay';

export function saveReplay(matchConfig, intents, outcome) {
  try { localStorage.setItem(REPLAY_KEY, JSON.stringify({ matchConfig, intents, originalOutcome: outcome })); } catch {}
}

export function loadReplay() {
  try {
    const raw = localStorage.getItem(REPLAY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Normalise a loadout to the new object format for logging.
// Accepts both new { passives, actives } and legacy array formats.
function _normaliseLoadout(loadout) {
  if (!loadout) return loadout;
  if (!Array.isArray(loadout)) {
    // Already new format — attach pointsSpent if not present
    if (loadout.pointsSpent) return loadout;
    return { ...loadout, pointsSpent: { passive: 0, active: 0 } };
  }
  // Legacy array: best-effort conversion (no level info)
  const passives = { ice_grip: 0, water_shield: 0, quick_step: 0 };
  const actives  = { rock_break: 0, sprint: 0, phase: 0 };
  for (const id of loadout) {
    if (id in passives) passives[id] = 1;
    if (id in actives)  actives[id]  = 1;
  }
  return { passives, actives, pointsSpent: { passive: 0, active: 0 } };
}

export function appendLog(entry) {
  let log = [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) log = p; }
  } catch {}
  // Normalise loadout field(s) in the entry
  const normalised = { ...entry };
  if (normalised.loadout) normalised.loadout = _normaliseLoadout(normalised.loadout);
  if (normalised.players) {
    normalised.players = normalised.players.map(p =>
      p.loadout ? { ...p, loadout: _normaliseLoadout(p.loadout) } : p
    );
  }
  log.push({ ...normalised, timestamp: Date.now() });
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch {}
}

export function getLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function exportLog() {
  const log = getLog();
  const json = JSON.stringify(log, null, 2);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(json).catch(() => _fallbackExport(json));
  } else {
    _fallbackExport(json);
  }
  return log.length;
}

function _fallbackExport(json) {
  const a = document.createElement('a');
  a.href = 'data:application/json,' + encodeURIComponent(json);
  a.download = 'lane-runner-log.json';
  a.click();
}
