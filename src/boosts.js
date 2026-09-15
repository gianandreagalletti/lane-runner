export const BOOSTS = {
  ice_grip: {
    id:   'ice_grip',
    name: 'Ice Grip',
    type: 'passive',
    desc: 'Ice tiles: no slow'
  },
  water_shield: {
    id:   'water_shield',
    name: 'Water Shield',
    type: 'passive',
    desc: 'Water tiles: no slow'
  },
  quick_step: {
    id:   'quick_step',
    name: 'Quick Step',
    type: 'passive',
    desc: 'Instant lane switch'
  },
  rock_break: {
    id:         'rock_break',
    name:       'Rock Break',
    type:       'active',
    desc:       'Destroys next rock hit',
    usesPerRun: 2,
    reactive:   true   // only fires in the 250ms reactive window
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
    desc:       'Pass through 1 obstacle',
    usesPerRun: 1,
    reactive:   true
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
