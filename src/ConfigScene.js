import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, LANE_COLORS, OBS_COLORS } from './track.js';
import { BINDINGS } from './controls.js';
import { generateTrack, PRESETS } from '../sim/trackGen.js';

// Map layout constants — mirror PlanScene's layout for consistent preview
const COL_W = 120, COL_GAP = 12, COL_X0 = 56;
function colLeft(lane)   { return COL_X0 + lane * (COL_W + COL_GAP); }
function colCenter(lane) { return colLeft(lane) + COL_W / 2; }

const MAP_TOP    = 90;
const MAP_BOTTOM = 640;
const MAP_H      = MAP_BOTTOM - MAP_TOP;

export class ConfigScene extends Phaser.Scene {
  constructor() { super({ key: 'ConfigScene' }); }

  init(data) {
    this.mode      = data?.mode || '1p';
    this._claims   = data?.claims || null;
  }

  create() {
    // --- State ---
    this._presetNames = Object.keys(PRESETS);
    this._presetIdx   = 0;
    this._params      = { ...PRESETS[this._presetNames[0]] };
    this._seed        = Date.now() & 0xFFFFFF;
    this._showAdvanced = false;
    this._trackData   = null;
    this._genError    = null;

    // Background
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    // Title
    this.add.text(CANVAS_W / 2, 18, 'TRACK CONFIGURATOR', {
      fontSize: '26px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5, 0);

    this.add.text(CANVAS_W / 2, 52, 'ESC = back  ·  F = start planning', {
      fontSize: '12px', fontFamily: 'monospace', color: '#334455'
    }).setOrigin(0.5, 0);

    // Divider between map (left) and controls (right)
    const divG = this.add.graphics();
    divG.lineStyle(1, 0x223344, 1);
    const divX = COL_X0 + 3 * (COL_W + COL_GAP) - COL_GAP + 40;
    divG.lineBetween(divX, 72, divX, CANVAS_H - 8);

    // --- Map area (left) ---
    this._mapG = this.add.graphics();
    this._mapContainer = this.add.container(0, 0);

    // --- Right panel controls ---
    const RX = divX + 20;
    const RW = CANVAS_W - RX - 16;

    // Preset label
    this.add.text(RX, 78, 'PRESET', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445566'
    });

    // Preset buttons (cycle left/right)
    this._presetBtns = [];
    const btnY = 100;
    this._presetNames.forEach((name, i) => {
      const bx = RX + i * 86;
      const bg = this.add.rectangle(bx + 38, btnY, 76, 26, 0x0e1a24)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x1c3044);
      const label = this.add.text(bx + 38, btnY, name, {
        fontSize: '12px', fontFamily: 'monospace', color: '#AADDFF'
      }).setOrigin(0.5);
      bg.on('pointerdown', () => this._selectPreset(i));
      bg.on('pointerover', () => { if (this._presetIdx !== i) bg.setFillStyle(0x14222e); });
      bg.on('pointerout',  () => { if (this._presetIdx !== i) bg.setFillStyle(0x0e1a24); });
      this._presetBtns.push({ bg, label });
    });

    // Seed area
    this.add.text(RX, 136, 'SEED', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445566'
    });

