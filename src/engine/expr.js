// MORPH expression engine: a small, safe math language.
// Parses once into closures; never evaluates user JavaScript.
//
//   compile('4 * sin(y * 0.2 + t)', ['x', 'y', 't'])
//     -> { ok: true, fn: (env) => number }
//     -> { ok: false, error: 'message', pos: 12 }

const FUNCS = {
  sin: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  abs: [1, Math.abs],
  sqrt: [1, (v) => Math.sqrt(Math.max(0, v))],
  floor: [1, Math.floor],
  ceil: [1, Math.ceil],
  round: [1, Math.round],
  fract: [1, (v) => v - Math.floor(v)],
  sign: [1, Math.sign],
  exp: [1, Math.exp],
  log: [1, (v) => Math.log(Math.max(1e-9, v))],
  min: [2, Math.min],
  max: [2, Math.max],
  pow: [2, Math.pow],
  atan2: [2, Math.atan2],
  step: [2, (e, v) => (v < e ? 0 : 1)],
  clamp: [3, (v, a, b) => Math.min(b, Math.max(a, v))],
  mix: [3, (a, b, w) => a + (b - a) * w],
  smoothstep: [3, (a, b, v) => {
    const k = Math.min(1, Math.max(0, (v - a) / (b - a || 1e-9)))
    return k * k * (3 - 2 * k)
  }],
  // Deterministic pseudo-random in [0,1) from a number.
  hash: [1, (v) => {
    const s = Math.sin(v * 127.1 + 311.7) * 43758.5453
    return s - Math.floor(s)
  }],
  // Smooth organic value noise in [-1, 1] — clouds, marble, water.
  noise: [2, noise2],
}

function lattice(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = lattice(xi, yi), b = lattice(xi + 1, yi)
  const c = lattice(xi, yi + 1), d = lattice(xi + 1, yi + 1)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

const CONSTS = { pi: Math.PI, tau: Math.PI * 2, e: Math.E }
const ALIASES = { time: 't' }

export const FUNCTION_NAMES = Object.keys(FUNCS)

// Hard limits keep any formula — typed, pasted or loaded from a file — cheap
// to parse and evaluate, and out of reach of stack overflows.
export const MAX_EXPR_LENGTH = 4000
const MAX_TOKENS = 1200
const MAX_DEPTH = 64
// Formulas that run once per pixel per frame (motions, fields, scene behaviours,
// ANIMATE blocks) get a much smaller budget, so one formula can never make a
// frame take seconds.
export const PER_PIXEL = { maxTokens: 240 }

// Own-property lookups only, so names like "constructor" or "__proto__"
// can never reach Object.prototype.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

function tokenize(src, maxTokens = MAX_TOKENS) {
  const tokens = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i))
      if (!m) throw err(`Unexpected "${c}"`, i)
      tokens.push({ type: 'num', value: parseFloat(m[0]), pos: i })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))
      tokens.push({ type: 'id', value: m[0], pos: i })
      i += m[0].length
      continue
    }
    if ((c === '<' || c === '>') && src[i + 1] === '=') {
      tokens.push({ type: c + '=', pos: i })
      i += 2
      continue
    }
    if ('+-*/%^(),<>'.includes(c)) {
      tokens.push({ type: c, pos: i })
      i++
      continue
    }
    throw err(`Unexpected character "${c}"`, i)
  }
  if (tokens.length > maxTokens) throw err(`Formula is too long (over ${maxTokens} parts)`, 0)
  tokens.push({ type: 'end', pos: src.length })
  return tokens
}

function err(message, pos) {
  const e = new Error(message)
  e.pos = pos
  return e
}

// Comparisons return 1 or 0, handy for masks: (x*x + y*y < 100) * 4
const BINARY = {
  '<': [1, (a, b) => (a < b ? 1 : 0)],
  '>': [1, (a, b) => (a > b ? 1 : 0)],
  '<=': [1, (a, b) => (a <= b ? 1 : 0)],
  '>=': [1, (a, b) => (a >= b ? 1 : 0)],
  '+': [2, (a, b) => a + b],
  '-': [2, (a, b) => a - b],
  '*': [3, (a, b) => a * b],
  '/': [3, (a, b) => a / b],
  '%': [3, (a, b) => a - b * Math.floor(a / b)],
  '^': [5, Math.pow], // right-associative
}

