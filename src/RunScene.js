import Phaser from 'phaser';
import { Player }     from './player.js';
import { Obstacles }  from './obstacles.js';
import { BOOSTS }     from './boosts.js';
import { spawnBurst } from './particles.js';
import { appendLog }  from './sessionLog.js';
import {
  CANVAS_W, CANVAS_H,
  LANE_WIDTH, LANE_GAP, LANE_START_X, LANE_COLORS,
  BASE_SPEED, LANE_CENTERS
} from './track.js';

const REACTIVE_WINDOW_MS = 250;

export class RunScene extends Phaser.Scene {
  constructor() { super({ key: 'RunScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.loadout        = data.loadout;
    this.boostSet       = new Set(data.loadout);
    this.planningTimeMs = data.planningTimeMs ?? 0;
  }

  create() {
    this.trackPosition  = 0;
    this.startTime      = this.time.now;
    this.gameState      = 'RUNNING'; // 'RUNNING'|'REACTIVE'|'COMPLETE'|'FAILED'

    this.sprintTimer      = 0;
    this.sprintMultiplier = 1;
    this.reactiveTimer    = 0;
    this.reactiveObs      = null;

    // Telemetry
    this.laneTimeMs   = [0, 0, 0];
    this.boostUseCount = {};
    this.loadout.forEach(id => { this.boostUseCount[id] = 0; });

    this.slots = this.loadout.map(id => {
      const b = BOOSTS[id];
      return { id, uses: b.type === 'active' ? b.usesPerRun : null,
               isActive: b.type === 'active',
               isReactive: b.type === 'active' ? b.reactive : false };
    });

    this.laneGfx = this.add.graphics();
    this._drawLanes();

    this.obstacles       = new Obstacles(this, this.trackData);
    this.player          = new Player(this, { instantSwitch: this.boostSet.has('quick_step') });
    this.reactiveOverlay = this.add.graphics();

    // HUD — higher contrast colors
    this.distText = this.add.text(20, 14, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#DDDDDD', stroke: '#000000', strokeThickness: 3
    });
    this.speedText = this.add.text(CANVAS_W - 20, 14, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000000', strokeThickness: 3
    }).setOrigin(1, 0);

    this._buildBoostHud();

    this.reactiveText = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 70, '', {
      fontSize: '36px', fontFamily: 'monospace', color: '#FFFF00',
      align: 'center', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.key1    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
  }

  update(_t, delta) {
    if (this.gameState === 'RUNNING')  this._runUpdate(delta);
    else if (this.gameState === 'REACTIVE') this._reactiveUpdate(delta);
  }

  _runUpdate(delta) {
    // Lane time tracking
    this.laneTimeMs[this.player.lane] += delta;

    if (this.sprintTimer > 0) {
      this.sprintTimer -= delta;
      if (this.sprintTimer <= 0) { this.sprintTimer = 0; this.sprintMultiplier = 1; }
    }

    const speed = BASE_SPEED * this.player.speedMultiplier * this.sprintMultiplier;
    this.trackPosition += speed * (delta / 1000);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left))  this.player.switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.player.switchLane(1);
    if (Phaser.Input.Keyboard.JustDown(this.key1)) this._tryActivate(0);
    if (Phaser.Input.Keyboard.JustDown(this.key2)) this._tryActivate(1);
    if (Phaser.Input.Keyboard.JustDown(this.key3)) this._tryActivate(2);

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

