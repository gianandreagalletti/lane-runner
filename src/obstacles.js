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
      pending:  false,  // true while in reactive window
      screenY:  -9999
    }));
    this.graphics = scene.add.graphics();
  }

  update(trackPosition) {
    for (const obs of this.list) {
      obs.screenY = PLAYER_Y + trackPosition - obs.distance;
    }
    this._draw();
  }

  /**
   * Returns the first un-hit, non-pending obstacle overlapping the player.
   * Does NOT mark it hit — caller must call markHit(obs) when resolved.
   * @param {number} playerX
   * @returns {object|null}
   */
  checkCollision(playerX) {
    for (const obs of this.list) {
      if (obs.hit || obs.pending) continue;
      const dx = Math.abs(playerX - LANE_CENTERS[obs.lane]);
      const dy = Math.abs(obs.screenY - PLAYER_Y);
      if (dx < COL_HALF_X && dy < COL_HALF_Y) {
        return obs;
      }
    }
    return null;
  }

  /** Mark an obstacle as resolved (removed from play). */
  markHit(obs) {
    obs.hit     = true;
    obs.pending = false;
  }

  /** Mark an obstacle as "in reactive window" — still draws but highlighted. */
  markPending(obs) {
    obs.pending = true;
  }

  /** Cancel pending state (reactive cancelled by boost). */
  clearPending(obs) {
    obs.pending = false;
    obs.hit     = true; // consumed by boost, disappears
  }

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

      if (obs.type === 'ice')   this._drawIce(g, left, top);
      if (obs.type === 'rock')  this._drawRock(g, left, top);
      if (obs.type === 'water') this._drawWater(g, left, top);

      // Reactive-window highlight: bright pulsing border
      if (obs.pending) {
        g.lineStyle(4, 0xFFFF00, 0.9);
        g.strokeRect(left - 2, top - 2, OBS_W + 4, OBS_H + 4);
      } else {
        g.lineStyle(1, 0x000000, 0.25);
        g.strokeRect(left, top, OBS_W, OBS_H);
      }
    }
  }

  _drawIce(g, left, top) {
    g.lineStyle(2, 0x7BB8D8, 0.7);
    const right = left + OBS_W, bottom = top + OBS_H;
    for (let i = -OBS_H; i < OBS_W; i += 22) {
      let x1 = left + i, y1 = bottom, x2 = left + i + OBS_H, y2 = top;
      if (x1 < left)  { const t=(left-x1)/OBS_H;  x1=left;  y1=bottom-t*OBS_H; }
      if (x2 > right) { const t=(x2-right)/OBS_H; x2=right; y2=top+t*OBS_H;    }
      if (x1 >= right || x2 <= left) continue;
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    }
  }

  _drawRock(g, left, top) {
    g.fillStyle(0x8B2A26, 0.45);
    g.fillRect(left+18, top+12, 28, 14);
    g.fillRect(left+72, top+8,  20, 18);
    g.fillRect(left+110,top+20, 32, 12);
  }

  _drawWater(g, left, top) {
    g.lineStyle(2, 0x60C8E0, 0.55);
    const right = left + OBS_W;
    for (let dy = 14; dy < OBS_H; dy += 16) {
      g.beginPath(); g.moveTo(left+12, top+dy); g.lineTo(right-12, top+dy); g.strokePath();
    }
  }
}
