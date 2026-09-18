import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ALL_TRACKS, getTrackById } from './track.js';
import { loadProgress, resetProgress, xpToNext } from './progression.js';
import { exportLog, getLog, loadReplay } from './sessionLog.js';
import { PLAYER_COLOR_HEX } from './controls.js';
import { getAllTracks } from './TrackStore.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  init(data) {
    this.mode = data?.mode || '1p';
  }

  create() {
    this.progress = loadProgress('p1');

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

    // Mode toggle (1P / 2P)
    this._drawModeToggle(292);

    // Track buttons
    const trackDescs = [
      '4 000 units · 10 bands · intro',
      '5 000 units · 14 bands · denser',
      '5 500 units · 15 bands · no single lane survives'
    ];
    ALL_TRACKS.forEach((track, i) => {
      this._trackBtn(CANVAS_W / 2, 318 + i * 78, track, trackDescs[i], i + 1);
    });

    // Generated track button
    this._genTrackBtn(CANVAS_W / 2, 318 + ALL_TRACKS.length * 78);
    this._yourTracksBtn(CANVAS_W / 2, 318 + (ALL_TRACKS.length + 1) * 78);

    // Bottom bar: Reset P1 | Reset P2 | Reset P3 | Controls | Export
    const resetP1Bg = this.add.rectangle(60, CANVAS_H - 34, 100, 30, 0x160808)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x442222);
    this.add.text(60, CANVAS_H - 34, 'RESET P1', {
      fontSize: '11px', fontFamily: 'monospace', color: '#664444'
    }).setOrigin(0.5);
    resetP1Bg.on('pointerover', () => resetP1Bg.setFillStyle(0x250c0c));
    resetP1Bg.on('pointerout',  () => resetP1Bg.setFillStyle(0x160808));
    resetP1Bg.on('pointerdown', () => { resetProgress('p1'); this.scene.restart({ mode: this.mode }); });

    const resetP2Bg = this.add.rectangle(168, CANVAS_H - 34, 100, 30, 0x160808)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x442222);
    this.add.text(168, CANVAS_H - 34, 'RESET P2', {
      fontSize: '11px', fontFamily: 'monospace', color: '#664444'
    }).setOrigin(0.5);
    resetP2Bg.on('pointerover', () => resetP2Bg.setFillStyle(0x250c0c));
    resetP2Bg.on('pointerout',  () => resetP2Bg.setFillStyle(0x160808));
    resetP2Bg.on('pointerdown', () => { resetProgress('p2'); this.scene.restart({ mode: this.mode }); });

    const resetP3Bg = this.add.rectangle(276, CANVAS_H - 34, 100, 30, 0x160808)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x442222);
    this.add.text(276, CANVAS_H - 34, 'RESET P3', {
      fontSize: '11px', fontFamily: 'monospace', color: '#664444'
    }).setOrigin(0.5);
    resetP3Bg.on('pointerover', () => resetP3Bg.setFillStyle(0x250c0c));
    resetP3Bg.on('pointerout',  () => resetP3Bg.setFillStyle(0x160808));
    resetP3Bg.on('pointerdown', () => { resetProgress('p3'); this.scene.restart({ mode: this.mode }); });

    const ctrlBg = this.add.rectangle(CANVAS_W / 2, CANVAS_H - 34, 160, 30, 0x0d1520)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x223344);
    this.add.text(CANVAS_W / 2, CANVAS_H - 34, 'CONTROLS', {
      fontSize: '12px', fontFamily: 'monospace', color: '#446688'
    }).setOrigin(0.5);
    ctrlBg.on('pointerover', () => ctrlBg.setFillStyle(0x111e2e));
    ctrlBg.on('pointerout',  () => ctrlBg.setFillStyle(0x0d1520));
    ctrlBg.on('pointerdown', () => this.scene.start('ControlsScene'));

    const logCount  = getLog().length;
    const exportBg  = this.add.rectangle(CANVAS_W - 120, CANVAS_H - 34, 210, 30, 0x0a1820)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x224433);
    this.exportLabel = this.add.text(CANVAS_W - 120, CANVAS_H - 34,
      `EXPORT LOG (${logCount} runs)`, { fontSize: '12px', fontFamily: 'monospace', color: '#3a7755' }
    ).setOrigin(0.5);
    exportBg.on('pointerover', () => exportBg.setFillStyle(0x0e2230));
    exportBg.on('pointerout',  () => exportBg.setFillStyle(0x0a1820));
    exportBg.on('pointerdown', () => {
      const n = exportLog();
      this.exportLabel.setText(`COPIED! (${n} runs)`);
      this.exportLabel.setColor('#66FFAA');
      this.time.delayedCall(2000, () => {
        this.exportLabel.setText(`EXPORT LOG (${n} runs)`);
        this.exportLabel.setColor('#3a7755');
      });
    });

    const replay = loadReplay();
    const replayBg = this.add.rectangle(CANVAS_W - 310, CANVAS_H - 34, 150, 30, 0x0a1428)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x224466);
    this.replayLabel = this.add.text(CANVAS_W - 310, CANVAS_H - 34, 'REPLAY LAST RUN', {
      fontSize: '11px', fontFamily: 'monospace', color: replay ? '#2255AA' : '#1a2a3a'
    }).setOrigin(0.5);
    replayBg.on('pointerover', () => replayBg.setFillStyle(0x0e1e38));
    replayBg.on('pointerout',  () => replayBg.setFillStyle(0x0a1428));
    replayBg.on('pointerdown', () => {
      const r = loadReplay();
      if (!r) {
        this.replayLabel.setText('No replay saved');
        this.time.delayedCall(1500, () => this.replayLabel.setText('REPLAY LAST RUN'));
        return;
      }
      const trackData = r.matchConfig.trackData || getTrackById(r.matchConfig.trackId);
      if (!trackData) { this.replayLabel.setText('Track not found'); return; }
      this.scene.start('RunScene', {
        mode: r.matchConfig.mode,
        trackData,
        isReplay: true,
        replayMatchConfig: r.matchConfig,
        replayIntents: r.intents,
        originalOutcome: r.originalOutcome,
        loadout: r.matchConfig.players[0]?.loadout ?? [],
        loadoutP1: r.matchConfig.players[0]?.loadout ?? [],
        loadoutP2: r.matchConfig.players[1]?.loadout ?? []
      });
    });

    this.add.text(CANVAS_W / 2, CANVAS_H - 16, 'Click a track or press 1 / 2 / 3', {
      fontSize: '12px', fontFamily: 'monospace', color: '#1e2e38'
    }).setOrigin(0.5);

    // DEBUG toggle — slow followers (dev builds only; absent from shipped JS)
    if (import.meta.env.DEV) {
      const debugOn = !!window.__lrDebug?.slowFollowers;
      const debugBg = this.add.rectangle(CANVAS_W / 2, CANVAS_H - 60, 220, 22, debugOn ? 0x1a2200 : 0x0e0e0e)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, debugOn ? 0x446600 : 0x222222);
      this._debugLabel = this.add.text(CANVAS_W / 2, CANVAS_H - 60,
        `DEBUG: SLOW FOLLOWERS [${debugOn ? 'ON' : 'OFF'}]`, {
          fontSize: '10px', fontFamily: 'monospace', color: debugOn ? '#88CC22' : '#333333'
        }).setOrigin(0.5);
      debugBg.on('pointerover', () => debugBg.setFillStyle(debugOn ? 0x253300 : 0x161616));
      debugBg.on('pointerout',  () => debugBg.setFillStyle(debugOn ? 0x1a2200 : 0x0e0e0e));
      debugBg.on('pointerdown', () => {
        window.__lrDebug = window.__lrDebug || {};
        window.__lrDebug.slowFollowers = !window.__lrDebug.slowFollowers;
        this.scene.restart({ mode: this.mode });
      });
    }

    this.input.keyboard.on('keydown-ONE',   () => this._go(ALL_TRACKS[0]));
    this.input.keyboard.on('keydown-TWO',   () => this._go(ALL_TRACKS[1]));
    this.input.keyboard.on('keydown-THREE', () => this._go(ALL_TRACKS[2]));
    this.input.keyboard.on('keydown-ENTER', () => this._go(ALL_TRACKS[0]));
    this.input.keyboard.on('keydown-FOUR',  () => this._goGenerated());
    this.input.keyboard.on('keydown-FIVE', () => this._goEditor());
  }

  _drawProgressBadge() {
    const { level, totalXP } = this.progress;
    const cx  = CANVAS_W / 2;
    const y   = 242;
    const xpN = xpToNext(this.progress);

    this.add.text(cx, y, `Level ${level}`, {
      fontSize: '17px', fontFamily: 'monospace', color: '#88AACC'
    }).setOrigin(0.5);

    const barW = 240, barH = 7, barX = cx - barW / 2;
    const nextThresh = 100 * (level + 1);
    const prevThresh = 100 * level;
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

  _drawModeToggle(y) {
    const cx = CANVAS_W / 2;
    const modes = ['1p', '2p', '3p'];
    const labels = ['1 PLAYER', '2 PLAYERS', '3 PLAYERS'];
    const xPositions = [cx - 130, cx, cx + 130];

    modes.forEach((m, i) => {
      const active = this.mode === m;
      const bg = this.add.rectangle(xPositions[i], y, 110, 28,
        active ? 0x162840 : 0x0d1520)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, active ? 0x3366AA : 0x1a2a3a);
      this.add.text(xPositions[i], y, labels[i], {
        fontSize: '13px', fontFamily: 'monospace', color: active ? '#88BBEE' : '#2a3a4a'
      }).setOrigin(0.5);
      bg.on('pointerdown', () => { if (this.mode !== m) this.scene.restart({ mode: m }); });
    });
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
    if (this.mode === '1p') {
      this.scene.start('PlanScene', { trackData: track, mode: this.mode });
    } else {
      this.scene.start('JoinScene', { trackData: track, mode: this.mode });
    }
  }

  _genTrackBtn(x, y) {
    const bg = this.add.rectangle(x, y, 460, 66, 0x0e1a20)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x1c3a2a);

    this.add.text(x, y - 10, '[4]  GENERATED TRACK', {
      fontSize: '22px', fontFamily: 'monospace', color: '#66DDAA'
    }).setOrigin(0.5);
    this.add.text(x, y + 14, 'configure seed · presets · parameters', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2e5a42'
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x14221a));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1a20));
    bg.on('pointerdown', () => this._goGenerated());
  }

  _goGenerated() {
    this.scene.start('ConfigScene', { mode: this.mode, claims: this._claims || null });
  }

  _yourTracksBtn(x, y) {
    const savedCount = getAllTracks().length;
    const bg = this.add.rectangle(x, y, 460, 66, 0x0e1420)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x2a1a3a);
    this.add.text(x, y - 10, '[5]  YOUR TRACKS', {
      fontSize: '22px', fontFamily: 'monospace', color: '#BB88EE'
    }).setOrigin(0.5);
    this.add.text(x, y + 14, savedCount > 0 ? `${savedCount} saved track${savedCount !== 1 ? 's' : ''}` : 'no saved tracks yet', {
      fontSize: '13px', fontFamily: 'monospace', color: '#4a2a5a'
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x14182a));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1420));
    bg.on('pointerdown', () => this._goEditor());
  }

  _goEditor() {
    this.scene.start('ConfigScene', { mode: this.mode, startMode: 'costruisci', claims: this._claims || null });
  }
}