// ---------- parser: tokens -> syntax tree ----------
// Nodes: {type:'num', value} | {type:'var', name} | {type:'const', name}
//        {type:'neg', arg} | {type:'op', op, args:[a,b]} | {type:'call', name, args}

function parse(tokens, allowed) {
  let p = 0
  const peek = () => tokens[p]
  const next = () => tokens[p++]

  function expect(type, what) {
    const tk = next()
    if (tk.type !== type) {
      throw err(tk.type === 'end' ? `Expected ${what} but the expression ended` : `Expected ${what}`, tk.pos)
    }
    return tk
  }

  function primary() {
    const tk = next()
    if (tk.type === 'num') return { type: 'num', value: tk.value }
    if (tk.type === '(') {
      const inner = expr(0)
      expect(')', '")"')
      return inner
    }
    if (tk.type === '-') return { type: 'neg', arg: unaryOperand() }
    if (tk.type === '+') return unaryOperand()
    if (tk.type === 'id') {
      const name = own(ALIASES, tk.value) ? ALIASES[tk.value] : tk.value
      if (peek().type === '(') {
        const f = own(FUNCS, name) ? FUNCS[name] : null
        if (!f) throw err(`Unknown function "${tk.value}"`, tk.pos)
        next()
        const args = []
        if (peek().type !== ')') {
          args.push(expr(0))
          while (peek().type === ',') { next(); args.push(expr(0)) }
        }
        expect(')', '")"')
        if (args.length !== f[0]) {
          throw err(`${tk.value}() takes ${f[0]} argument${f[0] > 1 ? 's' : ''}, got ${args.length}`, tk.pos)
        }
        return { type: 'call', name, args }
      }
      if (own(CONSTS, name)) return { type: 'const', name }
      if (!allowed.includes(name)) {
        const hint = own(FUNCS, name) ? ` (did you mean ${name}(...)?)` : ` — available: ${allowed.join(', ')}`
        throw err(`Unknown variable "${tk.value}"${hint}`, tk.pos)
      }
      return { type: 'var', name }
    }
    if (tk.type === 'end') throw err('Expression ended too early', tk.pos)
    throw err(`Unexpected "${tk.type}"`, tk.pos)
  }

  // Unary minus binds tighter than * but looser than ^, so -x^2 = -(x^2).
  function unaryOperand() { return expr(4) }

  let depth = 0
  function expr(minPrec) {
    if (++depth > MAX_DEPTH) throw err(`Formula is nested too deeply (over ${MAX_DEPTH} levels)`, peek().pos)
    let left = primary()
    for (;;) {
      const tk = peek()
      const op = own(BINARY, tk.type) ? BINARY[tk.type] : null
      if (!op || op[0] < minPrec) break
      next()
      const right = expr(tk.type === '^' ? op[0] : op[0] + 1)
      left = { type: 'op', op: tk.type, args: [left, right] }
    }
    depth--
    return left
  }

  const root = expr(0)
  const tail = peek()
  if (tail.type !== 'end') throw err(`Unexpected "${tail.value ?? tail.type}" — missing an operator?`, tail.pos)
  return root
}

// ---------- tree -> closure ----------

function build(node) {
  switch (node.type) {
    case 'num': { const v = node.value; return () => v }
    case 'const': { const v = CONSTS[node.name]; return () => v }
    case 'var': { const n = node.name; return (env) => env[n] }
    case 'neg': { const a = build(node.arg); return (env) => -a(env) }
    case 'op': {
      const f = BINARY[node.op][1], l = build(node.args[0]), r = build(node.args[1])
      return (env) => f(l(env), r(env))
    }
    case 'call': {
      const impl = FUNCS[node.name][1]
      const args = node.args.map(build)
      if (args.length === 1) { const [a] = args; return (env) => impl(a(env)) }
      if (args.length === 2) { const [a, b] = args; return (env) => impl(a(env), b(env)) }
      const [a, b, c] = args
      return (env) => impl(a(env), b(env), c(env))
    }
    default: throw new Error(`bad node ${node.type}`)
  }
}

