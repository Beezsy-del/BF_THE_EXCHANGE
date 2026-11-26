// Regression tests for the issues found in the external code review.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from './draw.js'
import { ArtRenderer } from './artRenderer.js'
import { compile, PER_PIXEL } from '../engine/expr.js'
import { FieldRenderer } from '../explore/fields.js'

const px = (src) => {
  const r = run(src)
  assert.ok(r.ok, `line ${r.line}: ${r.error}`)
  return r.art.pixels.map((p) => `${p.x},${p.y}`)
}

test('#3 functions with several arguments work inside commands', () => {
  assert.deepEqual(px('CANVAS 32 32\nMOVE max(10, 20) 5\nDOT'), ['20,5'])
  assert.deepEqual(px('CANVAS 32 32\nMOVE min(10, 20) pow(2, 3)\nDOT'), ['10,8'])
  assert.deepEqual(px('CANVAS 32 32\nMOVE clamp(40, 0, 7) mix(0, 10, 0.5)\nDOT'), ['7,5'])
  assert.deepEqual(px('CANVAS 32 32\nMOVE round(atan2(1, 1) * 10) 2 + step(0.5, 1)\nDOT'), ['8,3'])
  assert.deepEqual(px('CANVAS 32 32\nMOVE 3, 4\nDOT'), ['3,4']) // a comma outside brackets still separates values
  assert.deepEqual(px('CANVAS 32 32\nMOVE 2 + max(1, 2) * 3   4\nDOT'), ['8,4'])
  assert.equal(run('CANVAS 8 8\nCOLOR HSL mix(0, 240, 0.5) 100 50\nDOT').art.pixels[0].g, 255) // hue 120 = green
  assert.ok(run('CANVAS 32 32\nIF noise(1.5, 2.5) + 2 { DOT }').ok)
})

test('#4 a stray } is an error, not a silent stop', () => {
  const r = run('CANVAS 32 32\nDOT\n}\nCIRCLE 5')
  assert.equal(r.ok, false)
  assert.equal(r.line, 3)
  assert.match(r.error, /Unexpected "}"/)
})

test('#5 names that are also command words work', () => {
  assert.ok(run('CANVAS 32 32\nLAYER ring\nDOT\nANIMATE ring { dx = 1 }').ok)
  assert.deepEqual(px('CANVAS 32 32\nREPEAT 3 AS step { MOVE step * 5 1\nDOT }'), ['0,1', '5,1', '10,1'])
  assert.deepEqual(px('CANVAS 32 32\nREPEAT 3 AS line { MOVE line 2\nDOT }'), ['0,2', '1,2', '2,2'])
  assert.deepEqual(px('CANVAS 32 32\nREPEAT 2 AS dot { MOVE dot 3\nDOT }'), ['0,3', '1,3']) // DOT (command) vs dot (name)
})

test('#6 loop names that clash with maths names are refused', () => {
  for (const name of ['e', 'pi', 'tau', 'time', 't']) {
    const r = run(`CANVAS 32 32\nREPEAT 3 AS ${name} { DOT }`)
    assert.equal(r.ok, false, name)
    assert.match(r.error, /reserved/)
  }
})

test('#7 big circles are clipped to the canvas; the limit message is accurate', () => {
  assert.equal(run('CANVAS 32 32\nCIRCLE 900').art.pixels.length, 32 * 32)
  assert.equal(run('CANVAS 32 32\nRING 1000').ok, true)
  assert.match(run('CANVAS 32 32\nCIRCLE 1001').error, /radius is too large \(the limit is 1,000\)/)
  assert.equal(run('CANVAS 32 32\nMOVE -500 -500\nRECT 1000 1000').art.pixels.length, 32 * 32)
})

test('a first DOT lands at the centre of the canvas', () => {
  assert.deepEqual(px('CANVAS 32 32\nDOT'), ['16,16'])
  assert.deepEqual(px('CANVAS 32 32\nLAYER sky\nDOT'), ['16,16'])
})

test('#1 programs stop within the time budget', (t) => {
  let clock = 0
  t.mock.method(performance, 'now', () => (clock += 100))
  const heavy = 'CANVAS 320 180\nREPEAT 400 AS j { REPEAT 320 AS i { IF ' +
    Array(30).fill('noise(i * 0.1, j * 0.2)').join(' + ') + ' { DOT } } }'
  const r = run(heavy)
  assert.equal(r.ok, false)
  assert.match(r.error, /time|long|budget/i)
})

test('#1 per-pixel formulas have a small size budget', () => {
  const big = Array(60).fill('sin(x * 1.3 + t)').join(' + ') // ~420 tokens
  assert.equal(compile(big, ['x', 't']).ok, true) // fine as a one-off drawing argument
  assert.equal(compile(big, ['x', 't'], PER_PIXEL).ok, false) // too heavy to run on every pixel
  assert.equal(run(`CANVAS 8 8\nDOT\nANIMATE { dx = ${big} }`).ok, false)
})

function fakeCanvas() {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set globalCompositeOperation(v) {}, set lineWidth(v) {},
  }
  return { width: 0, height: 0, getContext: () => ctx }
}
const busy = (ms) => { const t = performance.now(); while (performance.now() - t < ms); }

test('#1 a motion too heavy to draw is paused within one frame, then the art stays responsive', () => {
  const r = new ArtRenderer(fakeCanvas())
  let notified = null
  r.onOverload = (v) => { notified = v }
  const art = run('CANVAS 64 64\nMOVE 0 0\nRECT 64 64').art
  art.animations = { '*': { dx: { fn: () => { busy(0.05); return 1 } } } } // 4,096 px × 0.05 ms ≈ 200+ ms
  r.setArt(art)
  const t = performance.now()
  r.frame(0, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  r.frame(0.1, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  r.frame(0.2, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  assert.equal(r.overloaded, true)
  assert.equal(notified, true)
  assert.ok(performance.now() - t < 1200, `three frames took ${performance.now() - t} ms`)
  const t2 = performance.now()
  r.frame(0.3, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  assert.ok(performance.now() - t2 < 50, 'paused frames must be cheap')
  // choosing new art / motion gives it a fresh chance
  r.setArt(run('CANVAS 8 8\nDOT').art)
  assert.equal(r.overloaded, false)
  assert.equal(notified, false)
})

test('#1 explore formulas too heavy to draw are paused', () => {
  const f = new FieldRenderer(fakeCanvas())
  f.configure({ kind: 'field', palette: 'marble', map: 'clamp' })
  const slow = () => { busy(0.02); return 0.5 } // 36,864 cells × 0.02 ms ≈ 740 ms unguarded
  const t = performance.now()
  f.frame(slow, 0, 1)
  assert.equal(f.overloaded, true)
  assert.ok(performance.now() - t < 600, `frame took ${performance.now() - t} ms`)
  f.resetGuard()
  assert.equal(f.overloaded, false)
})
