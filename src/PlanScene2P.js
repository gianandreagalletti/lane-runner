/**
 * Multi-player shop panels for PlanScene.
 * Exports buildShopPicker(scene, data) — called from PlanScene when mode !== '1p'.
 *
 * Each player drives their own panel with dedicated keys:
 *   P1: A/D to navigate rows, W/S to inc/dec, F to confirm
 *   P2: LEFT/RIGHT to navigate rows, UP/DOWN to inc/dec, RSHIFT to confirm
 *   P3: NUMPAD_FOUR/SIX to navigate, NUMPAD_EIGHT/FIVE to inc/dec, NUMPAD_ZERO to confirm
 *
 * data = {
 *   n: 2|3,
 *   progresses: [prog1, prog2, prog3?],
 *   playerKeys: [{ left, right, inc, dec, confirm }, ...],
 *   onReady: (pidx, loadout) => void,   // called per-player when they confirm
 *   x0: number,   // left edge of shop area (map takes 0..x0)
 *   y0: number,   // top y
 *   panelW: number
 * }
 */

import { BOOSTS, BOOST_CONFIG } from './boosts.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;

const PASSIVE_IDS = ['ice_grip', 'water_shield', 'quick_step'];
// BENCHED: phase removed from shop
const ACTIVE_IDS  = ['rock_break', 'sprint', 'caltrop', 'snipe_shot'];
const ROW_IDS     = [...PASSIVE_IDS, ...ACTIVE_IDS];

export function buildShopPicker(scene, data) {
  const { n, progresses, playerKeys, onReady, x0, y0, panelW } = data;
  const PASSIVE_BUDGET = BOOST_CONFIG.PASSIVE_POINTS;
  const ACTIVE_BUDGET  = BOOST_CONFIG.ACTIVE_POINTS;

  const readyFlags = new Array(n).fill(false);

  for (let pidx = 0; pidx < n; pidx++) {
    const px = x0 + pidx * panelW;
    const cx = px + panelW / 2;
    _buildPanel(scene, pidx, cx, px, panelW, y0,
      PASSIVE_BUDGET, ACTIVE_BUDGET, playerKeys[pidx],
      (loadout) => {
        readyFlags[pidx] = true;
        onReady(pidx, loadout);
      }
    );
  }
}

