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
// 10 200 units, 35 bands (~29% gate, ~57% damage, ~14% relief).
// Ice-heavy. Rewards ice_grip. Level 1 loadout completable.
// 10 gates, open lanes: 1→0→1→2→1→0→1→2→1→0 (all shifts ≤1).
// Gates at: 500,1500,2500,3550,4600,5650,6700,7750,8800,9700
// Gaps: 1000,1000,1050,1050,1050,1050,1050,1050,900 — all ≥ 800.
export const TRACK_1 = {
  id:     'track_1',
  name:   'Track 1',
  length: 10200,
  obstacles: [
    // ── Seg 0: pre-gate bands ──────────────────────────────────────────────
    // Band 1 @ 240: damage — ice L0, ice L1, water L2
    { lane: 0, distance:  240, type: 'ice'   },
    { lane: 1, distance:  240, type: 'ice'   },
    { lane: 2, distance:  240, type: 'water' },

    // Band 2 @ 400: relief — ice L0, ice L2 — L1 clear
    { lane: 0, distance:  400, type: 'ice' },
    { lane: 2, distance:  400, type: 'ice' },

    // ── Gate 1 @ 500: open=1 (rock L0, rock L2, ice L1) ───────────────────
    { lane: 0, distance:  500, type: 'rock' },
    { lane: 2, distance:  500, type: 'rock' },
    { lane: 1, distance:  500, type: 'ice'  },

    // ── Seg 1→2: 500→1500 ─────────────────────────────────────────────────
    // Band 4 @ 700: damage — ice L0, ice L1, ice L2
    { lane: 0, distance:  700, type: 'ice' },
    { lane: 1, distance:  700, type: 'ice' },
    { lane: 2, distance:  700, type: 'ice' },

    // Band 5 @ 950: damage — water L0, ice L1, ice L2
    { lane: 0, distance:  950, type: 'water' },
    { lane: 1, distance:  950, type: 'ice'   },
    { lane: 2, distance:  950, type: 'ice'   },

    // Band 6 @ 1200: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 1200, type: 'ice'   },
    { lane: 1, distance: 1200, type: 'ice'   },
    { lane: 2, distance: 1200, type: 'water' },

    // ── Gate 2 @ 1500: open=0 (rock L1, rock L2, water L0) ────────────────
    { lane: 1, distance: 1500, type: 'rock'  },
    { lane: 2, distance: 1500, type: 'rock'  },
    { lane: 0, distance: 1500, type: 'water' },

    // ── Seg 2→3: 1500→2500 ────────────────────────────────────────────────
    // Band 8 @ 1700: damage — ice L0, ice L1, ice L2
    { lane: 0, distance: 1700, type: 'ice' },
    { lane: 1, distance: 1700, type: 'ice' },
    { lane: 2, distance: 1700, type: 'ice' },

    // Band 9 @ 1950: relief — water L0, ice L2 — L1 clear
    { lane: 0, distance: 1950, type: 'water' },
    { lane: 2, distance: 1950, type: 'ice'   },

    // Band 10 @ 2220: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 2220, type: 'ice'   },
    { lane: 1, distance: 2220, type: 'ice'   },
    { lane: 2, distance: 2220, type: 'water' },

    // ── Gate 3 @ 2500: open=1 (rock L0, rock L2, ice L1) ──────────────────
    { lane: 0, distance: 2500, type: 'rock' },
    { lane: 2, distance: 2500, type: 'rock' },
    { lane: 1, distance: 2500, type: 'ice'  },

    // ── Seg 3→4: 2500→3550 ────────────────────────────────────────────────
    // Band 12 @ 2760: damage — water L0, ice L1, ice L2
    { lane: 0, distance: 2760, type: 'water' },
    { lane: 1, distance: 2760, type: 'ice'   },
    { lane: 2, distance: 2760, type: 'ice'   },

    // Band 13 @ 3060: damage — ice L0, ice L1, ice L2
    { lane: 0, distance: 3060, type: 'ice' },
    { lane: 1, distance: 3060, type: 'ice' },
    { lane: 2, distance: 3060, type: 'ice' },

    // Band 14 @ 3300: relief — ice L0, water L1 — L2 clear
    { lane: 0, distance: 3300, type: 'ice'   },
    { lane: 1, distance: 3300, type: 'water' },

    // ── Gate 4 @ 3550: open=2 (rock L0, rock L1, ice L2) ──────────────────
    { lane: 0, distance: 3550, type: 'rock' },
    { lane: 1, distance: 3550, type: 'rock' },
    { lane: 2, distance: 3550, type: 'ice'  },

    // ── Seg 4→5: 3550→4600 ────────────────────────────────────────────────
    // Band 16 @ 3800: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 3800, type: 'ice'   },
    { lane: 1, distance: 3800, type: 'ice'   },
    { lane: 2, distance: 3800, type: 'water' },

    // Band 17 @ 4100: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 4100, type: 'ice'   },
    { lane: 1, distance: 4100, type: 'water' },
    { lane: 2, distance: 4100, type: 'ice'   },

    // Band 18 @ 4350: relief — water L0, ice L2 — L1 clear
    { lane: 0, distance: 4350, type: 'water' },
    { lane: 2, distance: 4350, type: 'ice'   },

    // ── Gate 5 @ 4600: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 4600, type: 'rock'  },
    { lane: 2, distance: 4600, type: 'rock'  },
    { lane: 1, distance: 4600, type: 'water' },

    // ── Seg 5→6: 4600→5650 ────────────────────────────────────────────────
    // Band 20 @ 4870: damage — ice L0, ice L1, ice L2
    { lane: 0, distance: 4870, type: 'ice' },
    { lane: 1, distance: 4870, type: 'ice' },
    { lane: 2, distance: 4870, type: 'ice' },

    // Band 21 @ 5150: damage — water L0, ice L1, ice L2
    { lane: 0, distance: 5150, type: 'water' },
    { lane: 1, distance: 5150, type: 'ice'   },
    { lane: 2, distance: 5150, type: 'ice'   },

    // Band 22 @ 5400: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 5400, type: 'ice'   },
    { lane: 1, distance: 5400, type: 'ice'   },
    { lane: 2, distance: 5400, type: 'water' },

    // ── Gate 6 @ 5650: open=0 (rock L1, rock L2, ice L0) ──────────────────
    { lane: 1, distance: 5650, type: 'rock' },
    { lane: 2, distance: 5650, type: 'rock' },
    { lane: 0, distance: 5650, type: 'ice'  },

    // ── Seg 6→7: 5650→6700 ────────────────────────────────────────────────
    // Band 24 @ 5900: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 5900, type: 'ice'   },
    { lane: 1, distance: 5900, type: 'ice'   },
    { lane: 2, distance: 5900, type: 'water' },

    // Band 25 @ 6150: relief — ice L0, water L2 — L1 clear
    { lane: 0, distance: 6150, type: 'ice'   },
    { lane: 2, distance: 6150, type: 'water' },

    // Band 26 @ 6450: damage — ice L0, ice L1, ice L2
    { lane: 0, distance: 6450, type: 'ice' },
    { lane: 1, distance: 6450, type: 'ice' },
    { lane: 2, distance: 6450, type: 'ice' },

    // ── Gate 7 @ 6700: open=1 (rock L0, rock L2, ice L1) ──────────────────
    { lane: 0, distance: 6700, type: 'rock' },
    { lane: 2, distance: 6700, type: 'rock' },
    { lane: 1, distance: 6700, type: 'ice'  },

    // ── Seg 7→8: 6700→7750 ────────────────────────────────────────────────
    // Band 28 @ 6970: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 6970, type: 'ice'   },
    { lane: 1, distance: 6970, type: 'water' },
    { lane: 2, distance: 6970, type: 'ice'   },

    // Band 29 @ 7250: damage — water L0, ice L1, ice L2
    { lane: 0, distance: 7250, type: 'water' },
    { lane: 1, distance: 7250, type: 'ice'   },
    { lane: 2, distance: 7250, type: 'ice'   },

    // Band 30 @ 7500: relief — ice L0, ice L1 — L2 clear
    { lane: 0, distance: 7500, type: 'ice' },
    { lane: 1, distance: 7500, type: 'ice' },

    // ── Gate 8 @ 7750: open=2 (rock L0, rock L1, ice L2) ──────────────────
    { lane: 0, distance: 7750, type: 'rock' },
    { lane: 1, distance: 7750, type: 'rock' },
    { lane: 2, distance: 7750, type: 'ice'  },

    // ── Seg 8→9: 7750→8800 ────────────────────────────────────────────────
    // Band 32 @ 8020: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 8020, type: 'ice'   },
    { lane: 1, distance: 8020, type: 'ice'   },
    { lane: 2, distance: 8020, type: 'water' },

    // Band 33 @ 8300: damage — water L0, ice L1, ice L2
    { lane: 0, distance: 8300, type: 'water' },
    { lane: 1, distance: 8300, type: 'ice'   },
    { lane: 2, distance: 8300, type: 'ice'   },

    // Band 34 @ 8560: relief — water L0, ice L2 — L1 clear
    { lane: 0, distance: 8560, type: 'water' },
    { lane: 2, distance: 8560, type: 'ice'   },

    // ── Gate 9 @ 8800: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 8800, type: 'rock'  },
    { lane: 2, distance: 8800, type: 'rock'  },
    { lane: 1, distance: 8800, type: 'water' },

    // ── Seg 9→10: 8800→9700 ───────────────────────────────────────────────
    // Band 36 @ 9030: damage — ice L0, ice L1, ice L2
    { lane: 0, distance: 9030, type: 'ice' },
    { lane: 1, distance: 9030, type: 'ice' },
    { lane: 2, distance: 9030, type: 'ice' },

    // Band 37 @ 9320: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 9320, type: 'ice'   },
    { lane: 1, distance: 9320, type: 'water' },
    { lane: 2, distance: 9320, type: 'ice'   },

    // Band 38 @ 9540: relief — ice L1, water L2 — L0 clear
    { lane: 1, distance: 9540, type: 'ice'   },
    { lane: 2, distance: 9540, type: 'water' },

    // ── Gate 10 @ 9700: open=0 (rock L1, rock L2, ice L0) — finale ─────────
    { lane: 1, distance: 9700, type: 'rock' },
    { lane: 2, distance: 9700, type: 'rock' },
    { lane: 0, distance: 9700, type: 'ice'  },

    // ── Post-finale ────────────────────────────────────────────────────────
    // Band 40 @ 9950: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 9950, type: 'ice'   },
    { lane: 1, distance: 9950, type: 'ice'   },
    { lane: 2, distance: 9950, type: 'water' }
  ],
  pickups: [
    { lane: 1, distance:  620, type: 'caltrop_pickup'  },
    { lane: 2, distance: 1060, type: 'snipe_pickup'    },
    { lane: 0, distance: 1630, type: 'caltrop_pickup'  },
    { lane: 1, distance: 2100, type: 'snipe_pickup'    },
    { lane: 2, distance: 2640, type: 'caltrop_pickup'  },
    { lane: 0, distance: 3700, type: 'snipe_pickup'    },
    { lane: 2, distance: 4450, type: 'caltrop_pickup'  },
    { lane: 1, distance: 5270, type: 'snipe_pickup'    },
    { lane: 0, distance: 5780, type: 'caltrop_pickup'  },
    { lane: 1, distance: 7630, type: 'snipe_pickup'    },
    { lane: 2, distance: 8680, type: 'caltrop_pickup'  },
    { lane: 0, distance: 9120, type: 'snipe_pickup'    }
  ]
};

