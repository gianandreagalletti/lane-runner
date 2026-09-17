// Render helpers for RunScene. Extracted to keep RunScene.js under 300 lines.
import { CANVAS_W, CANVAS_H, LANE_CENTERS } from './track.js';
import { CENTI_SCALE, GAP_WARNING_CU } from '../sim/rules.js';
import { rockBreakEffect, phaseEffect } from './effects.js';
import { PROJ, LANE_TU, project } from './render/projection.js';

export function renderReactiveOverlay1P(overlay, text, state) {
  const ps = state.players[0];
  if (ps.gs !== 'REACTIVE') {
    overlay.clear();
    text.setText('');
    return;
  }
  const frac = Math.max(0, ps.reactiveTicksLeft / 27);
  overlay.clear();
  overlay.fillStyle(0xFF2200, 0.15 + 0.3 * frac * (0.6 + 0.4 * Math.sin(Date.now() / 35)));
  overlay.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Only slot 0 (rock_break) is offered — phase does NOT work in reactive window
  const rbSlot = ps.slots[0];
  const canUse = rbSlot && rbSlot.id === 'rock_break' && rbSlot.uses > 0;
  text.setText(canUse ? 'REACT!\n[1] Rock Break' : 'NO BOOST');
}

export function renderWarningArrow(arrowGfx, warningText, players, playerObjs, canvasH) {
  // Legacy 2P singular version — kept for any external callers
  const texts = Array.isArray(warningText) ? warningText : [warningText, warningText];
  renderWarningArrows(arrowGfx, texts, { players, mode: '2p' }, playerObjs, canvasH);
}

export function renderWarningArrows(arrowGfx, warningTexts, state, playerObjs, canvasH) {
  arrowGfx.clear();
  warningTexts.forEach(t => t.setText(''));
  const active = state.players.filter(ps => ps.gs === 'RUNNING' || ps.gs === 'REACTIVE');
  if (active.length < 2) return;
  const leader = Math.max(...active.map(ps => ps.trackPosition));
  active.forEach(ps => {
    const gap = (leader - ps.trackPosition) / CENTI_SCALE;
    if (gap < 450) return; // GAP_WARNING display threshold (450 display units)

    // Use projected screen x from the player object (updated by player.render())
    const ax = playerObjs[ps.idx].x;
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 150);
    arrowGfx.fillStyle(0xFF9900, pulse);
    const ay = canvasH - 6;
    arrowGfx.fillTriangle(ax, ay, ax - 11, ay - 18, ax + 11, ay - 18);
    if (warningTexts[ps.idx]) {
      warningTexts[ps.idx].setPosition(ax, ay - 20);
      warningTexts[ps.idx].setText(`-${Math.round(gap)}`);
    }
  });
}

export function updatePlayerLabels(labels, players, playerObjs) {
  players.forEach((ps, i) => {
    const lbl = labels[i];
    const vx  = playerObjs[i].x;
    const vy  = playerObjs[i].y;
    // Clamp label size based on screen scale
    const scaledSize = Math.max(8, Math.min(15, Math.round(12 * (playerObjs[i].screenScale || 1))));
    lbl.setFontSize(`${scaledSize}px`);
    lbl.setPosition(vx, vy - 6);
    const terminal = !['RUNNING','REACTIVE'].includes(ps.gs);
    lbl.setText(terminal ? (ps.gs === 'COMPLETE' ? `P${i+1} ✓` : `P${i+1} OUT`) : `P${i+1}`);
  });
}

export function handleSimEvents(scene, state, playerObjs) {
  // Derive cameraZ the same way _render() does
  const positions = state.players
    .filter(ps => ps.gs === 'RUNNING' || ps.gs === 'REACTIVE')
    .map(ps => ps.trackPosition / CENTI_SCALE);
  const minZ = positions.length > 0 ? Math.min(...positions) : 0;
  const maxZ = positions.length > 0 ? Math.max(...positions) : 0;
  const cameraZ = Math.min(
    minZ - PROJ.CAM_BACK,
    maxZ - PROJ.CAM_BACK - PROJ.MIN_LEAD_MARGIN
  );

  for (const ev of state.events) {
    const obsZRel  = ev.obsDistScaled / CENTI_SCALE - cameraZ;
    const obsWorldX = LANE_TU[ev.obsLane];
    const { x: obsX, y: obsScreenY } = project(obsWorldX, Math.max(obsZRel, PROJ.NEAR_CLAMP + 1));

    if (ev.type === 'rock_break') {
      rockBreakEffect(scene, { screenY: obsScreenY }, obsX);
    } else if (ev.type === 'phase') {
      phaseEffect(scene, playerObjs[ev.playerIdx], { screenY: obsScreenY }, obsX);
    } else if (ev.type === 'death_shake') {
      scene.cameras.main.shake(110, 0.022);
    } else if (ev.type === 'left_behind') {
      scene.cameras.main.shake(60, 0.015);
    }
  }
}
