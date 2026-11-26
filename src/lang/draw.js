// MORPH drawing language: the "Pixels on Command" half of MORPH.
// Commands decide WHAT exists (source pixels); ANIMATE blocks decide HOW it behaves.
//
//   CANVAS 96 64
//   COLOR #ff77aa
//   MOVE 40 40
//   REPEAT 4 { PAINT 20  TURN RIGHT }
//   ANIMATE { dy = 2 * sin(x * 0.2 + t) }
//
// run(source) -> { ok, art, error? }   art = { width, height, background, pixels, layers, animations }

import { compile, PER_PIXEL } from "../engine/expr.js"

export const MAX_W = 320
export const MAX_H = 180
const MAX_OPS = 400000
const MAX_PIXELS_TOUCHED = 2000000

export const COMMANDS = [
  'CANVAS', 'BACKGROUND', 'COLOR', 'LAYER', 'MOVE', 'FACE', 'TURN', 'PAINT', 'STEP',
  'DOT', 'LINE', 'RECT', 'CIRCLE', 'RING', 'REPEAT', 'IF', 'ANIMATE',
]
export const ANIM_PROPS = ['dx', 'dy', 'hue', 'bright']
export const ANIM_VARS = ['x', 'y', 't', 'seed', 'cx', 'cy', 'r', 'a', 'mx', 'my', 'amp', 'W', 'H']

class LangError extends Error {
  constructor(message, line) { super(message); this.line = line }
}

// ---------- parsing ----------

function stripComment(line) {
  const i = line.indexOf('//')
  return i >= 0 ? line.slice(0, i) : line
}

// Split source into {text, line} pieces, giving braces their own pieces.
function pieces(src) {
  const out = []
  src.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1
    let buf = ''
    for (const ch of stripComment(raw)) {
      if (ch === '{' || ch === '}') {
        if (buf.trim()) out.push({ text: buf.trim(), line })
        out.push({ text: ch, line })
        buf = ''
      } else buf += ch
    }
    if (buf.trim()) out.push({ text: buf.trim(), line })
  })
  return out
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

function suggest(word) {
  let best = null, bestD = 3
  for (const c of COMMANDS) {
    const dist = editDistance(word, c)
    if (dist < bestD) { best = c; bestD = dist }
  }
  return best
}

// A single line may hold several commands ("PAINT 20  TURN RIGHT"):
// split wherever a known command word starts — but never inside brackets,
// right after LAYER / AS / ANIMATE (that word is a name), or when the word is
// a name the program declared earlier (REPEAT 4 AS step … MOVE step 1).
const NAME_SLOTS = new Set(['LAYER', 'AS', 'ANIMATE'])
function splitCommands(piece, names) {
  const words = piece.text.split(/\s+/)
  const stmts = []
  let cur = null
  let depth = 0
  let prevUp = ''
  for (const w of words) {
    const up = w.toUpperCase()
    const isName = NAME_SLOTS.has(prevUp) || names.has(w)
    if (NAME_SLOTS.has(prevUp)) names.add(w)
    const isCommand = depth === 0 && !isName && COMMANDS.includes(up)
    for (const ch of w) depth = Math.max(0, depth + (ch === '(' ? 1 : ch === ')' ? -1 : 0))
    prevUp = up
    if (isCommand) {
      cur = { cmd: up, args: [], line: piece.line }
      stmts.push(cur)
    } else {
      if (!cur) {
        const near = suggest(up)
        throw new LangError(
          near ? `Unknown command "${w}" — did you mean ${near}?` : `Unknown command "${w}". Commands: ${COMMANDS.join(', ')}`,
          piece.line,
        )
      }
      cur.args.push(w)
    }
  }
  return stmts
}