// ─── Track 2 ─────────────────────────────────────────────────────────────────
// 9 400 units, 32 bands (~28% gate, ~59% damage, ~13% relief).
// Water-heavy. Rewards water_shield.
// 9 gates, open lanes: 1→2→1→0→1→2→1→0→1 (all shifts ≤1).
// Gates at: 500,1500,2500,3550,4600,5650,6700,7750,8800
// Gaps: 1000,1000,1050,1050,1050,1050,1050,1050 — all ≥ 800.
export const TRACK_2 = {
  id:     'track_2',
  name:   'Track 2',
  length: 9400,
  obstacles: [
    // ── Seg 0: pre-gate bands ──────────────────────────────────────────────
    // Band 1 @ 240: damage — water L0, water L1, ice L2
    { lane: 0, distance:  240, type: 'water' },
    { lane: 1, distance:  240, type: 'water' },
    { lane: 2, distance:  240, type: 'ice'   },

    // Band 2 @ 400: relief — water L0, water L2 — L1 clear
    { lane: 0, distance:  400, type: 'water' },
    { lane: 2, distance:  400, type: 'water' },

    // ── Gate 1 @ 500: open=1 (rock L0, rock L2, water L1) ─────────────────
    { lane: 0, distance:  500, type: 'rock'  },
    { lane: 2, distance:  500, type: 'rock'  },
    { lane: 1, distance:  500, type: 'water' },

    // ── Seg 1→2: 500→1500 ─────────────────────────────────────────────────
    // Band 4 @ 700: damage — water L0, water L1, water L2
    { lane: 0, distance:  700, type: 'water' },
    { lane: 1, distance:  700, type: 'water' },
    { lane: 2, distance:  700, type: 'water' },

    // Band 5 @ 950: damage — ice L0, water L1, water L2
    { lane: 0, distance:  950, type: 'ice'   },
    { lane: 1, distance:  950, type: 'water' },
    { lane: 2, distance:  950, type: 'water' },

    // Band 6 @ 1200: damage — water L0, water L1, ice L2
    { lane: 0, distance: 1200, type: 'water' },
    { lane: 1, distance: 1200, type: 'water' },
    { lane: 2, distance: 1200, type: 'ice'   },

    // ── Gate 2 @ 1500: open=2 (rock L0, rock L1, water L2) ────────────────
    { lane: 0, distance: 1500, type: 'rock'  },
    { lane: 1, distance: 1500, type: 'rock'  },
    { lane: 2, distance: 1500, type: 'water' },

    // ── Seg 2→3: 1500→2500 ────────────────────────────────────────────────
    // Band 8 @ 1700: damage — water L0, water L1, water L2
    { lane: 0, distance: 1700, type: 'water' },
    { lane: 1, distance: 1700, type: 'water' },
    { lane: 2, distance: 1700, type: 'water' },

    // Band 9 @ 1950: relief — ice L0, water L2 — L1 clear
    { lane: 0, distance: 1950, type: 'ice'   },
    { lane: 2, distance: 1950, type: 'water' },

    // Band 10 @ 2220: damage — water L0, water L1, ice L2
    { lane: 0, distance: 2220, type: 'water' },
    { lane: 1, distance: 2220, type: 'water' },
    { lane: 2, distance: 2220, type: 'ice'   },

    // ── Gate 3 @ 2500: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 2500, type: 'rock'  },
    { lane: 2, distance: 2500, type: 'rock'  },
    { lane: 1, distance: 2500, type: 'water' },

    // ── Seg 3→4: 2500→3550 ────────────────────────────────────────────────
    // Band 12 @ 2760: damage — ice L0, water L1, water L2
    { lane: 0, distance: 2760, type: 'ice'   },
    { lane: 1, distance: 2760, type: 'water' },
    { lane: 2, distance: 2760, type: 'water' },

    // Band 13 @ 3060: damage — water L0, water L1, water L2
    { lane: 0, distance: 3060, type: 'water' },
    { lane: 1, distance: 3060, type: 'water' },
    { lane: 2, distance: 3060, type: 'water' },

    // Band 14 @ 3300: relief — water L0, water L2 — L1 clear
    { lane: 0, distance: 3300, type: 'water' },
    { lane: 2, distance: 3300, type: 'water' },

    // ── Gate 4 @ 3550: open=0 (rock L1, rock L2, water L0) ────────────────
    { lane: 1, distance: 3550, type: 'rock'  },
    { lane: 2, distance: 3550, type: 'rock'  },
    { lane: 0, distance: 3550, type: 'water' },

    // ── Seg 4→5: 3550→4600 ────────────────────────────────────────────────
    // Band 16 @ 3800: damage — water L0, water L1, ice L2
    { lane: 0, distance: 3800, type: 'water' },
    { lane: 1, distance: 3800, type: 'water' },
    { lane: 2, distance: 3800, type: 'ice'   },

    // Band 17 @ 4100: damage — water L0, ice L1, water L2
    { lane: 0, distance: 4100, type: 'water' },
    { lane: 1, distance: 4100, type: 'ice'   },
    { lane: 2, distance: 4100, type: 'water' },

    // Band 18 @ 4350: relief — ice L0, water L2 — L1 clear
    { lane: 0, distance: 4350, type: 'ice'   },
    { lane: 2, distance: 4350, type: 'water' },

    // ── Gate 5 @ 4600: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 4600, type: 'rock'  },
    { lane: 2, distance: 4600, type: 'rock'  },
    { lane: 1, distance: 4600, type: 'water' },

    // ── Seg 5→6: 4600→5650 ────────────────────────────────────────────────
    // Band 20 @ 4870: damage — water L0, water L1, water L2
    { lane: 0, distance: 4870, type: 'water' },
    { lane: 1, distance: 4870, type: 'water' },
    { lane: 2, distance: 4870, type: 'water' },

    // Band 21 @ 5150: damage — ice L0, water L1, water L2
    { lane: 0, distance: 5150, type: 'ice'   },
    { lane: 1, distance: 5150, type: 'water' },
    { lane: 2, distance: 5150, type: 'water' },

    // Band 22 @ 5400: damage — water L0, water L1, ice L2
    { lane: 0, distance: 5400, type: 'water' },
    { lane: 1, distance: 5400, type: 'water' },
    { lane: 2, distance: 5400, type: 'ice'   },

    // ── Gate 6 @ 5650: open=2 (rock L0, rock L1, water L2) ────────────────
    { lane: 0, distance: 5650, type: 'rock'  },
    { lane: 1, distance: 5650, type: 'rock'  },
    { lane: 2, distance: 5650, type: 'water' },

    // ── Seg 6→7: 5650→6700 ────────────────────────────────────────────────
    // Band 24 @ 5900: damage — water L0, water L1, water L2
    { lane: 0, distance: 5900, type: 'water' },
    { lane: 1, distance: 5900, type: 'water' },
    { lane: 2, distance: 5900, type: 'water' },

    // Band 25 @ 6150: relief — water L0, ice L2 — L1 clear
    { lane: 0, distance: 6150, type: 'water' },
    { lane: 2, distance: 6150, type: 'ice'   },

    // Band 26 @ 6450: damage — ice L0, water L1, water L2
    { lane: 0, distance: 6450, type: 'ice'   },
    { lane: 1, distance: 6450, type: 'water' },
    { lane: 2, distance: 6450, type: 'water' },

    // ── Gate 7 @ 6700: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 6700, type: 'rock'  },
    { lane: 2, distance: 6700, type: 'rock'  },
    { lane: 1, distance: 6700, type: 'water' },

    // ── Seg 7→8: 6700→7750 ────────────────────────────────────────────────
    // Band 28 @ 6970: damage — water L0, water L1, ice L2
    { lane: 0, distance: 6970, type: 'water' },
    { lane: 1, distance: 6970, type: 'water' },
    { lane: 2, distance: 6970, type: 'ice'   },

    // Band 29 @ 7250: damage — water L0, ice L1, water L2
    { lane: 0, distance: 7250, type: 'water' },
    { lane: 1, distance: 7250, type: 'ice'   },
    { lane: 2, distance: 7250, type: 'water' },

    // Band 30 @ 7500: relief — water L0, water L1 — L2 clear
    { lane: 0, distance: 7500, type: 'water' },
    { lane: 1, distance: 7500, type: 'water' },

    // ── Gate 8 @ 7750: open=0 (rock L1, rock L2, water L0) ────────────────
    { lane: 1, distance: 7750, type: 'rock'  },
    { lane: 2, distance: 7750, type: 'rock'  },
    { lane: 0, distance: 7750, type: 'water' },

    // ── Seg 8→9: 7750→8800 ────────────────────────────────────────────────
    // Band 32 @ 8020: damage — water L0, water L1, water L2
    { lane: 0, distance: 8020, type: 'water' },
    { lane: 1, distance: 8020, type: 'water' },
    { lane: 2, distance: 8020, type: 'water' },

    // Band 33 @ 8300: damage — ice L0, water L1, water L2
    { lane: 0, distance: 8300, type: 'ice'   },
    { lane: 1, distance: 8300, type: 'water' },
    { lane: 2, distance: 8300, type: 'water' },

    // Band 34 @ 8560: relief — water L1, water L2 — L0 clear
    { lane: 1, distance: 8560, type: 'water' },
    { lane: 2, distance: 8560, type: 'water' },

    // ── Gate 9 @ 8800: open=1 (rock L0, rock L2, water L1) — finale ─────────
    { lane: 0, distance: 8800, type: 'rock'  },
    { lane: 2, distance: 8800, type: 'rock'  },
    { lane: 1, distance: 8800, type: 'water' },

    // ── Post-finale ────────────────────────────────────────────────────────
    // Band 35 @ 9060: damage — water L0, water L1, ice L2
    { lane: 0, distance: 9060, type: 'water' },
    { lane: 1, distance: 9060, type: 'water' },
    { lane: 2, distance: 9060, type: 'ice'   },

    // Band 36 @ 9320: damage — water L0, ice L1, water L2
    { lane: 0, distance: 9320, type: 'water' },
    { lane: 1, distance: 9320, type: 'ice'   },
    { lane: 2, distance: 9320, type: 'water' }
  ],
  pickups: [
    { lane: 1, distance:  620, type: 'caltrop_pickup'  },
    { lane: 0, distance: 1060, type: 'snipe_pickup'    },
    { lane: 2, distance: 1630, type: 'caltrop_pickup'  },
    { lane: 1, distance: 2100, type: 'snipe_pickup'    },
    { lane: 0, distance: 2640, type: 'caltrop_pickup'  },
    { lane: 2, distance: 3700, type: 'snipe_pickup'    },
    { lane: 1, distance: 4450, type: 'caltrop_pickup'  },
    { lane: 0, distance: 5270, type: 'snipe_pickup'    },
    { lane: 2, distance: 5780, type: 'caltrop_pickup'  },
    { lane: 1, distance: 7630, type: 'snipe_pickup'    },
    { lane: 0, distance: 8680, type: 'caltrop_pickup'  }
  ]
};

