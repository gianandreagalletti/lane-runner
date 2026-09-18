import Phaser from 'phaser';
import { LANE_SWITCH_TICKS, FLASH_TICKS } from '../sim/rules.js';
import { PROJ, LANE_TU, project } from './render/projection.js';

// Billboard size in track units
const BILL_W_TU = 44;
const BILL_H_TU = 58;

export class Player {
  constructor(scene, opts = {}) {
    this.scene            = scene;
    this.visualOffsetX_TU = opts.visualOffsetX || 0;  // track units (±45 or 0)
    this.baseBodyColor    = opts.bodyColor || 0xFFFFFF;

    // Expose x/y in screen pixels for HUD/label positioning
    this.x  = 640;
    this.y  = 0;
    this.screenScale = 1;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(3);
  }

  hide() {
    this.graphics.clear();
  }

  /**
   * @param {object} ps        - player state from sim
   * @param {number} cameraZ   - camera position in track units
   * @param {number} playerIdx - 0-based index (unused currently, for future use)
   */
  render(ps, cameraZ, playerIdx) {
    const g = this.graphics;
    g.clear();
    g.setAlpha(ps.drawAlpha);

    const zRel = ps.trackPosition / 100 - cameraZ; // CENTI_SCALE = 100
    if (zRel < PROJ.NEAR_CLAMP || zRel > PROJ.DRAW_DISTANCE) {
      return;
    }

    // Compute visual X: lerp during lane-switch animation
    let laneOffsetTU;
    if (ps.laneVisualTicksLeft > 0) {
      const t = 1 - ps.laneVisualTicksLeft / LANE_SWITCH_TICKS;
      const fromTU = LANE_TU[ps.laneVisualFrom];
      const toTU   = LANE_TU[ps.lane];
      laneOffsetTU = fromTU + (toTU - fromTU) * t;
    } else {
      laneOffsetTU = LANE_TU[ps.lane];
    }

    const worldX = laneOffsetTU + this.visualOffsetX_TU;
    const { x, y, scale } = project(worldX, zRel);

    // Store screen position for HUD/label use
    this.x = x;
    this.y = y;
    this.screenScale = scale;

    const bw = BILL_W_TU * scale;
    const bh = BILL_H_TU * scale;
    const bx = x - bw / 2;
    const by = y - bh;       // bottom of billboard at projected ground point
    const cornerR = Math.max(2, bw * 0.12);

    // Fog factor
    const fogT = PROJ.FOG_ENABLED
      ? Math.min(Math.pow(zRel / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
      : 0;

    // --- Soft elliptical shadow ---
    const shadowW = bw * 1.1;
    const shadowH = bh * 0.12;
    g.fillStyle(0x000000, 0.35 * (1 - fogT));
    g.fillEllipse(x, y + shadowH * 0.3, shadowW, shadowH);

    // --- Draft slipstream indicator ---
    if (ps.isDrafting) {
      g.lineStyle(2, 0xAAEEFF, 0.55);
      // Two small chevrons above the billboard
      const chevW = bw * 0.35;
      const chevH = bh * 0.1;
      for (let ci = 0; ci < 2; ci++) {
        const chevY = by - 6 - ci * 7;
        g.beginPath();
        g.moveTo(x - chevW, chevY + chevH);
        g.lineTo(x,         chevY);
        g.lineTo(x + chevW, chevY + chevH);
        g.strokePath();
      }
    }

    // --- Debuff glow ---
    if (ps.debuffType === 'ice') {
      g.fillStyle(0xB8D8E8, 0.35);
      g.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, cornerR + 2);
    } else if (ps.debuffType === 'water') {
      g.fillStyle(0x3AA8C4, 0.35);
      g.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, cornerR + 2);
    } else if (ps.debuffType === 'snipe') {
      g.fillStyle(0xFF6644, 0.35);
      g.fillRoundedRect(bx - 4, by - 4, bw + 8, bh + 8, cornerR + 2);
    }

    // --- Body colour with flash ---
    let bodyColor = this.baseBodyColor;
    if (ps.flashTicksLeft > 0 && ps.debuffType) {
      const t = ps.flashTicksLeft / FLASH_TICKS;
      const flashCol = ps.debuffType === 'ice' ? 0x88CCFF :
                       ps.debuffType === 'snipe' ? 0xFF6644 : 0x44CCEE;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(flashCol),
        Phaser.Display.Color.ValueToColor(this.baseBodyColor),
        100, Math.round((1 - t) * 100)
      );
      bodyColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }

    // Apply fog to body colour
    if (fogT > 0) {
      const fc = {
        r: (bodyColor >> 16) & 0xFF,
        g: (bodyColor >>  8) & 0xFF,
        b:  bodyColor        & 0xFF,
      };
      const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
      bodyColor = (clamp(fc.r + (0x3C - fc.r) * fogT) << 16) |
                  (clamp(fc.g + (0x5A - fc.g) * fogT) <<  8) |
                   clamp(fc.b + (0x6B - fc.b) * fogT);
    }

    g.fillStyle(bodyColor);
    g.fillRoundedRect(bx, by, bw, bh, cornerR);

    // --- Darker band across lower third for volume ---
    const bandY = by + bh * 0.65;
    const bandH = bh * 0.28;
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(bx, bandY, bw, bandH, { bl: cornerR, br: cornerR, tl: 0, tr: 0 });

    // --- Sprint streaks ---
    if (ps.sprintTicksLeft > 0) {
      g.lineStyle(1, 0xFFFF88, 0.5);
      const streakCount = 3;
      for (let i = 0; i < streakCount; i++) {
        const sx = bx + bw * (0.2 + i * 0.3);
        const sy = by + bh * 0.2;
        const len = bh * (0.25 + i * 0.08);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - bw * 0.05, sy + len); g.strokePath();
      }
    }
  }

  destroy() { this.graphics.destroy(); }
}
