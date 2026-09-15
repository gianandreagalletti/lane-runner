const SAVE_KEY = 'laneRunner.save';

// Boosts unlocked at level-up, in order (level 2 → sprint, 3 → phase, 4 → quick_step)
const LEVELUP_UNLOCKS = ['sprint', 'phase', 'quick_step'];

function defaultSave() {
  return {
    level:          1,
    totalXP:        0,
    unlockedBoosts: ['rock_break', 'ice_grip', 'water_shield']
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Basic sanity check
      if (typeof parsed.level === 'number' && Array.isArray(parsed.unlockedBoosts)) {
        return parsed;
      }
    }
  } catch {}
  return defaultSave();
}

export function resetProgress() {
  localStorage.removeItem(SAVE_KEY);
  return defaultSave();
}

function saveProgress(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// XP threshold to REACH level N (N >= 2)
// Level N requires 100 * N cumulative XP.
function xpThreshold(level) {
  return 100 * level;
}

/**
 * Award XP for a run, handle level-ups, persist.
 * Returns { gained, levelsGained: [{level, unlocked}] }
 */
export function awardXP(state, distance, completed) {
  const gained = Math.floor(distance / 10) + (completed ? 50 : 0);
  state.totalXP += gained;

  const levelsGained = [];
  let keepChecking = true;
  while (keepChecking) {
    keepChecking = false;
    if (state.totalXP >= xpThreshold(state.level + 1)) {
      state.level++;
      // Unlock the corresponding boost if any
      const unlockIdx = state.level - 2; // level 2 → idx 0 = sprint
      const toUnlock  = LEVELUP_UNLOCKS[unlockIdx] ?? null;
      if (toUnlock && !state.unlockedBoosts.includes(toUnlock)) {
        state.unlockedBoosts.push(toUnlock);
      }
      levelsGained.push({ level: state.level, unlocked: toUnlock });
      keepChecking = true;
    }
  }

  saveProgress(state);
  return { gained, levelsGained };
}

/** XP needed to reach the next level from current state. */
export function xpToNext(state) {
  return xpThreshold(state.level + 1) - state.totalXP;
}
