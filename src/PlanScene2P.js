/**
 * Two-player side-by-side picker panels for PlanScene.
 * Call buildTwoPlayerPickers(scene, data) from PlanScene.create() when mode === '2p'.
 *
 * data = {
 *   onBothReady: (selectedP1Set, selectedP2Set) => void,
 *   progressP1, progressP2   // loaded progress objects
 * }
 *
 * P1 uses keys 1–6 to toggle (or click).
 * P2 uses LEFT/RIGHT to move cursor through 6 cards, then 8/9/0 to toggle the highlighted card.
 * START RUN is only enabled when both have exactly 3 selected.
 */

import { BOOSTS, BOOST_ORDER, BOOST_UNLOCK_LEVEL } from './boosts.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;

// ── Panel geometry ─────────────────────────────────────────────────────────
// Two panels fit between x=20 and x=1260, each ~600px wide.
const P1_PANEL_X0  = 20;   // left edge of P1 panel
const P2_PANEL_X0  = 650;  // left edge of P2 panel
const PANEL_W      = 610;
const PANEL_TOP    = 310;  // panels start below the compact map

const CARD_W   = 175;
const CARD_H   = 88;
const CARD_GX  = 14;
const CARD_GY  = 18;

// 3 cards per row, 2 rows
function cardX(panelX0, col) {
  return panelX0 + 20 + col * (CARD_W + CARD_GX) + CARD_W / 2;
}
function cardY(row) {
  return PANEL_TOP + 36 + row * (CARD_H + CARD_GY) + CARD_H / 2;
}

