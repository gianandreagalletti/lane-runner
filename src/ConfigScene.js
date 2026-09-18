// src/ConfigScene.js
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, LANE_COLORS, OBS_COLORS } from './track.js';
import { BINDINGS } from './controls.js';
import { generateTrack, PRESETS } from '../sim/trackGen.js';
import { validateBandList } from '../sim/validateTrack.js';
import { getAllTracks, saveTrack, deleteTrack, computeEstimate } from './TrackStore.js';

// ─── Layout constants ──────────────────────────────────────────────────────────
const HEADER_H  = 56;
const FOOTER_H  = 58;
const PAD       = 8;
const COL_W     = 120;
const COL_GAP   = 12;
const COL_X0    = 56;
function colLeft(lane)   { return COL_X0 + lane * (COL_W + COL_GAP); }
function colCenter(lane) { return colLeft(lane) + COL_W / 2; }

const ED_ROW_H  = 26;
const ED_CELL_H = 20;
const ED_DEL_X0 = 32;
const ED_DEL_X1 = 54;

const DIVIDER_X  = COL_X0 + 3 * (COL_W + COL_GAP) - COL_GAP + 28; // = 472
const CTRL_X     = DIVIDER_X + 14;                                   // = 486
const CTRL_W     = CANVAS_W - CTRL_X - PAD;                         // = 786
const BODY_Y     = HEADER_H + PAD;                                   // = 64
const BODY_BOT   = CANVAS_H - FOOTER_H - PAD;                       // = 654
const BODY_H     = BODY_BOT - BODY_Y;                                // = 590

const PREV_X = PAD;
const PREV_Y = BODY_Y;
const PREV_W = DIVIDER_X - PAD * 2;
const PREV_H = BODY_H;

// Preview map uses BODY constants
const MAP_TOP    = BODY_Y;
const MAP_BOTTOM = BODY_BOT;
const MAP_H      = BODY_H;

// ─── Param row columns ────────────────────────────────────────────────────────
const P_LBL_X   = CTRL_X;
const P_DEC_CX  = CTRL_X + 106;
const P_VAL_CX  = CTRL_X + 150;
const P_INC_CX  = CTRL_X + 198;
const P_VAL_W   = 56;
const P_BTN_W   = 28;
const P_ROW_H   = 28;
const P_ROW_GAP = 4;

// ─── Dev layout assertions ────────────────────────────────────────────────────
const _IS_DEV = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

function _assertLayoutItems(items) {
  if (!_IS_DEV) return;
  for (let i = 0; i < items.length; i++) {
    const { name, x, y, w, h } = items[i];
    if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) {
      console.warn(`LAYOUT [${name}] non-finite dimension: {${x},${y},${w},${h}}`);
    } else if (w <= 0 || h <= 0) {
      console.warn(`LAYOUT [${name}] zero/negative dimension: {${x},${y},${w},${h}}`);
    } else {
      if (x < 0 || y < 0 || x + w > CANVAS_W || y + h > CANVAS_H) {
        console.warn(`LAYOUT [${name}] out of canvas: {${x},${y},${w},${h}}`);
      }
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
          console.warn(`LAYOUT "${name}" overlaps "${b.name}": {${x},${y},${w},${h}} vs {${b.x},${b.y},${b.w},${b.h}}`);
        }
      }
    }
  }
}

// ─── RowCursor ────────────────────────────────────────────────────────────────
class RowCursor {
  constructor(startY) { this._y = startY; }
  slot(h, gap = 4) { const y = this._y; this._y += h + gap; return y; }
  get y() { return this._y; }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  { key: 'rock',           label: 'RAIL',  color: 0xC4463A, textColor: '#FFAAAA' },
  { key: 'ice',            label: 'ICE',   color: 0xB8D8E8, textColor: '#003355' },
  { key: 'water',          label: 'WATER', color: 0x3AA8C4, textColor: '#001122' },
  { key: 'caltrop_pickup', label: 'C.PU',  color: 0x9B6BDA, textColor: '#FFFFFF' },
  { key: 'snipe_pickup',   label: 'S.PU',  color: 0x7ED957, textColor: '#002200' },
  { key: null,             label: 'ERASE', color: 0x222222, textColor: '#888888' },
];

function _typeColor(type) {
  const map = { rock: 0xC4463A, ice: 0xB8D8E8, water: 0x3AA8C4, caltrop_pickup: 0x9B6BDA, snipe_pickup: 0x7ED957 };
  return map[type] ?? 0x333333;
}

function _tintColor(hex, factor) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xFF) * factor + 20));
  const g = Math.min(255, Math.round(((hex >> 8)  & 0xFF) * factor + 20));
  const b = Math.min(255, Math.round((hex & 0xFF) * factor + 20));
  return (r << 16) | (g << 8) | b;
}

function _countBands(obstacles) { return new Set(obstacles.map(o => o.distance)).size; }

function _countGates(obstacles) {
  const m = new Map();
  for (const o of obstacles) { if (!m.has(o.distance)) m.set(o.distance, []); m.get(o.distance).push(o); }
  let g = 0;
  for (const obs of m.values()) if (obs.filter(o => o.type === 'rock').length === 2) g++;
  return g;
}

function _countDamageBands(obstacles) {
  const m = new Map();
  for (const o of obstacles) { if (!m.has(o.distance)) m.set(o.distance, []); m.get(o.distance).push(o); }
  let d = 0;
  for (const obs of m.values()) if (!obs.some(o => o.type === 'rock') && obs.length === 3) d++;
  return d;
}

function _getGateDists(obstacles) {
  const m = new Map();
  for (const o of obstacles) { if (!m.has(o.distance)) m.set(o.distance, []); m.get(o.distance).push(o); }
  const result = new Map();
  for (const [dist, obs] of m) {
    const rocks = obs.filter(o => o.type === 'rock');
    if (rocks.length === 2) {
      const rl = new Set(rocks.map(o => o.lane));
      result.set(dist, [0, 1, 2].find(l => !rl.has(l)));
    }
  }
  return result;
}

// ─── ConfigScene ──────────────────────────────────────────────────────────────
export class ConfigScene extends Phaser.Scene {
  constructor() { super({ key: 'ConfigScene' }); }

  init(data) {
    this.mode       = data?.mode || '1p';
    this._claims    = data?.claims || null;
    this._startMode = data?.startMode || 'genera';
  }

