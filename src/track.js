// ─── Layout constants ────────────────────────────────────────────────────────
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const LANE_WIDTH = 200;
export const LANE_GAP   = 40;
export const LANE_START_X = (CANVAS_W - LANE_WIDTH * 3 - LANE_GAP * 2) / 2; // 300

export const LANE_CENTERS = [
  LANE_START_X + LANE_WIDTH / 2,                          // 400
  LANE_START_X + LANE_WIDTH + LANE_GAP + LANE_WIDTH / 2,  // 640
  LANE_START_X + 2 * (LANE_WIDTH + LANE_GAP) + LANE_WIDTH / 2 // 880
];

export const LANE_COLORS = [
  0x8B6F47,
  0x9AA5B1,
  0x4A90A4
];

export const PLAYER_Y       = 550;
export const BASE_SPEED     = 200;
export const LANE_SWITCH_MS = 150;

export const OBS_W = 160;
export const OBS_H = 60;

export const OBS_COLORS = {
  rock:  0xC4463A,
  ice:   0xB8D8E8,
  water: 0x3AA8C4
};

// ─── Track 1 ─────────────────────────────────────────────────────────────────
// 10 bands, 21 obstacles over 4000 units.
// Two unavoidable debuff bands (dist 2400 and 3600).
export const TRACK_1 = {
  id:     'track_1',
  name:   'Track 1',
  length: 4000,
  obstacles: [
    { lane: 0, distance:  400, type: 'rock' },
    { lane: 1, distance:  400, type: 'ice'  },

    { lane: 1, distance:  750, type: 'rock'  },
    { lane: 2, distance:  750, type: 'water' },

    { lane: 0, distance: 1050, type: 'ice'  },
    { lane: 2, distance: 1050, type: 'rock' },

    { lane: 0, distance: 1400, type: 'rock' },
    { lane: 1, distance: 1400, type: 'rock' },

    { lane: 1, distance: 1700, type: 'water' },
    { lane: 2, distance: 1700, type: 'rock'  },

    { lane: 0, distance: 2100, type: 'rock' },
    { lane: 2, distance: 2100, type: 'ice'  },

    { lane: 0, distance: 2400, type: 'ice'   }, // ALL BLOCKED — take ice L0
    { lane: 1, distance: 2400, type: 'rock'  },
    { lane: 2, distance: 2400, type: 'water' },

    { lane: 1, distance: 2800, type: 'rock' },
    { lane: 2, distance: 2800, type: 'ice'  },

    { lane: 0, distance: 3200, type: 'water' },
    { lane: 2, distance: 3200, type: 'rock'  },

    { lane: 0, distance: 3600, type: 'rock' }, // ALL BLOCKED — take ice L2
    { lane: 1, distance: 3600, type: 'rock' },
    { lane: 2, distance: 3600, type: 'ice'  }
  ]
};

// ─── Track 2 ─────────────────────────────────────────────────────────────────
// Denser, mixes two obstacle types within the same lane.
// 5000 units, 14 bands (27 obstacles).
//
// Two verified winning loadouts:
//   A) ice_grip + water_shield + rock_break  — passives cover all debuffs, rock_break as insurance
//   B) ice_grip + rock_break + phase         — rock_break + phase handle the two forced-rock bands
//
// Unavoidable debuff zones: dist 1000 (ice L2 if no active used),
//   dist 1900 (ice L0 or water L1), dist 3000 (ice L2 or water L0).
export const TRACK_2 = {
  id:     'track_2',
  name:   'Track 2',
  length: 5000,
  obstacles: [
    // Band 1 dist 400: rock L0, water L1  →  L2 clear
    { lane: 0, distance:  400, type: 'rock'  },
    { lane: 1, distance:  400, type: 'water' },

    // Band 2 dist 700: ice L1, rock L2  →  L0 clear
    { lane: 1, distance:  700, type: 'ice'  },
    { lane: 2, distance:  700, type: 'rock' },

    // Band 3 dist 1000: ALL BLOCKED rock L0, rock L1, ice L2  →  take ice L2
    { lane: 0, distance: 1000, type: 'rock' },
    { lane: 1, distance: 1000, type: 'rock' },
    { lane: 2, distance: 1000, type: 'ice'  },

    // Band 4 dist 1300: water L0, rock L1  →  L2 clear
    { lane: 0, distance: 1300, type: 'water' },
    { lane: 1, distance: 1300, type: 'rock'  },

    // Band 5 dist 1600: rock L0, ice L2  →  L1 clear
    { lane: 0, distance: 1600, type: 'rock' },
    { lane: 2, distance: 1600, type: 'ice'  },

    // Band 6 dist 1900: ALL BLOCKED ice L0, water L1, rock L2  →  take ice L0
    { lane: 0, distance: 1900, type: 'ice'   },
    { lane: 1, distance: 1900, type: 'water' },
    { lane: 2, distance: 1900, type: 'rock'  },

    // Band 7 dist 2300: rock L1, water L2  →  L0 clear
    { lane: 1, distance: 2300, type: 'rock'  },
    { lane: 2, distance: 2300, type: 'water' },

    // Band 8 dist 2700: ice L0, rock L1  →  L2 clear
    { lane: 0, distance: 2700, type: 'ice'  },
    { lane: 1, distance: 2700, type: 'rock' },

    // Band 9 dist 3000: ALL BLOCKED water L0, rock L1, ice L2  →  take ice L2 or water L0
    { lane: 0, distance: 3000, type: 'water' },
    { lane: 1, distance: 3000, type: 'rock'  },
    { lane: 2, distance: 3000, type: 'ice'   },

    // Band 10 dist 3400: rock L0, water L1  →  L2 clear
    { lane: 0, distance: 3400, type: 'rock'  },
    { lane: 1, distance: 3400, type: 'water' },

    // Band 11 dist 3800: ice L1, rock L2  →  L0 clear
    { lane: 1, distance: 3800, type: 'ice'  },
    { lane: 2, distance: 3800, type: 'rock' },

    // Band 12 dist 4100: ALL BLOCKED rock L0, rock L1, water L2  →  take water L2
    { lane: 0, distance: 4100, type: 'rock'  },
    { lane: 1, distance: 4100, type: 'rock'  },
    { lane: 2, distance: 4100, type: 'water' },

    // Band 13 dist 4500: ice L0, rock L2  →  L1 clear
    { lane: 0, distance: 4500, type: 'ice'  },
    { lane: 2, distance: 4500, type: 'rock' },

    // Band 14 dist 4800: rock L1, ice L2  →  L0 clear
    { lane: 1, distance: 4800, type: 'rock' },
    { lane: 2, distance: 4800, type: 'ice'  }
  ]
};

