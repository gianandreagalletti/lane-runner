import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, LANE_COLORS, OBS_COLORS } from './track.js';
import { BOOSTS, BOOST_CONFIG } from './boosts.js';
import { loadProgress } from './progression.js';
import { buildShopPicker } from './PlanScene2P.js';

const MAP_TOP_1P = 85, MAP_BOTTOM_1P = 618;
const MAP_TOP_2P = 60, MAP_BOTTOM_2P = 300;
const COL_W = 138, COL_GAP = 16, COL_X0 = 64;
function colLeft(lane)   { return COL_X0 + lane * (COL_W + COL_GAP); }
function colCenter(lane) { return colLeft(lane) + COL_W / 2; }
const RP_CX   = 935;

export class PlanScene extends Phaser.Scene {
  constructor() { super({ key: 'PlanScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.mode           = data.mode || '1p';
    this._claims        = data.claims || null;
    this.progress       = loadProgress('p1');
    this.planStart      = 0;
  }

  create() {
    this.planStart = Date.now();
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    this.add.text(CANVAS_W / 2, 16, `${this.trackData.name}  —  PLAN YOUR RUN`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#7899AA'
    }).setOrigin(0.5, 0);

    if (this.mode !== '1p') {
      this._drawMap(MAP_TOP_2P, MAP_BOTTOM_2P);
      this._buildMultiPlayerUI();
    } else {
      const div = this.add.graphics();
      div.lineStyle(1, 0x223344, 1);
      div.lineBetween(596, 8, 596, CANVAS_H - 8);
      this._drawMap(MAP_TOP_1P, MAP_BOTTOM_1P);
      this._drawShop();
      this.input.keyboard.on('keydown', e => {
        if (e.key === 'Enter') this._tryStart();
        if (e.key === 'Escape') this.scene.start('MenuScene', { mode: this.mode });
      });
    }
  }

  _buildMultiPlayerUI() {
    const progressP1 = loadProgress('p1');
    const progressP2 = loadProgress('p2');
    const progressP3 = this.mode === '3p' ? loadProgress('p3') : null;

    const n = this.mode === '3p' ? 3 : 2;
    const playerKeys = [
      { left: 'A', right: 'D', inc: 'W', dec: 'S', confirm: 'F' },
      { left: 'LEFT', right: 'RIGHT', inc: 'UP', dec: 'DOWN', confirm: 'RSHIFT' },
      { left: 'NUMPAD_FOUR', right: 'NUMPAD_SIX', inc: 'NUMPAD_EIGHT', dec: 'NUMPAD_FIVE', confirm: 'NUMPAD_ZERO' }
    ];

    const loadouts = [null, null, null];

    const onReady = (pidx, loadout) => {
      loadouts[pidx] = loadout;
      const allReady = loadouts.slice(0, n).every(l => l !== null);
      if (allReady) {
        const data = {
          mode:          this.mode,
          trackData:     this.trackData,
          loadoutP1:     loadouts[0],
          loadoutP2:     loadouts[1],
          planningTimeMs: Date.now() - this.planStart,
          claims:        this._claims
        };
        if (this.mode === '3p') data.loadoutP3 = loadouts[2];
        this.scene.start('RunScene', data);
      }
    };

    buildShopPicker(this, {
      n,
      progresses: [progressP1, progressP2, progressP3],
      playerKeys: playerKeys.slice(0, n),
      onReady,
      x0: 640, y0: 50,
      panelW: (CANVAS_W - 640) / n
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene', { mode: this.mode });
    });
  }

  _drawMap(mapTop, mapBottom) {
    const mapH = mapBottom - mapTop;
    const g    = this.add.graphics();
    const sc   = mapH / this.trackData.length;

    for (let i = 0; i < 3; i++) {
      g.fillStyle(LANE_COLORS[i], 0.28);
      g.fillRect(colLeft(i), mapTop, COL_W, mapH);
      g.lineStyle(1, 0xFFFFFF, 0.09);
      g.strokeRect(colLeft(i), mapTop, COL_W, mapH);
    }

    for (let d = 0; d <= this.trackData.length; d += 1000) {
      const ty = mapTop + d * sc;
      g.lineStyle(1, 0x445566, 1);
      g.lineBetween(COL_X0 - 10, ty, COL_X0 - 2, ty);
      this.add.text(COL_X0 - 13, ty, `${d}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#445566'
      }).setOrigin(1, 0.5);
    }

    const LABELS = ['LEFT', 'CENTER', 'RIGHT'];
    for (let i = 0; i < 3; i++) {
      this.add.text(colCenter(i), mapTop - 14, LABELS[i], {
        fontSize: '12px', fontFamily: 'monospace', color: '#8899AA'
      }).setOrigin(0.5, 1);
    }

    const BW = COL_W - 16, BH = 12;
    const TYPE_LABEL = { rock: 'R ✕', ice: 'I +', water: 'W ~' };
    const LABEL_COL  = { rock: '#FFB8B0', ice: '#C8F0FF', water: '#C8FFFF' };
    for (const obs of this.trackData.obstacles) {
      const ty  = mapTop + obs.distance * sc;
      const lx  = colLeft(obs.lane) + 8;
      g.fillStyle(OBS_COLORS[obs.type]);
      g.fillRect(lx, ty - BH / 2, BW, BH);
      this.add.text(lx + BW / 2, ty, TYPE_LABEL[obs.type], {
        fontSize: '8px', fontFamily: 'monospace', color: LABEL_COL[obs.type]
      }).setOrigin(0.5, 0.5);
    }

    const counts = this._countObs();
    const SY = mapBottom + 14;
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

  _drawShop() {
    const cx = RP_CX;
    const PASSIVE_IDS = ['ice_grip', 'water_shield', 'quick_step'];
    const ACTIVE_IDS  = ['rock_break', 'sprint', 'phase'];
    const PASSIVE_BUDGET = BOOST_CONFIG.PASSIVE_POINTS;
    const ACTIVE_BUDGET  = BOOST_CONFIG.ACTIVE_POINTS;

    // State (stored on this so ENTER handler can access it)
    const passiveLevels  = this._passiveLevels = { ice_grip: 0, water_shield: 0, quick_step: 0 };
    const activeCharges  = this._activeCharges = { rock_break: 0, sprint: 0, phase: 0 };

    this.add.text(cx, 42, 'BUILD LOADOUT', {
      fontSize: '20px', fontFamily: 'monospace', color: '#AABBCC'
    }).setOrigin(0.5, 0);

    this.add.text(cx, 68, 'ENTER = confirm  ·  ESC = back', {
      fontSize: '12px', fontFamily: 'monospace', color: '#334455'
    }).setOrigin(0.5, 0);

    // Budget displays
    const pBudgetT = this.add.text(cx - 90, 96, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#66BBFF'
    }).setOrigin(0, 0);
    const aBudgetT = this.add.text(cx - 90, 114, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#FFAA44'
    }).setOrigin(0, 0);

    // Build passive rows
    this.add.text(cx - 100, 140, 'PASSIVES', {
      fontSize: '11px', fontFamily: 'monospace', color: '#335577'
    }).setOrigin(0, 0);

    const passiveRowY = { ice_grip: 162, water_shield: 196, quick_step: 230 };
    const passiveRefs = {};

    for (const id of PASSIVE_IDS) {
      const y = passiveRowY[id];
      const cfg = BOOST_CONFIG.passives[id];
      const boost = BOOSTS[id];

      this.add.text(cx - 100, y, boost.name, {
        fontSize: '13px', fontFamily: 'monospace', color: '#DDEEFF'
      }).setOrigin(0, 0.5);

      const descT = this.add.text(cx - 100, y + 14, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#557799'
      }).setOrigin(0, 0.5);

      const decBtn = this.add.text(cx + 28, y, '[-]', {
        fontSize: '14px', fontFamily: 'monospace', color: '#AA6644'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const levelT = this.add.text(cx + 60, y, '0', {
        fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF'
      }).setOrigin(0.5);
      const incBtn = this.add.text(cx + 92, y, '[+]', {
        fontSize: '14px', fontFamily: 'monospace', color: '#44AA66'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const costT = this.add.text(cx + 116, y, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#445566'
      }).setOrigin(0, 0.5);

      decBtn.on('pointerdown', () => { changePassive(id, -1); });
      incBtn.on('pointerdown', () => { changePassive(id, +1); });

      passiveRefs[id] = { decBtn, levelT, incBtn, descT, costT };
    }

    // Build active rows
    this.add.text(cx - 100, 264, 'ACTIVES', {
      fontSize: '11px', fontFamily: 'monospace', color: '#664422'
    }).setOrigin(0, 0);

    const activeRowY = { rock_break: 286, sprint: 320, phase: 354 };
    const activeRefs = {};

    for (const id of ACTIVE_IDS) {
      const y = activeRowY[id];
      const cfg = BOOST_CONFIG.actives[id];
      const boost = BOOSTS[id];

      this.add.text(cx - 100, y, boost.name, {
        fontSize: '13px', fontFamily: 'monospace', color: '#FFDDB0'
      }).setOrigin(0, 0.5);

      const descT = this.add.text(cx - 100, y + 14, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#776644'
      }).setOrigin(0, 0.5);

      const decBtn = this.add.text(cx + 28, y, '[-]', {
        fontSize: '14px', fontFamily: 'monospace', color: '#AA6644'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const chargesT = this.add.text(cx + 60, y, '0', {
        fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF'
      }).setOrigin(0.5);
      const incBtn = this.add.text(cx + 92, y, '[+]', {
        fontSize: '14px', fontFamily: 'monospace', color: '#44AA66'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const costT = this.add.text(cx + 116, y, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#554433'
      }).setOrigin(0, 0.5);

      decBtn.on('pointerdown', () => { changeActive(id, -1); });
      incBtn.on('pointerdown', () => { changeActive(id, +1); });

      activeRefs[id] = { decBtn, chargesT, incBtn, descT, costT };
    }

    // Confirm button
    const btnY = 420;
    const startBg = this.add.rectangle(cx, btnY, 260, 54, 0x0e2214)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x223322);
    const startText = this.add.text(cx, btnY, 'START RUN', {
      fontSize: '24px', fontFamily: 'monospace', color: '#2A5535'
    }).setOrigin(0.5);
    startBg.on('pointerover', () => startBg.setFillStyle(0x163020));
    startBg.on('pointerout',  () => startBg.setFillStyle(0x0e2214));
    startBg.on('pointerdown', () => this._tryStartShop(passiveLevels, activeCharges));

    const hintT = this.add.text(cx, btnY + 36, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5, 0);

    const refresh = () => {
      // Budget spent
      let pSpent = 0;
      for (const id of PASSIVE_IDS) {
        const level = passiveLevels[id];
        const cfg = BOOST_CONFIG.passives[id];
        for (let l = 0; l < level; l++) pSpent += cfg.levels[l].cost;
      }
      let aSpent = 0;
      for (const id of ACTIVE_IDS) {
        const charges = activeCharges[id];
        if (charges > 0) aSpent += BOOST_CONFIG.actives[id].costPerCharge * charges;
      }
      const pLeft = PASSIVE_BUDGET - pSpent;
      const aLeft = ACTIVE_BUDGET  - aSpent;

      pBudgetT.setText(`Passive pts: ${pLeft} / ${PASSIVE_BUDGET} remaining`);
      pBudgetT.setColor(pLeft < 0 ? '#FF4444' : '#66BBFF');
      aBudgetT.setText(`Active pts:  ${aLeft} / ${ACTIVE_BUDGET} remaining`);
      aBudgetT.setColor(aLeft < 0 ? '#FF4444' : '#FFAA44');

      // Passive rows
      for (const id of PASSIVE_IDS) {
        const level = passiveLevels[id];
        const cfg   = BOOST_CONFIG.passives[id];
        const ref   = passiveRefs[id];
        ref.levelT.setText(`${level}`);
        ref.levelT.setColor(level > 0 ? '#AAFFCC' : '#FFFFFF');

        // Next level cost
        const nextCfg = level < cfg.levels.length ? cfg.levels[level] : null;
        const nextCost = nextCfg ? nextCfg.cost : null;
        const canInc   = nextCfg && (pLeft >= nextCfg.cost);
        const canDec   = level > 0;

        ref.incBtn.setColor(canInc ? '#44FF88' : '#224433');
        ref.decBtn.setColor(canDec ? '#FF8844' : '#332211');
        ref.costT.setText(nextCfg ? `${nextCost}pt` : 'MAX');
        ref.costT.setColor(nextCfg ? '#667788' : '#334455');

        // Description of current level
        if (level === 0) ref.descT.setText(id === 'quick_step' ? `base: ${cfg.baseTicks}t switch` : `base: ${cfg.baseFactorPct}% speed`);
        else {
          const lcfg = cfg.levels[level - 1];
          if (id === 'quick_step') ref.descT.setText(`${lcfg.ticks === 0 ? 'instant' : lcfg.ticks + 't'} switch`);
          else ref.descT.setText(`${lcfg.factorPct}% speed`);
        }
      }

      // Active rows
      for (const id of ACTIVE_IDS) {
        const charges = activeCharges[id];
        const cfg     = BOOST_CONFIG.actives[id];
        const ref     = activeRefs[id];
        ref.chargesT.setText(`${charges}`);
        ref.chargesT.setColor(charges > 0 ? '#FFCCAA' : '#FFFFFF');

        const canInc = charges < cfg.maxCharges && (aLeft >= cfg.costPerCharge);
        const canDec = charges > 0;
        ref.incBtn.setColor(canInc ? '#44FF88' : '#224433');
        ref.decBtn.setColor(canDec ? '#FF8844' : '#332211');
        ref.costT.setText(`${cfg.costPerCharge}pt each`);
        ref.descT.setText(charges > 0 ? `×${charges} charged` : 'none');
      }

      // Start button
      const hasAnything = Object.values(passiveLevels).some(v => v > 0) ||
                          Object.values(activeCharges).some(v => v > 0);
      startBg.setStrokeStyle(2, hasAnything ? 0x44AA66 : 0x223322);
      startText.setColor(hasAnything ? '#55EE88' : '#2A5535');
      hintT.setText(pLeft >= 0 && aLeft >= 0 ? 'ENTER = start' : 'Over budget!');
      hintT.setColor(pLeft >= 0 && aLeft >= 0 ? '#445566' : '#CC4444');
    };

    const changePassive = (id, dir) => {
      const cfg   = BOOST_CONFIG.passives[id];
      const level = passiveLevels[id];
      if (dir > 0) {
        if (level >= cfg.levels.length) return; // already max
        // Check L1 required before L2
        if (level >= 1 && passiveLevels[id] < 1) return;
        // Check budget
        const nextCost = cfg.levels[level].cost;
        const pSpent = _passiveSpent(passiveLevels);
        if (PASSIVE_BUDGET - pSpent < nextCost) return;
        passiveLevels[id]++;
      } else {
        if (level <= 0) return;
        // Can only remove top level (L2 before L1)
        passiveLevels[id]--;
      }
      refresh();
    };

    const changeActive = (id, dir) => {
      const cfg = BOOST_CONFIG.actives[id];
      if (dir > 0) {
        if (activeCharges[id] >= cfg.maxCharges) return;
        const aSpent = _activeSpent(activeCharges);
        if (ACTIVE_BUDGET - aSpent < cfg.costPerCharge) return;
        activeCharges[id]++;
      } else {
        if (activeCharges[id] <= 0) return;
        activeCharges[id]--;
      }
      refresh();
    };

    refresh();
  }

  _tryStartShop(passiveLevels, activeCharges) {
    const loadout = {
      passives: { ...passiveLevels },
      actives:  { ...activeCharges }
    };
    this.scene.start('RunScene', {
      mode:           this.mode,
      trackData:      this.trackData,
      loadout,
      planningTimeMs: Date.now() - this.planStart
    });
  }

  _tryStart() {
    if (this._passiveLevels && this._activeCharges) {
      this._tryStartShop(this._passiveLevels, this._activeCharges);
    }
  }
}

function _passiveSpent(passiveLevels) {
  let spent = 0;
  for (const id of ['ice_grip', 'water_shield', 'quick_step']) {
    const level = passiveLevels[id];
    const cfg = BOOST_CONFIG.passives[id];
    for (let l = 0; l < level; l++) spent += cfg.levels[l].cost;
  }
  return spent;
}

function _activeSpent(activeCharges) {
  let spent = 0;
  for (const id of ['rock_break', 'sprint', 'phase']) {
    spent += BOOST_CONFIG.actives[id].costPerCharge * (activeCharges[id] ?? 0);
  }
  return spent;
}