// Non-finite results become 0 so one bad pixel never breaks a frame.
export function compileAst(ast) {
  const root = build(ast)
  return (env) => {
    const v = root(env)
    return Number.isFinite(v) ? v : 0
  }
}

function collectVars(node, out = new Set()) {
  if (node.type === 'var') out.add(node.name)
  for (const c of node.args ?? (node.arg ? [node.arg] : [])) collectVars(c, out)
  return out
}

export function parseExpr(src, allowed = ["x", "y", "t"], { maxTokens = MAX_TOKENS } = {}) {
  const text = String(src ?? '').trim()
  if (!text) return { ok: false, error: 'Expression is empty', pos: 0 }
  if (text.length > MAX_EXPR_LENGTH) return { ok: false, error: `Formula is too long (over ${MAX_EXPR_LENGTH} characters)`, pos: MAX_EXPR_LENGTH }
  try {
    return { ok: true, ast: parse(tokenize(text, maxTokens), allowed) }
  } catch (e) {
    return { ok: false, error: e instanceof RangeError ? 'Formula is too complex' : e.message, pos: e.pos ?? 0 }
  }
}

export function compile(src, allowed = ["x", "y", "t"], opts = {}) {
  const res = parseExpr(src, allowed, opts)
  if (!res.ok) return res
  try {
    return { ok: true, fn: compileAst(res.ast), ast: res.ast, used: [...collectVars(res.ast)] }
  } catch {
    return { ok: false, error: 'Formula is too complex', pos: 0 }
  }
}

// ---------- tree -> text (minimal parentheses) ----------

const PREC = { num: 6, var: 6, const: 6, call: 6, neg: 4 }
// A negative number literal (typed into a block) behaves like unary minus:
// it binds looser than ^, so it needs brackets on the left of a power.
const precOf = (n) => (n.type === 'op' ? BINARY[n.op][0] : n.type === 'num' && (n.value < 0 || Object.is(n.value, -0)) ? 4 : PREC[n.type])

// Short form for showing a number on a block.
export function formatNumber(v) {
  if (Number.isInteger(v)) return String(v)
  return String(Number(v.toPrecision(6)))
}

// Exact form for writing a formula back to text: 12 significant digits keeps
// every value a person can type, and cleans float noise like 0.30000000000000004.
function numberSource(v) {
  return String(Number(v.toPrecision(12)))
}

// Prints the tree with the fewest brackets that still read back as the SAME
// tree, so switching between Blocks and Expression never rearranges anything.
export function toSource(node) {
  switch (node.type) {
    case 'num': return numberSource(node.value)
    case 'var':
    case 'const': return node.name
    case 'call': return `${node.name}(${node.args.map(toSource).join(', ')})`
    case 'neg': {
      const inner = toSource(node.arg)
      return precOf(node.arg) < 4 || node.arg.type === 'neg' || inner.startsWith('-') ? `-(${inner})` : `-${inner}`
    }
    case 'op': {
      const p = BINARY[node.op][0]
      const [a, b] = node.args
      const rightAssoc = node.op === '^'
      let ls = toSource(a), rs = toSource(b)
      if (precOf(a) < p || (rightAssoc && precOf(a) <= p)) ls = `(${ls})`
      if (precOf(b) < p || (precOf(b) === p && !rightAssoc)) rs = `(${rs})`
      return `${ls} ${node.op} ${rs}`
    }
    default: return '?'
  }
}

export const FUNCTION_ARITY = Object.fromEntries(Object.entries(FUNCS).map(([k, v]) => [k, v[0]]))
export const BINARY_OPS = Object.keys(BINARY)
