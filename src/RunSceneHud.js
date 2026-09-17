import { BOOSTS } from './boosts.js';
import { CANVAS_W, CANVAS_H, LANE_CENTERS } from './track.js';
import { GAP_WARNING_SCALED, POSITION_SCALE } from '../sim/rules.js';
import { PLAYER_COLOR_HEX } from './controls.js';

const ARMED_STROKE          = 0xFFDD00;
const UNARMED_STROKE_REACT  = 0x554422;

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

// buildHudMP — works for 2 or 3 players
export function buildHudMP(scene, allSlots) {
  const n = allSlots.length;
  const chipSpacing = 110, chipW = 100, chipH = 26;
  const huds = [];

  const positions = n === 2
    ? [{ x: 55, anchor: 0 }, { x: CANVAS_W - 55, anchor: 1 }]
    : [{ x: 55, anchor: 0 }, { x: CANVAS_W - 55, anchor: 1 }, { x: CANVAS_W / 2, anchor: 0.5 }];

  allSlots.forEach((slots, pidx) => {
    const pos    = positions[pidx];
    const isRight = pos.anchor === 1;
    const chipRef0X = isRight
      ? (CANVAS_W - 55 - 2 * chipSpacing)
      : pos.anchor === 0.5 ? (CANVAS_W / 2 - chipSpacing) : 55;

    const chipRefs = [];
    const chipY = pidx === 2 ? 68 : 38;
    slots.forEach((slot, i) => {
      const cx = chipRef0X + i * chipSpacing;
      const boost = BOOSTS[slot.id];
      const isPassive = !slot.isActive;
      const chip = scene.add.rectangle(cx, chipY, chipW, chipH,
        isPassive ? 0x142a1e : 0x201610).setStrokeStyle(1, isPassive ? 0x338844 : 0x554422);
      const nameT = scene.add.text(cx, chipY, boost.name, {
        fontSize: '10px', fontFamily: 'monospace', color: isPassive ? '#AAFFCC' : '#FFCC88'
      }).setOrigin(0.5, 0.5);
      let usesT = null;
      if (slot.isActive) {
        usesT = scene.add.text(cx + 44, chipY, _usesLabel(slot), {
          fontSize: '10px', fontFamily: 'monospace', color: '#55FF88', stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0.5);
      }
      chipRefs.push({ chip, nameT, usesT });
    });

    const col   = PLAYER_COLOR_HEX[pidx] || '#FFFFFF';
    const yBase = pidx === 2 ? 54 : 14;
    scene.add.text(isRight ? CANVAS_W - 10 : 10, yBase, `P${pidx + 1}`, {
      fontSize: '14px', fontFamily: 'monospace', color: col, stroke: '#000', strokeThickness: 2
    }).setOrigin(isRight ? 1 : 0, 0);

    const distColors = ['#DDDDDD', '#DDB870', '#9FE8E2'];
    const distT   = scene.add.text(isRight ? CANVAS_W - 38 : 38, yBase, '', {
      fontSize: '14px', fontFamily: 'monospace',
      color: distColors[pidx] || '#DDDDDD',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(isRight ? 1 : 0, 0);
    const debuffT = scene.add.text(isRight ? CANVAS_W - 220 : 220, yBase, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000', strokeThickness: 2
    }).setOrigin(isRight ? 1 : 0, 0);
    const sprintT = scene.add.text(isRight ? CANVAS_W - 165 : 165, yBase + 42, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
    huds.push({ chipRefs, distT, debuffT, sprintT });
  });

  const gapText = scene.add.text(CANVAS_W / 2, 14, '', {
    fontSize: '13px', fontFamily: 'monospace', color: '#556677', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5, 0);
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

export function updateHudMP(refs, state) {
  for (let pidx = 0; pidx < state.players.length; pidx++) {
    const ps  = state.players[pidx];
    const hud = refs.huds[pidx];
    if (!hud) continue;
    hud.distT.setText(`${Math.floor(ps.trackPosition / POSITION_SCALE)} / ${Math.floor(state.trackLength / POSITION_SCALE)}`);
    hud.debuffT.setText(ps.debuffType ? `SLOWED ${_speedPct(ps)}%` : '');
    hud.sprintT.setText(ps.sprintTicksLeft > 0 ? `SPRINT ${(ps.sprintTicksLeft / 60).toFixed(1)}s` : '');
    ps.slots.forEach((slot, i) => {
      const ref = hud.chipRefs[i];
      if (!ref?.usesT) return;
      ref.usesT.setText(_usesLabel(slot));
      ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
      ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
      if (slot.isReactive) {
        const armed = ps.boostKeyHeld[i] && slot.uses > 0;
        ref.chip.setStrokeStyle(armed ? 2 : 1, armed ? ARMED_STROKE : UNARMED_STROKE_REACT, armed ? 1 : undefined);
      }
    });
  }
  // Gap display: show spread between leader and last active
  const active = state.players.filter(ps => ps.gs === 'RUNNING' || ps.gs === 'REACTIVE');
  if (active.length > 1) {
    const leader = Math.max(...active.map(ps => ps.trackPosition));
    const last   = Math.min(...active.map(ps => ps.trackPosition));
    const gap    = (leader - last) / POSITION_SCALE;
    refs.gapText.setText(`SPREAD  ${Math.round(gap)}`);
    refs.gapText.setColor(gap >= 300 ? '#FF9900' : '#445566');
  } else {
    refs.gapText.setText('');
  }
}

// Keep buildHud2P/updateHud2P as aliases for backward compatibility (replay etc.)
export function buildHud2P(scene, slots0, slots1) {
  return buildHudMP(scene, [slots0, slots1]);
}
export function updateHud2P(refs, state) {
  return updateHudMP(refs, state);
}

function _usesLabel(slot) { return slot.uses > 0 ? `×${slot.uses}` : 'SPENT'; }
function _speedPct(ps) {
  const s = ps.sprintTicksLeft > 0 ? 140 : ps.debuffType === 'ice' ? 50 : ps.debuffType === 'water' ? 30 : 100;
  return Math.round(s);
}
