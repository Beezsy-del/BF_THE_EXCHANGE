// Helpers that treat an expression's syntax tree as a visual workflow.
// A path is a list of child indexes from the root: [] = root, [0, 1] = root.args[0].args[1].

import { FUNCTION_ARITY } from '../engine/expr.js'

export const childrenOf = (n) => (n.type === 'op' || n.type === 'call' ? n.args : n.type === 'neg' ? [n.arg] : [])

export function getAt(node, path) {
  let cur = node
  for (const i of path) cur = childrenOf(cur)[i]
  return cur
}

export function replaceAt(node, path, repl) {
  if (!path.length) return repl
  const [i, ...rest] = path
  if (node.type === 'neg') return { ...node, arg: replaceAt(node.arg, rest, repl) }
  const args = node.args.slice()
  args[i] = replaceAt(args[i], rest, repl)
  return { ...node, args }
}

const num = (value) => ({ type: 'num', value })

// Wrap the node at `path` inside a new block. The old node becomes the first input.
export function wrapAt(root, path, block) {
  const target = getAt(root, path)
  let wrapped
  if (block.kind === 'op') {
    const other = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 2, '%': 1 }[block.op] ?? 1
    wrapped = { type: 'op', op: block.op, args: [target, num(other)] }
  } else if (block.kind === 'neg') {
    wrapped = { type: 'neg', arg: target }
  } else {
    const n = FUNCTION_ARITY[block.name]
    const args =
      n === 1 ? [target]
        : n === 2 ? [target, num(block.name === 'pow' ? 2 : 1)]
          : block.name === 'smoothstep' ? [num(0), num(1), target]
            : block.name === 'mix' ? [target, num(0), num(0.5)]
              : [target, num(0), num(1)]
    wrapped = { type: 'call', name: block.name, args }
  }
  return replaceAt(root, path, wrapped)
}

// Remove a block: keep its first input in its place (leaves become 0).
export function removeAt(root, path) {
  const target = getAt(root, path)
  const kids = childrenOf(target)
  const keep = kids.find((k) => k.type !== 'num') ?? kids[0] ?? num(0)
  return replaceAt(root, path, keep)
}

// ---------- layout: output on the right, inputs flowing in from the left ----------

export const NODE_W = 138
export const NODE_H = 54
const COL = 172
const ROW = 64

export function layout(root) {
  const nodes = []
  let leaf = 0
  let maxDepth = 0
  const visit = (n, path, depth) => {
    maxDepth = Math.max(maxDepth, depth)
    const kids = childrenOf(n)
    const entry = { node: n, path, depth, key: path.join('.') || 'root', children: [] }
    nodes.push(entry)
    if (!kids.length) {
      entry.row = leaf++
    } else {
      const rows = kids.map((k, i) => {
        const child = visit(k, [...path, i], depth + 1)
        entry.children.push(child)
        return child.row
      })
      entry.row = (rows[0] + rows[rows.length - 1]) / 2
    }
    return entry
  }
  const rootEntry = visit(root, [], 0)
  for (const e of nodes) {
    e.x = (maxDepth - e.depth) * COL
    e.y = e.row * ROW
  }
  const output = { x: (maxDepth + 1) * COL, y: rootEntry.y }
  return {
    nodes,
    root: rootEntry,
    output,
    width: output.x + NODE_W,
    height: Math.max(leaf, 1) * ROW - (ROW - NODE_H),
  }
}

// y offset of input port i on a node with n inputs
export const portY = (i, n) => (n <= 1 ? NODE_H / 2 : 16 + (i * (NODE_H - 26)) / (n - 1) + 2)
