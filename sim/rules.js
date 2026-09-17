// All timing in ticks (60 ticks/s). Distances in sub-units (POSITION_SCALE sub-units = 1 display unit).
// To convert ms to ticks for tuning comments: ticks = Math.round(ms / (1000/60))

export const TICK_RATE              = 60;
export const POSITION_SCALE         = 30;  // sub-units per display unit

// Timing (ticks)  — comment shows original ms for readability
export const REACTIVE_WINDOW_TICKS  = 27;  // 450ms
export const PRESS_AHEAD_TICKS      = 24;  // 400ms
export const SPRINT_TICKS           = 240; // 4000ms
export const ICE_DEBUFF_TICKS       = 120; // 2000ms
export const WATER_DEBUFF_TICKS     = 120; // 2000ms
export const FLASH_TICKS            = 21;  // 350ms
export const LANE_SWITCH_TICKS      = 9;   // 150ms
export const PHASE_ALPHA_TICKS      = 18;  // 300ms

// Speeds (sub-units/tick)
export const BASE_SPEED_TICKS       = 100; // 200 display/s × POSITION_SCALE ÷ TICK_RATE
export const SPRINT_SPEED_TICKS     = 140; // 1.4× speed
export const ICE_SPEED_TICKS        = 50;  // 0.5× speed
export const WATER_SPEED_TICKS      = 30;  // 0.3× speed

// 2P (sub-units)
export const GAP_ELIMINATION_SCALED = 15000; // 500 display × 30
export const GAP_WARNING_SCALED     =  9000; // 300 display × 30

// Collision — Y in sub-units, X in screen pixels
export const COL_HALF_Y_SCALED      =  1500; // (OBS_H/2+20)×POSITION_SCALE = 50×30
export const COL_HALF_X             =   100; // OBS_W/2+20 = 100px

// For tuning UI only — never call this in gameplay
export function ticksToMs(ticks) { return Math.round(ticks * 1000 / TICK_RATE); }
