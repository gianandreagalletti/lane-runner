import { BOOSTS } from './boosts.js';
import { CANVAS_W, CANVAS_H, LANE_CENTERS } from './track.js';
import { GAP_WARNING_SCALED, POSITION_SCALE } from '../sim/rules.js';

const ARMED_STROKE          = 0xFFDD00;
const UNARMED_STROKE_REACT  = 0x554422;
const P2_COLOR_HEX          = '#E8A33D';

export function buildHud1P(scene, slots) {
  const spacing = 226, startX = CANVAS_W / 2 - spacing;
  const chipRefs = [];
  slots.forEach((slot, i) => {
    const x = startX + i * spacing;
    const boost = BOOSTS[slot.id];
    const isP   = !slot.isActive;
    const chip  = scene.add.rectangle(x, 22, 210, 30, isP ? 0x142a1e : 0x201610)
      .setStrokeStyle(1, isP ? 0x338844 : 0x554422);
    scene.add.text(x - 78, 22, `[${i + 1}]`, { fontSize: '11px', fontFamily: 'monospace', color: '#556677' }).setOrigin(0, 0.5);
    const nameT = scene.add.text(x - 58, 22, boost.name, {
      fontSize: '13px', fontFamily: 'monospace', color: isP ? '#AAFFCC' : '#FFCC88'
    }).setOrigin(0, 0.5);
    let usesT = null;
    if (slot.isActive) {
      usesT = scene.add.text(x + 76, 22, _usesLabel(slot), {
        fontSize: '13px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2
      }).setOrigin(1, 0.5);
    } else {
      scene.add.text(x + 76, 22, 'ON', { fontSize: '12px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0.5);
    }
    chipRefs.push({ chip, nameT, usesT });
  });
  const distText  = scene.add.text(20, 14, '', { fontSize: '20px', fontFamily: 'monospace', color: '#DDDDDD', stroke: '#000', strokeThickness: 3 });
  const speedText = scene.add.text(CANVAS_W - 20, 14, '', { fontSize: '20px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0);
  const sprintText= scene.add.text(CANVAS_W / 2, 50, '', { fontSize: '14px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
  return { chipRefs, distText, speedText, sprintText };
}

export function buildHud2P(scene, slots0, slots1) {
  const chipSpacing = 110, chipW = 100, chipH = 26;
  const huds = [null, null];
  [0, 1].forEach(pidx => {
    const slots  = pidx === 0 ? slots0 : slots1;
    const isP2   = pidx === 1;
    const chip0X = isP2 ? (CANVAS_W - 55 - 2 * chipSpacing) : 55;
    const chipRefs = [];
    slots.forEach((slot, i) => {
      const cx    = chip0X + i * chipSpacing;
      const boost = BOOSTS[slot.id];
      const isPassive = !slot.isActive;
      const chip  = scene.add.rectangle(cx, 38, chipW, chipH, isPassive ? 0x142a1e : 0x201610)
        .setStrokeStyle(1, isPassive ? 0x338844 : 0x554422);
      const nameT = scene.add.text(cx, 38, boost.name, {
        fontSize: '10px', fontFamily: 'monospace', color: isPassive ? '#AAFFCC' : '#FFCC88'
      }).setOrigin(0.5, 0.5);
      let usesT = null;
      if (slot.isActive) {
        usesT = scene.add.text(cx + 44, 38, _usesLabel(slot), {
          fontSize: '10px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0.5);
      }
      chipRefs.push({ chip, nameT, usesT });
    });
    let distT, debuffT, sprintT;
    if (!isP2) {
      scene.add.text(10, 14, 'P1', { fontSize: '14px', fontFamily: 'monospace', color: '#FFFFFF', stroke: '#000', strokeThickness: 2 });
      distT   = scene.add.text(38, 14, '',   { fontSize: '14px', fontFamily: 'monospace', color: '#DDDDDD', stroke: '#000', strokeThickness: 2 });
      debuffT = scene.add.text(220, 14, '',  { fontSize: '12px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000', strokeThickness: 2 });
      sprintT = scene.add.text(165, 56, '',  { fontSize: '11px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
    } else {
      scene.add.text(CANVAS_W - 10, 14, 'P2', { fontSize: '14px', fontFamily: 'monospace', color: P2_COLOR_HEX, stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0);
      distT   = scene.add.text(CANVAS_W - 38, 14,  '', { fontSize: '14px', fontFamily: 'monospace', color: '#DDB870', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0);
      debuffT = scene.add.text(CANVAS_W - 220, 14, '', { fontSize: '12px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000', strokeThickness: 2 }).setOrigin(1, 0);
      sprintT = scene.add.text(CANVAS_W - 165, 56, '', { fontSize: '11px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
    }
    huds[pidx] = { chipRefs, distT, debuffT, sprintT };
  });
  const gapText = scene.add.text(CANVAS_W / 2, 14, '', { fontSize: '13px', fontFamily: 'monospace', color: '#556677', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
  return { huds, gapText };
}

export function updateHud1P(refs, state) {
  const ps = state.players[0];
  refs.distText.setText(`${Math.floor(ps.trackPosition / POSITION_SCALE)} / ${Math.floor(state.trackLength / POSITION_SCALE)}`);
  const debuff = ps.debuffType ? `SLOWED ${_speedPct(ps)}%` : '';
  refs.speedText.setText(debuff);
  refs.sprintText.setText(ps.sprintTicksLeft > 0 ? `SPRINT ${(ps.sprintTicksLeft / 60).toFixed(1)}s` : '');
  ps.slots.forEach((slot, i) => {
    const ref = refs.chipRefs[i];
    if (!ref.usesT) return;
    ref.usesT.setText(_usesLabel(slot));
    ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
    ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
    if (slot.isReactive) {
      const armed = ps.boostKeyHeld[i] && slot.uses > 0;
      ref.chip.setStrokeStyle(armed ? 2 : 1, armed ? ARMED_STROKE : UNARMED_STROKE_REACT, armed ? 1 : undefined);
    }
  });
}

export function updateHud2P(refs, state) {
  for (let pidx = 0; pidx < 2; pidx++) {
    const ps  = state.players[pidx];
    const hud = refs.huds[pidx];
    hud.distT.setText(`${Math.floor(ps.trackPosition / POSITION_SCALE)} / ${Math.floor(state.trackLength / POSITION_SCALE)}`);
    hud.debuffT.setText(ps.debuffType ? `SLOWED ${_speedPct(ps)}%` : '');
    hud.sprintT.setText(ps.sprintTicksLeft > 0 ? `SPRINT ${(ps.sprintTicksLeft / 60).toFixed(1)}s` : '');
    ps.slots.forEach((slot, i) => {
      const ref = hud.chipRefs[i];
      if (!ref.usesT) return;
      ref.usesT.setText(_usesLabel(slot));
      ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
      ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
      if (slot.isReactive) {
        const armed = ps.boostKeyHeld[i] && slot.uses > 0;
        ref.chip.setStrokeStyle(armed ? 2 : 1, armed ? ARMED_STROKE : UNARMED_STROKE_REACT, armed ? 1 : undefined);
      }
    });
  }
  const gap = Math.abs(state.players[0].trackPosition - state.players[1].trackPosition);
  refs.gapText.setText(`GAP  ${Math.round(gap / POSITION_SCALE)}`);
  refs.gapText.setColor(gap >= GAP_WARNING_SCALED ? '#FF9900' : '#445566');
}

function _usesLabel(slot) { return slot.uses > 0 ? `×${slot.uses}` : 'SPENT'; }
function _speedPct(ps) {
  const s = ps.sprintTicksLeft > 0 ? 140 : ps.debuffType === 'ice' ? 50 : ps.debuffType === 'water' ? 30 : 100;
  return Math.round(s);
}
