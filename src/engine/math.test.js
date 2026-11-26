// The maths behind MORPH, tested properly:
//  1. fuzz: thousands of random formulas, evaluated by MORPH and by an
//     independent reference, must agree; printing a formula and reading it
//     back must give the identical tree (so Blocks and Expression never drift)
//  2. every built-in function at known values
//  3. each way to animate behaves as described (home at strength 0,
//     rotation keeps distance, dissolve returns home, wraps stay in range)
//  4. drawing-language geometry and colour conversion
//  5. particle spring physics, easing and formula blending
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compile, parseExpr, toSource } from './expr.js'
import { ease, FormulaBlender } from './smooth.js'
import { MOTIONS, MOTION_VARS } from '../animate/motions.js'
import { EXPLORE_PRESETS, FIELD_VARS } from '../explore/fields.js'
import { run, hslToRgb } from '../lang/draw.js'
import { ArtRenderer } from '../lang/artRenderer.js'
import * as P from '../gallery/programs.js'

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

// ---------- 1. fuzz against an independent reference ----------

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

const FN1 = ['sin', 'cos', 'abs', 'sqrt', 'floor', 'fract', 'exp', 'sign']
const FN2 = ['min', 'max', 'pow', 'step', 'atan2']
const FN3 = ['clamp', 'mix', 'smoothstep']
const OPS = ['+', '-', '*', '/', '^', '%', '<', '>']

function randomTree(r, depth) {
  if (depth <= 0 || r() < 0.25) {
    const k = r()
    if (k < 0.4) return { type: 'num', value: Number((r() * 9).toFixed(r() < 0.5 ? 0 : 3)) }
    if (k < 0.95) return { type: 'var', name: ['x', 'y', 't'][Math.floor(r() * 3)] }
    return { type: 'const', name: 'pi' }
  }
  const k = r()
  if (k < 0.12) return { type: 'neg', arg: randomTree(r, depth - 1) }
  if (k < 0.55) return { type: 'op', op: OPS[Math.floor(r() * OPS.length)], args: [randomTree(r, depth - 1), randomTree(r, depth - 1)] }
  const pool = r() < 0.6 ? FN1 : r() < 0.6 ? FN2 : FN3
  const name = pool[Math.floor(r() * pool.length)]
  const n = FN1.includes(name) ? 1 : FN2.includes(name) ? 2 : 3
  return { type: 'call', name, args: Array.from({ length: n }, () => randomTree(r, depth - 1)) }
}

// reference evaluator written independently of the engine
const REF = {
  sin: Math.sin, cos: Math.cos, abs: Math.abs, sqrt: (v) => Math.sqrt(Math.max(0, v)), floor: Math.floor,
  fract: (v) => v - Math.floor(v), exp: Math.exp, sign: Math.sign, min: Math.min, max: Math.max, pow: Math.pow,
  step: (e, v) => (v < e ? 0 : 1), atan2: Math.atan2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  mix: (a, b, w) => a + (b - a) * w,
  smoothstep: (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a || 1e-9))); return k * k * (3 - 2 * k) },
}
function refEval(n, env) {
  switch (n.type) {
    case 'num': return n.value
    case 'var': return env[n.name]
    case 'const': return Math.PI
    case 'neg': return -refEval(n.arg, env)
    case 'call': return REF[n.name](...n.args.map((a) => refEval(a, env)))
    case 'op': {
      const a = refEval(n.args[0], env), b = refEval(n.args[1], env)
      return { '+': a + b, '-': a - b, '*': a * b, '/': a / b, '^': Math.pow(a, b), '%': b === 0 ? 0 : a - b * Math.floor(a / b), '<': a < b ? 1 : 0, '>': a > b ? 1 : 0 }[n.op]
    }
  }
}

test('fuzz: 3,000 random formulas — engine matches reference, text round-trips exactly', () => {
  const r = rng(20261126)
  let checked = 0
  for (let i = 0; i < 3000; i++) {
    const tree = randomTree(r, 5)
    const src = toSource(tree)
    const parsed = parseExpr(src, ['x', 'y', 't'])
    assert.ok(parsed.ok, `${src}: ${parsed.error}`)
    assert.deepEqual(parsed.ast, tree, `round trip changed the tree: ${src}`)
    const fn = compile(src, ['x', 'y', 't']).fn
    for (let j = 0; j < 4; j++) {
      const env = { x: r() * 20 - 10, y: r() * 20 - 10, t: r() * 50 }
      let want = refEval(tree, env)
      if (!Number.isFinite(want)) want = 0
      const got = fn(env)
      assert.ok(close(got, want, 1e-9) || (Math.abs(got) < 1e-12 && Math.abs(want) < 1e-12), `${src} at ${JSON.stringify(env)}: got ${got}, want ${want}`)
      checked++
    }
  }
  assert.equal(checked, 12000)
})