function _buildPanel(scene, pidx, cx, px, panelW, y0,
  PASSIVE_BUDGET, ACTIVE_BUDGET, keys, onConfirm) {

  const playerColors = ['#AABBCC', '#E8A33D', '#4FD1C5'];
  const col = playerColors[pidx];

  // State
  const passiveLevels = { ice_grip: 0, water_shield: 0, quick_step: 0 };
  const activeCharges = { rock_break: 0, sprint: 0, caltrop: 0, snipe_shot: 0 };
  let   cursorRow = 0;  // 0–6: passive 0–2, active 0–3
  let   confirmed = false;

  // Header
  scene.add.text(cx, y0 + 4, `P${pidx + 1} LOADOUT`, {
    fontSize: '14px', fontFamily: 'monospace', color: col
  }).setOrigin(0.5, 0);

  const keysHint = keys
    ? `${keys.left}/${keys.right}: row  ${keys.inc}/${keys.dec}: value  ${keys.confirm}: confirm`
    : '';
  scene.add.text(cx, y0 + 22, keysHint, {
    fontSize: '9px', fontFamily: 'monospace', color: '#445566'
  }).setOrigin(0.5, 0);

  // Budget displays
  const pBudgetT = scene.add.text(px + 6, y0 + 38, '', {
    fontSize: '11px', fontFamily: 'monospace', color: '#66BBFF'
  }).setOrigin(0, 0);
  const aBudgetT = scene.add.text(px + 6, y0 + 52, '', {
    fontSize: '11px', fontFamily: 'monospace', color: '#FFAA44'
  }).setOrigin(0, 0);

  // Section labels
  scene.add.text(px + 6, y0 + 70, 'PASSIVES', {
    fontSize: '10px', fontFamily: 'monospace', color: '#335577'
  }).setOrigin(0, 0);
  scene.add.text(px + 6, y0 + 182, 'ACTIVES', {
    fontSize: '10px', fontFamily: 'monospace', color: '#664422'
  }).setOrigin(0, 0);

  // Row Y positions (7 rows: 3 passive + 4 active)
  const rowY = [
    y0 + 90,  y0 + 116, y0 + 142,  // passives
    y0 + 198, y0 + 224, y0 + 250, y0 + 276  // actives (4 rows now, BENCHED: phase)
  ];

  const rowRefs = [];
  for (let ri = 0; ri < 7; ri++) {
    const ry  = rowY[ri];
    const isP = ri < 3;
    const id  = ROW_IDS[ri];
    const boost = BOOSTS[id];

    const nameT  = scene.add.text(px + 6, ry, boost.name, {
      fontSize: '12px', fontFamily: 'monospace', color: isP ? '#DDEEFF' : '#FFDDB0'
    }).setOrigin(0, 0.5);
    const valT = scene.add.text(cx, ry, '0', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);
    const infoT = scene.add.text(cx + panelW * 0.32, ry, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0, 0.5);
    // Cursor indicator
    const cursorGfx = scene.add.graphics();

    rowRefs.push({ id, isP, nameT, valT, infoT, cursorGfx });
  }

  // Status + confirm button
  const statusT = scene.add.text(cx, y0 + 300, '', {
    fontSize: '11px', fontFamily: 'monospace', color: '#667788'
  }).setOrigin(0.5, 0);
  const btnBg = scene.add.rectangle(cx, y0 + 324, panelW - 16, 36, 0x0a1410)
    .setInteractive({ useHandCursor: true })
    .setStrokeStyle(2, 0x223322);
  const btnT = scene.add.text(cx, y0 + 324, 'CONFIRM', {
    fontSize: '16px', fontFamily: 'monospace', color: '#2A5535'
  }).setOrigin(0.5);
  btnBg.on('pointerdown', () => { if (!confirmed) _confirm(); });

  const confirmText = scene.add.text(cx, y0 + 348, '', {
    fontSize: '10px', fontFamily: 'monospace', color: '#44AA66'
  }).setOrigin(0.5, 0);

  const refresh = () => {
    const pSpent = _passiveSpent(passiveLevels);
    const aSpent = _activeSpent(activeCharges);
    const pLeft  = PASSIVE_BUDGET - pSpent;
    const aLeft  = ACTIVE_BUDGET  - aSpent;

    pBudgetT.setText(`P.pts: ${pLeft}/${PASSIVE_BUDGET}`);
    pBudgetT.setColor(pLeft < 0 ? '#FF4444' : '#66BBFF');
    aBudgetT.setText(`A.pts: ${aLeft}/${ACTIVE_BUDGET}`);
    aBudgetT.setColor(aLeft < 0 ? '#FF4444' : '#FFAA44');

    for (let ri = 0; ri < 7; ri++) {
      const ref = rowRefs[ri];
      const { id, isP } = ref;

      let valStr, infoStr;
      if (isP) {
        const level = passiveLevels[id];
        const cfg = BOOST_CONFIG.passives[id];
        valStr = `L${level}`;
        ref.valT.setColor(level > 0 ? '#AAFFCC' : '#888888');

        if (level === 0) {
          infoStr = id === 'quick_step' ? `base ${cfg.baseTicks}t` : `base ${cfg.baseFactorPct}%`;
        } else {
          const lcfg = cfg.levels[level - 1];
          infoStr = id === 'quick_step'
            ? (lcfg.ticks === 0 ? 'instant' : `${lcfg.ticks}t`)
            : `${lcfg.factorPct}%`;
        }
      } else {
        const charges = activeCharges[id];
        valStr = `x${charges}`;
        ref.valT.setColor(charges > 0 ? '#FFCCAA' : '#888888');
        infoStr = charges > 0 ? `${charges} charge${charges > 1 ? 's' : ''}` : 'none';
      }

      ref.valT.setText(valStr);
      ref.infoT.setText(infoStr);

      // Draw cursor
      ref.cursorGfx.clear();
      if (ri === cursorRow && !confirmed) {
        ref.cursorGfx.lineStyle(2, pidx === 0 ? 0xFFDD00 : pidx === 1 ? 0xFFAA44 : 0x44FFCC, 0.9);
        ref.cursorGfx.strokeRect(px + 2, rowY[ri] - 9, panelW - 4, 18);
      }
    }

    const canConfirm = pLeft >= 0 && aLeft >= 0;
    btnBg.setStrokeStyle(2, canConfirm ? 0x44AA66 : 0x332211);
    btnT.setColor(canConfirm ? '#55EE88' : '#2A5535');
    statusT.setText(confirmed ? 'READY!' : (canConfirm ? 'Press confirm' : 'Over budget!'));
    statusT.setColor(confirmed ? '#44FF88' : (canConfirm ? '#445566' : '#CC4444'));
  };

  const _getValue = (ri) => {
    const id = ROW_IDS[ri];
    if (ri < 3) return passiveLevels[id];
    return activeCharges[id];
  };

  const _inc = (ri) => {
    if (confirmed) return;
    const id = ROW_IDS[ri];
    if (ri < 3) {
      const cfg = BOOST_CONFIG.passives[id];
      const level = passiveLevels[id];
      if (level >= cfg.levels.length) return;
      const nextCost = cfg.levels[level].cost;
      if (PASSIVE_BUDGET - _passiveSpent(passiveLevels) < nextCost) return;
      passiveLevels[id]++;
    } else {
      const cfg = BOOST_CONFIG.actives[id];
      if (activeCharges[id] >= cfg.maxCharges) return;
      if (ACTIVE_BUDGET - _activeSpent(activeCharges) < cfg.costPerCharge) return;
      activeCharges[id]++;
    }
    refresh();
  };

  const _dec = (ri) => {
    if (confirmed) return;
    const id = ROW_IDS[ri];
    if (ri < 3) {
      if (passiveLevels[id] <= 0) return;
      passiveLevels[id]--;
    } else {
      if (activeCharges[id] <= 0) return;
      activeCharges[id]--;
    }
    refresh();
  };

  const _confirm = () => {
    if (confirmed) return;
    const pLeft = PASSIVE_BUDGET - _passiveSpent(passiveLevels);
    const aLeft = ACTIVE_BUDGET  - _activeSpent(activeCharges);
    if (pLeft < 0 || aLeft < 0) return;
    confirmed = true;
    confirmText.setText('LOCKED IN');
    btnBg.setFillStyle(0x0e2814);
    refresh();
    onConfirm({
      passives: { ...passiveLevels },
      actives:  { ...activeCharges }
    });
  };

  // Keyboard input
  if (keys) {
    scene.input.keyboard.on('keydown', e => {
      if (confirmed) return;
      if (e.code === `Key${keys.left}` || e.key === keys.left || e.code === keys.left) {
        cursorRow = Math.max(0, cursorRow - 1);
        refresh();
      } else if (e.code === `Key${keys.right}` || e.key === keys.right || e.code === keys.right) {
        cursorRow = Math.min(6, cursorRow + 1);
        refresh();
      } else if (e.code === `Key${keys.inc}` || e.key === keys.inc || e.code === keys.inc ||
                 e.code === keys.inc) {
        _inc(cursorRow);
      } else if (e.code === `Key${keys.dec}` || e.key === keys.dec || e.code === keys.dec ||
                 e.code === keys.dec) {
        _dec(cursorRow);
      } else if (e.code === `Key${keys.confirm}` || e.key === keys.confirm ||
                 e.code === keys.confirm || e.key === keys.confirm) {
        _confirm();
      }
    });
  }

  refresh();
}

function _passiveSpent(passiveLevels) {
  let spent = 0;
  for (const id of PASSIVE_IDS) {
    const level = passiveLevels[id];
    const cfg = BOOST_CONFIG.passives[id];
    for (let l = 0; l < level; l++) spent += cfg.levels[l].cost;
  }
  return spent;
}

function _activeSpent(activeCharges) {
  let spent = 0;
  // BENCHED: phase removed — ACTIVE_IDS now = rock_break, sprint, caltrop, snipe_shot
  for (const id of ACTIVE_IDS) {
    spent += BOOST_CONFIG.actives[id].costPerCharge * (activeCharges[id] ?? 0);
  }
  return spent;
}
