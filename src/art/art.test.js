import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plot, line, rect, ellipse, floodFill, resize } from './paint.js'
import { artToGrid, gridToArt, emptyGrid } from './convert.js'
import { MOTIONS, MOTION_VARS } from '../animate/motions.js'
import { compile } from '../engine/expr.js'
import { EXPLORE_PRESETS, FIELD_VARS } from '../explore/fields.js'
import { run } from '../lang/draw.js'
import * as P from '../gallery/programs.js'

const count = (d) => d.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0)

test('pencil, brush size and mirror', () => {
  const d = new Int32Array(100).fill(-1)
  plot(d, 10, 10, 2, 2, 0xff0000)
  assert.equal(count(d), 1)
  plot(d, 10, 10, 5, 5, 0xff0000, 2)
  assert.equal(count(d), 5)
  const m = new Int32Array(100).fill(-1)
  plot(m, 10, 10, 1, 4, 1, 1, true)
  assert.equal(m[4 * 10 + 1], 1)
  assert.equal(m[4 * 10 + 8], 1)
})

test('line, rectangle and ellipse cells', () => {
  const pts = []
  line(0, 0, 4, 2, (x, y) => pts.push([x, y]))
  assert.deepEqual(pts[0], [0, 0]); assert.deepEqual(pts.at(-1), [4, 2]); assert.equal(pts.length, 5)
  let n = 0
  rect(0, 0, 3, 3, false, () => n++)
  assert.equal(n, 12)
  n = 0
  rect(0, 0, 3, 3, true, () => n++)
  assert.equal(n, 16)
  const outline = [], solid = []
  ellipse(0, 0, 10, 10, false, (x, y) => outline.push([x, y]))
  ellipse(0, 0, 10, 10, true, (x, y) => solid.push([x, y]))
  assert.ok(outline.length > 20 && solid.length > outline.length * 2)
})

test('flood fill stays inside a closed shape', () => {
  const w = 12, h = 12, d = new Int32Array(w * h).fill(-1)
  rect(2, 2, 9, 9, false, (x, y) => { d[y * w + x] = 7 })
  floodFill(d, w, h, 5, 5, 9)
  assert.equal(d.filter((v) => v === 9).length, 36)
  assert.equal(d[0], -1)
})

test('resize keeps the drawing centred; grid <-> art round trip', () => {
  const g = emptyGrid(4, 4)
  g.data[5] = 0x123456
  const big = resize(g, 8, 8)
  assert.equal(big.data[3 * 8 + 3], 0x123456)
  const back = artToGrid(gridToArt(big))
  assert.deepEqual(Array.from(back.data), Array.from(big.data))
})

test('every motion preset and explore formula compiles', () => {
  for (const m of MOTIONS) for (const [k, src] of Object.entries(m.formulas)) assert.ok(compile(src, MOTION_VARS).ok, `${m.key}.${k}`)
  for (const p of EXPLORE_PRESETS) assert.ok(compile(p.formula, FIELD_VARS).ok, p.key)
})

test('every gallery program runs', () => {
  for (const k of ['OCEAN', 'JELLYFISH', 'BLOOM', 'SPIRAL', 'BLOSSOM_CODE', 'HELLO']) {
    const r = run(P[k])
    assert.ok(r.ok, `${k}: line ${r.line} ${r.error}`)
    assert.ok(r.art.pixels.length > 50, k)
  }
})
