// Per-slot save keys — 1P always uses 'p1', 2P uses 'p1' and 'p2'.
function saveKey(slot) { return `laneRunner.save.${slot}`; }

// Boosts unlocked at level-up, in order (level 2 → sprint, 3 → phase, 4 → quick_step)
const LEVELUP_UNLOCKS = ['sprint', 'phase', 'quick_step'];

function defaultSave() {
  return {
    level:          1,
    totalXP:        0,
    unlockedBoosts: ['rock_break', 'ice_grip', 'water_shield']
  };
}

export function loadProgress(slot = 'p1') {
  try {
    const raw = localStorage.getItem(saveKey(slot));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.level === 'number' && Array.isArray(parsed.unlockedBoosts)) {
        return parsed;
      }
    }
  } catch {}
  return defaultSave();
}

export function resetProgress(slot = 'p1') {
  localStorage.removeItem(saveKey(slot));
  return defaultSave();
}

function saveProgress(state, slot) {
  localStorage.setItem(saveKey(slot), JSON.stringify(state));
}

// XP threshold to REACH level N (N >= 2)
function xpThreshold(level) {
  return 100 * level;
}

/**
 * Award XP for a run, handle level-ups, persist.
 * Returns { gained, levelsGained: [{level, unlocked}] }
 */
export function awardXP(state, distance, completed, slot = 'p1') {
  const gained = Math.floor(distance / 10) + (completed ? 50 : 0);
  state.totalXP += gained;

  const levelsGained = [];
  let keepChecking = true;
  while (keepChecking) {
    keepChecking = false;
    if (state.totalXP >= xpThreshold(state.level + 1)) {
      state.level++;
      const unlockIdx = state.level - 2;
      const toUnlock  = LEVELUP_UNLOCKS[unlockIdx] ?? null;
      if (toUnlock && !state.unlockedBoosts.includes(toUnlock)) {
        state.unlockedBoosts.push(toUnlock);
      }
      levelsGained.push({ level: state.level, unlocked: toUnlock });
      keepChecking = true;
    }
  }

  saveProgress(state, slot);
  return { gained, levelsGained };
}

/** XP needed to reach the next level from current state. */
export function xpToNext(state) {
  return xpThreshold(state.level + 1) - state.totalXP;
}
