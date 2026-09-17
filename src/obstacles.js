import {
  LANE_CENTERS,
  PLAYER_Y,
  OBS_W,
  OBS_H,
  OBS_COLORS
} from './track.js';

export class Obstacles {
  constructor(scene, trackData, opts = {}) {
    this.scene = scene;

    // numPlayers controls draw behaviour:
    //   1 → hide obstacle once player 0 has resolved it  (1P behaviour, unchanged)
    //   2 → always draw; each player resolves independently
    this.numPlayers  = opts.numPlayers || 1;
    this.laneCenters = opts.laneCenters || LANE_CENTERS;
    this.obsW = opts.obsW || OBS_W;
    this.obsH = opts.obsH || OBS_H;
    this.sx = this.obsW / OBS_W;
    this.sy = this.obsH / OBS_H;
    this.colHalfX = this.obsW / 2 + 20 * this.sx;
    this.colHalfY = this.obsH / 2 + 20 * this.sy;

    this.list = trackData.obstacles.map(o => ({
      lane:     o.lane,
      distance: o.distance,
      type:     o.type,
      // per-player resolved flags (index = player idx)
      hitByPlayer:     [false, false],
      pendingByPlayer: [false, false],
      screenY: -9999
    }));
    this.graphics    = scene.add.graphics();
    this.labelGraphs = scene.add.graphics();
    this.labels      = [];
  }

  // trackPosition should be the camera reference (leader's position in 2P)
  update(trackPosition) {
    for (const obs of this.list) {
      obs.screenY = PLAYER_Y + trackPosition - obs.distance;
    }
    this._draw();
  }

  // playerScreenY defaults to PLAYER_Y so 1P callers don't need to change.
  checkCollision(playerX, playerScreenY = PLAYER_Y, playerIdx = 0) {
    for (const obs of this.list) {
      if (obs.hitByPlayer[playerIdx] || obs.pendingByPlayer[playerIdx]) continue;
      const dx = Math.abs(playerX - this.laneCenters[obs.lane]);
      const dy = Math.abs(obs.screenY - playerScreenY);
      if (dx < this.colHalfX && dy < this.colHalfY) return obs;
    }
    return null;
  }

  markHit(obs, playerIdx = 0)     { obs.hitByPlayer[playerIdx] = true;  obs.pendingByPlayer[playerIdx] = false; }
  markPending(obs, playerIdx = 0) { obs.pendingByPlayer[playerIdx] = true; }
  clearPending(obs, playerIdx = 0){ obs.pendingByPlayer[playerIdx] = false; obs.hitByPlayer[playerIdx] = true; }
  // Rock Break: destroys for all players (shared destruction)
  markHitAll(obs) { obs.hitByPlayer = [true, true]; obs.pendingByPlayer = [false, false]; }

  destroy() { this.graphics.destroy(); }

  _draw() {
    const g = this.graphics;
    g.clear();
    for (const obs of this.list) {
      // Hide once all active players have resolved this obstacle.
      // In 1P: hide when player 0 has resolved it.
      // In 2P: hide only when BOTH players have resolved it (rock_break uses markHitAll;
      //         phase only resolves for the phasing player via clearPending).
      const allHit = obs.hitByPlayer[0] && (this.numPlayers < 2 || obs.hitByPlayer[1]);
      if (allHit) continue;

      const sy = obs.screenY;
      if (sy < -this.obsH - 2 || sy > this.scene.scale.height + this.obsH) continue;

      const cx   = this.laneCenters[obs.lane];
      const left = cx - this.obsW / 2;
      const top  = sy  - this.obsH / 2;

      g.fillStyle(OBS_COLORS[obs.type]);
      g.fillRect(left, top, this.obsW, this.obsH);

      if (obs.type === 'rock')  this._drawRock(g, left, top, cx, sy);
      if (obs.type === 'ice')   this._drawIce(g, left, top, cx, sy);
      if (obs.type === 'water') this._drawWater(g, left, top, cx, sy);

      const isPending = obs.pendingByPlayer[0] || obs.pendingByPlayer[1];
      if (isPending) {
        g.lineStyle(4, 0xFFFF00, 0.9);
        g.strokeRect(left - 2, top - 2, this.obsW + 4, this.obsH + 4);
      } else {
        g.lineStyle(2, 0x000000, 0.3);
        g.strokeRect(left, top, this.obsW, this.obsH);
      }
    }
  }

  // ── ROCK: bold X mark ──────────────────────────────────────────────────────
  _drawRock(g, left, top, cx, cy) {
    const { sx, sy } = this;
    g.fillStyle(0x5A1510, 0.5);
    g.fillRect(left + 14*sx, top + 10*sy, 26*sx, 14*sy);
    g.fillRect(left + 68*sx, top +  6*sy, 20*sx, 18*sy);
    g.fillRect(left + 108*sx, top + 18*sy, 30*sx, 14*sy);
    const hw = 22*sx, hh = 18*sy;
    g.lineStyle(5, 0x2A0808, 0.9);
    g.beginPath(); g.moveTo(cx - hw, cy - hh); g.lineTo(cx + hw, cy + hh); g.strokePath();
    g.beginPath(); g.moveTo(cx + hw, cy - hh); g.lineTo(cx - hw, cy + hh); g.strokePath();
  }

  // ── ICE: snowflake cross ───────────────────────────────────────────────────
  _drawIce(g, left, top, cx, cy) {
    const { sx, sy, obsW, obsH } = this;
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

  // ── WATER: wave lines + circles ───────────────────────────────────────────
  _drawWater(g, left, top, cx, cy) {
    const { sx, sy, obsW, obsH } = this;
    const right = left + obsW;
    g.lineStyle(2, 0x1E6888, 0.7);
    for (let dy = 12*sy; dy < obsH; dy += 14*sy) {
      g.beginPath(); g.moveTo(left + 10*sx, top + dy); g.lineTo(right - 10*sx, top + dy); g.strokePath();
    }
    g.fillStyle(0x1E6888, 0.75);
    for (let dy = 12*sy; dy < obsH; dy += 14*sy) {
      for (let dx = 20*sx; dx < obsW - 10*sx; dx += 36*sx) {
        g.fillCircle(left + dx, top + dy, 4 * Math.min(sx, sy));
      }
    }
  }
}
