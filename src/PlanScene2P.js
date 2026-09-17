/**
 * Multi-player side-by-side picker panels for PlanScene.
 * Call buildTwoPlayerPickers(scene, data) from PlanScene.create() when mode !== '1p'.
 *
 * data = {
 *   onBothReady: (selectedP1Set, selectedP2Set, selectedP3Set?) => void,
 *   progressP1, progressP2, progressP3?,
 *   mode: '2p'|'3p'
 * }
 *
 * P1 uses keys 1–6 to toggle (or click).
 * P2 uses ←/→ to move cursor, then 8/9/0 to toggle.
 * P3 (3P only) uses Q/E to move cursor, then I/O/P to toggle.
 * START RUN enabled when all active players have exactly 3 selected.
 */

import { BOOSTS, BOOST_ORDER, BOOST_UNLOCK_LEVEL } from './boosts.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const PANEL_TOP = 310;

// Geometry depends on number of players
function getPanelLayout(n) {
  if (n === 3) {
    // 3 panels: each ~400px wide
    return [
      { x0: 10,  w: 400 },
      { x0: 440, w: 400 },
      { x0: 870, w: 400 }
    ];
  }
  // 2 panels: each ~610px wide
  return [
    { x0: 20,  w: 610 },
    { x0: 650, w: 610 }
  ];
}

const CARD_W_2P = 175, CARD_H = 88, CARD_GX_2P = 14;
const CARD_W_3P = 110, CARD_GX_3P = 8;
const CARD_GY   = 18;

function cardX(panelX0, col, cardW, cardGx) {
  return panelX0 + 20 + col * (cardW + cardGx) + cardW / 2;
}
function cardY(row) {
  return PANEL_TOP + 36 + row * (CARD_H + CARD_GY) + CARD_H / 2;
}

