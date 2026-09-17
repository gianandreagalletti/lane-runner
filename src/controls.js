// Single source of truth for all key bindings.
// All input handling and UI must reference this — no key literals elsewhere.

export const BINDINGS = {
  p1:     { left: 'A',    right: 'D',     boost: ['ONE',   'TWO',   'THREE'] },
  p2:     { left: 'LEFT', right: 'RIGHT', boost: ['EIGHT', 'NINE',  'ZERO']  },
  global: { retry: 'R',   menu: 'M',      back:  'ESCAPE', advance: 'SPACE'  }
};

// Human-readable labels for display (reactive hints, controls screen, etc.)
export const KEY_DISPLAY = {
  A: 'A', D: 'D',
  LEFT: '←', RIGHT: '→',
  ONE: '1', TWO: '2', THREE: '3',
  EIGHT: '8', NINE: '9', ZERO: '0',
  R: 'R', M: 'M', ESCAPE: 'ESC', SPACE: 'SPACE', ENTER: 'ENTER'
};
