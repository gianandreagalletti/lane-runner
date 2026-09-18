// All timing in ticks (60 ticks/s). Distances in centi-units (CENTI_SCALE centi-units = 1 display unit).
// To convert ms to ticks for tuning comments: ticks = Math.round(ms / (1000/60))

export const TICK_RATE              = 60;
export const CENTI_SCALE            = 100; // centi-units per display unit

// Timing (ticks)  — comment shows original ms for readability
export const REACTIVE_WINDOW_TICKS  = 27;  // 450ms
export const PRESS_AHEAD_TICKS      = 24;  // 400ms
export const SPRINT_TICKS           = 240; // 4000ms
export const ICE_DEBUFF_TICKS       = 120; // 2000ms
export const WATER_DEBUFF_TICKS     = 120; // 2000ms
export const FLASH_TICKS            = 21;  // 350ms
export const LANE_SWITCH_TICKS      = 9;   // 150ms
export const PHASE_ALPHA_TICKS      = 18;  // 300ms

// Speed base (centi-units/tick)
// All factors: Math.floor(BASE_SPEED_CU * factorPct / 100) must be exact integers
export const BASE_SPEED_CU          = 500; // factor 100 → 500 cu/tick (= 5 units/tick = 300 units/s at 60Hz)

// Speed factor percentages (integers, all yield exact integers when applied)
// Sprint:          factor 140 → Math.floor(500*140/100) = 700 cu/tick  ✓
// Ice no grip:     factor  50 → Math.floor(500* 50/100) = 250 cu/tick  ✓
// Ice grip L1:     factor  62 → Math.floor(500* 62/100) = 310 cu/tick  ✓
// Ice grip L2:     factor  75 → Math.floor(500* 75/100) = 375 cu/tick  ✓
// Water no shield: factor  30 → Math.floor(500* 30/100) = 150 cu/tick  ✓
// Water shield L1: factor  47 → Math.floor(500* 47/100) = 235 cu/tick  ✓
// Water shield L2: factor  65 → Math.floor(500* 65/100) = 325 cu/tick  ✓

// 2P gap thresholds (centi-units)
export const GAP_ELIMINATION_CU     = 750 * CENTI_SCALE;  // 75000 cu = 750 display units
export const GAP_WARNING_CU         = 450 * CENTI_SCALE;  // 45000 cu = 450 display units

// Collision — Y in centi-units, X in screen pixels
export const COL_HALF_Y_SCALED      = 1500; // (OBS_H/2+20)×CENTI_SCALE = 15×100 (collision half-height in cu)
export const COL_HALF_X             =  100; // OBS_W/2+20 = 100px

// Draft slipstream (centi-units)
export const DRAFT_RANGE_CU     = 150 * CENTI_SCALE;  // 15000 cu
export const DRAFT_FACTOR       = 108;                 // integer percent

// Snipe shot projectile
export const SNIPE_SPEED_CU     = 900;   // cu/tick
export const SNIPE_LIFETIME     = 300;   // ticks
export const SNIPE_FACTOR       = 65;    // speed factor on hit (integer percent)
export const SNIPE_DEBUFF_TICKS = 120;   // 2s

// Pickup types → charge key mapping
export const PICKUP_TYPES = { caltrop_pickup: 'caltrop', snipe_pickup: 'snipe_shot' };

// For tuning UI only — never call this in gameplay
export function ticksToMs(ticks) { return Math.round(ticks * 1000 / TICK_RATE); }
