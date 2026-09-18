import Phaser from 'phaser';
import { LANE_SWITCH_TICKS, FLASH_TICKS, DRAFT_RANGE_CU, DRAFT_MAX_BONUS } from '../sim/rules.js';
import { PROJ, LANE_TU, project } from './render/projection.js';

// Wake geometry constants (derived from draft constants — single source of truth)
const DRAFT_RANGE_TU = DRAFT_RANGE_CU / 100;  // 260 track units (CENTI_SCALE=100)

// Billboard width in track units (same for all vehicles)
const BILL_W_TU = 44;
// Heights per vehicle slot: ambulance, fire truck, police
const BILL_HEIGHTS = [66, 62, 54];

// Vehicle body colours
const VEHICLE_BODIES  = [0xF0F0F0, 0xC4463A, 0x1A2A6C];
const VEHICLE_STRIPES = [0xE03030, 0xFFFFFF, 0xFFFFFF];

// Light bar colours per vehicle: [even-tick colour, odd-tick colour]
const LIGHT_BAR_COLORS = [
  [0xFF2020, 0xFFFFFF],  // ambulance: red / white
  [0xFF2020, 0xFFD700],  // fire truck: red / yellow
  [0xFF3030, 0x3030FF],  // police: red / blue
];

// Fog blend helper
function fogApply(hex, fogT) {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >>  8) & 0xFF;
  const b =  hex        & 0xFF;
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return (clamp(r + (0x3C - r) * fogT) << 16) |
         (clamp(g + (0x5A - g) * fogT) <<  8) |
          clamp(b + (0x6B - b) * fogT);
}

