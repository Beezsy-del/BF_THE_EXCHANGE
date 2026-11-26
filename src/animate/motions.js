// Ways to animate an artwork. Each one is a set of MORPH formulas for
// dx / dy (pixel offset), hue (colour shift in degrees) and bright (multiplier).
// Variables: x y (source pixel) · t time · seed random per pixel · cx cy centre
// r a distance & angle from centre · W H canvas size · amp strength · mx my mouse

export const MOTION_PROPS = [
  { key: 'dx', label: 'Move sideways', unit: 'pixels →', neutral: '0' },
  { key: 'dy', label: 'Move up / down', unit: 'pixels ↓', neutral: '0' },
  { key: 'hue', label: 'Colour shift', unit: 'degrees', neutral: '0' },
  { key: 'bright', label: 'Brightness', unit: '× (1 = unchanged)', neutral: '1' },
]

export const MOTION_VARS = ['x', 'y', 't', 'seed', 'cx', 'cy', 'r', 'a', 'mx', 'my', 'amp', 'W', 'H']
export const MOTION_VAR_LABELS = {
  x: 'Position X', y: 'Position Y', t: 'Time', seed: 'Random seed', cx: 'Centre X', cy: 'Centre Y',
  r: 'Distance from centre', a: 'Angle', mx: 'Mouse X', my: 'Mouse Y', amp: 'Strength', W: 'Width', H: 'Height',
}

export const MOTIONS = [
  {
    key: 'breeze', name: 'Breeze', desc: 'Sways like branches in the wind', mode: 'pixels',
    formulas: { dx: 'amp * 2 * sin(t * 1.2 + y * 0.15) * (1 - y / H)' },
  },
  {
    key: 'ripple', name: 'Ripple', desc: 'Rings travel out from the centre', mode: 'pixels',
    formulas: {
      dx: 'amp * 1.5 * cos(a) * sin(r * 0.45 - t * 2.5)',
      dy: 'amp * 1.5 * sin(a) * sin(r * 0.45 - t * 2.5)',
    },
  },
  {
    key: 'breathe', name: 'Breathe', desc: 'Slowly swells and settles', mode: 'pixels',
    formulas: {
      dx: '(x - cx) * 0.07 * amp * sin(t * 1.2)',
      dy: '(y - cy) * 0.07 * amp * sin(t * 1.2)',
      bright: '1 + 0.12 * sin(t * 1.2)',
    },
  },
  {
    key: 'float', name: 'Float', desc: 'Drifts as if under water', mode: 'pixels',
    formulas: {
      dx: 'amp * 0.8 * cos(t * 0.9 + y * 0.1)',
      dy: 'amp * 2 * sin(t * 1.3 + x * 0.08)',
    },
  },
  {
    key: 'flag', name: 'Flag', desc: 'Waves from the left edge', mode: 'pixels',
    formulas: { dy: 'amp * 2.5 * sin(x * 0.22 - t * 3) * x / W' },
  },
  {
    key: 'swirl', name: 'Swirl', desc: 'The middle twists back and forth', mode: 'pixels',
    formulas: {
      dx: '(x - cx) * (cos(amp * 0.6 * sin(t * 0.7) * max(0, 1 - r / 40)) - 1) - (y - cy) * sin(amp * 0.6 * sin(t * 0.7) * max(0, 1 - r / 40))',
      dy: '(x - cx) * sin(amp * 0.6 * sin(t * 0.7) * max(0, 1 - r / 40)) + (y - cy) * (cos(amp * 0.6 * sin(t * 0.7) * max(0, 1 - r / 40)) - 1)',
    },
  },
  {
    key: 'shimmer', name: 'Shimmer', desc: 'Colours flow, pixels glint', mode: 'pixels',
    formulas: {
      hue: '35 * sin(t * 0.8 + x * 0.06 + y * 0.04)',
      bright: '0.85 + 0.2 * sin(t * 2 + seed * 30)',
    },
  },
  {
    key: 'dissolve', name: 'Dissolve', desc: 'Bursts into particles, then reassembles', mode: 'particles',
    formulas: {
      dx: 'max(0, sin(t * 0.7)) ^ 3 * (hash(seed * 91) - 0.5) * W * amp',
      dy: 'max(0, sin(t * 0.7)) ^ 3 * (hash(seed * 37) - 0.5) * H * amp',
    },
  },
  {
    key: 'dust', name: 'Dust in the wind', desc: 'A gust carries pixels away and back', mode: 'particles',
    formulas: {
      dx: 'amp * 30 * max(0, sin(t * 0.6 - x * 0.03)) ^ 4 * (0.4 + seed)',
      dy: 'amp * 8 * max(0, sin(t * 0.6 - x * 0.03)) ^ 4 * (seed - 0.6)',
    },
  },
  {
    key: 'still', name: 'Touch', desc: 'Still — push it around with the mouse', mode: 'particles',
    formulas: {},
  },
]

export const motionByKey = (k) => MOTIONS.find((m) => m.key === k)
