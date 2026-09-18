import { BOOSTS, BOOST_CONFIG } from './boosts.js';
import { CANVAS_W, CANVAS_H, LANE_CENTERS } from './track.js';
import { GAP_WARNING_CU, CENTI_SCALE } from '../sim/rules.js';
import { PLAYER_COLOR_HEX } from './controls.js';

const ARMED_STROKE          = 0xFFDD00;
const UNARMED_STROKE_REACT  = 0x554422;

// Fixed canonical slot order: 0=rock_break, 1=sprint, 2=caltrop, 3=snipe_shot
// BENCHED: phase removed
const SLOT_IDS = ['rock_break', 'sprint', 'caltrop', 'snipe_shot'];

export function buildHud1P(scene, slots) {
  // 4 slots — spread evenly
  const spacing = 170, startX = CANVAS_W / 2 - spacing * 1.5;
  const chipRefs = [];
  // Always render exactly 4 fixed slots
  SLOT_IDS.forEach((id, i) => {
    const x = startX + i * spacing;
    const boost = BOOSTS[id];
    const isReactive = id === 'rock_break';
    const chip  = scene.add.rectangle(x, 22, 158, 30, 0x201610)
      .setStrokeStyle(1, 0x554422);
    scene.add.text(x - 58, 22, `[${i + 1}]`, { fontSize: '11px', fontFamily: 'monospace', color: '#556677' }).setOrigin(0, 0.5);
    const nameT = scene.add.text(x - 40, 22, boost.name, {
      fontSize: '12px', fontFamily: 'monospace', color: '#FFCC88'
    }).setOrigin(0, 0.5);
    const usesT = scene.add.text(x + 68, 22, 'EMPTY', {
      fontSize: '12px', fontFamily: 'monospace', color: '#553333', stroke: '#000', strokeThickness: 2
    }).setOrigin(1, 0.5);
    chipRefs.push({ chip, nameT, usesT, id, isReactive });
  });
  const distText  = scene.add.text(20, 14, '', { fontSize: '20px', fontFamily: 'monospace', color: '#DDDDDD', stroke: '#000', strokeThickness: 3 });
  const speedText = scene.add.text(CANVAS_W - 20, 14, '', { fontSize: '20px', fontFamily: 'monospace', color: '#FFE044', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0);
  const sprintText= scene.add.text(CANVAS_W / 2, 50, '', { fontSize: '14px', fontFamily: 'monospace', color: '#FFEE55', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
  const draftText = scene.add.text(CANVAS_W / 2, 66, '', { fontSize: '12px', fontFamily: 'monospace', color: '#AAEEFF', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0);
  return { chipRefs, distText, speedText, sprintText, draftText };
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

    const chipRefs = [];
    const chipY = pidx === 2 ? 68 : 38;
    // 4 slots — tighter spacing to fit
    const chipRef0X4 = isRight
      ? (CANVAS_W - 55 - 3 * chipSpacing)
      : pos.anchor === 0.5 ? (CANVAS_W / 2 - chipSpacing * 1.5) : 55;
    SLOT_IDS.forEach((id, i) => {
      const cx = chipRef0X4 + i * chipSpacing;
      const boost = BOOSTS[id];
      const chip = scene.add.rectangle(cx, chipY, chipW, chipH, 0x201610).setStrokeStyle(1, 0x554422);
      const nameT = scene.add.text(cx, chipY, boost.name, {
        fontSize: '9px', fontFamily: 'monospace', color: '#FFCC88'
      }).setOrigin(0.5, 0.5);
      const usesT = scene.add.text(cx + 44, chipY, 'EMPTY', {
        fontSize: '9px', fontFamily: 'monospace', color: '#553333', stroke: '#000', strokeThickness: 2
      }).setOrigin(1, 0.5);
      chipRefs.push({ chip, nameT, usesT, id, isReactive: id === 'rock_break' });
    });

    const col   = PLAYER_COLOR_HEX[pidx] || '#FFFFFF';
    const yBase = pidx === 2 ? 54 : 14;
    scene.add.text(isRight ? CANVAS_W - 10 : 10, yBase, `P${pidx + 1}`, {
      fontSize: '14px', fontFamily: 'monospace', color: col, stroke: '#000', strokeThickness: 2
    }).setOrigin(isRight ? 1 : 0, 0);

    // Vehicle colours: ambulance white, fire truck red, police blue
    const distColors = ['#F0F0F0', '#C4463A', '#3A5ACD'];
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
    const draftT = scene.add.text(isRight ? CANVAS_W - 275 : 275, yBase + 42, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#AAEEFF', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
    huds.push({ chipRefs, distT, debuffT, sprintT, draftT });
  });

  const gapText = scene.add.text(CANVAS_W / 2, 14, '', {
    fontSize: '13px', fontFamily: 'monospace', color: '#556677', stroke: '#000', strokeThickness: 2
  }).setOrigin(0.5, 0);
  return { huds, gapText };
}

export function updateHud1P(refs, state) {
  const ps = state.players[0];
  refs.distText.setText(`${Math.floor(ps.trackPosition / CENTI_SCALE)} / ${Math.floor(state.trackLength / CENTI_SCALE)}`);
  const debuff = ps.debuffType ? `SLOWED ${_speedPct(ps)}%` : '';
  refs.speedText.setText(debuff);
  refs.sprintText.setText(ps.sprintTicksLeft > 0 ? `SPRINT ${(ps.sprintTicksLeft / 60).toFixed(1)}s` : '');
  if (refs.draftText) {
    if (ps.isDrafting && ps.draftFactor > 100) {
      refs.draftText.setText(`\u2248 DRAFT +${ps.draftFactor - 100}%`);
    } else {
      refs.draftText.setText('');
    }
  }
  ps.slots.forEach((slot, i) => {
    const ref = refs.chipRefs[i];
    if (!ref) return;
    ref.usesT.setText(_usesLabel(slot));
    ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
    ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
    if (ref.isReactive) {
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
    hud.distT.setText(`${Math.floor(ps.trackPosition / CENTI_SCALE)} / ${Math.floor(state.trackLength / CENTI_SCALE)}`);
    hud.debuffT.setText(ps.debuffType ? `SLOWED ${_speedPct(ps)}%` : '');
    hud.sprintT.setText(ps.sprintTicksLeft > 0 ? `SPRINT ${(ps.sprintTicksLeft / 60).toFixed(1)}s` : '');
    if (hud.draftT) {
      if (ps.isDrafting && ps.draftFactor > 100) {
        hud.draftT.setText(`\u2248 +${ps.draftFactor - 100}%`);
      } else {
        hud.draftT.setText('');
      }
    }
    ps.slots.forEach((slot, i) => {
      const ref = hud.chipRefs[i];
      if (!ref) return;
      ref.usesT.setText(_usesLabel(slot));
      ref.usesT.setColor(slot.uses > 0 ? '#55FF88' : '#553333');
      ref.nameT.setColor(slot.uses > 0 ? '#FFCC88' : '#554444');
      if (ref.isReactive) {
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
    const gap    = (leader - last) / CENTI_SCALE;
    refs.gapText.setText(`SPREAD  ${Math.round(gap)}`);
    // GAP_WARNING_CU / CENTI_SCALE = 450 display units
    refs.gapText.setColor(gap >= 450 ? '#FF9900' : '#445566');
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

function _usesLabel(slot) { return slot.uses > 0 ? `×${slot.uses}` : 'EMPTY'; }
function _speedPct(ps) {
  if (ps.sprintTicksLeft > 0) return 140;
  if (ps.debuffType === 'ice') {
    const level = ps.passives?.ice_grip ?? 0;
    if (level >= 2) return BOOST_CONFIG.passives.ice_grip.levels[1].factorPct;
    if (level >= 1) return BOOST_CONFIG.passives.ice_grip.levels[0].factorPct;
    return BOOST_CONFIG.passives.ice_grip.baseFactorPct;
  }
  if (ps.debuffType === 'water') {
    const level = ps.passives?.water_shield ?? 0;
    if (level >= 2) return BOOST_CONFIG.passives.water_shield.levels[1].factorPct;
    if (level >= 1) return BOOST_CONFIG.passives.water_shield.levels[0].factorPct;
    return BOOST_CONFIG.passives.water_shield.baseFactorPct;
  }
  if (ps.debuffType === 'snipe') return 65; // SNIPE_FACTOR — not affected by passives
  return 100;
}
