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
  const [a, b] = players;
  arrowGfx.clear(); warningText.setText('');
  const bothActive = (a.gs === 'RUNNING' || a.gs === 'REACTIVE') && (b.gs === 'RUNNING' || b.gs === 'REACTIVE');
  if (!bothActive) return;
  const gap = Math.abs(a.trackPosition - b.trackPosition);
  if (gap < GAP_WARNING_SCALED) return;
  const trailer = a.trackPosition < b.trackPosition ? a : b;
  const ax = playerObjs[trailer.idx].x + playerObjs[trailer.idx].visualOffsetX;
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 150);
  arrowGfx.fillStyle(0xFF9900, pulse);
  const ay = canvasH - 6;
  arrowGfx.fillTriangle(ax, ay, ax - 11, ay - 18, ax + 11, ay - 18);
  warningText.setPosition(ax, ay - 20);
  warningText.setText(`-${Math.round(gap / POSITION_SCALE)}`);
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
  const camScaled = state.mode === '2p' ? state.camPositionScaled : state.players[0].trackPosition;
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
