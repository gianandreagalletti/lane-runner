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
// 12 000 units, 28 bands, 54 obstacles.
// Approachable: rewards ice_grip + water_shield, rock_break handles lethal rocks.
// No band has rocks in all 3 lanes.
export const TRACK_1 = {
  id:     'track_1',
  name:   'Track 1',
  length: 12000,
  obstacles: [
    // Band 1 @ 400: rock L0, ice L1 — L2 clear
    { lane: 0, distance:  400, type: 'rock' },
    { lane: 1, distance:  400, type: 'ice'  },

    // Band 2 @ 850: water L0, rock L2 — L1 clear
    { lane: 0, distance:  850, type: 'water' },
    { lane: 2, distance:  850, type: 'rock'  },

    // Band 3 @ 1300: rock L1, ice L2 — L0 clear
    { lane: 1, distance: 1300, type: 'rock' },
    { lane: 2, distance: 1300, type: 'ice'  },

    // Band 4 @ 1750: ice L0, water L1 — L2 clear
    { lane: 0, distance: 1750, type: 'ice'   },
    { lane: 1, distance: 1750, type: 'water' },

    // Band 5 @ 2200: rock L0, rock L2 — L1 clear (double rock, no ice/water)
    { lane: 0, distance: 2200, type: 'rock' },
    { lane: 2, distance: 2200, type: 'rock' },

    // Band 6 @ 2650: water L1, rock L2 — L0 clear
    { lane: 1, distance: 2650, type: 'water' },
    { lane: 2, distance: 2650, type: 'rock'  },

    // Band 7 @ 3100: ice L0, rock L1, water L2 — all blocked (ice or water debuff forced)
    { lane: 0, distance: 3100, type: 'ice'   },
    { lane: 1, distance: 3100, type: 'rock'  },
    { lane: 2, distance: 3100, type: 'water' },

    // Band 8 @ 3600: rock L0, ice L2 — L1 clear
    { lane: 0, distance: 3600, type: 'rock' },
    { lane: 2, distance: 3600, type: 'ice'  },

    // Band 9 @ 4050: water L0, ice L1 — L2 clear
    { lane: 0, distance: 4050, type: 'water' },
    { lane: 1, distance: 4050, type: 'ice'   },

    // Band 10 @ 4500: rock L1, water L2 — L0 clear
    { lane: 1, distance: 4500, type: 'rock'  },
    { lane: 2, distance: 4500, type: 'water' },

    // Band 11 @ 4950: ice L0, rock L2 — L1 clear
    { lane: 0, distance: 4950, type: 'ice'  },
    { lane: 2, distance: 4950, type: 'rock' },

    // Band 12 @ 5400: rock L0, ice L1, water L2 — all blocked (rock forces react or switch)
    { lane: 0, distance: 5400, type: 'rock'  },
    { lane: 1, distance: 5400, type: 'ice'   },
    { lane: 2, distance: 5400, type: 'water' },

    // Band 13 @ 5900: water L0, rock L1 — L2 clear
    { lane: 0, distance: 5900, type: 'water' },
    { lane: 1, distance: 5900, type: 'rock'  },

    // Band 14 @ 6350: rock L0, water L2 — L1 clear
    { lane: 0, distance: 6350, type: 'rock'  },
    { lane: 2, distance: 6350, type: 'water' },

    // Band 15 @ 6800: ice L1, rock L2 — L0 clear
    { lane: 1, distance: 6800, type: 'ice'  },
    { lane: 2, distance: 6800, type: 'rock' },

    // Band 16 @ 7250: rock L0, ice L2 — L1 clear
    { lane: 0, distance: 7250, type: 'rock' },
    { lane: 2, distance: 7250, type: 'ice'  },

    // Band 17 @ 7700: water L0, ice L1, rock L2 — all blocked (water or ice debuff)
    { lane: 0, distance: 7700, type: 'water' },
    { lane: 1, distance: 7700, type: 'ice'   },
    { lane: 2, distance: 7700, type: 'rock'  },

    // Band 18 @ 8150: rock L1, water L2 — L0 clear
    { lane: 1, distance: 8150, type: 'rock'  },
    { lane: 2, distance: 8150, type: 'water' },

    // Band 19 @ 8600: ice L0, rock L1 — L2 clear
    { lane: 0, distance: 8600, type: 'ice'  },
    { lane: 1, distance: 8600, type: 'rock' },

    // Band 20 @ 9050: rock L0, water L1, ice L2 — all blocked
    { lane: 0, distance: 9050, type: 'rock'  },
    { lane: 1, distance: 9050, type: 'water' },
    { lane: 2, distance: 9050, type: 'ice'   },

    // Band 21 @ 9500: water L0, rock L2 — L1 clear
    { lane: 0, distance: 9500, type: 'water' },
    { lane: 2, distance: 9500, type: 'rock'  },

    // Band 22 @ 9950: rock L0, ice L1 — L2 clear
    { lane: 0, distance: 9950, type: 'rock' },
    { lane: 1, distance: 9950, type: 'ice'  },

    // Band 23 @ 10400: ice L0, water L2 — L1 clear
    { lane: 0, distance: 10400, type: 'ice'   },
    { lane: 2, distance: 10400, type: 'water' },

    // Band 24 @ 10850: rock L1, water L2 — L0 clear
    { lane: 1, distance: 10850, type: 'rock'  },
    { lane: 2, distance: 10850, type: 'water' },

    // Band 25 @ 11300: ice L0, rock L2 — L1 clear
    { lane: 0, distance: 11300, type: 'ice'  },
    { lane: 2, distance: 11300, type: 'rock' },

    // Band 26 @ 11700: rock L0, ice L1, water L2 — all blocked (finale gauntlet)
    { lane: 0, distance: 11700, type: 'rock'  },
    { lane: 1, distance: 11700, type: 'ice'   },
    { lane: 2, distance: 11700, type: 'water' }
  ],
  pickups: [
    // ~6 caltrop + ~6 snipe pickups, spread through run, never in only-clear lane of obstacle band
    { lane: 2, distance:  600, type: 'caltrop_pickup'  },  // after band 1 (L0 rock, L1 ice → L2 clear, no band here)
    { lane: 1, distance: 1100, type: 'snipe_pickup'    },  // between bands 2 & 3
    { lane: 0, distance: 1550, type: 'caltrop_pickup'  },  // between bands 3 & 4
    { lane: 2, distance: 2450, type: 'snipe_pickup'    },  // between bands 5 & 6 (L2 has rock@2200, clear here)
    { lane: 1, distance: 2950, type: 'caltrop_pickup'  },  // between bands 6 & 7
    { lane: 0, distance: 3850, type: 'snipe_pickup'    },  // between bands 8 & 9 (L1 clear@3600)
    { lane: 2, distance: 4700, type: 'caltrop_pickup'  },  // between bands 10 & 11 (L0 clear@4500)
    { lane: 1, distance: 5200, type: 'snipe_pickup'    },  // between bands 12 & 13 (L2 clear@4950)
    { lane: 0, distance: 6150, type: 'caltrop_pickup'  },  // between bands 13 & 14 (L2 clear@5900)
    { lane: 2, distance: 7050, type: 'snipe_pickup'    },  // between bands 15 & 16 (L0 clear@6800)
    { lane: 1, distance: 8400, type: 'caltrop_pickup'  },  // between bands 18 & 19 (L0 clear@8150)
    { lane: 0, distance: 9750, type: 'snipe_pickup'    },  // between bands 21 & 22 (L1 clear@9500)
  ]
};

