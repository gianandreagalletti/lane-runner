import { createInitialState } from '../sim/state.js';
import { step } from '../sim/step.js';
import { TRACK_1 } from '../src/track.js';
import { POSITION_SCALE } from '../sim/rules.js';

const matchConfig = {
  trackId: 'track_1',
  seed: 42,
  mode: '1p',
  rules: {},
  players: [{ slot: 0, profileId: 'p1', inputSource: 'local_keyboard', loadout: ['ice_grip', 'water_shield', 'rock_break'] }]
};

// Verify MatchConfig round-trips through JSON
const rt = JSON.parse(JSON.stringify(matchConfig));
if (JSON.stringify(rt) !== JSON.stringify(matchConfig)) {
  console.error('MatchConfig JSON round-trip FAILED'); process.exit(1);
}
console.log('MatchConfig round-trip: OK');

let state = createInitialState(matchConfig, TRACK_1);
const SAFETY = 20000;

while (!state.ended && state.tick < SAFETY) {
  state = step(state, []);
}

const ps = state.players[0];
const dist = Math.floor(ps.trackPosition / POSITION_SCALE);
const endTick = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
const secs = (endTick / 60).toFixed(1);
console.log(`Outcome: ${ps.gs}  distance: ${dist}/${TRACK_1.length}  ticks: ${state.tick}  (~${secs}s)`);
if (state.tick >= SAFETY) console.warn('Safety limit reached');
