import Phaser from 'phaser';
import { Player }    from './player.js';
import { Obstacles } from './obstacles.js';
import { BOOSTS }    from './boosts.js';
import {
  CANVAS_W, CANVAS_H,
  LANE_WIDTH, LANE_GAP, LANE_START_X, LANE_COLORS,
  BASE_SPEED
} from './track.js';

// Reactive window: how long (ms) the player has to press a reactive boost
// after a lethal collision before death resolves.
const REACTIVE_WINDOW_MS = 250;

export class RunScene extends Phaser.Scene {
  constructor() { super({ key: 'RunScene' }); }

  init(data) {
    this.trackData = data.trackData;
    this.loadout   = data.loadout;      // array of 3 boost IDs
    this.boostSet  = new Set(data.loadout);
  }

  create() {
    this.trackPosition  = 0;
    this.startTime      = this.time.now;
    // gameState: 'RUNNING' | 'REACTIVE' | 'COMPLETE' | 'FAILED'
    this.gameState      = 'RUNNING';

    // Sprint state (managed here, not in Player)
    this.sprintTimer      = 0;
    this.sprintMultiplier = 1;

    // Reactive window state
    this.reactiveTimer   = 0;
    this.reactiveObs     = null; // the pending lethal obstacle

    // Build per-slot boost state: { id, uses, isActive, isReactive }
    this.slots = this.loadout.map(id => {
      const b = BOOSTS[id];
      return {
        id,
        uses:       b.type === 'active' ? b.usesPerRun : null,
        isActive:   b.type === 'active',
        isReactive: b.type === 'active' ? b.reactive : false
      };
    });

    // Lane backgrounds
    this.laneGfx = this.add.graphics();
    this._drawLanes();

    // Obstacles
    this.obstacles = new Obstacles(this, this.trackData);

    // Player
    this.player = new Player(this, {
      instantSwitch: this.boostSet.has('quick_step')
    });

    // Reactive overlay (red flash — hidden until reactive window)
    this.reactiveOverlay = this.add.graphics();

    // HUD
    this.distText = this.add.text(20, 14, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#AAAAAA'
    });
    this.speedText = this.add.text(CANVAS_W - 20, 14, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#FFD966'
    }).setOrigin(1, 0);

    // Boost HUD (top center)
    this._buildBoostHud();

    // Reactive countdown text (shown during reactive window)
    this.reactiveText = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 60, '', {
      fontSize: '32px', fontFamily: 'monospace', color: '#FFFF00', align: 'center'
    }).setOrigin(0.5).setDepth(10);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
  }

  update(_t, delta) {
    if (this.gameState === 'RUNNING') {
      this._runUpdate(delta);
    } else if (this.gameState === 'REACTIVE') {
      this._reactiveUpdate(delta);
    }
    // COMPLETE / FAILED handled by ResultScene
  }

  // ── Normal frame ──────────────────────────────────────────────────────────

  _runUpdate(delta) {
    // Tick sprint
    if (this.sprintTimer > 0) {
      this.sprintTimer -= delta;
      if (this.sprintTimer <= 0) {
        this.sprintTimer      = 0;
        this.sprintMultiplier = 1;
      }
    }

    // Advance track
    const speed = BASE_SPEED * this.player.speedMultiplier * this.sprintMultiplier;
    this.trackPosition += speed * (delta / 1000);

    // Lane input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left))  this.player.switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.player.switchLane(1);

    // Active boost keys (non-reactive: sprint only)
    if (Phaser.Input.Keyboard.JustDown(this.key1)) this._tryActivate(0);
    if (Phaser.Input.Keyboard.JustDown(this.key2)) this._tryActivate(1);
    if (Phaser.Input.Keyboard.JustDown(this.key3)) this._tryActivate(2);

    // Update subsystems
    this.player.update(delta);
    this.obstacles.update(this.trackPosition);

    // Collision check
    const hit = this.obstacles.checkCollision(this.player.x);
    if (hit) {
      if (hit.type === 'rock') {
        // Lethal — enter reactive window
        this._enterReactive(hit);
        return;
      }
      // Non-lethal
      this.obstacles.markHit(hit);
      if (hit.type === 'ice'   && !this.boostSet.has('ice_grip'))     this.player.applyDebuff('ice');
      if (hit.type === 'water' && !this.boostSet.has('water_shield')) this.player.applyDebuff('water');
    }

    // Completion
    if (this.trackPosition >= this.trackData.length) {
      this._endRun('COMPLETE');
      return;
    }

    // HUD
    this._refreshHud();
  }

  // ── Reactive window frame ─────────────────────────────────────────────────

  _reactiveUpdate(delta) {
    this.reactiveTimer -= delta;
    // obstacles.update keeps screenY fresh so the pending obs stays visible
    this.obstacles.update(this.trackPosition);

    // Pulse the red overlay based on time remaining
    const frac    = Math.max(0, this.reactiveTimer / REACTIVE_WINDOW_MS);
    const alpha   = 0.25 + 0.25 * Math.sin(Date.now() / 40); // pulse
    this.reactiveOverlay.clear();
    this.reactiveOverlay.fillStyle(0xFF2200, alpha * frac + 0.1);
    this.reactiveOverlay.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Show reactive prompt with which keys can save them
    const reactiveSlots = this.slots
      .map((s, i) => ({ ...s, idx: i }))
      .filter(s => s.isReactive && s.uses > 0);
    const keyHints = reactiveSlots.map(s => `[${s.idx + 1}] ${BOOSTS[s.id].name}`).join('  ');
    this.reactiveText.setText(keyHints ? `REACT!\n${keyHints}` : 'NO BOOST');

    // Check boost keys
    if (Phaser.Input.Keyboard.JustDown(this.key1)) this._tryReactiveBoost(0);
    if (Phaser.Input.Keyboard.JustDown(this.key2)) this._tryReactiveBoost(1);
    if (Phaser.Input.Keyboard.JustDown(this.key3)) this._tryReactiveBoost(2);

    // Timer expired → death
    if (this.reactiveTimer <= 0) {
      this._resolveReactiveDeath();
    }
  }

  _enterReactive(obs) {
    this.gameState     = 'REACTIVE';
    this.reactiveTimer = REACTIVE_WINDOW_MS;
    this.reactiveObs   = obs;
    this.obstacles.markPending(obs);
  }

  _tryReactiveBoost(slotIdx) {
    const slot = this.slots[slotIdx];
    if (!slot || !slot.isActive || !slot.isReactive || slot.uses <= 0) return;

    const id = slot.id;
    if (id === 'rock_break' && this.reactiveObs.type !== 'rock') return;
    // phase works on any lethal obstacle (currently only rock)

    // Consume and cancel death
    slot.uses--;
    this._refreshHudSlot(slotIdx);
    this.obstacles.clearPending(this.reactiveObs);
    this.reactiveObs = null;
    this._clearReactive();
  }

  _resolveReactiveDeath() {
    // Mark the obstacle as hit (it disappears), then end
    if (this.reactiveObs) {
      this.obstacles.markHit(this.reactiveObs);
      this.reactiveObs = null;
    }
    this._clearReactive();
    this._endRun('FAILED');
  }

  _clearReactive() {
    this.gameState = this.gameState === 'REACTIVE' ? 'RUNNING' : this.gameState;
    this.reactiveOverlay.clear();
    this.reactiveText.setText('');
  }

  // ── Boost activation (non-reactive, during RUNNING) ───────────────────────

  _tryActivate(slotIdx) {
    const slot = this.slots[slotIdx];
    if (!slot || !slot.isActive || slot.isReactive) return; // reactive-only = handled in reactive window
    if (slot.uses <= 0) return;

    if (slot.id === 'sprint') {
      slot.uses--;
      this.sprintTimer      = 4000;
      this.sprintMultiplier = 1.4;
      this._refreshHudSlot(slotIdx);
    }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────

  _buildBoostHud() {
    const spacing = 226;
    const startX  = CANVAS_W / 2 - spacing;
    this.hudSlotRefs = [];

    this.slots.forEach((slot, i) => {
      const x     = startX + i * spacing;
      const boost = BOOSTS[slot.id];
      const isP   = !slot.isActive;

      const chip = this.add.rectangle(x, 22, 204, 30, isP ? 0x162a20 : 0x1e1614)
        .setStrokeStyle(1, isP ? 0x336644 : 0x443322);

      this.add.text(x - 72, 22, `[${i + 1}]`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#334455'
      }).setOrigin(0, 0.5);

      const nameT = this.add.text(x - 52, 22, boost.name, {
        fontSize: '13px', fontFamily: 'monospace',
        color: isP ? '#88DDAA' : '#AA9966'
      }).setOrigin(0, 0.5);

      let usesT = null;
      if (slot.isActive) {
        usesT = this.add.text(x + 72, 22, this._usesLabel(slot), {
          fontSize: '12px', fontFamily: 'monospace', color: '#44FF88'
        }).setOrigin(1, 0.5);
      } else {
        this.add.text(x + 72, 22, 'ACTIVE', {
          fontSize: '11px', fontFamily: 'monospace', color: '#44FF88'
        }).setOrigin(1, 0.5);
      }

      this.hudSlotRefs.push({ chip, nameT, usesT });
    });

    // Sprint timer text (below HUD)
    this.sprintText = this.add.text(CANVAS_W / 2, 48, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FFDD44'
    }).setOrigin(0.5, 0);
  }

  _usesLabel(slot) {
    if (slot.uses === null) return '';
    return slot.uses > 0 ? `×${slot.uses}` : 'SPENT';
  }

  _refreshHudSlot(slotIdx) {
    const ref  = this.hudSlotRefs[slotIdx];
    const slot = this.slots[slotIdx];
    if (!ref.usesT) return;
    ref.usesT.setText(this._usesLabel(slot));
    ref.usesT.setColor(slot.uses > 0 ? '#44FF88' : '#443333');
    ref.nameT.setColor(slot.uses > 0 ? '#AA9966' : '#554444');
    ref.chip.setStrokeStyle(1, slot.uses > 0 ? 0x443322 : 0x2a1a1a);
  }

  _refreshHud() {
    this.distText.setText(`DIST: ${Math.floor(this.trackPosition)} / ${this.trackData.length}`);

    // Speed display: debuff and/or sprint
    const parts = [];
    if (this.player.debuffType) {
      const pct = Math.round(this.player.speedMultiplier * 100);
      parts.push(`SLOWED ${pct}%`);
    }
    if (this.sprintTimer > 0) {
      const secs = (this.sprintTimer / 1000).toFixed(1);
      this.sprintText.setText(`SPRINT ${secs}s`);
    } else {
      this.sprintText.setText('');
    }
    this.speedText.setText(parts.join('  '));
  }

  // ── Lane drawing ──────────────────────────────────────────────────────────

  _drawLanes() {
    for (let i = 0; i < 3; i++) {
      const x = LANE_START_X + i * (LANE_WIDTH + LANE_GAP);
      this.laneGfx.fillStyle(LANE_COLORS[i]);
      this.laneGfx.fillRect(x, 0, LANE_WIDTH, CANVAS_H);
      this.laneGfx.lineStyle(1, 0xFFFFFF, 0.08);
      this.laneGfx.strokeRect(x, 0, LANE_WIDTH, CANVAS_H);
    }
  }

  // ── End run ───────────────────────────────────────────────────────────────

  _endRun(result) {
    this.gameState = result;
    const elapsed  = parseFloat(((this.time.now - this.startTime) / 1000).toFixed(2));
    const distance = Math.floor(this.trackPosition);
    this.scene.start('ResultScene', {
      result, distance, elapsed,
      trackData: this.trackData,
      loadout:   this.loadout
    });
  }
}
