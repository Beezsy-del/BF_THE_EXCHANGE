import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from './draw.js'

const ok = (src) => {
  const r = run(src)
  assert.ok(r.ok, `line ${r.line}: ${r.error}`)
  return r.art
}
const at = (art, x, y) => art.pixels.find((p) => p.x === x && p.y === y)

test('blueprint example: a square outline', () => {
  const art = ok(`
CANVAS 128 128
COLOR #FF77AA
MOVE 40 40
REPEAT 4 {
    PAINT 20
    TURN RIGHT
}
ANIMATE {
    dx = 4 * sin(y * 0.2 + t)
    dy = 2 * cos(x * 0.2 + t)
    hue = t * 20
}`)
  assert.equal(art.width, 128)
  assert.equal(art.pixels.length, 80)
  assert.deepEqual([at(art, 40, 40).r, at(art, 40, 40).g, at(art, 40, 40).b], [255, 119, 170])
  assert.ok(at(art, 60, 40) && at(art, 60, 60) && at(art, 40, 60))
  assert.ok(!at(art, 50, 50))
  assert.deepEqual(Object.keys(art.animations['*']).sort(), ['dx', 'dy', 'hue'])
})

test('several commands on one line, single-line blocks', () => {
  const art = ok('CANVAS 10 10\nMOVE 0 0\nREPEAT 2 { PAINT 3  TURN RIGHT }')
  assert.equal(art.pixels.length, 6)
})

test('loop variables and expressions with spaces', () => {
  const art = ok('CANVAS 20 20\nREPEAT 5 AS i {\n MOVE i * 2 + 1  10\n DOT\n}')
  assert.deepEqual(art.pixels.map((p) => p.x), [1, 3, 5, 7, 9])
})

test('negative argument starts a new value', () => {
  const art = ok('CANVAS 20 20\nMOVE 10 10\nFACE 0\nPAINT -3')
  assert.deepEqual(art.pixels.map((p) => p.x).sort((a, b) => a - b), [8, 9, 10])
})

test('IF with comparison draws a filled disc', () => {
  const art = ok(`CANVAS 11 11
REPEAT 11 AS j { REPEAT 11 AS i {
  MOVE i j
  IF (i-5)^2 + (j-5)^2 <= 9 { DOT }
} }`)
  assert.equal(art.pixels.length, 29)
})

test('layers and per-layer animation, HSL colour', () => {
  const art = ok(`CANVAS 16 16
COLOR HSL 330 80 70
LAYER petals
MOVE 2 2
CIRCLE 1
ANIMATE petals { dy = t }`)
  assert.ok(art.pixels.every((p) => p.layer === 'petals'))
  assert.ok(art.animations.petals.dy)
})

test('helpful errors carry line numbers', () => {
  const bad = (src) => run(src)
  let r = bad('CANVAS 10 10\nPAINTT 5')
  assert.equal(r.line, 2); assert.match(r.error, /Unknown command "PAINTT" — did you mean PAINT?/)
  r = bad('REPEAT 3 {\nPAINT 2')
  assert.match(r.error, /missing its closing/)
  r = bad('COLOR #12345')
  assert.match(r.error, /isn't a colour/)
  r = bad('MOVE 1')
  assert.match(r.error, /MOVE takes 2 values, got 1/)
  r = bad('REPEAT 999999 { REPEAT 999999 { DOT } }')
  assert.match(r.error, /Stopped after|Too much painting/)
  r = bad('ANIMATE { wobble = 1 }')
  assert.match(r.error, /can't be animated/)
  r = bad('ANIMATE ghost { dx = 1 }')
  assert.match(r.error, /no layer called "ghost"/)
  r = bad('PAINT sin(')
  assert.equal(r.line, 1)
})