test('numbers survive Blocks ↔ Expression without losing precision', () => {
  for (const v of [0.00005, 1e-7, 123456.789, 0.1 + 0.2, 2.5e10, 1000000000001, 3]) {
    const src = toSource({ type: 'op', op: '*', args: [{ type: 'var', name: 'x' }, { type: 'num', value: v }] })
    assert.equal(compile(src, ['x']).fn({ x: 1 }), v, src)
  }
  // a negative number typed into a block must keep its meaning next to ^
  const neg = toSource({ type: 'op', op: '^', args: [{ type: 'num', value: -3 }, { type: 'num', value: 2 }] })
  assert.equal(compile(neg).fn({}), 9, neg)
  const neg2 = toSource({ type: 'op', op: '^', args: [{ type: 'num', value: 2 }, { type: 'num', value: -1 }] })
  assert.equal(compile(neg2).fn({}), 0.5, neg2)
})

// ---------- 2. functions at known values ----------

test('built-in functions at known values', () => {
  const e = (s, env = {}) => compile(s, ['x']).fn({ x: 0, ...env })
  assert.equal(e('sin(pi / 2)'), 1)
  assert.ok(close(e('cos(pi)'), -1))
  assert.equal(e('sqrt(-4)'), 0) // clamped, never NaN
  assert.equal(e('fract(-0.25)'), 0.75)
  assert.equal(e('-7 % 3'), 2) // unary minus binds tighter than %, like in maths: (-7) % 3
  assert.equal(e('(-7) % 3'), 2) // floored modulo, always in [0, 3)
  assert.equal(e('clamp(5, 0, 1)'), 1)
  assert.equal(e('mix(10, 20, 0.25)'), 12.5)
  assert.equal(e('smoothstep(0, 1, 0.5)'), 0.5)
  assert.equal(e('smoothstep(0, 1, -3)'), 0)
  assert.equal(e('step(1, 0.5)'), 0)
  assert.equal(e('log(0)'), Math.log(1e-9)) // guarded
  assert.equal(e('1 / 0'), 0) // non-finite results become 0
  assert.equal(e('2 ^ 10'), 1024)
  assert.equal(compile('time * 2', ['t']).fn({ t: 3 }), 6) // 'time' is an alias for t
})

test('hash is uniform-ish in [0,1) and noise is smooth in [-1,1]', () => {
  const hash = compile('hash(x)', ['x']).fn
  const noise = compile('noise(x, 0.37)', ['x']).fn
  let sum = 0, min = 1, max = 0
  for (let i = 0; i < 10000; i++) { const v = hash({ x: i }); sum += v; min = Math.min(min, v); max = Math.max(max, v) }
  assert.ok(min >= 0 && max < 1)
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02, `mean ${sum / 10000}`)
  let prev = noise({ x: 0 }), maxJump = 0, lo = 1, hi = -1
  for (let i = 1; i < 5000; i++) {
    const v = noise({ x: i * 0.01 })
    maxJump = Math.max(maxJump, Math.abs(v - prev))
    lo = Math.min(lo, v); hi = Math.max(hi, v)
    prev = v
  }
  assert.ok(lo >= -1 && hi <= 1, `range ${lo}..${hi}`)
  assert.ok(maxJump < 0.06, `noise jumped ${maxJump} over a tiny step — not smooth`)
  assert.equal(noise({ x: 2.5 }), noise({ x: 2.5 })) // deterministic
})

// ---------- 3. ways to animate ----------

const motionFns = (m) => Object.fromEntries(Object.entries(m.formulas).map(([k, s]) => [k, compile(s, MOTION_VARS).fn]))
function envFor(x, y, t, amp) {
  const W = 64, H = 64, cx = 32, cy = 32
  return { x, y, t, amp, W, H, cx, cy, r: Math.hypot(x - cx, y - cy), a: Math.atan2(y - cy, x - cx), seed: ((x * 7 + y * 13) % 97) / 97, mx: -1000, my: -1000 }
}

test('every motion leaves pixels at home when strength is 0', () => {
  for (const m of MOTIONS) {
    const f = motionFns(m)
    for (let i = 0; i < 50; i++) {
      const env = envFor((i * 7) % 64, (i * 13) % 64, i * 0.37, 0)
      if (f.dx) assert.ok(Math.abs(f.dx(env)) < 1e-9, `${m.key}.dx`)
      if (f.dy) assert.ok(Math.abs(f.dy(env)) < 1e-9, `${m.key}.dy`)
    }
  }
})

