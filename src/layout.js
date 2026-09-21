// src/layout.js
// Shared region-based layout utilities. Extracted from the ConfigScene layout
// fix so every screen with hand-placed controls goes through the same
// dev-mode overlap/bounds assertion instead of a parallel, screen-local check.

export const IS_DEV = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

/**
 * Dev-only: warns on non-finite/zero-size rects, rects that spill outside
 * [0,0,boundsW,boundsH], and any pair of rects in the list that overlap.
 * Call once per scene after every region/control rect has been placed.
 *
 * Optional `regions` (a { name: {x,y,w,h} } map, e.g. from layoutColumn) lets
 * items opt into a parent-containment check by carrying a `parent` field
 * naming one of those regions — the item's rect must then lie fully inside
 * that region's rect. Items without a `parent` skip this extra check, so
 * existing callers that never modeled explicit regions are unaffected.
 */
export function assertLayoutItems(items, boundsW, boundsH, regions) {
  if (!IS_DEV) return;
  for (let i = 0; i < items.length; i++) {
    const { name, x, y, w, h, parent } = items[i];
    if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) {
      console.warn(`LAYOUT [${name}] non-finite dimension: {${x},${y},${w},${h}}`);
      continue;
    }
    if (w <= 0 || h <= 0) {
      console.warn(`LAYOUT [${name}] zero/negative dimension: {${x},${y},${w},${h}}`);
      continue;
    }
    if (x < 0 || y < 0 || x + w > boundsW || y + h > boundsH) {
      console.warn(`LAYOUT [${name}] out of canvas: {${x},${y},${w},${h}}`);
    }
    if (parent && regions && regions[parent]) {
      const r = regions[parent];
      if (x < r.x || y < r.y || x + w > r.x + r.w || y + h > r.y + r.h) {
        console.warn(`LAYOUT [${name}] escapes parent region "${parent}": {${x},${y},${w},${h}} vs region {${r.x},${r.y},${r.w},${r.h}}`);
      }
    }
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
        console.warn(`LAYOUT "${name}" overlaps "${b.name}": {${x},${y},${w},${h}} vs {${b.x},${b.y},${b.w},${b.h}}`);
      }
    }
  }
}

/** Advances a y-cursor top-to-bottom; slot(h, gap) returns the top y of the next slot. */
export class RowCursor {
  constructor(startY) { this._y = startY; }
  slot(h, gap = 4) { const y = this._y; this._y += h + gap; return y; }
  get y() { return this._y; }
}

/**
 * Lays out named full-width regions top-to-bottom between startY and endY,
 * separated by `gap`. Each spec is { name, h } where h is a pixel height,
 * or the string 'flex' to consume whatever space is left after the fixed
 * regions and gaps are subtracted (at most one 'flex' entry makes sense).
 * Returns { [name]: { x, y, w, h } }. No region's rect depends on another
 * region's *content* — only on this shared startY/endY/gap budget — so
 * resizing one region's content never moves a sibling.
 */
export function layoutColumn(startY, endY, specs, gap, width) {
  const fixedTotal = specs.reduce((sum, s) => sum + (s.h === 'flex' ? 0 : s.h), 0);
  const gapTotal   = gap * Math.max(0, specs.length - 1);
  const flexCount  = specs.filter(s => s.h === 'flex').length;
  const available  = Math.max(0, endY - startY - fixedTotal - gapTotal);
  const flexH      = flexCount > 0 ? available / flexCount : 0;

  const regions = {};
  let y = startY;
  for (const s of specs) {
    const h = s.h === 'flex' ? flexH : s.h;
    regions[s.name] = { x: 0, y, w: width, h };
    y += h + gap;
  }
  return regions;
}
