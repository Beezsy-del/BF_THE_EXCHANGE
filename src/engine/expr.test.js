import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compile } from './expr.js'

const run = (src, env = {}, vars) => {
  const c = compile(src, vars)
  assert.ok(c.ok, c.error)
  return c.fn({ x: 0, y: 0, t: 0, ...env })
}

test('precedence and associativity', () => {
  assert.equal(run('1 + 2 * 3'), 7)
  assert.equal(run('(1 + 2) * 3'), 9)
  assert.equal(run('2 ^ 3 ^ 2'), 512)
  assert.equal(run('-2 ^ 2'), -4)
  assert.equal(run('10 - 4 - 3'), 3)
  assert.equal(run('-x * 2', { x: 3 }), -6)
})

test('variables, aliases, functions, constants', () => {
  assert.equal(run('x + y * t', { x: 1, y: 2, t: 3 }), 7)
  assert.equal(run('time * 2', { t: 4 }), 8)
  assert.equal(run('max(1, min(5, 3))'), 3)
  assert.ok(Math.abs(run('sin(pi / 2)') - 1) < 1e-12)
  assert.equal(run('clamp(9, 0, 4)'), 4)
})

test('non-finite results become 0', () => {
  assert.equal(run('1 / 0'), 0)
})

test('helpful errors', () => {
  const bad = (src) => compile(src, ['x', 'y', 't'])
  assert.match(bad('sin(x').error, /"\)"/)
  assert.match(bad('foo(x)').error, /Unknown function "foo"/)
  assert.match(bad('z + 1').error, /Unknown variable "z"/)
  assert.match(bad('2 x').error, /missing an operator/)
  assert.match(bad('max(1)').error, /takes 2 arguments/)
  assert.match(bad('').error, /empty/)
  assert.equal(bad('x + $').pos, 4)
})

test('comparisons give 1 or 0 and bind loosest', () => {
  assert.equal(run('1 + 1 < 3'), 1)
  assert.equal(run('x * x + y * y <= 25', { x: 3, y: 4 }), 1)
  assert.equal(run('(2 > 3) * 10'), 0)
  assert.equal(run('2 >= 2'), 1)
})

test('syntax tree round-trips through toSource', async () => {
  const { parseExpr, toSource } = await import('./expr.js')
  const cases = [
    'wind * 1.6 * sin(t * 1.3 + y * 0.12) * h',
    '0.2 + 0.1 * hash(seed) + 0.06 * cos(t * 2.4 + seed)',
    'sin(d * 0.7 - t * 2.4) * (0.4 + d * 0.05) * (0.5 + wind)',
    '(1 + 2) * 3', '10 - (4 - 3)', '2 ^ 3 ^ 2', '(2 ^ 3) ^ 2', '-x ^ 2', '-(x + 1)', '8 / (2 * 2)', 'x < 3 + 1',
  ]
  const vars = ['x', 'y', 't', 'h', 'seed', 'wind', 'd']
  for (const src of cases) {
    const a = parseExpr(src, vars)
    assert.ok(a.ok, src)
    const out = toSource(a.ast)
    const b = parseExpr(out, vars)
    assert.deepEqual(b.ast, a.ast, `${src} -> ${out}`)
  }
  assert.equal(toSource(parseExpr('wind * 1.6 * sin(t * 1.3 + y * 0.12) * h', vars).ast), 'wind * 1.6 * sin(t * 1.3 + y * 0.12) * h')
  assert.equal(toSource(parseExpr('((x))+((1))', vars).ast), 'x + 1')
})