export function buildTwoPlayerPickers(scene, data) {
  const { onBothReady, progressP1, progressP2 } = data;

  const selectedP1  = new Set();
  const selectedP2  = new Set();
  let   p2Cursor    = 0;   // 0–5 index into BOOST_ORDER

  // ── Panel headers ────────────────────────────────────────────────────────
  scene.add.text(P1_PANEL_X0 + PANEL_W / 2, PANEL_TOP - 22, 'P1 LOADOUT', {
    fontSize: '15px', fontFamily: 'monospace', color: '#AABBCC'
  }).setOrigin(0.5, 1);

  scene.add.text(P1_PANEL_X0 + PANEL_W / 2, PANEL_TOP - 6, 'Keys 1–6 or click', {
    fontSize: '11px', fontFamily: 'monospace', color: '#334455'
  }).setOrigin(0.5, 1);

  scene.add.text(P2_PANEL_X0 + PANEL_W / 2, PANEL_TOP - 22, 'P2 LOADOUT', {
    fontSize: '15px', fontFamily: 'monospace', color: '#E8A33D'
  }).setOrigin(0.5, 1);

  scene.add.text(P2_PANEL_X0 + PANEL_W / 2, PANEL_TOP - 6, '← → to move  ·  8/9/0 to toggle', {
    fontSize: '11px', fontFamily: 'monospace', color: '#554422'
  }).setOrigin(0.5, 1);

  // ── Build card refs for both panels ─────────────────────────────────────
  const p1Cards = {};
  const p2Cards = {};

  function buildCard(panelX0, id, idx, progress, selected, cards, playerLabel) {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx  = cardX(panelX0, col);
    const cy  = cardY(row);

    const boost    = BOOSTS[id];
    const isPass   = boost.type === 'passive';
    const reqLevel = BOOST_UNLOCK_LEVEL[id];
    const locked   = progress.level < reqLevel;

    const fillColor = locked ? 0x0e0e12 : (isPass ? 0x162030 : 0x1a1418);
    const edgeColor = locked ? 0x222228 : (isPass ? 0x2a4060 : 0x3a2828);

    const bg = scene.add.rectangle(cx, cy, CARD_W, CARD_H, fillColor)
      .setStrokeStyle(2, edgeColor);

    if (!locked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        toggleCard(id, selected, cards, playerLabel);
      });
    }

    scene.add.text(cx - CARD_W / 2 + 8, cy - CARD_H / 2 + 7, `${idx + 1}`, {
      fontSize: '10px', fontFamily: 'monospace',
      color: locked ? '#333338' : '#334455'
    });

    const typeLabel = isPass ? '● passive' : '◆ active';
    const typeColor = locked ? '#2a2a30' : (isPass ? '#3366AA' : '#885533');
    scene.add.text(cx, cy - 24, typeLabel, {
      fontSize: '10px', fontFamily: 'monospace', color: typeColor
    }).setOrigin(0.5);

    const nameColor = locked ? '#333340' : '#DDEEFF';
    const nameT = scene.add.text(cx, cy - 6, boost.name, {
      fontSize: '15px', fontFamily: 'monospace', color: nameColor
    }).setOrigin(0.5);

    const descText  = locked ? `Level ${reqLevel}` : boost.desc;
    const descColor = locked ? '#282832' : '#445566';
    const descT = scene.add.text(cx, cy + 18, descText, {
      fontSize: '11px', fontFamily: 'monospace', color: descColor
    }).setOrigin(0.5);

    cards[id] = { bg, nameT, descT, fillColor, edgeColor, locked };
  }

  BOOST_ORDER.forEach((id, idx) => {
    buildCard(P1_PANEL_X0, id, idx, progressP1, selectedP1, p1Cards, 'p1');
    buildCard(P2_PANEL_X0, id, idx, progressP2, selectedP2, p2Cards, 'p2');
  });

  // ── P2 cursor highlight ──────────────────────────────────────────────────
  const cursorGfx = scene.add.graphics().setDepth(5);

  function drawCursor() {
    cursorGfx.clear();
    const id  = BOOST_ORDER[p2Cursor];
    const col = p2Cursor % 3;
    const row = Math.floor(p2Cursor / 3);
    const cx  = cardX(P2_PANEL_X0, col);
    const cy  = cardY(row);
    cursorGfx.lineStyle(3, 0xFFDD00, 0.85);
    cursorGfx.strokeRect(cx - CARD_W / 2 - 3, cy - CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6);
  }

  drawCursor();

  // ── Counter and start button ─────────────────────────────────────────────
  const countY = PANEL_TOP + 2 * (CARD_H + CARD_GY) + 52;
  const p1CountT = scene.add.text(P1_PANEL_X0 + PANEL_W / 2, countY, 'Selected: 0 / 3', {
    fontSize: '14px', fontFamily: 'monospace', color: '#667788'
  }).setOrigin(0.5, 0);
  const p2CountT = scene.add.text(P2_PANEL_X0 + PANEL_W / 2, countY, 'Selected: 0 / 3', {
    fontSize: '14px', fontFamily: 'monospace', color: '#667788'
  }).setOrigin(0.5, 0);

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

  startBg.on('pointerover', () => { if (bothReady()) startBg.setFillStyle(0x163020); });
  startBg.on('pointerout',  () => { if (bothReady()) startBg.setFillStyle(0x0e2214); });
  startBg.on('pointerdown', () => { if (bothReady()) onBothReady(selectedP1, selectedP2); });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function bothReady() {
    return selectedP1.size === 3 && selectedP2.size === 3;
  }

  function refreshCards(selected, cards) {
    for (const [id, c] of Object.entries(cards)) {
      if (c.locked) continue;
      if (selected.has(id)) {
        c.bg.setFillStyle(0x1a3520);
        c.bg.setStrokeStyle(2, 0x44BB66);
        c.nameT.setColor('#88FFAA');
        c.descT.setColor('#557766');
      } else {
        c.bg.setFillStyle(c.fillColor);
        c.bg.setStrokeStyle(2, c.edgeColor);
        c.nameT.setColor('#DDEEFF');
        c.descT.setColor('#445566');
      }
    }
    // Re-draw P2 cursor on top
    drawCursor();
  }

  function refreshStart() {
    const ready = bothReady();
    p1CountT.setText(`P1: ${selectedP1.size} / 3`);
    p1CountT.setColor(selectedP1.size === 3 ? '#66BB88' : '#667788');
    p2CountT.setText(`P2: ${selectedP2.size} / 3`);
    p2CountT.setColor(selectedP2.size === 3 ? '#FFCC44' : '#667788');
    startBg.setFillStyle(ready ? 0x0e2214 : 0x0a1410);
    startBg.setStrokeStyle(2, ready ? 0x44AA66 : 0x223322);
    startT.setColor(ready ? '#55EE88' : '#2A5535');
  }

  function toggleCard(id, selected, cards, playerLabel) {
    if (cards[id].locked) return;
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      if (selected.size >= 3) return;
      selected.add(id);
    }
    refreshCards(selected, cards);
    refreshStart();
  }

  // ── Keyboard input ───────────────────────────────────────────────────────

  scene.input.keyboard.on('keydown', e => {
    const n = parseInt(e.key, 10);
    // P1: 1–6 toggles
    if (n >= 1 && n <= 6) {
      toggleCard(BOOST_ORDER[n - 1], selectedP1, p1Cards, 'p1');
    }
    // P2: cursor navigation
    if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
      p2Cursor = Math.max(0, p2Cursor - 1);
      drawCursor();
    }
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      p2Cursor = Math.min(5, p2Cursor + 1);
      drawCursor();
    }
    // P2: 8/9/0 toggle highlighted card
    if (e.key === '8') toggleCard(BOOST_ORDER[p2Cursor],     selectedP2, p2Cards, 'p2');
    if (e.key === '9') toggleCard(BOOST_ORDER[p2Cursor],     selectedP2, p2Cards, 'p2');
    if (e.key === '0') toggleCard(BOOST_ORDER[p2Cursor],     selectedP2, p2Cards, 'p2');
    // Start
    if (e.key === 'Enter') { if (bothReady()) onBothReady(selectedP1, selectedP2); }
  });

  // Initialise display
  refreshStart();
}
