// Render helpers for RunScene. Extracted to keep RunScene.js under 300 lines.
import { CANVAS_W, CANVAS_H, LANE_CENTERS, PLAYER_Y } from './track.js';
import { POSITION_SCALE, GAP_WARNING_SCALED } from '../sim/rules.js';
import { rockBreakEffect, phaseEffect } from './effects.js';

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
  const reactSlots = ps.slots.map((s, i) => ({ ...s, idx: i })).filter(s => s.isReactive && s.uses > 0);
  const hints = reactSlots.map(s => `[${s.idx + 1}] ${s.id}`).join('  ');
  text.setText(hints ? `REACT!\n${hints}` : 'NO BOOST');
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
    const gap = (leader - ps.trackPosition) / POSITION_SCALE;
    if (gap < 300) return; // GAP_WARNING display threshold
    const ax = playerObjs[ps.idx].x + playerObjs[ps.idx].visualOffsetX;
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
    const vx  = playerObjs[i].x + playerObjs[i].visualOffsetX;
    const vy  = playerObjs[i].y;
    lbl.setPosition(vx, vy - 24);
    const terminal = !['RUNNING','REACTIVE'].includes(ps.gs);
    lbl.setText(terminal ? (ps.gs === 'COMPLETE' ? `P${i+1} ✓` : `P${i+1} OUT`) : `P${i+1}`);
  });
}

export function handleSimEvents(scene, state, playerObjs) {
  const camScaled = state.mode !== '1p' ? state.camPositionScaled : state.players[0].trackPosition;
  for (const ev of state.events) {
    const obsScreenY = PLAYER_Y + (camScaled - ev.obsDistScaled) / POSITION_SCALE;
    const obsX = LANE_CENTERS[ev.obsLane];
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
