// sim/validateTrack.js
// Shared band-list validator — used by state.js (throws on fail) and ConfigScene editor (shows list).
// Returns [{rule, bandDist, message}]. Never throws.
export function validateBandList(obstacles, pickups = [], trackLength = 0) {
  const violations = [];

  // Build band map (exact distance)
  const bandMap = new Map();
  for (const obs of obstacles) {
    if (!bandMap.has(obs.distance)) bandMap.set(obs.distance, []);
    bandMap.get(obs.distance).push(obs);
  }
  const sortedDists = [...bandMap.keys()].sort((a, b) => a - b);

  // R1 + R2: 3 rocks = impassable; 2 rocks = gate (must have non-rock hazard); 1 rock = single-lane obstacle (no gate rules)
  for (const dist of sortedDists) {
    const obs = bandMap.get(dist);
    const rocks = obs.filter(o => o.type === 'rock');
    if (rocks.length === 3) {
      violations.push({ rule: 'rock_count', bandDist: dist,
        message: `Band @${dist}: all three lanes have guard rails` });
    }
    if (rocks.length === 2) {
      const nonRock = obs.filter(o => o.type !== 'rock');
      if (nonRock.length === 0) {
        violations.push({ rule: 'gate_no_hazard', bandDist: dist,
          message: `Gate @${dist}: open lane missing hazard (ice or water)` });
      }
    }
  }

  // R3: consecutive gates >= 800u apart
  const gateDists = sortedDists.filter(d => bandMap.get(d).filter(o => o.type === 'rock').length === 2);
  for (let i = 1; i < gateDists.length; i++) {
    const gap = gateDists[i] - gateDists[i - 1];
    if (gap < 800) {
      violations.push({ rule: 'gates_too_close', bandDist: gateDists[i],
        message: `Gates @${gateDists[i - 1]} and @${gateDists[i]}: ${gap}u apart (min 800)` });
    }
  }

  // R4: consecutive gate open-lane shift <= 1
  for (let i = 1; i < gateDists.length; i++) {
    const prev = bandMap.get(gateDists[i - 1]);
    const curr = bandMap.get(gateDists[i]);
    const prevRocks = new Set(prev.filter(o => o.type === 'rock').map(o => o.lane));
    const currRocks = new Set(curr.filter(o => o.type === 'rock').map(o => o.lane));
    if (prevRocks.size === 2 && currRocks.size === 2) {
      const prevOpen = [0, 1, 2].find(l => !prevRocks.has(l)) ?? 1;
      const currOpen = [0, 1, 2].find(l => !currRocks.has(l)) ?? 1;
      if (Math.abs(currOpen - prevOpen) > 1) {
        violations.push({ rule: 'gate_jump', bandDist: gateDists[i],
          message: `Gate @${gateDists[i - 1]} (L${prevOpen}) -> @${gateDists[i]} (L${currOpen}): 2-lane jump` });
      }
    }
  }

  // R5: pickup not in the only clear lane of a nearby hazard band
  for (const pu of pickups) {
    for (const [d, obs] of bandMap) {
      if (Math.abs(d - pu.distance) >= 120) continue;
      const occupied = new Set(obs.map(o => o.lane));
      if (occupied.size === 2 && !occupied.has(pu.lane)) {
        violations.push({ rule: 'pickup_bait', bandDist: d,
          message: `Pickup @${pu.distance} (L${pu.lane}) is in the only clear lane of band @${d}` });
      }
    }
  }

  // R6: >= 1 relief band per quarter (band with <3 lanes occupied = at least 1 clear lane)
  if (trackLength > 0 && sortedDists.length > 0) {
    const quarterSize = trackLength / 4;
    for (let q = 0; q < 4; q++) {
      const qStart = q * quarterSize;
      const qEnd = (q + 1) * quarterSize;
      const bandsInQ = sortedDists.filter(d => d >= qStart && d < qEnd);
      if (bandsInQ.length === 0) continue;
      const hasRelief = bandsInQ.some(d => {
        const lanes = new Set(bandMap.get(d).map(o => o.lane));
        return lanes.size < 3;
      });
      if (!hasRelief) {
        violations.push({ rule: 'no_relief', bandDist: null,
          message: `Quarter ${q + 1} (${Math.round(qStart)}-${Math.round(qEnd)}u) has no relief band` });
      }
    }
  }

  return violations;
}