function parseBlock(ps, i, closeLine, depth = 0, names = new Set()) {
  if (depth > MAX_NESTING) throw new LangError(`Blocks are nested too deeply (the limit is ${MAX_NESTING})`, closeLine ?? 0)
  const stmts = []
  while (i < ps.length) {
    const p = ps[i]
    if (p.text === '}') {
      // a "}" at the top level has nothing to close — say so instead of silently stopping
      if (closeLine === undefined) throw new LangError('Unexpected "}" — there is no block here to close', p.line)
      return [stmts, i + 1]
    }
    if (p.text === '{') throw new LangError('Unexpected "{" — blocks follow REPEAT, IF or ANIMATE', p.line)
    const cmds = splitCommands(p, names)
    i++
    for (const s of cmds) stmts.push(s)
    const last = cmds[cmds.length - 1]
    if (['REPEAT', 'IF', 'ANIMATE'].includes(last.cmd)) {
      if (ps[i]?.text !== '{') throw new LangError(`${last.cmd} needs a "{ ... }" block`, last.line)
      if (last.cmd === 'ANIMATE') {
        // collect raw assignment lines until the matching "}"
        const body = []
        i++
        while (i < ps.length && ps[i].text !== '}') { body.push(ps[i]); i++ }
        if (i >= ps.length) throw new LangError('ANIMATE block is missing its closing "}"', last.line)
        last.body = body
        i++
      } else {
        const [inner, ni] = parseBlock(ps, i + 1, last.line, depth + 1, names)
        last.block = inner
        i = ni
      }
    }
  }
  if (closeLine !== undefined) throw new LangError('Block is missing its closing "}"', closeLine)
  return [stmts, i]
}

// Join argument words into expressions:
//   "32 + 10*cos(i) 20"   -> ["32+10*cos(i)", "20"]
//   "max(10, 20) 5"       -> ["max(10, 20)", "5"]   (commas inside brackets belong to the call)
//   "3, 4"                -> ["3", "4"]             (a comma outside brackets separates values)
const OPS = '+-*/^%<>='
function joinArgs(words) {
  const text = words.join(' ')
  // 1. cut at spaces and commas that are outside brackets; keep everything inside brackets
  const chunks = []
  let cur = '', depth = 0, afterComma = false
  const cut = () => {
    if (cur) { chunks.push({ text: cur, afterComma }); afterComma = false }
    cur = ''
  }
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && /\s/.test(ch)) { cut(); continue }
    if (depth === 0 && ch === ',') { cut(); afterComma = true; continue }
    cur += ch
  }
  cut()
  // 2. glue chunks joined by an operator ("32", "+", "10*cos(i)") into one value
  const args = []
  for (const c of chunks) {
    const prev = args[args.length - 1]
    const glue = prev !== undefined && !c.afterComma &&
      (OPS.includes(prev.slice(-1)) || (OPS.includes(c.text[0]) && (c.text.length === 1 || c.text[0] !== '-')))
    if (glue) args[args.length - 1] += c.text
    else args.push(c.text)
  }
  return args
}

// ---------- colours ----------

