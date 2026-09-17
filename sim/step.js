import { BOOSTS, BOOST_CONFIG } from '../src/boosts.js';
import {
  REACTIVE_WINDOW_TICKS, PRESS_AHEAD_TICKS, SPRINT_TICKS,
  ICE_DEBUFF_TICKS, WATER_DEBUFF_TICKS, FLASH_TICKS,
  LANE_SWITCH_TICKS, PHASE_ALPHA_TICKS,
  BASE_SPEED_CU,
  GAP_ELIMINATION_CU, COL_HALF_Y_SCALED
} from './rules.js';

// Speed helper: Math.floor(BASE_SPEED_CU * factorPct / 100)
function _speedFromFactor(factorPct) {
  return Math.floor(BASE_SPEED_CU * factorPct / 100);
}

// Get the effective speed factor percentage for a player this tick
function _speedFactorPct(ps) {
  if (ps.sprintTicksLeft > 0) return 140;
  if (ps.debuffType === 'ice') {
    const level = ps.passives?.ice_grip ?? 0;
    if (level >= 2) return BOOST_CONFIG.passives.ice_grip.levels[1].factorPct;   // 75
    if (level >= 1) return BOOST_CONFIG.passives.ice_grip.levels[0].factorPct;   // 62
    return BOOST_CONFIG.passives.ice_grip.baseFactorPct;                          // 50
  }
  if (ps.debuffType === 'water') {
    const level = ps.passives?.water_shield ?? 0;
    if (level >= 2) return BOOST_CONFIG.passives.water_shield.levels[1].factorPct;  // 65
    if (level >= 1) return BOOST_CONFIG.passives.water_shield.levels[0].factorPct;  // 47
    return BOOST_CONFIG.passives.water_shield.baseFactorPct;                         // 30
  }
  return 100;
}

export function step(state, intents) {
  const s = {
    ...state,
    tick:      state.tick + 1,
    events:    [],
    obstacles: state.obstacles.map(o => ({
      ...o,
      hitByPlayer:     [...o.hitByPlayer],
      pendingByPlayer: [...o.pendingByPlayer]
    })),
    players: state.players.map(ps => ({
      ...ps,
      slots:          ps.slots.map(sl => ({ ...sl })),
      boostPressTimer:[...ps.boostPressTimer],
      boostKeyHeld:   [...ps.boostKeyHeld],
      laneTimeTicks:  [...ps.laneTimeTicks],
      boostUseCount:  { ...ps.boostUseCount },
      passives:       { ...ps.passives },
      actives:        { ...ps.actives },
      loadout:        { passives: { ...ps.loadout.passives }, actives: { ...ps.loadout.actives } }
    }))
  };

  const sorted = [...intents].sort((a, b) => a.playerSlot - b.playerSlot);
  for (const intent of sorted) {
    const ps = s.players[intent.playerSlot];
    if (ps) _processIntent(s, ps, intent);
  }

  for (const ps of s.players) _tickPlayer(s, ps);

  if (s.mode !== '1p') {
    _checkGapElimination(s);
    s.camPositionScaled = Math.max(...s.players.map(ps => ps.trackPosition));
    s.ended = s.players.every(ps => !_isActive(ps));
  } else {
    s.ended = !_isActive(s.players[0]);
  }

  return s;
}

function _isActive(ps) { return ps.gs === 'RUNNING' || ps.gs === 'REACTIVE'; }

