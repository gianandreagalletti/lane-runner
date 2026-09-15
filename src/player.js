import {
  LANE_CENTERS,
  PLAYER_Y,
  LANE_SWITCH_MS
} from './track.js';

const PLAYER_W   = 40;
const PLAYER_H   = 40;
const CORNER_R   = 8;
const FLASH_DUR  = 350; // ms the body-color flash lasts after debuff hit

export class Player {
  constructor(scene, opts = {}) {
    this.scene = scene;

    this.lane            = 1;
    this.x               = LANE_CENTERS[1];
    this.y               = PLAYER_Y;

    this.isTweening      = false;
    this.pendingDir      = null;
    this.switchDuration  = opts.instantSwitch ? 0 : LANE_SWITCH_MS;

    this.speedMultiplier = 1;
    this.debuffTimer     = 0;
    this.debuffType      = null;
    this.flashTimer      = 0; // counts down from FLASH_DUR, drives body-color tint

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
      this.x = LANE_CENTERS[newLane];
      this.lane = newLane;
      this.isTweening = false;
      if (this.pendingDir !== null) {
        const pd = this.pendingDir; this.pendingDir = null; this.switchLane(pd);
      }
    } else {
      this.scene.tweens.add({
        targets: this, x: LANE_CENTERS[newLane],
        duration: this.switchDuration, ease: 'Sine.easeInOut',
        onComplete: () => {
          this.lane = newLane; this.isTweening = false;
          if (this.pendingDir !== null) {
            const pd = this.pendingDir; this.pendingDir = null; this.switchLane(pd);
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
      this.flashTimer      = FLASH_DUR;
    } else if (type === 'water') {
      this.speedMultiplier = 0.3;
      this.debuffTimer     = 2000;
      this.debuffType      = 'water';
      this.flashTimer      = FLASH_DUR;
    }
  }

  update(delta) {
    if (this.debuffTimer > 0) {
      this.debuffTimer -= delta;
      if (this.debuffTimer <= 0) {
        this.debuffTimer = 0; this.speedMultiplier = 1; this.debuffType = null;
      }
    }
    if (this.flashTimer > 0) this.flashTimer -= delta;
    this._draw();
  }

  destroy() { this.graphics.destroy(); }

  _draw() {
    const g = this.graphics;
    g.clear();

    // Persistent glow when debuffed
    if (this.debuffType === 'ice') {
      g.fillStyle(0xB8D8E8, 0.40);
      g.fillRoundedRect(this.x - 26, this.y - 26, 52, 52, 12);
    } else if (this.debuffType === 'water') {
      g.fillStyle(0x3AA8C4, 0.40);
      g.fillRoundedRect(this.x - 26, this.y - 26, 52, 52, 12);
    }

    // Body — flashes to debuff color when first hit, fades back to white
    let bodyColor = 0xFFFFFF;
    if (this.flashTimer > 0 && this.debuffType) {
      const t = this.flashTimer / FLASH_DUR; // 1 → 0
      // Lerp: white (FF) toward debuff color
      const flashCol = this.debuffType === 'ice' ? 0x88CCFF : 0x44CCEE;
      bodyColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(flashCol),
        Phaser.Display.Color.ValueToColor(0xFFFFFF),
        100, Math.round((1 - t) * 100)
      );
      bodyColor = Phaser.Display.Color.GetColor(bodyColor.r, bodyColor.g, bodyColor.b);
    }

    g.fillStyle(bodyColor);
    g.fillRoundedRect(this.x - PLAYER_W / 2, this.y - PLAYER_H / 2, PLAYER_W, PLAYER_H, CORNER_R);
  }
}