  _reactiveUpdate(delta) {
    this.reactiveTimer -= delta;
    this.obstacles.update(this.trackPosition);

    const frac = Math.max(0, this.reactiveTimer / REACTIVE_WINDOW_MS);
    this.reactiveOverlay.clear();
    this.reactiveOverlay.fillStyle(0xFF2200, 0.15 + 0.3 * frac * (0.6 + 0.4 * Math.sin(Date.now() / 35)));
    this.reactiveOverlay.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const reactSlots = this.slots.map((s,i) => ({...s,idx:i})).filter(s => s.isReactive && s.uses > 0);
    const hints = reactSlots.map(s => `[${s.idx+1}] ${BOOSTS[s.id].name}`).join('  ');
    this.reactiveText.setText(hints ? `REACT!\n${hints}` : 'NO BOOST');

    if (Phaser.Input.Keyboard.JustDown(this.key1)) this._tryReactiveBoost(0);
    if (Phaser.Input.Keyboard.JustDown(this.key2)) this._tryReactiveBoost(1);
    if (Phaser.Input.Keyboard.JustDown(this.key3)) this._tryReactiveBoost(2);

    if (this.reactiveTimer <= 0) this._resolveReactiveDeath();
  }

  _enterReactive(obs) {
    this.gameState = 'REACTIVE'; this.reactiveTimer = REACTIVE_WINDOW_MS;
    this.reactiveObs = obs; this.obstacles.markPending(obs);
  }

  _tryReactiveBoost(slotIdx) {
    const slot = this.slots[slotIdx];
    if (!slot || !slot.isActive || !slot.isReactive || slot.uses <= 0) return;
    if (slot.id === 'rock_break' && this.reactiveObs.type !== 'rock') return;

    slot.uses--;
    this.boostUseCount[slot.id]++;
    this._refreshHudSlot(slotIdx);

    // Particle burst at obstacle position
    const obsX = LANE_CENTERS[this.reactiveObs.lane];
    spawnBurst(this, obsX, this.reactiveObs.screenY, 0xFF6633, 16);

    this.obstacles.clearPending(this.reactiveObs);
    this.reactiveObs = null;
    this._clearReactive();
  }

  _resolveReactiveDeath() {
    if (this.reactiveObs) { this.obstacles.markHit(this.reactiveObs); this.reactiveObs = null; }
    this._clearReactive();
    // Screen shake on death
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
      this.add.text(x - 78, 22, `[${i+1}]`, { fontSize:'11px', fontFamily:'monospace', color:'#556677' }).setOrigin(0,0.5);
      const nameT = this.add.text(x - 58, 22, boost.name, {
        fontSize:'13px', fontFamily:'monospace', color: isP ? '#AAFFCC' : '#FFCC88'
      }).setOrigin(0, 0.5);
      let usesT = null;
      if (slot.isActive) {
        usesT = this.add.text(x + 76, 22, this._usesLabel(slot), {
          fontSize:'13px', fontFamily:'monospace', color:'#55FF88', stroke:'#000', strokeThickness:2
        }).setOrigin(1, 0.5);
      } else {
        this.add.text(x + 76, 22, 'ON', { fontSize:'12px', fontFamily:'monospace', color:'#55FF88', stroke:'#000',strokeThickness:2 }).setOrigin(1,0.5);
      }
      this.hudSlotRefs.push({ chip, nameT, usesT });
    });
    this.sprintText = this.add.text(CANVAS_W / 2, 50, '', {
      fontSize:'14px', fontFamily:'monospace', color:'#FFEE55', stroke:'#000', strokeThickness:2
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
    if (this.player.debuffType) parts.push(`SLOWED ${Math.round(this.player.speedMultiplier*100)}%`);
    this.speedText.setText(parts.join('  '));
    this.sprintText.setText(this.sprintTimer > 0 ? `SPRINT ${(this.sprintTimer/1000).toFixed(1)}s` : '');
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
      track:          this.trackData.id,
      loadout:        this.loadout,
      outcome:        result === 'COMPLETE' ? 'complete' : 'failed',
      distance,
      elapsedMs:      Math.round(elapsedMs),
      boostUses:      { ...this.boostUseCount },
      laneTimeMs:     [...this.laneTimeMs],
      planningTimeMs: this.planningTimeMs
    });

    this.scene.start('ResultScene', {
      result, distance, elapsed: parseFloat((elapsedMs / 1000).toFixed(2)),
      trackData: this.trackData, loadout: this.loadout
    });
  }
}
