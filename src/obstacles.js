import { CENTI_SCALE } from '../sim/rules.js';
import { PROJ, LANE_TU, project } from './render/projection.js';

// Obstacle physical dimensions in track units
const OBS_W_TU  = 160;  // lateral width
const OBS_D_TU  =  60;  // depth (track direction)
// Rock (guard rail) still has visual height; ice/water are flat decals
const HEIGHT_BY_TYPE = { rock: 78, ice: 0, water: 0 };

// Caltrop: violet-shifted ice color blended at low strength
const CALTROP_COLOR       = 0x9B6BDA;
const CALTROP_FRONT_COLOR = 0x6B4BAA;

// Pickup colors and size
const PICKUP_COLORS = {
  caltrop_pickup: 0x9B6BDA,
  snipe_pickup:   0x7ED957
};
const PICKUP_RADIUS_TU = 28;  // radius in track units

// Projectile color — now per-vehicle (ambulance=white, fire=red, police=blue)
// Indexed by caster slot; default orange-red fallback
const PROJ_COLORS = [0xFF9090, 0xFF2020, 0x8080FF];
const PROJ_COLOR_DEFAULT = 0xFF8844;

// Guard rail colours
const RAIL_POST_COLOR   = 0x8090A0;  // steel posts
const RAIL_BEAM_BASE    = 0x14181B;  // beam background (black)
const RAIL_CHEVRON_COLOR = 0xF2C230; // yellow chevrons

// Ice decal colours
const ICE_COLOR    = 0xB8D8E8;
const ICE_CRACK    = 0xDDEEFF;

// Water decal colours
const WATER_COLOR  = 0x3AA8C4;
const WATER_RIM    = 0x5BC8D8;

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

// Seeded pseudo-random for shard outlines (no Math.random in render)
function _seedVal(seed, idx) {
  let s = (seed + idx * 2654435761) >>> 0;
  s ^= s >>> 16;
  s = Math.imul(s, 0x45d9f3b) >>> 0;
  s ^= s >>> 16;
  return (s >>> 0) / 0xFFFFFFFF;
}

export class Obstacles {
  constructor(scene, numPlayers = 1) {
    this.scene      = scene;
    this.numPlayers = numPlayers;
    this.graphics   = scene.add.graphics();
    this.graphics.setDepth(2);

    // Sorted-index pointer for culling (obstacles are sorted by distanceScaled)
    this._startIdx = 0;

    // Cache for shard outlines — generated once per obstacle, never per frame
    this._shardCache = new Map();
  }

  /** Reset cull index — call after inserting caltrop obstacles to prevent stale skip */
  invalidateCullIndex() {
    this._startIdx = 0;
  }

  /**
   * Get renderable items for pickups (always rendered regardless of collection state).
   */
  getPickupRenderItems(pickups, cameraZ) {
    const items = [];
    const farZ  = cameraZ + PROJ.DRAW_DISTANCE;
    for (const pu of pickups) {
      const puZ = pu.distanceScaled / CENTI_SCALE;
      if (puZ < cameraZ + PROJ.NEAR_CLAMP) continue;
      if (puZ > farZ) continue;
      const zRel = puZ - cameraZ;
      items.push({ type: 'pickup', pu, zRel });
    }
    return items;
  }

