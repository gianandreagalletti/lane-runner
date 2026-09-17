import { createInitialState } from '../sim/state.js';
import { step } from '../sim/step.js';
import { TRACK_1 } from '../src/track.js';
import { CENTI_SCALE, REACTIVE_WINDOW_TICKS } from '../sim/rules.js';

const matchConfig = {
  trackId: 'track_1',
  seed: 42,
  mode: '1p',
  rules: {},
  players: [{
    slot: 0,
    profileId: 'p1',
    inputSource: 'local_keyboard',
    loadout: {
      passives: { ice_grip: 2, water_shield: 2, quick_step: 1 },
      actives:  { rock_break: 3, sprint: 0, phase: 0 }
    }
  }]
};

// Verify MatchConfig round-trips through JSON
const rt = JSON.parse(JSON.stringify(matchConfig));
if (JSON.stringify(rt) !== JSON.stringify(matchConfig)) {
  console.error('MatchConfig JSON round-trip FAILED'); process.exit(1);
}
console.log('MatchConfig round-trip: OK');

let state = createInitialState(matchConfig, TRACK_1);
const SAFETY = 20000;

// Simple AI: look ahead and switch lanes to avoid rocks; use rock_break in reactive window
let lastLane = 1;
while (!state.ended && state.tick < SAFETY) {
  const ps = state.players[0];
  const intents = [];

  if (ps.gs === 'RUNNING') {
    // Look ahead for obstacles in current lane within next ~500cu
    const LOOK_AHEAD = 500 * CENTI_SCALE;
    const pos = ps.trackPosition;
    const lane = ps.lane;

    // Find next rock in current lane
    const nextRock = state.obstacles.find(o =>
      !o.hitByPlayer[0] && o.type === 'rock' && o.lane === lane &&
      o.distanceScaled > pos && o.distanceScaled - pos < LOOK_AHEAD
    );
    if (nextRock) {
      // Try to find a clear adjacent lane
      const tryLanes = lane === 0 ? [1, 2] : lane === 2 ? [1, 0] : [0, 2];
      for (const tl of tryLanes) {
        const blocked = state.obstacles.some(o =>
          !o.hitByPlayer[0] && o.type === 'rock' && o.lane === tl &&
          o.distanceScaled > pos && o.distanceScaled - pos < LOOK_AHEAD
        );
        if (!blocked) {
          if (tl < lane) intents.push({ tick: state.tick, playerSlot: 0, type: 'lane_left' });
          else           intents.push({ tick: state.tick, playerSlot: 0, type: 'lane_right' });
          break;
        }
      }
    }
  } else if (ps.gs === 'REACTIVE') {
    // Use rock_break (slot 0) if available
    if (ps.slots[0] && ps.slots[0].uses > 0) {
      intents.push({ tick: state.tick, playerSlot: 0, type: 'boost_down', slot: 0 });
    }
  }

  state = step(state, intents);
}

const ps = state.players[0];
const dist = Math.floor(ps.trackPosition / CENTI_SCALE);
const endTick = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
const secs = (endTick / 60).toFixed(1);
console.log(`Outcome: ${ps.gs}  distance: ${dist}/${TRACK_1.length}  ticks: ${endTick}  (~${secs}s)`);
if (state.tick >= SAFETY) console.warn('Safety limit reached');