// ─── Track 3 ─────────────────────────────────────────────────────────────────
// Gauntlet design: cannot be completed by staying in any one lane.
// Every lane accumulates 3+ rocks in the mid-section so no boost combo
// (max 2 rock_breaks + 1 phase = 3 reactive uses) can keep a single-lane
// player alive — the gauntlet bands at 2000-2600 force 3 mandatory switches.
//
// Additionally every lane has rocks spread across the full 5500 units,
// so a player who never switches will hit a rock regardless of lane.
export const TRACK_3 = {
  id:     'track_3',
  name:   'Track 3',
  length: 5500,
  obstacles: [
    // ── Early section: standard navigation ───────────────────────────────
    { lane: 0, distance:  350, type: 'rock'  },
    { lane: 1, distance:  350, type: 'water' },

    { lane: 0, distance:  650, type: 'ice'  },
    { lane: 2, distance:  650, type: 'rock' },

    { lane: 1, distance:  950, type: 'rock' },
    { lane: 2, distance:  950, type: 'ice'  },

    { lane: 0, distance: 1250, type: 'rock'  },
    { lane: 1, distance: 1250, type: 'rock'  },  // must be L2

    { lane: 1, distance: 1550, type: 'water' },
    { lane: 2, distance: 1550, type: 'rock'  },

    { lane: 0, distance: 1800, type: 'ice'  },
    { lane: 2, distance: 1800, type: 'rock' },

    // ── GAUNTLET (dist 2000-2700): forced 3 lane-switches ────────────────
    // Step 1: only L1 survives (L0 rock, L2 rock)
    { lane: 0, distance: 2000, type: 'rock' },
    { lane: 2, distance: 2000, type: 'rock' },
    { lane: 1, distance: 2000, type: 'ice'  },  // L1 costs ice slow unless ice_grip

    // Step 2: only L0 survives (L1 rock, L2 rock) — coming from L1, must shift L1→L0
    { lane: 1, distance: 2250, type: 'rock' },
    { lane: 2, distance: 2250, type: 'rock' },

    // Step 3: only L2 survives (L0 rock, L1 rock) — coming from L0, must shift L0→L1→L2
    { lane: 0, distance: 2550, type: 'rock' },
    { lane: 1, distance: 2550, type: 'rock' },

    // Step 4: only L1 survives (L0 rock, L2 rock) — must switch back
    { lane: 0, distance: 2800, type: 'rock'  },
    { lane: 2, distance: 2800, type: 'water' },

    // ── Late section: more forced tradeoffs ───────────────────────────────
    { lane: 0, distance: 3100, type: 'rock' },
    { lane: 1, distance: 3100, type: 'ice'  },

    { lane: 0, distance: 3100, type: 'water' }, // same dist, double-tap L0 (ice+water)
    // (This makes L0 particularly painful here even with one passive)

    { lane: 1, distance: 3500, type: 'rock'  },
    { lane: 2, distance: 3500, type: 'water' },

    { lane: 0, distance: 3800, type: 'ice'  },
    { lane: 2, distance: 3800, type: 'rock' },

    { lane: 0, distance: 4100, type: 'rock' }, // ALL BLOCKED
    { lane: 1, distance: 4100, type: 'rock' },
    { lane: 2, distance: 4100, type: 'ice'  },

    { lane: 1, distance: 4500, type: 'water' },
    { lane: 2, distance: 4500, type: 'rock'  },

    { lane: 0, distance: 4800, type: 'rock' },
    { lane: 1, distance: 4800, type: 'ice'  },

    { lane: 0, distance: 5200, type: 'rock'  }, // finale: L0 rock, L2 rock
    { lane: 2, distance: 5200, type: 'rock'  },
    { lane: 1, distance: 5200, type: 'water' }
  ]
};

export const ALL_TRACKS = [TRACK_1, TRACK_2, TRACK_3];
