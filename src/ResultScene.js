import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';
import { BOOSTS } from './boosts.js';
import { loadProgress, awardXP, xpToNext } from './progression.js';
import { BINDINGS } from './controls.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  init(data) {
    this.mode          = data.mode || '1p';
    this.trackData     = data.trackData;
    this.replayOutcome = data.replayOutcome || null;
    this.replayMatched = data.replayMatched ?? null;
    if (this.mode === '1p') {
      this.result   = data.result;
      this.distance = data.distance;
      this.elapsed  = data.elapsed;
      this.loadout  = data.loadout;
    } else {
      this.players = data.players; // [{result, distance, elapsed, loadout}, ...]
    }
  }

  create() {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x06080f);
    if (this.mode === '2p') this._create2P();
    else                    this._create1P();
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

    this.loadout.forEach((id, i) => {
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

    this.add.text(CANVAS_W / 2, CANVAS_H - 22, 'R = retry plan  ·  M = main menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);
  }

  // ─── 2-PLAYER RESULT ──────────────────────────────────────────────────────

  _create2P() {
    const [p1, p2] = this.players;

    // Determine winner
    const winnerIdx = (() => {
      if (p1.result === 'COMPLETE' && p2.result !== 'COMPLETE') return 0;
      if (p2.result === 'COMPLETE' && p1.result !== 'COMPLETE') return 1;
      if (p1.distance > p2.distance) return 0;
      if (p2.distance > p1.distance) return 1;
      return -1; // tie
    })();

    const titleText  = winnerIdx === -1 ? 'TIE!' : `PLAYER ${winnerIdx + 1} WINS`;
    const titleColor = winnerIdx === -1 ? '#FFEE55' : '#66EE88';
    this.add.text(CANVAS_W / 2, 68, titleText, {
      fontSize: '44px', fontFamily: 'monospace', color: titleColor
    }).setOrigin(0.5);

    this._drawPlayerPanel(300, p1, 0, winnerIdx === 0);
    this._drawPlayerPanel(980, p2, 1, winnerIdx === 1);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1, 0x1a2a3a, 1);
    dg.lineBetween(CANVAS_W / 2, 120, CANVAS_W / 2, 490);

    // Award XP per player separately (drawn compact, side by side)
    this._drawXpSection2P(p1.result === 'COMPLETE', p1.distance, 'p1', 300);
    this._drawXpSection2P(p2.result === 'COMPLETE', p2.distance, 'p2', 980);

    const cx = CANVAS_W / 2;
    this._btn(cx - 170, 626, '[R] Retry plan', () => {
      this.scene.start('PlanScene', { trackData: this.trackData, mode: '2p' });
    });
    this._btn(cx + 170, 626, '[M] Main menu', () => {
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on(`keydown-${BINDINGS.global.retry}`, () =>
      this.scene.start('PlanScene', { trackData: this.trackData, mode: '2p' }));
    this.input.keyboard.on(`keydown-${BINDINGS.global.menu}`, () =>
      this.scene.start('MenuScene'));

    this.add.text(cx, CANVAS_H - 22, 'R = retry plan  ·  M = main menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);
  }

  _drawPlayerPanel(cx, p, idx, isWinner) {
    let y = 130;

    if (isWinner) {
      this.add.text(cx, y - 20, '★ WINNER', {
        fontSize: '13px', fontFamily: 'monospace', color: '#FFD700'
      }).setOrigin(0.5);
    }

    this.add.text(cx, y, `P${idx + 1}`, {
      fontSize: '26px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5); y += 38;

    const resColor = p.result === 'COMPLETE' ? '#66EE88' : '#EE5544';
    const resText  = p.result === 'COMPLETE' ? 'COMPLETE' : 'ELIMINATED';
    this.add.text(cx, y, resText, {
      fontSize: '20px', fontFamily: 'monospace', color: resColor
    }).setOrigin(0.5); y += 30;

    this.add.text(cx, y, `${p.distance} / ${this.trackData.length}`, {
      fontSize: '15px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5); y += 22;

    this.add.text(cx, y, `${p.elapsed}s`, {
      fontSize: '15px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5); y += 30;

    this.add.text(cx, y, 'Loadout:', {
      fontSize: '12px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5); y += 18;

    p.loadout.forEach(id => {
      const b = BOOSTS[id];
      this.add.text(cx, y, `${b.name}  (${b.type})`, {
        fontSize: '12px', fontFamily: 'monospace',
        color: b.type === 'passive' ? '#448866' : '#886644'
      }).setOrigin(0.5); y += 18;
    });
  }

  // ─── SHARED HELPERS ───────────────────────────────────────────────────────

  // Compact XP row for 2P result (drawn under each player's panel column)
  _drawXpSection2P(isWin, distance, slot, cx) {
    const y = 480;
    const state = loadProgress(slot);
    const { gained, levelsGained } = awardXP(state, distance, isWin, slot);

    const xpPop = this.add.text(cx, y + 30, `+${gained} XP`, {
      fontSize: '24px', fontFamily: 'monospace', color: '#FFE044',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: xpPop, y, alpha: 1, duration: 450, ease: 'Back.easeOut', delay: 200 });

    let oy = y + 28;
    for (const lv of levelsGained) {
      const msg = lv.unlocked
        ? `LVL ${state.level}  +${BOOSTS[lv.unlocked].name}`
        : `LEVEL UP → ${state.level}`;
      this.add.text(cx, oy, msg, {
        fontSize: '13px', fontFamily: 'monospace', color: '#88FF88'
      }).setOrigin(0.5);
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

    this.tweens.add({
      targets: xpPop, y, alpha: 1,
      duration: 500, ease: 'Back.easeOut', delay: 200
    });

    let offsetY = y + 36;
    for (const lv of levelsGained) {
      const msg = lv.unlocked
        ? `LEVEL UP → ${state.level}  ·  Unlocked: ${BOOSTS[lv.unlocked].name}`
        : `LEVEL UP → ${state.level}`;
      this.add.text(CANVAS_W / 2, offsetY, msg, {
        fontSize: '18px', fontFamily: 'monospace', color: '#88FF88'
      }).setOrigin(0.5);
      offsetY += 28;
    }

    const barW = 300, barH = 8, barX = CANVAS_W / 2 - barW / 2;
    const nextThresh = 100 * (state.level + 1);
    const prevThresh = 100 * state.level;
    const fill = Math.min(1, Math.max(0, (state.totalXP - prevThresh) / (nextThresh - prevThresh)));

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2233); bg.fillRect(barX, offsetY + 8, barW, barH);
    if (fill > 0) {
      bg.fillStyle(0x2255AA); bg.fillRect(barX, offsetY + 8, Math.floor(barW * fill), barH);
    }
    this.add.text(CANVAS_W / 2, offsetY + 24, `Level ${state.level}  ·  ${xpToNext(state)} XP to next level`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#445566'
    }).setOrigin(0.5);
  }

  _btn(x, y, label, cb) {
    const bg = this.add.rectangle(x, y, 260, 52, 0x101820)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x243444);
    this.add.text(x, y, label, {
      fontSize: '18px', fontFamily: 'monospace', color: '#6699BB'
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x182838));
    bg.on('pointerout',  () => bg.setFillStyle(0x101820));
    bg.on('pointerdown', cb);
  }
}
