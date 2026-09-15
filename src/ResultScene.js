import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';
import { BOOSTS } from './boosts.js';
import { loadProgress, awardXP, xpToNext } from './progression.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  init(data) {
    this.result    = data.result;
    this.distance  = data.distance;
    this.elapsed   = data.elapsed;
    this.trackData = data.trackData;
    this.loadout   = data.loadout;
  }

  create() {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x06080f);

    const isWin = this.result === 'COMPLETE';

    // Title
    this.add.text(CANVAS_W / 2, 90, isWin ? 'TRACK COMPLETE' : 'RUN FAILED', {
      fontSize: '54px', fontFamily: 'monospace',
      color:    isWin ? '#66EE88' : '#EE5544'
    }).setOrigin(0.5);

    // Stats
    const distLine = isWin
      ? `Distance: ${this.distance} / ${this.trackData.length}`
      : `Reached: ${this.distance} / ${this.trackData.length}`;

    this.add.text(CANVAS_W / 2, 170, distLine, {
      fontSize: '20px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 198, `Time: ${this.elapsed}s`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#BBCCDD'
    }).setOrigin(0.5);

    // Loadout recap
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

    // XP
    this._drawXpSection(isWin, 360);

    // Nav buttons
    this._btn(CANVAS_W / 2 - 170, 580, '[R] Retry plan', () => {
      this.scene.start('PlanScene', { trackData: this.trackData });
    });
    this._btn(CANVAS_W / 2 + 170, 580, '[M] Main menu', () => {
      this.scene.start('MenuScene');
    });

    this.input.keyboard.on('keydown-R', () =>
      this.scene.start('PlanScene', { trackData: this.trackData }));
    this.input.keyboard.on('keydown-M', () =>
      this.scene.start('MenuScene'));

    this.add.text(CANVAS_W / 2, CANVAS_H - 22, 'R = retry plan  ·  M = main menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);
  }

  _drawXpSection(isWin, y) {
    const state = loadProgress();
    const before = { level: state.level, totalXP: state.totalXP };
    const { gained, levelsGained } = awardXP(state, this.distance, isWin);

    // XP gained line
    this.add.text(CANVAS_W / 2, y, `+${gained} XP`, {
      fontSize: '24px', fontFamily: 'monospace', color: '#DDCC44'
    }).setOrigin(0.5);

    // Level-up announcements
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

    // Progress bar (current state after XP)
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
