import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './track.js';
import { BINDINGS, PLAYER_COLOR_HEX, PLAYER_COLORS } from './controls.js';

// Vehicle names and colours for display
const VEHICLE_NAMES  = ['AMBULANCE', 'FIRE TRUCK', 'POLICE'];
const VEHICLE_COLORS = [0xF0F0F0, 0xC4463A, 0x1A2A6C];
const VEHICLE_STRIPES = [0xE03030, 0xFFFFFF, 0xFFFFFF];

// Slot assignment: claims[slotIdx] = { inputSource: 'keyboard'|'pad', padIndex?: number }
// Passed to PlanScene and on to RunScene via scene data

export class JoinScene extends Phaser.Scene {
  constructor() { super({ key: 'JoinScene' }); }

  init(data) {
    this.trackData = data.trackData;
    this.mode      = data.mode || '1p';
    this.numSlots  = this.mode === '3p' ? 3 : this.mode === '2p' ? 2 : 1;
    this.claims    = new Array(this.numSlots).fill(null); // null = unclaimed
  }

  create() {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    this.add.text(CANVAS_W / 2, 60, 'JOIN — CLAIM YOUR SLOT', {
      fontSize: '28px', fontFamily: 'monospace', color: '#7899AA'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 100, 'Press A on your pad, or your movement key, to claim a slot', {
      fontSize: '14px', fontFamily: 'monospace', color: '#334455'
    }).setOrigin(0.5);

    // Build slot cards
    this._slotCards = [];
    const totalW = this.numSlots * 280 + (this.numSlots - 1) * 40;
    const startX  = (CANVAS_W - totalW) / 2 + 140;
    for (let i = 0; i < this.numSlots; i++) {
      const cx = startX + i * 320;
      const bg  = this.add.rectangle(cx, 310, 260, 200, 0x0e1a24).setStrokeStyle(2, 0x1c3044);
      const num = this.add.text(cx, 225, `SLOT ${i + 1}`, { fontSize: '16px', fontFamily: 'monospace', color: '#445566' }).setOrigin(0.5);

      // Small vehicle silhouette (top-view simple rect with stripe)
      const silG = this.add.graphics();
      const sw = 56, sh = 36;
      silG.fillStyle(VEHICLE_COLORS[i], 0.7);
      silG.fillRect(cx - sw / 2, 248 - sh / 2, sw, sh);
      silG.fillStyle(VEHICLE_STRIPES[i], 0.8);
      silG.fillRect(cx - sw / 2, 248 - 3, sw, 6);
      silG.lineStyle(1, 0x888888, 0.4);
      silG.strokeRect(cx - sw / 2, 248 - sh / 2, sw, sh);

      const nameT = this.add.text(cx, 274, VEHICLE_NAMES[i], { fontSize: '10px', fontFamily: 'monospace', color: '#556677' }).setOrigin(0.5);
      const status = this.add.text(cx, 298, 'EMPTY', { fontSize: '22px', fontFamily: 'monospace', color: '#2a3a44' }).setOrigin(0.5);
      const hint   = this.add.text(cx, 336, i === 0 ? 'Pad A  or  A/D keys' : i === 1 ? 'Pad A  or  ←/→ keys' : 'Pad A  or  Q/E keys', {
        fontSize: '12px', fontFamily: 'monospace', color: '#223344'
      }).setOrigin(0.5);
      const releasT = this.add.text(cx, 362, '', { fontSize: '11px', fontFamily: 'monospace', color: '#553333' }).setOrigin(0.5);
      this._slotCards.push({ bg, num, status, hint, releasT });
    }

    // Start button
    this._startBg = this.add.rectangle(CANVAS_W / 2, 480, 280, 54, 0x0a1410).setStrokeStyle(2, 0x223322);
    this._startT  = this.add.text(CANVAS_W / 2, 480, 'START RUN', { fontSize: '24px', fontFamily: 'monospace', color: '#2A5535' }).setOrigin(0.5);
    this._startBg.setInteractive({ useHandCursor: true });
    this._startBg.on('pointerdown', () => this._tryStart());

    this.add.text(CANVAS_W / 2, 512, 'ENTER = start  ·  ESC = back', { fontSize: '12px', fontFamily: 'monospace', color: '#1e2e38' }).setOrigin(0.5);

    // Keyboard listeners
    this.input.keyboard.on('keydown', e => this._handleKey(e));
    this.input.keyboard.on('keydown-ENTER', () => this._tryStart());
    this.input.keyboard.on('keydown-ESC',   () => this.scene.start('MenuScene', { mode: this.mode }));

    // Per-pad previous button state for edge detection (justDown doesn't exist in Phaser 3.87)
    this._padBtnPrev = new Map(); // padIndex → { a: bool, b: bool }

    // Enable gamepad — log already-connected pads too
    this.input.gamepad.on('connected', pad => {
      console.log('Pad connected:', pad.index);
      if (!this._padBtnPrev.has(pad.index)) this._padBtnPrev.set(pad.index, { a: false, b: false });
    });
    this.input.gamepad.on('disconnected', pad => this._releasePad(pad.index));

    // Pads already present before this scene started
    for (const pad of (this.input.gamepad.gamepads || [])) {
      if (pad && !this._padBtnPrev.has(pad.index)) {
        console.log('Pad already present:', pad.index);
        this._padBtnPrev.set(pad.index, { a: false, b: false });
      }
    }

    this._refreshCards();
  }

  update() {
    // Poll gamepad A/B buttons for claiming — use value > 0.5 with manual edge detection
    if (!this.input.gamepad) return;
    const pads = this.input.gamepad.gamepads;
    for (const pad of pads) {
      if (!pad) continue;
      if (!this._padBtnPrev.has(pad.index)) this._padBtnPrev.set(pad.index, { a: false, b: false });
      const prev = this._padBtnPrev.get(pad.index);
      const aDown = (pad.buttons[0]?.value ?? 0) > 0.5;
      const bDown = (pad.buttons[1]?.value ?? 0) > 0.5;
      if (aDown && !prev.a) this._claimWithPad(pad.index);
      if (bDown && !prev.b) this._releasePad(pad.index);
      prev.a = aDown;
      prev.b = bDown;
    }
  }

  _claimWithPad(padIndex) {
    // If this pad already owns a slot, ignore
    if (this.claims.some(c => c?.padIndex === padIndex)) return;
    // Find next free slot
    const slot = this.claims.findIndex(c => c === null);
    if (slot < 0) return;
    this.claims[slot] = { inputSource: 'pad', padIndex };
    this._refreshCards();
  }

  _releasePad(padIndex) {
    const slot = this.claims.findIndex(c => c?.padIndex === padIndex);
    if (slot < 0) return;
    this.claims[slot] = null;
    this._refreshCards();
  }

  _handleKey(e) {
    // Map key to a player keyboard slot
    const kbSlot = this._keyToKbSlot(e.code || e.key);
    if (kbSlot < 0 || kbSlot >= this.numSlots) return;
    if (this.claims[kbSlot] !== null) return; // already claimed
    this.claims[kbSlot] = { inputSource: 'keyboard' };
    this._refreshCards();
  }

  _keyToKbSlot(keyCode) {
    const p1Keys = ['KeyA', 'KeyD', 'Digit1', 'Digit2', 'Digit3'];
    const p2Keys = ['ArrowLeft', 'ArrowRight', 'Digit8', 'Digit9', 'Digit0'];
    const p3Keys = ['KeyQ', 'KeyE', 'KeyI', 'KeyO', 'KeyP'];
    if (p1Keys.includes(keyCode)) return 0;
    if (p2Keys.includes(keyCode)) return 1;
    if (p3Keys.includes(keyCode)) return 2;
    return -1;
  }

  _refreshCards() {
    for (let i = 0; i < this.numSlots; i++) {
      const c    = this._slotCards[i];
      const claim = this.claims[i];
      if (claim) {
        c.bg.setStrokeStyle(3, PLAYER_COLORS[i]);
        c.status.setText(claim.inputSource === 'pad' ? 'PAD CONNECTED' : 'KEYBOARD');
        c.status.setColor(PLAYER_COLOR_HEX[i]);
        c.hint.setText('');
        c.releasT.setText(claim.inputSource === 'pad' ? '(B to release)' : '');
      } else {
        c.bg.setStrokeStyle(2, 0x1c3044);
        c.status.setText('EMPTY');
        c.status.setColor('#2a3a44');
        c.hint.setText(i === 0 ? 'Pad A  or  A/D keys' : i === 1 ? 'Pad A  or  ←/→ keys' : 'Pad A  or  Q/E keys');
        c.releasT.setText('');
      }
    }

    const ready = this.claims.slice(0, this.numSlots).every(c => c !== null);
    this._startBg.setFillStyle(ready ? 0x0e2214 : 0x0a1410);
    this._startBg.setStrokeStyle(2, ready ? 0x44AA66 : 0x223322);
    this._startT.setColor(ready ? '#55EE88' : '#2A5535');
  }

  _tryStart() {
    const ready = this.claims.slice(0, this.numSlots).every(c => c !== null);
    if (!ready) return;
    this.scene.start('PlanScene', {
      trackData: this.trackData,
      mode:      this.mode,
      claims:    this.claims   // [{inputSource, padIndex?}, ...]
    });
  }
}
