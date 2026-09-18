import { BOOSTS, BOOST_CONFIG } from '../src/boosts.js';
import { CENTI_SCALE, LANE_SWITCH_TICKS, PICKUP_TYPES, ICE_DEBUFF_TICKS } from './rules.js';
import { validateBandList } from './validateTrack.js';

// Fixed canonical slot mapping (always in this order regardless of charges bought)
// Slot 0: rock_break, Slot 1: sprint, Slot 2: caltrop, Slot 3: snipe_shot
// BENCHED: phase — was Slot 2, removed from canonical slots
const CANONICAL_SLOTS = ['rock_break', 'sprint', 'caltrop', 'snipe_shot'];

// Verify all track band invariants (delegates to shared validateBandList)
function assertTrackValid(trackData) {
  // Round distances to nearest 10 to match original grouping tolerance
  const roundedObs = trackData.obstacles.map(o => ({
    ...o, distance: Math.round(o.distance / 10) * 10
  }));
  const roundedPu = (trackData.pickups || []).map(p => ({
    ...p, distance: Math.round(p.distance / 10) * 10
  }));
  const violations = validateBandList(roundedObs, roundedPu, trackData.length);
  if (violations.length > 0) {
    throw new Error(`Track ${trackData.id}: ${violations[0].message}`);
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
    debugSlowSlots:    [],
    debuffTicks:       trackData.debuffTicks ?? ICE_DEBUFF_TICKS
  };
}
