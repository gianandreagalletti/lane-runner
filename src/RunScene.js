import Phaser from 'phaser';
import { Player }     from './player.js';
import { Obstacles }  from './obstacles.js';
import { BOOSTS }     from './boosts.js';
import { spawnBurst }                    from './particles.js';
import { rockBreakEffect, phaseEffect } from './effects.js';
import { appendLog }  from './sessionLog.js';
import { BINDINGS }   from './controls.js';
import {
  CANVAS_W, CANVAS_H,
  LANE_WIDTH, LANE_GAP, LANE_START_X, LANE_COLORS,
  BASE_SPEED, LANE_CENTERS, PLAYER_Y
} from './track.js';

// ── Reactive input config — tune during playtest ───────────────────────────
const REACTIVE_WINDOW_MS = 450;   // widened from 250
const PRESS_AHEAD_MS     = 400;   // a boost key pressed up to this many ms early is buffered

const JD = key => Phaser.Input.Keyboard.JustDown(key);
const KC = Phaser.Input.Keyboard.KeyCodes;

// ── 2P tuning constants ────────────────────────────────────────────────────
const GAP_ELIMINATION = 500;
const GAP_WARNING     = 300;
const TRAIL_PIN_Y     = CANVAS_H - 40;

const BOOST_LABELS = { p1: ['1','2','3'], p2: ['8','9','0'] };
const P2_COLOR = 0xE8A33D;

// ── Armed indicator colours ────────────────────────────────────────────────
const ARMED_STROKE   = 0xFFDD00;
const UNARMED_STROKE_REACTIVE = 0x554422;

