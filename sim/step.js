import { BOOSTS, BOOST_CONFIG } from '../src/boosts.js';
import {
  REACTIVE_WINDOW_TICKS, PRESS_AHEAD_TICKS, SPRINT_TICKS,
  ICE_DEBUFF_TICKS, WATER_DEBUFF_TICKS, FLASH_TICKS,
  LANE_SWITCH_TICKS,
  // BENCHED: PHASE_ALPHA_TICKS — still imported so it doesn't break render code that kept it
  PHASE_ALPHA_TICKS,
  BASE_SPEED_CU,
  GAP_ELIMINATION_CU, COL_HALF_Y_SCALED,
  DRAFT_RANGE_CU, DRAFT_MAX_BONUS,
  SNIPE_SPEED_CU, SNIPE_LIFETIME, SNIPE_FACTOR, SNIPE_DEBUFF_TICKS,
  PICKUP_TYPES
} from './rules.js';

// True in Vite dev builds; false in production (tree-shakes debug blocks) and Node.js tests.
// import.meta.env is undefined in Node, so optional-chain to false safely.
const _DEV = typeof import.meta.env !== 'undefined' && !!import.meta.env.DEV;

// ─── Speed composition ────────────────────────────────────────────────────────
// Exact order: debuff → sprint → draft. Each is Math.floor(speed * factor / 100).

function _computeSpeed(ps) {
  let speed = BASE_SPEED_CU;

  // 1. Debuff
  if (ps.debuffType === 'ice') {
    const level = ps.passives?.ice_grip ?? 0;
    let factor;
    if (level >= 2) factor = BOOST_CONFIG.passives.ice_grip.levels[1].factorPct;   // 75
    else if (level >= 1) factor = BOOST_CONFIG.passives.ice_grip.levels[0].factorPct; // 62
    else factor = BOOST_CONFIG.passives.ice_grip.baseFactorPct;                        // 50
    speed = Math.floor(speed * factor / 100);
  } else if (ps.debuffType === 'water') {
    const level = ps.passives?.water_shield ?? 0;
    let factor;
    if (level >= 2) factor = BOOST_CONFIG.passives.water_shield.levels[1].factorPct;  // 65
    else if (level >= 1) factor = BOOST_CONFIG.passives.water_shield.levels[0].factorPct; // 47
    else factor = BOOST_CONFIG.passives.water_shield.baseFactorPct;                        // 30
    speed = Math.floor(speed * factor / 100);
  } else if (ps.debuffType === 'snipe') {
    // snipe factor is always SNIPE_FACTOR — not reduced by any passive
    speed = Math.floor(speed * SNIPE_FACTOR / 100);
  }

  // 2. Sprint
  if (ps.sprintTicksLeft > 0) {
    speed = Math.floor(speed * 140 / 100);
  }

  // 3. Draft (graded linear ramp — draftFactor computed per-tick before _tickPlayer)
  if (ps.draftFactor > 100) {
    speed = Math.floor(speed * ps.draftFactor / 100);
  }

  return speed;
}

// DEV-only: log the per-player speed chain for the current tick.
// Enable with: window.__lrDebug = { speedLog: true } in the browser console.
function _logSpeedChain(ps, finalSpeed, tick) {
  let debuffFactor = 100;
  if (ps.debuffType === 'ice') {
    const lv = ps.passives?.ice_grip ?? 0;
    debuffFactor = lv >= 2 ? BOOST_CONFIG.passives.ice_grip.levels[1].factorPct
                 : lv >= 1 ? BOOST_CONFIG.passives.ice_grip.levels[0].factorPct
                 : BOOST_CONFIG.passives.ice_grip.baseFactorPct;
  } else if (ps.debuffType === 'water') {
    const lv = ps.passives?.water_shield ?? 0;
    debuffFactor = lv >= 2 ? BOOST_CONFIG.passives.water_shield.levels[1].factorPct
                 : lv >= 1 ? BOOST_CONFIG.passives.water_shield.levels[0].factorPct
                 : BOOST_CONFIG.passives.water_shield.baseFactorPct;
  } else if (ps.debuffType === 'snipe') {
    debuffFactor = SNIPE_FACTOR;
  }
  const sprintFactor = ps.sprintTicksLeft > 0 ? 140 : 100;
  const draftFactor  = ps.draftFactor ?? 100;
  console.log(
    `[speed t=${tick}] p${ps.idx}: base=${BASE_SPEED_CU}` +
    ` debuff×${debuffFactor}%` +
    ` sprint×${sprintFactor}%` +
    ` draft×${draftFactor}%` +
    ` → ${finalSpeed} cu/tick`
  );
}

// Binary search insert into sorted obstacles array (ascending distanceScaled)
function _insertSorted(arr, obs) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].distanceScaled < obs.distanceScaled) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, obs);
  return lo; // return insert index for _startIdx adjustment
}

