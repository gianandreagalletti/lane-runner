// src/TrackStore.js
const LS_KEY = 'lr_authored_tracks';

function _load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function _save(tracks) { localStorage.setItem(LS_KEY, JSON.stringify(tracks)); }

export function getAllTracks() { return _load(); }

export function saveTrack(trackData) {
  const tracks = _load();
  const idx = tracks.findIndex(t => t.id === trackData.id);
  if (idx >= 0) tracks[idx] = trackData; else tracks.push(trackData);
  _save(tracks);
}

export function deleteTrack(id) { _save(_load().filter(t => t.id !== id)); }

export function computeEstimate(obstacles, trackLength) {
  const bandMap = new Map();
  for (const obs of obstacles) {
    if (!bandMap.has(obs.distance)) bandMap.set(obs.distance, new Set());
    bandMap.get(obs.distance).add(obs.lane);
  }
  const total = bandMap.size;
  let damage = 0;
  for (const lanes of bandMap.values()) if (lanes.size === 3) damage++;
  const pressureFrac = total > 0 ? damage / total : 0;
  const avgHazardFactor = 0.65;
  const estimatedAvgSpeed = Math.max(150, Math.round(300 * (1 - pressureFrac * (1 - avgHazardFactor))));
  const estimatedDuration = Math.round(trackLength / estimatedAvgSpeed);
  return { estimatedAvgSpeed, estimatedDuration };
}