export class RunScene extends Phaser.Scene {
  constructor() { super({ key: 'RunScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.mode           = data.mode || '1p';
    this.planningTimeMs = data.planningTimeMs ?? 0;

    if (this.mode === '2p') {
      this.loadoutP1 = data.loadoutP1 ?? data.loadout ?? [];
      this.loadoutP2 = data.loadoutP2 ?? data.loadout ?? [];
    } else {
      this.loadout  = data.loadout;
      this.boostSet = new Set(data.loadout);
    }
  }

  create() {
    if (this.mode === '2p') this._create2P();
    else                    this._create1P();
  }

  update(_t, delta) {
    if (this.mode === '2p') {
      this._update2P(delta);
    } else {
      if      (this.gameState === 'RUNNING')   this._runUpdate(delta);
      else if (this.gameState === 'REACTIVE')  this._reactiveUpdate(delta);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  1-PLAYER
  // ═══════════════════════════════════════════════════════════════════════════

  _create1P() {
    this.trackPosition    = 0;
    this.startTime        = this.time.now;
    this.gameState        = 'RUNNING';
    this.sprintTimer      = 0;
    this.sprintMultiplier = 1;
    this.reactiveTimer    = 0;
    this.reactiveObs      = null;
    this.laneTimeMs       = [0, 0, 0];
    this.boostUseCount    = {};
    this.loadout.forEach(id => { this.boostUseCount[id] = 0; });

    this.slots = this.loadout.map(id => {
      const b = BOOSTS[id];
      return { id, uses: b.type === 'active' ? b.usesPerRun : null,
               isActive: b.type === 'active',
               isReactive: b.type === 'active' ? b.reactive : false };
    });

    // Press-ahead buffers and armed state (per slot)
    this.boostPressTimer = [0, 0, 0];
    this.boostArmed      = [false, false, false];

    this.laneGfx = this.add.graphics();
    this._drawLanes();

    this.obstacles       = new Obstacles(this, this.trackData);
    this.player          = new Player(this, { instantSwitch: this.boostSet.has('quick_step') });
    this.reactiveOverlay = this.add.graphics();

    this.distText = this.add.text(20, 14, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#DDDDDD',
      stroke: '#000000', strokeThickness: 3
    });
    this.speedText = this.add.text(CANVAS_W - 20, 14, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#FFE044',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(1, 0);

    this._buildBoostHud();

    this.reactiveText = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 70, '', {
      fontSize: '36px', fontFamily: 'monospace', color: '#FFFF00',
      align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);

    this.keyLeft     = this.input.keyboard.addKey(KC[BINDINGS.p1.left]);
    this.keyRight    = this.input.keyboard.addKey(KC[BINDINGS.p1.right]);
    this.keyLeftAlt  = this.input.keyboard.addKey(KC.LEFT);
    this.keyRightAlt = this.input.keyboard.addKey(KC.RIGHT);
    this.keyBoost    = BINDINGS.p1.boost.map(k => this.input.keyboard.addKey(KC[k]));
  }

  _runUpdate(delta) {
    this.laneTimeMs[this.player.lane] += delta;

    if (this.sprintTimer > 0) {
      this.sprintTimer -= delta;
      if (this.sprintTimer <= 0) { this.sprintTimer = 0; this.sprintMultiplier = 1; }
    }

    const speed = BASE_SPEED * this.player.speedMultiplier * this.sprintMultiplier;
    this.trackPosition += speed * (delta / 1000);

    if (JD(this.keyLeft)  || JD(this.keyLeftAlt))  this.player.switchLane(-1);
    if (JD(this.keyRight) || JD(this.keyRightAlt)) this.player.switchLane(1);
    if (JD(this.keyBoost[0])) this._tryActivate(0);
    if (JD(this.keyBoost[1])) this._tryActivate(1);
    if (JD(this.keyBoost[2])) this._tryActivate(2);

    // Update press-ahead timers and armed state
    this._updateBoostInputState1P(delta);

    this.player.update(delta);
    this.obstacles.update(this.trackPosition);

    const hit = this.obstacles.checkCollision(this.player.x);
    if (hit) {
      if (hit.type === 'rock') { this._enterReactive(hit); return; }
      this.obstacles.markHit(hit);
      if (hit.type === 'ice'   && !this.boostSet.has('ice_grip'))     this.player.applyDebuff('ice');
      if (hit.type === 'water' && !this.boostSet.has('water_shield')) this.player.applyDebuff('water');
    }

    if (this.trackPosition >= this.trackData.length) { this._endRun('COMPLETE'); return; }
    this._refreshHud();
  }

  // Update press-ahead timers and armed-state for 1P
  _updateBoostInputState1P(delta) {
    for (let i = 0; i < 3; i++) {
      const key = this.keyBoost[i];
      const slot = this.slots[i];
      const wasArmed = this.boostArmed[i];

      // Tick down press-ahead timer
      if (this.boostPressTimer[i] > 0) {
        this.boostPressTimer[i] = Math.max(0, this.boostPressTimer[i] - delta);
      }

      // Record fresh key presses as press-ahead
      if (JD(key) && slot && slot.isReactive && slot.uses > 0) {
        this.boostPressTimer[i] = PRESS_AHEAD_MS;
      }

      // Armed = key physically held AND slot has uses
      this.boostArmed[i] = key.isDown && slot && slot.isReactive && slot.uses > 0;

      // Update HUD armed indicator if state changed
      if (wasArmed !== this.boostArmed[i]) {
        this._updateHudArmIndicator1P(i);
      }
    }
  }

  _updateHudArmIndicator1P(i) {
    const ref = this.hudSlotRefs[i];
    const slot = this.slots[i];
    if (!ref || !slot || !slot.isReactive) return;
    if (this.boostArmed[i]) {
      ref.chip.setStrokeStyle(2, ARMED_STROKE, 1);
    } else {
      ref.chip.setStrokeStyle(1, UNARMED_STROKE_REACTIVE);
    }
  }

  _reactiveUpdate(delta) {
    this.reactiveTimer -= delta;
    this.obstacles.update(this.trackPosition);

    const frac = Math.max(0, this.reactiveTimer / REACTIVE_WINDOW_MS);
    this.reactiveOverlay.clear();
    this.reactiveOverlay.fillStyle(0xFF2200, 0.15 + 0.3 * frac * (0.6 + 0.4 * Math.sin(Date.now() / 35)));
    this.reactiveOverlay.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const reactSlots = this.slots.map((s, i) => ({ ...s, idx: i })).filter(s => s.isReactive && s.uses > 0);
    const hints = reactSlots.map(s => `[${s.idx + 1}] ${BOOSTS[s.id].name}`).join('  ');
    this.reactiveText.setText(hints ? `REACT!\n${hints}` : 'NO BOOST');

    if (JD(this.keyBoost[0])) this._tryReactiveBoost(0);
    if (JD(this.keyBoost[1])) this._tryReactiveBoost(1);
    if (JD(this.keyBoost[2])) this._tryReactiveBoost(2);

    if (this.reactiveTimer <= 0) this._resolveReactiveDeath();
  }

  _enterReactive(obs) {
    // Before opening the window, check if any reactive slot can auto-fire
    for (let i = 0; i < 3; i++) {
      const slot = this.slots[i];
      if (!slot || !slot.isReactive || slot.uses <= 0) continue;
      if (slot.id === 'rock_break' && obs.type !== 'rock') continue;
      if (this.boostArmed[i] || this.boostPressTimer[i] > 0) {
        // Auto-fire: set up obs so _tryReactiveBoost works, then fire
        this.reactiveObs = obs;
        this.obstacles.markPending(obs);
        this._tryReactiveBoost(i);
        return;
      }
    }
    // No auto-fire — open the reactive window normally
    this.gameState = 'REACTIVE'; this.reactiveTimer = REACTIVE_WINDOW_MS;
    this.reactiveObs = obs; this.obstacles.markPending(obs);
  }

  _tryReactiveBoost(slotIdx) {
    const slot = this.slots[slotIdx];
    if (!slot || !slot.isActive || !slot.isReactive || slot.uses <= 0) return;
    if (slot.id === 'rock_break' && this.reactiveObs.type !== 'rock') return;

    slot.uses--;
    this.boostUseCount[slot.id]++;
    this.boostPressTimer[slotIdx] = 0;
    this._refreshHudSlot(slotIdx);

    const obsX = LANE_CENTERS[this.reactiveObs.lane];
    if (slot.id === 'rock_break') {
      rockBreakEffect(this, this.reactiveObs, obsX);
    } else {
      phaseEffect(this, this.player, this.reactiveObs, obsX);
    }

    this.obstacles.clearPending(this.reactiveObs);
    this.reactiveObs = null;
    this._clearReactive();
  }

  _resolveReactiveDeath() {
    if (this.reactiveObs) { this.obstacles.markHit(this.reactiveObs); this.reactiveObs = null; }
    this._clearReactive();
    this.cameras.main.shake(110, 0.022);
    this.time.delayedCall(120, () => this._endRun('FAILED'));
  }

  _clearReactive() {
    if (this.gameState === 'REACTIVE') this.gameState = 'RUNNING';
    this.reactiveOverlay.clear();
    this.reactiveText.setText('');
  }

  _tryActivate(slotIdx) {
    const slot = this.slots[slotIdx];
    if (!slot || !slot.isActive || slot.isReactive || slot.uses <= 0) return;
    if (slot.id === 'sprint') {
      slot.uses--;
      this.boostUseCount[slot.id]++;
      this.sprintTimer = 4000; this.sprintMultiplier = 1.4;
      this._refreshHudSlot(slotIdx);
    }
  }

  _buildBoostHud() {
    const spacing = 226, startX = CANVAS_W / 2 - spacing;
    this.hudSlotRefs = [];
    this.slots.forEach((slot, i) => {
      const x = startX + i * spacing, boost = BOOSTS[slot.id], isP = !slot.isActive;
      const chip = this.add.rectangle(x, 22, 210, 30, isP ? 0x142a1e : 0x201610)
        .setStrokeStyle(1, isP ? 0x338844 : 0x554422);
      this.add.text(x - 78, 22, `[${i + 1}]`, { fontSize: '11px', fontFamily: 'monospace', color: '#556677' }).setOrigin(0, 0.5);
      const nameT = this.add.text(x - 58, 22, boost.name, {
        fontSize: '13px', fontFamily: 'monospace', color: isP ? '#AAFFCC' : '#FFCC88'
      }).setOrigin(0, 0.5);
      let usesT = null;
      if (slot.isActive) {
        usesT = this.add.text(x + 76, 22, this._usesLabel(slot), {
          fontSize: '13px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0.5);
      } else {
        this.add.text(x + 76, 22, 'ON', { fontSize: '12px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0.5);
      }
      this.hudSlotRefs.push({ chip, nameT, usesT });
    });
    this.sprintText = this.add.text(CANVAS_W / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
  }

  _usesLabel(slot) { return slot.uses > 0 ? `×${slot.uses}` : 'SPENT'; }

  _refreshHudSlot(i) {
    const ref = this.hudSlotRefs[i], slot = this.slots[i];
    if (!ref.usesT) return;
    ref.usesT.setText(this._usesLabel(slot));
    ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
    ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
  }

  _refreshHud() {
    this.distText.setText(`${Math.floor(this.trackPosition)} / ${this.trackData.length}`);
    const parts = [];
    if (this.player.debuffType) parts.push(`SLOWED ${Math.round(this.player.speedMultiplier * 100)}%`);
    this.speedText.setText(parts.join('  '));
    this.sprintText.setText(this.sprintTimer > 0 ? `SPRINT ${(this.sprintTimer / 1000).toFixed(1)}s` : '');
  }

  _drawLanes() {
    for (let i = 0; i < 3; i++) {
      const x = LANE_START_X + i * (LANE_WIDTH + LANE_GAP);
      this.laneGfx.fillStyle(LANE_COLORS[i]); this.laneGfx.fillRect(x, 0, LANE_WIDTH, CANVAS_H);
      this.laneGfx.lineStyle(1, 0xFFFFFF, 0.08); this.laneGfx.strokeRect(x, 0, LANE_WIDTH, CANVAS_H);
    }
  }

  _endRun(result) {
    this.gameState = result;
    const elapsedMs = this.time.now - this.startTime;
    const distance  = Math.floor(this.trackPosition);

    appendLog({
      track: this.trackData.id, loadout: this.loadout,
      outcome: result === 'COMPLETE' ? 'complete' : 'failed',
      distance, elapsedMs: Math.round(elapsedMs),
      boostUses: { ...this.boostUseCount },
      laneTimeMs: [...this.laneTimeMs],
      planningTimeMs: this.planningTimeMs
    });

    this.scene.start('ResultScene', {
      mode: '1p', result, distance,
      elapsed: parseFloat((elapsedMs / 1000).toFixed(2)),
      trackData: this.trackData, loadout: this.loadout
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  2-PLAYER
  // ═══════════════════════════════════════════════════════════════════════════

  _create2P() {
    this._2pEnded = false;

    this.laneGfx = this.add.graphics();
    this._drawLanes();

    this.obstacles = new Obstacles(this, this.trackData, { numPlayers: 2 });

    this.warningArrow = this.add.graphics().setDepth(15);
    this.warningText  = this.add.text(0, 0, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#FF9900',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(15);

    const p1Keys = {
      left:  KC[BINDINGS.p1.left],  right: KC[BINDINGS.p1.right],
      boost: BINDINGS.p1.boost.map(k => KC[k])
    };
    const p2Keys = {
      left:  KC[BINDINGS.p2.left],  right: KC[BINDINGS.p2.right],
      boost: BINDINGS.p2.boost.map(k => KC[k])
    };

    this.ps = [0, 1].map(idx => {
      const ps = this._makePS(idx);
      this._createPObjects(ps);
      const keys = idx === 0 ? p1Keys : p2Keys;
      ps.keyLeft  = this.input.keyboard.addKey(keys.left);
      ps.keyRight = this.input.keyboard.addKey(keys.right);
      ps.keyBoost = keys.boost.map(k => this.input.keyboard.addKey(k));
      return ps;
    });

    this._buildBoostHud2P();
  }

  _makePS(idx) {
    const loadout = idx === 0 ? this.loadoutP1 : this.loadoutP2;
    return {
      idx,
      loadout:         [...loadout],
      boostSet:        new Set(loadout),
      slots: loadout.map(id => {
        const b = BOOSTS[id];
        return { id, uses: b.type === 'active' ? b.usesPerRun : null,
                 isActive: b.type === 'active',
                 isReactive: b.type === 'active' ? b.reactive : false };
      }),
      boostUseCount:   Object.fromEntries(loadout.map(id => [id, 0])),
      laneTimeMs:      [0, 0, 0],
      gs:              'RUNNING',
      trackPosition:   0,
      startTime:       this.time.now,
      sprintTimer:     0, sprintMultiplier: 1,
      reactiveTimer:   0, reactiveObs:      null,
      // Press-ahead and armed state (per slot)
      boostPressTimer: [0, 0, 0],
      boostArmed:      [false, false, false],
      player: null, reactiveOverlay: null, reactiveText: null,
      label:  null,
      keyLeft: null, keyRight: null, keyBoost: []
    };
  }

  _createPObjects(ps) {
    const isP2 = ps.idx === 1;
    ps.player = new Player(this, {
      instantSwitch: ps.boostSet.has('quick_step'),
      visualOffsetX: isP2 ? 30 : -30,
      bodyColor:     isP2 ? P2_COLOR : 0xFFFFFF
    });

    ps.reactiveOverlay = this.add.graphics();

    const rtX = isP2 ? 3 * CANVAS_W / 4 : CANVAS_W / 4;
    ps.reactiveText = this.add.text(rtX, CANVAS_H / 2 - 60, '', {
      fontSize: '28px', fontFamily: 'monospace', color: '#FFFF00',
      align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);

    ps.label = this.add.text(0, 0, `P${ps.idx + 1}`, {
      fontSize: '12px', fontFamily: 'monospace',
      color: isP2 ? '#E8A33D' : '#FFFFFF',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(6);
  }

  _buildBoostHud2P() {
    const chipW = 100, chipH = 26, chipSpacing = 110;

    for (const ps of this.ps) {
      const isP2  = ps.idx === 1;
      const chip0X = isP2 ? (CANVAS_W - 55 - 2 * chipSpacing) : 55;

      ps.hud = {};

      if (!isP2) {
        ps.hud.labelT = this.add.text(10, 14, 'P1', {
          fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF',
          stroke: '#000', strokeThickness: 2
        });
        ps.hud.distT = this.add.text(38, 14, '', {
          fontSize: '14px', fontFamily: 'monospace', color: '#DDDDDD',
          stroke: '#000', strokeThickness: 2
        });
        ps.hud.debuffT = this.add.text(220, 14, '', {
          fontSize: '12px', fontFamily: 'monospace', color: '#FFE044',
          stroke: '#000', strokeThickness: 2
        });
        ps.hud.sprintT = this.add.text(165, 56, '', {
          fontSize: '11px', fontFamily: 'monospace', color: '#FFEE55',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0);
      } else {
        ps.hud.labelT = this.add.text(CANVAS_W - 10, 14, 'P2', {
          fontSize: '14px', fontFamily: 'monospace', color: '#E8A33D',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0);
        ps.hud.distT = this.add.text(CANVAS_W - 38, 14, '', {
          fontSize: '14px', fontFamily: 'monospace', color: '#DDB870',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0);
        ps.hud.debuffT = this.add.text(CANVAS_W - 220, 14, '', {
          fontSize: '12px', fontFamily: 'monospace', color: '#FFE044',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0);
        ps.hud.sprintT = this.add.text(CANVAS_W - 165, 56, '', {
          fontSize: '11px', fontFamily: 'monospace', color: '#FFEE55',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0);
      }

      ps.hud.chipRefs = [];
      ps.slots.forEach((slot, i) => {
        const cx   = chip0X + i * chipSpacing;
        const boost = BOOSTS[slot.id], isPassive = !slot.isActive;
        const chip  = this.add.rectangle(cx, 38, chipW, chipH,
          isPassive ? 0x142a1e : 0x201610)
          .setStrokeStyle(1, isPassive ? 0x338844 : 0x554422);
        const nameT = this.add.text(cx, 38, boost.name, {
          fontSize: '10px', fontFamily: 'monospace', color: isPassive ? '#AAFFCC' : '#FFCC88'
        }).setOrigin(0.5, 0.5);
        let usesT = null;
        if (slot.isActive) {
          usesT = this.add.text(cx + 44, 38, this._usesLabel(slot), {
            fontSize: '10px', fontFamily: 'monospace', color: '#55FF88',
            stroke: '#000', strokeThickness: 2
          }).setOrigin(1, 0.5);
        }
        ps.hud.chipRefs.push({ chip, nameT, usesT });
      });
    }

    this.gapText = this.add.text(CANVAS_W / 2, 14, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#556677',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
  }

  // ── 2P per-frame update ───────────────────────────────────────────────────

  _update2P(delta) {
    this._camPos = Math.max(this.ps[0].trackPosition, this.ps[1].trackPosition);

    this.obstacles.update(this._camPos);

    for (const ps of this.ps) {
      const gap  = this._camPos - ps.trackPosition;
      ps.player.y = Math.min(PLAYER_Y + gap, TRAIL_PIN_Y);
    }

    for (const ps of this.ps) {
      if      (ps.gs === 'RUNNING')   this._runUpdateP(ps, delta);
      else if (ps.gs === 'REACTIVE')  this._reactiveUpdateP(ps, delta);
    }

    this._checkGapElimination();
    this._updatePlayerLabels();
    this._updateWarningArrow();
    this._refreshHud2P();
    this._check2PEnd();
  }

  _runUpdateP(ps, delta) {
    ps.laneTimeMs[ps.player.lane] += delta;

    if (ps.sprintTimer > 0) {
      ps.sprintTimer -= delta;
      if (ps.sprintTimer <= 0) { ps.sprintTimer = 0; ps.sprintMultiplier = 1; }
    }

    const speed = BASE_SPEED * ps.player.speedMultiplier * ps.sprintMultiplier;
    ps.trackPosition += speed * (delta / 1000);

    if (JD(ps.keyLeft))  ps.player.switchLane(-1);
    if (JD(ps.keyRight)) ps.player.switchLane(1);
    for (let i = 0; i < 3; i++) {
      if (JD(ps.keyBoost[i])) this._tryActivateP(ps, i);
    }

    // Update press-ahead timers and armed state for this player
    this._updateBoostInputStateP(ps, delta);

    ps.player.update(delta);
    const logY = PLAYER_Y + (this._camPos - ps.trackPosition);
    const hit  = this.obstacles.checkCollision(ps.player.x, logY, ps.idx);
    if (hit) {
      if (hit.type === 'rock') { this._enterReactiveP(ps, hit); return; }
      this.obstacles.markHit(hit, ps.idx);
      if (hit.type === 'ice'   && !ps.boostSet.has('ice_grip'))     ps.player.applyDebuff('ice');
      if (hit.type === 'water' && !ps.boostSet.has('water_shield')) ps.player.applyDebuff('water');
    }

    if (ps.trackPosition >= this.trackData.length) { this._endP(ps, 'COMPLETE'); return; }
  }

  _updateBoostInputStateP(ps, delta) {
    for (let i = 0; i < 3; i++) {
      const key  = ps.keyBoost[i];
      const slot = ps.slots[i];
      const wasArmed = ps.boostArmed[i];

      if (ps.boostPressTimer[i] > 0) {
        ps.boostPressTimer[i] = Math.max(0, ps.boostPressTimer[i] - delta);
      }

      if (JD(key) && slot && slot.isReactive && slot.uses > 0) {
        ps.boostPressTimer[i] = PRESS_AHEAD_MS;
      }

      ps.boostArmed[i] = key.isDown && slot && slot.isReactive && slot.uses > 0;

      if (wasArmed !== ps.boostArmed[i]) {
        this._updateHudArmIndicatorP(ps, i);
      }
    }
  }

  _updateHudArmIndicatorP(ps, i) {
    const ref  = ps.hud.chipRefs[i];
    const slot = ps.slots[i];
    if (!ref || !slot || !slot.isReactive) return;
    if (ps.boostArmed[i]) {
      ref.chip.setStrokeStyle(2, ARMED_STROKE, 1);
    } else {
      ref.chip.setStrokeStyle(1, UNARMED_STROKE_REACTIVE);
    }
  }

  _reactiveUpdateP(ps, delta) {
    ps.reactiveTimer -= delta;

    const frac = Math.max(0, ps.reactiveTimer / REACTIVE_WINDOW_MS);
    ps.reactiveOverlay.clear();
    ps.reactiveOverlay.fillStyle(0xFF2200, 0.12 + 0.25 * frac * (0.6 + 0.4 * Math.sin(Date.now() / 35)));
    ps.reactiveOverlay.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const labels = BOOST_LABELS[ps.idx === 0 ? 'p1' : 'p2'];
    const reactSlots = ps.slots.map((s, i) => ({ ...s, idx: i })).filter(s => s.isReactive && s.uses > 0);
    const hints = reactSlots.map(s => `[${labels[s.idx]}] ${BOOSTS[s.id].name}`).join('  ');
    ps.reactiveText.setText(hints ? `P${ps.idx + 1} REACT!\n${hints}` : `P${ps.idx + 1} NO BOOST`);

    for (let i = 0; i < 3; i++) {
      if (JD(ps.keyBoost[i])) this._tryReactiveBoostP(ps, i);
    }

    if (ps.reactiveTimer <= 0) this._resolveReactiveDeathP(ps);
  }

  _enterReactiveP(ps, obs) {
    // Check for auto-fire before opening the reactive window
    for (let i = 0; i < 3; i++) {
      const slot = ps.slots[i];
      if (!slot || !slot.isReactive || slot.uses <= 0) continue;
      if (slot.id === 'rock_break' && obs.type !== 'rock') continue;
      if (ps.boostArmed[i] || ps.boostPressTimer[i] > 0) {
        ps.reactiveObs = obs;
        this.obstacles.markPending(obs, ps.idx);
        this._tryReactiveBoostP(ps, i);
        return;
      }
    }
    ps.gs = 'REACTIVE'; ps.reactiveTimer = REACTIVE_WINDOW_MS;
    ps.reactiveObs = obs; this.obstacles.markPending(obs, ps.idx);
  }

  _tryReactiveBoostP(ps, slotIdx) {
    const slot = ps.slots[slotIdx];
    if (!slot || !slot.isActive || !slot.isReactive || slot.uses <= 0) return;
    if (slot.id === 'rock_break' && ps.reactiveObs.type !== 'rock') return;

    slot.uses--;
    ps.boostUseCount[slot.id]++;
    ps.boostPressTimer[slotIdx] = 0;
    this._refreshHudSlotP(ps, slotIdx);

    const obsX = LANE_CENTERS[ps.reactiveObs.lane];
    if (slot.id === 'rock_break') {
      rockBreakEffect(this, ps.reactiveObs, obsX);
    } else {
      phaseEffect(this, ps.player, ps.reactiveObs, obsX);
    }

    this.obstacles.clearPending(ps.reactiveObs, ps.idx);
    ps.reactiveObs = null;
    this._clearReactiveP(ps);
  }

  _resolveReactiveDeathP(ps) {
    if (ps.reactiveObs) { this.obstacles.markHit(ps.reactiveObs, ps.idx); ps.reactiveObs = null; }
    this._clearReactiveP(ps);
    this.cameras.main.shake(60, 0.015);
    this.time.delayedCall(80, () => this._endP(ps, 'ELIMINATED'));
  }

  _clearReactiveP(ps) {
    if (ps.gs === 'REACTIVE') ps.gs = 'RUNNING';
    ps.reactiveOverlay.clear();
    ps.reactiveText.setText('');
  }

  _tryActivateP(ps, slotIdx) {
    const slot = ps.slots[slotIdx];
    if (!slot || !slot.isActive || slot.isReactive || slot.uses <= 0) return;
    if (slot.id === 'sprint') {
      slot.uses--;
      ps.boostUseCount[slot.id]++;
      ps.sprintTimer = 4000; ps.sprintMultiplier = 1.4;
      this._refreshHudSlotP(ps, slotIdx);
    }
  }

  _refreshHudSlotP(ps, i) {
    const ref = ps.hud.chipRefs[i], slot = ps.slots[i];
    if (!ref.usesT) return;
    ref.usesT.setText(this._usesLabel(slot));
    ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
    ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
  }

  _refreshHud2P() {
    const gap = Math.abs(this.ps[0].trackPosition - this.ps[1].trackPosition);

    for (const ps of this.ps) {
      const h = ps.hud;
      h.distT.setText(`${Math.floor(ps.trackPosition)} / ${this.trackData.length}`);
      const debuff = ps.player.debuffType
        ? `SLOWED ${Math.round(ps.player.speedMultiplier * 100)}%` : '';
      h.debuffT.setText(debuff);
      h.sprintT.setText(ps.sprintTimer > 0 ? `SPRINT ${(ps.sprintTimer / 1000).toFixed(1)}s` : '');
    }

    this.gapText.setText(`GAP  ${Math.round(gap)}`);
    this.gapText.setColor(gap >= GAP_WARNING ? '#FF9900' : '#445566');
  }

  _checkGapElimination() {
    const [a, b] = this.ps;
    if ((a.gs !== 'RUNNING' && a.gs !== 'REACTIVE') ||
        (b.gs !== 'RUNNING' && b.gs !== 'REACTIVE')) return;
    const gap = Math.abs(a.trackPosition - b.trackPosition);
    if (gap >= GAP_ELIMINATION) {
      const trailer = a.trackPosition < b.trackPosition ? a : b;
      this._endP(trailer, 'LEFT BEHIND');
    }
  }

  _updatePlayerLabels() {
    for (const ps of this.ps) {
      const vx = ps.player.x + ps.player.visualOffsetX;
      const vy = ps.player.y;
      ps.label.setPosition(vx, vy - 24);
      if (ps.gs === 'ELIMINATED' || ps.gs === 'LEFT BEHIND') {
        ps.label.setText(`P${ps.idx + 1} OUT`);
      } else if (ps.gs === 'COMPLETE') {
        ps.label.setText(`P${ps.idx + 1} ✓`);
      } else {
        ps.label.setText(`P${ps.idx + 1}`);
      }
    }
  }

  _updateWarningArrow() {
    const [a, b] = this.ps;
    const bothActive = (a.gs === 'RUNNING' || a.gs === 'REACTIVE') &&
                       (b.gs === 'RUNNING' || b.gs === 'REACTIVE');
    this.warningArrow.clear();
    this.warningText.setText('');
    if (!bothActive) return;

    const gap = Math.abs(a.trackPosition - b.trackPosition);
    if (gap < GAP_WARNING) return;

    const trailer = a.trackPosition < b.trackPosition ? a : b;
    const ax = trailer.player.x + trailer.player.visualOffsetX;
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 150);
    this.warningArrow.fillStyle(0xFF9900, pulse);
    const ay = CANVAS_H - 6;
    this.warningArrow.fillTriangle(ax, ay, ax - 11, ay - 18, ax + 11, ay - 18);
    this.warningText.setPosition(ax, ay - 20);
    this.warningText.setText(`-${Math.round(gap)}`);
  }

  _endP(ps, result) {
    if (ps.gs !== 'RUNNING' && ps.gs !== 'REACTIVE') return;
    ps.gs = result;
    const dist = Math.floor(ps.trackPosition);
    ps.reactiveOverlay.clear();
    ps.reactiveText.setText('');

    const isWin   = result === 'COMPLETE';
    const color   = isWin ? '#66EE88' : '#EE5544';
    const msgLine = isWin
      ? `P${ps.idx + 1} COMPLETE!\n${dist} / ${this.trackData.length}`
      : result === 'LEFT BEHIND'
        ? `P${ps.idx + 1} LEFT BEHIND\n${dist} / ${this.trackData.length}`
        : `P${ps.idx + 1} ELIMINATED\n${dist} / ${this.trackData.length}`;

    const flash = this.add.text(CANVAS_W / 2, CANVAS_H / 2, msgLine, {
      fontSize: '34px', fontFamily: 'monospace', color,
      align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.tweens.add({
      targets: flash, alpha: 1, duration: 180,
      onComplete: () => {
        this.time.delayedCall(1300, () => {
          this.tweens.add({ targets: flash, alpha: 0, duration: 250,
            onComplete: () => flash.destroy() });
        });
      }
    });
  }

  _check2PEnd() {
    if (this._2pEnded) return;
    const done = ps => ps.gs !== 'RUNNING' && ps.gs !== 'REACTIVE';
    if (!this.ps.every(done)) return;
    this._endRun2P();
  }

  _endRun2P() {
    if (this._2pEnded) return;
    this._2pEnded = true;

    const players = this.ps.map(ps => {
      const distance  = Math.floor(ps.trackPosition);
      const elapsedMs = this.time.now - ps.startTime;
      appendLog({
        track: this.trackData.id, loadout: ps.loadout,
        outcome: ps.gs === 'COMPLETE' ? 'complete' : 'failed',
        distance, elapsedMs: Math.round(elapsedMs),
        boostUses: { ...ps.boostUseCount },
        laneTimeMs: [...ps.laneTimeMs],
        planningTimeMs: this.planningTimeMs,
        mode: '2p', player: ps.idx + 1
      });
      return {
        result:  ps.gs,
        distance,
        elapsed: parseFloat((elapsedMs / 1000).toFixed(2)),
        loadout: ps.loadout
      };
    });

    this.scene.start('ResultScene', {
      mode: '2p', trackData: this.trackData, players
    });
  }
}
