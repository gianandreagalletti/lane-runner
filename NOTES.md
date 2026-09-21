## Menu Layout Fix (post-Session 11)

### Bug
`_drawModeToggle` (player-count control, y=292, h=28) and the first track button
(y=318, h=72, spans 282-354) overlapped by 24px — both hand-placed constants that
never referenced each other, and drifted into collision once track buttons were
added below the toggle. The player-count control was completely unclickable: the
track button, added later in the display list, sat on top of it for input purposes.
Same failure mode as the ConfigScene overlap (see "Config Layout Fix" above) —
this screen had just never been brought under that layout discipline.

### Fix
Extracted `RowCursor` and the dev-mode overlap/bounds assertion out of ConfigScene
into a shared `src/layout.js`, so both screens run the *same* check instead of each
screen growing its own copy. Added `layoutColumn()`: divides a screen into named
regions (`header` / `playerSelect` / `trackSelect` / `footer`) top-to-bottom with
an enforced gap, at most one of which may be `'flex'` (consumes remaining space).

MenuScene rebuilt on top of this: mode toggle lives entirely inside `playerSelect`;
track buttons live inside `trackSelect`, in a container clipped with a GeometryMask
(`make.graphics({add:false})` — see the earlier ConfigScene preview-mask bug for
why `add.graphics()` there silently renders a white/filled rect instead of clipping).
Track content overflows its region (5 buttons need 380px, region is 258px), so it
scrolls via mouse wheel; items are only interactive (`bg.input.enabled`) when their
*current* scrolled position is fully inside the region — masking hides the visual,
this separately guards the hit-box, matching the "check both, not just the visual"
rule from the ConfigScene fix.