test('swirl is a true rotation: distance from the centre never changes', () => {
  const f = motionFns(MOTIONS.find((m) => m.key === 'swirl'))
  for (let i = 0; i < 200; i++) {
    const env = envFor((i * 7) % 64, (i * 11) % 64, i * 0.21, 1.7)
    const nx = env.x + f.dx(env), ny = env.y + f.dy(env)
    assert.ok(close(Math.hypot(nx - 32, ny - 32), env.r, 1e-9), `pixel ${env.x},${env.y}`)
  }
})

test('ripple pushes along the line from the centre (no sideways drift)', () => {
  const f = motionFns(MOTIONS.find((m) => m.key === 'ripple'))
  for (let i = 0; i < 200; i++) {
    const env = envFor((i * 5) % 64, (i * 9) % 64, i * 0.3, 1)
    const dx = f.dx(env), dy = f.dy(env)
    const cross = (env.x - 32) * dy - (env.y - 32) * dx
    assert.ok(Math.abs(cross) < 1e-9, `cross ${cross}`)
  }
})

test('breathe scales evenly about the centre', () => {
  const f = motionFns(MOTIONS.find((m) => m.key === 'breathe'))
  const t = 1.1
  const k = (env) => (env.x + f.dx(env) - 32) / (env.x - 32)
  const a = k(envFor(10, 20, t, 1)), b = k(envFor(50, 40, t, 1))
  assert.ok(close(a, b, 1e-12))
  assert.ok(close(a, 1 + 0.07 * Math.sin(1.2 * t), 1e-12))
})

test('dissolve flies out and comes back home', () => {
  const f = motionFns(MOTIONS.find((m) => m.key === 'dissolve'))
  const home = envFor(20, 30, (1.5 * Math.PI) / 0.7, 1) // sin(t*0.7) = -1 → resting
  assert.ok(Math.abs(f.dx(home)) < 1e-12 && Math.abs(f.dy(home)) < 1e-12)
  const out = envFor(20, 30, (0.5 * Math.PI) / 0.7, 1) // sin = 1 → fully dissolved
  assert.ok(Math.abs(f.dx(out)) + Math.abs(f.dy(out)) > 0.5)
  assert.ok(Math.abs(f.dx(out)) <= 32 && Math.abs(f.dy(out)) <= 32) // stays within ±W/2, ±H/2
})

test('looping motions in the gallery stay in range forever', () => {
  const clouds = compile('(x + t * 3 + 20) % (W + 40) - 20 - x', ['x', 't', 'W']).fn
  const petals = compile('(y + t * 5 + seed * 40) % 30 + 25 - y', ['y', 't', 'seed']).fn
  const plankton = compile('(y - t * 2 + seed * 80) % H - y + 0', ['y', 't', 'seed', 'H']).fn
  for (let t = 0; t < 2000; t += 3.7) {
    for (const x of [0, 50, 127]) { const nx = x + clouds({ x, t, W: 128 }); assert.ok(nx >= -20 && nx < 148, `cloud ${nx}`) }
    for (const y of [30, 54]) { const ny = y + petals({ y, t, seed: 0.6 }); assert.ok(ny >= 25 && ny < 55, `petal ${ny}`) }
    for (const y of [0, 79]) { const ny = y + plankton({ y, t, seed: 0.3, H: 80 }); assert.ok(ny >= 0 && ny < 80, `plankton ${ny}`) }
  }
})

test('explore formulas give finite values everywhere', () => {
  for (const p of EXPLORE_PRESETS) {
    const fn = compile(p.formula, FIELD_VARS).fn
    for (let i = 0; i < 400; i++) {
      const x = (i % 20) / 10 - 1, y = Math.floor(i / 20) / 10 - 1
      const v = fn({ x: x * 1.77, y, t: i * 0.13, r: Math.hypot(x, y), a: Math.atan2(y, x), amp: 1 })
      assert.ok(Number.isFinite(v), `${p.key} at ${x},${y}`)
    }
  }
})

// ---------- 4. geometry and colour ----------

test('drawing geometry: squares, circles, lines and a full turn', () => {
  const art = (src) => run(src).art
  assert.equal(art('CANVAS 64 64\nMOVE 10 10\nRECT 7 5').pixels.length, 35)
  const disc = art('CANVAS 64 64\nMOVE 32 32\nCIRCLE 10').pixels.length
  assert.ok(Math.abs(disc - Math.PI * 10.3 ** 2) / (Math.PI * 10.3 ** 2) < 0.05, `disc ${disc}`)
  const line = art('CANVAS 64 64\nMOVE 2 3\nLINE 40 20').pixels
  assert.ok(line.some((p) => p.x === 2 && p.y === 3) && line.some((p) => p.x === 40 && p.y === 20))
  assert.equal(line.length, 39) // one pixel per step along the longer axis
  // 360 one-pixel steps turning 1° each draw a closed circle-ish loop: start ≈ end
  const loop = run('CANVAS 180 180\nMOVE 90 30\nFACE 0\nREPEAT 360 { PAINT 1\nTURN 1 }\nDOT').art.pixels
  assert.ok(loop.length > 100)
  const sq = run('CANVAS 64 64\nMOVE 10 10\nREPEAT 4 { PAINT 10\nTURN RIGHT }').art.pixels
  assert.equal(sq.length, 40) // the square closes exactly, no float drift
})

