import {
  LANE_CENTERS,
  PLAYER_Y,
  LANE_SWITCH_MS
} from './track.js';

const PLAYER_W = 40;
const PLAYER_H = 40;
const CORNER_R = 8;

export class Player {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ instantSwitch?: boolean }} opts
   */
  constructor(scene, opts = {}) {
    this.scene = scene;

    // Lane state
    this.lane       = 1;
    this.x          = LANE_CENTERS[1];
    this.y          = PLAYER_Y;

    // Tween / queue
    this.isTweening  = false;
    this.pendingDir  = null;
    this.switchDuration = opts.instantSwitch ? 0 : LANE_SWITCH_MS;

    // Speed debuff state
    this.speedMultiplier = 1;
    this.debuffTimer     = 0;
    this.debuffType      = null;

    this.graphics = scene.add.graphics();
    this._draw();
  }

  switchLane(dir) {
    if (this.isTweening) {
      const wouldBe = this.lane + dir;
      if (wouldBe >= 0 && wouldBe <= 2) this.pendingDir = dir;
      return;
    }
    const newLane = this.lane + dir;
    if (newLane < 0 || newLane > 2) return;

    this.isTweening = true;

    if (this.switchDuration === 0) {
      // Instant switch — no tween needed
      this.x          = LANE_CENTERS[newLane];
      this.lane       = newLane;
      this.isTweening = false;
      if (this.pendingDir !== null) {
        const pd        = this.pendingDir;
        this.pendingDir = null;
        this.switchLane(pd);
      }
    } else {
      this.scene.tweens.add({
        targets:  this,
        x:        LANE_CENTERS[newLane],
        duration: this.switchDuration,
        ease:     'Sine.easeInOut',
        onComplete: () => {
          this.lane       = newLane;
          this.isTweening = false;
          if (this.pendingDir !== null) {
            const pd        = this.pendingDir;
            this.pendingDir = null;
            this.switchLane(pd);
          }
        }
      });
    }
  }

  applyDebuff(type) {
    if (type === 'ice') {
      this.speedMultiplier = 0.5;
      this.debuffTimer     = 2000;
      this.debuffType      = 'ice';
    } else if (type === 'water') {
      this.speedMultiplier = 0.3;
      this.debuffTimer     = 2000;
      this.debuffType      = 'water';
    }
  }

  update(delta) {
    if (this.debuffTimer > 0) {
      this.debuffTimer -= delta;
      if (this.debuffTimer <= 0) {
        this.debuffTimer     = 0;
        this.speedMultiplier = 1;
        this.debuffType      = null;
      }
    }
    this._draw();
  }

  destroy() {
    this.graphics.destroy();
  }

  _draw() {
    const g = this.graphics;
    g.clear();

    if (this.debuffType === 'ice') {
      g.fillStyle(0xB8D8E8, 0.35);
      g.fillRoundedRect(this.x - 24, this.y - 24, 48, 48, 10);
    } else if (this.debuffType === 'water') {
      g.fillStyle(0x3AA8C4, 0.35);
      g.fillRoundedRect(this.x - 24, this.y - 24, 48, 48, 10);
    }

    g.fillStyle(0xFFFFFF);
    g.fillRoundedRect(
      this.x - PLAYER_W / 2,
      this.y - PLAYER_H / 2,
      PLAYER_W,
      PLAYER_H,
      CORNER_R
    );
  }
}