    this._seedText = this.add.text(RX, 154, `${this._seed}`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#FFDD88'
    });

    const rerollBg = this.add.rectangle(RX + 120, 158, 90, 26, 0x0e1a24)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x2a4422);
    this.add.text(RX + 120, 158, '↻ REROLL', {
      fontSize: '12px', fontFamily: 'monospace', color: '#66DD88'
    }).setOrigin(0.5);
    rerollBg.on('pointerdown', () => this._reroll());
    rerollBg.on('pointerover', () => rerollBg.setFillStyle(0x14221a));
    rerollBg.on('pointerout',  () => rerollBg.setFillStyle(0x0e1a24));

    // Seed input note
    this.add.text(RX, 176, '(click seed to type)', {
      fontSize: '9px', fontFamily: 'monospace', color: '#223344'
    });

    // Seed input field (interactive text)
    const seedInputBg = this.add.rectangle(RX + 40, 192, 85, 20, 0x0a1020)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x223344);
    this._seedInput = this.add.text(RX + 4, 184, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#556677'
    });
    this._seedInputVal = '';
    this._seedInputActive = false;
    seedInputBg.on('pointerdown', () => {
      this._seedInputActive = true;
      this._seedInputVal = `${this._seed}`;
      this._seedInput.setText(`> ${this._seedInputVal}_`);
      seedInputBg.setStrokeStyle(1, 0x44AAFF);
    });

    // Advanced toggle
    const advBg = this.add.rectangle(RX + 50, 214, 110, 22, 0x0e1020)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x334466);
    this._advLabel = this.add.text(RX + 50, 214, 'ADVANCED ▶', {
      fontSize: '11px', fontFamily: 'monospace', color: '#446688'
    }).setOrigin(0.5);
    advBg.on('pointerdown', () => {
      this._showAdvanced = !this._showAdvanced;
      this._advLabel.setText(this._showAdvanced ? 'ADVANCED ▼' : 'ADVANCED ▶');
      this._advContainer.setVisible(this._showAdvanced);
    });
    advBg.on('pointerover', () => advBg.setFillStyle(0x141428));
    advBg.on('pointerout',  () => advBg.setFillStyle(0x0e1020));

    // Advanced sliders container
    this._advContainer = this.add.container(0, 0);
    this._advContainer.setVisible(false);

    const PARAM_DEFS = [
      { key: 'rhythm',    label: 'Rhythm (s)',     min: 0.6,  max: 2.0,  step: 0.05, fmt: v => v.toFixed(2) },
      { key: 'runLength', label: 'Run Length (s)', min: 25,   max: 90,   step: 5,    fmt: v => `${v}` },
      { key: 'pressure',  label: 'Pressure (%)',   min: 40,   max: 100,  step: 5,    fmt: v => `${v}` },
      { key: 'gates',     label: 'Gates (%)',      min: 0,    max: 50,   step: 5,    fmt: v => `${v}` },
      { key: 'laneBias',  label: 'Lane Bias',      min: 0,    max: 100,  step: 5,    fmt: v => `${v}` },
      { key: 'recovery',  label: 'Recovery (s)',   min: 0.75, max: 2.5,  step: 0.05, fmt: v => v.toFixed(2) },
    ];

    this._paramRefs = {};
    PARAM_DEFS.forEach((def, i) => {
      const y = 232 + i * 36;
      const lbl = this.add.text(RX, y, def.label, {
        fontSize: '10px', fontFamily: 'monospace', color: '#667788'
      });
      const decBtn = this.add.text(RX + 118, y + 6, '[-]', {
        fontSize: '12px', fontFamily: 'monospace', color: '#AA6644'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const valTxt = this.add.text(RX + 152, y + 6, def.fmt(this._params[def.key]), {
        fontSize: '13px', fontFamily: 'monospace', color: '#FFFFFF'
      }).setOrigin(0.5);
      const incBtn = this.add.text(RX + 188, y + 6, '[+]', {
        fontSize: '12px', fontFamily: 'monospace', color: '#44AA66'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      decBtn.on('pointerdown', () => this._changeParam(def, -1));
      incBtn.on('pointerdown', () => this._changeParam(def, +1));

      this._advContainer.add([lbl, decBtn, valTxt, incBtn]);
      this._paramRefs[def.key] = { valTxt, def };
    });

    // Warning text
    this._warnText = this.add.text(RX, 452, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#FF8844',
      wordWrap: { width: RW - 8 }
    });

    // Stats area
    this._statsText = this.add.text(RX, 480, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#667788'
    });

    // Start Planning button
    const startBg = this.add.rectangle(RX + RW / 2, CANVAS_H - 48, RW - 16, 46, 0x0e2214)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x223322);
    const startText = this.add.text(RX + RW / 2, CANVAS_H - 48, 'START PLANNING →', {
      fontSize: '18px', fontFamily: 'monospace', color: '#2A5535'
    }).setOrigin(0.5);
    startBg.on('pointerover', () => { if (!this._genError) startBg.setFillStyle(0x163020); });
    startBg.on('pointerout',  () => startBg.setFillStyle(0x0e2214));
    startBg.on('pointerdown', () => this._startPlanning());
    this._startBg   = startBg;
    this._startText = startText;

    // Keyboard input for seed typing
    this.input.keyboard.on('keydown', (e) => {
      if (this._seedInputActive) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          const n = parseInt(this._seedInputVal, 10);
          if (!isNaN(n) && n >= 0) {
            this._seed = n & 0xFFFFFFFF;
            this._seedText.setText(`${this._seed}`);
          }
          this._seedInputActive = false;
          this._seedInput.setText('');
          seedInputBg.setStrokeStyle(1, 0x223344);
          this._regenerate();
          return;
        }
        if (e.key === 'Backspace') {
          this._seedInputVal = this._seedInputVal.slice(0, -1);
        } else if (e.key.length === 1 && /[0-9]/.test(e.key) && this._seedInputVal.length < 8) {
          this._seedInputVal += e.key;
        }
        this._seedInput.setText(`> ${this._seedInputVal}_`);
        return;
      }
      // Global shortcuts
      if (e.code === 'Escape') {
        this.scene.start('MenuScene', { mode: this.mode });
      } else if (e.code === `Key${BINDINGS.p1.confirm}`) {
        this._startPlanning();
      } else if (e.code === 'KeyR') {
        this._reroll();
      }
    });

    // Initial generation and render
    this._regenerate();
    this._refreshPresetButtons();
  }

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
    // Clear previous map objects
    this._mapG.clear();
    this._mapContainer.removeAll(true);

    // Validate recovery warning
    const { rhythm, recovery } = this._params;
    const SLOW_FACTOR = 0.30;
    const slowRecoveryDist = (recovery * 300) * SLOW_FACTOR;
    const bandSpacingDist  = rhythm * 300;
    if (slowRecoveryDist > bandSpacingDist) {
      this._warnText.setText(
        `⚠ Recovery (${recovery.toFixed(2)}s) exceeds band spacing — ` +
        `players may never recover from a debuff.`
      );
      this._genError = 'recovery_too_long';
      this._statsText.setText('Cannot generate: invalid params');
      this._startText.setColor('#553333');
      this._startBg.setStrokeStyle(2, 0x331111);
      return;
    } else {
      this._warnText.setText('');
      this._genError = null;
    }

    // Generate track
    try {
      this._trackData = generateTrack(this._params, this._seed);
      this._genError  = null;
    } catch (e) {
      this._genError = e.message;
      this._warnText.setText(`⚠ ${e.message}`);
      this._statsText.setText('Cannot generate');
      this._startText.setColor('#553333');
      this._startBg.setStrokeStyle(2, 0x331111);
      return;
    }

    // Update stats
    const td = this._trackData;
    const bandCount  = _countBands(td.obstacles);
    const gateCount  = _countGates(td.obstacles);
    const damageCount = _countDamageBands(td.obstacles);
    this._statsText.setText(
      `Length: ${td.length}u  ·  Bands: ${bandCount}  ·  Gates: ${gateCount}  ·  Damage: ${damageCount}\n` +
      `Est. speed: ${td.estimatedAvgSpeed}u/s  ·  debuffTicks: ${td.debuffTicks}`
    );
    this._startText.setColor('#55EE88');
    this._startBg.setStrokeStyle(2, 0x44AA66);

    // Render map
    this._drawPreviewMap(td);
  }

  _drawPreviewMap(td) {
    const g   = this._mapG;
    const sc  = MAP_H / td.length;

    // Lane backgrounds
    for (let i = 0; i < 3; i++) {
      g.fillStyle(LANE_COLORS[i], 0.28);
      g.fillRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
      g.lineStyle(1, 0xFFFFFF, 0.09);
      g.strokeRect(colLeft(i), MAP_TOP, COL_W, MAP_H);
    }

    // Distance markers
    const step = Math.max(1000, Math.round(td.length / 8 / 1000) * 1000);
    for (let d = 0; d <= td.length; d += step) {
      const ty = MAP_TOP + d * sc;
      g.lineStyle(1, 0x445566, 1);
      g.lineBetween(COL_X0 - 8, ty, COL_X0 - 2, ty);
      this._mapContainer.add(
        this.add.text(COL_X0 - 10, ty, `${d}`, {
          fontSize: '9px', fontFamily: 'monospace', color: '#445566'
        }).setOrigin(1, 0.5)
      );
    }

    const BW = COL_W - 12, BH = 10;
    const MAP_COLORS = { rock: 0x2A2E34, ice: 0xB8D8E8, water: 0x3AA8C4 };
    const TYPE_LABEL = { rock: '▓', ice: '~', water: '≈' };
    const LABEL_COL  = { rock: '#F2C230', ice: '#C8F0FF', water: '#AAEEFF' };

    // Get gate distances and open lanes
    const gateDists = _getGateDists(td.obstacles);

    // Draw obstacles
    for (const obs of td.obstacles) {
      const ty  = MAP_TOP + obs.distance * sc;
      const lx  = colLeft(obs.lane) + 6;
      g.fillStyle(MAP_COLORS[obs.type] ?? OBS_COLORS[obs.type]);
      g.fillRect(lx, ty - BH / 2, BW, BH);
      if (obs.type === 'rock') {
        g.fillStyle(0xF2C230, 0.7);
        g.fillRect(lx, ty - 1, BW, 2);
      }
      this._mapContainer.add(
        this.add.text(lx + BW / 2, ty, TYPE_LABEL[obs.type], {
          fontSize: '7px', fontFamily: 'monospace', color: LABEL_COL[obs.type]
        }).setOrigin(0.5, 0.5)
      );
    }

    // Gate markers
    for (const [dist, openLane] of gateDists) {
      const ty = MAP_TOP + dist * sc;
      g.lineStyle(2, 0xF2C230, 0.9);
      g.lineBetween(COL_X0, ty - BH / 2 - 1, COL_X0, ty + BH / 2 + 1);
      const rightEdge = COL_X0 + 3 * (COL_W + COL_GAP) - COL_GAP;
      g.lineBetween(rightEdge, ty - BH / 2 - 1, rightEdge, ty + BH / 2 + 1);
      this._mapContainer.add(
        this.add.text(rightEdge + 4, ty, `G${openLane}`, {
          fontSize: '7px', fontFamily: 'monospace', color: '#F2C230'
        }).setOrigin(0, 0.5)
      );
    }

    // Pickup markers
    for (const pu of td.pickups) {
      const ty  = MAP_TOP + pu.distance * sc;
      const lx  = colLeft(pu.lane) + COL_W / 2;
      const col = pu.type === 'caltrop_pickup' ? 0x9B6BDA : 0x7ED957;
      g.fillStyle(col, 0.9);
      g.fillTriangle(lx, ty - 5, lx - 4, ty + 3, lx + 4, ty + 3);
    }

    // Column labels
    const LABELS = ['L', 'C', 'R'];
    for (let i = 0; i < 3; i++) {
      this._mapContainer.add(
        this.add.text(colCenter(i), MAP_TOP - 12, LABELS[i], {
          fontSize: '10px', fontFamily: 'monospace', color: '#8899AA'
        }).setOrigin(0.5, 1)
      );
    }
  }

  _startPlanning() {
    if (this._genError || !this._trackData) return;
    if (this.mode === '1p') {
      this.scene.start('PlanScene', {
        trackData: this._trackData, mode: this.mode
      });
    } else {
      this.scene.start('JoinScene', {
        trackData: this._trackData, mode: this.mode
      });
    }
  }
}

