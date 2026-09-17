import Phaser from 'phaser';
import { LANE_CENTERS } from './track.js';
import { LANE_SWITCH_TICKS, FLASH_TICKS } from '../sim/rules.js';

const PLAYER_W  = 40;
const PLAYER_H  = 40;
const CORNER_R  = 8;

export class Player {
  constructor(scene, opts = {}) {
    this.scene         = scene;
    this.visualOffsetX = opts.visualOffsetX || 0;
    this.baseBodyColor = opts.bodyColor || 0xFFFFFF;
    this.x             = LANE_CENTERS[1]; // logical x for label positioning
    this.y             = 0;
    this.graphics      = scene.add.graphics();
  }

  // ps = player state object from sim
  render(ps) {
    const g = this.graphics;
    g.clear();
    g.setAlpha(ps.drawAlpha);

    // Compute visual X: lerp during lane switch animation
    let laneX;
    if (ps.laneVisualTicksLeft > 0) {
      const t = 1 - ps.laneVisualTicksLeft / LANE_SWITCH_TICKS;
      const fromX = LANE_CENTERS[ps.laneVisualFrom];
      const toX   = LANE_CENTERS[ps.lane];
      laneX = fromX + (toX - fromX) * t;
    } else {
      laneX = LANE_CENTERS[ps.lane];
    }
    this.x = LANE_CENTERS[ps.lane]; // logical x (for labels)
    const drawX = laneX + this.visualOffsetX;
    const drawY = this.y;

    // Debuff glow
    if (ps.debuffType === 'ice') {
      g.fillStyle(0xB8D8E8, 0.40);
      g.fillRoundedRect(drawX - 26, drawY - 26, 52, 52, 12);
    } else if (ps.debuffType === 'water') {
      g.fillStyle(0x3AA8C4, 0.40);
      g.fillRoundedRect(drawX - 26, drawY - 26, 52, 52, 12);
    }

    // Body colour with flash
    let bodyColor = this.baseBodyColor;
    if (ps.flashTicksLeft > 0 && ps.debuffType) {
      const t = ps.flashTicksLeft / FLASH_TICKS;
      const flashCol = ps.debuffType === 'ice' ? 0x88CCFF : 0x44CCEE;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(flashCol),
        Phaser.Display.Color.ValueToColor(this.baseBodyColor),
        100, Math.round((1 - t) * 100)
      );
      bodyColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }

    g.fillStyle(bodyColor);
    g.fillRoundedRect(drawX - PLAYER_W / 2, drawY - PLAYER_H / 2, PLAYER_W, PLAYER_H, CORNER_R);
  }

  destroy() { this.graphics.destroy(); }
}