export function buildTwoPlayerPickers(scene, data) {
  const { onBothReady, progressP1, progressP2, progressP3, mode } = data;
  const is3P = mode === '3p';
  const n = is3P ? 3 : 2;
  const panels = getPanelLayout(n);
  const cardW  = is3P ? CARD_W_3P : CARD_W_2P;
  const cardGx = is3P ? CARD_GX_3P : CARD_GX_2P;
  const progresses = [progressP1, progressP2, progressP3];
  const playerColors = ['#AABBCC', '#E8A33D', '#4FD1C5'];
  const playerLabels = ['P1 LOADOUT', 'P2 LOADOUT', 'P3 LOADOUT'];
  const navHints  = [
    'Keys 1–6 or click',
    '← → to move  ·  8/9/0 to toggle',
    'Q/E to move  ·  I/O/P to toggle'
  ];

  const selectedSets = [new Set(), new Set(), new Set()];
  const cursors = [0, 0, 0]; // cursor index per player (P2+)
  const cardSets = [{}, {}, {}];

  // ── Panel headers
  for (let pidx = 0; pidx < n; pidx++) {
    const panel = panels[pidx];
    const cx = panel.x0 + panel.w / 2;
    scene.add.text(cx, PANEL_TOP - 22, playerLabels[pidx], {
      fontSize: is3P ? '13px' : '15px', fontFamily: 'monospace', color: playerColors[pidx]
    }).setOrigin(0.5, 1);
    scene.add.text(cx, PANEL_TOP - 6, navHints[pidx], {
      fontSize: '11px', fontFamily: 'monospace', color: pidx === 0 ? '#334455' : '#554422'
    }).setOrigin(0.5, 1);
  }

  // ── Build card refs for each panel
  function buildCard(panelX0, id, idx, progress, pidx) {
    const col = idx % 3, row = Math.floor(idx / 3);
    const cx  = cardX(panelX0, col, cardW, cardGx);
    const cy  = cardY(row);
    const boost = BOOSTS[id];
    const isPass = boost.type === 'passive';
    const reqLevel = BOOST_UNLOCK_LEVEL[id];
    const locked = progress.level < reqLevel;
    const fillColor = locked ? 0x0e0e12 : (isPass ? 0x162030 : 0x1a1418);
    const edgeColor = locked ? 0x222228 : (isPass ? 0x2a4060 : 0x3a2828);
    const bg = scene.add.rectangle(cx, cy, cardW, CARD_H, fillColor).setStrokeStyle(2, edgeColor);
    if (!locked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => toggleCard(id, pidx));
    }
    scene.add.text(cx - cardW / 2 + 6, cy - CARD_H / 2 + 7, `${idx + 1}`, {
      fontSize: '10px', fontFamily: 'monospace', color: locked ? '#333338' : '#334455'
    });
    scene.add.text(cx, cy - 24, isPass ? '● p' : '◆ a', {
      fontSize: '10px', fontFamily: 'monospace',
      color: locked ? '#2a2a30' : (isPass ? '#3366AA' : '#885533')
    }).setOrigin(0.5);
    const nameColor = locked ? '#333340' : '#DDEEFF';
    const nameT = scene.add.text(cx, cy - 6, boost.name, {
      fontSize: is3P ? '11px' : '15px', fontFamily: 'monospace', color: nameColor
    }).setOrigin(0.5);
    const descText  = locked ? `Lv${reqLevel}` : (is3P ? boost.name : boost.desc);
    const descColor = locked ? '#282832' : '#445566';
    const descT = scene.add.text(cx, cy + 18, locked ? descText : (is3P ? '' : boost.desc), {
      fontSize: '10px', fontFamily: 'monospace', color: descColor
    }).setOrigin(0.5);
    cardSets[pidx][id] = { bg, nameT, descT, fillColor, edgeColor, locked };
  }

  for (let pidx = 0; pidx < n; pidx++) {
    BOOST_ORDER.forEach((id, idx) => buildCard(panels[pidx].x0, id, idx, progresses[pidx], pidx));
  }

  // ── Cursor graphics for P2 and P3
  const cursorGfxList = [];
  for (let pidx = 1; pidx < n; pidx++) {
    const cgfx = scene.add.graphics().setDepth(5);
    cursorGfxList.push({ gfx: cgfx, pidx });
  }

  function drawCursors() {
    for (const { gfx, pidx } of cursorGfxList) {
      gfx.clear();
      const curIdx = cursors[pidx];
      const col = curIdx % 3, row = Math.floor(curIdx / 3);
      const cx = cardX(panels[pidx].x0, col, cardW, cardGx);
      const cy = cardY(row);
      gfx.lineStyle(3, pidx === 1 ? 0xFFDD00 : 0x00FFCC, 0.85);
      gfx.strokeRect(cx - cardW / 2 - 3, cy - CARD_H / 2 - 3, cardW + 6, CARD_H + 6);
    }
  }
  drawCursors();

  // ── Counter and start button
  const countY = PANEL_TOP + 2 * (CARD_H + CARD_GY) + 52;
  const countTexts = [];
  for (let pidx = 0; pidx < n; pidx++) {
    const cx = panels[pidx].x0 + panels[pidx].w / 2;
    const ct = scene.add.text(cx, countY, 'Selected: 0 / 3', {
      fontSize: '14px', fontFamily: 'monospace', color: '#667788'
    }).setOrigin(0.5, 0);
    countTexts.push(ct);
  }

  const btnY  = countY + 50;
  const btnCX = CANVAS_W / 2;
  const startBg = scene.add.rectangle(btnCX, btnY, 280, 52, 0x0a1410)
    .setInteractive({ useHandCursor: true })
    .setStrokeStyle(2, 0x223322);
  const startT  = scene.add.text(btnCX, btnY, 'START RUN', {
    fontSize: '22px', fontFamily: 'monospace', color: '#2A5535'
  }).setOrigin(0.5);
  scene.add.text(btnCX, btnY + 38, 'ENTER = start  ·  ESC = back', {
    fontSize: '11px', fontFamily: 'monospace', color: '#1e2e38'
  }).setOrigin(0.5, 0);

  startBg.on('pointerover', () => { if (allReady()) startBg.setFillStyle(0x163020); });
  startBg.on('pointerout',  () => { if (allReady()) startBg.setFillStyle(0x0e2214); });
  startBg.on('pointerdown', () => { if (allReady()) _doStart(); });

  // ── Helpers
  function allReady() {
    for (let i = 0; i < n; i++) if (selectedSets[i].size !== 3) return false;
    return true;
  }

  function refreshCards(pidx) {
    const selected = selectedSets[pidx];
    const cards = cardSets[pidx];
    for (const [id, c] of Object.entries(cards)) {
      if (c.locked) continue;
      if (selected.has(id)) {
        c.bg.setFillStyle(0x1a3520); c.bg.setStrokeStyle(2, 0x44BB66);
        c.nameT.setColor('#88FFAA'); c.descT.setColor('#557766');
      } else {
        c.bg.setFillStyle(c.fillColor); c.bg.setStrokeStyle(2, c.edgeColor);
        c.nameT.setColor('#DDEEFF'); c.descT.setColor('#445566');
      }
    }
    drawCursors();
  }

  function refreshStart() {
    const labels = ['P1', 'P2', 'P3'];
    const colors = ['#66BB88', '#FFCC44', '#44FFCC'];
    for (let i = 0; i < n; i++) {
      countTexts[i].setText(`${labels[i]}: ${selectedSets[i].size} / 3`);
      countTexts[i].setColor(selectedSets[i].size === 3 ? colors[i] : '#667788');
    }
    const ready = allReady();
    startBg.setFillStyle(ready ? 0x0e2214 : 0x0a1410);
    startBg.setStrokeStyle(2, ready ? 0x44AA66 : 0x223322);
    startT.setColor(ready ? '#55EE88' : '#2A5535');
  }

  function toggleCard(id, pidx) {
    if (cardSets[pidx][id].locked) return;
    const selected = selectedSets[pidx];
    if (selected.has(id)) selected.delete(id);
    else { if (selected.size >= 3) return; selected.add(id); }
    refreshCards(pidx);
    refreshStart();
  }

  function _doStart() {
    onBothReady(selectedSets[0], selectedSets[1], selectedSets[2]);
  }

  // ── Keyboard input
  scene.input.keyboard.on('keydown', e => {
    const n2 = parseInt(e.key, 10);
    if (n2 >= 1 && n2 <= 6) toggleCard(BOOST_ORDER[n2 - 1], 0);
    // P2 nav
    if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') { cursors[1] = Math.max(0, cursors[1] - 1); drawCursors(); }
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') { cursors[1] = Math.min(5, cursors[1] + 1); drawCursors(); }
    if (e.key === '8') toggleCard(BOOST_ORDER[cursors[1]], 1);
    if (e.key === '9') toggleCard(BOOST_ORDER[cursors[1]], 1);
    if (e.key === '0') toggleCard(BOOST_ORDER[cursors[1]], 1);
    // P3 nav (3P only)
    if (is3P) {
      if (e.code === 'KeyQ') { cursors[2] = Math.max(0, cursors[2] - 1); drawCursors(); }
      if (e.code === 'KeyE') { cursors[2] = Math.min(5, cursors[2] + 1); drawCursors(); }
      if (e.code === 'KeyI' || e.code === 'KeyO' || e.code === 'KeyP') {
        toggleCard(BOOST_ORDER[cursors[2]], 2);
      }
    }
    if (e.key === 'Enter') { if (allReady()) _doStart(); }
  });

  refreshStart();
}