// ─── Track 3 ─────────────────────────────────────────────────────────────────
// 9 900 units, 37 bands (~32% gate, ~54% damage, ~14% relief).
// Mixed ice/water. More demanding with ~35% gate proportion.
// 12 gates, open lanes: 1→0→1→2→1→0→1→2→1→0→1→2 (all shifts ≤1).
// Gates at: 450,1250,2050,2850,3650,4450,5250,6050,6850,7650,8450,9250
// Gaps: 800×11 — all ≥ 800.
export const TRACK_3 = {
  id:     'track_3',
  name:   'Track 3',
  length: 9900,
  obstacles: [
    // ── Seg 0: pre-gate ────────────────────────────────────────────────────
    // Band 1 @ 220: damage — ice L0, water L1, ice L2
    { lane: 0, distance:  220, type: 'ice'   },
    { lane: 1, distance:  220, type: 'water' },
    { lane: 2, distance:  220, type: 'ice'   },

    // ── Gate 1 @ 450: open=1 (rock L0, rock L2, water L1) ─────────────────
    { lane: 0, distance:  450, type: 'rock'  },
    { lane: 2, distance:  450, type: 'rock'  },
    { lane: 1, distance:  450, type: 'water' },

    // ── Seg 1→2: 450→1250 (800) ───────────────────────────────────────────
    // Band 3 @ 650: damage — ice L0, ice L1, water L2
    { lane: 0, distance:  650, type: 'ice'   },
    { lane: 1, distance:  650, type: 'ice'   },
    { lane: 2, distance:  650, type: 'water' },

    // Band 4 @ 1000: relief — ice L0, water L2 — L1 clear
    { lane: 0, distance: 1000, type: 'ice'   },
    { lane: 2, distance: 1000, type: 'water' },

    // ── Gate 2 @ 1250: open=0 (rock L1, rock L2, ice L0) ──────────────────
    { lane: 1, distance: 1250, type: 'rock' },
    { lane: 2, distance: 1250, type: 'rock' },
    { lane: 0, distance: 1250, type: 'ice'  },

    // ── Seg 2→3: 1250→2050 (800) ──────────────────────────────────────────
    // Band 6 @ 1450: damage — water L0, water L1, ice L2
    { lane: 0, distance: 1450, type: 'water' },
    { lane: 1, distance: 1450, type: 'water' },
    { lane: 2, distance: 1450, type: 'ice'   },

    // Band 7 @ 1780: relief — water L1, ice L2 — L0 clear
    { lane: 1, distance: 1780, type: 'water' },
    { lane: 2, distance: 1780, type: 'ice'   },

    // ── Gate 3 @ 2050: open=1 (rock L0, rock L2, ice L1) ──────────────────
    { lane: 0, distance: 2050, type: 'rock' },
    { lane: 2, distance: 2050, type: 'rock' },
    { lane: 1, distance: 2050, type: 'ice'  },

    // ── Seg 3→4: 2050→2850 (800) ──────────────────────────────────────────
    // Band 9 @ 2280: damage — ice L0, water L1, water L2
    { lane: 0, distance: 2280, type: 'ice'   },
    { lane: 1, distance: 2280, type: 'water' },
    { lane: 2, distance: 2280, type: 'water' },

    // Band 10 @ 2600: damage — water L0, ice L1, water L2
    { lane: 0, distance: 2600, type: 'water' },
    { lane: 1, distance: 2600, type: 'ice'   },
    { lane: 2, distance: 2600, type: 'water' },

    // ── Gate 4 @ 2850: open=2 (rock L0, rock L1, water L2) ────────────────
    { lane: 0, distance: 2850, type: 'rock'  },
    { lane: 1, distance: 2850, type: 'rock'  },
    { lane: 2, distance: 2850, type: 'water' },

    // ── Seg 4→5: 2850→3650 (800) ──────────────────────────────────────────
    // Band 12 @ 3070: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 3070, type: 'ice'   },
    { lane: 1, distance: 3070, type: 'ice'   },
    { lane: 2, distance: 3070, type: 'water' },

    // Band 13 @ 3380: relief — ice L0, water L1 — L2 clear
    { lane: 0, distance: 3380, type: 'ice'   },
    { lane: 1, distance: 3380, type: 'water' },

    // ── Gate 5 @ 3650: open=1 (rock L0, rock L2, ice L1) ──────────────────
    { lane: 0, distance: 3650, type: 'rock' },
    { lane: 2, distance: 3650, type: 'rock' },
    { lane: 1, distance: 3650, type: 'ice'  },

    // ── Seg 5→6: 3650→4450 (800) ──────────────────────────────────────────
    // Band 15 @ 3880: damage — water L0, water L1, ice L2
    { lane: 0, distance: 3880, type: 'water' },
    { lane: 1, distance: 3880, type: 'water' },
    { lane: 2, distance: 3880, type: 'ice'   },

    // Band 16 @ 4190: damage — ice L0, water L1, water L2
    { lane: 0, distance: 4190, type: 'ice'   },
    { lane: 1, distance: 4190, type: 'water' },
    { lane: 2, distance: 4190, type: 'water' },

    // ── Gate 6 @ 4450: open=0 (rock L1, rock L2, water L0) ────────────────
    { lane: 1, distance: 4450, type: 'rock'  },
    { lane: 2, distance: 4450, type: 'rock'  },
    { lane: 0, distance: 4450, type: 'water' },

    // ── Seg 6→7: 4450→5250 (800) ──────────────────────────────────────────
    // Band 18 @ 4680: damage — water L0, ice L1, ice L2
    { lane: 0, distance: 4680, type: 'water' },
    { lane: 1, distance: 4680, type: 'ice'   },
    { lane: 2, distance: 4680, type: 'ice'   },

    // Band 19 @ 4990: relief — water L1, water L2 — L0 clear
    { lane: 1, distance: 4990, type: 'water' },
    { lane: 2, distance: 4990, type: 'water' },

    // ── Gate 7 @ 5250: open=1 (rock L0, rock L2, water L1) ────────────────
    { lane: 0, distance: 5250, type: 'rock'  },
    { lane: 2, distance: 5250, type: 'rock'  },
    { lane: 1, distance: 5250, type: 'water' },

    // ── Seg 7→8: 5250→6050 (800) ──────────────────────────────────────────
    // Band 21 @ 5480: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 5480, type: 'ice'   },
    { lane: 1, distance: 5480, type: 'water' },
    { lane: 2, distance: 5480, type: 'ice'   },

    // Band 22 @ 5790: damage — water L0, ice L1, water L2
    { lane: 0, distance: 5790, type: 'water' },
    { lane: 1, distance: 5790, type: 'ice'   },
    { lane: 2, distance: 5790, type: 'water' },

    // ── Gate 8 @ 6050: open=2 (rock L0, rock L1, ice L2) ──────────────────
    { lane: 0, distance: 6050, type: 'rock' },
    { lane: 1, distance: 6050, type: 'rock' },
    { lane: 2, distance: 6050, type: 'ice'  },

    // ── Seg 8→9: 6050→6850 (800) ──────────────────────────────────────────
    // Band 24 @ 6280: damage — ice L0, water L1, water L2
    { lane: 0, distance: 6280, type: 'ice'   },
    { lane: 1, distance: 6280, type: 'water' },
    { lane: 2, distance: 6280, type: 'water' },

    // Band 25 @ 6590: relief — ice L0, ice L1 — L2 clear
    { lane: 0, distance: 6590, type: 'ice' },
    { lane: 1, distance: 6590, type: 'ice' },

    // ── Gate 9 @ 6850: open=1 (rock L0, rock L2, ice L1) ──────────────────
    { lane: 0, distance: 6850, type: 'rock' },
    { lane: 2, distance: 6850, type: 'rock' },
    { lane: 1, distance: 6850, type: 'ice'  },

    // ── Seg 9→10: 6850→7650 (800) ─────────────────────────────────────────
    // Band 27 @ 7070: damage — water L0, water L1, ice L2
    { lane: 0, distance: 7070, type: 'water' },
    { lane: 1, distance: 7070, type: 'water' },
    { lane: 2, distance: 7070, type: 'ice'   },

    // Band 28 @ 7380: damage — ice L0, water L1, water L2
    { lane: 0, distance: 7380, type: 'ice'   },
    { lane: 1, distance: 7380, type: 'water' },
    { lane: 2, distance: 7380, type: 'water' },

    // ── Gate 10 @ 7650: open=0 (rock L1, rock L2, ice L0) ─────────────────
    { lane: 1, distance: 7650, type: 'rock' },
    { lane: 2, distance: 7650, type: 'rock' },
    { lane: 0, distance: 7650, type: 'ice'  },

    // ── Seg 10→11: 7650→8450 (800) ────────────────────────────────────────
    // Band 30 @ 7880: damage — ice L0, ice L1, water L2
    { lane: 0, distance: 7880, type: 'ice'   },
    { lane: 1, distance: 7880, type: 'ice'   },
    { lane: 2, distance: 7880, type: 'water' },

    // Band 31 @ 8160: relief — water L0, water L2 — L1 clear
    { lane: 0, distance: 8160, type: 'water' },
    { lane: 2, distance: 8160, type: 'water' },

    // ── Gate 11 @ 8450: open=1 (rock L0, rock L2, water L1) ───────────────
    { lane: 0, distance: 8450, type: 'rock'  },
    { lane: 2, distance: 8450, type: 'rock'  },
    { lane: 1, distance: 8450, type: 'water' },

    // ── Seg 11→12: 8450→9250 (800) ────────────────────────────────────────
    // Band 33 @ 8680: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 8680, type: 'ice'   },
    { lane: 1, distance: 8680, type: 'water' },
    { lane: 2, distance: 8680, type: 'ice'   },

    // Band 34 @ 8980: damage — water L0, ice L1, water L2
    { lane: 0, distance: 8980, type: 'water' },
    { lane: 1, distance: 8980, type: 'ice'   },
    { lane: 2, distance: 8980, type: 'water' },

    // ── Gate 12 @ 9250: open=2 (rock L0, rock L1, ice L2) ─────────────────
    { lane: 0, distance: 9250, type: 'rock' },
    { lane: 1, distance: 9250, type: 'rock' },
    { lane: 2, distance: 9250, type: 'ice'  },

    // ── Post-finale (after gate 12 @9250) ─────────────────────────────────
    // Band 36 @ 9480: damage — water L0, ice L1, water L2
    { lane: 0, distance: 9480, type: 'water' },
    { lane: 1, distance: 9480, type: 'ice'   },
    { lane: 2, distance: 9480, type: 'water' },

    // Band 37 @ 9750: damage — ice L0, water L1, ice L2
    { lane: 0, distance: 9750, type: 'ice'   },
    { lane: 1, distance: 9750, type: 'water' },
    { lane: 2, distance: 9750, type: 'ice'   }
  ],
  pickups: [
    { lane: 1, distance:  570, type: 'caltrop_pickup'  },
    { lane: 2, distance: 1130, type: 'snipe_pickup'    },
    { lane: 0, distance: 1900, type: 'caltrop_pickup'  },
    { lane: 2, distance: 2450, type: 'snipe_pickup'    },
    { lane: 1, distance: 3120, type: 'caltrop_pickup'  },
    { lane: 0, distance: 3780, type: 'snipe_pickup'    },
    { lane: 2, distance: 4560, type: 'caltrop_pickup'  },
    { lane: 0, distance: 5120, type: 'snipe_pickup'    },
    { lane: 1, distance: 5870, type: 'caltrop_pickup'  },
    { lane: 0, distance: 7160, type: 'snipe_pickup'    },
    { lane: 2, distance: 8270, type: 'caltrop_pickup'  },
    { lane: 1, distance: 9650, type: 'snipe_pickup'    }
  ]
};

export const ALL_TRACKS = [TRACK_1, TRACK_2, TRACK_3];

export function getTrackById(id) {
  return ALL_TRACKS.find(t => t.id === id) || null;
}

// ─── Split-screen geometry (2-player mode) ────────────────────────────────────
export const SPLIT_HALF_W       = 640;
export const SPLIT_LANE_WIDTH   = 140;
export const SPLIT_LANE_GAP     = 20;
export const SPLIT_LANE_START_X = 90;
// Centers are relative to each half's x origin (add pOffset to get absolute)
export const SPLIT_LANE_CENTERS = [160, 320, 480];
export const SPLIT_OBS_W        = 110;
export const SPLIT_OBS_H        = 50;
