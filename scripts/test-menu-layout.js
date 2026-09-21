/**
 * Numeric verification of MenuScene's region-based layout: reconstructs the
 * exact rects MenuScene.create() computes (regions, mode-toggle buttons,
 * track buttons, footer buttons) using the same layout.js primitives, then
 * runs them through the same overlap/containment checks the dev-mode
 * assertion uses. No Phaser/browser needed — this is pure arithmetic.
 *
 * Run with:  node scripts/test-menu-layout.js
 */

import { layoutColumn, RowCursor } from '../src/layout.js';
import { CANVAS_W, CANVAS_H, ALL_TRACKS } from '../src/track.js';

let failed = 0;
function fail(msg) { console.error(`FAIL: ${msg}`); failed++; }

function checkOverlaps(items, label) {
  let ok = true;
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
        fail(`[${label}] "${a.name}" overlaps "${b.name}": {${a.x},${a.y},${a.w},${a.h}} vs {${b.x},${b.y},${b.w},${b.h}}`);
        ok = false;
      }
    }
  }
  if (ok) console.log(`  PASS — no overlaps among ${items.length} "${label}" items`);
}

function checkContainment(items, regions) {
  let ok = true;
  for (const it of items) {
    if (!it.parent) continue;
    const r = regions[it.parent];
    if (it.x < r.x || it.y < r.y || it.x + it.w > r.x + r.w || it.y + it.h > r.y + r.h) {
      fail(`"${it.name}" escapes parent region "${it.parent}": {${it.x},${it.y},${it.w},${it.h}} vs region {${r.x},${r.y},${r.w},${r.h}}`);
      ok = false;
    }
  }
  if (ok) console.log(`  PASS — every item stays inside its declared parent region`);
}

// ─── Reconstruct MenuScene's regions (must mirror src/MenuScene.js) ──────────

const REGION_GAP   = 14;
const HEADER_H     = 280;
const PLAYER_SEL_H = 50;
const FOOTER_H     = 90;

const regions = layoutColumn(0, CANVAS_H, [
  { name: 'header',       h: HEADER_H },
  { name: 'playerSelect', h: PLAYER_SEL_H },
  { name: 'trackSelect',  h: 'flex' },
  { name: 'footer',       h: FOOTER_H }
], REGION_GAP, CANVAS_W);

console.log('Regions:', JSON.stringify(regions, null, 1).replace(/\n\s*/g, ' '));

console.log('\nTest 1: regions do not overlap each other, all inside canvas');
{
  const regionItems = Object.entries(regions).map(([name, r]) => ({ name: `region-${name}`, ...r }));
  checkOverlaps(regionItems, 'regions');
  let boundsOk = true;
  for (const it of regionItems) {
    if (it.x < 0 || it.y < 0 || it.x + it.w > CANVAS_W || it.y + it.h > CANVAS_H) {
      fail(`region "${it.name}" out of canvas bounds: {${it.x},${it.y},${it.w},${it.h}}`);
      boundsOk = false;
    }
  }
  if (boundsOk) console.log('  PASS — all regions inside canvas bounds');
}

console.log('\nTest 2: mode-toggle buttons (playerSelect, static) never overlap each other, stay in region');
{
  const staticItems = [];
  const y = regions.playerSelect.y + regions.playerSelect.h / 2;
  const cx = CANVAS_W / 2;
  const xPositions = [cx - 130, cx, cx + 130];
  const w = 110, h = 28;
  ['1p', '2p', '3p'].forEach((m, i) => {
    staticItems.push({ name: `mode-${m}`, x: xPositions[i] - w / 2, y: y - h / 2, w, h, parent: 'playerSelect' });
  });
  checkOverlaps(staticItems, 'mode-toggle');
  checkContainment(staticItems, regions);
}

