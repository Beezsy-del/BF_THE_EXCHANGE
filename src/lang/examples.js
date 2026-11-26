// Curated programs for the code studio. Each one draws something
// recognisable, then brings it to life with ANIMATE.

export const EXAMPLES = [
  {
    key: 'blossom',
    name: 'Living blossom',
    blurb: 'A cherry tree drawn with loops, swaying in the wind',
    code: `// A cherry tree, drawn with code, brought to life with math
CANVAS 96 64
BACKGROUND #0b0c22

LAYER stars
COLOR #c9ccff
REPEAT 46 AS i {
  MOVE hash(i) * 96  hash(i + 50) * 44
  DOT
}

LAYER ground
COLOR #1a1c3a
MOVE 0 53
RECT 96 11
COLOR #2c2f5e
MOVE 0 53
RECT 96 1

LAYER trunk
REPEAT 26 AS i {
  COLOR HSL 345 38 (20 + i * 0.7)
  MOVE 45 + 5 * sin(i * 0.16)  53 - i
  RECT 4.4 - i * 0.1  1
}
COLOR #6d3446
MOVE 48 34
LINE 60 28
MOVE 46 41
LINE 34 37

LAYER blossom
// shadowed underside first, then lighter tones on top
REPEAT 60 AS i {
  COLOR HSL (328 + hash(i) * 8)  58  (36 + hash(i + 100) * 8)
  MOVE 48 + 23 * sqrt(hash(i + 200)) * cos(tau * hash(i + 300))   28 + 7 * sqrt(hash(i + 200)) * sin(tau * hash(i + 300))
  CIRCLE 2 + hash(i + 400) * 2
}
REPEAT 18 AS i {
  COLOR HSL 330 58 (38 + hash(i + 900) * 8)
  MOVE 33 + (hash(i + 910) - 0.5) * 12   37 + (hash(i + 920) - 0.5) * 3
  CIRCLE 1.5 + hash(i + 930)
}
REPEAT 100 AS i {
  COLOR HSL (336 + hash(i + 500) * 10)  80  (58 + hash(i + 600) * 14)
  MOVE 47 + 21 * sqrt(hash(i + 700)) * cos(tau * hash(i + 800))   24 + 7 * sqrt(hash(i + 700)) * sin(tau * hash(i + 800))
  CIRCLE 1.2 + hash(i + 850) * 1.8
}
REPEAT 16 AS i {
  COLOR HSL 338 78 (58 + hash(i + 940) * 12)
  MOVE 33 + (hash(i + 950) - 0.5) * 10   35 + (hash(i + 960) - 0.5) * 2
  CIRCLE 1.2
}
// single-pixel sparkles catch the moonlight
REPEAT 150 AS i {
  COLOR HSL 342 100 (80 + hash(i + 1000) * 12)
  MOVE 46 + 19 * sqrt(hash(i + 1100)) * cos(tau * hash(i + 1200))   21 + 5 * sqrt(hash(i + 1100)) * sin(tau * hash(i + 1200))
  DOT
}

LAYER petals
COLOR #ffb8cf
REPEAT 36 AS i {
  MOVE 24 + hash(i + 70) * 50   30 + hash(i + 90) * 24
  DOT
}

ANIMATE stars {
  bright = 0.55 + 0.45 * sin(t * 2 + seed * 40)
}
ANIMATE blossom {
  dx = amp * 1.6 * sin(t * 1.3 + y * 0.15) * (40 - y) / 20
}
ANIMATE petals {
  dx = 4 * sin(t * 0.8 + seed * 6.3) + amp * 3
  dy = (y + t * 5 + seed * 40) % 30 + 25 - y
}
`,
  },
  {
    key: 'spiral',
    name: 'Twisted spiral',
    blurb: 'Turtle steps that turn 91° instead of 90°',
    code: `// A square spiral that turns one degree too far
CANVAS 128 96
BACKGROUND #0d0b14
MOVE 64 48
REPEAT 92 AS i {
  COLOR HSL (300 + i * 0.9)  72  (42 + i * 0.4)
  PAINT i * 1.04
  TURN RIGHT 91
}

// breathe outward from the centre, colour flows along the radius
ANIMATE {
  dx = amp * 1.6 * sin(t * 2 - r * 0.22) * cos(a)
  dy = amp * 1.6 * sin(t * 2 - r * 0.22) * sin(a)
  hue = 40 * sin(t * 0.7 - r * 0.07)
}
`,
  },
  {
    key: 'rose',
    name: 'Rose curve',
    blurb: 'r = cos(7θ / 4), plotted as 1,400 dots',
    code: `// A rose curve: r = cos(7/4 * θ)
CANVAS 120 120
BACKGROUND #06080f
REPEAT 1400 AS i {
  COLOR HSL (195 + 70 * sin(i * 0.006))  78  (52 + 18 * cos(i * 0.02))
  MOVE 60 + 52 * cos(1.75 * i * 0.018) * cos(i * 0.018)   60 + 52 * cos(1.75 * i * 0.018) * sin(i * 0.018)
  DOT
}

// slow rotation, with a ripple travelling outward
ANIMATE {
  dx = (x - cx) * (cos(t * 0.25) - 1) - (y - cy) * sin(t * 0.25) + amp * 1.5 * cos(a) * sin(t * 3 - r * 0.2)
  dy = (x - cx) * sin(t * 0.25) + (y - cy) * (cos(t * 0.25) - 1) + amp * 1.5 * sin(a) * sin(t * 3 - r * 0.2)
  hue = t * 12
}
`,
  },
  {
    key: 'heart',
    name: 'Heartbeat',
    blurb: 'An implicit curve filled with IF, pulsing',
    code: `// The heart curve (u² + v² - 1)³ - u²v³ < 0, filled pixel by pixel
CANVAS 64 64
BACKGROUND #12070c
REPEAT 64 AS j {
  REPEAT 64 AS i {
    MOVE i j
    IF -(((i - 32) / 18) ^ 2 + ((30 - j) / 18) ^ 2 - 1) ^ 3 + ((i - 32) / 18) ^ 2 * ((30 - j) / 18) ^ 3 {
      COLOR HSL (345 + j * 0.3)  86  (44 + (32 - j) * 0.6 + hash(i * 64 + j) * 7)
      DOT
    }
  }
}

// lub-dub: a sharp pulse twice per beat
ANIMATE {
  dx = (x - cx) * 0.14 * amp * (max(0, sin(t * 5)) ^ 6 + 0.5 * max(0, sin(t * 5 - 0.9)) ^ 6)
  dy = (y - cy) * 0.14 * amp * (max(0, sin(t * 5)) ^ 6 + 0.5 * max(0, sin(t * 5 - 0.9)) ^ 6)
  bright = 1 + 0.35 * max(0, sin(t * 5)) ^ 6
}
`,
  },
  {
    key: 'square',
    name: 'Hello, square',
    blurb: 'The smallest program: four strokes and a wobble',
    code: `// Start here: move, paint, turn, repeat
CANVAS 64 64
BACKGROUND #0e0f1a
COLOR #FF77AA
MOVE 22 22
REPEAT 4 {
  PAINT 20
  TURN RIGHT
}

ANIMATE {
  dx = 4 * sin(y * 0.2 + t)
  dy = 2 * cos(x * 0.2 + t)
  hue = t * 20
}
`,
  },
]

export const REFERENCE = [
  ['CANVAS w h', 'size, up to 320 × 180'],
  ['BACKGROUND #hex', 'backdrop colour'],
  ['COLOR #hex', 'or COLOR HSL h s l'],
  ['MOVE x y', 'jump the pen'],
  ['PAINT n', 'paint n pixels forward'],
  ['STEP n', 'move without painting'],
  ['TURN RIGHT|LEFT [deg]', 'or TURN deg'],
  ['FACE deg', '0 = right, 90 = down'],
  ['DOT · LINE x y', 'single pixel · straight line'],
  ['RECT w h · CIRCLE r · RING r', 'shapes at the pen'],
  ['REPEAT n AS i { }', 'loop; i counts from 0'],
  ['IF expr { }', 'runs when expr > 0'],
  ['LAYER name', 'group what follows'],
  ['ANIMATE [layer] { }', 'dx, dy, hue, bright = formula'],
]

export const ANIM_HELP = 'x y source position · t time · seed random per pixel · cx cy layer centre · r a distance & angle from centre · mx my mouse · amp slider'
