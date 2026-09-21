import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ALL_TRACKS, getTrackById } from './track.js';
import { loadProgress, resetProgress, xpToNext } from './progression.js';
import { exportLog, getLog, loadReplay } from './sessionLog.js';
import { PLAYER_COLOR_HEX } from './controls.js';
import { getAllTracks } from './TrackStore.js';
import { assertLayoutItems, RowCursor, layoutColumn } from './layout.js';

// ─── Layout constants ──────────────────────────────────────────────────────────
// Region-based layout: header / playerSelect / trackSelect / footer, stacked
// top-to-bottom with a fixed gap. trackSelect is the only flexible region —
// its content scrolls within its own rect rather than growing into playerSelect
// or footer (see the configurator layout fix for the class of bug this avoids).
const REGION_GAP    = 14;
const HEADER_H      = 280;
const PLAYER_SEL_H  = 50;
const FOOTER_H      = 90;

export class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  init(data) {
    this.mode = data?.mode || '1p';
  }

  create() {
    this.progress = loadProgress('p1');
    this._trackScrollY = 0;

    // Two separate lists, deliberately not merged:
    //  - staticItems: controls that never move (mode toggle, footer) — checked
    //    against each other AND must stay fully inside their parent region.
    //  - scrollItems: track buttons inside the masked, scrollable trackSelect
    //    container — checked only against each other (internal stacking). Their
    //    unscrolled rects legitimately extend past the region's bottom edge
    //    (that's what makes them scrollable); the mask + the per-frame
    //    visibility-driven input.enabled toggle in _updateTrackScroll() is what
    //    actually guarantees they can never render or be clickable outside
    //    trackSelect — a flat rect-vs-rect check can't express that and would
    //    just produce false "overlaps footer" warnings once content overflows.
    const staticItems = [];
    const scrollItems = [];

    const regions = layoutColumn(0, CANVAS_H, [
      { name: 'header',       h: HEADER_H },
      { name: 'playerSelect', h: PLAYER_SEL_H },
      { name: 'trackSelect',  h: 'flex' },
      { name: 'footer',       h: FOOTER_H }
    ], REGION_GAP, CANVAS_W);
    this._regions = regions;

    // Region rects checked against each other + canvas bounds (must never overlap).
    const regionItems = Object.entries(regions).map(([name, r]) => ({ name: `region-${name}`, ...r }));

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x0d0d1a);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    g.fillStyle(0x8B6F47, 0.07); g.fillRect(240, 0, 220, CANVAS_H);
    g.fillStyle(0x9AA5B1, 0.07); g.fillRect(530, 0, 220, CANVAS_H);
    g.fillStyle(0x4A90A4, 0.07); g.fillRect(820, 0, 220, CANVAS_H);

    // ─── HEADER region ───────────────────────────────────────────────────────
    this.add.text(CANVAS_W / 2, 110, 'LANE RUNNER', {
      fontSize: '72px', fontFamily: 'monospace', color: '#FFFFFF'
    }).setOrigin(0.5);

    this.add.text(CANVAS_W / 2, 196, 'plan the route · pick your boosts · execute', {
      fontSize: '18px', fontFamily: 'monospace', color: '#5566AA'
    }).setOrigin(0.5);

    this._drawProgressBadge();

    // ─── PLAYER SELECT region ───────────────────────────────────────────────
    const playerBtnItems = this._drawModeToggle(regions.playerSelect.y + regions.playerSelect.h / 2);
    playerBtnItems.forEach(it => staticItems.push({ ...it, parent: 'playerSelect' }));

    // ─── TRACK SELECT region (scrollable) ───────────────────────────────────
    const trackDescs = [
      '4 000 units · 10 bands · intro',
      '5 000 units · 14 bands · denser',
      '5 500 units · 15 bands · no single lane survives'
    ];

    this._trackListContainer = this.add.container(0, regions.trackSelect.y);
    this._trackItems = []; // { bg, localY, h } for scroll visibility toggling

    const cur = new RowCursor(0);
    ALL_TRACKS.forEach((track, i) => {
      const localY = cur.slot(72, 8) + 36;
      const item = this._trackBtn(CANVAS_W / 2, localY, track, trackDescs[i], i + 1);
      scrollItems.push({ name: `track-${i}`, x: item.x, y: item.y, w: item.w, h: item.h });
    });
    {
      const localY = cur.slot(66, 8) + 33;
      const item = this._genTrackBtn(CANVAS_W / 2, localY);
      scrollItems.push({ name: 'track-generated', x: item.x, y: item.y, w: item.w, h: item.h });
    }
    {
      const localY = cur.slot(66, 0) + 33;
      const item = this._yourTracksBtn(CANVAS_W / 2, localY);
      scrollItems.push({ name: 'track-yours', x: item.x, y: item.y, w: item.w, h: item.h });
    }
    this._trackContentH = cur.y;
    this._trackMaxScroll = Math.max(0, this._trackContentH - regions.trackSelect.h);

    // Clip the scrollable list to the trackSelect rect (mask shape must not be
    // added to the display list, or it renders as a visible filled rect).
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(regions.trackSelect.x, regions.trackSelect.y, regions.trackSelect.w, regions.trackSelect.h);
    this._trackListContainer.setMask(maskShape.createGeometryMask());

    this._trackScrollHint = this.add.text(CANVAS_W / 2, regions.trackSelect.y + regions.trackSelect.h + 9,
      '▼ scroll for more tracks ▼', { fontSize: '10px', fontFamily: 'monospace', color: '#334455' }
    ).setOrigin(0.5).setVisible(false);

    this.input.on('wheel', (pointer, _over, _dx, dy) => {
      const r = regions.trackSelect;
      if (pointer.y < r.y || pointer.y > r.y + r.h) return;
      this._trackScrollY = Phaser.Math.Clamp(this._trackScrollY + dy * 0.5, 0, this._trackMaxScroll);
      this._updateTrackScroll();
    });
    this._updateTrackScroll();

    // ─── FOOTER region ───────────────────────────────────────────────────────
    const footerItems = this._drawFooter(regions.footer);
    footerItems.forEach(it => staticItems.push({ ...it, parent: 'footer' }));

    this.input.keyboard.on('keydown-ONE',   () => this._go(ALL_TRACKS[0]));
    this.input.keyboard.on('keydown-TWO',   () => this._go(ALL_TRACKS[1]));
    this.input.keyboard.on('keydown-THREE', () => this._go(ALL_TRACKS[2]));
    this.input.keyboard.on('keydown-ENTER', () => this._go(ALL_TRACKS[0]));
    this.input.keyboard.on('keydown-FOUR',  () => this._goGenerated());
    this.input.keyboard.on('keydown-FIVE', () => this._goEditor());

    // Same assertLayoutItems the configurator uses (src/layout.js), run three
    // ways: regions against each other; static controls against each other +
    // their parent region; scrollable track items against each other only.
    // scrollItems are in the container's LOCAL (unscrolled, 0-based) space, so
    // canvas-bounds checking doesn't apply to them — pass Infinity to skip it
    // and keep just the finite/zero-size and mutual-overlap checks.
    assertLayoutItems(regionItems, CANVAS_W, CANVAS_H);
    assertLayoutItems(staticItems, CANVAS_W, CANVAS_H, regions);
    assertLayoutItems(scrollItems, Infinity, Infinity);
  }

  _updateTrackScroll() {
    const r = this._regions.trackSelect;
    this._trackListContainer.y = r.y - this._trackScrollY;
    for (const item of this._trackItems) {
      const absTop    = r.y + item.localY - this._trackScrollY;
      const absBottom = absTop + item.h;
      const fullyVisible = absTop >= r.y && absBottom <= r.y + r.h;
      if (item.bg.input) item.bg.input.enabled = fullyVisible;
    }
    if (this._trackScrollHint) {
      this._trackScrollHint.setVisible(this._trackMaxScroll > 0 && this._trackScrollY < this._trackMaxScroll - 1);
    }
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

  // Returns the layout items for its three buttons so create() can assert them.
  _drawModeToggle(y) {
    const cx = CANVAS_W / 2;
    const modes = ['1p', '2p', '3p'];
    const labels = ['1 PLAYER', '2 PLAYERS', '3 PLAYERS'];
    const xPositions = [cx - 130, cx, cx + 130];
    const w = 110, h = 28;
    const items = [];

    modes.forEach((m, i) => {
      const active = this.mode === m;
      const bg = this.add.rectangle(xPositions[i], y, w, h,
        active ? 0x162840 : 0x0d1520)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, active ? 0x3366AA : 0x1a2a3a);
      this.add.text(xPositions[i], y, labels[i], {
        fontSize: '13px', fontFamily: 'monospace', color: active ? '#88BBEE' : '#2a3a4a'
      }).setOrigin(0.5);
      bg.on('pointerdown', () => { if (this.mode !== m) this.scene.restart({ mode: m }); });
      items.push({ name: `mode-${m}`, x: xPositions[i] - w / 2, y: y - h / 2, w, h });
    });
    return items;
  }

  // Draws inside the scrollable track container. y/x are LOCAL to that
  // container (0 = top of trackSelect region). Returns the drawn rect.
  _trackBtn(x, y, track, desc, hotkey) {
    const w = 460, h = 72;
    const bg = this.add.rectangle(x, y, w, h, 0x0e1a24)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x1c3044);
    const t1 = this.add.text(x, y - 12, `[${hotkey}]  ${track.name.toUpperCase()}`, {
      fontSize: '22px', fontFamily: 'monospace', color: '#AADDFF'
    }).setOrigin(0.5);
    const t2 = this.add.text(x, y + 14, desc, {
      fontSize: '13px', fontFamily: 'monospace', color: '#2e4a62'
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x14222e));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1a24));
    bg.on('pointerdown', () => this._go(track));

    this._trackListContainer.add([bg, t1, t2]);
    this._trackItems.push({ bg, localY: y - h / 2, h });
    return { x: x - w / 2, y: y - h / 2, w, h };
  }

  _go(track) {
    if (this.mode === '1p') {
      this.scene.start('PlanScene', { trackData: track, mode: this.mode });
    } else {
      this.scene.start('JoinScene', { trackData: track, mode: this.mode });
    }
  }

  _genTrackBtn(x, y) {
    const w = 460, h = 66;
    const bg = this.add.rectangle(x, y, w, h, 0x0e1a20)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x1c3a2a);
    const t1 = this.add.text(x, y - 10, '[4]  GENERATED TRACK', {
      fontSize: '22px', fontFamily: 'monospace', color: '#66DDAA'
    }).setOrigin(0.5);
    const t2 = this.add.text(x, y + 14, 'configure seed · presets · parameters', {
      fontSize: '13px', fontFamily: 'monospace', color: '#2e5a42'
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x14221a));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1a20));
    bg.on('pointerdown', () => this._goGenerated());

    this._trackListContainer.add([bg, t1, t2]);
    this._trackItems.push({ bg, localY: y - h / 2, h });
    return { x: x - w / 2, y: y - h / 2, w, h };
  }

  _goGenerated() {
    this.scene.start('ConfigScene', { mode: this.mode, claims: this._claims || null });
  }

  _yourTracksBtn(x, y) {
    const w = 460, h = 66;
    const savedCount = getAllTracks().length;
    const bg = this.add.rectangle(x, y, w, h, 0x0e1420)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x2a1a3a);
    const t1 = this.add.text(x, y - 10, '[5]  YOUR TRACKS', {
      fontSize: '22px', fontFamily: 'monospace', color: '#BB88EE'
    }).setOrigin(0.5);
    const t2 = this.add.text(x, y + 14, savedCount > 0 ? `${savedCount} saved track${savedCount !== 1 ? 's' : ''}` : 'no saved tracks yet', {
      fontSize: '13px', fontFamily: 'monospace', color: '#4a2a5a'
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x14182a));
    bg.on('pointerout',  () => bg.setFillStyle(0x0e1420));
    bg.on('pointerdown', () => this._goEditor());

    this._trackListContainer.add([bg, t1, t2]);
    this._trackItems.push({ bg, localY: y - h / 2, h });
    return { x: x - w / 2, y: y - h / 2, w, h };
  }

  _goEditor() {
    this.scene.start('ConfigScene', { mode: this.mode, startMode: 'costruisci', claims: this._claims || null });
  }

  // Draws every footer control relative to the footer region rect. Returns
  // the interactive controls' layout items so create() can assert them.
  _drawFooter(region) {
    const items = [];
    const cur = new RowCursor(region.y + 4);

    // Row 1: debug toggle (dev builds only; absent from shipped JS)
    const debugRowY = cur.slot(22, 8);
    if (import.meta.env.DEV) {
      const debugOn = !!window.__lrDebug?.slowFollowers;
      const debugCY = debugRowY + 11;
      const debugBg = this.add.rectangle(CANVAS_W / 2, debugCY, 220, 22, debugOn ? 0x1a2200 : 0x0e0e0e)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, debugOn ? 0x446600 : 0x222222);
      this._debugLabel = this.add.text(CANVAS_W / 2, debugCY,
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
      items.push({ name: 'footer-debug', x: CANVAS_W / 2 - 110, y: debugRowY, w: 220, h: 22 });
    }

    // Row 2: Reset P1 | Reset P2 | Reset P3 | Controls | Replay | Export
    const btnRowY = cur.slot(30, 8);
    const btnCY = btnRowY + 15;

    const resetBtn = (x, label, profileId) => {
      const w = 100, h = 30;
      const bg = this.add.rectangle(x, btnCY, w, h, 0x160808)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x442222);
      this.add.text(x, btnCY, label, {
        fontSize: '11px', fontFamily: 'monospace', color: '#664444'
      }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setFillStyle(0x250c0c));
      bg.on('pointerout',  () => bg.setFillStyle(0x160808));
      bg.on('pointerdown', () => { resetProgress(profileId); this.scene.restart({ mode: this.mode }); });
      items.push({ name: `footer-reset-${profileId}`, x: x - w / 2, y: btnCY - h / 2, w, h });
    };
    resetBtn(60,  'RESET P1', 'p1');
    resetBtn(168, 'RESET P2', 'p2');
    resetBtn(276, 'RESET P3', 'p3');

    {
      const w = 160, h = 30;
      const ctrlBg = this.add.rectangle(CANVAS_W / 2, btnCY, w, h, 0x0d1520)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x223344);
      this.add.text(CANVAS_W / 2, btnCY, 'CONTROLS', {
        fontSize: '12px', fontFamily: 'monospace', color: '#446688'
      }).setOrigin(0.5);
      ctrlBg.on('pointerover', () => ctrlBg.setFillStyle(0x111e2e));
      ctrlBg.on('pointerout',  () => ctrlBg.setFillStyle(0x0d1520));
      ctrlBg.on('pointerdown', () => this.scene.start('ControlsScene'));
      items.push({ name: 'footer-controls', x: CANVAS_W / 2 - w / 2, y: btnCY - h / 2, w, h });
    }

    {
      const logCount = getLog().length;
      const w = 210, h = 30, x = CANVAS_W - 120;
      const exportBg = this.add.rectangle(x, btnCY, w, h, 0x0a1820)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x224433);
      this.exportLabel = this.add.text(x, btnCY,
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
      items.push({ name: 'footer-export', x: x - w / 2, y: btnCY - h / 2, w, h });
    }

    {
      const replay = loadReplay();
      const w = 150, h = 30, x = CANVAS_W - 310;
      const replayBg = this.add.rectangle(x, btnCY, w, h, 0x0a1428)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x224466);
      this.replayLabel = this.add.text(x, btnCY, 'REPLAY LAST RUN', {
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
      items.push({ name: 'footer-replay', x: x - w / 2, y: btnCY - h / 2, w, h });
    }

    // Row 3: hint text
    const hintRowY = cur.slot(14, 0);
    this.add.text(CANVAS_W / 2, hintRowY + 7, 'Click a track or press 1 / 2 / 3', {
      fontSize: '12px', fontFamily: 'monospace', color: '#1e2e38'
    }).setOrigin(0.5);

    return items;
  }
}