test('HSL to RGB at known colours', () => {
  assert.deepEqual(hslToRgb(0, 100, 50), [255, 0, 0])
  assert.deepEqual(hslToRgb(120, 100, 50), [0, 255, 0])
  assert.deepEqual(hslToRgb(240, 100, 50), [0, 0, 255])
  assert.deepEqual(hslToRgb(360, 100, 50), [255, 0, 0])
  assert.deepEqual(hslToRgb(-120, 100, 50), [0, 0, 255])
  assert.deepEqual(hslToRgb(0, 0, 100), [255, 255, 255])
  assert.deepEqual(hslToRgb(60, 100, 50), [255, 255, 0])
})

// ---------- 5. physics, easing, blending ----------

function fakeCanvas() {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
    set fillStyle(v) {}, set globalCompositeOperation(v) {},
  }
  return { width: 0, height: 0, getContext: () => ctx }
}

test('pixel mode draws each pixel exactly at home when nothing moves', () => {
  const r = new ArtRenderer(fakeCanvas())
  const art = run('CANVAS 8 8\nBACKGROUND #000000\nCOLOR #ff8000\nMOVE 3 4\nDOT').art
  r.setArt(art)
  r.frame(0, 0, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  const d = r.img.data, i = (4 * 8 + 3) * 4
  assert.deepEqual([d[i], d[i + 1], d[i + 2]], [255, 128, 0])
  assert.deepEqual([d[0], d[1], d[2]], [0, 0, 0])
})

test('particle springs settle on their targets and the mouse pushes them away', () => {
  const r = new ArtRenderer(fakeCanvas())
  r.setArt(run('CANVAS 32 32\nMOVE 4 4\nRECT 6 6').art)
  r.setMode('particles')
  r.scatter(8)
  for (let i = 0; i < 400; i++) r.frame(i / 60, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  let worst = 0
  for (let i = 0; i < r.n; i++) worst = Math.max(worst, Math.hypot(r.px[i] - r.items[i].x, r.py[i] - r.items[i].y))
  assert.ok(worst < 0.01, `still ${worst} px away after settling`)
  // hold the mouse on one pixel: it moves away, then returns when the mouse leaves
  const k = r.items.findIndex((it) => it.x === 6 && it.y === 6)
  for (let i = 0; i < 60; i++) r.frame(i / 60, 1 / 60, { amp: 1, glow: 1, mx: 6.2, my: 6.1 })
  assert.ok(Math.hypot(r.px[k] - 6, r.py[k] - 6) > 0.3, 'mouse should push the particle away')
  for (let i = 0; i < 400; i++) r.frame(i / 60, 1 / 60, { amp: 1, glow: 1, mx: -1000, my: -1000 })
  assert.ok(Math.hypot(r.px[k] - 6, r.py[k] - 6) < 0.01, 'particle should come home')
})

test('easing reaches its target and is frame-rate independent', () => {
  let a = 0, b = 0
  for (let i = 0; i < 60; i++) a = ease(a, 1, 1 / 60, 0.5) // 60 fps for 1 s
  for (let i = 0; i < 30; i++) b = ease(b, 1, 1 / 30, 0.5) // 30 fps for 1 s
  assert.ok(close(a, b, 1e-12), `${a} vs ${b}`)
  assert.ok(close(a, 1 - Math.exp(-2), 1e-12))
})

test('formula blending starts at the old formula, ends at the new, never overshoots', () => {
  const bl = new FormulaBlender(1)
  bl.set({ dx: () => 0 })
  const out = bl.set({ dx: () => 10 })
  let prev = -1
  for (let i = 0; i <= 20; i++) {
    const v = out.dx({})
    assert.ok(v >= prev - 1e-12 && v >= 0 && v <= 10, `step ${i}: ${v}`)
    prev = v
    bl.tick(0.05)
  }
  assert.equal(out.dx({}), 10)
})

test('gallery programs draw the same picture every time (deterministic)', () => {
  for (const k of ['OCEAN', 'JELLYFISH', 'BLOOM', 'SPIRAL', 'BLOSSOM_CODE']) {
    const a = run(P[k]).art.pixels, b = run(P[k]).art.pixels
    assert.deepEqual(a, b, k)
  }
})
