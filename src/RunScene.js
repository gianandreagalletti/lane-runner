import Phaser from 'phaser';
import { Player }     from './player.js';
import { Obstacles }  from './obstacles.js';
import { appendLog, saveReplay } from './sessionLog.js';
import { BINDINGS, PLAYER_COLORS, PLAYER_OFFSETS } from './controls.js';
import { createInitialState } from '../sim/state.js';
import { step } from '../sim/step.js';
import {
  CANVAS_W, CANVAS_H
} from './track.js';
import { CENTI_SCALE, TICK_RATE } from '../sim/rules.js';
import { buildHud1P, buildHudMP, updateHud1P, updateHudMP } from './RunSceneHud.js';
import {
  renderReactiveOverlay1P, renderWarningArrows,
  updatePlayerLabels, handleSimEvents
} from './RunSceneRenderer.js';
import { GamepadInput } from './GamepadInput.js';
import { GroundRenderer } from './render/GroundRenderer.js';
import { PROJ, LANE_TU, project, initProjection } from './render/projection.js';

const MS_PER_TICK = 1000 / TICK_RATE;

export class RunScene extends Phaser.Scene {
  constructor() { super({ key: 'RunScene' }); }

  init(data) {
    this.trackData      = data.trackData;
    this.mode           = data.mode || '1p';
    this.planningTimeMs = data.planningTimeMs ?? 0;
    this._isReplay      = data.isReplay || false;
    this._replayIntents = data.replayIntents || [];
    this._replayOriginalOutcome = data.originalOutcome || null;
    this._claims        = data.claims || null;

    // Generalize loadouts
    if (this.mode === '1p') {
      this._loadouts = [data.loadout ?? []];
    } else if (this.mode === '2p') {
      this._loadouts = [data.loadoutP1 ?? data.loadout ?? [], data.loadoutP2 ?? data.loadout ?? []];
    } else {
      this._loadouts = [data.loadoutP1 ?? [], data.loadoutP2 ?? [], data.loadoutP3 ?? []];
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
    const numPlayers = this.mode === '3p' ? 3 : this.mode === '2p' ? 2 : 1;
    const profileIds = ['p1', 'p2', 'p3'];
    if (!this._isReplay) {
      this._matchConfig = {
        trackId: this.trackData.id, seed: Date.now() & 0xFFFFFF,
        mode: this.mode, rules: {},
        players: Array.from({ length: numPlayers }, (_, i) => ({
          slot: i,
          profileId: profileIds[i],
          inputSource: this._claims ? this._claims[i].inputSource : (i === 0 ? 'local_keyboard' : 'pad'),
          loadout: JSON.parse(JSON.stringify(this._loadouts[i]))
        }))
      };
      const rt = JSON.parse(JSON.stringify(this._matchConfig));
      if (JSON.stringify(rt) !== JSON.stringify(this._matchConfig)) console.error('MatchConfig round-trip FAILED');
    }

    this._state = createInitialState(this._matchConfig, this.trackData);

    // Initialise projection with canvas dimensions
    initProjection(CANVAS_W, CANVAS_H);

    // Ground renderer (depth 0) — replaces static lane graphics
    this._groundRenderer = new GroundRenderer(this);

    this._players = this._matchConfig.players.map((pc, i) => new Player(this, {
      visualOffsetX: numPlayers > 1 ? PLAYER_OFFSETS[i] : 0,
      bodyColor:     PLAYER_COLORS[i],
      vehicleIdx:    i   // 0=ambulance, 1=fire truck, 2=police
    }));
    this._obstacles = new Obstacles(this, numPlayers);

    if (this.mode === '1p') {
      this._hudRefs = buildHud1P(this, this._state.players[0].slots);
      this._reactiveOverlay = this.add.graphics();
      this._reactiveText = this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 70, '', {
        fontSize: '36px', fontFamily: 'monospace', color: '#FFFF00',
        align: 'center', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(10);
    } else {
      const allSlots = this._state.players.map(ps => ps.slots);
      this._hudRefs = buildHudMP(this, allSlots);
      this._warningArrow = this.add.graphics().setDepth(15);
      this._warningTexts = this._state.players.map(() => this.add.text(0, 0, '', {
        fontSize: '13px', fontFamily: 'monospace', color: '#FF9900', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 1).setDepth(15));
      // Vehicle label colours: ambulance white, fire truck red, police blue
      this._playerLabels = this._matchConfig.players.map((pc, i) => this.add.text(0, 0, `P${i + 1}`, {
        fontSize: '12px', fontFamily: 'monospace', color: ['#F0F0F0', '#C4463A', '#3A5ACD'][i] || '#F0F0F0',
        stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 1).setDepth(6));
    }

    this._padSlotMap = new Map();
    if (this._claims) {
      this._claims.forEach((claim, slot) => {
        if (claim && claim.inputSource === 'pad') this._padSlotMap.set(claim.padIndex, slot);
      });
    }
    this._gamepadInput = (this._padSlotMap.size > 0 || this.mode !== '1p')
      ? new GamepadInput(this, this._padSlotMap) : null;
    this.input.gamepad?.on('disconnected', pad => {
      if (this._gamepadInput) {
        const intents = this._gamepadInput.onDisconnect(pad.index, this._simTick);
        this._intentQueue.push(...intents);
      }
    });

    // Keyboard setup — generalize for all slots
    const KC = Phaser.Input.Keyboard.KeyCodes;
    const addKey = code => this.input.keyboard.addKey(KC[code]);
    const allBindings = [BINDINGS.p1, BINDINGS.p2, BINDINGS.p3];
    this._keys = {};
    const numKbPlayers = Math.min(numPlayers, allBindings.length);
    for (let i = 0; i < numKbPlayers; i++) {
      const b = allBindings[i];
      this._keys[`p${i}_left`]  = addKey(b.left);
      this._keys[`p${i}_right`] = addKey(b.right);
      this._keys[`p${i}_boost`] = b.boost.map(k => addKey(k));
    }
    if (this.mode === '1p') {
      this._keys.p0_leftAlt  = addKey('LEFT');
      this._keys.p0_rightAlt = addKey('RIGHT');
    }

    // Listen for resize to recompute projection
    this.scale.on('resize', (gameSize) => {
      initProjection(gameSize.width, gameSize.height);
    });
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
      // Invalidate obstacle cull index when a caltrop is placed
      for (const ev of this._state.events) {
        if (ev.type === 'caltrop_placed') this._obstacles.invalidateCullIndex();
      }
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
    const numP = this._matchConfig.players.length;
    for (let i = 0; i < numP; i++) {
      const lKey = this._keys[`p${i}_left`];
      const rKey = this._keys[`p${i}_right`];
      if (lKey) checkLane(lKey, `p${i}_l`, i, 'lane_left');
      if (rKey) checkLane(rKey, `p${i}_r`, i, 'lane_right');
      if (i === 0 && this.mode === '1p') {
        checkLane(this._keys.p0_leftAlt,  'p0_la', 0, 'lane_left');
        checkLane(this._keys.p0_rightAlt, 'p0_ra', 0, 'lane_right');
      }
      const boostKeys = this._keys[`p${i}_boost`] || [];
      boostKeys.forEach((k, j) => checkBoost(k, `p${i}_b${j}`, i, j));
    }

    // Gamepad intents
    if (this._gamepadInput) {
      const padIntents = this._gamepadInput.poll(tick);
      this._intentQueue.push(...padIntents);
    }
  }

  _render(state) {
    // --- Camera position ---
    const positions = state.players
      .filter(ps => ps.gs === 'RUNNING' || ps.gs === 'REACTIVE')
      .map(ps => ps.trackPosition / CENTI_SCALE);

    const minZ = positions.length > 0 ? Math.min(...positions) : 0;
    const maxZ = positions.length > 0 ? Math.max(...positions) : 0;

    // Camera sits CAM_BACK behind the last player, but never so close that
    // the leader is at the near plane (MIN_LEAD_MARGIN ensures leader stays visible)
    const cameraZ = Math.min(
      minZ - PROJ.CAM_BACK,
      maxZ - PROJ.CAM_BACK - PROJ.MIN_LEAD_MARGIN
    );

    // 1. Ground/sky/lanes
    this._groundRenderer.render(cameraZ);

    // 2. Build combined renderable list (obstacles + players)
    const renderables = [];

    // Obstacles
    this._obstacles.graphics.clear();
    const obsItems = this._obstacles.getRenderItems(state.obstacles, cameraZ);
    renderables.push(...obsItems);

    // Pickups (always visible)
    const pickupItems = this._obstacles.getPickupRenderItems(state.pickups, cameraZ);
    renderables.push(...pickupItems);

    // Projectiles
    for (const proj of state.projectiles) {
      const zRel = proj.z / CENTI_SCALE - cameraZ;
      if (zRel >= PROJ.NEAR_CLAMP && zRel <= PROJ.DRAW_DISTANCE) {
        renderables.push({ type: 'projectile', proj, zRel });
      }
    }

    // Players
    state.players.forEach((ps, i) => {
      const zRel = ps.trackPosition / CENTI_SCALE - cameraZ;
      renderables.push({ type: 'player', ps, idx: i, zRel });
    });

    // 3. Sort far-to-near (descending zRel)
    renderables.sort((a, b) => b.zRel - a.zRel);

    // 4. Draw in order
    for (const item of renderables) {
      if (item.type === 'obstacle') {
        this._obstacles.drawItem(item.obs, item.zRel);
      } else if (item.type === 'pickup') {
        this._obstacles.drawPickup(item.pu, item.zRel);
      } else if (item.type === 'projectile') {
        this._obstacles.drawProjectile(item.proj, item.zRel);
      } else {
        this._players[item.idx].render(item.ps, cameraZ, item.idx, state.tick);
      }
    }

    // 5. HUD (stays flat / 2D)
    if (state.mode === '1p') {
      renderReactiveOverlay1P(this._reactiveOverlay, this._reactiveText, state);
      updateHud1P(this._hudRefs, state);
    } else {
      updateHudMP(this._hudRefs, state);
      renderWarningArrows(this._warningArrow, this._warningTexts, state, this._players, CANVAS_H);
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
      const dist = Math.floor(ps.trackPosition / CENTI_SCALE);
      const ticks = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
      const elapsed = parseFloat((ticks / TICK_RATE).toFixed(2));
      appendLog({ track: this.trackData.id, loadout: ps.loadout,
        outcome: ps.gs === 'COMPLETE' ? 'complete' : 'failed', distance: dist,
        elapsedMs: Math.round(elapsed * 1000),
        boostUses: { rock_break: ps.boostUseCount.rock_break ?? 0,
                     sprint: ps.boostUseCount.sprint ?? 0,
                     caltrop: ps.boostUseCount.caltrop ?? 0,
                     snipe_shot: ps.boostUseCount.snipe_shot ?? 0 },
        laneTimeTicks: [...ps.laneTimeTicks], planningTimeMs: this.planningTimeMs });
      const replayData = this._isReplay
        ? { replayOutcome: ps.gs, replayMatched: ps.gs === this._replayOriginalOutcome }
        : {};
      this.scene.start('ResultScene', { mode: '1p', result: ps.gs, distance: dist, elapsed,
        trackData: this.trackData, loadout: ps.loadout, ...replayData });
    } else {
      const pData = state.players.map(ps => {
        const dist    = Math.floor(ps.trackPosition / CENTI_SCALE);
        const endTick = ps.gsEndTick >= 0 ? ps.gsEndTick : state.tick;
        const elapsed = parseFloat((endTick / TICK_RATE).toFixed(2));
        return { result: ps.gs, distance: dist, elapsed, loadout: JSON.parse(JSON.stringify(ps.loadout)),
          boostUses: { ...ps.boostUseCount }, laneTimeTicks: [...ps.laneTimeTicks],
          inputSource: this._matchConfig.players[ps.idx].inputSource };
      });

      // Compute placements
      const sorted = [...pData.entries()].sort(([, a], [, b]) => {
        const ac = a.result === 'COMPLETE', bc = b.result === 'COMPLETE';
        if (ac && !bc) return -1; if (!ac && bc) return 1;
        if (ac && bc) return a.elapsed - b.elapsed;
        return b.distance - a.distance;
      });
      const placements = new Array(pData.length);
      let place = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
          const [, prev] = sorted[i - 1], [, cur] = sorted[i];
          const tie = prev.result === 'COMPLETE' && cur.result === 'COMPLETE'
            ? prev.elapsed === cur.elapsed
            : prev.result !== 'COMPLETE' && cur.result !== 'COMPLETE'
              ? prev.distance === cur.distance
              : false;
          if (!tie) place = i + 1;
        }
        placements[sorted[i][0]] = place;
      }
      appendLog({
        track: this.trackData.id, mode: this.mode,
        players: pData.map((d, i) => ({
          slot: `p${i+1}`, loadout: d.loadout,
          outcome: d.result === 'COMPLETE' ? 'complete' : 'failed',
          distance: d.distance, elapsedMs: Math.round(d.elapsed * 1000),
          boostUses: d.boostUses, laneTimeTicks: d.laneTimeTicks,
          inputSource: d.inputSource
        })),
        placements: placements.map((p, i) => ({ slot: `p${i+1}`, place: p })),
        planningTimeMs: this.planningTimeMs
      });

      this.time.delayedCall(1500, () => {
        this.scene.start('ResultScene', {
          mode: this.mode, trackData: this.trackData, players: pData,
          placements, planningTimeMs: this.planningTimeMs, claims: this._claims
        });
      });
    }
  }
}
