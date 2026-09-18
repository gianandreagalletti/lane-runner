import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';
import { BINDINGS, KEY_DISPLAY } from './controls.js';

function kd(name) { return KEY_DISPLAY[name] || name; }

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

    const b1 = BINDINGS.p1;
    const b2 = BINDINGS.p2;
    const b3 = BINDINGS.p3;
    const bg = BINDINGS.global;

    section(`── PLAYER 1  (1P or 2P left half)`, [
      [`[${kd(b1.left)}]  /  [${kd(b1.right)}]`,   'Switch lane left / right'],
      [`[${kd(b1.boost[0])}]  Rock Break`,           'Slot 0 — reactive: destroys rock (hold to arm)'],
      [`[${kd(b1.boost[1])}]  Sprint`,               'Slot 1 — +40% speed for 4s'],
      [`[${kd(b1.boost[2])}]  Caltrop`,              'Slot 2 — place ice trap behind you'],
      [`[${kd(b1.boost[3])}]  Snipe Shot`,           'Slot 3 — fire a shot forward in your lane']
    ]);

    section(`── PLAYER 2  (2P right half only)`, [
      [`[${kd(b2.left)}]  /  [${kd(b2.right)}]`,    'Switch lane left / right'],
      [`[${kd(b2.boost[0])}][${kd(b2.boost[1])}][${kd(b2.boost[2])}][${kd(b2.boost[3])}]`, 'Slots 0–3 (same mapping as P1)']
    ]);

    section(`── PLAYER 3  (3P only)`, [
      [`[${kd(b3.left)}]  /  [${kd(b3.right)}]`,    'Switch lane left / right'],
      [`[${kd(b3.boost[0])}][${kd(b3.boost[1])}][${kd(b3.boost[2])}][${kd(b3.boost[3])}]`, 'Slots 0–3']
    ]);

    section('── PLANNING SCREEN — per player', [
      [`P1: [${kd(b1.up)}]/[${kd(b1.down)}] row  [${kd(b1.left)}]/[${kd(b1.right)}] value  [${kd(b1.confirm)}] confirm`, ''],
      [`P2: [${kd(b2.up)}]/[${kd(b2.down)}] row  [${kd(b2.left)}]/[${kd(b2.right)}] value  [${kd(b2.confirm)}] confirm`, ''],
      [`P3: [${kd(b3.up)}]/[${kd(b3.down)}] row  [${kd(b3.left)}]/[${kd(b3.right)}] value  [${kd(b3.confirm)}] confirm`, ''],
      ['Gamepad: ↑↓ row  ←→ value  A confirm  B un-confirm', ''],
      ['Mouse: click [-] / [+] to step values,  CONFIRM button', '']
    ]);

    section('── DURING A RUN', [
      ['REACT! banner',        '450ms window when a lethal rock is incoming'],
      [`  → press [${kd(b1.boost[0])}]`,  'Rock Break — destroys rock, saves your run'],
      ['Draft (» »)',          'Sit within 150 units behind another player for +8% speed'],
      ['Caltrop',              'Placed at your position—200u; triggers ice slow on contact'],
      ['Snipe Shot',           'Projectile travels forward at 9×base speed; slows on hit']
    ]);

    section('── RESULT SCREEN', [
      [`[${kd(bg.retry)}]`,  'Retry — back to plan screen for same track'],
      [`[${kd(bg.menu)}]`,   'Main menu']
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
