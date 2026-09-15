import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ALL_TRACKS } from './track.js';
import { loadProgress, resetProgress, xpToNext } from './progression.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  create() {
    this.progress = loadProgress();

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x0d0d1a);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    g.fillStyle(0x8B6F47, 0.07); g.fillRect(240, 0, 220, CANVAS_H);
    g.fillStyle(0x9AA5B1, 0.07); g.fillRect(530, 0, 220, CANVAS_H);
    g.fillStyle(0x4A90A4, 0.07); g.fillRect(820, 0, 220, CANVAS_H);

    // Title
    this.add.text(CANVAS_W / 2, 110, 'LANE RUNNER', {
      fontSize: '72px', fontFamily: 'monospace', color: '#FFFFFF'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 196, 'plan the route · pick your boosts · execute', {
      fontSize: '18px', fontFamily: 'monospace', color: '#5566AA'
    }).setOrigin(0.5);

    // Progression badge
    this._drawProgressBadge();

    // Track buttons
    const trackDescs = [
      '4 000 units · 10 bands · intro',
      '5 000 units · 14 bands · denser',
      '5 500 units · 15 bands · no single lane survives'
    ];
    ALL_TRACKS.forEach((track, i) => {
      this._trackBtn(CANVAS_W / 2, 318 + i * 90, track, trackDescs[i], i + 1);
    });

    // Reset progress button
    const resetBg = this.add.rectangle(108, CANVAS_H - 34, 188, 30, 0x160808)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x442222);
    this.add.text(108, CANVAS_H - 34, 'RESET PROGRESS', {
      fontSize: '12px', fontFamily: 'monospace', color: '#664444'
    }).setOrigin(0.5);
    resetBg.on('pointerover', () => resetBg.setFillStyle(0x250c0c));
    resetBg.on('pointerout',  () => resetBg.setFillStyle(0x160808));
    resetBg.on('pointerdown', () => { resetProgress(); this.scene.restart(); });

    this.add.text(CANVAS_W / 2, CANVAS_H - 20, 'Click a track or press 1 / 2 / 3', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ONE',   () => this._go(ALL_TRACKS[0]));
    this.input.keyboard.on('keydown-TWO',   () => this._go(ALL_TRACKS[1]));
    this.input.keyboard.on('keydown-THREE', () => this._go(ALL_TRACKS[2]));
    this.input.keyboard.on('keydown-ENTER', () => this._go(ALL_TRACKS[0]));
  }

  _drawProgressBadge() {
    const { level, totalXP } = this.progress;
    const cx  = CANVAS_W / 2;
    const y   = 242;
    const xpN = xpToNext(this.progress);

    this.add.text(cx, y, `Level ${level}`, {
      fontSize: '17px', fontFamily: 'monospace', color: '#88AACC'
    }).setOrigin(0.5);

    // XP progress bar
    const barW = 240, barH = 7, barX = cx - barW / 2;
    const nextThresh = 100 * (level + 1);
    const prevThresh = 100 * level;           // threshold for current level
    const fill = Math.min(1, Math.max(0, (totalXP - prevThresh) / (nextThresh - prevThresh)));

    const bg2 = this.add.graphics();
    bg2.fillStyle(0x192233); bg2.fillRect(barX, y + 16, barW, barH);
    if (fill > 0) {
      bg2.fillStyle(0x2255AA); bg2.fillRect(barX, y + 16, Math.floor(barW * fill), barH);
    }
    this.add.text(cx, y + 30, `${totalXP} XP  ·  ${xpN} to next level`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#3a4f66'
    }).setOrigin(0.5);
  }

  _trackBtn(x, y, track, desc, hotkey) {
    const bg = this.add.rectangle(x, y, 460, 72, 0x0e1a24)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x1c3044);

    this.add.text(x, y - 12, `[${hotkey}]  ${track.name.toUpperCase()}`, {
      fontSize: '22px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5);
    this.add.text(x, y + 14, desc, {
      fontSize: '13px', fontFamily: 'monospace', color: '#2e4a62'
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x14222e));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1a24));
    bg.on('pointerdown', () => this._go(track));
  }

  _go(track) {
    this.scene.start('PlanScene', { trackData: track });
  }
}
