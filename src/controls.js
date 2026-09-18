// Single source of truth for all key bindings.
// All input handling and UI must reference this — no key literals elsewhere.

// Canonical slots: 0=rock_break, 1=sprint, 2=caltrop, 3=snipe_shot
//
// Shop-screen nav keys (up/down/confirm) are separate from run-scene lane/boost keys.
// Verified against Phaser.Input.Keyboard.KeyCodes (node_modules/phaser/src/input/keyboard/keys/KeyCodes.js):
//   LEFT, RIGHT, UP, DOWN, ENTER, MINUS, COMMA, PERIOD, SEMICOLON — all exist.
//   SLASH does not exist; forward slash is FORWARD_SLASH.
// P3 confirm = H (avoids conflict with U which is P3 boost slot 3 during the run).
// P3 boost keys (I/O/P/U) are run-scene only and don't conflict with shop nav (I/K/H).
export const BINDINGS = {
  p1: {
    left: 'A', right: 'D',
    up: 'W', down: 'S', confirm: 'F',
    boost: ['ONE', 'TWO', 'THREE', 'FOUR']
  },
  p2: {
    left: 'LEFT', right: 'RIGHT',
    up: 'UP', down: 'DOWN', confirm: 'ENTER',
    boost: ['EIGHT', 'NINE', 'ZERO', 'SEVEN']
  },
  p3: {
    left: 'Q', right: 'E',
    up: 'I', down: 'K', confirm: 'H',
    boost: ['I', 'O', 'P', 'U']
  },
  global: { retry: 'R', menu: 'M', back: 'ESCAPE', advance: 'SPACE' }
};

// Human-readable labels for display (reactive hints, controls screen, etc.)
export const KEY_DISPLAY = {
  A: 'A', D: 'D', W: 'W', S: 'S', F: 'F',
  LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓', ENTER: 'Enter',
  Q: 'Q', E: 'E', I: 'I', K: 'K', H: 'H',
  ONE: '1', TWO: '2', THREE: '3', FOUR: '4',
  SEVEN: '7', EIGHT: '8', NINE: '9', ZERO: '0',
  O: 'O', P: 'P', U: 'U',
  R: 'R', M: 'M', ESCAPE: 'ESC', SPACE: 'SPACE'
};

// Player colours (index = slot)
export const PLAYER_COLORS = [0xFFFFFF, 0xE8A33D, 0x4FD1C5];
export const PLAYER_COLOR_HEX = ['#FFFFFF', '#E8A33D', '#4FD1C5'];

// Visual X offsets for 3 players in the same lane (cosmetic only, collision uses lane)
export const PLAYER_OFFSETS = [-45, 0, 45];
