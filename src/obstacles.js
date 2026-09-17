import { CENTI_SCALE } from '../sim/rules.js';
import { PROJ, LANE_TU, project } from './render/projection.js';

// Obstacle physical dimensions in track units
const OBS_W_TU  = 160;  // lateral width
const OBS_D_TU  =  60;  // depth (track direction)
const HEIGHT_BY_TYPE = { rock: 78, ice: 26, water: 26 };

const OBS_COLORS = {
  rock:  0xC4463A,
  ice:   0xB8D8E8,
  water: 0x3AA8C4,
};

// Front face is ~66% brightness of top face
function darkenColor(hex) {
  const r = ((hex >> 16) & 0xFF) * 0.66 | 0;
  const g = ((hex >>  8) & 0xFF) * 0.66 | 0;
  const b =  (hex        & 0xFF) * 0.66 | 0;
  return (r << 16) | (g << 8) | b;
}

const FOG_COLOR_R = 0x3C, FOG_COLOR_G = 0x5A, FOG_COLOR_B = 0x6B;

function fogBlend(hex, fogT) {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >>  8) & 0xFF;
  const b =  hex        & 0xFF;
  const clamp = x => Math.max(0, Math.min(255, Math.round(x)));
  return (clamp(r + (FOG_COLOR_R - r) * fogT) << 16) |
         (clamp(g + (FOG_COLOR_G - g) * fogT) << 8)  |
          clamp(b + (FOG_COLOR_B - b) * fogT);
}

export class Obstacles {
  constructor(scene, numPlayers = 1) {
    this.scene      = scene;
    this.numPlayers = numPlayers;
    this.graphics   = scene.add.graphics();
    this.graphics.setDepth(2);

    // Sorted-index pointer for culling (obstacles are sorted by distanceScaled)
    this._startIdx = 0;
  }

  /**
   * Render all visible obstacles.
   * @param {Array}  obstacles          - state.obstacles array
   * @param {number} cameraZ            - track units; camera position
   * @returns {Array} renderItems sorted far-to-near for external draw-order merging
   */
  getRenderItems(obstacles, cameraZ) {
    const items = [];
    const farZ  = cameraZ + PROJ.DRAW_DISTANCE;

    // Advance start index as camera moves forward
    while (
      this._startIdx < obstacles.length &&
      obstacles[this._startIdx].distanceScaled / CENTI_SCALE < cameraZ + PROJ.NEAR_CLAMP
    ) {
      this._startIdx++;
    }

    for (let i = this._startIdx; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const obsZ = obs.distanceScaled / CENTI_SCALE;
      if (obsZ > farZ) break; // sorted — no more visible

      // Determine hidden state: skip if all players have hit this obstacle
      const allHit = obs.hitByPlayer[0] &&
        (this.numPlayers < 2 || obs.hitByPlayer[1]) &&
        (this.numPlayers < 3 || obs.hitByPlayer[2]);
      if (allHit) continue;

      const zRel = obsZ - cameraZ;
      items.push({ type: 'obstacle', obs, zRel });
    }
    return items;
  }

