import { makeRng } from './rng.js';

// Fisher-Yates shuffle — deterministic, no sort() trick
function shuffle(arr, randFloat) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randFloat() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateTrack(params, seed) {
  const { rhythm, runLength, pressure, gates, laneBias, recovery } = params;

  // Validate recovery vs rhythm
  // Worst-case: water debuff, no shield → 30% speed factor
  const SLOW_FACTOR = 0.30;
  const slowRecoveryDist = (recovery * 300) * SLOW_FACTOR; // distance covered while slowed
  if (slowRecoveryDist > rhythm * 300) {
    throw new Error(
      `Recovery (${recovery}s) is too long for rhythm (${rhythm}s) — a slowed player ` +
      `would travel only ${slowRecoveryDist.toFixed(1)} units while slowed, but band spacing is ${(rhythm * 300).toFixed(1)} units.`
    );
  }

  const rng = makeRng(seed);
  const randFloat = () => rng.next();

  // Estimate track length
  // Calibration: Standard preset (85% pressure, 30% gates) → avg ~221 units/s
  const pressureFrac = pressure / 100;
  const avgHazardFactor = 0.65; // rough average of ice (0.50) and water (0.30) with passives
  const estimatedAvgSpeed = Math.max(150, Math.round(300 * (1 - pressureFrac * (1 - avgHazardFactor))));
  const trackLengthUnits = Math.round(runLength * estimatedAvgSpeed);

  // Generate band positions
  const bands = [];
  let z = 300; // first band starts at 300 units
  while (z < trackLengthUnits - 300) {
    // Vary spacing: use rng to perturb around rhythm*300, min 240
    const spacing = Math.max(240, Math.round((rhythm * 300) * (0.75 + randFloat() * 0.5)));
    bands.push({ z });
    z += spacing;
  }

  if (bands.length === 0) {
    // Degenerate case: very short track, add at least one band
    bands.push({ z: 300 });
  }

  // Assign band kinds
  const gateFrac = gates / 100;
  const pressureFraction = pressure / 100;

  let lastGateZ = -10000;

  // Count relief bands needed: at least 1 per quarter
  const quarterSize = Math.max(1, bands.length / 4);
  const reliefPositions = new Set();
  for (let q = 0; q < 4; q++) {
    const start = Math.floor(q * quarterSize);
    const end = Math.min(Math.floor((q + 1) * quarterSize) - 1, bands.length - 1);
    if (start <= end) {
      const pick = start + Math.floor(randFloat() * (end - start + 1));
      reliefPositions.add(Math.min(pick, bands.length - 1));
    }
  }

  const bandData = [];
  for (let i = 0; i < bands.length; i++) {
    const { z } = bands[i];

    let kind;
    if (reliefPositions.has(i)) {
      kind = 'relief';
    } else {
      const canBeGate = (z - lastGateZ) >= 800 && gateFrac > 0;
      const r = randFloat();
      if (canBeGate && r < gateFrac) {
        kind = 'gate';
      } else if (randFloat() < pressureFraction) {
        kind = 'damage';
      } else {
        kind = 'relief';
      }
    }

    bandData.push({ z, kind });
    if (kind === 'gate') {
      lastGateZ = z;
    }
  }

  // Post-pass: ensure gate count is not too low
  const targetGateCount = Math.max(1, Math.floor(gateFrac * bands.length));
  const actualGates = bandData.filter(b => b.kind === 'gate').length;

  if (actualGates < targetGateCount) {
    // Rebuild gate positions tracking to fix up
    let lastGateZFix = -10000;
    const gateZsFix = [];
    for (const b of bandData) {
      if (b.kind === 'gate') {
        gateZsFix.push(b.z);
        lastGateZFix = b.z;
      }
    }

    // Try converting damage bands to gates to reach target
    let gateFixes = 0;
    let lastFixedZ = lastGateZFix;

    // Build a sorted list of existing gate z positions for constraint checking
    const existingGateZs = new Set(bandData.filter(b => b.kind === 'gate').map(b => b.z));

    for (let i = 0; i < bandData.length && gateFixes < (targetGateCount - actualGates); i++) {
      const b = bandData[i];
      if (b.kind !== 'damage') continue;

      // Check spacing constraint vs all existing gates
      let ok = true;
      for (const gz of existingGateZs) {
        if (Math.abs(b.z - gz) < 800) { ok = false; break; }
      }
      if (!ok) continue;

      b.kind = 'gate';
      existingGateZs.add(b.z);
      gateFixes++;
    }
  }

  // Build obstacles from bands
  const obstacles = [];
  let prevGateOpenLane = 1;

  // Lane hazard bias: at laneBias=0, random; at laneBias=100, lane has fixed preferred type
  const lanePreferredType = [0, 1, 2].map(() => randFloat() < 0.5 ? 'ice' : 'water');

  // We need two passes for gates: first determine all open lanes, then build
  // Build gate open lanes in sequence (respecting consecutive gate constraint)
  const gateOpenLanes = new Map(); // z -> openLane
  let prevOpen = 1;
  for (const { z, kind } of bandData) {
    if (kind !== 'gate') continue;
    const possibleOpen = [prevOpen - 1, prevOpen, prevOpen + 1].filter(l => l >= 0 && l <= 2);
    const openLane = possibleOpen[Math.floor(randFloat() * possibleOpen.length)];
    gateOpenLanes.set(z, openLane);
    prevOpen = openLane;
  }

  for (const { z, kind } of bandData) {
    if (kind === 'damage') {
      // All 3 lanes occupied with ice/water
      for (let lane = 0; lane < 3; lane++) {
        const usePreferred = randFloat() < (laneBias / 100);
        const type = usePreferred ? lanePreferredType[lane] : (randFloat() < 0.5 ? 'ice' : 'water');
        obstacles.push({ lane, distance: z, type });
      }
    } else if (kind === 'gate') {
      const openLane = gateOpenLanes.get(z);
      // Place rocks in the other 2 lanes
      for (let lane = 0; lane < 3; lane++) {
        if (lane === openLane) continue;
        obstacles.push({ lane, distance: z, type: 'rock' });
      }
      // Place non-lethal in open lane
      const usePreferred = randFloat() < (laneBias / 100);
      const type = usePreferred ? lanePreferredType[openLane] : (randFloat() < 0.5 ? 'ice' : 'water');
      obstacles.push({ lane: openLane, distance: z, type });
    } else {
      // Relief: 1-2 lanes occupied, at least 1 clear
      const numObs = 1 + Math.floor(randFloat() * 2); // 1 or 2
      const allLanes = shuffle([0, 1, 2], randFloat);
      const lanesToFill = allLanes.slice(0, numObs);

      for (const lane of lanesToFill) {
        const usePreferred = randFloat() < (laneBias / 100);
        const type = usePreferred ? lanePreferredType[lane] : (randFloat() < 0.5 ? 'ice' : 'water');
        obstacles.push({ lane, distance: z, type });
      }
    }
  }

  // Sort obstacles by distance
  obstacles.sort((a, b) => a.distance - b.distance);

  // Generate pickups (~5 caltrop_pickup, ~5 snipe_pickup)
  const pickups = [];
  const occupiedAtDist = new Map();
  for (const obs of obstacles) {
    if (!occupiedAtDist.has(obs.distance)) occupiedAtDist.set(obs.distance, new Set());
    occupiedAtDist.get(obs.distance).add(obs.lane);
  }

  const pickupTypes = ['caltrop_pickup', 'snipe_pickup'];
  for (const type of pickupTypes) {
    let placed = 0;
    let attempts = 0;
    while (placed < 5 && attempts < 100) {
      attempts++;
      const pz = 400 + Math.floor(randFloat() * (trackLengthUnits - 800));
      const lane = Math.floor(randFloat() * 3);

      // Check: is this at the only clear lane of a hazard band?
      const nearDists = [];
      for (const d of occupiedAtDist.keys()) {
        if (Math.abs(d - pz) < 120) nearDists.push(d);
      }
      let isBait = false;
      for (const d of nearDists) {
        const occupied = occupiedAtDist.get(d);
        if (occupied.size === 2 && !occupied.has(lane)) {
          isBait = true;
          break;
        }
      }
      if (isBait) continue;

      // Check not too close to another pickup
      if (pickups.some(p => Math.abs(p.distance - pz) < 300)) continue;

      pickups.push({ lane, distance: pz, type });
      placed++;
    }
  }

  const trackId = `gen_${seed}`;
  const trackData = {
    id:              trackId,
    name:            `Generated Track (seed ${seed})`,
    length:          trackLengthUnits,
    obstacles,
    pickups,
    debuffTicks:     Math.round(recovery * 60), // recovery param → ticks
    isGenerated:     true,
    params:          { ...params },
    seed,
    estimatedAvgSpeed,
    estimatedDuration: runLength,
  };

  return trackData;
}

export const PRESETS = {
  Standard: { rhythm: 0.95, runLength: 45, pressure: 85, gates: 30, laneBias: 60, recovery: 1.25 },
  Calm:     { rhythm: 1.4,  runLength: 45, pressure: 60, gates: 15, laneBias: 50, recovery: 1.5  },
  Frantic:  { rhythm: 0.7,  runLength: 45, pressure: 95, gates: 35, laneBias: 70, recovery: 1.0  },
  Gauntlet: { rhythm: 0.9,  runLength: 45, pressure: 100, gates: 50, laneBias: 60, recovery: 1.25 },
};
