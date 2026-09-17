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
