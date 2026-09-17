import { BOOSTS } from '../src/boosts.js';
import {
  REACTIVE_WINDOW_TICKS, PRESS_AHEAD_TICKS, SPRINT_TICKS,
  ICE_DEBUFF_TICKS, WATER_DEBUFF_TICKS, FLASH_TICKS,
  LANE_SWITCH_TICKS, PHASE_ALPHA_TICKS,
  BASE_SPEED_TICKS, SPRINT_SPEED_TICKS, ICE_SPEED_TICKS, WATER_SPEED_TICKS,
  GAP_ELIMINATION_SCALED, COL_HALF_Y_SCALED
} from './rules.js';

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
      boostUseCount:  { ...ps.boostUseCount }
    }))
  };

  const sorted = [...intents].sort((a, b) => a.playerSlot - b.playerSlot);
  for (const intent of sorted) {
    const ps = s.players[intent.playerSlot];
    if (ps) _processIntent(s, ps, intent);
  }

  for (const ps of s.players) _tickPlayer(s, ps);

  if (s.mode === '2p') {
    _checkGapElimination(s);
    s.camPositionScaled = Math.max(s.players[0].trackPosition, s.players[1].trackPosition);
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
      if (sl.isActive && !sl.isReactive && sl.uses > 0 && sl.id === 'sprint') {
        sl.uses--; ps.boostUseCount[sl.id]++;
        ps.sprintTicksLeft = SPRINT_TICKS;
      }
      if (sl.isReactive && sl.uses > 0) {
        ps.boostPressTimer[i] = PRESS_AHEAD_TICKS;
      }
    } else if (ps.gs === 'REACTIVE') {
      _tryReactiveBoost(s, ps, i);
    }
  }
}

function _switchLane(ps, dir) {
  const n = ps.lane + dir;
  if (n < 0 || n > 2) return;
  ps.laneVisualFrom = ps.lane;
  ps.laneVisualTicksLeft = ps.boostSet.includes('quick_step') ? 0 : LANE_SWITCH_TICKS;
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
    const speed = ps.sprintTicksLeft > 0 ? SPRINT_SPEED_TICKS
      : ps.debuffType === 'ice'   ? ICE_SPEED_TICKS
      : ps.debuffType === 'water' ? WATER_SPEED_TICKS
      : BASE_SPEED_TICKS;
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
  if (obs.type === 'rock') { _enterReactive(s, ps, obsIdx); return; }
  obs.hitByPlayer[ps.idx] = true;
  if (obs.type === 'ice'   && !ps.boostSet.includes('ice_grip'))     _applyDebuff(ps, 'ice');
  if (obs.type === 'water' && !ps.boostSet.includes('water_shield')) _applyDebuff(ps, 'water');
}

function _applyDebuff(ps, type) {
  ps.debuffType      = type;
  ps.debuffTicksLeft = type === 'ice' ? ICE_DEBUFF_TICKS : WATER_DEBUFF_TICKS;
  ps.flashTicksLeft  = FLASH_TICKS;
}

function _enterReactive(s, ps, obsIdx) {
  const obs = s.obstacles[obsIdx];
  for (let i = 0; i < 3; i++) {
    const sl = ps.slots[i];
    if (!sl || !sl.isReactive || sl.uses <= 0) continue;
    if (sl.id === 'rock_break' && obs.type !== 'rock') continue;
    if (ps.boostKeyHeld[i] || ps.boostPressTimer[i] > 0) {
      ps.reactiveObsIdx = obsIdx;
      obs.pendingByPlayer[ps.idx] = true;
      _tryReactiveBoost(s, ps, i);
      return;
    }
  }
  ps.gs = 'REACTIVE'; ps.reactiveTicksLeft = REACTIVE_WINDOW_TICKS;
  ps.reactiveObsIdx = obsIdx; obs.pendingByPlayer[ps.idx] = true;
}

function _tryReactiveBoost(s, ps, slotIdx) {
  const sl = ps.slots[slotIdx];
  if (!sl || !sl.isActive || !sl.isReactive || sl.uses <= 0) return;
  if (ps.reactiveObsIdx < 0) return;
  const obs = s.obstacles[ps.reactiveObsIdx];
  if (sl.id === 'rock_break' && obs.type !== 'rock') return;
  sl.uses--; ps.boostUseCount[sl.id]++;
  ps.boostPressTimer[slotIdx] = 0;
  if (sl.id === 'rock_break') {
    obs.hitByPlayer = [true, true]; obs.pendingByPlayer = [false, false];
    s.events.push({ type: 'rock_break', playerIdx: ps.idx, obsLane: obs.lane, obsDistScaled: obs.distanceScaled });
  } else {
    obs.hitByPlayer[ps.idx] = true; obs.pendingByPlayer[ps.idx] = false;
    s.events.push({ type: 'phase', playerIdx: ps.idx, obsLane: obs.lane, obsDistScaled: obs.distanceScaled });
    ps.drawAlpha = 0.4; ps.drawAlphaTicksLeft = PHASE_ALPHA_TICKS;
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
  const [a, b] = s.players;
  if (!_isActive(a) || !_isActive(b)) return;
  const gap = Math.abs(a.trackPosition - b.trackPosition);
  if (gap >= GAP_ELIMINATION_SCALED) {
    const trailer = a.trackPosition < b.trackPosition ? a : b;
    trailer.gs = 'LEFT BEHIND'; trailer.gsEndTick = s.tick;
    s.events.push({ type: 'left_behind', playerIdx: trailer.idx });
  }
}
