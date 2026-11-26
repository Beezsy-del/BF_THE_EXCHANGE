// Regression tests for the hardening pass: nothing typed, pasted, saved or
// opened from a file may hang the page, crash it, or reach Object.prototype.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compile } from '../engine/expr.js'
import { run } from '../lang/draw.js'
import { parseProjectFile, cleanSaved } from './project.js'
import { mutateFormula } from '../animate/evolve.js'

const fast = (fn, ms = 1500) => {
  const t = Date.now()
  const r = fn()
  assert.ok(Date.now() - t < ms, `took ${Date.now() - t} ms`)
  return r
}

test('formula engine: size, depth and prototype names are refused safely', () => {
  assert.equal(fast(() => compile('1+'.repeat(200000) + '1')).ok, false)
  assert.equal(fast(() => compile('('.repeat(3000) + '1' + ')'.repeat(3000))).ok, false)
  assert.equal(compile('('.repeat(80) + '1' + ')'.repeat(80)).ok, false)
  assert.equal(compile(Array(1500).fill('x').join('+'), ['x']).ok, false)
  for (const name of ['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty']) {
    assert.equal(compile(name, ['x']).ok, false, name)
    assert.equal(compile(`${name}(1)`, ['x']).ok, false, `${name}()`)
  }
  assert.equal(compile('pi').fn({}), Math.PI)
})

test('drawing language: programs that would hang now stop quickly', () => {
  for (const src of [
    'REPEAT 1e12 { }', 'STEP 1e12', 'PAINT 1e9', 'RING 1e6', 'CIRCLE 5000',
    'MOVE -1e9 -1e9\nRECT 1e5 1e5', 'MOVE 0 0\nLINE 1e12 1e12',
    'IF 1 {'.repeat(5000) + 'DOT' + '}'.repeat(5000),
    'REPEAT 1000 { REPEAT 1000 { REPEAT 1000 { } } }',
    'REPEAT 4000 { CIRCLE 999 }',
    'x'.repeat(60000),
  ]) {
    const r = fast(() => run(src), 2500)
    assert.equal(r.ok, false, src.slice(0, 40))
  }
})

test('drawing language: hostile names are rejected', () => {
  assert.equal(run('REPEAT 2 AS __proto__ { DOT }').ok, false)
  assert.equal(run('LAYER __proto__').ok, false)
  assert.equal(run('ANIMATE __proto__ { dx = 1 }').ok, false)
  assert.equal(run('ANIMATE constructor { dx = 1 }').ok, false)
  assert.equal(({}).polluted, undefined)
})

test('project files: only the exact expected shape is accepted', () => {
  const ok = (o) => parseProjectFile(JSON.stringify(o))
  assert.equal(parseProjectFile('{nope').ok, false)
  assert.equal(parseProjectFile('x'.repeat(3 * 1024 * 1024)).ok, false)
  assert.equal(ok({ format: 'other', version: 1 }).ok, false)
  assert.equal(ok({ format: 'morph-project', version: 1, artwork: { origin: 'paint', grid: { w: 1e6, h: 1e6, bg: [0, 0, 0], data: [] } } }).ok, false)
  assert.equal(ok({ format: 'morph-project', version: 1, artwork: { origin: 'paint', grid: { w: 4, h: 4, bg: [0, 0, 0], data: Array(16).fill('<script>') } } }).ok, false)
  assert.equal(ok({ format: 'morph-project', version: 1, artwork: { origin: 'eval', code: 'x' } }).ok, false)
  const p = parseProjectFile('{"format":"morph-project","version":1,"__proto__":{"polluted":1},"artwork":{"origin":"code","code":"DOT","name":"n"},"motion":{"key":"__proto__","mode":"<b>","custom":{"dx":"1","evil":"2"}}}')
  assert.equal(p.ok, true)
  assert.deepEqual(p.motion, { key: 'breeze', mode: 'pixels', custom: { dx: '1' } })
  assert.equal(({}).polluted, undefined)
  const good = ok({ format: 'morph-project', version: 1, artwork: { origin: 'paint', name: 'g', grid: { w: 4, h: 4, bg: [1, 2, 3], data: Array(16).fill(-1) } } })
  assert.equal(good.ok, true)
  assert.ok(good.artwork.grid.data instanceof Int32Array)
})

test('saved browser state: damaged values fall back to safe defaults', () => {
  const s = cleanSaved({ view: 'javascript:alert(1)', artwork: { origin: 'paint', grid: 'x' }, motion: { key: { a: 1 } }, explore: { preset: '__proto__', palette: 'constructor', formula: '('.repeat(9000) } })
  assert.equal(s.view, 'home')
  assert.equal(s.artwork, null)
  assert.equal(s.motion.key, 'breeze')
  assert.deepEqual(s.explore, { preset: 'marble' })
  assert.deepEqual(cleanSaved(null), {})
  assert.deepEqual(cleanSaved('string'), {})
})

test('evolve keeps formulas valid and nearby', () => {
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const vars = ['x', 'y', 't', 'amp', 'W', 'H']
  for (let i = 0; i < 50; i++) {
    const out = mutateFormula('amp * 2 * sin(t * 1.2 + y * 0.15) * (1 - y / H)', vars, rand)
    assert.ok(compile(out, vars).ok, out)
  }
})
