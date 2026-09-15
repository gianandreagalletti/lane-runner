import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';

const SEEN_KEY   = 'laneRunner.onboarded';
const PANEL_COUNT = 3;

const PANELS = [
  {
    title: 'YOU MOVE FORWARD',
    body: [
      'Your runner advances automatically —',
      'you never control speed directly.',
      '',
      '← → Arrow keys switch lanes.',
      '',
      'Rocks kill you instantly.',
      'Ice and Water slow you down.',
    ],
    hint: 'Press SPACE or click to continue →'
  },
  {
    title: 'PLAN BEFORE YOU RUN',
    body: [
      'Before every run you see the',
      'entire track at once.',
      '',
      'Read the obstacle map, then',
      'choose exactly 3 boosts',
      'from your loadout.',
      '',
      'The route you plan is the skill.',
    ],
    hint: 'Press SPACE or click to continue →'
  },
  {
    title: 'KEYS 1 · 2 · 3 = BOOSTS',
    body: [
      'Passive boosts work automatically.',
      '',
      'Active boosts are triggered by',
      'pressing 1, 2, or 3 mid-run.',
      '',
      'Rock Break and Phase activate in a',
      '250ms flash when you hit a rock —',
      'react in time and you survive.',
    ],
    hint: 'Press SPACE or click to START'
  }
];

export class OnboardScene extends Phaser.Scene {
  constructor() { super({ key: 'OnboardScene' }); }

  create() {
    if (localStorage.getItem(SEEN_KEY)) {
      this.scene.start('MenuScene');
      return;
    }
    this.panel = 0;
    this._buildPanel();

    this.input.keyboard.on('keydown-SPACE', () => this._advance());
    this.input.keyboard.on('keydown-ENTER', () => this._advance());
    this.input.on('pointerdown', () => this._advance());
  }

  _buildPanel() {
    this.children.removeAll(true);

    const p   = PANELS[this.panel];
    const cx  = CANVAS_W / 2;

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x06080f); g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Panel index dots
    for (let i = 0; i < PANEL_COUNT; i++) {
      const col = i === this.panel ? 0xAADDFF : 0x223344;
      g.fillStyle(col); g.fillCircle(cx + (i - 1) * 28, 52, 5);
    }

    // Panel card
    g.fillStyle(0x0e1a28);
    g.fillRoundedRect(cx - 380, 80, 760, 520, 14);
    g.lineStyle(2, 0x1e3448);
    g.strokeRoundedRect(cx - 380, 80, 760, 520, 14);

    // Panel number
    this.add.text(cx, 112, `${this.panel + 1} / ${PANEL_COUNT}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#334455'
    }).setOrigin(0.5);

    // Title
    this.add.text(cx, 160, p.title, {
      fontSize: '36px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5);

    // Body lines
    p.body.forEach((line, i) => {
      this.add.text(cx, 238 + i * 34, line, {
        fontSize: '19px', fontFamily: 'monospace', color: '#88AABB'
      }).setOrigin(0.5);
    });

    // Hint / action
    const hintBg = this.add.rectangle(cx, 556, 520, 44, 0x142030)
      .setStrokeStyle(1, 0x2a4455)
      .setInteractive({ useHandCursor: true });
    hintBg.on('pointerdown', () => this._advance());

    this.add.text(cx, 556, p.hint, {
      fontSize: '16px', fontFamily: 'monospace', color: '#66AACC'
    }).setOrigin(0.5);
  }

  _advance() {
    this.panel++;
    if (this.panel >= PANEL_COUNT) {
      localStorage.setItem(SEEN_KEY, '1');
      this.scene.start('MenuScene');
    } else {
      this._buildPanel();
    }
  }
}
