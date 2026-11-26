// The behaviours a user can rewrite. Each one is a MORPH expression.

export const FORMULAS = [
  {
    key: 'sway',
    label: 'Branch sway',
    unit: 'px offset per row',
    vars: ['x', 'y', 't', 'h', 'wind'],
    help: 'h = how high in the crown (0 low … 1 top)',
    value: 'wind * 1.6 * sin(t * 1.3 + y * 0.12) * h',
  },
  {
    key: 'petalX',
    label: 'Petal drift',
    unit: 'px per frame →',
    vars: ['x', 'y', 't', 'seed', 'wind'],
    help: 'seed = a fixed random number per petal',
    value: 'wind * 0.45 + 0.3 * sin(t * 1.8 + seed * 6.3)',
  },
  {
    key: 'petalY',
    label: 'Petal fall',
    unit: 'px per frame ↓',
    vars: ['x', 'y', 't', 'seed', 'wind'],
    help: 'always falls at least a little',
    value: '0.2 + 0.1 * hash(seed) + 0.06 * cos(t * 2.4 + seed)',
  },
  {
    key: 'twinkle',
    label: 'Star twinkle',
    unit: 'brightness 0 … 1',
    vars: ['x', 'y', 't', 'seed'],
    help: 'evaluated once per star',
    value: '0.55 + 0.45 * sin(t * (0.8 + hash(seed) * 2) + seed)',
  },
  {
    key: 'ripple',
    label: 'Water ripple',
    unit: 'px offset per row',
    vars: ['d', 't', 'wind'],
    help: 'd = depth below the waterline',
    value: 'sin(d * 0.7 - t * 2.4) * (0.4 + d * 0.05) * (0.5 + wind)',
  },
]

export const PRESETS = {
  calm: {
    name: 'Calm',
    params: { wind: 0.25, speed: 0.7, petals: 40 },
  },
  breeze: {
    name: 'Breeze',
    params: { wind: 0.6, speed: 1, petals: 90 },
  },
  storm: {
    name: 'Spring storm',
    params: { wind: 1.6, speed: 1.4, petals: 160 },
  },
}

export const VAR_LABELS = {
  x: 'Position X', y: 'Position Y', t: 'Time', h: 'Crown height', seed: 'Random seed',
  wind: 'Wind', d: 'Water depth',
}
