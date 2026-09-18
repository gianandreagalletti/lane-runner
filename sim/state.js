import { BOOSTS, BOOST_CONFIG } from '../src/boosts.js';
import { CENTI_SCALE, LANE_SWITCH_TICKS, PICKUP_TYPES } from './rules.js';

// Fixed canonical slot mapping (always in this order regardless of charges bought)
// Slot 0: rock_break, Slot 1: sprint, Slot 2: caltrop, Slot 3: snipe_shot
// BENCHED: phase — was Slot 2, removed from canonical slots
const CANONICAL_SLOTS = ['rock_break', 'sprint', 'caltrop', 'snipe_shot'];

// Verify all track band invariants (5 rules)
function assertTrackValid(trackData) {
  const td = trackData;

  // Group obstacles by distance (exact match — each band uses one distance value)
  const bandMap = new Map();
  for (const obs of td.obstacles) {
    const bandKey = Math.round(obs.distance / 10) * 10; // round to nearest 10
    if (!bandMap.has(bandKey)) bandMap.set(bandKey, []);
    bandMap.get(bandKey).push(obs);
  }

  for (const [dist, obs] of bandMap) {
    const rocks = obs.filter(o => o.type === 'rock');

    // Rule 1: no 3 rocks in same band (original constraint, kept for clarity)
    const rockLanes = new Set(rocks.map(o => o.lane));
    if (rockLanes.size === 3) {
      throw new Error(`Track ${td.id}: band at ${dist} has rocks in all 3 lanes`);
    }

    // Rule 2: rocks only in gate bands (must be exactly 2 rocks if any rocks present)
    if (rocks.length > 0 && rocks.length !== 2) {
      throw new Error(
        `Track ${td.id}: band at ${dist} has ${rocks.length} rock(s) — must be exactly 2 (gate band) or 0`
      );
    }
    // Rule 3: gate must have a non-rock obstacle (the passable-lane hazard)
    if (rocks.length === 2) {
      const nonRock = obs.filter(o => o.type !== 'rock');
      if (nonRock.length === 0) {
        throw new Error(`Track ${td.id}: gate band at ${dist} has no non-rock obstacle`);
      }
    }
  }

  // Rule 4: consecutive gates >= 800 units apart
  const gateBands = [...bandMap.entries()]
    .filter(([, obs]) => obs.some(o => o.type === 'rock'))
    .map(([dist]) => dist)
    .sort((a, b) => a - b);

  for (let i = 1; i < gateBands.length; i++) {
    if (gateBands[i] - gateBands[i - 1] < 800) {
      throw new Error(
        `Track ${td.id}: gates at ${gateBands[i - 1]} and ${gateBands[i]} are only ` +
        `${gateBands[i] - gateBands[i - 1]} units apart (min 800)`
      );
    }
  }

  // Rule 5: open lanes differ by at most 1 between consecutive gates
  for (let i = 1; i < gateBands.length; i++) {
    const prev = bandMap.get(gateBands[i - 1]);
    const curr = bandMap.get(gateBands[i]);
    const prevRockLanes = new Set(prev.filter(o => o.type === 'rock').map(o => o.lane));
    const currRockLanes = new Set(curr.filter(o => o.type === 'rock').map(o => o.lane));
    const prevOpen = [0, 1, 2].find(l => !prevRockLanes.has(l));
    const currOpen = [0, 1, 2].find(l => !currRockLanes.has(l));
    if (Math.abs(currOpen - prevOpen) > 1) {
      throw new Error(
        `Track ${td.id}: gates at ${gateBands[i - 1]} (open:${prevOpen}) and ` +
        `${gateBands[i]} (open:${currOpen}) require a 2-lane jump`
      );
    }
  }
}

// Get quick_step lane switch ticks from loadout
function _getQuickStepTicks(loadout) {
  const level = loadout.passives?.quick_step ?? 0;
  if (level >= 2) return BOOST_CONFIG.passives.quick_step.levels[1].ticks; // 0
  if (level >= 1) return BOOST_CONFIG.passives.quick_step.levels[0].ticks; // 5
  return BOOST_CONFIG.passives.quick_step.baseTicks; // 9 = LANE_SWITCH_TICKS
}

export function createInitialState(matchConfig, trackData) {
  // Validate track: enforce all 5 band rules
  assertTrackValid(trackData);

  const numPlayers = matchConfig.players.length;
  const obstacles = trackData.obstacles.map(o => ({
    lane:            o.lane,
    distanceScaled:  o.distance * CENTI_SCALE,
    type:            o.type,
    hitByPlayer:     new Array(numPlayers).fill(false),
    pendingByPlayer: new Array(numPlayers).fill(false)
  }));

  const pickups = (trackData.pickups || []).map(p => ({
    lane:            p.lane,
    distanceScaled:  p.distance * CENTI_SCALE,
    type:            p.type,                              // 'caltrop_pickup' | 'snipe_pickup'
    collectedByPlayer: new Array(numPlayers).fill(false)
  }));

  const players = matchConfig.players.map(pc => {
    const loadout = pc.loadout;

    // Support both old array format (legacy) and new object format
    let passives, actives;
    if (Array.isArray(loadout)) {
      // Legacy: convert array to object format
      passives = { ice_grip: 0, water_shield: 0, quick_step: 0 };
      actives  = { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 };
      for (const id of loadout) {
        const b = BOOSTS[id];
        if (!b) continue;
        if (b.type === 'passive') passives[id] = 1;
        else if (b.type === 'active') actives[id] = (BOOSTS[id].usesPerRun ?? 1);
      }
    } else {
      passives = { ...loadout.passives };
      actives  = { ...loadout.actives };
    }

    // Build canonical slots (rock_break=0, sprint=1, caltrop=2, snipe_shot=3)
    // BENCHED: phase was slot 2 — removed from canonical slots
    const slots = CANONICAL_SLOTS.map(id => {
      const charges = actives[id] ?? 0;
      return {
        id,
        uses:       charges,
        isActive:   true,
        isReactive: id === 'rock_break' // only rock_break is reactive
      };
    });

    const quickStepTicks = _getQuickStepTicks({ passives });

    return {
      idx:                pc.slot,
      lane:               1,
      trackPosition:      0,
      gs:                 'RUNNING',
      sprintTicksLeft:    0,
      debuffType:         null,
      debuffTicksLeft:    0,
      flashTicksLeft:     0,
      loadout:            { passives: { ...passives }, actives: { ...actives } },
      passives,
      actives,
      slots,
      boostUseCount:      { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 },
      quickStepTicks,     // cached ticks for lane switch
      laneTimeTicks:      [0, 0, 0],
      reactiveTicksLeft:  0,
      reactiveObsIdx:     -1,
      boostPressTimer:    [0, 0, 0, 0],
      boostKeyHeld:       [false, false, false, false],
      startTick:          0,
      gsEndTick:          -1,
      laneVisualFrom:     1,
      laneVisualTicksLeft: 0,
      drawAlpha:          1.0,
      drawAlphaTicksLeft: 0,
      isDrafting:         false,
      draftFactor:        100,
      // BENCHED: phase activation state — kept commented for reference
      // phaseActive:     false,
      // phasePendingObsIdx: -1
    };
  });

  return {
    tick:              0,
    mode:              matchConfig.mode,
    trackLength:       trackData.length * CENTI_SCALE,
    numPlayers,
    obstacles,
    pickups,
    projectiles:       [],
    players,
    camPositionScaled: 0,
    ended:             false,
    events:            [],
    rngSeed:           matchConfig.seed,
    debugSlowSlots:    []
  };
}