function hexToRgb(hex, line) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new LangError(`"${hex}" isn't a colour — use #RRGGBB or #RGB`, line)
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  s = Math.min(1, Math.max(0, s / 100))
  l = Math.min(1, Math.max(0, l / 100))
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    t = (t + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

// ---------- execution ----------

export const MAX_SOURCE_LENGTH = 50000
const MAX_DISTANCE = 4000 // longest single PAINT / STEP / LINE
const MAX_SHAPE = 1000 // largest RECT side or CIRCLE / RING radius
const MAX_WORK = 4000000 // total cells any program may visit
const MAX_NESTING = 48
// Any program stops after half a second, so typing can never lock the page —
// even a short program full of heavy maths.
const MAX_RUN_MS = 500
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
// Loop names that would clash with names the maths already knows.
const RESERVED_NAMES = ['x', 'y', 'W', 'H', 'cx', 'cy', 't', 'time', 'pi', 'tau', 'e']

export function run(source) {
  const src = String(source ?? '')
  if (src.length > MAX_SOURCE_LENGTH) return { ok: false, error: `Program is too long (over ${MAX_SOURCE_LENGTH.toLocaleString()} characters)`, line: 0 }
  try {
    return { ok: true, art: execute(src) }
  } catch (e) {
    if (e instanceof LangError) return { ok: false, error: e.message, line: e.line }
    if (e instanceof RangeError) return { ok: false, error: 'Program is nested too deeply', line: 0 }
    return { ok: false, error: String(e.message ?? e), line: 0 }
  }
}

function execute(source) {
  const [program] = parseBlock(pieces(source), 0)
  const st = {
    w: 96, h: 64, bg: [11, 12, 30], sized: false,
    x: 0, y: 0, heading: 0, color: [255, 168, 195], layer: 'main',
    grid: null, layerOf: null, ops: 0, touched: 0,
    animations: {}, layerNames: ['main'],
  }
  const cache = new Map()

  const evalArg = (text, scope, line) => {
    const names = Object.keys(scope)
    const key = names.join(',') + '|' + text
    let c = cache.get(key)
    if (!c) {
      c = compile(text, names)
      cache.set(key, c)
    }
    if (!c.ok) throw new LangError(`In "${text}": ${c.error}`, line)
    return c.fn(scope)
  }
  const nums = (s, scope, min, max) => {
    // a statement always sees the same loop variables, so its parsed
    // arguments can be cached on the statement itself
    if (!s._args) s._args = joinArgs(s.args)
    const args = s._args
    if (args.length < min || args.length > max) {
      const want = min === max ? `${min}` : `${min}–${max}`
      throw new LangError(`${s.cmd} takes ${want} value${max > 1 ? 's' : ''}, got ${args.length}`, s.line)
    }
    if (!s._fns) s._fns = args.map((a) => { evalArg(a, scope, s.line); return cache.get(Object.keys(scope).join(',') + '|' + a).fn })
    return s._fns.map((f) => f(scope))
  }

  const ensureGrid = () => {
    if (!st.grid) {
      st.grid = new Int32Array(st.w * st.h).fill(-1)
      st.layerOf = new Uint8Array(st.w * st.h)
      st.x = Math.floor(st.w / 2); st.y = Math.floor(st.h / 2)
    }
  }
  const plot = (x, y, line) => {
    ensureGrid()
    if (++st.touched > MAX_PIXELS_TOUCHED) throw new LangError('Too much painting — the program was stopped to keep things fast', line)
    const xi = Math.round(x), yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= st.w || yi >= st.h) return
    const [r, g, b] = st.color
    st.grid[yi * st.w + xi] = (r << 16) | (g << 8) | b
    st.layerOf[yi * st.w + xi] = st.layerNames.indexOf(st.layer)
  }
  // Every loop that visits cells pays for them up front, so no single command
  // (even one that paints nothing, like STEP or an off-canvas RING) can hang the page.
  let work = 0
  const started = now()
  const overTime = (line) => {
    if (now() - started > MAX_RUN_MS) throw new LangError(`The program took longer than ${MAX_RUN_MS} ms and was stopped — try fewer repeats or simpler maths`, line)
  }
  const charge = (cells, line) => {
    work += cells
    if (work > MAX_WORK) throw new LangError('Too much work — the program was stopped to keep things fast', line)
    if (cells > 2048) overTime(line)
  }
  // one statement or loop pass; every 1,024 steps also checks the clock
  const step = (line) => {
    if (++st.ops > MAX_OPS) throw new LangError(`Stopped after ${MAX_OPS.toLocaleString()} steps — is a REPEAT too large?`, line)
    if ((st.ops & 1023) === 0) overTime(line)
  }
  const limit = (v, max, what, line) => {
    if (Math.abs(v) > max) throw new LangError(`${what} is too large (the limit is ${max.toLocaleString()})`, line)
  }

  const forward = (n, paint, line) => {
    const rad = (st.heading * Math.PI) / 180
    const dx = Math.cos(rad), dy = Math.sin(rad)
    limit(n, MAX_DISTANCE, paint ? 'PAINT distance' : 'STEP distance', line)
    const steps = Math.round(Math.abs(n))
    charge(steps, line)
    const sgn = Math.sign(n)
    for (let k = 0; k < steps; k++) {
      if (paint) plot(st.x, st.y, line)
      st.x += dx * sgn; st.y += dy * sgn
    }
    // snap tiny float drift so squares stay square
    if (Math.abs(st.x - Math.round(st.x)) < 1e-6) st.x = Math.round(st.x)
    if (Math.abs(st.y - Math.round(st.y)) < 1e-6) st.y = Math.round(st.y)
  }

  // [from, to] offsets of a shape, trimmed to the cells that can land on a canvas of `size`
  const clip = (from, to, origin, size) => [Math.max(from, Math.floor(-origin) - 1), Math.min(to, Math.ceil(size - origin) + 1)]

  const DRAWS = new Set(['MOVE', 'PAINT', 'STEP', 'DOT', 'LINE', 'RECT', 'CIRCLE', 'RING'])
  const exec = (stmts, scope) => {
    for (const s of stmts) {
      step(s.line)
      if (DRAWS.has(s.cmd)) ensureGrid() // the pen starts at the centre, even for a first DOT
      const env = { ...scope, x: st.x, y: st.y, W: st.w, H: st.h, cx: st.w / 2, cy: st.h / 2 }
      switch (s.cmd) {
        case 'CANVAS': {
          if (st.grid) throw new LangError('CANVAS must come before any drawing', s.line)
          const [w, h] = nums(s, env, 2, 2)
          if (w < 4 || h < 4 || w > MAX_W || h > MAX_H) throw new LangError(`CANVAS size must be between 4×4 and ${MAX_W}×${MAX_H}`, s.line)
          st.w = Math.round(w); st.h = Math.round(h)
          break
        }
        case 'BACKGROUND':
        case 'COLOR': {
          let rgb
          if (s.args.length === 1 && s.args[0].startsWith('#')) rgb = hexToRgb(s.args[0], s.line)
          else {
            const a = s.args[0]?.toUpperCase() === 'HSL' ? { ...s, args: s.args.slice(1) } : s
            const [h, sat, l] = nums(a, env, 3, 3)
            rgb = hslToRgb(h, sat, l)
          }
          if (s.cmd === 'COLOR') st.color = rgb
          else st.bg = rgb
          break
        }
        case 'LAYER': {
          const name = (s.args[0] ?? '').toLowerCase()
          if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new LangError('LAYER needs a name, for example: LAYER petals', s.line)
          if (!st.layerNames.includes(name)) {
            if (st.layerNames.length >= 16) throw new LangError('At most 16 layers', s.line)
            st.layerNames.push(name)
          }
          st.layer = name
          break
        }
        case 'MOVE': { ensureGrid(); const [x, y] = nums(s, env, 2, 2); st.x = x; st.y = y; break }
        case 'FACE': { const [d] = nums(s, env, 1, 1); st.heading = d; break }
        case 'TURN': {
          const dir = s.args[0]?.toUpperCase()
          if (dir === 'RIGHT' || dir === 'LEFT') {
            const rest = { ...s, args: s.args.slice(1) }
            const deg = rest.args.length ? nums(rest, env, 1, 1)[0] : 90
            st.heading += dir === 'RIGHT' ? deg : -deg
          } else {
            const [d] = nums(s, env, 1, 1)
            st.heading += d
          }
          break
        }
        case 'PAINT': { const [n] = nums(s, env, 1, 1); forward(n, true, s.line); break }
        case 'STEP': { ensureGrid(); const [n] = nums(s, env, 1, 1); forward(n, false, s.line); break }
        case 'DOT': { nums(s, env, 0, 0); plot(st.x, st.y, s.line); break }
        case 'LINE': {
          const [tx, ty] = nums(s, env, 2, 2)
          ensureGrid()
          const n = Math.max(Math.abs(tx - st.x), Math.abs(ty - st.y))
          limit(n, MAX_DISTANCE, 'LINE length', s.line)
          charge(n, s.line)
          for (let k = 0; k <= n; k++) plot(st.x + ((tx - st.x) * k) / (n || 1), st.y + ((ty - st.y) * k) / (n || 1), s.line)
          st.x = tx; st.y = ty
          break
        }
        case 'RECT': {
          const [w, h] = nums(s, env, 2, 2)
          ensureGrid()
          limit(w, MAX_SHAPE, 'RECT width', s.line)
          limit(h, MAX_SHAPE, 'RECT height', s.line)
          // only visit the part of the shape that lands on the canvas
          const [i0, i1] = clip(0, Math.round(w) - 1, st.x, st.w)
          const [j0, j1] = clip(0, Math.round(h) - 1, st.y, st.h)
          charge(Math.max(0, i1 - i0 + 1) * Math.max(0, j1 - j0 + 1), s.line)
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) plot(st.x + i, st.y + j, s.line)
          break
        }
        case 'CIRCLE':
        case 'RING': {
          const [r] = nums(s, env, 1, 1)
          ensureGrid()
          limit(r, MAX_SHAPE, `${s.cmd} radius`, s.line)
          const R = Math.ceil(r)
          const [i0, i1] = clip(-R, R, st.x, st.w)
          const [j0, j1] = clip(-R, R, st.y, st.h)
          charge(Math.max(0, i1 - i0 + 1) * Math.max(0, j1 - j0 + 1), s.line)
          for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
              const d = Math.hypot(i, j)
              if (s.cmd === 'CIRCLE' ? d <= r + 0.3 : Math.abs(d - r) < 0.6) plot(st.x + i, st.y + j, s.line)
            }
          }
          break
        }
        case 'REPEAT': {
          let words = s.args
          let varName = null
          const asIdx = words.findIndex((w) => w.toUpperCase() === 'AS')
          if (asIdx >= 0) {
            varName = words[asIdx + 1]
            if (!varName || !/^[a-z][a-z0-9_]{0,23}$/i.test(varName)) throw new LangError('Write REPEAT n AS i, with a simple name like i', s.line)
            // names the maths already uses (pi, tau, e, time = t) would silently win over the loop value
            if (RESERVED_NAMES.includes(varName)) throw new LangError(`"${varName}" is reserved — pick another loop name`, s.line)
            words = words.slice(0, asIdx)
          }
          const [n] = nums({ ...s, args: words }, env, 1, 1)
          const count = Math.floor(n)
          if (count < 0) throw new LangError('REPEAT count cannot be negative', s.line)
          for (let k = 0; k < count; k++) {
            step(s.line) // each pass costs a step even when the block is empty
            exec(s.block, varName ? { ...scope, [varName]: k } : scope)
          }
          break
        }
        case 'IF': {
          const [v] = nums(s, env, 1, 1)
          if (v > 0) exec(s.block, scope)
          break
        }
        case 'ANIMATE': {
          const target = (s.args[0] ?? '*').toLowerCase()
          if (target !== '*' && !/^[a-z][a-z0-9_]*$/.test(target)) throw new LangError('ANIMATE takes a layer name, for example: ANIMATE petals { … }', s.line)
          const props = {}
          for (const p of s.body) {
            const m = /^([a-z]+)\s*=\s*(.+)$/i.exec(p.text)
            if (!m) throw new LangError('Inside ANIMATE write lines like: dx = 2 * sin(t)', p.line)
            const prop = m[1].toLowerCase()
            if (!ANIM_PROPS.includes(prop)) throw new LangError(`"${m[1]}" can't be animated — use ${ANIM_PROPS.join(', ')}`, p.line)
            const c = compile(m[2], ANIM_VARS, PER_PIXEL)
            if (!c.ok) throw new LangError(`${prop}: ${c.error}`, p.line)
            props[prop] = { fn: c.fn, src: m[2] }
          }
          st.animations[target] = { ...(st.animations[target] ?? {}), ...props }
          break
        }
        default:
          throw new LangError(`Unknown command ${s.cmd}`, s.line)
      }
    }
  }

  exec(program, {})
  ensureGrid()

  const pixels = []
  for (let i = 0; i < st.grid.length; i++) {
    const c = st.grid[i]
    if (c < 0) continue
    pixels.push({
      x: i % st.w, y: Math.floor(i / st.w),
      r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255,
      layer: st.layerNames[st.layerOf[i]],
    })
  }
  for (const name of Object.keys(st.animations)) {
    if (name !== '*' && !st.layerNames.includes(name)) {
      throw new LangError(`ANIMATE ${name}: there is no layer called "${name}"`, 0)
    }
  }
  return { width: st.w, height: st.h, background: st.bg, pixels, layers: st.layerNames, animations: st.animations }
}
