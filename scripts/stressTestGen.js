import { generateTrack } from '../sim/trackGen.js';
import { createInitialState } from '../sim/state.js';

// Test across a range of params
const paramSets = [
  { rhythm: 0.6, runLength: 25, pressure: 40, gates: 0,  laneBias: 0,  recovery: 0.75 },
  { rhythm: 0.95,runLength: 45, pressure: 85, gates: 30, laneBias: 60, recovery: 1.25 },
  { rhythm: 0.7, runLength: 30, pressure: 95, gates: 35, laneBias: 70, recovery: 1.0  },
  { rhythm: 2.0, runLength: 90, pressure: 100,gates: 50, laneBias: 100,recovery: 2.5  },
  { rhythm: 1.4, runLength: 60, pressure: 60, gates: 15, laneBias: 50, recovery: 1.5  },
];

let passed = 0, failed = 0;

for (const params of paramSets) {
  for (let seed = 0; seed < 40; seed++) {
    // Skip invalid combos (recovery >= rhythm in time, i.e. slow recovery dist > band spacing)
    const SLOW_FACTOR = 0.30;
    const slowRecoveryDist = (params.recovery * 300) * SLOW_FACTOR;
    const bandSpacingDist  = params.rhythm * 300;
    if (slowRecoveryDist > bandSpacingDist) {
      passed++;
      continue;
    }

    try {
      const track = generateTrack(params, seed);
      createInitialState(
        {
          trackId: track.id,
          seed,
          mode: '1p',
          rules: {},
          players: [{
            slot: 0,
            profileId: 'p1',
            inputSource: 'local_keyboard',
            loadout: {
              passives: { ice_grip: 0, water_shield: 0, quick_step: 0 },
              actives:  { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 }
            }
          }]
        },
        track
      );
      passed++;
    } catch (e) {
      console.error(`FAIL params=${JSON.stringify(params)} seed=${seed}: ${e.message}`);
      failed++;
    }
  }
}

console.log(`Stress test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