  create() {
    // -- Genera state --
    this._presetNames    = Object.keys(PRESETS);
    this._presetIdx      = 0;
    this._params         = { ...PRESETS[this._presetNames[0]] };
    this._seed           = Date.now() & 0xFFFFFF;
    this._showAdvanced   = false;
    this._trackData      = null;
    this._genError       = null;
    this._seedInputActive = false;
    this._seedInputVal   = '';

    // -- Editor state --
    this._edBands       = [];
    this._edScrollY     = 0;
    this._edPalette     = 'ice';
    this._edViolations  = [];
    this._edSpacing     = 240;
    this._edNameInput   = '';
    this._edNameActive  = false;
    this._edTrackId     = `authored_${Date.now()}`;
    this._edSavedTracks = [];

    // 1. Background
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    // 2. HEADER band
    const layoutItems = [];
    this.add.text(PAD + 4, HEADER_H / 2, 'TRACK CONFIGURATOR', {
      fontSize: '22px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0, 0.5);

    // Mode buttons right-aligned in header
    // COSTRUISCI: 140px wide, center at (CANVAS_W - PAD - 70, HEADER_H/2)
    const conCX = CANVAS_W - PAD - 70;
    const genCX = CANVAS_W - PAD - 140 - 8 - 60;
    this._modeConBg = this.add.rectangle(conCX, HEADER_H / 2, 140, 30, 0x0e1a24)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x1c3044);
    this._modeConLabel = this.add.text(conCX, HEADER_H / 2, 'COSTRUISCI', {
      fontSize: '13px', fontFamily: 'monospace', color: '#667788'
    }).setOrigin(0.5);
    this._modeGenBg = this.add.rectangle(genCX, HEADER_H / 2, 120, 30, 0x162840)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x3366AA);
    this._modeGenLabel = this.add.text(genCX, HEADER_H / 2, 'GENERA', {
      fontSize: '13px', fontFamily: 'monospace', color: '#88BBEE'
    }).setOrigin(0.5);

    this._modeGenBg.on('pointerdown', () => this._switchMode('genera'));
    this._modeConBg.on('pointerdown', () => this._switchMode('costruisci'));
    this._modeGenBg.on('pointerover', () => { if (this._configMode !== 'genera') this._modeGenBg.setFillStyle(0x14222e); });
    this._modeGenBg.on('pointerout',  () => { if (this._configMode !== 'genera') this._modeGenBg.setFillStyle(0x0e1a24); });
    this._modeConBg.on('pointerover', () => { if (this._configMode !== 'costruisci') this._modeConBg.setFillStyle(0x14221a); });
    this._modeConBg.on('pointerout',  () => { if (this._configMode !== 'costruisci') this._modeConBg.setFillStyle(0x0e1a24); });

    layoutItems.push({ name: 'header-title', x: PAD + 4, y: 0, w: 280, h: HEADER_H });
    layoutItems.push({ name: 'header-gen-btn', x: genCX - 60, y: 0, w: 120, h: HEADER_H });
    layoutItems.push({ name: 'header-con-btn', x: conCX - 70, y: 0, w: 140, h: HEADER_H });

    // Thin horizontal divider at y=HEADER_H
    const hdrDiv = this.add.graphics();
    hdrDiv.lineStyle(1, 0x223344, 1);
    hdrDiv.lineBetween(0, HEADER_H, CANVAS_W, HEADER_H);

    // 3. Vertical divider
    const vDiv = this.add.graphics();
    vDiv.lineStyle(1, 0x223344, 1);
    vDiv.lineBetween(DIVIDER_X, BODY_Y, DIVIDER_X, BODY_BOT);

    // 4. Map graphics + containers
    this._mapG             = this.add.graphics();
    this._mapContainer     = this.add.container(0, 0);
    this._edLabelContainer = this.add.container(0, 0);

    // 5. Geometry mask for map area
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(PREV_X, PREV_Y, PREV_W, PREV_H);
    const mask = maskShape.createGeometryMask();
    this._mapG.setMask(mask);
    this._mapContainer.setMask(mask);
    this._edLabelContainer.setMask(mask);

    // 6. FOOTER band
    const footerDiv = this.add.graphics();
    footerDiv.lineStyle(1, 0x223344, 1);
    footerDiv.lineBetween(0, CANVAS_H - FOOTER_H, CANVAS_W, CANVAS_H - FOOTER_H);

    this.add.text(PAD + 4, CANVAS_H - FOOTER_H / 2, 'ESC = back', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455'
    }).setOrigin(0, 0.5);

