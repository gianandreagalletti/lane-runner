// Gamepad intent producer — reads Phaser gamepad API, emits intents onto the queue.
// No sim/ imports. No gameplay logic. Only produces { tick, playerSlot, type, slot? }.

const DEADZONE     = 0.5;
const AXIS_X       = 0;    // left stick horizontal
const BTN_A        = 0;    // boost slot 0
const BTN_B        = 1;    // boost slot 2
const BTN_X        = 2;    // boost slot 1
const BTN_DPAD_L   = 14;
const BTN_DPAD_R   = 15;

export class GamepadInput {
  // scene: Phaser scene with input.gamepad available
  // slotAssignments: Map<padIndex, playerSlot> — which pad maps to which player slot
  constructor(scene, slotAssignments) {
    this.scene           = scene;
    this.slotAssignments = slotAssignments; // Map<padIndex, playerSlot>

    // Per-pad state for edge detection
    // padStates[padIndex] = { stickArmed: bool, prevButtons: {0: bool, 1: bool, 2: bool, 14: bool, 15: bool} }
    this._padStates = {};
  }

  // Call once per frame before the sim tick loop.
  // Returns array of intent objects to push onto the queue.
  poll(simTick) {
    if (!this.scene.input.gamepad) return [];
    const intents = [];
    const pads = this.scene.input.gamepad.gamepads;

    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const playerSlot = this.slotAssignments.get(pad.index);
      if (playerSlot === undefined) continue;

      if (!this._padStates[pad.index]) {
        this._padStates[pad.index] = { stickArmed: true, prevButtons: {} };
      }
      const st = this._padStates[pad.index];

      // ── Left stick X — edge-triggered ────────────────────────────────────
      const stickX = typeof pad.axes[AXIS_X]?.getValue === 'function'
        ? pad.axes[AXIS_X].getValue()
        : (pad.axes[AXIS_X] ?? 0);
      if (st.stickArmed) {
        if (stickX < -DEADZONE) {
          intents.push({ tick: simTick, playerSlot, type: 'lane_left' });
          st.stickArmed = false;
        } else if (stickX > DEADZONE) {
          intents.push({ tick: simTick, playerSlot, type: 'lane_right' });
          st.stickArmed = false;
        }
      } else if (Math.abs(stickX) < DEADZONE) {
        // Returned to center — re-arm for next trigger
        st.stickArmed = true;
      }

      // ── D-pad — edge-triggered via button state ───────────────────────────
      this._checkButtonLane(pad, st, BTN_DPAD_L, simTick, playerSlot, 'lane_left',  intents);
      this._checkButtonLane(pad, st, BTN_DPAD_R, simTick, playerSlot, 'lane_right', intents);

      // ── Face buttons — boost_down / boost_up ─────────────────────────────
      // A=slot0, X=slot1, B=slot2
      this._checkButtonBoost(pad, st, BTN_A, 0, simTick, playerSlot, intents);
      this._checkButtonBoost(pad, st, BTN_X, 1, simTick, playerSlot, intents);
      this._checkButtonBoost(pad, st, BTN_B, 2, simTick, playerSlot, intents);
    }

    return intents;
  }

  _checkButtonLane(pad, st, btnIdx, tick, playerSlot, type, intents) {
    const isDown  = (pad.buttons[btnIdx]?.value ?? 0) > 0.5;
    const wasDown = st.prevButtons[btnIdx] || false;
    if (isDown && !wasDown) intents.push({ tick, playerSlot, type });
    st.prevButtons[btnIdx] = isDown;
  }

  _checkButtonBoost(pad, st, btnIdx, boostSlot, tick, playerSlot, intents) {
    const isDown  = (pad.buttons[btnIdx]?.value ?? 0) > 0.5;
    const wasDown = st.prevButtons[btnIdx] || false;
    if (isDown  && !wasDown) intents.push({ tick, playerSlot, type: 'boost_down', slot: boostSlot });
    if (!isDown && wasDown)  intents.push({ tick, playerSlot, type: 'boost_up',   slot: boostSlot });
    st.prevButtons[btnIdx] = isDown;
  }

  // Call when a pad disconnects mid-run — emit boost_up for all held buttons
  onDisconnect(padIndex, simTick) {
    const playerSlot = this.slotAssignments.get(padIndex);
    if (playerSlot === undefined) return [];
    const intents = [];
    const st = this._padStates[padIndex];
    if (!st) return intents;
    // Release any held boost buttons
    for (const [btnIdx, boostSlot] of [[BTN_A, 0], [BTN_X, 1], [BTN_B, 2]]) {
      if (st.prevButtons[btnIdx]) {
        intents.push({ tick: simTick, playerSlot, type: 'boost_up', slot: boostSlot });
        st.prevButtons[btnIdx] = false;
      }
    }
    return intents;
  }
}
