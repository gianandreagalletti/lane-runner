import Phaser from 'phaser';
import { Player }     from './player.js';
import { Obstacles }  from './obstacles.js';
import { appendLog, saveReplay } from './sessionLog.js';
import { BINDINGS }   from './controls.js';
import { createInitialState } from '../sim/state.js';
import { step } from '../sim/step.js';
import {
  CANVAS_W, CANVAS_H, LANE_WIDTH, LANE_GAP, LANE_START_X, LANE_COLORS,
  LANE_CENTERS, PLAYER_Y
} from './track.js';
import { POSITION_SCALE, TICK_RATE } from '../sim/rules.js';
import { buildHud1P, buildHud2P, updateHud1P, updateHud2P } from './RunSceneHud.js';
import {
  renderReactiveOverlay1P, renderWarningArrow,
  updatePlayerLabels, handleSimEvents
} from './RunSceneRenderer.js';

const MS_PER_TICK = 1000 / TICK_RATE;
const TRAIL_PIN_Y = CANVAS_H - 40;
const P2_COLOR    = 0xE8A33D;

export class RunScene extends Phaser.Scene {
  constructor() { super({ key: 'RunScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.mode           = data.mode || '1p';
    this.planningTimeMs = data.planningTimeMs ?? 0;
    this._isReplay      = data.isReplay || false;
    this._replayIntents = data.replayIntents || [];
    this._replayOriginalOutcome = data.originalOutcome || null;

    if (this.mode === '2p') {
      this.loadoutP1 = data.loadoutP1 ?? data.loadout ?? [];
      this.loadoutP2 = data.loadoutP2 ?? data.loadout ?? [];
    } else {
      this.loadout = data.loadout ?? [];
    }

    if (this._isReplay) this._matchConfig = data.replayMatchConfig;

    this._accumMs       = 0;
    this._simTick       = 0;
    this._state         = null;
    this._intentQueue   = [];
    this._intentLog     = [];
    this._transitioning = false;
    this._keyState      = {};
  }

  create() {
    if (!this._isReplay) {
      const seed = Date.now() & 0xFFFFFF;
      this._matchConfig = {
        trackId: this.trackData.id, seed, mode: this.mode, rules: {},
        players: this.mode === '2p'
          ? [
              { slot: 0, profileId: 'p1', inputSource: 'local_keyboard', loadout: [...this.loadoutP1] },
              { slot: 1, profileId: 'p2', inputSource: 'local_keyboard', loadout: [...this.loadoutP2] }
            ]
          : [{ slot: 0, profileId: 'p1', inputSource: 'local_keyboard', loadout: [...this.loadout] }]
      };
      const rt = JSON.parse(JSON.stringify(this._matchConfig));
      if (JSON.stringify(rt) !== JSON.stringify(this._matchConfig)) console.error('MatchConfig round-trip FAILED');
    }

    this._state = createInitialState(this._matchConfig, this.trackData);

    const lg = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const x = LANE_START_X + i * (LANE_WIDTH + LANE_GAP);
      lg.fillStyle(LANE_COLORS[i]); lg.fillRect(x, 0, LANE_WIDTH, CANVAS_H);
      lg.lineStyle(1, 0xFFFFFF, 0.08); lg.strokeRect(x, 0, LANE_WIDTH, CANVAS_H);
    }

    this._players = this._matchConfig.players.map(pc => new Player(this, {
      visualOffsetX: this.mode === '2p' ? (pc.slot === 1 ? 30 : -30) : 0,
      bodyColor:     pc.slot === 1 ? P2_COLOR : 0xFFFFFF
    }));
    this._obstacles = new Obstacles(this, this.mode === '2p' ? 2 : 1);

    if (this.mode === '2p') {
      this._hudRefs = buildHud2P(this, this._state.players[0].slots, this._state.players[1].slots);
      this._warningArrow = this.add.graphics().setDepth(15);
      this._warningText  = this.add.text(0, 0, '', { fontSize: '13px', fontFamily: 'monospace', color: '#FF9900', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(15);
      this._playerLabels = this._matchConfig.players.map(pc => this.add.text(0, 0, `P${pc.slot + 1}`, {
        fontSize: '12px', fontFamily: 'monospace', color: pc.slot === 1 ? '#E8A33D' : '#FFFFFF',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 1).setDepth(6));
    } else {
      this._hudRefs = buildHud1P(this, this._state.players[0].slots);
      this._reactiveOverlay = this.add.graphics();
      this._reactiveText = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 70, '', {
        fontSize: '36px', fontFamily: 'monospace', color: '#FFFF00',
        align: 'center', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(10);
    }

    const KC = Phaser.Input.Keyboard.KeyCodes;
    const addKey = code => this.input.keyboard.addKey(KC[code]);
    this._keys = {
      p1Left:  addKey(BINDINGS.p1.left),
      p1Right: addKey(BINDINGS.p1.right),
      p1Boost: BINDINGS.p1.boost.map(k => addKey(k))
    };
    if (this.mode === '2p') {
      this._keys.p2Left  = addKey(BINDINGS.p2.left);
      this._keys.p2Right = addKey(BINDINGS.p2.right);
      this._keys.p2Boost = BINDINGS.p2.boost.map(k => addKey(k));
    }
    if (this.mode === '1p') {
      this._keys.p1LeftAlt  = addKey('LEFT');
      this._keys.p1RightAlt = addKey('RIGHT');
    }
  }

  update(_t, delta) {
    if (!this._isReplay) this._processKeyboardInput();
    this._accumMs += delta;
    let ticks = 0;
    while (this._accumMs >= MS_PER_TICK && ticks < 5) {
      const tickIntents = this._isReplay
        ? this._replayIntents.filter(i => i.tick === this._simTick)
        : this._intentQueue.filter(i => i.tick === this._simTick);
      if (!this._isReplay) {
        this._intentQueue = this._intentQueue.filter(i => i.tick !== this._simTick);
        this._intentLog.push(...tickIntents);
      }
      this._state = step(this._state, tickIntents);
      handleSimEvents(this, this._state, this._players);
      this._accumMs -= MS_PER_TICK;
      this._simTick++;
      ticks++;
    }
    this._render(this._state);
    this._checkTransition(this._state);
  }

  _processKeyboardInput() {
    const tick = this._simTick;
    const emit = intent => this._intentQueue.push(intent);
    const wasDown = id => this._keyState[id] || false;
    const setDown = (id, v) => { this._keyState[id] = v; };
    const isDown  = key => key?.isDown || false;
    const checkLane = (key, keyId, playerSlot, type) => {
      const now = isDown(key), was = wasDown(keyId);
      if (now && !was) emit({ tick, playerSlot, type });
      setDown(keyId, now);
    };
    const checkBoost = (key, keyId, playerSlot, slot) => {
      const now = isDown(key), was = wasDown(keyId);
      if (now && !was) emit({ tick, playerSlot, type: 'boost_down', slot });
      if (!now && was) emit({ tick, playerSlot, type: 'boost_up',   slot });
      setDown(keyId, now);
    };
    checkLane(this._keys.p1Left,  'p1_left',  0, 'lane_left');
    checkLane(this._keys.p1Right, 'p1_right', 0, 'lane_right');
    if (this.mode === '1p') {
      checkLane(this._keys.p1LeftAlt,  'p1_left_alt',  0, 'lane_left');
      checkLane(this._keys.p1RightAlt, 'p1_right_alt', 0, 'lane_right');
    }
    this._keys.p1Boost?.forEach((k, i) => checkBoost(k, `p1_b${i}`, 0, i));
    if (this.mode === '2p') {
      checkLane(this._keys.p2Left,  'p2_left',  1, 'lane_left');
      checkLane(this._keys.p2Right, 'p2_right', 1, 'lane_right');
      this._keys.p2Boost?.forEach((k, i) => checkBoost(k, `p2_b${i}`, 1, i));
    }
  }

  _render(state) {
    const camScaled = state.mode === '2p' ? state.camPositionScaled : state.players[0].trackPosition;
    this._obstacles.render(state.obstacles, camScaled);
    state.players.forEach((ps, i) => {
      const gap = camScaled - ps.trackPosition;
      this._players[i].y = Math.min(PLAYER_Y + gap / POSITION_SCALE, TRAIL_PIN_Y);
      this._players[i].render(ps);
    });
    if (state.mode === '1p') {
      renderReactiveOverlay1P(this._reactiveOverlay, this._reactiveText, state);
      updateHud1P(this._hudRefs, state);
    } else {
      updateHud2P(this._hudRefs, state);
      renderWarningArrow(this._warningArrow, this._warningText, state.players, this._players, CANVAS_H);
      updatePlayerLabels(this._playerLabels, state.players, this._players);
    }
  }

  _checkTransition(state) {
    if (this._transitioning) return;
    const terminal = gs => !['RUNNING','REACTIVE'].includes(gs);
    const done = state.mode === '1p'
      ? terminal(state.players[0].gs)
      : state.players.every(ps => terminal(ps.gs));
    if (!done) return;
    this._transitioning = true;

    if (!this._isReplay) saveReplay(this._matchConfig, this._intentLog, state.players[0].gs);

    if (state.mode === '1p') {
      const ps = state.players[0];
      const dist = Math.floor(ps.trackPosition / POSITION_SCALE);
      const ticks = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
      const elapsed = parseFloat((ticks / TICK_RATE).toFixed(2));
      appendLog({ track: this.trackData.id, loadout: ps.loadout,
        outcome: ps.gs === 'COMPLETE' ? 'complete' : 'failed', distance: dist,
        elapsedMs: Math.round(elapsed * 1000), boostUses: { ...ps.boostUseCount },
        laneTimeTicks: [...ps.laneTimeTicks], planningTimeMs: this.planningTimeMs });
      const replayData = this._isReplay
        ? { replayOutcome: ps.gs, replayMatched: ps.gs === this._replayOriginalOutcome }
        : {};
      this.scene.start('ResultScene', { mode: '1p', result: ps.gs, distance: dist, elapsed,
        trackData: this.trackData, loadout: ps.loadout, ...replayData });
    } else {
      const pData = state.players.map(ps => {
        const dist    = Math.floor(ps.trackPosition / POSITION_SCALE);
        const endTick = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
        const elapsed = parseFloat((endTick / TICK_RATE).toFixed(2));
        return { result: ps.gs, distance: dist, elapsed,
          loadout: [...ps.loadout], boostUses: { ...ps.boostUseCount },
          laneTimeTicks: [...ps.laneTimeTicks] };
      });

      // Determine winner for log + XP bonus
      const [d0, d1] = [pData[0], pData[1]];
      const winner = (() => {
        const c0 = d0.result === 'COMPLETE', c1 = d1.result === 'COMPLETE';
        if (c0 && c1) { if (d0.elapsed < d1.elapsed) return 'p1'; if (d1.elapsed < d0.elapsed) return 'p2'; return 'draw'; }
        if (c0) return 'p1'; if (c1) return 'p2';
        if (d0.distance > d1.distance) return 'p1'; if (d1.distance > d0.distance) return 'p2';
        return 'draw';
      })();

      appendLog({
        track: this.trackData.id, mode: '2p',
        players: [
          { slot: 'p1', loadout: d0.loadout, outcome: d0.result === 'COMPLETE' ? 'complete' : 'failed',
            distance: d0.distance, elapsedMs: Math.round(d0.elapsed * 1000),
            boostUses: d0.boostUses, laneTimeTicks: d0.laneTimeTicks },
          { slot: 'p2', loadout: d1.loadout, outcome: d1.result === 'COMPLETE' ? 'complete' : 'failed',
            distance: d1.distance, elapsedMs: Math.round(d1.elapsed * 1000),
            boostUses: d1.boostUses, laneTimeTicks: d1.laneTimeTicks }
        ],
        winner, planningTimeMs: this.planningTimeMs
      });

      this.time.delayedCall(1500, () => {
        this.scene.start('ResultScene', {
          mode: '2p', trackData: this.trackData, players: pData,
          winner, planningTimeMs: this.planningTimeMs
        });
      });
    }
  }
}
