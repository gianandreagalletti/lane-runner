import {
  LANE_CENTERS,
  PLAYER_Y,
  OBS_W,
  OBS_H,
  OBS_COLORS
} from './track.js';

const COL_HALF_X = OBS_W / 2 + 20; // 100
const COL_HALF_Y = OBS_H / 2 + 20; // 50

export class Obstacles {
  constructor(scene, trackData) {
    this.scene = scene;
    this.list = trackData.obstacles.map(o => ({
      lane:     o.lane,
      distance: o.distance,
      type:     o.type,
      hit:      false,
      pending:  false,
      screenY:  -9999
    }));
    this.graphics    = scene.add.graphics();
    this.labelGraphs = scene.add.graphics(); // unused — labels are text objects
    this.labels      = [];
  }

  update(trackPosition) {
    for (const obs of this.list) {
      obs.screenY = PLAYER_Y + trackPosition - obs.distance;
    }
    this._draw();
  }

  checkCollision(playerX) {
    for (const obs of this.list) {
      if (obs.hit || obs.pending) continue;
      const dx = Math.abs(playerX - LANE_CENTERS[obs.lane]);
      const dy = Math.abs(obs.screenY - PLAYER_Y);
      if (dx < COL_HALF_X && dy < COL_HALF_Y) return obs;
    }
    return null;
  }

  markHit(obs)     { obs.hit = true; obs.pending = false; }
  markPending(obs) { obs.pending = true; }
  clearPending(obs){ obs.pending = false; obs.hit = true; }

  destroy() { this.graphics.destroy(); }

  _draw() {
    const g = this.graphics;
    g.clear();
    for (const obs of this.list) {
      if (obs.hit) continue;
      const sy = obs.screenY;
      if (sy < -OBS_H - 2 || sy > this.scene.scale.height + OBS_H) continue;

      const cx   = LANE_CENTERS[obs.lane];
      const left = cx - OBS_W / 2;
      const top  = sy  - OBS_H / 2;

      g.fillStyle(OBS_COLORS[obs.type]);
      g.fillRect(left, top, OBS_W, OBS_H);

      if (obs.type === 'rock')  this._drawRock(g, left, top, cx, sy);
      if (obs.type === 'ice')   this._drawIce(g, left, top, cx, sy);
      if (obs.type === 'water') this._drawWater(g, left, top, cx, sy);

      if (obs.pending) {
        g.lineStyle(4, 0xFFFF00, 0.9);
        g.strokeRect(left - 2, top - 2, OBS_W + 4, OBS_H + 4);
      } else {
        g.lineStyle(2, 0x000000, 0.3);
        g.strokeRect(left, top, OBS_W, OBS_H);
      }
    }
  }

  // ── ROCK: bold X mark (danger / stop) ────────────────────────────────────
  // Shape works in full greyscale — the X is the primary identifier.
  _drawRock(g, left, top, cx, cy) {
    // Dark rough patches
    g.fillStyle(0x5A1510, 0.5);
    g.fillRect(left + 14, top + 10, 26, 14);
    g.fillRect(left + 68, top +  6, 20, 18);
    g.fillRect(left + 108, top + 18, 30, 14);

    // Bold X — the unique shape marker
    const hw = 22, hh = 18;
    g.lineStyle(5, 0x2A0808, 0.9);
    g.beginPath(); g.moveTo(cx - hw, cy - hh); g.lineTo(cx + hw, cy + hh); g.strokePath();
    g.beginPath(); g.moveTo(cx + hw, cy - hh); g.lineTo(cx - hw, cy + hh); g.strokePath();
  }

  // ── ICE: snowflake cross (+ shape) ───────────────────────────────────────
  // Vertical + horizontal lines, distinct from rock's X and water's waves.
  _drawIce(g, left, top, cx, cy) {
    // Background diagonal hatching
    g.lineStyle(1, 0x7BB8D8, 0.45);
    const right = left + OBS_W, bottom = top + OBS_H;
    for (let i = -OBS_H; i < OBS_W; i += 20) {
      let x1 = left + i, y1 = bottom, x2 = left + i + OBS_H, y2 = top;
      if (x1 < left)  { const t=(left-x1)/OBS_H;  x1=left;  y1=bottom-t*OBS_H; }
      if (x2 > right) { const t=(x2-right)/OBS_H; x2=right; y2=top+t*OBS_H; }
      if (x1 >= right || x2 <= left) continue;
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    }
    // Bold + cross (snowflake shape) — the unique shape marker
    g.lineStyle(4, 0x2255AA, 0.85);
    g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx, cy + 22); g.strokePath();
    g.beginPath(); g.moveTo(cx - 34, cy); g.lineTo(cx + 34, cy); g.strokePath();
    // Short crossbars on each arm tip
    g.lineStyle(3, 0x2255AA, 0.7);
    for (const [dx, dy] of [[0,-22],[0,22],[-34,0],[34,0]]) {
      const px = cx + dx, py = cy + dy;
      const perp = Math.abs(dx) > 0 ? [0, 6] : [6, 0];
      g.beginPath(); g.moveTo(px-perp[0],py-perp[1]); g.lineTo(px+perp[0],py+perp[1]); g.strokePath();
    }
  }

  // ── WATER: wave arcs + filled circles (~ shape) ──────────────────────────
  // Dots on wave lines distinguish water from the straight lines of ice.
  _drawWater(g, left, top, cx, cy) {
    g.lineStyle(2, 0x1E6888, 0.7);
    const right = left + OBS_W;
    for (let dy = 12; dy < OBS_H; dy += 14) {
      g.beginPath(); g.moveTo(left + 10, top + dy); g.lineTo(right - 10, top + dy); g.strokePath();
    }
    // Circles on the lines — the unique shape marker
    g.fillStyle(0x1E6888, 0.75);
    for (let dy = 12; dy < OBS_H; dy += 14) {
      for (let dx = 20; dx < OBS_W - 10; dx += 36) {
        g.fillCircle(left + dx, top + dy, 4);
      }
    }
  }
}