  /** Draw a single pickup at the given zRel. */
  drawPickup(pu, zRel) {
    const g = this.graphics;
    const color = PICKUP_COLORS[pu.type] || 0xFFFFFF;
    const fogT = PROJ.FOG_ENABLED
      ? Math.min(Math.pow(zRel / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
      : 0;
    const finalColor = fogBlend(color, fogT);

    const worldX = LANE_TU[pu.lane];
    const { x, y, scale } = project(worldX, zRel);
    const r = PICKUP_RADIUS_TU * scale;

    if (pu.type === 'caltrop_pickup') {
      // Violet road cone / diamond shape
      g.fillStyle(finalColor, 0.9);
      g.fillCircle(x, y - r, r * 0.7);
      // Diamond outline
      g.lineStyle(2, finalColor, 0.75);
      g.beginPath();
      g.moveTo(x, y - r * 2.4);
      g.lineTo(x + r, y - r * 0.9);
      g.lineTo(x, y + 0.1);
      g.lineTo(x - r, y - r * 0.9);
      g.closePath();
      g.strokePath();
      // Fill diamond
      g.fillStyle(finalColor, 0.35);
      g.fillTriangle(x, y - r * 2.4, x + r, y - r * 0.9, x - r, y - r * 0.9);
    } else {
      // snipe_pickup: green star/cross shape
      g.fillStyle(finalColor, 0.9);
      g.fillCircle(x, y - r, r * 0.55);
      // Cross arms
      g.lineStyle(3, finalColor, 0.85);
      const armLen = r * 1.3;
      g.beginPath(); g.moveTo(x, y - r - armLen); g.lineTo(x, y - r + armLen); g.strokePath();
      g.beginPath(); g.moveTo(x - armLen, y - r); g.lineTo(x + armLen, y - r); g.strokePath();
      // Diagonal arms (star)
      const diag = armLen * 0.65;
      g.lineStyle(2, finalColor, 0.6);
      g.beginPath(); g.moveTo(x - diag, y - r - diag); g.lineTo(x + diag, y - r + diag); g.strokePath();
      g.beginPath(); g.moveTo(x + diag, y - r - diag); g.lineTo(x - diag, y - r + diag); g.strokePath();
    }
  }

  /** Draw a snipe projectile as a siren burst. */
  drawProjectile(proj, zRel) {
    const g = this.graphics;
    const worldX = LANE_TU[proj.lane];
    const { x, y, scale } = project(worldX, zRel);
    const r = 6 * scale;

    // Pick colour based on caster slot (if available), else fallback
    const baseColor = (proj.casterSlot !== undefined && proj.casterSlot < PROJ_COLORS.length)
      ? PROJ_COLORS[proj.casterSlot]
      : PROJ_COLOR_DEFAULT;

    // Main burst — elongated oval travelling forward
    g.fillStyle(baseColor, 1.0);
    g.fillEllipse(x, y, r * 1.6, r * 3.2);

    // Trailing afterimages — 3 fading copies behind (higher zRel = farther from camera)
    for (let i = 1; i <= 3; i++) {
      const trailZ  = zRel + i * 12 * scale;
      if (trailZ > PROJ.DRAW_DISTANCE) break;
      const tp = project(worldX, trailZ);
      const tr = r * (1 - i * 0.25);
      g.fillStyle(baseColor, 0.35 / i);
      g.fillEllipse(tp.x, tp.y, tr * 1.4, tr * 2.8);
    }

    // Short bright streak behind
    g.lineStyle(2, baseColor, 0.55);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + 22 * scale);
    g.strokePath();
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
    // Fog factor
    const fogT = PROJ.FOG_ENABLED
      ? Math.min(Math.pow(zRel / PROJ.DRAW_DISTANCE, 2), 0.82) * PROJ.PERSPECTIVE_BLEND
      : 0;

    if (obs.type === 'rock') {
      this._drawGuardRail(obs, zRel, fogT);
    } else if (obs.type === 'ice') {
      if (obs.isCaltrop) {
        this._drawCaltropDecal(obs, zRel, fogT);
      } else {
        this._drawIceDecal(obs, zRel, fogT);
      }
    } else if (obs.type === 'water') {
      this._drawWaterDecal(obs, zRel, fogT);
    }

    // Pending highlight
    const isPending = obs.pendingByPlayer[0] ||
      (this.numPlayers > 1 && obs.pendingByPlayer[1]) ||
      (this.numPlayers > 2 && obs.pendingByPlayer[2]);
    if (isPending) {
      const g = this.graphics;
      const worldX = LANE_TU[obs.lane];
      const halfW = OBS_W_TU / 2;
      const zFront = zRel;
      const zBack  = zRel + OBS_D_TU;
      const tnl = project(worldX - halfW, zFront);
      const tnr = project(worldX + halfW, zFront);
      const tfl = project(worldX - halfW, zBack);
      const tfr = project(worldX + halfW, zBack);
      g.lineStyle(3, 0xFFFF00, 0.9);
      g.strokePoints([
        { x: tnl.x, y: tnl.y }, { x: tnr.x, y: tnr.y },
        { x: tfr.x, y: tfr.y }, { x: tfl.x, y: tfl.y }
      ], true);
    }
  }

  // Guard rail: crash barrier visual (replaces box for 'rock' type)
  _drawGuardRail(obs, zRel, fogT) {
    const g = this.graphics;
    const worldX = LANE_TU[obs.lane];
    const halfW  = OBS_W_TU / 2;  // 80 tu

    // Post depth (mid-point of obstacle depth)
    const postZRel = zRel + OBS_D_TU / 2;

    // Post positions
    const postL = project(worldX - 50, postZRel);
    const postR = project(worldX + 50, postZRel);

    // Post dimensions
    const postH = 50 * postL.scale;
    const postW = 8  * postL.scale;

    // --- Draw posts (steel grey) ---
    g.fillStyle(fogBlend(RAIL_POST_COLOR, fogT), 1);
    for (const p of [postL, postR]) {
      g.fillRect(p.x - postW / 2, p.y - postH, postW, postH);
    }

    // --- Beam quad (projected perspective) ---
    const beamH = 18;  // beam height in track units

    // Beam front face: bottom at ground level, top at beamH above
    const bbl = project(worldX - halfW, zRel + OBS_D_TU);
    const bbr = project(worldX + halfW, zRel + OBS_D_TU);
    const nbl = project(worldX - halfW, zRel);
    const nbr = project(worldX + halfW, zRel);

    // Top of beam — shift y up
    const btl = { x: bbl.x, y: bbl.y - beamH * bbl.scale };
    const btr = { x: bbr.x, y: bbr.y - beamH * bbr.scale };
    const ntl = { x: nbl.x, y: nbl.y - beamH * nbl.scale };
    const ntr = { x: nbr.x, y: nbr.y - beamH * nbr.scale };

    // Draw beam front face (black base)
    g.fillStyle(fogBlend(RAIL_BEAM_BASE, fogT), 1);
    g.fillPoints([ntl, ntr, nbr, nbl], true);

    // Chevron yellow stripes on beam front face (6 stripes)
    const beamPxW = ntr.x - ntl.x;
    const beamPxH = nbl.y - ntl.y;
    if (beamPxW > 2 && beamPxH > 0) {
      const stripeW = beamPxW / 12;
      for (let i = 0; i < 6; i++) {
        const sx = ntl.x + stripeW * (i * 2);
        const sw = stripeW;
        // Diagonal parallelogram — slanted to the right
        const slant = beamPxH * 0.6;
        g.fillStyle(fogBlend(RAIL_CHEVRON_COLOR, fogT), 0.9);
        g.fillPoints([
          { x: sx,          y: ntl.y },
          { x: sx + sw,     y: ntl.y },
          { x: sx + sw - slant, y: nbl.y },
          { x: sx - slant,      y: nbl.y },
        ], true);
      }
    }

    // Thin top face (dark grey top of beam, for depth)
    g.fillStyle(fogBlend(0x404850, fogT), 1);
    g.fillPoints([btl, btr, ntr, ntl], true);
  }

  // Shard outline: cached per-obstacle, generated from seed
  _getShardOutline(obs, numVerts, halfW, halfD) {
    const key = `${obs.lane}_${obs.distanceScaled}`;
    if (this._shardCache.has(key)) return this._shardCache.get(key);

    const seed = obs.lane * 1000 + (obs.distanceScaled >>> 0);
    const verts = [];
    for (let i = 0; i < numVerts; i++) {
      const angle = (i / numVerts) * Math.PI * 2;
      const r = 0.6 + 0.4 * _seedVal(seed, i);  // 60-100% of max radius
      const dx = Math.cos(angle) * halfW * r;
      const dz = Math.sin(angle) * halfD * r;
      verts.push({ dx, dz });
    }
    this._shardCache.set(key, verts);
    return verts;
  }

  // Blobby outline for water — smooth the verts slightly
  _getBlobOutline(obs, numVerts, halfW, halfD) {
    const key = `blob_${obs.lane}_${obs.distanceScaled}`;
    if (this._shardCache.has(key)) return this._shardCache.get(key);

    const seed = obs.lane * 1000 + (obs.distanceScaled >>> 0);
    const rawVerts = [];
    for (let i = 0; i < numVerts; i++) {
      const angle = (i / numVerts) * Math.PI * 2;
      // Water: bulge more outward (0.75-1.0 radius range vs ice's 0.60-1.0)
      const r = 0.75 + 0.25 * _seedVal(seed, i + 100);
      rawVerts.push({
        dx: Math.cos(angle) * halfW * r,
        dz: Math.sin(angle) * halfD * r,
      });
    }
    // Smooth: average with neighbours
    const verts = rawVerts.map((v, i) => {
      const prev = rawVerts[(i + numVerts - 1) % numVerts];
      const next = rawVerts[(i + 1) % numVerts];
      return {
        dx: v.dx * 0.5 + prev.dx * 0.25 + next.dx * 0.25,
        dz: v.dz * 0.5 + prev.dz * 0.25 + next.dz * 0.25,
      };
    });
    this._shardCache.set(key, verts);
    return verts;
  }

  // Flat ice decal on road surface
  _drawIceDecal(obs, zRel, fogT) {
    const g = this.graphics;
    const worldX = LANE_TU[obs.lane];
    const halfW = OBS_W_TU / 2;  // 80 tu
    const halfD = OBS_D_TU / 2;  // 30 tu
    const centreZ = zRel + halfD;

    const verts = this._getShardOutline(obs, 8, halfW, halfD);

    // Project each vertex onto road surface
    const screenVerts = verts.map(v => project(worldX + v.dx, centreZ + v.dz));

    g.fillStyle(fogBlend(ICE_COLOR, fogT), 0.85);
    g.fillPoints(screenVerts, true);

    // Crack lines from centre to 3 edge verts
    const cx = project(worldX, centreZ);
    g.lineStyle(1, fogBlend(ICE_CRACK, fogT), 0.6);
    for (let i = 0; i < 3; i++) {
      const v = screenVerts[Math.floor(i * screenVerts.length / 3)];
      g.beginPath(); g.moveTo(cx.x, cx.y); g.lineTo(v.x, v.y); g.strokePath();
    }

    // Sheen highlight (small bright ellipse at centre)
    g.fillStyle(0xEEF8FF, 0.5);
    const scl = cx.scale;
    g.fillEllipse(cx.x, cx.y, 20 * scl, 10 * scl);
  }

  // Flat water decal on road surface
  _drawWaterDecal(obs, zRel, fogT) {
    const g = this.graphics;
    const worldX = LANE_TU[obs.lane];
    const halfW = OBS_W_TU / 2;
    const halfD = OBS_D_TU / 2;
    const centreZ = zRel + halfD;

    const verts = this._getBlobOutline(obs, 10, halfW, halfD);
    const screenVerts = verts.map(v => project(worldX + v.dx, centreZ + v.dz));

    // Slightly outset rim (lighter)
    const rimVerts = verts.map(v => project(worldX + v.dx * 1.08, centreZ + v.dz * 1.08));
    g.fillStyle(fogBlend(WATER_RIM, fogT), 0.45);
    g.fillPoints(rimVerts, true);

    // Main water body
    g.fillStyle(fogBlend(WATER_COLOR, fogT), 0.75);
    g.fillPoints(screenVerts, true);

    // Ripple arcs (2 concentric partial ellipses)
    const cx = project(worldX, centreZ);
    const scl = cx.scale;
    g.lineStyle(1, fogBlend(WATER_RIM, fogT), 0.5);
    g.strokeEllipse(cx.x, cx.y, halfW * scl * 0.9, halfD * scl * 0.8);
    g.lineStyle(1, fogBlend(WATER_RIM, fogT), 0.3);
    g.strokeEllipse(cx.x, cx.y, halfW * scl * 0.5, halfD * scl * 0.45);
  }

  // Caltrop decal (violet-tinted, jagged debris marks)
  _drawCaltropDecal(obs, zRel, fogT) {
    const g = this.graphics;
    const worldX = LANE_TU[obs.lane];
    const halfW = OBS_W_TU / 2;
    const halfD = OBS_D_TU / 2;
    const centreZ = zRel + halfD;

    const verts = this._getShardOutline(obs, 8, halfW * 0.9, halfD * 0.9);
    const screenVerts = verts.map(v => project(worldX + v.dx, centreZ + v.dz));

    g.fillStyle(fogBlend(CALTROP_COLOR, fogT), 0.8);
    g.fillPoints(screenVerts, true);

    // Jagged debris marks — 6 short spike lines radiating from centre
    const cx = project(worldX, centreZ);
    const hw = (halfW * 0.5) * cx.scale;
    const hh = (halfD * 0.5) * cx.scale;
    g.lineStyle(2, fogBlend(0xE0AAFF, fogT), 0.8);
    const angles = [0, 60, 120, 180, 240, 300];
    for (const deg of angles) {
      const rad = deg * Math.PI / 180;
      g.beginPath();
      g.moveTo(cx.x, cx.y);
      g.lineTo(cx.x + Math.cos(rad) * hw, cx.y + Math.sin(rad) * hh * 0.8);
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
