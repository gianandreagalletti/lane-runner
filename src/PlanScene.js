import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, LANE_COLORS, OBS_COLORS } from './track.js';
import { BOOSTS, BOOST_ORDER, BOOST_UNLOCK_LEVEL } from './boosts.js';
import { loadProgress } from './progression.js';

// ── Left panel constants ──────────────────────────────────────────────────────
const MAP_TOP    = 85;
const MAP_BOTTOM = 618;
const MAP_H      = MAP_BOTTOM - MAP_TOP;

const COL_W  = 138;
const COL_GAP = 16;
const COL_X0  = 64;

function colLeft(lane)   { return COL_X0 + lane * (COL_W + COL_GAP); }
function colCenter(lane) { return colLeft(lane) + COL_W / 2; }

// ── Right panel constants ─────────────────────────────────────────────────────
const RP_CX   = 935;
const CARD_W  = 182;
const CARD_H  = 94;
const CARD_GX = 18;
const CARD_GY = 22;
const CARD_COL = [644, 644 + CARD_W + CARD_GX, 644 + 2 * (CARD_W + CARD_GX)];
const CARD_ROW = [116, 116 + CARD_H + CARD_GY];

export class PlanScene extends Phaser.Scene {
  constructor() { super({ key: 'PlanScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.mode           = data.mode || '1p';
    this.selectedBoosts = new Set();
    this.progress       = loadProgress();
    this.planStart      = 0; // set in create() after Phaser is ready
  }

  create() {
    this.planStart = Date.now();
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    this.add.text(CANVAS_W / 2, 16, `${this.trackData.name}  —  PLAN YOUR RUN`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#7899AA'
    }).setOrigin(0.5, 0);

    const div = this.add.graphics();
    div.lineStyle(1, 0x223344, 1);
    div.lineBetween(596, 8, 596, CANVAS_H - 8);

    this._drawMap();
    this._drawBoostPicker();
    this._drawStartArea();

    this.input.keyboard.on('keydown', e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) this._toggle(BOOST_ORDER[n - 1]);
      if (e.key === 'Enter') this._tryStart();
      if (e.key === 'Escape') this.scene.start('MenuScene', { mode: this.mode });
    });
  }

  // ── Track map ─────────────────────────────────────────────────────────────

  _drawMap() {
    const g  = this.add.graphics();
    const sc = MAP_H / this.trackData.length;

    for (let i = 0; i < 3; i++) {
      g.fillStyle(LANE_COLORS[i], 0.28);
      g.fillRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
      g.lineStyle(1, 0xFFFFFF, 0.09);
      g.strokeRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
    }

    // Distance ticks
    for (let d = 0; d <= this.trackData.length; d += 1000) {
      const ty = MAP_TOP + d * sc;
      g.lineStyle(1, 0x445566, 1);
      g.lineBetween(COL_X0 - 10, ty, COL_X0 - 2, ty);
      this.add.text(COL_X0 - 13, ty, `${d}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#445566'
      }).setOrigin(1, 0.5);
    }

    const LABELS = ['LEFT', 'CENTER', 'RIGHT'];
    for (let i = 0; i < 3; i++) {
      this.add.text(colCenter(i), MAP_TOP - 14, LABELS[i], {
        fontSize: '12px', fontFamily: 'monospace', color: '#8899AA'
      }).setOrigin(0.5, 1);
    }

    const BW = COL_W - 16, BH = 12;
    // Label letters + shape glyph so colorblind players can read the map
    const TYPE_LABEL = { rock: 'R ✕', ice: 'I +', water: 'W ~' };
    const LABEL_COL  = { rock: '#FFB8B0', ice: '#C8F0FF', water: '#C8FFFF' };
    for (const obs of this.trackData.obstacles) {
      const ty  = MAP_TOP + obs.distance * sc;
      const lx  = colLeft(obs.lane) + 8;
      g.fillStyle(OBS_COLORS[obs.type]);
      g.fillRect(lx, ty - BH / 2, BW, BH);
      // Short type label centered on block
      this.add.text(lx + BW / 2, ty, TYPE_LABEL[obs.type], {
        fontSize: '8px', fontFamily: 'monospace', color: LABEL_COL[obs.type]
      }).setOrigin(0.5, 0.5);
    }

    const counts = this._countObs();
    const SY = MAP_BOTTOM + 14;
    for (let i = 0; i < 3; i++) {
      const c = counts[i];
      const parts = [];
      if (c.rock  > 0) parts.push(`${c.rock} rock`);
      if (c.ice   > 0) parts.push(`${c.ice} ice`);
      if (c.water > 0) parts.push(`${c.water} water`);
      this.add.text(colCenter(i), SY, parts.join('  ') || 'clear', {
        fontSize: '11px', fontFamily: 'monospace', color: '#667788'
      }).setOrigin(0.5, 0);
    }
  }

  _countObs() {
    const c = [{rock:0,ice:0,water:0},{rock:0,ice:0,water:0},{rock:0,ice:0,water:0}];
    for (const o of this.trackData.obstacles) c[o.lane][o.type]++;
    return c;
  }

  // ── Boost picker ──────────────────────────────────────────────────────────

  _drawBoostPicker() {
    this.add.text(RP_CX, 42, 'SELECT LOADOUT', {
      fontSize: '20px', fontFamily: 'monospace', color: '#AABBCC'
    }).setOrigin(0.5, 0);

    this.add.text(RP_CX, 68, 'Keys 1–6 or click · choose exactly 3', {
      fontSize: '13px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5, 0);

    this.add.text(CARD_COL[0], CARD_ROW[0] - 10, 'PASSIVE', {
      fontSize: '11px', fontFamily: 'monospace', color: '#335577'
    }).setOrigin(0, 1);
    this.add.text(CARD_COL[0], CARD_ROW[1] - 10, 'ACTIVE', {
      fontSize: '11px', fontFamily: 'monospace', color: '#664422'
    }).setOrigin(0, 1);

    this.cards = {};

    BOOST_ORDER.forEach((id, idx) => {
      const col      = idx % 3;
      const row      = Math.floor(idx / 3);
      const cx       = CARD_COL[col] + CARD_W / 2;
      const cy       = CARD_ROW[row] + CARD_H / 2;
      const boost    = BOOSTS[id];
      const isPass   = boost.type === 'passive';
      const reqLevel = BOOST_UNLOCK_LEVEL[id];
      const locked   = this.progress.level < reqLevel;

      const fillColor = locked ? 0x0e0e12 : (isPass ? 0x162030 : 0x1a1418);
      const edgeColor = locked ? 0x222228 : (isPass ? 0x2a4060 : 0x3a2828);

      const bg = this.add.rectangle(cx, cy, CARD_W, CARD_H, fillColor)
        .setStrokeStyle(2, edgeColor);

      if (!locked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
          if (!this.selectedBoosts.has(id)) bg.setFillStyle(fillColor + 0x080808);
        });
        bg.on('pointerout', () => {
          if (!this.selectedBoosts.has(id)) bg.setFillStyle(fillColor);
        });
        bg.on('pointerdown', () => this._toggle(id));
      }

      // Number badge
      this.add.text(CARD_COL[col] + 10, CARD_ROW[row] + 8, `${idx + 1}`, {
        fontSize: '11px', fontFamily: 'monospace',
        color: locked ? '#333338' : '#334455'
      });

      const typeLabel = isPass ? '● passive' : '◆ active';
      const typeColor = locked ? '#2a2a30'
        : (isPass ? '#3366AA' : '#885533');
      this.add.text(cx, cy - 28, typeLabel, {
        fontSize: '11px', fontFamily: 'monospace', color: typeColor
      }).setOrigin(0.5);

      const nameColor = locked ? '#333340' : '#DDEEFF';
      const nameT = this.add.text(cx, cy - 8, boost.name, {
        fontSize: '17px', fontFamily: 'monospace', color: nameColor
      }).setOrigin(0.5);

      const descText = locked ? `Unlocks at level ${reqLevel}` : boost.desc;
      const descColor = locked ? '#282832' : '#556677';
      const descT = this.add.text(cx, cy + 20, descText, {
        fontSize: '12px', fontFamily: 'monospace', color: descColor
      }).setOrigin(0.5);

      this.cards[id] = { bg, nameT, descT, fillColor, edgeColor, locked };
    });
  }

  _toggle(id) {
    if (this.cards[id].locked) return;
    if (this.selectedBoosts.has(id)) {
      this.selectedBoosts.delete(id);
    } else {
      if (this.selectedBoosts.size >= 3) return;
      this.selectedBoosts.add(id);
    }
    this._refreshCards();
    this._refreshStart();
  }

  _refreshCards() {
    for (const [id, c] of Object.entries(this.cards)) {
      if (c.locked) continue;
      if (this.selectedBoosts.has(id)) {
        c.bg.setFillStyle(0x1a3520);
        c.bg.setStrokeStyle(2, 0x44BB66);
        c.nameT.setColor('#88FFAA');
        c.descT.setColor('#557766');
      } else {
        c.bg.setFillStyle(c.fillColor);
        c.bg.setStrokeStyle(2, c.edgeColor);
        c.nameT.setColor('#DDEEFF');
        c.descT.setColor('#556677');
      }
    }
  }

  // ── Start area ────────────────────────────────────────────────────────────

  _drawStartArea() {
    const sy = CARD_ROW[1] + CARD_H + 28;

    this.counterText = this.add.text(RP_CX, sy, 'Selected: 0 / 3', {
      fontSize: '16px', fontFamily: 'monospace', color: '#667788'
    }).setOrigin(0.5, 0);

    const btnY = sy + 52;
    this.startBg = this.add.rectangle(RP_CX, btnY, 260, 54, 0x0e2214)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x223322);

    this.startText = this.add.text(RP_CX, btnY, 'START RUN', {
      fontSize: '24px', fontFamily: 'monospace', color: '#2A5535'
    }).setOrigin(0.5);

    this.startBg.on('pointerover', () => {
      if (this.selectedBoosts.size === 3) this.startBg.setFillStyle(0x163020);
    });
    this.startBg.on('pointerout', () => {
      if (this.selectedBoosts.size === 3) this.startBg.setFillStyle(0x0e2214);
    });
    this.startBg.on('pointerdown', () => this._tryStart());

    this.add.text(RP_CX, btnY + 40, 'ESC = back to menu  ·  ENTER = start', {
      fontSize: '12px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5, 0);
  }

  _refreshStart() {
    const ready = this.selectedBoosts.size === 3;
    this.counterText.setText(`Selected: ${this.selectedBoosts.size} / 3`);
    this.counterText.setColor(ready ? '#66BB88' : '#667788');
    this.startBg.setFillStyle(ready ? 0x0e2214 : 0x0a1410);
    this.startBg.setStrokeStyle(2, ready ? 0x44AA66 : 0x223322);
    this.startText.setColor(ready ? '#55EE88' : '#2A5535');
  }

  _tryStart() {
    if (this.selectedBoosts.size !== 3) return;
    this.scene.start('RunScene', {
      mode:           this.mode,
      trackData:      this.trackData,
      loadout:        Array.from(this.selectedBoosts),
      planningTimeMs: Date.now() - this.planStart
    });
  }
}
