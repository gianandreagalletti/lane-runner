// Single source of truth for all key bindings.
// All input handling and UI must reference this — no key literals elsewhere.

// Canonical slots: 0=rock_break, 1=sprint, 2=caltrop, 3=snipe_shot
export const BINDINGS = {
  p1:     { left: 'A',    right: 'D',     boost: ['ONE',   'TWO',   'THREE', 'FOUR'] },
  p2:     { left: 'LEFT', right: 'RIGHT', boost: ['EIGHT', 'NINE',  'ZERO',  'SEVEN'] },
  p3:     { left: 'Q',    right: 'E',     boost: ['I',     'O',     'P',     'U']    },
  global: { retry: 'R',   menu: 'M',      back:  'ESCAPE', advance: 'SPACE'  }
};

// Human-readable labels for display (reactive hints, controls screen, etc.)
export const KEY_DISPLAY = {
  A: 'A', D: 'D', LEFT: '←', RIGHT: '→',
  Q: 'Q', E: 'E',
  ONE: '1', TWO: '2', THREE: '3', FOUR: '4',
  SEVEN: '7', EIGHT: '8', NINE: '9', ZERO: '0',
  I: 'I', O: 'O', P: 'P', U: 'U',
  R: 'R', M: 'M', ESCAPE: 'ESC', SPACE: 'SPACE', ENTER: 'ENTER'
};

// Player colours (index = slot)
export const PLAYER_COLORS = [0xFFFFFF, 0xE8A33D, 0x4FD1C5];
export const PLAYER_COLOR_HEX = ['#FFFFFF', '#E8A33D', '#4FD1C5'];

// Visual X offsets for 3 players in the same lane (cosmetic only, collision uses lane)
export const PLAYER_OFFSETS = [-45, 0, 45];