export function step(state, intents) {
  const s = {
    ...state,
    tick:        state.tick + 1,
    events:      [],
    obstacles:   state.obstacles.map(o => ({
      ...o,
      hitByPlayer:     [...o.hitByPlayer],
      pendingByPlayer: [...o.pendingByPlayer]
    })),
    pickups:     state.pickups.map(p => ({
      ...p,
      collectedByPlayer: [...p.collectedByPlayer]
    })),
    projectiles: state.projectiles.map(p => ({ ...p })),
    players:     state.players.map(ps => ({
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

  // Process intents
  const sorted = [...intents].sort((a, b) => a.playerSlot - b.playerSlot);
  for (const intent of sorted) {
    const ps = s.players[intent.playerSlot];
    if (ps) _processIntent(s, ps, intent);
  }

  // Compute graded draft for each player BEFORE moving (uses previous positions)
  // Verify: gap=100 → draftFactor=111, gap=13000 → 106, gap=25900 → 100
  for (const ps of s.players) {
    if (!_isActive(ps)) { ps.isDrafting = false; ps.draftFactor = 100; continue; }
    let draftFactor = 100;
    let minGap = Infinity;
    for (const other of s.players) {
      if (other.idx === ps.idx) continue;
      if (other.gs !== 'RUNNING' && other.gs !== 'REACTIVE') continue;
      if (other.lane !== ps.lane) continue;
      const gap = other.trackPosition - ps.trackPosition;
      if (gap > 0 && gap < minGap) minGap = gap;
    }
    if (minGap < DRAFT_RANGE_CU) {
      draftFactor = 100 + Math.floor(DRAFT_MAX_BONUS * (DRAFT_RANGE_CU - minGap) / DRAFT_RANGE_CU);
    }
    ps.draftFactor = draftFactor;
    ps.isDrafting  = draftFactor > 100;
  }

  // Advance projectiles
  _tickProjectiles(s);

  // Tick each player
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
      // Sprint (slot 1): non-reactive active, instant
      if (sl.id === 'sprint' && sl.uses > 0) {
        sl.uses--; ps.boostUseCount.sprint++;
        ps.sprintTicksLeft = SPRINT_TICKS;
      }
      // BENCHED: phase (was slot 2) — code preserved but slot 2 is now caltrop
      // if (sl.id === 'phase' && sl.uses > 0) { ... }

      // Caltrop (slot 2): place a slow trap behind caster
      if (sl.id === 'caltrop' && sl.uses > 0) {
        sl.uses--; ps.boostUseCount.caltrop++;
        _placeCaltrop(s, ps);
      }
      // Snipe Shot (slot 3): fire a projectile forward in caster's lane
      if (sl.id === 'snipe_shot' && sl.uses > 0) {
        sl.uses--; ps.boostUseCount.snipe_shot++;
        s.projectiles.push({
          casterSlot: ps.idx,
          lane:       ps.lane,
          z:          ps.trackPosition,
          spawnTick:  s.tick
        });
      }
      // Rock break (slot 0): reactive — arm the press-ahead timer
      if (sl.id === 'rock_break' && sl.isReactive && sl.uses > 0) {
        ps.boostPressTimer[i] = PRESS_AHEAD_TICKS;
      }
    } else if (ps.gs === 'REACTIVE') {
      // Only slot 0 (rock_break) can cancel a lethal rock collision in reactive window
      // BENCHED: phase (slot 2) is explicitly rejected here
      if (i === 0) _tryReactiveBoost(s, ps, i);
    }
  }
}

function _placeCaltrop(s, ps) {
  // Drop 100 units behind caster (10000 cu). Must be < CAM_BACK - NEAR_CLAMP (165 units)
  // so the debris is visible; must be > COL_HALF_Y (15 units) so caster doesn't self-hit.
  // No hitByPlayer pre-mark needed: caster moves forward and can never re-enter the
  // caltrop's collision zone (COL_HALF_Y_SCALED = 1500 cu). _findCollision skips it.
  const insertZ = Math.max(0, ps.trackPosition - 100 * 100); // 100 units behind, in cu
  const caltrop = {
    lane:            ps.lane,
    distanceScaled:  insertZ,
    type:            'ice',          // uses ice collision path
    hitByPlayer:     new Array(s.numPlayers).fill(false),
    pendingByPlayer: new Array(s.numPlayers).fill(false),
    isCaltrop:       true,
    casterSlot:      ps.idx
  };

  const insertIdx = _insertSorted(s.obstacles, caltrop);

  // If insert position is before _startIdx in the Obstacles renderer, that's handled
  // by the renderer's invalidateCullIndex() call (see RunScene). The sim doesn't
  // care about rendering indices — collision uses the full array.
  // Emit event so RunScene can reset render cull index
  s.events.push({ type: 'caltrop_placed', insertIdx });
}

function _tickProjectiles(s) {
  const surviving = [];
  for (const proj of s.projectiles) {
    const prevZ  = proj.z;
    const newZ   = proj.z + SNIPE_SPEED_CU;
    const age    = s.tick - proj.spawnTick;

    // Check lifetime and out-of-bounds
    if (age > SNIPE_LIFETIME || newZ > s.trackLength) continue;

    // Check collision with active non-owner players in same lane
    let hitPlayer = null;
    let hitDist   = Infinity;
    for (const ps of s.players) {
      if (ps.idx === proj.casterSlot) continue;
      if (ps.gs !== 'RUNNING' && ps.gs !== 'REACTIVE') continue;
      if (ps.lane !== proj.lane) continue;
      const pz = ps.trackPosition;
      // Projectile crosses player this tick: prevZ < pz <= newZ
      if (prevZ < pz && pz <= newZ) {
        const d = pz - prevZ;
        if (d < hitDist) { hitDist = d; hitPlayer = ps; }
      }
    }

    if (hitPlayer) {
      // Apply snipe debuff — refreshes duration, never stacks
      hitPlayer.debuffType      = 'snipe';
      hitPlayer.debuffTicksLeft = SNIPE_DEBUFF_TICKS;
      hitPlayer.flashTicksLeft  = FLASH_TICKS;
      const obsX = proj.lane; // lane index, renderer converts to screen X
      s.events.push({ type: 'snipe_hit', playerIdx: hitPlayer.idx, lane: proj.lane });
      // Projectile consumed — do not push to surviving
      continue;
    }

    surviving.push({ ...proj, z: newZ });
  }
  s.projectiles = surviving;
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
  // BENCHED: phase drawAlpha animation
  // if (ps.drawAlphaTicksLeft > 0) {
  //   ps.drawAlphaTicksLeft--;
  //   ps.drawAlpha = 0.4 + 0.6 * (1 - ps.drawAlphaTicksLeft / PHASE_ALPHA_TICKS);
  // }
  for (let i = 0; i < 4; i++) { if (ps.boostPressTimer[i] > 0) ps.boostPressTimer[i]--; }

  ps.laneTimeTicks[ps.lane]++;

  if (ps.gs === 'RUNNING') {
    let speed = _computeSpeed(ps);
    // DEBUG: slow follower mode — dev builds only; absent from shipped JS via tree-shaking.
    // ps.idx never appears in production speed calculations.
    if (_DEV && s.debugSlowSlots?.includes(ps.idx)) {
      speed = Math.floor(speed * 80 / 100);
    }
    if (_DEV && typeof window !== 'undefined' && window.__lrDebug?.speedLog) {
      _logSpeedChain(ps, speed, s.tick);
    }
    const prevPos = ps.trackPosition;
    ps.trackPosition += speed;

    // Check pickups
    _checkPickups(s, ps, prevPos, ps.trackPosition);

    const obsIdx = _findCollision(s.obstacles, ps);
    if (obsIdx >= 0) _handleCollision(s, ps, obsIdx);
    else if (ps.trackPosition >= s.trackLength) { ps.gs = 'COMPLETE'; ps.gsEndTick = s.tick; }
  } else if (ps.gs === 'REACTIVE') {
    if (--ps.reactiveTicksLeft <= 0) _resolveReactiveDeath(s, ps);
  }
}

function _checkPickups(s, ps, prevPos, newPos) {
  for (const pu of s.pickups) {
    if (pu.collectedByPlayer[ps.idx]) continue;
    if (pu.lane !== ps.lane) continue;
    // Player crosses pickup this tick: prevPos < distanceScaled <= newPos
    if (prevPos < pu.distanceScaled && pu.distanceScaled <= newPos) {
      const chargeKey = PICKUP_TYPES[pu.type]; // 'caltrop' or 'snipe_shot'
      if (!chargeKey) continue;
      // Check if player has this boost unlocked (slot exists)
      const slotIdx = ps.slots.findIndex(sl => sl.id === chargeKey);
      if (slotIdx < 0) continue;
      const sl = ps.slots[slotIdx];
      const maxCharges = BOOST_CONFIG.actives[chargeKey]?.maxCharges ?? 3;
      if (sl.uses < maxCharges) {
        sl.uses++;
        pu.collectedByPlayer[ps.idx] = true;
        s.events.push({ type: 'pickup_collected', playerIdx: ps.idx, pickupType: pu.type });
      }
    }
  }
}

function _findCollision(obstacles, ps) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.hitByPlayer[ps.idx] || o.pendingByPlayer[ps.idx]) continue;
    if (o.isCaltrop && o.casterSlot === ps.idx) continue; // caster never hits own caltrop
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

  // Ice or water (including caltrops which have type 'ice'):
  // BENCHED: phase check removed from here
  // if (phaseSlot && phaseSlot.id === 'phase' && phaseSlot.uses > 0 && ...) { ... }

  // Normal ice/water hit: apply debuff based on passive level
  obs.hitByPlayer[ps.idx] = true;
  if (obs.type === 'ice') {
    _applyDebuff(ps, 'ice', s);
  }
  if (obs.type === 'water') {
    _applyDebuff(ps, 'water', s);
  }
}

function _applyDebuff(ps, type, state) {
  ps.debuffType      = type;
  // Use per-track debuffTicks if available, else fall back to rule constants
  ps.debuffTicksLeft = (state?.debuffTicks != null) ? state.debuffTicks
    : (type === 'ice' ? ICE_DEBUFF_TICKS : WATER_DEBUFF_TICKS);
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
  // BENCHED: phase (slot 2) is explicitly not allowed in reactive window
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
