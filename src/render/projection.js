// src/render/projection.js
// Pure projection math — no Phaser imports, no sim imports.
// All worldX values are in track units; lane centres at [-240, 0, 240].

export const PROJ = {
  PERSPECTIVE_BLEND:   0.92,
  HORIZON_Y_RATIO:     0.23,
  FOCAL_RATIO:         0.20,
  PLAYER_ANCHOR_Y_RATIO: 0.80,
  CAM_BACK:            320,   // track units
  NEAR_CLAMP:          155,   // track units
  DRAW_DISTANCE:       3400,  // track units
  SEGMENT_LEN:         85,    // track units — yields ~40 segments
  IN_LANE_OFFSET:      45,    // track units
  MIN_LEAD_MARGIN:     200,   // track units
  FOG_ENABLED:         true,
};

// Lane geometry in track units.
// LANE_PITCH = 240 (200 of lane + 40 of gap).  ONE definition — every consumer calls laneCenterX().
export const LANE_PITCH    = 240;
export const LANE_HALF_TU  = 100;  // half of 200-unit lane width
export const LANE_TU       = [-240, 0, 240]; // laneCenterX(0..2) pre-computed

/** Canonical lateral position of a lane's centre in track units. */
export function laneCenterX(lane) { return (lane - 1) * LANE_PITCH; }

// Derived state — updated by initProjection()
let _cx      = 640;
let _HORIZON_Y      = 165.6;   // 0.23 * 720
let _FOCAL          = 256;     // 0.20 * 1280
let _PLAYER_ANCHOR_Y = 576;    // 0.80 * 720
let _CAM_HEIGHT     = 0;
let _FLAT_KZ        = 0;

/**
 * Call once on scene create and again on every resize.
 * Recomputes all derived projection constants.
 */
export function initProjection(canvasW, canvasH) {
  _cx             = canvasW / 2;
  _HORIZON_Y      = PROJ.HORIZON_Y_RATIO * canvasH;
  _FOCAL          = PROJ.FOCAL_RATIO * canvasW;
  _PLAYER_ANCHOR_Y = PROJ.PLAYER_ANCHOR_Y_RATIO * canvasH;
  _CAM_HEIGHT     = (PROJ.PLAYER_ANCHOR_Y_RATIO - PROJ.HORIZON_Y_RATIO) * canvasH * PROJ.CAM_BACK / _FOCAL;
  _FLAT_KZ        = (PROJ.PLAYER_ANCHOR_Y_RATIO - 0.06) * canvasH / PROJ.DRAW_DISTANCE;
}

/**
 * Project a world point to screen coordinates.
 * @param {number} worldX  - lateral position in track units; lane centres at -240, 0, +240
 * @param {number} zRel    - distance ahead of camera in track units (positive = in front)
 * @returns {{ x: number, y: number, scale: number }}
 */
export function project(worldX, zRel) {
  const zc = Math.max(zRel, PROJ.NEAR_CLAMP);

  // Full perspective terms
  const sP = _FOCAL / zc;
  const xP = _cx + worldX * sP;
  const yP = _HORIZON_Y + _CAM_HEIGHT * sP;

  // Flat reference terms (at camera-back distance)
  const sF = _FOCAL / PROJ.CAM_BACK;
  const xF = _cx + worldX * sF;
  const yF = _PLAYER_ANCHOR_Y - (zRel - PROJ.CAM_BACK) * _FLAT_KZ;

  const t = PROJ.PERSPECTIVE_BLEND;
  return {
    x:     xF + (xP - xF) * t,
    y:     yF + (yP - yF) * t,
    scale: sF + (sP - sF) * t,
  };
}

// Expose derived values for GroundRenderer and others that need them directly
export function getProjectionState() {
  return { cx: _cx, HORIZON_Y: _HORIZON_Y, FOCAL: _FOCAL, PLAYER_ANCHOR_Y: _PLAYER_ANCHOR_Y };
}
