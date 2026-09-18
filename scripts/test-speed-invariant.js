/**
 * Invariant: Three players in the same lane, with no input, no boosts and no debuffs,
 * must advance by exactly the same distance every tick, for an entire track.
 *
 * Run with:  node scripts/test-speed-invariant.js
 *
 * Exit 0 = all assertions passed.
 * Exit 1 = at least one divergence detected.
 */

import { createInitialState } from '../sim/state.js';
import { step } from '../sim/step.js';
import { TRACK_1 } from '../src/track.js';
import { CENTI_SCALE } from '../sim/rules.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); failed++; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMatchConfig(numPlayers, loadout) {
  return {
    trackId: TRACK_1.id,
    seed: 1,
    mode: numPlayers === 1 ? '1p' : `${numPlayers}p`,
    rules: {},
    players: Array.from({ length: numPlayers }, (_, i) => ({
      slot: i,
      profileId: `p${i + 1}`,
      inputSource: 'local_keyboard',
      loadout: loadout ?? {
        passives: { ice_grip: 0, water_shield: 0, quick_step: 0 },
        actives:  { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 }
      }
    }))
  };
}

// ─── Test 1: 3 players, no boosts, same lane, no input — identical each tick ─

console.log('Test 1: 3-player no-input speed invariant');
{
  const config = makeMatchConfig(3);
  let state = createInitialState(config, TRACK_1);

  // Force all players to lane 1 (centre) with no debuffs
  state = {
    ...state,
    players: state.players.map(ps => ({
      ...ps,
      lane: 1,
      debuffType: null,
      debuffTicksLeft: 0,
      sprintTicksLeft: 0,
      draftFactor: 100
    }))
  };

  let divergedAt = -1;
  const TICKS = 600; // 10 seconds at 60 Hz

  for (let t = 0; t < TICKS; t++) {
    state = step(state, []); // no intents

    const running = state.players.filter(ps =>
      ps.gs === 'RUNNING' || ps.gs === 'COMPLETE'
    );
    if (running.length < 2) break; // track finished

    const refPos = running[0].trackPosition;
    for (let i = 1; i < running.length; i++) {
      if (running[i].trackPosition !== refPos) {
        if (divergedAt < 0) divergedAt = t;
        // Only report first divergence to avoid flood
        if (t === divergedAt) {
          console.error(
            `  Tick ${t}: p0=${refPos}  p${i}=${running[i].trackPosition}` +
            `  diff=${running[i].trackPosition - refPos} cu`
          );
        }
      }
    }
  }

  assert(divergedAt < 0, `Players diverged at tick ${divergedAt}`);
  if (divergedAt < 0) console.log('  PASS — all players advanced identically for 600 ticks');
}

// ─── Test 2: debugSlowSlots must have no effect in this (non-dev) environment ─

console.log('Test 2: debugSlowSlots absent from production-equivalent path');
{
  const config = makeMatchConfig(3);
  let state = createInitialState(config, TRACK_1);
  // Simulate what a stale debug flag would have done before the fix
  state.debugSlowSlots = [1, 2];

  state = {
    ...state,
    players: state.players.map(ps => ({
      ...ps, lane: 1, debuffType: null, debuffTicksLeft: 0,
      sprintTicksLeft: 0, draftFactor: 100
    }))
  };

  // Run one tick and check positions
  state = step(state, []);
  const running = state.players.filter(ps => ps.gs === 'RUNNING' || ps.gs === 'COMPLETE');
  if (running.length >= 2) {
    const refPos = running[0].trackPosition;
    let penaltyActive = false;
    for (let i = 1; i < running.length; i++) {
      if (running[i].trackPosition !== refPos) penaltyActive = true;
    }
    assert(!penaltyActive,
      'debugSlowSlots produced a speed divergence — _DEV guard is not working in this environment');
    if (!penaltyActive) console.log('  PASS — debugSlowSlots has no effect when _DEV=false');
  }
}

// ─── Test 3: slot index is irrelevant — all 3 slots advance identically ──────

console.log('Test 3: slot 0 / slot 1 / slot 2 identical speed, no boosts');
{
  // Run 3 separate 1-player games (one per slot index 0, 1, 2) and compare
  const positions = [];
  for (let slot = 0; slot < 3; slot++) {
    const config = {
      trackId: TRACK_1.id, seed: 1, mode: '1p', rules: {},
      players: [{ slot, profileId: `p${slot}`, inputSource: 'local_keyboard',
        loadout: { passives: { ice_grip: 0, water_shield: 0, quick_step: 0 },
                   actives:  { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 } }
      }]
    };
    let state = createInitialState(config, TRACK_1);
    // Run 300 ticks with no intents, steering around nothing
    for (let t = 0; t < 300; t++) state = step(state, []);
    positions.push(state.players[0].trackPosition);
  }
  assert(
    positions[0] === positions[1] && positions[1] === positions[2],
    `Slot positions diverged after 300 ticks: slot0=${positions[0]} slot1=${positions[1]} slot2=${positions[2]}`
  );
  if (positions[0] === positions[1] && positions[1] === positions[2]) {
    console.log(`  PASS — all three slot indices reached ${positions[0]} cu identically`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

if (failed === 0) {
  console.log('\nAll tests passed.');
  process.exit(0);
} else {
  console.error(`\n${failed} test(s) FAILED.`);
  process.exit(1);
}
