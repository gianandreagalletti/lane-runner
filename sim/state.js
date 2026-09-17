import { BOOSTS } from '../src/boosts.js';
import { POSITION_SCALE } from './rules.js';

export function createInitialState(matchConfig, trackData) {
  const obstacles = trackData.obstacles.map(o => ({
    lane:            o.lane,
    distanceScaled:  o.distance * POSITION_SCALE,
    type:            o.type,
    hitByPlayer:     [false, false],
    pendingByPlayer: [false, false]
  }));

  const players = matchConfig.players.map(pc => {
    const loadout = pc.loadout;
    const slots = loadout.map(id => {
      const b = BOOSTS[id];
      return {
        id,
        uses:       b.type === 'active' ? b.usesPerRun : null,
        isActive:   b.type === 'active',
        isReactive: b.type === 'active' ? b.reactive : false
      };
    });
    return {
      idx:                pc.slot,
      lane:               1,
      trackPosition:      0,
      gs:                 'RUNNING',
      sprintTicksLeft:    0,
      debuffType:         null,
      debuffTicksLeft:    0,
      flashTicksLeft:     0,
      loadout:            [...loadout],
      boostSet:           [...loadout],
      slots,
      boostUseCount:      Object.fromEntries(loadout.map(id => [id, 0])),
      laneTimeTicks:      [0, 0, 0],
      reactiveTicksLeft:  0,
      reactiveObsIdx:     -1,
      boostPressTimer:    [0, 0, 0],
      boostKeyHeld:       [false, false, false],
      startTick:          0,
      gsEndTick:          -1,
      laneVisualFrom:     1,
      laneVisualTicksLeft: 0,
      drawAlpha:          1.0,
      drawAlphaTicksLeft: 0
    };
  });

  return {
    tick:              0,
    mode:              matchConfig.mode,
    trackLength:       trackData.length * POSITION_SCALE,
    obstacles,
    players,
    camPositionScaled: 0,
    ended:             false,
    events:            [],
    rngSeed:           matchConfig.seed
  };
}