export class Player {
  constructor(scene, opts = {}) {
    this.scene            = scene;
    this.visualOffsetX_TU = opts.visualOffsetX || 0;  // track units (±45 or 0)
    this.baseBodyColor    = opts.bodyColor || 0xFFFFFF;
    // Vehicle slot index (0=ambulance, 1=fire truck, 2=police)
    this.vehicleIdx       = opts.vehicleIdx ?? 0;

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
   * @param {number} playerIdx - 0-based index
   * @param {number} simTick   - current simulation tick for light bar flash
   */
  render(ps, cameraZ, playerIdx, simTick) {
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

    const vIdx = this.vehicleIdx;
    const bw = BILL_W_TU * scale;
    const bh = BILL_HEIGHTS[vIdx] * scale;
    const bx = x - bw / 2;
    const by = y - bh;       // bottom of billboard at projected ground point

    // Fog factor
    const fogT = PROJ.FOG_ENABLED
      ? Math.min(Math.pow(zRel / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
      : 0;

    // --- Wake (drawn FIRST so it appears behind the vehicle) ---
    // The wake extends BACKWARD from the vehicle's rear toward the camera:
    //   z = zRel        → vehicle's rear, brightest
    //   z = zRel - DRAFT_RANGE_TU → 260 units behind vehicle, fades to nothing
    // Smaller zRel = lower on screen (closer to camera) in the perspective view.
    // Peak alpha and length both derive from the same two constants so changing
    // DRAFT_RANGE_CU or DRAFT_MAX_BONUS moves the drawing and the effect together.
    const peakAlpha  = (DRAFT_MAX_BONUS / 12) * 0.18;
    const wakeW_near = BILL_W_TU * 0.6;   // at vehicle's rear — widest
    const wakeW_far  = BILL_W_TU * 0.15;  // 260 units behind — narrowest
    const vehicleColour = VEHICLE_BODIES[vIdx];
    const NUM_STRIPS = 5;
    for (let s = 0; s < NUM_STRIPS; s++) {
      const t0 = s / NUM_STRIPS;
      const t1 = (s + 1) / NUM_STRIPS;
      const alpha = peakAlpha * (1 - t0);  // strongest at t0=0 (vehicle rear), zero at t0=1

      // Backward: subtract from zRel so z0/z1 < vehicle zRel (toward camera, lower on screen)
      const z0 = zRel - t0 * DRAFT_RANGE_TU;
      const z1 = zRel - t1 * DRAFT_RANGE_TU;
      const w0 = wakeW_near + (wakeW_far - wakeW_near) * t0;
      const w1 = wakeW_near + (wakeW_far - wakeW_near) * t1;

      // Clip: skip strips entirely below the near plane (z1 is the farther-back edge)
      if (z0 < PROJ.NEAR_CLAMP) continue;  // vehicle itself is behind near plane
      const z1c = Math.max(z1, PROJ.NEAR_CLAMP);  // clamp far end to near plane

      const sL = project(worldX - w0 / 2, z0);
      const sR = project(worldX + w0 / 2, z0);
      const eL = project(worldX - w1 / 2, z1c);
      const eR = project(worldX + w1 / 2, z1c);

      g.fillStyle(vehicleColour, alpha);
      g.fillPoints([sL, sR, eR, eL], true);
    }
    // Faint edge lines for "air disturbance" — same backward direction
    const nearL   = project(worldX - wakeW_near / 2, zRel);
    const nearR   = project(worldX + wakeW_near / 2, zRel);
    const farZc   = Math.max(zRel - DRAFT_RANGE_TU, PROJ.NEAR_CLAMP);
    const farL    = project(worldX - wakeW_far / 2, farZc);
    const farR    = project(worldX + wakeW_far / 2, farZc);
    const nearMid = project(worldX, zRel);
    const farMid  = project(worldX, farZc);
    g.lineStyle(1, vehicleColour, peakAlpha * 0.4);
    g.beginPath(); g.moveTo(nearL.x, nearL.y); g.lineTo(farL.x, farL.y); g.strokePath();
    g.beginPath(); g.moveTo(nearR.x, nearR.y); g.lineTo(farR.x, farR.y); g.strokePath();
    g.beginPath(); g.moveTo(nearMid.x, nearMid.y); g.lineTo(farMid.x, farMid.y); g.strokePath();

    // --- Soft elliptical shadow ---
    const shadowW = bw * 1.1;
    const shadowH = bh * 0.12;
    g.fillStyle(0x000000, 0.35 * (1 - fogT));
    g.fillEllipse(x, y + shadowH * 0.3, shadowW, shadowH);

    // --- Draft slipstream indicator ---
    if (ps.isDrafting) {
      g.lineStyle(2, 0xAAEEFF, 0.55);
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
    const cornerR = Math.max(2, bw * 0.08);
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

    // --- Determine body colour (with flash effect) ---
    let bodyColorBase = VEHICLE_BODIES[vIdx];
    if (ps.flashTicksLeft > 0 && ps.debuffType) {
      const t = ps.flashTicksLeft / FLASH_TICKS;
      const flashCol = ps.debuffType === 'ice' ? 0x88CCFF :
                       ps.debuffType === 'snipe' ? 0xFF6644 : 0x44CCEE;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(flashCol),
        Phaser.Display.Color.ValueToColor(bodyColorBase),
        100, Math.round((1 - t) * 100)
      );
      bodyColorBase = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }

    // Draw vehicle
    this._drawVehicle(g, x, y, scale, vIdx, simTick ?? 0, ps.sprintTicksLeft > 0, fogT, bodyColorBase, ps);

    // --- Sprint streaks ---
    if (ps.sprintTicksLeft > 0) {
      g.lineStyle(1, 0xFFFF88, 0.5);
      for (let i = 0; i < 3; i++) {
        const sx = bx + bw * (0.2 + i * 0.3);
        const sy = by + bh * 0.2;
        const len = bh * (0.25 + i * 0.08);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - bw * 0.05, sy + len); g.strokePath();
      }
    }

    // --- Draft streaks (lower intensity than sprint — 2 streaks vs 3) ---
    if (ps.isDrafting && ps.draftFactor > 100) {
      const intensity = (ps.draftFactor - 100) / DRAFT_MAX_BONUS;
      g.lineStyle(1, vehicleColour, 0.25 * intensity);
      for (let i = 0; i < 2; i++) {
        const sx = bx + bw * (0.25 + i * 0.5);
        const sy = by + bh * 0.3;
        const len = bh * (0.15 + intensity * 0.1);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - bw * 0.04, sy + len); g.strokePath();
      }
    }
  }

  _drawVehicle(g, x, y, scale, vIdx, simTick, sprintActive, fogT, bodyColorBase, ps) {
    const bw = BILL_W_TU * scale;
    const bh = BILL_HEIGHTS[vIdx] * scale;
    const bx = x - bw / 2;
    const by = y - bh;

    const bodyColor   = fogApply(bodyColorBase, fogT);
    const stripeColor = fogApply(VEHICLE_STRIPES[vIdx], fogT);

    // 1. Main body rectangle
    g.fillStyle(bodyColor, 1);
    g.fillRect(bx, by, bw, bh);

    // 2. Cabin windows (top ~28% of body, dark)
    g.fillStyle(fogApply(0x1A1A2A, fogT), 0.88);
    g.fillRect(bx + bw * 0.1, by, bw * 0.8, bh * 0.28);

    // 3. Livery stripe (horizontal ~68% down from top)
    g.fillStyle(stripeColor, 0.9);
    g.fillRect(bx, by + bh * 0.68, bw, bh * 0.08);

    // 4. Wheels (4 dark blocks at corners)
    const ww = bw * 0.2, wh = bh * 0.12;
    g.fillStyle(fogApply(0x111111, fogT), 1);
    g.fillRect(bx,           y - wh,          ww, wh);  // front-left
    g.fillRect(bx + bw - ww, y - wh,          ww, wh);  // front-right
    g.fillRect(bx,           by + bh * 0.75,  ww, wh);  // rear-left
    g.fillRect(bx + bw - ww, by + bh * 0.75,  ww, wh);  // rear-right

    // 5. Rear lights (red)
    g.fillStyle(fogApply(0xFF2020, fogT), 0.9);
    g.fillRect(bx,             y - bh * 0.15, bw * 0.1, bh * 0.08);
    g.fillRect(bx + bw * 0.9,  y - bh * 0.15, bw * 0.1, bh * 0.08);

    // 6. Light bar flash (top of vehicle)
    const flashPeriod = sprintActive ? 10 : 30;
    const flashState  = Math.floor(simTick / flashPeriod) % 2;
    const barColors   = LIGHT_BAR_COLORS[vIdx];
    const barColor    = fogApply(barColors[flashState], fogT);
    g.fillStyle(barColor, 0.95);
    g.fillRect(bx + bw * 0.2, by - bh * 0.06, bw * 0.6, bh * 0.06);

    // 7. Vehicle-specific feature
    if (vIdx === 0) {
      // Ambulance: red cross on side body
      const cxBox = bx + bw * 0.38;
      const cyBox = by + bh * 0.35;
      const cW = bw * 0.24, cH = bh * 0.18;
      const vW = bw * 0.08, vH = bh * 0.30;
      g.fillStyle(fogApply(0xE03030, fogT), 1);
      g.fillRect(cxBox, cyBox + cH * 0.1, cW, cH * 0.8);     // horizontal bar
      g.fillRect(cxBox + cW * 0.33, cyBox, cW * 0.33, cH);   // vertical bar
      // White cross on top
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillRect(cxBox + cW * 0.15, cyBox + cH * 0.35, cW * 0.7, cH * 0.3);
      g.fillRect(cxBox + cW * 0.38, cyBox + cH * 0.1,  cW * 0.24, cH * 0.8);
    } else if (vIdx === 1) {
      // Fire truck: ladder lines on roof area
      g.lineStyle(1, fogApply(0xCCCCCC, fogT), 0.7);
      for (let i = 0; i < 4; i++) {
        const lx = bx + bw * (0.15 + i * 0.19);
        g.beginPath(); g.moveTo(lx, by); g.lineTo(lx, by - bh * 0.05); g.strokePath();
      }
      g.beginPath();
      g.moveTo(bx + bw * 0.15, by - bh * 0.025);
      g.lineTo(bx + bw * 0.85, by - bh * 0.025);
      g.strokePath();
    } else {
      // Police: white door panels
      g.fillStyle(fogApply(0xDDDDDD, fogT), 0.9);
      g.fillRect(bx + bw * 0.12, by + bh * 0.35, bw * 0.32, bh * 0.28);
      g.fillRect(bx + bw * 0.56, by + bh * 0.35, bw * 0.32, bh * 0.28);
    }
  }

  destroy() { this.graphics.destroy(); }
}
