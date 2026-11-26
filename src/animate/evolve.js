// Evolve: mathematical DNA. A motion's formulas are its genes; each variant
// nudges every constant a little (and sometimes swaps sin for cos), so the
// family resemblance stays while the behaviour changes.

import { parseExpr, toSource } from '../engine/expr.js'

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round3 = (v) => (v === 0 ? 0 : Number(v.toPrecision(3)))

function mutateNode(n, rand, strength) {
  switch (n.type) {
    case 'num': {
      if (n.value === 0) return n
      const k = 1 + (rand() * 2 - 1) * strength // ±strength, e.g. ±45%
      return { ...n, value: round3(n.value * k) }
    }
    case 'call': {
      let name = n.name
      if ((name === 'sin' || name === 'cos') && rand() < 0.15) name = name === 'sin' ? 'cos' : 'sin'
      return { ...n, name, args: n.args.map((a) => mutateNode(a, rand, strength)) }
    }
    case 'op': return { ...n, args: n.args.map((a) => mutateNode(a, rand, strength)) }
    case 'neg': return { ...n, arg: mutateNode(n.arg, rand, strength) }
    default: return n
  }
}

export function mutateFormula(src, vars, rand, strength = 0.45) {
  const p = parseExpr(src, vars)
  if (!p.ok) return src
  return toSource(mutateNode(p.ast, rand, strength))
}

// Four reproducible children of a set of formulas.
export function evolve(sources, vars, seed = Date.now()) {
  return [0, 1, 2, 3].map((i) => {
    const rand = rng(seed * 4 + i)
    const child = {}
    for (const [k, v] of Object.entries(sources)) child[k] = mutateFormula(v, vars, rand)
    return { seed: seed * 4 + i, sources: child }
  })
}