`assertLayoutItems()` gained an optional parent-region containment check, but it's
only meaningful for *static* controls (mode toggle, footer buttons) — a scrollable
region's children are legitimately allowed to extend past their region's edge when
unscrolled (that's what makes them scrollable), so checking their raw rect against
the region produces false positives once content overflows. Static controls and
scrollable-region children are asserted separately for this reason.

### Verified
No headless-browser test tool was available in this environment (no Playwright/
chromium-cli installed, and installing one wasn't done without asking first).
Verified two ways instead: (1) `scripts/test-menu-layout.js` replays the exact
region/button math from MenuScene.js through the same overlap/containment checks,
including a negative test that deliberately reintroduces the overlap and confirms
both offending names are reported; (2) drove a real headless Chrome instance via
raw CDP over Node's built-in WebSocket (no new dependency), clicked the "2 PLAYERS"
button, scrolled the track list, and confirmed screenshots + zero console
warnings/errors — see the three PNGs from that run for the visual record.

### Worth doing next
This is the second screen (after the configurator) found with hand-placed
coordinates that had silently gone stale. Audited the rest (not fixed):

- **PlanScene.js — HIGH risk.** `_drawShop()`'s passive-row Ys (162/196/230),
  active-row Ys (286/320/354/388), and the Start button (`btnY = 430`) are four
  independent hand-typed constants. Adding one more passive/active row means
  manually retyping every constant below it — exactly the drift that broke
  ConfigScene and MenuScene. No layout abstraction in the file at all.
- **PlanScene2P.js — HIGH risk.** `_buildPanel()`'s 7 interactive rows sit only
  3-14px away from `emptyWarnT`/`statusT`/the confirm button below them. One
  longer boost name or an 8th row collides directly with the confirm button.
- **ResultScene.js — MEDIUM.** Retry/Menu buttons don't collide with each other,
  but the loadout list grows dynamically (`264 + i*22`, up to ~y=396) straight
  into the fixed-position XP section — not a control-vs-control overlap yet, but
  the same "nothing recomputes when content grows" pattern.
- **JoinScene.js / ControlsScene.js / OnboardScene.js — LOW.** Each has at most
  one interactive element, so there's nothing for it to collide with.

PlanScene and PlanScene2P are real candidates for the next occurrence of this bug
class and should move to `src/layout.js` before they fail rather than after.

---

# Session 11 — Track Generator + Config Scene

## Summary

Procedural track generator (`sim/trackGen.js`), per-track recovery parameter, ConfigScene UI
with live preview, stress test script, and MenuScene "GENERATED TRACK" option.

## New files

- `sim/trackGen.js` — pure function `generateTrack(params, seed)` + `PRESETS`
- `src/ConfigScene.js` — configurator UI: preset buttons, seed reroll/input, advanced sliders, live map preview
- `scripts/stressTestGen.js` — 200-run stress test across 5 param sets × 40 seeds

## Changes

### sim/trackGen.js — generator algorithm

- Parameters: rhythm (0.6–2.0s), runLength (25–90s), pressure (40–100%), gates (0–50%),
  laneBias (0–100), recovery (0.75–2.5s)
- Validation: throws if `recovery*300*0.30 > rhythm*300` (slow player can't recover before next band)
- Track length estimated from `300 * (1 - pressure/100 * (1 - 0.65))` avg speed model
- Band positions scattered with mean spacing `rhythm*300`, min 240 units
- Band kinds: relief forced at 1 per quarter; otherwise gate (gated by 800u constraint) or damage/relief
- Post-pass ensures `floor(gateFrac * bandCount)` gates, converting damage bands as needed
- Gate open lanes: sequential, each within ±1 of previous (Fisher-Yates shuffle for lane choice)
- Lane bias: at 100, each lane has a fixed preferred hazard type; at 0, equal ice/water chance
- Returns `debuffTicks: round(recovery * 60)` — overrides ICE_DEBUFF_TICKS/WATER_DEBUFF_TICKS in sim

### Standard preset vs hand-authored Track 1 comparison

| Metric              | Track 1 (hand) | Standard preset (seed 0) |
|---------------------|----------------|--------------------------|
| Length (units)      | 10 200         | ~9 945                   |
| Gate fraction       | 25%            | ~30% target              |
| Damage fraction     | 57%            | ~65–75% (pressure-driven)|
| Relief fraction     | 17%            | ~15–20%                  |
| Debuff ticks        | 75 (constant)  | 75 (recovery=1.25 → 1.25*60)|
| Obstacle spacing    | ~285 units avg | ~285 units avg (rhythm=0.95) |

Duration estimate on Standard preset: estimatedAvgSpeed=195u/s, target 45s → ~8775u track.
Actual run time varies with passive loadout; headless test at 300u/s base would complete
in ~33s; with debuffs closer to 45s as calibrated.

### sim/state.js
- Added `ICE_DEBUFF_TICKS` import
- `createInitialState` stores `state.debuffTicks = trackData.debuffTicks ?? ICE_DEBUFF_TICKS`

### sim/step.js
- `_applyDebuff(ps, type, state)` now uses `state.debuffTicks` when present
- Snipe debuff still uses `SNIPE_DEBUFF_TICKS` (unchanged)

### src/RunScene.js
- MatchConfig now includes `trackParams` and `trackSeed` (null for hand-authored tracks)
- `appendLog` calls include `trackParams` / `trackSeed` for 1P and MP paths
- `init()` accepts `trackParams`/`trackSeed` from data (passed by ConfigScene)

### src/ConfigScene.js
- Preset buttons: Standard, Calm, Frantic, Gauntlet
- Seed display + reroll + numeric input field
- Advanced toggle showing 6 parameter steppers (rhythm, runLength, pressure, gates, laneBias, recovery)
- Live map preview: re-generates on every param change, renders same visual as PlanScene._drawMap
- Recovery warning: shown when `recovery*300*0.30 > rhythm*300`
- START PLANNING button routes to PlanScene (1p) or JoinScene (mp)

### src/MenuScene.js
- Added [4] GENERATED TRACK button routing to ConfigScene
- Track buttons shifted up slightly to accommodate 4th option

### src/main.js
- ConfigScene added to scene list (between PlanScene and RunScene)

## Design notes

- Recovery as a per-track param allows the generator to tune debuff harshness independently of
  the global constant. Hand-authored tracks still use ICE_DEBUFF_TICKS=75 (trackData.debuffTicks absent).
- The SLOW_FACTOR=0.30 validation uses the worst-case speed (water, no shield) — this is conservative;
  most players will recover faster. It prevents degenerate param combos where debuffs are permanent.
- The post-pass gate count enforcement converts damage bands (not relief) to maintain pressure feel.
- Pickup placement avoids the single clear lane of two-hazard bands to prevent "forced pickup risk".

---

## Config Layout Fix + Single Rail (post-Session 10)

### Layout
Rewrote ConfigScene to use region-based layout with a RowCursor instead of hardcoded y-constants.
Header: title left, mode toggle right — no overlap at any supported size.
Controls panel flows top-to-bottom; advancing panel expands in place by rebuilding `_genPanel` (state lives in `this._params`, not in UI objects).
Preview area masked with GeometryMask to clip map drawing.
Dev-mode layout assertions added (`_assertLayoutItems`) — fire on localhost, name both rects on failure.

### Single rail
`sim/validateTrack.js`: 0, 1, or 2 rails per band are all valid.
- 0: no-op
- 1: ordinary single-lane hazard (no gate rules apply)
- 2: gate (spacing >= 800u, open-lane continuity, must have non-rock hazard in open lane)
- 3: violation ("all three lanes have guard rails")
Gate-specific rules filter `gateDists` to bands with exactly 2 rocks — 1-rail bands are invisible to them.
Generator output unchanged: it never produces 1-rail bands, and the 200-track stress test still passes.

---

# Session 10 — Track Content Rebuild + Debuff Rebalance

## Summary

Rebuilt all 3 tracks from scratch to comply with new 5-rule assertion system.
Changed ICE_DEBUFF_TICKS and WATER_DEBUFF_TICKS from 120 → 75 (already done in previous session).
Added gate band visualization to PlanScene planning map.

## Changes

### sim/rules.js
- ICE_DEBUFF_TICKS: 75 (was 120) — confirmed already at 75
- WATER_DEBUFF_TICKS: 75 (was 120) — confirmed already at 75
- SNIPE_DEBUFF_TICKS: 120 — unchanged

### sim/state.js
- Renamed _assertNoAllRockBands → assertTrackValid (already implemented all 5 rules from previous session)

### src/track.js — full rebuild

#### Track 1 (ice-heavy)
- Length: 10 200 units
- Bands: 40 total — 10 gate (25%), 23 damage (57%), 7 relief (17%)
- Gates at: 500,1500,2500,3550,4600,5650,6700,7750,8800,9700
- Open lanes: 1→0→1→2→1→0→1→2→1→0 (all shifts ≤1, all gaps ≥ 900)
- Ice dominant in damage bands; one water per damage band for variety
- Headless time (ice_grip L2 + water_shield L2 + quick_step L1 + rock_break ×3): **2709 ticks (~45.1s)**

#### Track 2 (water-heavy)
- Length: 9 400 units
- Bands: 36 total — 9 gate (25%), 21 damage (58%), 6 relief (17%)
- Gates at: 500,1500,2500,3550,4600,5650,6700,7750,8800
- Open lanes: 1→2→1→0→1→2→1→0→1 (all shifts ≤1, all gaps ≥ 1000)
- Water dominant in damage bands; one ice per damage band for variety
- Headless time (same loadout): **2731 ticks (~45.5s)**

#### Track 3 (mixed, gate-heavy)
- Length: 9 900 units
- Bands: 37 total — 12 gate (32%), 19 damage (51%), 6 relief (16%)
- Gates at: 450,1250,2050,2850,3650,4450,5250,6050,6850,7650,8450,9250
- Open lanes: 1→0→1→2→1→0→1→2→1→0→1→2 (all shifts ≤1, all gaps = 800)
- Mixed ice+water in damage bands
- Headless time (same loadout): **2760 ticks (~46.0s)**

### src/PlanScene.js — planning map updates
- Gate bands: gold border on left and right column edges + "GATE / Ln" label showing open lane
- Per-lane hazard summary: changed to "Nxice  Nxwtr  Nxrail" format (separate ice/water counts)
- New helper method _getGateDists() extracts gate band positions and open lanes

## Band composition rules (enforced by assertTrackValid)

1. No band has rocks in all 3 lanes
2. Rocks only in gate bands: 0 or exactly 2 rocks per band
3. Gate bands must have a non-rock obstacle (in the open lane)
4. Consecutive gates >= 800 units apart
5. Open lane shifts by at most 1 between consecutive gates

---

# Session 9 — Graded Draft + Wake Visual + Debug Mode

## Summary

Graded draft ramp, visible wake behind every vehicle, draft HUD indicator, debug slow-follower mode.

## Changes

### Part 1: Graded draft (sim/rules.js, sim/step.js, sim/state.js)
- `DRAFT_RANGE_CU` changed 15000 → 26000 (260 track units), `DRAFT_FACTOR` removed.
- New constant `DRAFT_MAX_BONUS = 12` (integer percent at gap=0).
- Draft is now a linear ramp: `draftFactor = 100 + floor(DRAFT_MAX_BONUS * (DRAFT_RANGE_CU - gap) / DRAFT_RANGE_CU)`
  - gap=100 → draftFactor=111, gap=13000 → 106, gap=25900 → 100 (verified by hand).
- `ps.draftFactor` and `ps.isDrafting` stored in player state each tick.
- Speed chain unchanged in order: debuff → sprint → draft (draft applied last).
- `state.debugSlowSlots = []` added to initial state (default empty, no effect on normal play).

### Part 2: Wake visual (src/player.js)
- Wake drawn FIRST (before vehicle billboard) so it appears behind it.
- 5 strips from `zRel+1` to `zRel+1+DRAFT_RANGE_TU` (260 tu), tapering from 0.6×BILL_W to 0.15×BILL_W.
- Peak alpha = `(DRAFT_MAX_BONUS / 12) * 0.18` — tied to same constant as draft formula.
- Each strip fades linearly; faint edge lines for "air disturbance" look.
- Uses vehicle's own body colour per vehicle index.

### Part 3: Draft streaks + HUD (src/player.js, src/RunSceneHud.js)
- Draft streaks: 2 short lines (vs sprint's 3), intensity proportional to `(draftFactor-100) / DRAFT_MAX_BONUS`.
- 1P HUD: `» DRAFT »` text replaced with `≈ DRAFT +N%` showing live bonus percent.
- MP HUD: small `≈ +N%` tag added next to sprint text for each player.

### Part 4: Debug slow-follower mode (src/MenuScene.js, src/RunScene.js, sim/step.js)
- Toggle button in MenuScene: "DEBUG: SLOW FOLLOWERS [ON/OFF]", sets `window.__lrDebug.slowFollowers`.
- When active, RunScene sets `state.debugSlowSlots = [1, 2, ...]` (all slots except 0) after state creation.
- sim/step.js: if `state.debugSlowSlots.includes(ps.idx)`, final speed multiplied by 80/100.
- `debugSlowSlots` is never written to MatchConfig, never appears in session log.

## Colour/constant reference (Session 9)

| Constant          | Value | Meaning                           |
|-------------------|-------|-----------------------------------|
| DRAFT_RANGE_CU    | 26000 | 260 track units                   |
| DRAFT_MAX_BONUS   | 12    | integer percent bonus at gap=0    |
| DRAFT_RANGE_TU    | 260   | (DRAFT_RANGE_CU / CENTI_SCALE)    |
| Wake peak alpha   | 0.18  | at DRAFT_MAX_BONUS=12             |
| Debug slow factor | 80%   | of computed speed for slow slots  |

---

# Session 8 — Art/Presentation Pass

## Summary

Full visual rework. No sim/ files touched. No collision geometry changed. Replay determinism preserved.

## Changes

### Req 1: Road surface — asphalt with tinted lanes
- Lane colours: blended #2E3338 asphalt base with 12% accent (brown/grey/teal per lane).
- Alternating segment contrast reduced to factor 0.96 ("patched tarmac", not racing stripes).
- Kerb strips removed; replaced with solid white edge lines (8 tu wide) on outer edges of lane 0 and lane 2.
- White dashed lane markings at internal lane boundaries (worldX = -140 and +140).
  - Dash length 80 tu, gap 120 tu, period 200 tu.
  - Rendered from world-absolute dash index (`di * 200`), NOT from segIdx or elapsed time.

### Req 2: Guard rail replaces rock obstacle visual
- Type 'rock' now renders as a crash barrier: two steel posts + horizontal beam.
- Beam has black base (#14181B) with yellow (#F2C230) diagonal chevron stripes (6 stripes).
- Thin dark grey top face for depth. No collision geometry change.

### Req 3: Ice — flat decal on road
- Type 'ice' (non-caltrop) renders as flat irregular shard polygon on road surface.
- Colour #B8D8E8, alpha 0.85. 8 vertices, seeded from obstacle properties.
- Crack lines from centre to 3 edge vertices. Sheen highlight ellipse at centre.
- Shard outlines cached in `_shardCache` Map — generated once, never per frame.

### Req 4: Water — flat decal, blobby
- Type 'water' renders as flat blobby outline on road surface.
- Colour #3AA8C4, alpha 0.75. 10 vertices, smoothed. Lighter rim outset.
- Two ripple arcs (concentric ellipses) inside blob.
- Blob outlines cached in `_shardCache` Map with 'blob_' key prefix.

### Req 5: Vehicle billboards
- Three distinct vehicle silhouettes: ambulance (white, BILL_H=66), fire truck (red, BILL_H=62), police (blue, BILL_H=54).
- Each has: body rect, cabin windows, livery stripe, 4 wheels, rear lights, roof light bar.
- Light bar flashes based on simTick: slow (every 30 ticks) at rest, fast (every 10 ticks) when sprinting.
- Ambulance: red cross on side. Fire truck: ladder lines on roof. Police: white door panels.
- vehicleIdx passed via Player constructor opts and RunScene uses slot index.

### Req 6: Vehicle identity on other screens
- JoinScene: vehicle silhouette (top-view rect with stripe) in each slot card. Vehicle name label below.
- PlanScene2P: panel headers show "P1 — AMBULANCE", "P2 — FIRE TRUCK", "P3 — POLICE".
- RunSceneHud: dist colours updated to vehicle colours (#F0F0F0 / #C4463A / #3A5ACD).
- RunScene player labels: use vehicle colours instead of old amber/teal.
- ResultScene: vehicle name shown below P1/P2/P3 label in MP columns.

### Req 7: Caltrop visual
- Caltrop decal renders as flat violet shard polygon with 6 spike lines radiating from centre.
- Same shard cache system as ice.

### Req 8: Snipe projectile — siren burst
- Projectile now renders as elongated oval (siren burst shape) in caster's vehicle colour.
- 3 trailing afterimage copies behind it at decreasing opacity.

### Req 9: Pickups visual
- caltrop_pickup (#9B6BDA): violet diamond + filled circle (road cone silhouette).
- snipe_pickup (#7ED957): green cross/star shape.

### Req 10: Planning map obstacle colours
- rock → dark #2A2E34 with yellow (#F2C230) chevron stripe indicator, label "▓ RAIL".
- ice → pale blue #B8D8E8, label "~ ICE".
- water → teal #3AA8C4, label "≈ WTR".
- Count text uses "rail" instead of "rock".

### Req 11: Performance
- No new Graphics objects created in render loop.
- Ice/water/caltrop shard outlines generated once, cached in Map keyed by `lane_distanceScaled`.
- Vehicle drawings use existing per-player Graphics objects, cleared each frame.
- Target: 60fps with 3 players. Lane dash pass adds ~40 fillPoints calls (one per visible dash × 2 boundaries). Overall overhead negligible compared to existing ~40 lane segment quads.

## Colour reference (Session 8)

| Element              | Hex          |
|----------------------|--------------|
| Asphalt base         | #2E3338      |
| Guard rail beam      | #14181B      |
| Guard rail chevrons  | #F2C230      |
| Guard rail posts     | #8090A0      |
| Ice decal            | #B8D8E8      |
| Water decal          | #3AA8C4      |
| Caltrop decal        | #9B6BDA      |
| Ambulance body       | #F0F0F0      |
| Fire truck body      | #C4463A      |
| Police body          | #1A2A6C      |
| caltrop_pickup       | #9B6BDA      |
| snipe_pickup         | #7ED957      |

---

# Session 8 (old title) — Loadout Screen Input Fix (P2/P3 Keyboard + Gamepad)

## Bug cause

Events DID arrive (the keyboard listener was registered for all players), but were
DISCARDED for P2 and P3. The `_buildPanel` keyboard handler used:

```js
e.code === `Key${keys.left}`   // e.g. 'KeyLEFT' — never matches; ArrowLeft is 'ArrowLeft'
e.code === keys.left           // e.g. 'LEFT' — never matches
e.key  === keys.left           // e.g. 'LEFT' — never matches; actual e.key is 'ArrowLeft'
```

For P1's letter keys (`keys.left = 'A'`), the first pattern produces `'KeyA'` which
DOES match `e.code`. That's why P1 worked and P2/P3 didn't.

The old code also used a hardcoded `playerKeys` array with values like `'RSHIFT'`
(invalid Phaser key name) and `'NUMPAD_FOUR'`/`'NUMPAD_ZERO'` (numpad, which fail on
laptops and when NumLock is off).

## Fix

- **`src/controls.js`**: Added `up`, `down`, `confirm` to each player's BINDINGS entry.
  P3 confirm = `H` (avoids conflict with `U` which is P3 boost slot 3 in RunScene).
  P3 up/down = `I`/`K` (note: `I` is also P3 boost slot 0 — the shop is pre-run so
  there's no conflict in context; both are correct in their respective scenes).
  All key names verified against `node_modules/phaser/src/input/keyboard/keys/KeyCodes.js`.

- **`src/PlanScene2P.js`**: Complete rewrite of input path.
  - Replaced `e.code` string comparison with Phaser `addKey()` + `JustDown()` polled
    via `scene.events.on('update', ...)`. This correctly handles all key name formats.
  - Each player slot registers its own keys from `BINDINGS[p${i+1}]`, closing over `i`.
  - All slots live simultaneously — no focus/turn system.
  - Gamepad: edge-triggered left-stick Y/X and d-pad via `_shopUpdate()` called each frame.
    Reads `claims[i].padIndex` to find the right pad per slot.
  - Left/right keys step the value on the currently-highlighted row.
  - Mouse: [-] and [+] buttons on every row are `setInteractive()` clickable.
  - Empty loadout warning: bright yellow "NO BOOSTS SELECTED" shown when nothing spent.
  - Unspent budget readout turns yellow when fully unspent.
  - Removed hardcoded `playerKeys` from `buildShopPicker` API; now reads from `BINDINGS`.
  - `claims` array passed from PlanScene so hint text shows correct device (pad/keyboard).

- **`src/PlanScene.js`**:
  - Imports `BINDINGS` from controls.js.
  - 1P confirm/back key events now use `BINDINGS.p1.confirm` and `BINDINGS.global.back`.
  - `_buildMultiPlayerUI` passes `claims` to `buildShopPicker`; removed `playerKeys`.

- **`src/ControlsScene.js`**:
  - Imports `BINDINGS` and `KEY_DISPLAY`; all key labels now derived from BINDINGS.
  - Planning screen section updated to show per-player up/down/row/value/confirm keys.

## Key bindings (post-fix)

| Player | Lane L/R | Shop up/down | Shop value | Shop confirm | Run boosts |
|--------|----------|-------------|------------|--------------|------------|
| P1     | A / D    | W / S       | A / D      | F            | 1/2/3/4    |
| P2     | ← / →    | ↑ / ↓       | ← / →      | Enter        | 8/9/0/7    |
| P3     | Q / E    | I / K       | Q / E      | H            | I/O/P/U    |
| Pad    | stick/dpad L/R | dpad/stick ↑↓ | dpad/stick ←→ | A button | face buttons |

Arrow keys captured in PlanScene2P to prevent browser page scroll.

---

# Session 7 — Draft, Caltrop, Snipe Shot, Track Pickups

## Summary

Session 7 adds the first competitive mechanics that act across players: draft
slipstream (passive, free), caltrop (placed hazard), and snipe shot (aimed
projectile). Phase boost is benched (removed from shop/progression/keymapping;
code preserved in sim with `// BENCHED: phase` comments).

## Speed composition (exact order, non-negotiable)

```
let speed = BASE_SPEED_CU;                            // 500
if (debuff)  speed = floor(speed * debuffFactor/100);
if (sprint)  speed = floor(speed * 140/100);
if (draft)   speed = floor(speed * DRAFT_FACTOR/100); // 108
```

Verified example: water debuff (no shield) + drafting:
  500 * 30/100 = 150, then 150 * 108/100 = 162 cu/tick

Snipe debuff factor = 65 — not affected by any passive (ice_grip, water_shield
have no effect). Caltrop sets debuffType='ice' so ice_grip DOES reduce it.

## Draft

- Passive, free, always on — no action required.
- Triggers when nearest ahead-in-lane player gap is 0 < gap ≤ DRAFT_RANGE_CU (15000 cu).
- Does NOT stack (only one nearest-ahead player counts).
- Computed every tick in sim/step.js before _tickPlayer; ps.isDrafting stored for HUD.
- Visual: double chevron (» ») above player billboard in player.js; "» DRAFT »" in HUD.

## Caltrop (slot 2)

- Placed at caster's position minus 200 units (in cu: trackPosition - 200*CENTI_SCALE).
- Uses ice debuff path — ice_grip reduces it. NOT a snipe debuff.
- isCaltrop=true flag distinguishes it from track ice for rendering.
- Obstacle insert uses binary search (_insertSorted) to maintain sorted order.
- Caster pre-marked as hitByPlayer to avoid self-hit.
- Renderer: violet color (#9B6BDA), spike mark instead of ice diagonal lines.
- `caltrop_placed` event causes RunScene to call `obstacles.invalidateCullIndex()`.

## Snipe Shot (slot 3)

- Projectile moves SNIPE_SPEED_CU (900 cu/tick) forward from caster's position.
- Lifetime SNIPE_LIFETIME (300 ticks = 5s) or until track end.
- Hit detection: prevZ < playerZ ≤ newZ per tick. If two players in same tick, lower slot wins.
- On hit: debuffType='snipe', debuffTicksLeft=SNIPE_DEBUFF_TICKS (120), flashTicksLeft set.
- Snipe debuff factor = SNIPE_FACTOR (65) regardless of passives.
- Visual: orange-red dot with trailing streak (obstacles.drawProjectile).
- snipe_hit event → snipeHitEffect() → orange-red ring flash on hit player.

## Track Pickups

- Per-track array in trackData.pickups: { lane, distance, type: 'caltrop_pickup'|'snipe_pickup' }.
- Collision: player crosses pickup.distanceScaled this tick (prevPos < ds ≤ newPos).
- Only granted if player has the boost slot unlocked AND charges < maxCharges.
- Never removed from world — each player's collection tracked separately via collectedByPlayer[].
- Visual: caltrop_pickup = violet circle/diamond, snipe_pickup = green circle/diamond.
- ~6 of each type per track, spread through run. Pickups never placed in the only-clear lane
  of a band that has an obstacle at the same distance.

## Canonical slot mapping (Session 7)

- Slot 0: rock_break (reactive, hold-to-arm)
- Slot 1: sprint (instant)
- Slot 2: caltrop (instant)
- Slot 3: snipe_shot (instant)
- BENCHED: phase — was slot 2 in Session 5/6

## Key bindings

- P1: 1/2/3/4 for slots 0–3
- P2: 8/9/0/7 for slots 0–3
- P3: I/O/P/U for slots 0–3
- Gamepad: A=slot0, X=slot1, B=slot2, Y=slot3

## Level-up unlocks (updated)

- Level 2: sprint
- Level 3: caltrop
- Level 4: snipe_shot
- Level 5: quick_step

---

# Session 6 — Perspective Run View

## Architecture

- `src/render/projection.js` — pure projection math, no Phaser imports.
  `PROJ` config, `initProjection(w,h)`, `project(worldX, zRel) → {x,y,scale}`.
  Lane centres in track units: `LANE_TU = [-240, 0, 240]`.
  `PERSPECTIVE_BLEND=0` produces flat view; `=1` produces full perspective.

- `src/render/GroundRenderer.js` — sky gradient, ground gradient, ~40 back-to-front lane
  quad segments with fog blending, alternating-segment shading keyed off absolute track
  distance, outer kerb strips, and two-layer parallax skyline.

- `src/obstacles.js` — each obstacle is a 3D box: top face + front face (66% brightness).
  Fog blending, shape marks (rock=cross, ice=diagonals, water=waves) for colorblind safety.
  Distance-sorted culling via `_startIdx` pointer (no full-scan per frame).

- `src/player.js` — billboard: rounded-rect body, elliptical shadow, lower-third volume band,
  debuff glow, flash colour, sprint streaks. Exposes `x`, `y`, `screenScale` for HUD use.

- `src/RunScene.js` — perspective `cameraZ` replaces old zoom. All renderables (obstacles +
  players) merged into a single far-to-near list for correct occlusion. GroundRenderer drawn
  first. Resize listener calls `initProjection`.

- `src/RunSceneRenderer.js` — warning arrows and player labels use projected `playerObj.x`
  rather than pixel lane centres. `handleSimEvents` derives cameraZ identically to `_render`.

## Camera formula

```
cameraZ = min(minPlayerZ - CAM_BACK, maxPlayerZ - CAM_BACK - MIN_LEAD_MARGIN)
```
Camera sits CAM_BACK (320 tu) behind the slowest player, but never so close that the
leader clips past the near plane. `MIN_LEAD_MARGIN=200` ensures leader stays visible.

## Projection tuning

Key knobs in `PROJ` (src/render/projection.js):
- `PERSPECTIVE_BLEND` — 0=flat, 1=full perspective. Default 0.92.
- `HORIZON_Y_RATIO` — horizon height as fraction of canvas. Default 0.23.
- `FOCAL_RATIO` — focal length as fraction of canvas width. Default 0.20.
- `PLAYER_ANCHOR_Y_RATIO` — screen Y where player stands. Default 0.80.
- `DRAW_DISTANCE` — how far ahead to draw (track units). Default 3400.
- `CAM_BACK` — camera offset behind player (track units). Default 320.

## Coordinate mapping

`worldX` is in track units; lane centres at `[-240, 0, 240]`. At `zRel=CAM_BACK`,
scale factor `sF = FOCAL/CAM_BACK = 256/320 = 0.8`. Lane centre 240 maps to screen
`640 + 240*0.8 = 832px`; centre -240 maps to 448px. Each lane spans ~192px at player depth.

## Performance notes

- One Graphics object each for ground, obstacles, players — cleared each frame.
- Obstacle culling: `_startIdx` advances as camera moves forward; no full scan.
- Lane segments: ~40 quads per frame (DRAW_DISTANCE / SEGMENT_LEN ≈ 40).
- Skyline: deterministic building layout (no Math.random), two layers, tiled with wrap.

## Network-readiness preserved

- sim/ untouched — replay determinism guaranteed.
- No gameplay values written from renderer.
- `grep -rn "from.*sim/" src/render/` returns nothing.

---

# Session 5 — Centi-units, Levelled Passives, Shop UI

## Clean run timing

Headless sim (Track 1, ice_grip L2 + water_shield L2 + quick_step L1, rock_break ×3,
AI lane-switch avoidance): COMPLETE in 2808 ticks (~46.8s).
Target was ~40s; gap is explained by L2 passive debuffs still slowing the player on
ice and water tiles. A player with pure sprint charges instead would be faster.
Bare minimum (no passives, no actives, perfect lane navigation): ~24s at 500 cu/tick.

## Centi-units design

Previous: `POSITION_SCALE = 30`, speed in display-unit sub-integers (100 cu/tick at base).
Session 5: `CENTI_SCALE = 100`, `BASE_SPEED_CU = 500` (5 display units/tick = 300 display units/s).
All speed factors are integer percentages — `Math.floor(500 * factorPct / 100)` produces
exact integers for every factor defined in BOOST_CONFIG. No floating-point drift.

Speed values verified:
- Base 100%  → 500 cu/tick
- Sprint 140% → 700 cu/tick
- Ice L0 50%  → 250  Water L0 30% → 150
- Ice L1 62%  → 310  Water L1 47% → 235
- Ice L2 75%  → 375  Water L2 65% → 325

## Loadout format change

Old: `['ice_grip', 'rock_break', 'sprint']`  (pick-3 set)
New: `{ passives: { ice_grip: 2, water_shield: 0, quick_step: 1 }, actives: { rock_break: 2, sprint: 0, phase: 0 } }`

`createInitialState` accepts both formats (legacy array converted internally).
`sessionLog.appendLog` normalises to new format before persisting.
`ResultScene._loadoutToDisplayList` converts either format for display.

## Shop UI (PlanScene)

Replaced pick-3 with levelled shop:
- Passives: 3 rows (ice_grip, water_shield, quick_step) with [-][+] level steppers.
  Level 2 requires level 1 already bought. Budget enforced: never goes negative.
- Actives: 3 rows (rock_break, sprint, phase) with [-][+] charge steppers.
- Unspent points allowed — confirm any time.
- 1P: ENTER to confirm, mouse click also works.
- MP: each player has a panel; dedicated nav keys per player; CONFIRM button locks in.

## Phase restrictions (clarified in sim/step.js)

- Phase does NOT work on rocks (only ice/water).
- Phase does NOT participate in the reactive window — pressing phase during REACTIVE state
  is silently ignored. Only slot 0 (rock_break) can cancel a lethal rock in reactive.
- quick_step L2 = instant lane switch (0 ticks animation).

## Camera zoom threshold

Changed from 500 to 750 display units spread before zoom kicks in.
Formula: `zoom = max(0.75, 1.0 - (spread / 750) * 0.25)`

## Design notes (from spec)

- PASSIVE_POINTS and ACTIVE_POINTS are both 6. Spending all 6 passive points buys:
  ice_grip L2 (1+2=3) + water_shield L1 (1) + quick_step L1 (1) = 5, or any other
  combo totalling ≤6. Encourages specialisation.
- rock_break and phase share the active pool; each rock_break charge costs 2pts,
  each phase charge 1pt. Sprint costs 2pt/charge. Full rock_break (3×) costs 6pts alone.
- The no-all-rocks-in-3-lanes constraint is asserted at runtime in createInitialState,
  not just at build time.

---

# Session 4J — Three Players & Xbox Gamepads

## Key decisions

- P3 keyboard bindings: Q/E for lanes, I/O/P for boosts. These are fallback only; P3 is expected to use a gamepad.
- Plan screen with gamepad: during planning, pad players use keyboard equivalents OR the physical keyboard. Pad polling is not implemented in PlanScene — out of scope for 4J. Note for future session.
- JoinScene is skipped for 1P (goes directly to PlanScene). Used only for 2P and 3P.
- Stick edge-trigger: crossing ±0.5 fires lane intent; must return inside deadzone before next trigger.
- Hold-to-arm on pad: A/X/B emit boost_down on press, boost_up on release, identical to keyboard boost_down/up. Sim handles armed state normally.
- Camera zoom: 1.0→0.75 linearly as spread goes 0→500 display units, floored at 0.75. Applied via this.cameras.main.setZoom().
- Visual offsets: 3 players in same lane at -45, 0, +45px. Collision uses lane only.
- rock_break in 3P destroys for ALL players (clears for all 3). Phase is still per-player.
- Placement XP: +25 first, +15 second, +5 third. Everyone still earns distance XP.
- Log format: placements array replaces winner string. Both old (1p with 'winner') and new records coexist — EXPORT LOG handles both.

## Design notes (from requirements, do not implement)

- Rock Break is now worse in 3P: clearing a rock benefits 2 opponents instead of 1. May become a trap pick.
- All 3 lanes occupied most of the time. High congestion; blocking would matter here. Do not implement blocking.

---

# Session 4N — Network-Readiness Refactor

## Key decisions

- POSITION_SCALE = 30: integer sub-units. 200 display/s → 100 sub/tick, sprint 140, ice 50, water 30.
- sim/ is pure JS, zero Phaser imports, runs under Node. Proved via `node scripts/headless.js`.
- Intent types: lane_left, lane_right, boost_down, boost_up. Only consumer is sim/step.js.
- boostKeyHeld tracks held key state in sim state (from boost_down/boost_up intents). hold-to-arm works.
- boostPressTimer (ticks) tracks press-ahead buffer. Set on boost_down in RUNNING state. Auto-fires on rock collision if > 0.
- drawAlpha is in sim state (drawAlphaTicksLeft ticks down). Renderer reads it — no Phaser tweens on drawAlpha.
- Lane switch is instant in sim collision logic (ps.lane updates immediately). laneVisualFrom/laneVisualTicksLeft used by renderer only for smooth animation.
- quick_step: sets laneVisualTicksLeft=0 so visual is also instant.
- Replay: intent log + MatchConfig + outcome saved to localStorage after each run. REPLAY LAST RUN button in MenuScene.
- MatchConfig JSON round-trip assertion on every match start.
- `node scripts/headless.js` proves sim determinism under Node.
- 4A-FIX behaviors preserved: 24-tick press-ahead buffer, hold-to-arm via boostKeyHeld flag.
- 2P reactive overlay skipped (per-player overlays) — HUD chip armed indicators are sufficient for 2P.
- RunScene.js split: RunSceneHud.js (HUD build/update), RunSceneRenderer.js (render helpers). All under 300 lines.

---

# Req 4 — Rock Break vs Phase tradeoff in 2P

> "Req 4 gives Rock Break a cost in two-player mode: clearing the rock also clears it for your opponent. Whether players notice that tradeoff, and whether it makes Phase the better competitive pick, is a playtest question. Do not rebalance either boost pre-emptively."

---

# Session 4B — 2P Shared-Camera Design

## Sprint's offensive use

Sprint gives +40% speed for 4 seconds. In 2P shared-camera mode, pulling far enough
ahead of the opponent eliminates them (`GAP_ELIMINATION` constant in `src/RunScene.js`,
currently 500 track units). Sprint can close that gap offensively — burn a charge at
the right moment and you might leave the other player permanently behind.

Whether this is exciting (sprint becomes a tactical weapon with a counterplay window)
or degenerate (whoever uses sprint first just wins) is exactly what the playtest
will answer. **Do not pre-emptively nerf it.**

To tune during playtest: `GAP_ELIMINATION` at the top of `src/RunScene.js`.
Raising it → more forgiving. Lowering it → sprint-rush dominant.

---

# Session 2B — Design Notes

## Reactive Window Tuning

**Goal:** A player who reacts in time never dies. A player who doesn't always does.

### What I tried

**v1 — 100ms window**
Too short. Even a player watching for the cue couldn't reliably hit the key before the
window closed. Felt arbitrary and punishing.

**v2 — 500ms window**
Too long. Reduced the tension and made the "skill moment" feel like a slow buffer
rather than a real reaction. Players would often press the key late without feeling
they'd done anything clever.

**v3 — 250ms (shipped)**
Comfortable for a player actively watching the HUD cue (the red flash + "REACT!" text
appears immediately on collision). Reflexively pressing the key in time feels rewarding.
A distracted player or someone who forgot which key is their reactive boost still dies.

250ms is also close to average simple reaction time (~200-250ms for visual stimuli),
which means players who prepared their finger on the right key succeed; players who
haven't thought ahead fail. This matches the game's "planning = skill" thesis.

### Visual cue design

- **Red screen overlay** (pulsing opacity): communicates urgency, fills peripheral
  vision so players who aren't watching the exact center still notice.
- **"REACT! [key] BoostName"** text at screen center: tells the player exactly which
  key to press. Removed ambiguity about whether a boost could save them.
- **Yellow border on the pending obstacle**: shows which obstacle triggered the window,
  so after the fact players understand what happened.
- Overlay alpha scales with remaining time: brighter at the start of the window,
  fading toward zero — gives a natural "countdown" feel without a numerical timer.

### What was deliberately NOT done

- Slow-motion / time scaling: Phaser's timeScale affects tweens and the game loop
  non-uniformly; it created jank where the player tween kept running at normal speed
  while the timer slowed. Removed.
- Camera shake: added noise without helping legibility. Removed.

---

## TRACK_2 — Verified Winning Loadouts

**Loadout A: ice_grip + water_shield + rock_break**
Route: start L1 → L2 (400) → L0 (700) → L2 ice [suppressed] (1000) → L2 (1300)
→ L1 (1600) → L0 ice [suppressed] (1900) → L0 (2300) → L2 (2700)
→ L2 ice [suppressed] (3000) → L2 (3400) → L0 (3800) → L2 water [suppressed] (4100)
→ L1 (4500) → L0 (4800). Zero rocks touched. Both rock_breaks unused.
Time ~26s.

**Loadout B: ice_grip + rock_break + phase**
Route: L1 → L2 (400) → L0 (700) → L2 [ice slow] (1000) → L2 (1300)
→ L1 (1600) → L0 [ice slow, suppressed by ice_grip] (1900) → L0 (2300) → L2 (2700)
→ L2 [ice slow, suppressed] (3000) → L2 (3400) → L0 (3800) → L2 [water slow] (4100)
→ L1 (4500) → L0 (4800). Zero rocks touched. rock_break and phase unused.
Slower due to one water slow at 4100 (~28s).

Both confirmed completable. At least two genuinely different loadouts, different passive
compositions.
