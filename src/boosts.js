export const BOOSTS = {
  ice_grip: {
    id:   'ice_grip',
    name: 'Ice Grip',
    type: 'passive',
    desc: 'Ice tiles: partial/full speed'
  },
  water_shield: {
    id:   'water_shield',
    name: 'Water Shield',
    type: 'passive',
    desc: 'Water tiles: partial/full speed'
  },
  quick_step: {
    id:   'quick_step',
    name: 'Quick Step',
    type: 'passive',
    desc: 'Faster/instant lane switch'
  },
  rock_break: {
    id:         'rock_break',
    name:       'Rock Break',
    type:       'active',
    desc:       'Destroys next rock hit',
    usesPerRun: 2,
    reactive:   true   // only fires in the reactive window
  },
  sprint: {
    id:         'sprint',
    name:       'Sprint',
    type:       'active',
    desc:       '+40% speed for 4s',
    usesPerRun: 2,
    reactive:   false
  },
  phase: {
    id:         'phase',
    name:       'Phase',
    type:       'active',
    desc:       'Pass through ice/water (not rocks)',
    usesPerRun: 1,
    reactive:   false  // phase does NOT participate in the reactive window
  }
};

// Display order: passives row first, actives row second
export const BOOST_ORDER = [
  'ice_grip', 'water_shield', 'quick_step',
  'rock_break', 'sprint', 'phase'
];

// Which level first unlocks each boost (1 = starting)
export const BOOST_UNLOCK_LEVEL = {
  rock_break:    1,
  ice_grip:      1,
  water_shield:  1,
  sprint:        2,
  phase:         3,
  quick_step:    4
};

// SINGLE source-of-truth for all boost tuning values.
// Passive level effects and active charge costs all live here.
export const BOOST_CONFIG = {
  PASSIVE_POINTS: 6,
  ACTIVE_POINTS:  6,
  passives: {
    ice_grip:     { levels: [{ cost: 1, factorPct: 62 }, { cost: 2, factorPct: 75 }], baseFactorPct: 50 },
    water_shield: { levels: [{ cost: 1, factorPct: 47 }, { cost: 2, factorPct: 65 }], baseFactorPct: 30 },
    quick_step:   { levels: [{ cost: 1, ticks: 5 },     { cost: 2, ticks: 0 }],      baseTicks: 9 },
  },
  actives: {
    rock_break: { costPerCharge: 2, maxCharges: 3 },
    sprint:     { costPerCharge: 2, maxCharges: 3 },
    phase:      { costPerCharge: 1, maxCharges: 3 },
  }
};
