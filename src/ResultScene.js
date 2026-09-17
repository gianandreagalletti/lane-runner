import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';
import { BOOSTS } from './boosts.js';
import { loadProgress, awardXP, xpToNext } from './progression.js';
import { BINDINGS, PLAYER_COLOR_HEX } from './controls.js';

const PLACEMENT_XP = [25, 15, 5]; // place 1, 2, 3

// Convert loadout (new object format OR legacy array) to a flat list of boost IDs for display
function _loadoutToDisplayList(loadout) {
  if (!loadout) return [];
  if (Array.isArray(loadout)) return loadout; // legacy format
  // New format: { passives: { ice_grip: 2, ... }, actives: { rock_break: 3, ... } }
  const ids = [];
  const passiveOrder = ['ice_grip', 'water_shield', 'quick_step'];
  const activeOrder  = ['rock_break', 'sprint', 'phase'];
  for (const id of passiveOrder) {
    const level = loadout.passives?.[id] ?? 0;
    if (level > 0) ids.push(id);
  }
  for (const id of activeOrder) {
    const charges = loadout.actives?.[id] ?? 0;
    if (charges > 0) ids.push(id);
  }
  return ids;
}

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  init(data) {
    this.mode          = data.mode || '1p';
    this.trackData     = data.trackData;
    this.replayOutcome = data.replayOutcome || null;
    this.replayMatched = data.replayMatched ?? null;
    this._claims       = data.claims || null;
    if (this.mode === '1p') {
      this.result   = data.result;
      this.distance = data.distance;
      this.elapsed  = data.elapsed;
      this.loadout  = data.loadout;
    } else {
      this.players        = data.players;   // [{result, distance, elapsed, loadout, boostUses, inputSource?}, ...]
      this.placements     = data.placements || null;
      this.planningTimeMs = data.planningTimeMs ?? 0;
    }
  }

  create() {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x06080f);
    if (this.mode === '1p') this._create1P();
    else                    this._createMP();
  }

  // ─── 1-PLAYER RESULT ──────────────────────────────────────────────────────

  _create1P() {
    const isWin = this.result === 'COMPLETE';

    this.add.text(CANVAS_W / 2, 90, isWin ? 'TRACK COMPLETE' : 'RUN FAILED', {
      fontSize: '54px', fontFamily: 'monospace',
      color:    isWin ? '#66EE88' : '#EE5544'
    }).setOrigin(0.5);

    if (this.replayOutcome) {
      const matched = this.replayMatched;
      this.add.text(CANVAS_W / 2, 130, matched ? 'REPLAY ✓ deterministic' : 'REPLAY ✗ mismatch', {
        fontSize: '13px', fontFamily: 'monospace',
        color: matched ? '#44BB66' : '#BB4444'
      }).setOrigin(0.5);
    }

    const distLine = isWin
      ? `Distance: ${this.distance} / ${this.trackData.length}`
      : `Reached: ${this.distance} / ${this.trackData.length}`;

    this.add.text(CANVAS_W / 2, 170, distLine, {
      fontSize: '20px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 198, `Time: ${this.elapsed}s`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 242, 'Loadout:', {
      fontSize: '14px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5);

    const loadoutIds = _loadoutToDisplayList(this.loadout);
    loadoutIds.forEach((id, i) => {
      const b = BOOSTS[id];
      this.add.text(CANVAS_W / 2, 264 + i * 22, `${b.name}  (${b.type})`, {
        fontSize: '14px', fontFamily: 'monospace',
        color: b.type === 'passive' ? '#448866' : '#886644'
      }).setOrigin(0.5);
    });

    this._drawXpSection(isWin, this.distance, 360, 'p1');

    this._btn(CANVAS_W / 2 - 170, 580, '[R] Retry plan', () => {
      this.scene.start('PlanScene', { trackData: this.trackData, mode: '1p' });
    });
    this._btn(CANVAS_W / 2 + 170, 580, '[M] Main menu', () => {
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on(`keydown-${BINDINGS.global.retry}`, () =>
      this.scene.start('PlanScene', { trackData: this.trackData, mode: '1p' }));
    this.input.keyboard.on(`keydown-${BINDINGS.global.menu}`, () =>
      this.scene.start('MenuScene'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));

    this.add.text(CANVAS_W / 2, CANVAS_H - 22, 'R = retry plan  ·  M / ESC = main menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);
  }

  // ─── MULTI-PLAYER RESULT (2P or 3P) ──────────────────────────────────────

  _createMP() {
    const n = this.players.length;
    const placements = this.placements || this.players.map(() => null);

    // Title
    const titleText = (() => {
      if (n === 2) {
        if (placements[0] === 1 && placements[1] !== 1) return 'PLAYER 1 WINS';
        if (placements[1] === 1 && placements[0] !== 1) return 'PLAYER 2 WINS';
        return 'TIE!';
      }
      const first = placements.indexOf(1);
      return first >= 0 ? `PLAYER ${first + 1} WINS` : 'TIE!';
    })();
    const titleColor = titleText.includes('TIE') ? '#FFEE55' : '#66EE88';
    this.add.text(CANVAS_W / 2, 68, titleText, {
      fontSize: n === 3 ? '36px' : '44px', fontFamily: 'monospace', color: titleColor
    }).setOrigin(0.5);

    // Column positions
    const cols = n === 2 ? [300, 980] : [215, 640, 1065];
    this.players.forEach((p, i) => {
      this._drawPlayerPanelMP(cols[i], p, i, placements[i] === 1, placements[i]);
    });

    // Dividers
    const dg = this.add.graphics();
    dg.lineStyle(1, 0x1a2a3a, 1);
    if (n === 3) {
      dg.lineBetween(428, 120, 428, 490);
      dg.lineBetween(855, 120, 855, 490);
    } else {
      dg.lineBetween(CANVAS_W / 2, 120, CANVAS_W / 2, 490);
    }

    // XP sections
    const XP_BONUS = [25, 15, 5];
    cols.forEach((cx, i) => {
      const xpBonus = placements[i] ? (XP_BONUS[placements[i] - 1] ?? 0) : 0;
      this._drawXpSection2P(this.players[i].result === 'COMPLETE', this.players[i].distance, `p${i+1}`, cx, xpBonus);
    });

    const bx = CANVAS_W / 2;
    this._btn(bx - 170, 626, '[R] Retry plan', () =>
      this.scene.start('PlanScene', { trackData: this.trackData, mode: this.mode, claims: this._claims }));
    this._btn(bx + 170, 626, '[M] Main menu', () => this.scene.start('MenuScene'));
    this.input.keyboard.on('keydown-R', () =>
      this.scene.start('PlanScene', { trackData: this.trackData, mode: this.mode, claims: this._claims }));
    this.input.keyboard.on('keydown-M', () => this.scene.start('MenuScene'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
    this.add.text(bx, CANVAS_H - 22, 'R = retry plan  ·  M / ESC = main menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);
  }

  _drawPlayerPanelMP(cx, p, idx, isWinner, place) {
    const placeLabels = ['1st', '2nd', '3rd'];
    let y = 130;
    const col = PLAYER_COLOR_HEX[idx] || '#AADDFF';

    if (isWinner) {
      this.add.text(cx, y - 20, '★ 1st PLACE', { fontSize: '13px', fontFamily: 'monospace', color: '#FFD700' }).setOrigin(0.5);
    } else if (place) {
      this.add.text(cx, y - 20, placeLabels[place - 1] || `${place}th`, { fontSize: '13px', fontFamily: 'monospace', color: '#667788' }).setOrigin(0.5);
    }

    this.add.text(cx, y, `P${idx + 1}`, { fontSize: '26px', fontFamily: 'monospace', color: col }).setOrigin(0.5); y += 38;

    const resColor = p.result === 'COMPLETE' ? '#66EE88' : '#EE5544';
    const resText  = p.result === 'COMPLETE' ? 'COMPLETE'
      : p.result === 'LEFT BEHIND' ? 'LEFT BEHIND'
      : p.result === 'FAILED'      ? 'FAILED'
      : 'ELIMINATED';
    this.add.text(cx, y, resText, { fontSize: '20px', fontFamily: 'monospace', color: resColor }).setOrigin(0.5); y += 30;
    this.add.text(cx, y, `${p.distance} / ${this.trackData.length}`, { fontSize: '15px', fontFamily: 'monospace', color: '#BBCCDD' }).setOrigin(0.5); y += 20;
    this.add.text(cx, y, `${p.elapsed}s`, { fontSize: '15px', fontFamily: 'monospace', color: '#BBCCDD' }).setOrigin(0.5); y += 26;
    this.add.text(cx, y, 'Loadout:', { fontSize: '12px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0.5); y += 18;
    const loadoutIds = _loadoutToDisplayList(p.loadout);
    loadoutIds.forEach(id => {
      const b = BOOSTS[id];
      const uses = p.boostUses?.[id];
      const usesStr = (b.type === 'active' && uses !== undefined) ? `  ×${uses}` : '';
      this.add.text(cx, y, `${b.name}${usesStr}`, {
        fontSize: '12px', fontFamily: 'monospace', color: b.type === 'passive' ? '#448866' : '#886644'
      }).setOrigin(0.5); y += 17;
    });
  }

  // ─── SHARED HELPERS ───────────────────────────────────────────────────────

  _drawXpSection2P(isWin, distance, slot, cx, xpBonus = 0) {
    const y = 488;
    const state = loadProgress(slot);
    const { gained, levelsGained } = awardXP(state, distance, isWin, slot, xpBonus);
    const label = xpBonus > 0 ? `+${gained} XP  ★ +${xpBonus}` : `+${gained} XP`;
    const xpPop = this.add.text(cx, y + 30, label, {
      fontSize: '22px', fontFamily: 'monospace', color: '#FFE044',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: xpPop, y, alpha: 1, duration: 450, ease: 'Back.easeOut', delay: 200 });

    let oy = y + 28;
    for (const lv of levelsGained) {
      const msg = lv.unlocked
        ? `LVL ${state.level}  +${BOOSTS[lv.unlocked].name}`
        : `LEVEL UP → ${state.level}`;
      this.add.text(cx, oy, msg, { fontSize: '13px', fontFamily: 'monospace', color: '#88FF88' }).setOrigin(0.5);
      oy += 20;
    }
    this.add.text(cx, oy + 8, `Level ${state.level}  ·  ${xpToNext(state)} to next`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5);
  }

  _drawXpSection(isWin, distance, y, slot = 'p1') {
    const state = loadProgress(slot);
    const { gained, levelsGained } = awardXP(state, distance, isWin, slot);

    const xpPop = this.add.text(CANVAS_W / 2, y + 40, `+${gained} XP`, {
      fontSize: '32px', fontFamily: 'monospace', color: '#FFE044',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: xpPop, y, alpha: 1, duration: 500, ease: 'Back.easeOut', delay: 200 });

    let offsetY = y + 36;
    for (const lv of levelsGained) {
      const msg = lv.unlocked
        ? `LEVEL UP → ${state.level}  ·  Unlocked: ${BOOSTS[lv.unlocked].name}`
        : `LEVEL UP → ${state.level}`;
      this.add.text(CANVAS_W / 2, offsetY, msg, { fontSize: '18px', fontFamily: 'monospace', color: '#88FF88' }).setOrigin(0.5);
      offsetY += 28;
    }

    const barW = 300, barH = 8, barX = CANVAS_W / 2 - barW / 2;
    const nextThresh = 100 * (state.level + 1);
    const prevThresh = 100 * state.level;
    const fill = Math.min(1, Math.max(0, (state.totalXP - prevThresh) / (nextThresh - prevThresh)));

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2233); bg.fillRect(barX, offsetY + 8, barW, barH);
    if (fill > 0) { bg.fillStyle(0x2255AA); bg.fillRect(barX, offsetY + 8, Math.floor(barW * fill), barH); }
    this.add.text(CANVAS_W / 2, offsetY + 24, `Level ${state.level}  ·  ${xpToNext(state)} XP to next level`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5);
  }

  _btn(x, y, label, cb) {
    const bg = this.add.rectangle(x, y, 260, 52, 0x101820)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x243444);
    this.add.text(x, y, label, { fontSize: '18px', fontFamily: 'monospace', color: '#6699BB' }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x182838));
    bg.on('pointerout',  () => bg.setFillStyle(0x101820));
    bg.on('pointerdown', cb);
  }
}
