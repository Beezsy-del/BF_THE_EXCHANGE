// Drawing programs behind the gallery experiences. Each draws a recognisable
// piece with the MORPH language and gives it life with ANIMATE.

export const OCEAN = `// Animated landscape: a sunset sea
CANVAS 128 72
BACKGROUND #2a1f3d

// sky: purple to peach, one row at a time
LAYER sky
REPEAT 41 AS j {
  COLOR HSL (262 + j * 2.9)  (52 + j * 0.8)  (26 + j * 1.05)
  MOVE 0 j
  RECT 128 1
}

LAYER sun
COLOR #ffd9a0
MOVE 86 37
CIRCLE 7
COLOR #fff3d6
CIRCLE 4

LAYER clouds
REPEAT 6 AS c {
  REPEAT 11 AS k {
    COLOR HSL (305 + hash(c * 11 + k) * 35)  40  (52 + hash(k + c * 5) * 16)
    MOVE hash(c + 1) * 150 - 10 + (hash(c * 11 + k + 50) - 0.5) * 24   6 + hash(c + 20) * 22 + (hash(c * 11 + k + 90) - 0.5) * 5
    CIRCLE 1.5 + hash(c * 11 + k + 30) * 2.5
  }
  REPEAT 6 AS k {
    COLOR HSL 25 90 78
    MOVE hash(c + 1) * 150 - 10 + (hash(c * 6 + k + 70) - 0.5) * 18   4 + hash(c + 20) * 22
    DOT
  }
}

// cliffs, sunlit along the edge
LAYER rocks
REPEAT 36 AS i {
  COLOR HSL 262 28 (11 + i * 0.15)
  MOVE i  25 + i * 0.42 + 2 * sin(i * 0.5)
  RECT 1  17 - i * 0.42
  COLOR HSL 18 70 58
  MOVE i  25 + i * 0.42 + 2 * sin(i * 0.5)
  DOT
}
REPEAT 30 AS i {
  COLOR HSL 262 28 (11 + i * 0.15)
  MOVE 127 - i  22 + i * 0.6 + 1.5 * sin(i * 0.7)
  RECT 1  20 - i * 0.6
}

LAYER sea
REPEAT 32 AS j {
  COLOR HSL (228 - j * 0.4)  48  (30 - j * 0.45)
  MOVE 0 41 + j
  RECT 128 1
}

LAYER foam
REPEAT 7 AS w {
  REPEAT 128 AS u {
    MOVE u  44 + w * 4.3 + sin(u * 0.15 + w) * 1.2
    IF sin(u * (0.22 + w * 0.02) + w * 2.1) - 0.55 {
      COLOR HSL 215 45 (62 + w * 3)
      DOT
    }
  }
}

LAYER glints
REPEAT 140 AS i {
  COLOR HSL 32 100 (68 + hash(i) * 22)
  MOVE 86 + (hash(i + 3) - 0.5) * (4 + hash(i + 7) ^ 1.6 * 30)   42 + hash(i + 7) ^ 1.6 * 29
  DOT
}

ANIMATE clouds {
  dx = (x + t * 3 + 20) % (W + 40) - 20 - x
}
ANIMATE foam {
  dx = amp * 3 * sin(t * 0.8 + y * 0.5)
  dy = 0.6 * sin(t * 1.5 + x * 0.2)
}
ANIMATE glints {
  bright = 0.55 + 0.55 * sin(t * 3 + seed * 40)
  dx = amp * 1.5 * sin(t * 1.3 + y)
}
ANIMATE sun {
  bright = 1 + 0.06 * sin(t)
}
`

function jelly(name, cx, cy, R, hue, n) {
  return `
LAYER ${name}
REPEAT ${R} AS j {
  COLOR HSL ${hue} 80 (74 - j * ${(34 / R).toFixed(2)})
  MOVE ${cx} - ${R} * sqrt(1 - ((${R} - j) / ${R}) ^ 2)   ${cy} - ${R} + j
  RECT 2 * ${R} * sqrt(1 - ((${R} - j) / ${R}) ^ 2) + 1  1
}
REPEAT ${R * 2} AS k {
  COLOR HSL ${hue} 90 82
  MOVE ${cx} - ${R} + k + 0.5   ${cy} - 1 + hash(k + ${cx}) * 1.5
  IF hash(k * 3 + ${cy}) - 0.5 { DOT }
}
REPEAT ${n} AS k {
  COLOR HSL ${hue} 70 (60 - hash(k + ${cx}) * 15)
  MOVE ${cx} - ${R * 0.75} + k * ${((R * 1.5) / (n - 1)).toFixed(2)}   ${cy} + 1
  FACE 90
  PAINT ${R * 1.2} + hash(k + ${cy}) * ${R * 1.4}
}
COLOR HSL ${hue} 85 72
MOVE ${cx} - 1 ${cy}
RECT 2 ${Math.round(R * 1.3)}
`
}