// ─── Track 2 ─────────────────────────────────────────────────────────────────
// 12 000 units, 28 bands, 56 obstacles.
// Medium difficulty: more double-rock bands, alternating debuff pressure.
// No band has rocks in all 3 lanes.
export const TRACK_2 = {
  id:     'track_2',
  name:   'Track 2',
  length: 12000,
  obstacles: [
    // Band 1 @ 450: rock L0, water L1 — L2 clear
    { lane: 0, distance:  450, type: 'rock'  },
    { lane: 1, distance:  450, type: 'water' },

    // Band 2 @ 900: ice L1, rock L2 — L0 clear
    { lane: 1, distance:  900, type: 'ice'  },
    { lane: 2, distance:  900, type: 'rock' },

    // Band 3 @ 1350: rock L0, ice L2 — L1 clear
    { lane: 0, distance: 1350, type: 'rock' },
    { lane: 2, distance: 1350, type: 'ice'  },

    // Band 4 @ 1800: water L0, rock L1, ice L2 — all blocked
    { lane: 0, distance: 1800, type: 'water' },
    { lane: 1, distance: 1800, type: 'rock'  },
    { lane: 2, distance: 1800, type: 'ice'   },

    // Band 5 @ 2300: rock L1, water L2 — L0 clear
    { lane: 1, distance: 2300, type: 'rock'  },
    { lane: 2, distance: 2300, type: 'water' },

    // Band 6 @ 2750: ice L0, rock L2 — L1 clear
    { lane: 0, distance: 2750, type: 'ice'  },
    { lane: 2, distance: 2750, type: 'rock' },

    // Band 7 @ 3200: rock L0, rock L1 — L2 clear (must go right)
    { lane: 0, distance: 3200, type: 'rock' },
    { lane: 1, distance: 3200, type: 'rock' },

    // Band 8 @ 3700: water L1, ice L2 — L0 clear
    { lane: 1, distance: 3700, type: 'water' },
    { lane: 2, distance: 3700, type: 'ice'   },

    // Band 9 @ 4150: rock L0, water L2 — L1 clear
    { lane: 0, distance: 4150, type: 'rock'  },
    { lane: 2, distance: 4150, type: 'water' },

    // Band 10 @ 4600: ice L0, rock L1, water L2 — all blocked
    { lane: 0, distance: 4600, type: 'ice'   },
    { lane: 1, distance: 4600, type: 'rock'  },
    { lane: 2, distance: 4600, type: 'water' },

    // Band 11 @ 5100: rock L1, ice L2 — L0 clear
    { lane: 1, distance: 5100, type: 'rock' },
    { lane: 2, distance: 5100, type: 'ice'  },

    // Band 12 @ 5550: water L0, rock L2 — L1 clear
    { lane: 0, distance: 5550, type: 'water' },
    { lane: 2, distance: 5550, type: 'rock'  },

    // Band 13 @ 6000: rock L0, ice L1 — L2 clear
    { lane: 0, distance: 6000, type: 'rock' },
    { lane: 1, distance: 6000, type: 'ice'  },

    // Band 14 @ 6450: rock L1, rock L2 — L0 clear (must go left)
    { lane: 1, distance: 6450, type: 'rock' },
    { lane: 2, distance: 6450, type: 'rock' },

    // Band 15 @ 6900: ice L0, water L2 — L1 clear
    { lane: 0, distance: 6900, type: 'ice'   },
    { lane: 2, distance: 6900, type: 'water' },

    // Band 16 @ 7350: water L0, rock L1, ice L2 — all blocked
    { lane: 0, distance: 7350, type: 'water' },
    { lane: 1, distance: 7350, type: 'rock'  },
    { lane: 2, distance: 7350, type: 'ice'   },

    // Band 17 @ 7800: rock L0, water L1 — L2 clear
    { lane: 0, distance: 7800, type: 'rock'  },
    { lane: 1, distance: 7800, type: 'water' },

    // Band 18 @ 8250: ice L1, rock L2 — L0 clear
    { lane: 1, distance: 8250, type: 'ice'  },
    { lane: 2, distance: 8250, type: 'rock' },

    // Band 19 @ 8700: rock L0, ice L2 — L1 clear
    { lane: 0, distance: 8700, type: 'rock' },
    { lane: 2, distance: 8700, type: 'ice'  },

    // Band 20 @ 9200: ice L0, water L1, rock L2 — all blocked
    { lane: 0, distance: 9200, type: 'ice'   },
    { lane: 1, distance: 9200, type: 'water' },
    { lane: 2, distance: 9200, type: 'rock'  },

    // Band 21 @ 9650: rock L1, water L2 — L0 clear
    { lane: 1, distance: 9650, type: 'rock'  },
    { lane: 2, distance: 9650, type: 'water' },

    // Band 22 @ 10100: water L0, rock L1 — L2 clear
    { lane: 0, distance: 10100, type: 'water' },
    { lane: 1, distance: 10100, type: 'rock'  },

    // Band 23 @ 10550: rock L0, rock L2 — L1 clear
    { lane: 0, distance: 10550, type: 'rock' },
    { lane: 2, distance: 10550, type: 'rock' },

    // Band 24 @ 11000: ice L0, rock L1, water L2 — all blocked
    { lane: 0, distance: 11000, type: 'ice'   },
    { lane: 1, distance: 11000, type: 'rock'  },
    { lane: 2, distance: 11000, type: 'water' },

    // Band 25 @ 11450: rock L0, ice L2 — L1 clear
    { lane: 0, distance: 11450, type: 'rock' },
    { lane: 2, distance: 11450, type: 'ice'  },

    // Band 26 @ 11750: water L1, rock L2 — L0 clear (finale)
    { lane: 1, distance: 11750, type: 'water' },
    { lane: 2, distance: 11750, type: 'rock'  }
  ],
  pickups: [
    { lane: 2, distance:  650, type: 'caltrop_pickup'  },  // between bands 1 & 2 (L0 clear@450)
    { lane: 0, distance: 1150, type: 'snipe_pickup'    },  // between bands 2 & 3 (L0 clear@900)
    { lane: 1, distance: 1600, type: 'caltrop_pickup'  },  // between bands 3 & 4 (L1 clear@1350)
    { lane: 0, distance: 2550, type: 'snipe_pickup'    },  // between bands 5 & 6 (L0 clear@2300)
    { lane: 1, distance: 3000, type: 'caltrop_pickup'  },  // between bands 6 & 7 (L1 clear@2750)
    { lane: 2, distance: 3450, type: 'snipe_pickup'    },  // between bands 7 & 8 (L2 clear@3200)
    { lane: 0, distance: 4300, type: 'caltrop_pickup'  },  // between bands 9 & 10 (L1 clear@4150)
    { lane: 1, distance: 5350, type: 'snipe_pickup'    },  // between bands 11 & 12 (L0 clear@5100)
    { lane: 2, distance: 6200, type: 'caltrop_pickup'  },  // between bands 13 & 14 (L2 clear@6000)
    { lane: 0, distance: 7150, type: 'snipe_pickup'    },  // between bands 15 & 16 (L1 clear@6900)
    { lane: 1, distance: 9000, type: 'caltrop_pickup'  },  // between bands 21 & 22 (L0 clear@9650)
    { lane: 0, distance: 10350, type: 'snipe_pickup'   },  // between bands 22 & 23 (L2 clear@10100)
  ]
};

