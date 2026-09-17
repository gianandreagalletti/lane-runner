// src/render/GroundRenderer.js
// Draws sky, ground, lane segments (back-to-front), fog, and horizon skyline.
// No Phaser imports needed beyond Graphics usage through scene.add.graphics().

import { PROJ, LANE_TU, LANE_HALF_TU, project, getProjectionState } from './projection.js';
import { CANVAS_W, CANVAS_H } from '../track.js';

// Lane edge worldX positions in track units
// Each lane has a left and right edge at ±LANE_HALF_TU from its centre
// Plus outer kerb strips 26 tu wide beyond lane 0 and lane 2

const KERB_W = 26; // track units

// Compute all lane left/right edges
function getLaneEdges() {
  // Lane 0: -240 ± 100 → [-340, -140]
  // Lane 1:    0 ± 100 → [-100,  100]
  // Lane 2:  240 ± 100 → [ 140,  340]
  // 40-unit gap between adjacent lanes (LANE_PITCH - 2*LANE_HALF_TU = 240-200 = 40).
  return LANE_TU.map(c => ({ left: c - LANE_HALF_TU, right: c + LANE_HALF_TU }));
}

// Lane colours matching track.js LANE_COLORS
const LANE_COLORS = [0x8B6F47, 0x9AA5B1, 0x4A90A4];
const LANE_DARK_FACTOR = 0.88; // alternate segment darkness

// Parse 0xRRGGBB to {r,g,b}
function hexToRgb(hex) {
  return { r: (hex >> 16) & 0xFF, g: (hex >> 8) & 0xFF, b: hex & 0xFF };
}

// Blend a colour toward a fog colour at fraction t [0..1]
function fogBlend(baseHex, fogHex, t) {
  const b = hexToRgb(baseHex), f = hexToRgb(fogHex);
  const clamp = x => Math.max(0, Math.min(255, Math.round(x)));
  return (clamp(b.r + (f.r - b.r) * t) << 16) |
         (clamp(b.g + (f.g - b.g) * t) << 8) |
          clamp(b.b + (f.b - b.b) * t);
}

// Apply darkness factor to a hex colour
function darken(hex, factor) {
  const c = hexToRgb(hex);
  return (Math.round(c.r * factor) << 16) | (Math.round(c.g * factor) << 8) | Math.round(c.b * factor);
}

const FOG_COLOR = 0x3C5A6B;
const SKY_TOP   = 0x111C2B;
const SKY_HORIZ = 0x3C5A6B;
const GND_HORIZ = 0x22323E;
const GND_BOT   = 0x131C24;
const KERB_COLOR = 0xCCBB99;

export class GroundRenderer {
  constructor(scene) {
    this.scene    = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(0);
    this._laneEdges = getLaneEdges();

    // Skyline building data — deterministic layout (no random)
    this._skylineLayer1 = this._buildSkyline(22, 60, 28, 95);
    this._skylineLayer2 = this._buildSkyline(14, 38, 18, 60);
  }

  // Build a repeating skyline strip with fixed-width buildings
  _buildSkyline(count, minW, maxW, maxH) {
    const buildings = [];
    let x = -200;
    // Deterministic height sequence from a simple hash
    for (let i = 0; i < count; i++) {
      const w = minW + ((i * 37 + 13) % (maxW - minW + 1));
      const h = 20  + ((i * 53 + 7)  % (maxH - 19));
      buildings.push({ x, w, h });
      x += w + 4 + ((i * 11 + 3) % 12);
    }
    return buildings;
  }

  render(cameraZ) {
    const g = this.graphics;
    g.clear();

    const { HORIZON_Y } = getProjectionState();
    const canvasW = CANVAS_W;
    const canvasH = CANVAS_H;

    // --- Sky ---
    g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_HORIZ, SKY_HORIZ, 1);
    g.fillRect(0, 0, canvasW, HORIZON_Y);

    // --- Ground ---
    g.fillGradientStyle(GND_HORIZ, GND_HORIZ, GND_BOT, GND_BOT, 1);
    g.fillRect(0, HORIZON_Y, canvasW, canvasH - HORIZON_Y);

    // --- Lane segments — back to front ---
    // Segment boundaries live at absolute world positions (multiples of SEGMENT_LEN).
    // zRel = zAbsolute - cameraZ is a continuous float — never quantised — so the
    // quads travel smoothly as cameraZ advances, exactly like obstacles do.
    const edges = this._laneEdges;
    const firstSegIdx = Math.floor((cameraZ + PROJ.NEAR_CLAMP + 10) / PROJ.SEGMENT_LEN);
    const lastSegIdx  = Math.floor((cameraZ + PROJ.DRAW_DISTANCE)   / PROJ.SEGMENT_LEN) + 1;