function _processIntent(s, ps, intent) {
  if (intent.type === 'boost_up') {
    ps.boostKeyHeld[intent.slot] = false;
    return;
  }
  if (intent.type === 'lane_left')  { if (_isActive(ps)) _switchLane(ps, -1); return; }
  if (intent.type === 'lane_right') { if (_isActive(ps)) _switchLane(ps, +1); return; }
  if (intent.type === 'boost_down') {
    const i = intent.slot;
    ps.boostKeyHeld[i] = true;
    const sl = ps.slots[i];
    if (!sl) return;
    if (ps.gs === 'RUNNING') {
      // Sprint (slot 1): non-reactive active
      if (sl.id === 'sprint' && sl.uses > 0) {
        sl.uses--; ps.boostUseCount.sprint++;
        ps.sprintTicksLeft = SPRINT_TICKS;
      }
      // Phase (slot 2): non-reactive, works on ice/water only
      // Phase does NOT enter the reactive window and does NOT fire preemptively
      if (sl.id === 'phase' && sl.uses > 0) {
        // Phase is handled at collision time in RUNNING state
        // Just arm it via boostPressTimer so _handleCollision can pick it up
        ps.boostPressTimer[i] = PRESS_AHEAD_TICKS;
      }
      // Rock break (slot 0): reactive — arm the press-ahead timer
      if (sl.id === 'rock_break' && sl.isReactive && sl.uses > 0) {
        ps.boostPressTimer[i] = PRESS_AHEAD_TICKS;
      }
    } else if (ps.gs === 'REACTIVE') {
      // Only slot 0 (rock_break) can cancel a lethal rock collision in reactive window
      // Slot 2 (phase) is explicitly rejected here
      if (i !== 2) _tryReactiveBoost(s, ps, i);
    }
  }
}

function _switchLane(ps, dir) {
  const n = ps.lane + dir;
  if (n < 0 || n > 2) return;
  ps.laneVisualFrom = ps.lane;
  ps.laneVisualTicksLeft = ps.quickStepTicks ?? LANE_SWITCH_TICKS;
  ps.lane = n;
}

function _tickPlayer(s, ps) {
  if (!_isActive(ps)) return;

  if (ps.sprintTicksLeft    > 0) ps.sprintTicksLeft--;
  if (ps.debuffTicksLeft    > 0) { ps.debuffTicksLeft--; if (ps.debuffTicksLeft === 0) ps.debuffType = null; }
  if (ps.flashTicksLeft     > 0) ps.flashTicksLeft--;
  if (ps.laneVisualTicksLeft > 0) ps.laneVisualTicksLeft--;
  if (ps.drawAlphaTicksLeft  > 0) {
    ps.drawAlphaTicksLeft--;
    ps.drawAlpha = 0.4 + 0.6 * (1 - ps.drawAlphaTicksLeft / PHASE_ALPHA_TICKS);
  }
  for (let i = 0; i < 3; i++) { if (ps.boostPressTimer[i] > 0) ps.boostPressTimer[i]--; }

  ps.laneTimeTicks[ps.lane]++;

  if (ps.gs === 'RUNNING') {
    const factorPct = _speedFactorPct(ps);
    const speed = _speedFromFactor(factorPct);
    ps.trackPosition += speed;

    const obsIdx = _findCollision(s.obstacles, ps);
    if (obsIdx >= 0) _handleCollision(s, ps, obsIdx);
    else if (ps.trackPosition >= s.trackLength) { ps.gs = 'COMPLETE'; ps.gsEndTick = s.tick; }
  } else if (ps.gs === 'REACTIVE') {
    if (--ps.reactiveTicksLeft <= 0) _resolveReactiveDeath(s, ps);
  }
}

function _findCollision(obstacles, ps) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.hitByPlayer[ps.idx] || o.pendingByPlayer[ps.idx]) continue;
    if (o.lane !== ps.lane) continue;
    if (Math.abs(ps.trackPosition - o.distanceScaled) < COL_HALF_Y_SCALED) return i;
  }
  return -1;
}

function _handleCollision(s, ps, obsIdx) {
  const obs = s.obstacles[obsIdx];

  if (obs.type === 'rock') {
    // Check if rock_break is pre-armed (press-ahead)
    const rbSlot = ps.slots[0]; // slot 0 = rock_break
    if (rbSlot && rbSlot.id === 'rock_break' && rbSlot.uses > 0 &&
        (ps.boostKeyHeld[0] || ps.boostPressTimer[0] > 0)) {
      ps.reactiveObsIdx = obsIdx;
      obs.pendingByPlayer[ps.idx] = true;
      _tryReactiveBoost(s, ps, 0);
      return;
    }
    _enterReactive(s, ps, obsIdx);
    return;
  }

  // Ice or water: check if phase is pre-armed
  const phaseSlot = ps.slots[2]; // slot 2 = phase
  if (phaseSlot && phaseSlot.id === 'phase' && phaseSlot.uses > 0 &&
      (ps.boostKeyHeld[2] || ps.boostPressTimer[2] > 0)) {
    // Phase through ice/water
    phaseSlot.uses--; ps.boostUseCount.phase++;
    ps.boostPressTimer[2] = 0;
    obs.hitByPlayer[ps.idx] = true;
    s.events.push({ type: 'phase', playerIdx: ps.idx, obsLane: obs.lane, obsDistScaled: obs.distanceScaled });
    ps.drawAlpha = 0.4; ps.drawAlphaTicksLeft = PHASE_ALPHA_TICKS;
    return;
  }

  // Normal ice/water hit: apply debuff based on passive level
  obs.hitByPlayer[ps.idx] = true;
  if (obs.type === 'ice') {
    const level = ps.passives?.ice_grip ?? 0;
    // Only apply debuff if we have no full immunity (no level gives full immunity by default)
    // Level 2 = 75% = still debuffed but faster, so always apply debuff
    _applyDebuff(ps, 'ice');
  }
  if (obs.type === 'water') {
    _applyDebuff(ps, 'water');
  }
}

