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