    const startCX = CTRL_X + CTRL_W / 2;
    const startCY = CANVAS_H - FOOTER_H / 2;
    this._startBg = this.add.rectangle(startCX, startCY, CTRL_W - 16, FOOTER_H - 12, 0x0e2214)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x223322);
    this._startText = this.add.text(startCX, startCY, 'START PLANNING ->', {
      fontSize: '18px', fontFamily: 'monospace', color: '#2A5535'
    }).setOrigin(0.5);
    this._startBg.on('pointerover', () => this._startBg.setFillStyle(0x163020));
    this._startBg.on('pointerout',  () => this._startBg.setFillStyle(0x0e2214));
    this._startBg.on('pointerdown', () => this._startPlanning());

    // 7. Build Genera panel
    this._genPanel = this.add.container(0, 0);
    this._buildGeneraPanel();

    // 8. Build Editor panel
    this._edPanel = this.add.container(0, 0);
    this._buildEditorPanel();

    // 9. Keyboard + editor pointer input
    this._setupKeyboard();
    this._setupEditorInput();

    // 10. Load saved tracks, switch mode
    this._edSavedTracks = getAllTracks();
    this._switchMode(this._startMode);

    _assertLayoutItems(layoutItems);
  }

  // ─── Genera panel ───────────────────────────────────────────────────────────
  _buildGeneraPanel() {
    this._genPanel.removeAll(true);
    const g = this._genPanel;
    const cur = new RowCursor(BODY_Y + PAD);
    const layoutItems = [];

    // PRESETS label
    const presLblY = cur.slot(16, 4);
    const presLbl = this.add.text(CTRL_X, presLblY, 'PRESET', { fontSize: '11px', fontFamily: 'monospace', color: '#445566' });
    g.add(presLbl);
    layoutItems.push({ name: 'preset-lbl', x: CTRL_X, y: presLblY, w: 50, h: 16 });

    // Preset buttons (distribute evenly across CTRL_W)
    const presRowY = cur.slot(30, 8);
    const nP = this._presetNames.length;
    const pbW = Math.floor((CTRL_W - (nP - 1) * 6) / nP);
    this._presetBtns = [];
    this._presetNames.forEach((name, i) => {
      const bx = CTRL_X + i * (pbW + 6);
      const cx = bx + pbW / 2;
      const cy = presRowY + 15;
      const bg = this.add.rectangle(cx, cy, pbW, 28, 0x0e1a24)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x1c3044);
      const lbl = this.add.text(cx, cy, name, { fontSize: '11px', fontFamily: 'monospace', color: '#AADDFF' }).setOrigin(0.5);
      bg.on('pointerdown', () => this._selectPreset(i));
      bg.on('pointerover', () => { if (this._presetIdx !== i) bg.setFillStyle(0x14222e); });
      bg.on('pointerout',  () => { if (this._presetIdx !== i) bg.setFillStyle(0x0e1a24); });
      this._presetBtns.push({ bg, label: lbl });
      g.add([bg, lbl]);
      layoutItems.push({ name: `preset-${i}`, x: bx, y: presRowY, w: pbW, h: 30 });
    });
    this._refreshPresetButtons();

    // ADVANCED toggle
    const advRowY = cur.slot(28, 4);
    const advBg = this.add.rectangle(CTRL_X + 65, advRowY + 14, 130, 24, 0x0e1020)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x334466);
    this._advLabel = this.add.text(CTRL_X + 65, advRowY + 14, this._showAdvanced ? 'PARAMS v' : 'PARAMS >', { fontSize: '11px', fontFamily: 'monospace', color: '#446688' }).setOrigin(0.5);
    advBg.on('pointerdown', () => {
      this._showAdvanced = !this._showAdvanced;
      this._advLabel.setText(this._showAdvanced ? 'PARAMS v' : 'PARAMS >');
      this._paramContainer.setVisible(this._showAdvanced);
      this._regenerate();
    });
    advBg.on('pointerover', () => advBg.setFillStyle(0x141428));
    advBg.on('pointerout',  () => advBg.setFillStyle(0x0e1020));
    g.add([advBg, this._advLabel]);
    layoutItems.push({ name: 'adv-toggle', x: CTRL_X, y: advRowY, w: 130, h: 28 });

    // PARAM rows — always built; visibility controlled by _paramContainer
    this._paramRefs = {};
    this._paramContainer = this.add.container(0, 0);
    const PARAM_DEFS = [
      { key: 'rhythm',    label: 'Rhythm',    unit: 's',  min: 0.6,  max: 2.0,  step: 0.05, fmt: v => v.toFixed(2) },
      { key: 'runLength', label: 'Run Len.',  unit: 's',  min: 25,   max: 90,   step: 5,    fmt: v => `${v}` },
      { key: 'pressure',  label: 'Pressure',  unit: '%',  min: 40,   max: 100,  step: 5,    fmt: v => `${v}` },
      { key: 'gates',     label: 'Gates',     unit: '%',  min: 0,    max: 50,   step: 5,    fmt: v => `${v}` },
      { key: 'laneBias',  label: 'Lane Bias', unit: '',   min: 0,    max: 100,  step: 5,    fmt: v => `${v}` },
      { key: 'recovery',  label: 'Recovery',  unit: 's',  min: 0.75, max: 2.5,  step: 0.05, fmt: v => v.toFixed(2) },
    ];
    PARAM_DEFS.forEach((def) => {
      const rowY = cur.slot(P_ROW_H, P_ROW_GAP);
      const cy   = rowY + P_ROW_H / 2;

      const lbl    = this.add.text(P_LBL_X, cy, def.label, { fontSize: '10px', fontFamily: 'monospace', color: '#99AACC' }).setOrigin(0, 0.5);
      const decBg  = this.add.rectangle(P_DEC_CX, cy, P_BTN_W, P_ROW_H - 2, 0x1a0e08).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x442211);
      const decTxt = this.add.text(P_DEC_CX, cy, '-', { fontSize: '16px', fontFamily: 'monospace', color: '#CC7744' }).setOrigin(0.5);
      const valBg  = this.add.rectangle(P_VAL_CX, cy, P_VAL_W, P_ROW_H - 2, 0x0d1018).setStrokeStyle(1, 0x223344);
      const valTxt = this.add.text(P_VAL_CX, cy, def.fmt(this._params[def.key]), { fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF' }).setOrigin(0.5);
      const unitTxt = this.add.text(P_VAL_CX + P_VAL_W / 2 + 4, cy, def.unit, { fontSize: '9px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0, 0.5);
      const incBg  = this.add.rectangle(P_INC_CX, cy, P_BTN_W, P_ROW_H - 2, 0x081a0e).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x114422);
      const incTxt = this.add.text(P_INC_CX, cy, '+', { fontSize: '16px', fontFamily: 'monospace', color: '#44CC66' }).setOrigin(0.5);

      decBg.on('pointerdown', () => this._changeParam(def, -1));
      incBg.on('pointerdown', () => this._changeParam(def, +1));
      decBg.on('pointerover', () => decBg.setFillStyle(0x251208));
      decBg.on('pointerout',  () => decBg.setFillStyle(0x1a0e08));
      incBg.on('pointerover', () => incBg.setFillStyle(0x0c2510));
      incBg.on('pointerout',  () => incBg.setFillStyle(0x081a0e));

      this._paramContainer.add([lbl, decBg, decTxt, valBg, valTxt, unitTxt, incBg, incTxt]);
      this._paramRefs[def.key] = { valTxt, def };

      layoutItems.push({ name: `param-lbl-${def.key}`,  x: P_LBL_X,                  y: rowY, w: 82,      h: P_ROW_H });
      layoutItems.push({ name: `param-dec-${def.key}`,  x: P_DEC_CX - P_BTN_W / 2,   y: rowY, w: P_BTN_W, h: P_ROW_H });
      layoutItems.push({ name: `param-val-${def.key}`,  x: P_VAL_CX - P_VAL_W / 2,   y: rowY, w: P_VAL_W, h: P_ROW_H });
      layoutItems.push({ name: `param-inc-${def.key}`,  x: P_INC_CX - P_BTN_W / 2,   y: rowY, w: P_BTN_W, h: P_ROW_H });
    });
    cur.slot(4, 0);
    this._paramContainer.setVisible(this._showAdvanced);
    g.add(this._paramContainer);

    // SEED section
    const seedLblY = cur.slot(16, 2);
    g.add(this.add.text(CTRL_X, seedLblY, 'SEED', { fontSize: '11px', fontFamily: 'monospace', color: '#445566' }));
    layoutItems.push({ name: 'seed-lbl', x: CTRL_X, y: seedLblY, w: 40, h: 16 });

    const seedRowY = cur.slot(28, 4);
    const seedCY   = seedRowY + 14;
    this._seedText = this.add.text(CTRL_X, seedCY, `${this._seed}`, { fontSize: '16px', fontFamily: 'monospace', color: '#FFDD88' }).setOrigin(0, 0.5);
    const rerollBg = this.add.rectangle(CTRL_X + 150, seedCY, 90, 26, 0x0e1a24).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x2a4422);
    const rerollTxt = this.add.text(CTRL_X + 150, seedCY, 'REROLL', { fontSize: '11px', fontFamily: 'monospace', color: '#66DD88' }).setOrigin(0.5);
    rerollBg.on('pointerdown', () => this._reroll());
    rerollBg.on('pointerover', () => rerollBg.setFillStyle(0x14221a));
    rerollBg.on('pointerout',  () => rerollBg.setFillStyle(0x0e1a24));
    g.add([this._seedText, rerollBg, rerollTxt]);
    layoutItems.push({ name: 'seed-val',    x: CTRL_X,         y: seedRowY, w: 110, h: 28 });
    layoutItems.push({ name: 'seed-reroll', x: CTRL_X + 105,   y: seedRowY, w: 90,  h: 28 });

    const seedInputRowY = cur.slot(20, 6);
    const seedInputHint = this.add.text(CTRL_X, seedInputRowY, '[ click to type seed ]', { fontSize: '9px', fontFamily: 'monospace', color: '#223344' });
    this._seedInputBg = this.add.rectangle(CTRL_X + 110, seedInputRowY + 10, 100, 18, 0x0a1020).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x223344);
    this._seedInput = this.add.text(CTRL_X + 60, seedInputRowY, '', { fontSize: '9px', fontFamily: 'monospace', color: '#556677' });
    this._seedInputBg.on('pointerdown', () => {
      this._seedInputActive = true;
      this._seedInputVal = `${this._seed}`;
      this._seedInput.setText(`> ${this._seedInputVal}_`);
      this._seedInputBg.setStrokeStyle(1, 0x44AAFF);
    });
    g.add([seedInputHint, this._seedInputBg, this._seedInput]);

    // Warn + stats
    const warnY = cur.slot(16, 2);
    this._warnText = this.add.text(CTRL_X, warnY, '', { fontSize: '9px', fontFamily: 'monospace', color: '#FF8844', wordWrap: { width: CTRL_W - 8 } });
    g.add(this._warnText);

    const statsY = cur.slot(32, 4);
    this._genStatsText = this.add.text(CTRL_X, statsY, '', { fontSize: '10px', fontFamily: 'monospace', color: '#667788' });
    g.add(this._genStatsText);

    _assertLayoutItems(layoutItems);
  }

  // ─── Editor panel ────────────────────────────────────────────────────────────
  _buildEditorPanel() {
    this._edPanel.removeAll(true);
    const g = this._edPanel;
    const cur = new RowCursor(BODY_Y + PAD);
    const layoutItems = [];

    // TOOL label
    const toolLblY = cur.slot(16, 4);
    g.add(this.add.text(CTRL_X, toolLblY, 'TOOL', { fontSize: '11px', fontFamily: 'monospace', color: '#445566' }));

    // Palette — 2 rows of 3
    const palBtnW = 96, palBtnH = 26, palGap = 6;
    this._paletteBtns = [];
    const palStartY = cur.slot(2 * palBtnH + palGap, 8);
    PALETTE.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const rowY = palStartY + row * (palBtnH + palGap);
      const bx   = CTRL_X + col * (palBtnW + palGap);
      const cy   = rowY + palBtnH / 2;
      const bg   = this.add.rectangle(bx + palBtnW / 2, cy, palBtnW, palBtnH, 0x0e1a24)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x333333);
      const lbl  = this.add.text(bx + palBtnW / 2, cy, item.label, { fontSize: '11px', fontFamily: 'monospace', color: item.textColor }).setOrigin(0.5);
      bg.on('pointerdown', () => { this._edPalette = item.key; this._refreshPaletteButtons(); });
      bg.on('pointerover', () => { if (this._edPalette !== item.key) bg.setFillStyle(0x14222e); });
      bg.on('pointerout',  () => { if (this._edPalette !== item.key) bg.setFillStyle(0x0e1a24); });
      this._paletteBtns.push({ bg, lbl, item });
      g.add([bg, lbl]);
      layoutItems.push({ name: `palette-${item.label}`, x: bx, y: rowY, w: palBtnW, h: palBtnH });
    });

    // SPACING row
    const spacRowY = cur.slot(P_ROW_H, 6);
    const spacCY   = spacRowY + P_ROW_H / 2;
    g.add(this.add.text(P_LBL_X, spacCY, 'Spacing', { fontSize: '10px', fontFamily: 'monospace', color: '#99AACC' }).setOrigin(0, 0.5));
    const spacDecBg  = this.add.rectangle(P_DEC_CX, spacCY, P_BTN_W, P_ROW_H - 2, 0x1a0e08).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x442211);
    const spacDecTxt = this.add.text(P_DEC_CX, spacCY, '-', { fontSize: '16px', fontFamily: 'monospace', color: '#CC7744' }).setOrigin(0.5);
    const spacValBg  = this.add.rectangle(P_VAL_CX, spacCY, P_VAL_W, P_ROW_H - 2, 0x0d1018).setStrokeStyle(1, 0x223344);
    this._edSpacingText = this.add.text(P_VAL_CX, spacCY, `${this._edSpacing}`, { fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF' }).setOrigin(0.5);
    const spacUnitTxt = this.add.text(P_VAL_CX + P_VAL_W / 2 + 4, spacCY, 'u', { fontSize: '9px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0, 0.5);
    const spacIncBg  = this.add.rectangle(P_INC_CX, spacCY, P_BTN_W, P_ROW_H - 2, 0x081a0e).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x114422);
    const spacIncTxt = this.add.text(P_INC_CX, spacCY, '+', { fontSize: '16px', fontFamily: 'monospace', color: '#44CC66' }).setOrigin(0.5);
    spacDecBg.on('pointerdown', () => { this._edSpacing = Math.max(240, this._edSpacing - 40); this._edSpacingText.setText(`${this._edSpacing}`); });
    spacIncBg.on('pointerdown', () => { this._edSpacing = Math.min(2000, this._edSpacing + 40); this._edSpacingText.setText(`${this._edSpacing}`); });
    spacDecBg.on('pointerover', () => spacDecBg.setFillStyle(0x251208)); spacDecBg.on('pointerout', () => spacDecBg.setFillStyle(0x1a0e08));
    spacIncBg.on('pointerover', () => spacIncBg.setFillStyle(0x0c2510)); spacIncBg.on('pointerout', () => spacIncBg.setFillStyle(0x081a0e));
    g.add([spacDecBg, spacDecTxt, spacValBg, this._edSpacingText, spacUnitTxt, spacIncBg, spacIncTxt]);
    layoutItems.push({ name: 'spacing-lbl', x: P_LBL_X,              y: spacRowY, w: 82,      h: P_ROW_H });
    layoutItems.push({ name: 'spacing-dec', x: P_DEC_CX - P_BTN_W/2, y: spacRowY, w: P_BTN_W, h: P_ROW_H });
    layoutItems.push({ name: 'spacing-val', x: P_VAL_CX - P_VAL_W/2, y: spacRowY, w: P_VAL_W, h: P_ROW_H });
    layoutItems.push({ name: 'spacing-inc', x: P_INC_CX - P_BTN_W/2, y: spacRowY, w: P_BTN_W, h: P_ROW_H });

    // ADD BAND button
    const addBandY = cur.slot(30, 6);
    const addBandBg = this.add.rectangle(CTRL_X + 130, addBandY + 15, 260, 28, 0x0e1a10)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x224422);
    const addBandTxt = this.add.text(CTRL_X + 130, addBandY + 15, '+ ADD BAND', { fontSize: '13px', fontFamily: 'monospace', color: '#44AA66' }).setOrigin(0.5);
    addBandBg.on('pointerdown', () => this._addBand());
    addBandBg.on('pointerover', () => addBandBg.setFillStyle(0x14221a));
    addBandBg.on('pointerout',  () => addBandBg.setFillStyle(0x0e1a10));
    g.add([addBandBg, addBandTxt]);
    layoutItems.push({ name: 'add-band', x: CTRL_X, y: addBandY, w: 260, h: 30 });

    // Thin divider
    const div1G = this.add.graphics(); div1G.lineStyle(1, 0x223344, 0.5);
    const div1Y = cur.slot(1, 6); div1G.lineBetween(CTRL_X, div1Y, CTRL_X + CTRL_W - 8, div1Y);
    g.add(div1G);

    // VIOLATIONS header
    const violHdrY = cur.slot(18, 2);
    this._edViolHeader = this.add.text(CTRL_X, violHdrY, 'VIOLATIONS: 0', { fontSize: '11px', fontFamily: 'monospace', color: '#446644' });
    g.add(this._edViolHeader);

    // Violation text lines — up to 6
    this._edViolTexts = [];
    for (let i = 0; i < 6; i++) {
      const vY = cur.slot(14, 2);
      const vt = this.add.text(CTRL_X, vY, '', { fontSize: '9px', fontFamily: 'monospace', color: '#FF7755', wordWrap: { width: CTRL_W - 8 } }).setVisible(false);
      this._edViolTexts.push(vt);
      g.add(vt);
    }
    this._edViolMore = this.add.text(CTRL_X, cur.slot(14, 4), '', { fontSize: '9px', fontFamily: 'monospace', color: '#AA5533' }).setVisible(false);
    g.add(this._edViolMore);

    // Divider
    const div2G = this.add.graphics(); div2G.lineStyle(1, 0x223344, 0.5);
    const div2Y = cur.slot(1, 6); div2G.lineBetween(CTRL_X, div2Y, CTRL_X + CTRL_W - 8, div2Y);
    g.add(div2G);

    // Stats text
    const statsY = cur.slot(34, 6);
    this._edStatsText = this.add.text(CTRL_X, statsY, '', { fontSize: '10px', fontFamily: 'monospace', color: '#667788' });
    g.add(this._edStatsText);

    // Divider
    const div3G = this.add.graphics(); div3G.lineStyle(1, 0x223344, 0.5);
    const div3Y = cur.slot(1, 6); div3G.lineBetween(CTRL_X, div3Y, CTRL_X + CTRL_W - 8, div3Y);
    g.add(div3G);

    // NAME row
    const nameLblY = cur.slot(20, 4);
    g.add(this.add.text(CTRL_X, nameLblY + 10, 'NAME:', { fontSize: '10px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0, 0.5));
    this._edNameDisplay = this.add.text(CTRL_X + 54, nameLblY + 10, '(unnamed)', { fontSize: '10px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0, 0.5);
    const nameBg = this.add.rectangle(CTRL_X + 180, nameLblY + 10, 250, 18, 0x0a1020).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x223344);
    nameBg.on('pointerdown', () => this._activateNameInput());
    g.add([nameBg, this._edNameDisplay]);

    // SAVE AS button
    const saveY = cur.slot(30, 6);
    const saveBg = this.add.rectangle(CTRL_X + 130, saveY + 15, 260, 28, 0x0e1a10).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x224422);
    this._edSaveText = this.add.text(CTRL_X + 130, saveY + 15, 'SAVE AS...', { fontSize: '13px', fontFamily: 'monospace', color: '#55EE88' }).setOrigin(0.5);
    saveBg.on('pointerdown', () => this._saveCurrentTrack());
    saveBg.on('pointerover', () => saveBg.setFillStyle(0x14221a));
    saveBg.on('pointerout',  () => saveBg.setFillStyle(0x0e1a10));
    g.add([saveBg, this._edSaveText]);

    // Divider
    const div4G = this.add.graphics(); div4G.lineStyle(1, 0x223344, 0.5);
    const div4Y = cur.slot(1, 6); div4G.lineBetween(CTRL_X, div4Y, CTRL_X + CTRL_W - 8, div4Y);
    g.add(div4G);

    // YOUR TRACKS header + list
    const tracksHdrY = cur.slot(18, 4);
    g.add(this.add.text(CTRL_X, tracksHdrY, 'YOUR TRACKS', { fontSize: '11px', fontFamily: 'monospace', color: '#445566' }));

    this._savedListContainer = this.add.container(CTRL_X, cur.y);
    g.add(this._savedListContainer);

    _assertLayoutItems(layoutItems);
  }

  // ─── Mode switching ──────────────────────────────────────────────────────────
  _switchMode(mode) {
    this._configMode = mode;
    this._genPanel.setVisible(mode === 'genera');
    this._edPanel.setVisible(mode === 'costruisci');
    const genActive = mode === 'genera';
    this._modeGenBg.setFillStyle(genActive ? 0x162840 : 0x0e1a24);
    this._modeGenBg.setStrokeStyle(1, genActive ? 0x3366AA : 0x1c3044);
    this._modeGenLabel.setColor(genActive ? '#88BBEE' : '#445566');
    this._modeConBg.setFillStyle(!genActive ? 0x1a2810 : 0x0e1a24);
    this._modeConBg.setStrokeStyle(1, !genActive ? 0x44AA33 : 0x1c3044);
    this._modeConLabel.setColor(!genActive ? '#88EE66' : '#445566');
    if (mode === 'genera') {
      this._edLabelContainer.setVisible(false);
      this._regenerate();
    } else {
      this._edLabelContainer.setVisible(true);
      this._edSavedTracks = getAllTracks();
      this._refreshSavedList();
      this._revalidate();
      this._renderEditorMap();
      this._refreshEdStats();
      this._refreshPaletteButtons();
      this._updateStartButton();
    }
  }

  // ─── Genera helpers ──────────────────────────────────────────────────────────
  _selectPreset(idx) {
    this._presetIdx = idx;
    this._params = { ...PRESETS[this._presetNames[idx]] };
    this._refreshParamDisplays();
    this._refreshPresetButtons();
    this._regenerate();
  }

  _refreshPresetButtons() {
    this._presetBtns.forEach(({ bg, label }, i) => {
      const active = i === this._presetIdx;
      bg.setFillStyle(active ? 0x162840 : 0x0e1a24);
      bg.setStrokeStyle(1, active ? 0x3366AA : 0x1c3044);
      label.setColor(active ? '#88BBEE' : '#AADDFF');
    });
  }

  _refreshParamDisplays() {
    for (const key of Object.keys(this._paramRefs)) {
      const { valTxt, def } = this._paramRefs[key];
      valTxt.setText(def.fmt(this._params[key]));
    }
  }

  _changeParam(def, dir) {
    let v = this._params[def.key] + dir * def.step;
    v = Math.max(def.min, Math.min(def.max, parseFloat(v.toFixed(10))));
    this._params[def.key] = v;
    this._paramRefs[def.key].valTxt.setText(def.fmt(v));
    this._regenerate();
  }

  _reroll() {
    this._seed = (Math.floor(Math.random() * 0x1000000)) & 0xFFFFFF;
    this._seedText.setText(`${this._seed}`);
    this._regenerate();
  }

  _regenerate() {
    this._mapG.clear();
    this._mapContainer.removeAll(true);
    this._edLabelContainer.removeAll(true);

    const { rhythm, recovery } = this._params;
    const slowRecoveryDist = (recovery * 300) * 0.30;
    const bandSpacingDist  = rhythm * 300;
    if (slowRecoveryDist > bandSpacingDist) {
      this._warnText.setText(`Warning: Recovery (${recovery.toFixed(2)}s) exceeds band spacing.`);
      this._genError = 'recovery_too_long';
      this._genStatsText.setText('Cannot generate: invalid params');
      this._startText.setColor('#553333');
      this._startBg.setStrokeStyle(2, 0x331111);
      return;
    }
    this._warnText.setText('');
    this._genError = null;

    try {
      this._trackData = generateTrack(this._params, this._seed);
    } catch (e) {
      this._genError = e.message;
      this._warnText.setText(`Warning: ${e.message}`);
      this._genStatsText.setText('Cannot generate');
      this._startText.setColor('#553333');
      this._startBg.setStrokeStyle(2, 0x331111);
      return;
    }

    const td = this._trackData;
    this._genStatsText.setText(
      `Length: ${td.length}u  Bands: ${_countBands(td.obstacles)}  Gates: ${_countGates(td.obstacles)}  Damage: ${_countDamageBands(td.obstacles)}\n` +
      `Est. speed: ${td.estimatedAvgSpeed}u/s  debuffTicks: ${td.debuffTicks}`
    );
    this._startText.setColor('#55EE88');
    this._startBg.setStrokeStyle(2, 0x44AA66);
    this._drawGeneraMap(td);
  }

  _drawGeneraMap(td) {
    const g = this._mapG;
    const sc = MAP_H / td.length;
    for (let i = 0; i < 3; i++) {
      g.fillStyle(LANE_COLORS[i], 0.28);
      g.fillRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
      g.lineStyle(1, 0xFFFFFF, 0.09);
      g.strokeRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
    }
    const step = Math.max(1000, Math.round(td.length / 8 / 1000) * 1000);
    for (let d = 0; d <= td.length; d += step) {
      const ty = MAP_TOP + d * sc;
      g.lineStyle(1, 0x445566, 1);
      g.lineBetween(COL_X0 - 8, ty, COL_X0 - 2, ty);
      this._mapContainer.add(this.add.text(COL_X0 - 10, ty, `${d}`, { fontSize: '9px', fontFamily: 'monospace', color: '#445566' }).setOrigin(1, 0.5));
    }
    const BW = COL_W - 12, BH = 10;
    const MC = { rock: 0x2A2E34, ice: 0xB8D8E8, water: 0x3AA8C4 };
    const TL = { rock: '#', ice: '~', water: '~' };
    const LC = { rock: '#F2C230', ice: '#C8F0FF', water: '#AAEEFF' };
    const gateDists = _getGateDists(td.obstacles);
    for (const obs of td.obstacles) {
      const ty = MAP_TOP + obs.distance * sc;
      const lx = colLeft(obs.lane) + 6;
      g.fillStyle(MC[obs.type] ?? OBS_COLORS[obs.type]);
      g.fillRect(lx, ty - BH / 2, BW, BH);
      if (obs.type === 'rock') { g.fillStyle(0xF2C230, 0.7); g.fillRect(lx, ty - 1, BW, 2); }
      this._mapContainer.add(this.add.text(lx + BW / 2, ty, TL[obs.type] || '', { fontSize: '7px', fontFamily: 'monospace', color: LC[obs.type] || '#FFFFFF' }).setOrigin(0.5));
    }
    for (const [dist, openLane] of gateDists) {
      const ty = MAP_TOP + dist * sc;
      g.lineStyle(2, 0xF2C230, 0.9);
      g.lineBetween(COL_X0, ty - 6, COL_X0, ty + 6);
      const re = COL_X0 + 3 * (COL_W + COL_GAP) - COL_GAP;
      g.lineBetween(re, ty - 6, re, ty + 6);
      this._mapContainer.add(this.add.text(re + 4, ty, `G${openLane}`, { fontSize: '7px', fontFamily: 'monospace', color: '#F2C230' }).setOrigin(0, 0.5));
    }
    for (const pu of td.pickups) {
      const ty = MAP_TOP + pu.distance * sc;
      const lx = colLeft(pu.lane) + COL_W / 2;
      g.fillStyle(pu.type === 'caltrop_pickup' ? 0x9B6BDA : 0x7ED957, 0.9);
      g.fillTriangle(lx, ty - 5, lx - 4, ty + 3, lx + 4, ty + 3);
    }
    const LBLS = ['L', 'C', 'R'];
    for (let i = 0; i < 3; i++) {
      this._mapContainer.add(this.add.text(colCenter(i), MAP_TOP - 12, LBLS[i], { fontSize: '10px', fontFamily: 'monospace', color: '#8899AA' }).setOrigin(0.5, 1));
    }
  }

  // ─── Editor helpers ──────────────────────────────────────────────────────────
  _setupEditorInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this._configMode !== 'costruisci') return;
      if (pointer.y < BODY_Y || pointer.y > BODY_BOT) return;
      const relY = pointer.y - MAP_TOP + this._edScrollY;
      const bandIdx = Math.floor(relY / ED_ROW_H);
      if (bandIdx < 0 || bandIdx >= this._edBands.length) return;
      if (pointer.x >= ED_DEL_X0 && pointer.x < COL_X0) { this._deleteBand(bandIdx); return; }
      const lane = this._getLaneAtX(pointer.x);
      if (lane >= 0) this._stampCell(bandIdx, lane);
    });
    this.input.on('wheel', (_p, _o, _dx, deltaY) => {
      if (this._configMode !== 'costruisci') return;
      this._edScrollY += deltaY * 0.4;
      this._clampScroll();
      this._renderEditorMap();
    });
  }

  _getLaneAtX(x) {
    for (let i = 0; i < 3; i++) if (x >= colLeft(i) && x < colLeft(i) + COL_W) return i;
    return -1;
  }

  _stampCell(bandIdx, lane) {
    this._edBands[bandIdx].cells[lane] = this._edPalette;
    this._revalidate();
    this._renderEditorMap();
    this._refreshEdStats();
    this._updateStartButton();
  }

  _deleteBand(bandIdx) {
    this._edBands.splice(bandIdx, 1);
    this._clampScroll();
    this._revalidate();
    this._renderEditorMap();
    this._refreshEdStats();
    this._updateStartButton();
  }

  _addBand() {
    const lastZ = this._edBands.length > 0 ? this._edBands[this._edBands.length - 1].z : 0;
    this._edBands.push({ z: lastZ + this._edSpacing, cells: [null, null, null] });
    const maxScroll = Math.max(0, this._edBands.length * ED_ROW_H - BODY_H);
    this._edScrollY = maxScroll;
    this._revalidate();
    this._renderEditorMap();
    this._refreshEdStats();
    this._updateStartButton();
  }

  _clampScroll() {
    const max = Math.max(0, this._edBands.length * ED_ROW_H - BODY_H);
    this._edScrollY = Math.max(0, Math.min(this._edScrollY, max));
  }

  _buildTrackData() {
    const obstacles = [], pickups = [];
    for (const band of this._edBands) {
      for (let lane = 0; lane < 3; lane++) {
        const type = band.cells[lane];
        if (!type) continue;
        if (type === 'caltrop_pickup' || type === 'snipe_pickup') pickups.push({ lane, distance: band.z, type });
        else obstacles.push({ lane, distance: band.z, type });
      }
    }
    const trackLength = this._edBands.length > 0 ? this._edBands[this._edBands.length - 1].z + 300 : 600;
    const { estimatedAvgSpeed, estimatedDuration } = computeEstimate(obstacles, trackLength);
    return {
      id: this._edTrackId,
      name: this._edNameInput.trim() || 'Unnamed Track',
      length: trackLength,
      obstacles,
      pickups,
      debuffTicks: 75,
      isGenerated: false,
      estimatedAvgSpeed,
      estimatedDuration,
    };
  }

  _revalidate() {
    if (this._configMode !== 'costruisci') return;
    const td = this._buildTrackData();
    this._edViolations = validateBandList(td.obstacles, td.pickups, td.length);
    this._refreshViolations();
  }

  _refreshViolations() {
    const count = this._edViolations.length;
    this._edViolHeader.setText(`VIOLATIONS: ${count}`);
    this._edViolHeader.setColor(count > 0 ? '#FF5533' : '#446644');
    const display = this._edViolations.slice(0, 6);
    for (let i = 0; i < 6; i++) {
      if (i < display.length) { this._edViolTexts[i].setText(`- ${display[i].message}`); this._edViolTexts[i].setVisible(true); }
      else this._edViolTexts[i].setVisible(false);
    }
    const extra = count - 6;
    this._edViolMore.setText(extra > 0 ? `  ...and ${extra} more` : '');
    this._edViolMore.setVisible(extra > 0);
  }

  _refreshEdStats() {
    if (!this._edStatsText) return;
    const td = this._buildTrackData();
    const gates = this._edBands.filter(b => b.cells.filter(c => c === 'rock').length === 2).length;
    this._edStatsText.setText(
      `Length: ${td.length}u  Bands: ${this._edBands.length}  Gates: ${gates}\n` +
      `Est: ${td.estimatedDuration}s  debuffTicks: ${td.debuffTicks}`
    );
  }

  _saveCurrentTrack() {
    if (this._edViolations.length > 0) {
      this._edViolHeader.setColor('#FF0000');
      this.time.delayedCall(500, () => this._edViolHeader.setColor('#FF5533'));
      return;
    }
    if (!this._edNameInput.trim()) { this._activateNameInput(); return; }
    const td = this._buildTrackData();
    saveTrack(td);
    this._edSavedTracks = getAllTracks();
    this._refreshSavedList();
    this._edSaveText.setText('SAVED!');
    this._edSaveText.setColor('#88FFAA');
    this.time.delayedCall(1400, () => { this._edSaveText.setText('SAVE AS...'); this._edSaveText.setColor('#55EE88'); });
  }

  _activateNameInput() {
    this._edNameActive = true;
    this._edNameDisplay.setText(`> ${this._edNameInput}_`);
    this._edNameDisplay.setColor('#FFDD88');
  }

  _loadIntoEditor(trackData) {
    this._edBands = [];
    const byDist = new Map();
    for (const obs of trackData.obstacles) {
      if (!byDist.has(obs.distance)) byDist.set(obs.distance, [null, null, null]);
      byDist.get(obs.distance)[obs.lane] = obs.type;
    }
    for (const pu of (trackData.pickups || [])) {
      if (!byDist.has(pu.distance)) byDist.set(pu.distance, [null, null, null]);
      byDist.get(pu.distance)[pu.lane] = pu.type;
    }
    for (const [z, cells] of [...byDist.entries()].sort((a, b) => a[0] - b[0])) {
      this._edBands.push({ z, cells });
    }
    this._edNameInput  = trackData.name || '';
    this._edTrackId    = trackData.id;
    this._edScrollY    = 0;
    this._edNameActive = false;
    this._refreshNameDisplay();
    this._revalidate();
    this._renderEditorMap();
    this._refreshEdStats();
    this._updateStartButton();
  }

  _refreshNameDisplay() {
    if (!this._edNameDisplay) return;
    this._edNameDisplay.setText(this._edNameInput || '(unnamed)');
    this._edNameDisplay.setColor(this._edNameInput ? '#FFDD88' : '#445566');
  }

  _refreshSavedList() {
    if (!this._savedListContainer) return;
    this._savedListContainer.removeAll(true);
    const tracks = this._edSavedTracks;
    if (tracks.length === 0) {
      this._savedListContainer.add(this.add.text(0, 0, '(no saved tracks)', { fontSize: '10px', fontFamily: 'monospace', color: '#334455' }));
      return;
    }
    tracks.slice(0, 8).forEach((track, i) => {
      const rowY = i * 24;
      const nameTxt = this.add.text(0, rowY + 4, track.name, { fontSize: '10px', fontFamily: 'monospace', color: '#AADDFF' });
      const loadBg = this.add.rectangle(CTRL_W - 90, rowY + 10, 54, 18, 0x0e1a24).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x1c3044);
      const loadTxt = this.add.text(CTRL_W - 90, rowY + 10, 'LOAD', { fontSize: '9px', fontFamily: 'monospace', color: '#66AADD' }).setOrigin(0.5);
      loadBg.on('pointerdown', () => this._loadIntoEditor(track));
      loadBg.on('pointerover', () => loadBg.setFillStyle(0x14222e));
      loadBg.on('pointerout',  () => loadBg.setFillStyle(0x0e1a24));
      const delBg = this.add.rectangle(CTRL_W - 28, rowY + 10, 38, 18, 0x1a0e0e).setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x3a1a1a);
      const delTxt = this.add.text(CTRL_W - 28, rowY + 10, 'DEL', { fontSize: '9px', fontFamily: 'monospace', color: '#AA4444' }).setOrigin(0.5);
      delBg.on('pointerdown', () => { deleteTrack(track.id); this._edSavedTracks = getAllTracks(); this._refreshSavedList(); });
      delBg.on('pointerover', () => delBg.setFillStyle(0x250c0c));
      delBg.on('pointerout',  () => delBg.setFillStyle(0x1a0e0e));
      this._savedListContainer.add([nameTxt, loadBg, loadTxt, delBg, delTxt]);
    });
  }

  _refreshPaletteButtons() {
    if (!this._paletteBtns) return;
    this._paletteBtns.forEach(({ bg, item }) => {
      const isActive = item.key === this._edPalette;
      bg.setFillStyle(isActive ? _tintColor(item.color, 0.3) : 0x0e1a24);
      bg.setStrokeStyle(1, isActive ? item.color : 0x333333);
    });
  }

  _renderEditorMap() {
    const g = this._mapG;
    g.clear();
    this._mapContainer.removeAll(true);
    this._edLabelContainer.removeAll(true);

    for (let i = 0; i < 3; i++) {
      g.fillStyle(LANE_COLORS[i], 0.18);
      g.fillRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
      g.lineStyle(1, 0xFFFFFF, 0.07);
      g.strokeRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
    }
    g.fillStyle(0x111120, 1);
    g.fillRect(ED_DEL_X0, MAP_TOP, ED_DEL_X1 - ED_DEL_X0, MAP_H);

    const violDists = new Set(this._edViolations.filter(v => v.bandDist != null).map(v => v.bandDist));

    for (let i = 0; i < this._edBands.length; i++) {
      const band = this._edBands[i];
      const sy = MAP_TOP + i * ED_ROW_H - this._edScrollY;
      if (sy + ED_ROW_H < BODY_Y || sy > BODY_BOT) continue;

      g.lineStyle(1, 0x222233, 0.8);
      g.lineBetween(ED_DEL_X0, sy, colLeft(2) + COL_W, sy);

      g.fillStyle(0x2a1a1a, 1);
      g.fillRect(ED_DEL_X0 + 1, sy + 3, ED_DEL_X1 - ED_DEL_X0 - 2, ED_CELL_H);

      for (let lane = 0; lane < 3; lane++) {
        const type = band.cells[lane];
        const cx = colLeft(lane) + 2, cy = sy + 3, cw = COL_W - 4, ch = ED_CELL_H;
        if (type) { g.fillStyle(_typeColor(type), type === 'rock' ? 0.9 : 0.75); g.fillRect(cx, cy, cw, ch); }
        else { g.fillStyle(0x0d0d1a, 0.4); g.fillRect(cx, cy, cw, ch); }
      }

      if (violDists.has(band.z)) {
        g.lineStyle(2, 0xFF3333, 0.9);
        g.strokeRect(colLeft(0) + 1, sy + 2, colLeft(2) + COL_W - 2 - colLeft(0), ED_CELL_H + 2);
      }

      if (band.cells.filter(c => c === 'rock').length === 2) {
        g.lineStyle(1, 0xF2C230, 0.8);
        g.lineBetween(COL_X0, sy + 3, COL_X0, sy + 3 + ED_CELL_H);
        g.lineBetween(colLeft(2) + COL_W, sy + 3, colLeft(2) + COL_W, sy + 3 + ED_CELL_H);
      }

      this._edLabelContainer.add(this.add.text(ED_DEL_X0 + 1, sy + 4, `${band.z}`, { fontSize: '7px', fontFamily: 'monospace', color: '#556677' }));
      this._edLabelContainer.add(this.add.text(ED_DEL_X0 + (ED_DEL_X1 - ED_DEL_X0) / 2, sy + 3 + ED_CELL_H / 2, 'x', { fontSize: '8px', fontFamily: 'monospace', color: '#553333' }).setOrigin(0.5));
      for (let lane = 0; lane < 3; lane++) {
        const type = band.cells[lane];
        if (!type) continue;
        const info = PALETTE.find(p => p.key === type);
        this._edLabelContainer.add(this.add.text(colCenter(lane), sy + 3 + ED_CELL_H / 2, info ? info.label : type, { fontSize: '8px', fontFamily: 'monospace', color: info ? info.textColor : '#FFFFFF' }).setOrigin(0.5));
      }
    }

    const addY = MAP_TOP + this._edBands.length * ED_ROW_H - this._edScrollY;
    if (addY >= MAP_TOP && addY <= MAP_BOTTOM) {
      g.lineStyle(1, 0x224422, 0.8);
      g.lineBetween(COL_X0, addY, colLeft(2) + COL_W, addY);
    }

    const LBLS = ['L', 'C', 'R'];
    for (let i = 0; i < 3; i++) {
      this._edLabelContainer.add(this.add.text(colCenter(i), BODY_Y - 12, LBLS[i], { fontSize: '10px', fontFamily: 'monospace', color: '#8899AA' }).setOrigin(0.5, 1));
    }
  }

  _updateStartButton() {
    if (this._configMode === 'genera') {
      const ok = !this._genError && this._trackData;
      this._startText.setColor(ok ? '#55EE88' : '#553333');
      this._startBg.setStrokeStyle(2, ok ? 0x44AA66 : 0x331111);
    } else {
      const ok = this._edViolations.length === 0 && this._edBands.length > 0;
      this._startText.setColor(ok ? '#55EE88' : '#553333');
      this._startBg.setStrokeStyle(2, ok ? 0x44AA66 : 0x331111);
    }
  }

  _startPlanning() {
    if (this._configMode === 'genera') {
      if (this._genError || !this._trackData) return;
      if (this.mode === '1p') this.scene.start('PlanScene', { trackData: this._trackData, mode: this.mode });
      else this.scene.start('JoinScene', { trackData: this._trackData, mode: this.mode });
    } else {
      if (this._edViolations.length > 0 || this._edBands.length === 0) { this._refreshViolations(); return; }
      const td = this._buildTrackData();
      if (this.mode === '1p') this.scene.start('PlanScene', { trackData: td, mode: this.mode });
      else this.scene.start('JoinScene', { trackData: td, mode: this.mode });
    }
  }

  _setupKeyboard() {
    this.input.keyboard.on('keydown', (e) => {
      if (this._edNameActive) {
        if (e.key === 'Enter' || e.key === 'Escape') { this._edNameActive = false; this._refreshNameDisplay(); return; }
        if (e.key === 'Backspace') this._edNameInput = this._edNameInput.slice(0, -1);
        else if (e.key.length === 1 && this._edNameInput.length < 40) this._edNameInput += e.key;
        this._edNameDisplay.setText(`> ${this._edNameInput}_`);
        return;
      }
      if (this._seedInputActive) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          const n = parseInt(this._seedInputVal, 10);
          if (!isNaN(n) && n >= 0) { this._seed = n & 0xFFFFFFFF; this._seedText.setText(`${this._seed}`); }
          this._seedInputActive = false;
          this._seedInput.setText('');
          this._seedInputBg.setStrokeStyle(1, 0x223344);
          this._regenerate();
          return;
        }
        if (e.key === 'Backspace') this._seedInputVal = this._seedInputVal.slice(0, -1);
        else if (e.key.length === 1 && /[0-9]/.test(e.key) && this._seedInputVal.length < 8) this._seedInputVal += e.key;
        this._seedInput.setText(`> ${this._seedInputVal}_`);
        return;
      }
      if (e.code === 'Escape') this.scene.start('MenuScene', { mode: this.mode });
      else if (e.code === `Key${BINDINGS.p1.confirm}`) this._startPlanning();
      else if (e.code === 'KeyR' && this._configMode === 'genera') this._reroll();
    });
  }
}