export const JELLYFISH = `// Living creatures: jellyfish drifting in the deep
CANVAS 96 80
BACKGROUND #050f22

LAYER deep
REPEAT 80 AS j {
  COLOR HSL 218 70 (15 - j * 0.11)
  MOVE 0 j
  RECT 96 1
}

LAYER plankton
REPEAT 80 AS i {
  COLOR HSL (190 + hash(i) * 30)  80  (50 + hash(i + 1) * 35)
  MOVE hash(i + 2) * 96  hash(i + 3) * 80
  DOT
}
${jelly('blue', 30, 26, 11, 205, 9)}
${jelly('amber', 72, 18, 7, 36, 6)}
${jelly('teal', 66, 50, 6, 190, 5)}
${jelly('gold', 18, 58, 5, 42, 5)}
ANIMATE plankton {
  dy = (y - t * 2 + seed * 80) % H - y + 0
  bright = 0.5 + 0.5 * sin(t * 2 + seed * 30)
}
ANIMATE blue {
  dx = amp * 1.6 * sin(y * 0.35 - t * 2.5) * max(0, y - cy + 3) / 12 + (x - cx) * 0.06 * sin(t * 2.2) * (y < cy - 3)
  dy = 2.5 * sin(t * 1.1)
}
ANIMATE amber {
  dx = amp * 1.4 * sin(y * 0.4 - t * 2.8 + 1) * max(0, y - cy + 2) / 10 + (x - cx) * 0.07 * sin(t * 2.5 + 1) * (y < cy - 2)
  dy = 2 * sin(t * 1.3 + 2)
}
ANIMATE teal {
  dx = amp * 1.3 * sin(y * 0.45 - t * 3 + 2) * max(0, y - cy + 2) / 9 + (x - cx) * 0.07 * sin(t * 2.4 + 2) * (y < cy - 2)
  dy = 2 * sin(t * 1.2 + 4)
}
ANIMATE gold {
  dx = amp * 1.2 * sin(y * 0.5 - t * 3.2 + 3) * max(0, y - cy + 2) / 8
  dy = 1.6 * sin(t * 1.5 + 1)
}
`

export const BLOOM = `// Particle transformation: a golden flower made of dots
CANVAS 96 96
BACKGROUND #0b0705

LAYER dust
REPEAT 220 AS i {
  COLOR HSL (32 + hash(i) * 14)  90  (35 + hash(i + 1) * 40)
  MOVE 48 + (hash(i + 2) - 0.5) * 94   48 + (hash(i + 3) - 0.5) * 94
  DOT
}

LAYER petals
REPEAT 900 AS i {
  REPEAT 8 AS s {
    COLOR HSL (24 + s * 3 + hash(i) * 6)  (68 + s * 3)  (26 + s * 7.5)
    MOVE 48 + (s + 1) / 8 * 42 * abs(cos(3 * i * 0.00698)) ^ 0.7 * cos(i * 0.00698)   48 + (s + 1) / 8 * 42 * abs(cos(3 * i * 0.00698)) ^ 0.7 * sin(i * 0.00698)
    DOT
  }
}

LAYER core
COLOR #4a1d06
MOVE 48 48
CIRCLE 5
REPEAT 40 AS i {
  COLOR HSL 45 100 (60 + hash(i) * 30)
  MOVE 48 + 4 * sqrt(hash(i + 5)) * cos(tau * hash(i + 6))   48 + 4 * sqrt(hash(i + 5)) * sin(tau * hash(i + 6))
  DOT
}

ANIMATE petals {
  dx = cx + r * (1 + 0.9 * amp * max(0, sin(t * 0.6)) ^ 3) * cos(a + 2 * max(0, sin(t * 0.6)) ^ 3) - x
  dy = cy + r * (1 + 0.9 * amp * max(0, sin(t * 0.6)) ^ 3) * sin(a + 2 * max(0, sin(t * 0.6)) ^ 3) - y
}
ANIMATE dust {
  dx = 3 * sin(t * 0.4 + seed * 20)
  dy = 3 * cos(t * 0.3 + seed * 17)
  bright = 0.4 + 0.6 * sin(t * 1.5 + seed * 40) ^ 2
}
ANIMATE core {
  bright = 1 + 0.15 * sin(t * 2)
}
`

export const SPIRAL = `// Abstract artwork: a square spiral that turns one degree too far
CANVAS 120 120
BACKGROUND #07060c
MOVE 60 60
REPEAT 116 AS i {
  COLOR HSL (i * 3.6)  85  (48 + i * 0.15)
  PAINT i * 1.0
  TURN RIGHT 91
}

ANIMATE {
  dx = amp * 1.4 * sin(t * 1.6 - r * 0.2) * cos(a)
  dy = amp * 1.4 * sin(t * 1.6 - r * 0.2) * sin(a)
  hue = t * 20
}
`

export const BLOSSOM_CODE = `// A cherry tree, drawn with code
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
REPEAT 60 AS i {
  COLOR HSL (328 + hash(i) * 8)  58  (36 + hash(i + 100) * 8)
  MOVE 48 + 23 * sqrt(hash(i + 200)) * cos(tau * hash(i + 300))   28 + 7 * sqrt(hash(i + 200)) * sin(tau * hash(i + 300))
  CIRCLE 2 + hash(i + 400) * 2
}
REPEAT 100 AS i {
  COLOR HSL (336 + hash(i + 500) * 10)  80  (58 + hash(i + 600) * 14)
  MOVE 47 + 21 * sqrt(hash(i + 700)) * cos(tau * hash(i + 800))   24 + 7 * sqrt(hash(i + 700)) * sin(tau * hash(i + 800))
  CIRCLE 1.2 + hash(i + 850) * 1.8
}
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
`

export const HELLO = `// Start here: move, paint, turn, repeat
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
`