function _applyDebuff(ps, type) {
  ps.debuffType      = type;
  ps.debuffTicksLeft = type === 'ice' ? ICE_DEBUFF_TICKS : WATER_DEBUFF_TICKS;
  ps.flashTicksLeft  = FLASH_TICKS;
}

function _enterReactive(s, ps, obsIdx) {
  const obs = s.obstacles[obsIdx];
  // Only slot 0 (rock_break) can enter/resolve reactive
  const rbSlot = ps.slots[0];
  if (rbSlot && rbSlot.id === 'rock_break' && rbSlot.uses > 0) {
    if (ps.boostKeyHeld[0] || ps.boostPressTimer[0] > 0) {
      ps.reactiveObsIdx = obsIdx;
      obs.pendingByPlayer[ps.idx] = true;
      _tryReactiveBoost(s, ps, 0);
      return;
    }
  }
  ps.gs = 'REACTIVE'; ps.reactiveTicksLeft = REACTIVE_WINDOW_TICKS;
  ps.reactiveObsIdx = obsIdx; obs.pendingByPlayer[ps.idx] = true;
}

function _tryReactiveBoost(s, ps, slotIdx) {
  // Phase (slot 2) is explicitly NOT allowed in the reactive window
  if (slotIdx === 2) return;
  const sl = ps.slots[slotIdx];
  if (!sl || !sl.isActive || !sl.isReactive || sl.uses <= 0) return;
  if (ps.reactiveObsIdx < 0) return;
  const obs = s.obstacles[ps.reactiveObsIdx];
  // rock_break only works on rocks
  if (sl.id === 'rock_break' && obs.type !== 'rock') return;
  sl.uses--; ps.boostUseCount.rock_break++;
  ps.boostPressTimer[slotIdx] = 0;
  if (sl.id === 'rock_break') {
    obs.hitByPlayer = obs.hitByPlayer.map(() => true);
    obs.pendingByPlayer = obs.pendingByPlayer.map(() => false);
    s.events.push({ type: 'rock_break', playerIdx: ps.idx, obsLane: obs.lane, obsDistScaled: obs.distanceScaled });
  }
  ps.reactiveObsIdx = -1;
  if (ps.gs === 'REACTIVE') { ps.gs = 'RUNNING'; ps.reactiveTicksLeft = 0; }
}

function _resolveReactiveDeath(s, ps) {
  if (ps.reactiveObsIdx >= 0) {
    s.obstacles[ps.reactiveObsIdx].hitByPlayer[ps.idx] = true;
    s.obstacles[ps.reactiveObsIdx].pendingByPlayer[ps.idx] = false;
    ps.reactiveObsIdx = -1;
  }
  ps.gs = 'FAILED'; ps.gsEndTick = s.tick; ps.reactiveTicksLeft = 0;
  s.events.push({ type: 'death_shake', playerIdx: ps.idx });
}

function _checkGapElimination(s) {
  const active = s.players.filter(_isActive);
  if (active.length < 2) return;
  const leaderPos = Math.max(...active.map(ps => ps.trackPosition));
  for (const ps of active) {
    const gap = leaderPos - ps.trackPosition;
    if (gap >= GAP_ELIMINATION_CU) {
      ps.gs = 'LEFT BEHIND'; ps.gsEndTick = s.tick;
      s.events.push({ type: 'left_behind', playerIdx: ps.idx });
    }
  }
}