// ─── Track 3 ─────────────────────────────────────────────────────────────────
// 12 000 units, 29 bands, 58 obstacles.
// Gauntlet: cannot be completed by staying in any one lane.
// Mid-section forces 4 mandatory switches through tight corridors.
// Heavy debuff pressure in late section.
// No band has rocks in all 3 lanes.
export const TRACK_3 = {
  id:     'track_3',
  name:   'Track 3',
  length: 12000,
  obstacles: [
    // Band 1 @ 400: rock L0, water L1 — L2 clear
    { lane: 0, distance:  400, type: 'rock'  },
    { lane: 1, distance:  400, type: 'water' },

    // Band 2 @ 850: ice L0, rock L2 — L1 clear
    { lane: 0, distance:  850, type: 'ice'  },
    { lane: 2, distance:  850, type: 'rock' },

    // Band 3 @ 1300: rock L1, ice L2 — L0 clear
    { lane: 1, distance: 1300, type: 'rock' },
    { lane: 2, distance: 1300, type: 'ice'  },

    // Band 4 @ 1750: water L0, rock L1, ice L2 — all blocked
    { lane: 0, distance: 1750, type: 'water' },
    { lane: 1, distance: 1750, type: 'rock'  },
    { lane: 2, distance: 1750, type: 'ice'   },

    // Band 5 @ 2200: rock L0, ice L1 — L2 clear
    { lane: 0, distance: 2200, type: 'rock' },
    { lane: 1, distance: 2200, type: 'ice'  },

    // Band 6 @ 2650: water L1, rock L2 — L0 clear
    { lane: 1, distance: 2650, type: 'water' },
    { lane: 2, distance: 2650, type: 'rock'  },

    // Band 7 @ 3100: ice L0, rock L2 — L1 clear
    { lane: 0, distance: 3100, type: 'ice'  },
    { lane: 2, distance: 3100, type: 'rock' },

    // ── GAUNTLET (3600–5800): forced 4 lane-switches ─────────────────────────
    // Step 1 @ 3600: rock L0, ice L1, rock L2 — only L1 (costs ice debuff unless ice_grip)
    { lane: 0, distance: 3600, type: 'rock' },
    { lane: 1, distance: 3600, type: 'ice'  },
    { lane: 2, distance: 3600, type: 'rock' },

    // Step 2 @ 4100: rock L1, rock L2 — must go L0 (coming from L1)
    { lane: 1, distance: 4100, type: 'rock' },
    { lane: 2, distance: 4100, type: 'rock' },

    // Step 3 @ 4600: rock L0, water L1 — must go L2 (coming from L0)
    { lane: 0, distance: 4600, type: 'rock'  },
    { lane: 1, distance: 4600, type: 'water' },

    // Step 4 @ 5100: rock L1, rock L2 — must go L0 again
    { lane: 1, distance: 5100, type: 'rock' },
    { lane: 2, distance: 5100, type: 'rock' },

    // Step 5 @ 5600: rock L0, ice L2 — must go L1
    { lane: 0, distance: 5600, type: 'rock' },
    { lane: 2, distance: 5600, type: 'ice'  },
    // ── End gauntlet ─────────────────────────────────────────────────────────

    // Band 13 @ 6100: water L0, rock L1, ice L2 — all blocked
    { lane: 0, distance: 6100, type: 'water' },
    { lane: 1, distance: 6100, type: 'rock'  },
    { lane: 2, distance: 6100, type: 'ice'   },

    // Band 14 @ 6550: rock L0, water L2 — L1 clear
    { lane: 0, distance: 6550, type: 'rock'  },
    { lane: 2, distance: 6550, type: 'water' },

    // Band 15 @ 7000: ice L0, rock L1 — L2 clear
    { lane: 0, distance: 7000, type: 'ice'  },
    { lane: 1, distance: 7000, type: 'rock' },

    // Band 16 @ 7500: rock L1, water L2 — L0 clear
    { lane: 1, distance: 7500, type: 'rock'  },
    { lane: 2, distance: 7500, type: 'water' },

    // Band 17 @ 7950: ice L0, rock L2 — L1 clear
    { lane: 0, distance: 7950, type: 'ice'  },
    { lane: 2, distance: 7950, type: 'rock' },

    // Band 18 @ 8400: rock L0, ice L1, water L2 — all blocked
    { lane: 0, distance: 8400, type: 'rock'  },
    { lane: 1, distance: 8400, type: 'ice'   },
    { lane: 2, distance: 8400, type: 'water' },

    // Band 19 @ 8900: water L0, rock L2 — L1 clear
    { lane: 0, distance: 8900, type: 'water' },
    { lane: 2, distance: 8900, type: 'rock'  },

    // Band 20 @ 9350: rock L0, rock L1 — L2 clear (double rock)
    { lane: 0, distance: 9350, type: 'rock' },
    { lane: 1, distance: 9350, type: 'rock' },

    // Band 21 @ 9800: ice L1, rock L2 — L0 clear
    { lane: 1, distance: 9800, type: 'ice'  },
    { lane: 2, distance: 9800, type: 'rock' },

    // Band 22 @ 10250: water L0, ice L2 — L1 clear
    { lane: 0, distance: 10250, type: 'water' },
    { lane: 2, distance: 10250, type: 'ice'   },

    // Band 23 @ 10700: rock L0, water L1, ice L2 — all blocked
    { lane: 0, distance: 10700, type: 'rock'  },
    { lane: 1, distance: 10700, type: 'water' },
    { lane: 2, distance: 10700, type: 'ice'   },

    // Band 24 @ 11150: ice L0, rock L1 — L2 clear
    { lane: 0, distance: 11150, type: 'ice'  },
    { lane: 1, distance: 11150, type: 'rock' },

    // Band 25 @ 11600: rock L1, water L2 — L0 clear
    { lane: 1, distance: 11600, type: 'rock'  },
    { lane: 2, distance: 11600, type: 'water' },

    // Band 26 (finale) @ 11850: rock L0, ice L1, water L2 — all blocked
    { lane: 0, distance: 11850, type: 'rock'  },
    { lane: 1, distance: 11850, type: 'ice'   },
    { lane: 2, distance: 11850, type: 'water' }
  ],
  pickups: [
    { lane: 2, distance:  600, type: 'caltrop_pickup'  },  // between bands 1 & 2 (L2 clear@400)
    { lane: 1, distance: 1100, type: 'snipe_pickup'    },  // between bands 2 & 3 (L1 clear@850)
    { lane: 0, distance: 1550, type: 'caltrop_pickup'  },  // between bands 3 & 4 (L0 clear@1300)
    { lane: 2, distance: 2450, type: 'snipe_pickup'    },  // between bands 5 & 6 (L2 clear@2200)
    { lane: 0, distance: 2900, type: 'caltrop_pickup'  },  // between bands 6 & 7 (L0 clear@2650)
    { lane: 1, distance: 3350, type: 'snipe_pickup'    },  // between bands 7 & gauntlet (L1 clear@3100)
    { lane: 2, distance: 5350, type: 'caltrop_pickup'  },  // after gauntlet step 4 (L2 clear@5100)
    { lane: 1, distance: 6300, type: 'snipe_pickup'    },  // between bands 13 & 14 (L1 clear@6100)
    { lane: 2, distance: 6750, type: 'caltrop_pickup'  },  // between bands 14 & 15 (L2 clear@6550)
    { lane: 2, distance: 7700, type: 'snipe_pickup'    },  // between bands 15 & 16 (L2 clear@7000)
    { lane: 1, distance: 9100, type: 'caltrop_pickup'  },  // between bands 19 & 20 (L1 clear@8900)
    { lane: 0, distance: 10500, type: 'snipe_pickup'   },  // between bands 22 & 23 (L1 clear@10250)
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