// Helpers (module-level, no Phaser)
function _countBands(obstacles) {
  const s = new Set(obstacles.map(o => o.distance));
  return s.size;
}

function _countGates(obstacles) {
  const bandMap = new Map();
  for (const obs of obstacles) {
    if (!bandMap.has(obs.distance)) bandMap.set(obs.distance, []);
    bandMap.get(obs.distance).push(obs);
  }
  let g = 0;
  for (const obs of bandMap.values()) {
    if (obs.filter(o => o.type === 'rock').length === 2) g++;
  }
  return g;
}

function _countDamageBands(obstacles) {
  const bandMap = new Map();
  for (const obs of obstacles) {
    if (!bandMap.has(obs.distance)) bandMap.set(obs.distance, []);
    bandMap.get(obs.distance).push(obs);
  }
  let d = 0;
  for (const obs of bandMap.values()) {
    const hasRock = obs.some(o => o.type === 'rock');
    if (!hasRock && obs.length === 3) d++;
  }
  return d;
}

function _getGateDists(obstacles) {
  const bandMap = new Map();
  for (const obs of obstacles) {
    if (!bandMap.has(obs.distance)) bandMap.set(obs.distance, []);
    bandMap.get(obs.distance).push(obs);
  }
  const result = new Map();
  for (const [dist, obs] of bandMap) {
    const rocks = obs.filter(o => o.type === 'rock');
    if (rocks.length === 2) {
      const rockLanes = new Set(rocks.map(o => o.lane));
      const openLane = [0, 1, 2].find(l => !rockLanes.has(l));
      result.set(dist, openLane);
    }
  }
  return result;
}