    // Draw back-to-front: highest absolute index (farthest) first
    for (let segIndex = lastSegIdx; segIndex >= firstSegIdx; segIndex--) {
      const zNearAbs = segIndex       * PROJ.SEGMENT_LEN;  // absolute world position
      const zFarAbs  = (segIndex + 1) * PROJ.SEGMENT_LEN;

      const zRelNear = zNearAbs - cameraZ;  // continuous — never quantised
      const zRelFar  = zFarAbs  - cameraZ;

      // Skip segments behind the near plane
      if (zRelNear < PROJ.NEAR_CLAMP + 10) continue;
      // Skip segments beyond draw distance
      if (zRelFar  > PROJ.DRAW_DISTANCE)    continue;

      // Fog factor at mid-distance of this segment
      const zRelMid = (zRelNear + zRelFar) / 2;
      const fogT    = PROJ.FOG_ENABLED
        ? Math.min(Math.pow(zRelMid / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
        : 0;

      // Shade belongs to the world segment, not the draw slot.
      // segIndex is a world-absolute integer so this is a pure function of world position.
      const altSeg = segIndex % 2 === 1;

      // Draw lanes
      for (let li = 0; li < 3; li++) {
        const lx = edges[li].left;
        const rx = edges[li].right;

        const fl = project(lx, zRelFar);
        const fr = project(rx, zRelFar);
        const nl = project(lx, zRelNear);
        const nr = project(rx, zRelNear);

        let col = LANE_COLORS[li];
        if (altSeg) col = darken(col, LANE_DARK_FACTOR);
        col = fogBlend(col, FOG_COLOR, fogT);

        g.fillStyle(col, 1);
        g.fillPoints([
          { x: fl.x, y: fl.y },
          { x: fr.x, y: fr.y },
          { x: nr.x, y: nr.y },
          { x: nl.x, y: nl.y },
        ], true);
      }

      // Outer kerb strips
      // Left kerb: from lane 0 left edge, going left by KERB_W
      {
        const kRightX = edges[0].left;
        const kLeftX  = kRightX - KERB_W;
        const fl = project(kLeftX,  zRelFar);
        const fr = project(kRightX, zRelFar);
        const nl = project(kLeftX,  zRelNear);
        const nr = project(kRightX, zRelNear);
        let col = altSeg ? darken(KERB_COLOR, LANE_DARK_FACTOR) : KERB_COLOR;
        col = fogBlend(col, FOG_COLOR, fogT);
        g.fillStyle(col, 1);
        g.fillPoints([
          { x: fl.x, y: fl.y }, { x: fr.x, y: fr.y },
          { x: nr.x, y: nr.y }, { x: nl.x, y: nl.y },
        ], true);
      }

      // Right kerb: from lane 2 right edge, going right by KERB_W
      {
        const kLeftX  = edges[2].right;
        const kRightX = kLeftX + KERB_W;
        const fl = project(kLeftX,  zRelFar);
        const fr = project(kRightX, zRelFar);
        const nl = project(kLeftX,  zRelNear);
        const nr = project(kRightX, zRelNear);
        let col = altSeg ? darken(KERB_COLOR, LANE_DARK_FACTOR) : KERB_COLOR;
        col = fogBlend(col, FOG_COLOR, fogT);
        g.fillStyle(col, 1);
        g.fillPoints([
          { x: fl.x, y: fl.y }, { x: fr.x, y: fr.y },
          { x: nr.x, y: nr.y }, { x: nl.x, y: nl.y },
        ], true);
      }
    }

    // --- Skyline parallax ---
    this._drawSkyline(g, cameraZ, HORIZON_Y);
  }

  _drawSkyline(g, cameraZ, horizonY) {
    // Layer 1 — 3.5% parallax of cameraZ
    const offsetL1 = (cameraZ * 0.035) % (CANVAS_W + 400);
    // Layer 2 — 2% parallax
    const offsetL2 = (cameraZ * 0.020) % (CANVAS_W + 400);

    const drawLayer = (buildings, offset, baseColor, alphaVal) => {
      g.fillStyle(baseColor, alphaVal);
      for (const b of buildings) {
        // Tile the layer across the width
        for (let rep = -1; rep <= 2; rep++) {
          const bx = b.x - offset + rep * (CANVAS_W + 400);
          if (bx + b.w < 0 || bx > CANVAS_W) continue;
          g.fillRect(bx, horizonY - b.h, b.w, b.h);
        }
      }
    };

    // Layer 2 further (darker, behind layer 1)
    drawLayer(this._skylineLayer2, offsetL2, 0x1A2A35, 0.85);
    // Layer 1 closer (slightly lighter)
    drawLayer(this._skylineLayer1, offsetL1, 0x243340, 0.90);
  }

  destroy() {
    this.graphics.destroy();
  }
}
