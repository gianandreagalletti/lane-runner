import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';

export class ControlsScene extends Phaser.Scene {
  constructor() { super({ key: 'ControlsScene' }); }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0x06080f);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    let y = 44;

    this.add.text(cx, y, 'CONTROLS', {
      fontSize: '42px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5); y += 62;

    const section = (title, rows) => {
      const dg = this.add.graphics();
      this.add.text(cx - 300, y, title, {
        fontSize: '12px', fontFamily: 'monospace', color: '#334455'
      }); y += 18;
      dg.lineStyle(1, 0x1a2a3a, 1);
      dg.lineBetween(cx - 300, y, cx + 300, y); y += 10;

      for (const [key, desc] of rows) {
        this.add.text(cx - 290, y, key, {
          fontSize: '14px', fontFamily: 'monospace', color: '#6699BB'
        });
        this.add.text(cx + 10, y, desc, {
          fontSize: '14px', fontFamily: 'monospace', color: '#445566'
        });
        y += 24;
      }
      y += 10;
    };

    section('── PLAYER 1  (1P or 2P left half)', [
      ['[A]  /  [D]',         'Switch lane left / right'],
      ['[1]  [2]  [3]',       'Activate boost in that loadout slot']
    ]);

    section('── PLAYER 2  (2P right half only)', [
      ['[←]  /  [→]',         'Switch lane left / right'],
      ['[8]  [9]  [0]',       'Activate boost in that loadout slot']
    ]);

    section('── 1P EXTRA', [
      ['[←]  /  [→]',         'Also switch lane (same as A / D in 1P)']
    ]);

    section('── PLANNING SCREEN', [
      ['[1] – [6]  or click',  'Toggle boost on / off'],
      ['[ENTER]',              'Start run (need exactly 3 selected)'],
      ['[ESC]',                'Back to main menu']
    ]);

    section('── DURING A RUN', [
      ['REACT! banner',        '250ms window when a lethal rock is incoming'],
      ['  → press boost key',  'Use a reactive boost (Rock Break / Phase) to survive']
    ]);

    section('── RESULT SCREEN', [
      ['[R]',  'Retry — back to plan screen for same track'],
      ['[M]',  'Main menu']
    ]);

    const backHint = this.add.text(cx, CANVAS_H - 26,
      'ESC · M · click anywhere to return', {
        fontSize: '13px', fontFamily: 'monospace', color: '#2a3a44'
      }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ESCAPE', () => this.scene.start('MenuScene'));
    this.input.keyboard.on('keydown-M',      () => this.scene.start('MenuScene'));
    this.input.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