console.log('\nTest 3: track buttons (trackSelect, scrollable/masked) never overlap each other');
{
  // Local (0-based, unscrolled) content-space coordinates — matches how
  // MenuScene builds them inside _trackListContainer. These are legitimately
  // allowed to extend past regions.trackSelect.h; the mask + per-frame
  // input.enabled toggle (not static rect math) is what keeps them from ever
  // rendering or being clickable outside the region.
  const scrollItems = [];
  const cur = new RowCursor(0);
  ALL_TRACKS.forEach((track, i) => {
    const localCenterY = cur.slot(72, 8) + 36;
    scrollItems.push({ name: `track-${i}`, x: CANVAS_W / 2 - 460 / 2, y: localCenterY - 36, w: 460, h: 72 });
  });
  {
    const localCenterY = cur.slot(66, 8) + 33;
    scrollItems.push({ name: 'track-generated', x: CANVAS_W / 2 - 460 / 2, y: localCenterY - 33, w: 460, h: 66 });
  }
  {
    const localCenterY = cur.slot(66, 0) + 33;
    scrollItems.push({ name: 'track-yours', x: CANVAS_W / 2 - 460 / 2, y: localCenterY - 33, w: 460, h: 66 });
  }
  console.log(`  Track list content height: ${cur.y}px vs trackSelect region height: ${regions.trackSelect.h}px` +
    (cur.y > regions.trackSelect.h ? '  (overflows — scroll required, as expected)' : ''));

  checkOverlaps(scrollItems, 'track-buttons');
}

console.log('\nTest 3b: footer row buttons (static) never overlap each other, stay in region');
{
  // Mirrors MenuScene._drawFooter()'s RowCursor sequence.
  const footerItems = [];
  const cur = new RowCursor(regions.footer.y + 4);
  const debugRowY = cur.slot(22, 8);
  footerItems.push({ name: 'footer-debug', x: CANVAS_W / 2 - 110, y: debugRowY, w: 220, h: 22, parent: 'footer' });

  const btnRowY = cur.slot(30, 8);
  const btnCY = btnRowY + 15;
  const btn = (name, x, w) => footerItems.push({ name, x: x - w / 2, y: btnCY - 15, w, h: 30, parent: 'footer' });
  btn('footer-reset-p1', 60, 100);
  btn('footer-reset-p2', 168, 100);
  btn('footer-reset-p3', 276, 100);
  btn('footer-controls', CANVAS_W / 2, 160);
  btn('footer-export', CANVAS_W - 120, 210);
  btn('footer-replay', CANVAS_W - 310, 150);

  checkOverlaps(footerItems, 'footer');
  checkContainment(footerItems, regions);
}

console.log('\nTest 4: the reported bug — mode toggle (playerSelect) can never visually collide with track content (trackSelect)');
{
  // The two regions themselves don't overlap (Test 1), and trackSelect's
  // scrollable content is hard-clipped to regions.trackSelect via a
  // GeometryMask in MenuScene — so as long as the mask rect equals the
  // region rect (true by construction: MenuScene draws the mask directly
  // from regions.trackSelect), visible track content can never occupy
  // playerSelect's screen space, regardless of scroll offset.
  const ps = regions.playerSelect, ts = regions.trackSelect;
  const regionsOverlap = ps.x < ts.x + ts.w && ps.x + ps.w > ts.x && ps.y < ts.y + ts.h && ps.y + ps.h > ts.y;
  if (regionsOverlap) fail('playerSelect and trackSelect regions overlap — mask boundary would not protect the mode toggle');
  else console.log(`  PASS — playerSelect [${ps.y},${ps.y+ps.h}] and trackSelect [${ts.y},${ts.y+ts.h}] never overlap; the mask makes this the real guarantee`);
}

console.log('\nTest 5: deliberately reintroducing the overlap makes the check fail and names both');
{
  const overlapping = [
    { name: 'mode-1p',  x: 500, y: 300, w: 110, h: 28 },
    { name: 'track-0',  x: 400, y: 290, w: 460, h: 72 } // deliberately overlapping
  ];
  const beforeFailed = failed;
  const savedError = console.error;
  let captured = '';
  console.error = (msg) => { captured += msg + '\n'; };
  checkOverlaps(overlapping, 'deliberate-overlap-test');
  console.error = savedError;
  failed = beforeFailed; // this negative test intentionally "fails" the inner check; don't count it against us
  if (captured.includes('mode-1p') && captured.includes('track-0')) {
    console.log('  PASS — deliberate overlap is detected and both names are reported');
  } else {
    fail('deliberate overlap test did not name both offending items — assertion logic is broken');
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

if (failed === 0) {
  console.log('\nAll layout checks passed.');
  process.exit(0);
} else {
  console.error(`\n${failed} layout check(s) FAILED.`);
  process.exit(1);
}
