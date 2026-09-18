/**
 * Multi-player shop panels for PlanScene.
 * Exports buildShopPicker(scene, data) — called from PlanScene when mode !== '1p'.
 *
 * Each player drives their own panel with dedicated keys from BINDINGS:
 *   P1: W/S navigate rows, A/D step value, F confirm
 *   P2: UP/DOWN navigate rows, LEFT/RIGHT step value, ENTER confirm
 *   P3: I/K navigate rows, Q/E step value, H confirm
 *
 * Gamepad: left-stick Y / d-pad up-down navigates rows,
 *          left-stick X / d-pad left-right steps values,
 *          A confirms, B un-confirms.
 *
 * data = {
 *   n: 2|3,
 *   progresses: [prog1, prog2, prog3?],
 *   claims: [{inputSource, padIndex?}, ...],   // from JoinScene
 *   onReady: (pidx, loadout) => void,
 *   x0: number,
 *   y0: number,
 *   panelW: number
 * }
 */

import { BOOSTS, BOOST_CONFIG } from './boosts.js';
import { BINDINGS, KEY_DISPLAY } from './controls.js';

const PASSIVE_IDS = ['ice_grip', 'water_shield', 'quick_step'];
// BENCHED: phase removed from shop
const ACTIVE_IDS  = ['rock_break', 'sprint', 'caltrop', 'snipe_shot'];
const ROW_IDS     = [...PASSIVE_IDS, ...ACTIVE_IDS];

// Map a BINDINGS key name to the Phaser key code string used with addKey.
// Letter keys like 'A' map to Phaser.Input.Keyboard.KeyCodes.A (which works with string 'A').
// Named keys like 'LEFT', 'UP', 'ENTER' etc. work directly as Phaser key code names.
function _phaserKeyName(bindingName) {
  // All entries in BINDINGS that aren't single letters are already valid Phaser KeyCode names.
  // Single uppercase letters are also valid Phaser KeyCode names.
  return bindingName;
}

// Build Phaser Key objects for a player's shop bindings (up, down, left, right, confirm).
function _makeKeys(scene, pidx) {
  const b = BINDINGS[`p${pidx + 1}`];
  const kb = scene.input.keyboard;
  return {
    up:      kb.addKey(b.up),
    down:    kb.addKey(b.down),
    left:    kb.addKey(b.left),
    right:   kb.addKey(b.right),
    confirm: kb.addKey(b.confirm)
  };
}

export function buildShopPicker(scene, data) {
  const { n, progresses, claims, onReady, x0, y0, panelW } = data;
  const PASSIVE_BUDGET = BOOST_CONFIG.PASSIVE_POINTS;
  const ACTIVE_BUDGET  = BOOST_CONFIG.ACTIVE_POINTS;

  // Prevent browser from scrolling when arrow keys are pressed
  scene.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);

  // Per-slot gamepad nav state for edge detection
  const padNavStates = Array.from({ length: n }, () => ({
    yArmed: true, xArmed: true, prevA: false, prevB: false
  }));

  // Store panel action functions so update() can call them
  const panelActions = [];

  const readyFlags = new Array(n).fill(false);

  for (let pidx = 0; pidx < n; pidx++) {
    const px   = x0 + pidx * panelW;
    const cx   = px + panelW / 2;
    const keys = _makeKeys(scene, pidx);
    const claim = claims ? claims[pidx] : null;

    const actions = _buildPanel(
      scene, pidx, cx, px, panelW, y0,
      PASSIVE_BUDGET, ACTIVE_BUDGET,
      keys, claim,
      (loadout) => {
        readyFlags[pidx] = true;
        onReady(pidx, loadout);
      }
    );
    panelActions.push(actions);
  }

  // Store update callback on scene for gamepad polling
  scene._shopUpdate = function () {
    if (!scene.input.gamepad) return;
    for (let i = 0; i < n; i++) {
      const claim = claims ? claims[i] : null;
      if (!claim || claim.inputSource !== 'pad') continue;
      const pad = scene.input.gamepad.getPad(claim.padIndex);
      if (!pad) continue;

      const padState  = padNavStates[i];
      const actions   = panelActions[i];

      // Up/down navigation — left stick Y or d-pad
      const axisY   = typeof pad.axes[1]?.getValue === 'function'
        ? pad.axes[1].getValue() : (pad.axes[1] ?? 0);
      const dpadUp   = (pad.buttons[12]?.value ?? 0) > 0.5;
      const dpadDown = (pad.buttons[13]?.value ?? 0) > 0.5;
      const navUp    = axisY < -0.5 || dpadUp;
      const navDown  = axisY >  0.5 || dpadDown;

      if (!padState.yArmed) {
        if (!navUp && !navDown) padState.yArmed = true;
      } else {
        if (navUp)        { actions.moveRow(-1); padState.yArmed = false; }
        else if (navDown) { actions.moveRow(+1); padState.yArmed = false; }
      }

      // Left/right value stepping — left stick X or d-pad
      const axisX    = typeof pad.axes[0]?.getValue === 'function'
        ? pad.axes[0].getValue() : (pad.axes[0] ?? 0);
      const dpadLeft  = (pad.buttons[14]?.value ?? 0) > 0.5;
      const dpadRight = (pad.buttons[15]?.value ?? 0) > 0.5;
      const navLeft   = axisX < -0.5 || dpadLeft;
      const navRight  = axisX >  0.5 || dpadRight;

      if (!padState.xArmed) {
        if (!navLeft && !navRight) padState.xArmed = true;
      } else {
        if (navLeft)        { actions.stepValue(-1); padState.xArmed = false; }
        else if (navRight)  { actions.stepValue(+1); padState.xArmed = false; }
      }

      // A = confirm, B = un-confirm
      const aDown = (pad.buttons[0]?.value ?? 0) > 0.5;
      const bDown = (pad.buttons[1]?.value ?? 0) > 0.5;
      if (aDown && !padState.prevA) actions.confirm();
      if (bDown && !padState.prevB) actions.unconfirm();
      padState.prevA = aDown;
      padState.prevB = bDown;
    }
  };

  // Hook keyboard JustDown polling into scene's update by adding a recurring check.
  // We use Phaser's update event rather than a custom loop so it fires every frame.
  scene.events.on('update', () => {
    // Keyboard: check JustDown for each player's keys
    for (let i = 0; i < n; i++) {
      const actions = panelActions[i];
      const b = BINDINGS[`p${i + 1}`];
      const kb = scene.input.keyboard;
      // addKey returns the same object if already added — safe to call per frame
      const upKey      = kb.addKey(b.up);
      const downKey    = kb.addKey(b.down);
      const leftKey    = kb.addKey(b.left);
      const rightKey   = kb.addKey(b.right);
      const confirmKey = kb.addKey(b.confirm);

      if (Phaser.Input.Keyboard.JustDown(upKey))      actions.moveRow(-1);
      if (Phaser.Input.Keyboard.JustDown(downKey))    actions.moveRow(+1);
      if (Phaser.Input.Keyboard.JustDown(leftKey))    actions.stepValue(-1);
      if (Phaser.Input.Keyboard.JustDown(rightKey))   actions.stepValue(+1);
      if (Phaser.Input.Keyboard.JustDown(confirmKey)) actions.confirm();
    }

    // Gamepad polling
    scene._shopUpdate();
  });
}

