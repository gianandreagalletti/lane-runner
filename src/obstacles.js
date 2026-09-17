import {
  LANE_CENTERS, PLAYER_Y, OBS_W, OBS_H, OBS_COLORS
} from './track.js';
import { CENTI_SCALE } from '../sim/rules.js';

export class Obstacles {
  constructor(scene, numPlayers = 1) {
    this.scene      = scene;
    this.numPlayers = numPlayers;
    this.graphics   = scene.add.graphics();
    // scale factors for decorative drawing (same logic as before)
    this.sx = OBS_W / OBS_W; // = 1 (kept for _drawRock/_drawIce/_drawWater compat)
    this.sy = OBS_H / OBS_H; // = 1
  }

  // obstacles = state.obstacles array; camPositionScaled = leader's trackPosition (sub-units)
  render(obstacles, camPositionScaled) {
    const g = this.graphics;
    g.clear();
    for (const obs of obstacles) {
      const allHit = obs.hitByPlayer[0] && (this.numPlayers < 2 || obs.hitByPlayer[1]);
      if (allHit) continue;

      const screenY = PLAYER_Y + (camPositionScaled - obs.distanceScaled) / CENTI_SCALE;
      if (screenY < -OBS_H - 2 || screenY > this.scene.scale.height + OBS_H) continue;

      const cx   = LANE_CENTERS[obs.lane];
      const left = cx - OBS_W / 2;
      const top  = screenY - OBS_H / 2;

      g.fillStyle(OBS_COLORS[obs.type]);
      g.fillRect(left, top, OBS_W, OBS_H);

      if (obs.type === 'rock')  this._drawRock(g, left, top, cx, screenY);
      if (obs.type === 'ice')   this._drawIce(g, left, top, cx, screenY);
      if (obs.type === 'water') this._drawWater(g, left, top, cx, screenY);

      const isPending = obs.pendingByPlayer[0] || obs.pendingByPlayer[1];
      if (isPending) {
        g.lineStyle(4, 0xFFFF00, 0.9);
        g.strokeRect(left - 2, top - 2, OBS_W + 4, OBS_H + 4);
      } else {
        g.lineStyle(2, 0x000000, 0.3);
        g.strokeRect(left, top, OBS_W, OBS_H);
      }
    }
  }

  // Helper for effects: get screen Y of an obstacle given camPositionScaled
  getScreenY(obs, camPositionScaled) {
    return PLAYER_Y + (camPositionScaled - obs.distanceScaled) / CENTI_SCALE;
  }

  destroy() { this.graphics.destroy(); }

  _drawRock(g, left, top, cx, cy) {
    const sx = 1, sy = 1;
    g.fillStyle(0x5A1510, 0.5);
    g.fillRect(left + 14*sx, top + 10*sy, 26*sx, 14*sy);
    g.fillRect(left + 68*sx, top +  6*sy, 20*sx, 18*sy);
    g.fillRect(left + 108*sx, top + 18*sy, 30*sx, 14*sy);
    const hw = 22*sx, hh = 18*sy;
    g.lineStyle(5, 0x2A0808, 0.9);
    g.beginPath(); g.moveTo(cx - hw, cy - hh); g.lineTo(cx + hw, cy + hh); g.strokePath();
    g.beginPath(); g.moveTo(cx + hw, cy - hh); g.lineTo(cx - hw, cy + hh); g.strokePath();
  }

  _drawIce(g, left, top, cx, cy) {
    const sx = 1, sy = 1, obsW = OBS_W, obsH = OBS_H;
    const right = left + obsW, bottom = top + obsH;
    g.lineStyle(1, 0x7BB8D8, 0.45);
    for (let i = -obsH; i < obsW; i += 20 * sx) {
      let x1 = left + i, y1 = bottom, x2 = left + i + obsH, y2 = top;
      if (x1 < left)  { const t = (left - x1) / obsH;  x1 = left;  y1 = bottom - t * obsH; }
      if (x2 > right) { const t = (x2 - right) / obsH; x2 = right; y2 = top + t * obsH; }
      if (x1 >= right || x2 <= left) continue;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    g.lineStyle(4, 0x2255AA, 0.85);
    g.beginPath(); g.moveTo(cx, cy - 22*sy); g.lineTo(cx, cy + 22*sy); g.strokePath();
    g.beginPath(); g.moveTo(cx - 34*sx, cy); g.lineTo(cx + 34*sx, cy); g.strokePath();
    g.lineStyle(3, 0x2255AA, 0.7);
    for (const [dx, dy] of [[0, -22*sy], [0, 22*sy], [-34*sx, 0], [34*sx, 0]]) {
      const px = cx + dx, py = cy + dy;
      const perp = Math.abs(dx) > 0 ? [0, 6*sy] : [6*sx, 0];
      g.beginPath(); g.moveTo(px - perp[0], py - perp[1]); g.lineTo(px + perp[0], py + perp[1]); g.strokePath();
    }
  }

  _drawWater(g, left, top, cx, cy) {
    const sx = 1, sy = 1, obsW = OBS_W, obsH = OBS_H;
    const right = left + obsW;
    g.lineStyle(2, 0x1E6888, 0.7);
    for (let dy = 12*sy; dy < obsH; dy += 14*sy) {
      g.beginPath(); g.moveTo(left + 10*sx, top + dy); g.lineTo(right - 10*sx, top + dy); g.strokePath();
    }
    g.fillStyle(0x1E6888, 0.75);
    for (let dy = 12*sy; dy < obsH; dy += 14*sy) {
      for (let dx = 20*sx; dx < obsW - 10*sx; dx += 36*sx) {
        g.fillCircle(left + dx, top + dy, 4);
      }
    }
  }
}