  /**
   * Draw a single obstacle at the given zRel.
   * Called by RunScene in far-to-near draw order.
   */
  drawItem(obs, zRel) {
    const g = this.graphics;
    const obsH  = HEIGHT_BY_TYPE[obs.type] || 40;
    const worldX = LANE_TU[obs.lane];

    // Fog factor
    const fogT = PROJ.FOG_ENABLED
      ? Math.min(Math.pow(zRel / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
      : 0;

    const topColor   = fogBlend(OBS_COLORS[obs.type], fogT);
    const frontColor = fogBlend(darkenColor(OBS_COLORS[obs.type]), fogT);

    const halfW = OBS_W_TU / 2;
    const zFront = zRel;
    const zBack  = zRel + OBS_D_TU;

    // Top face: 4 corners
    const tfl = project(worldX - halfW, zBack);
    const tfr = project(worldX + halfW, zBack);
    const tnl = project(worldX - halfW, zFront);
    const tnr = project(worldX + halfW, zFront);

    // Scale height at front face
    const frontScale = tnl.scale;
    const screenH    = obsH * frontScale;
    const backScale  = tfl.scale;
    const backScreenH = obsH * backScale;

    // Compute top corners (top-face) by shifting y up by screenH
    const topBL = { x: tfl.x, y: tfl.y - backScreenH };
    const topBR = { x: tfr.x, y: tfr.y - backScreenH };
    const topFL = { x: tnl.x, y: tnl.y - screenH };
    const topFR = { x: tnr.x, y: tnr.y - screenH };

    // Draw top face
    g.fillStyle(topColor, 1);
    g.fillPoints([topBL, topBR, topFR, topFL], true);

    // Draw front face (between front-top and front-bottom)
    g.fillStyle(frontColor, 1);
    g.fillPoints([topFL, topFR, tnr, tnl], true);

    // Shape marks on top face
    if (obs.type === 'rock')  this._drawRockMark(g, topFL, topFR, topBL, topBR);
    if (obs.type === 'ice')   this._drawIceMark(g, topFL, topFR, topBL, topBR);
    if (obs.type === 'water') this._drawWaterMark(g, topFL, topFR, topBL, topBR);

    // Pending highlight
    const isPending = obs.pendingByPlayer[0] ||
      (this.numPlayers > 1 && obs.pendingByPlayer[1]) ||
      (this.numPlayers > 2 && obs.pendingByPlayer[2]);
    if (isPending) {
      g.lineStyle(3, 0xFFFF00, 0.9);
      g.strokePoints([topFL, topFR, tnr, tnl], true);
    }
  }

  // Rock: cross mark on top face
  _drawRockMark(g, tFL, tFR, tBL, tBR) {
    const cx = (tFL.x + tFR.x + tBL.x + tBR.x) / 4;
    const cy = (tFL.y + tFR.y + tBL.y + tBR.y) / 4;
    const hw = (tFR.x - tFL.x) * 0.25;
    const hh = (tBL.y - tFL.y) * 0.35;
    g.lineStyle(3, 0x5A1510, 0.85);
    g.beginPath(); g.moveTo(cx - hw, cy - hh); g.lineTo(cx + hw, cy + hh); g.strokePath();
    g.beginPath(); g.moveTo(cx + hw, cy - hh); g.lineTo(cx - hw, cy + hh); g.strokePath();
  }

  // Ice: parallel diagonal lines on top face
  _drawIceMark(g, tFL, tFR, tBL, tBR) {
    const x0 = (tFL.x + tBL.x) / 2;
    const x1 = (tFR.x + tBR.x) / 2;
    const y0 = (tFL.y + tFR.y) / 2;
    const y1 = (tBL.y + tBR.y) / 2;
    const w  = x1 - x0;
    const h  = y1 - y0;
    g.lineStyle(1, 0x7BB8D8, 0.55);
    for (let t = 0.2; t <= 0.85; t += 0.25) {
      g.beginPath();
      g.moveTo(x0 + w * t,     y0 + h * t * 0.2);
      g.lineTo(x0 + w * t * 0.4, y1 - h * 0.1);
      g.strokePath();
    }
  }

  // Water: wave lines on top face
  _drawWaterMark(g, tFL, tFR, tBL, tBR) {
    const x0 = tFL.x + (tFR.x - tFL.x) * 0.15;
    const x1 = tFL.x + (tFR.x - tFL.x) * 0.85;
    const yBase = (tFL.y + tFR.y) / 2;
    const yStep = (tBL.y - tFL.y) * 0.3;
    g.lineStyle(2, 0x1E6888, 0.75);
    for (let row = 0; row < 2; row++) {
      const y = yBase + yStep * row;
      g.beginPath();
      g.moveTo(x0, y);
      const dx = (x1 - x0) / 4;
      g.lineTo(x0 + dx,     y - 2);
      g.lineTo(x0 + dx * 2, y);
      g.lineTo(x0 + dx * 3, y - 2);
      g.lineTo(x1,           y);
      g.strokePath();
    }
  }

  /** Legacy single-pass render — kept so 1P mode still works if called directly */
  render(obstacles, camPositionScaled) {
    const cameraZ = camPositionScaled / CENTI_SCALE - PROJ.CAM_BACK;
    this.graphics.clear();
    const items = this.getRenderItems(obstacles, cameraZ);
    // Sort far-to-near
    items.sort((a, b) => b.zRel - a.zRel);
    for (const item of items) {
      this.drawItem(item.obs, item.zRel);
    }
  }

  // Helper kept for RunSceneRenderer.js event effects
  getScreenY(obs, camPositionScaled) {
    const cameraZ = camPositionScaled / CENTI_SCALE - PROJ.CAM_BACK;
    const zRel    = obs.distanceScaled / CENTI_SCALE - cameraZ;
    const worldX  = LANE_TU[obs.lane];
    const { y }   = project(worldX, zRel);
    return y;
  }

  destroy() { this.graphics.destroy(); }
}