function _buildPanel(scene, pidx, cx, px, panelW, y0,
  PASSIVE_BUDGET, ACTIVE_BUDGET, keys, claim, onConfirm) {

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

  // Controls hint (show actual input device)
  let keysHint;
  if (claim && claim.inputSource === 'pad') {
    keysHint = '↑↓:row  ←→:val  [A]:confirm';
  } else {
    const b = BINDINGS[`p${pidx + 1}`];
    const kd = KEY_DISPLAY;
    keysHint = `${kd[b.up]}/${kd[b.down]}:row  ${kd[b.left]}/${kd[b.right]}:val  ${kd[b.confirm]}:ok`;
  }
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
    y0 + 90,  y0 + 116, y0 + 142,        // passives
    y0 + 198, y0 + 224, y0 + 250, y0 + 276  // actives
  ];

  const rowRefs = [];
  for (let ri = 0; ri < 7; ri++) {
    const ry  = rowY[ri];
    const isP = ri < 3;
    const id  = ROW_IDS[ri];
    const boost = BOOSTS[id];

    // Clip name text to roughly left 40% of panel
    const nameMaxW = Math.floor(panelW * 0.42);
    const nameT = scene.add.text(px + 6, ry, boost.name, {
      fontSize: '11px', fontFamily: 'monospace', color: isP ? '#DDEEFF' : '#FFDDB0',
      wordWrap: { width: nameMaxW, useAdvancedWrap: false }
    }).setOrigin(0, 0.5);

    const valT = scene.add.text(cx, ry, '0', {
      fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF'
    }).setOrigin(0.5, 0.5);

    // [-] and [+] mouse steppers — positioned within panel
    const decX = cx - 22;
    const incX = cx + 22;
    const decBtn = scene.add.text(decX, ry, '[-]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#AA6644'
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    const incBtn = scene.add.text(incX, ry, '[+]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#44AA66'
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

    decBtn.on('pointerdown', () => { if (!confirmed) { _dec(ri); } });
    incBtn.on('pointerdown', () => { if (!confirmed) { _inc(ri); } });

    // Cursor indicator
    const cursorGfx = scene.add.graphics();

    rowRefs.push({ id, isP, nameT, valT, decBtn, incBtn, cursorGfx });
  }

  // Empty loadout warning
  const emptyWarnT = scene.add.text(cx, y0 + 290, 'NO BOOSTS SELECTED', {
    fontSize: '10px', fontFamily: 'monospace', color: '#FFDD00'
  }).setOrigin(0.5, 0).setVisible(false);

  // Status + confirm button
  const statusT = scene.add.text(cx, y0 + 304, '', {
    fontSize: '11px', fontFamily: 'monospace', color: '#667788'
  }).setOrigin(0.5, 0);
  const btnBg = scene.add.rectangle(cx, y0 + 328, panelW - 16, 34, 0x0a1410)
    .setInteractive({ useHandCursor: true })
    .setStrokeStyle(2, 0x223322);
  const btnT = scene.add.text(cx, y0 + 328, 'CONFIRM', {
    fontSize: '15px', fontFamily: 'monospace', color: '#2A5535'
  }).setOrigin(0.5);
  btnBg.on('pointerdown', () => { if (!confirmed) _doConfirm(); });

  const confirmText = scene.add.text(cx, y0 + 348, '', {
    fontSize: '10px', fontFamily: 'monospace', color: '#44AA66'
  }).setOrigin(0.5, 0);

  const refresh = () => {
    const pSpent = _passiveSpent(passiveLevels);
    const aSpent = _activeSpent(activeCharges);
    const pLeft  = PASSIVE_BUDGET - pSpent;
    const aLeft  = ACTIVE_BUDGET  - aSpent;

    // Highlight remaining budget prominently when fully unspent
    const pFull = pLeft === PASSIVE_BUDGET;
    const aFull = aLeft === ACTIVE_BUDGET;
    pBudgetT.setText(`P.pts: ${pLeft}/${PASSIVE_BUDGET}`);
    pBudgetT.setColor(pLeft < 0 ? '#FF4444' : pFull ? '#FFDD00' : '#66BBFF');
    aBudgetT.setText(`A.pts: ${aLeft}/${ACTIVE_BUDGET}`);
    aBudgetT.setColor(aLeft < 0 ? '#FF4444' : aFull ? '#FFDD00' : '#FFAA44');

    for (let ri = 0; ri < 7; ri++) {
      const ref = rowRefs[ri];
      const { id, isP } = ref;

      let valStr;
      if (isP) {
        const level = passiveLevels[id];
        valStr = `L${level}`;
        ref.valT.setColor(level > 0 ? '#AAFFCC' : '#888888');
      } else {
        const charges = activeCharges[id];
        valStr = `x${charges}`;
        ref.valT.setColor(charges > 0 ? '#FFCCAA' : '#888888');
      }
      ref.valT.setText(valStr);

      // Draw cursor
      ref.cursorGfx.clear();
      if (ri === cursorRow && !confirmed) {
        const cursorColor = pidx === 0 ? 0xFFDD00 : pidx === 1 ? 0xFFAA44 : 0x44FFCC;
        ref.cursorGfx.lineStyle(2, cursorColor, 0.9);
        ref.cursorGfx.strokeRect(px + 2, rowY[ri] - 9, panelW - 4, 18);
      }
    }

    // Empty loadout warning
    const hasAny = Object.values(passiveLevels).some(v => v > 0) ||
                   Object.values(activeCharges).some(v => v > 0);
    emptyWarnT.setVisible(!hasAny && !confirmed);

    const canConfirm = pLeft >= 0 && aLeft >= 0;
    btnBg.setStrokeStyle(2, canConfirm ? 0x44AA66 : 0x332211);
    btnT.setColor(canConfirm ? '#55EE88' : '#2A5535');
    statusT.setText(confirmed ? 'READY!' : (canConfirm ? 'Press confirm' : 'Over budget!'));
    statusT.setColor(confirmed ? '#44FF88' : (canConfirm ? '#445566' : '#CC4444'));
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

  const _doConfirm = () => {
    if (confirmed) return;
    const pLeft = PASSIVE_BUDGET - _passiveSpent(passiveLevels);
    const aLeft = ACTIVE_BUDGET  - _activeSpent(activeCharges);
    if (pLeft < 0 || aLeft < 0) return;
    confirmed = true;
    confirmText.setText('LOCKED IN');
    btnBg.setFillStyle(0x0e2814);
    // Clear cursor highlight
    for (const ref of rowRefs) ref.cursorGfx.clear();
    refresh();
    onConfirm({
      passives: { ...passiveLevels },
      actives:  { ...activeCharges }
    });
  };

  const _doUnconfirm = () => {
    if (!confirmed) return;
    confirmed = false;
    confirmText.setText('');
    btnBg.setFillStyle(0x0a1410);
    refresh();
  };

  const _moveRow = (dir) => {
    if (confirmed) return;
    cursorRow = Math.max(0, Math.min(6, cursorRow + dir));
    refresh();
  };

  const _stepValue = (dir) => {
    if (dir > 0) _inc(cursorRow);
    else          _dec(cursorRow);
  };

  refresh();

  // Return action functions for external callers (gamepad / update loop)
  return {
    moveRow:    _moveRow,
    stepValue:  _stepValue,
    confirm:    _doConfirm,
    unconfirm:  _doUnconfirm
  };
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
  for (const id of ACTIVE_IDS) {
    spent += BOOST_CONFIG.actives[id].costPerCharge * (activeCharges[id] ?? 0);
  }
  return spent;
}
