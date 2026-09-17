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

export function appendLog(entry) {
  let log = [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) log = p; }
  } catch {}
  log.push({ ...entry, timestamp: Date.now() });
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
