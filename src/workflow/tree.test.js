import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseExpr, toSource } from '../engine/expr.js'
import { getAt, replaceAt, wrapAt, removeAt, layout } from './tree.js'

const V = ['x', 'y', 't', 'h', 'wind']
const ast = (s) => parseExpr(s, V).ast

test('workflow edits produce the matching expression', () => {
  const a = ast('sin(t) * 3')
  assert.equal(toSource(wrapAt(a, [0, 0], { kind: 'call', name: 'abs' })), 'sin(abs(t)) * 3')
  assert.equal(toSource(wrapAt(a, [0], { kind: 'op', op: '+' })), '(sin(t) + 1) * 3')
  assert.equal(toSource(wrapAt(a, [1], { kind: 'call', name: 'clamp' })), 'sin(t) * clamp(3, 0, 1)')
  assert.equal(toSource(replaceAt(a, [1], { type: 'num', value: 10 })), 'sin(t) * 10')
  assert.equal(toSource(replaceAt(a, [0, 0], { type: 'var', name: 'x' })), 'sin(x) * 3')
  assert.equal(toSource(removeAt(a, [0])), 't * 3')
  assert.equal(toSource(removeAt(a, [])), 'sin(t)')
  assert.equal(getAt(a, [0, 0]).name, 't')
})

test('layout puts the output to the right of every block', () => {
  const L = layout(ast('wind * 1.6 * sin(t * 1.3 + y * 0.12) * h'))
  assert.equal(L.nodes.length, 14)
  assert.ok(L.nodes.every((n) => n.x < L.output.x))
  for (const n of L.nodes) for (const c of n.children) assert.ok(c.x < n.x)
})
