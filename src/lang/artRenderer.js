// Renders art produced by the drawing language.
// Every source pixel keeps its original position and colour; ANIMATE formulas
// compute an offset and colour shift each frame (dx, dy, hue, bright).
// Modes: 'pixels' (crisp) or 'particles' (pixels become springy points
// that the mouse can push around).

import { hslToRgb } from './draw.js'

const STILL = {} // no motion: every pixel at home, original colour
const SLOW_MS = 80
const HARD_MS = 250
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

const seedOf = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

export class ArtRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.mode = 'pixels'
    this.art = null
    this.n = 0
    this.px = new Float32Array(0) // particle positions/velocities
    this.py = new Float32Array(0)
    this.vx = new Float32Array(0)
    this.vy = new Float32Array(0)
  }

  setMode(mode) {
    if (mode === this.mode) return
    this.mode = mode
    this.resize()
  }

  resize() {
    if (!this.art) return
    const { width: w, height: h } = this.art
    if (this.mode === 'pixels') {
      this.scale = 1
    } else {
      this.scale = Math.max(3, Math.min(12, Math.floor(1280 / w)))
    }
    this.canvas.width = w * this.scale
    this.canvas.height = h * this.scale
    this.img = this.mode === 'pixels' ? this.ctx.createImageData(w, h) : null
  }

  setArt(art) {
    const prev = this.art
    this.art = art
    // a new artwork or motion gets a fresh chance
    this.slow = 0
    if (this.overloaded) { this.overloaded = false; this.onOverload?.(false) }
    const P = art.pixels
    const n = P.length
    // per-pixel animation props: layer-specific override the "*" defaults
    const all = art.animations['*'] ?? {}
    const byLayer = Object.create(null)
    for (const name of art.layers) byLayer[name] = { ...all, ...(art.animations[name] ?? {}) }
    // layer centres
    const sums = Object.create(null)
    for (const p of P) {
      const s = (sums[p.layer] ??= [0, 0, 0])
      s[0] += p.x; s[1] += p.y; s[2]++
    }
    this.items = P.map((p) => {
      const s = sums[p.layer]
      return {
        x: p.x, y: p.y, rgb: [p.r, p.g, p.b], hsl: rgbToHsl(p.r, p.g, p.b),
        seed: seedOf(p.x, p.y), cx: s[0] / s[2], cy: s[1] / s[2], anim: byLayer[p.layer],
      }
    })
    // particles: keep old positions so switching programs morphs between them
    const ox = this.px, oy = this.py, ovx = this.vx, ovy = this.vy
    this.px = new Float32Array(n); this.py = new Float32Array(n)
    this.vx = new Float32Array(n); this.vy = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      if (i < this.n && [ox[i], oy[i], ovx[i], ovy[i]].every(Number.isFinite)) {
        this.px[i] = ox[i]; this.py[i] = oy[i]; this.vx[i] = ovx[i]; this.vy[i] = ovy[i]
      } else {
        this.px[i] = P[i].x; this.py[i] = P[i].y
      }
    }
    this.n = n
    if (!prev || prev.width !== art.width || prev.height !== art.height) this.resize()
    else if (!this.img && this.mode === 'pixels') this.resize()
  }

  reset() {
    for (let i = 0; i < this.n; i++) {
      this.px[i] = this.items[i].x; this.py[i] = this.items[i].y
      this.vx[i] = this.vy[i] = 0
    }
  }

  scatter(power = 6) {
    for (let i = 0; i < this.n; i++) {
      const a = Math.random() * Math.PI * 2, m = Math.random() * power
      this.vx[i] += Math.cos(a) * m
      this.vy[i] += Math.sin(a) * m
    }
  }

  // Frame-time guard: a motion that makes frames slow (one frame over 250 ms,
  // or three in a row over 80 ms) is paused and the art shown still, so a heavy
  // formula — typed, evolved or loaded from a file — can never freeze the page.
  guard(i) {
    if (this.overloaded || (i & 1023) !== 0) return
    if (clock() - this._t0 > HARD_MS) this.trip()
  }

  trip() {
    this.overloaded = true
    this.onOverload?.(true)
  }

  // Evaluate animation for item i at time t -> [tx, ty, r, g, b]
  evaluate(it, env, out) {
    const A = this.overloaded ? STILL : it.anim
    env.x = it.x; env.y = it.y; env.seed = it.seed; env.cx = it.cx; env.cy = it.cy
    const ddx = it.x - it.cx, ddy = it.y - it.cy
    env.r = Math.sqrt(ddx * ddx + ddy * ddy); env.a = Math.atan2(ddy, ddx)
    out[0] = it.x + (A.dx ? A.dx.fn(env) : 0)
    out[1] = it.y + (A.dy ? A.dy.fn(env) : 0)
    if (A.hue || A.bright) {
      const shift = A.hue ? A.hue.fn(env) : 0
      const k = A.bright ? Math.max(0, A.bright.fn(env)) : 1
      const [h, s, l] = it.hsl
      const c = A.hue ? hslToRgb(h + shift, s, l) : it.rgb
      out[2] = c[0] * k; out[3] = c[1] * k; out[4] = c[2] * k
    } else {
      out[2] = it.rgb[0]; out[3] = it.rgb[1]; out[4] = it.rgb[2]
    }
  }

  frame(t, dt, opts) {
    this._t0 = clock()
    this.draw(t, dt, opts)
    if (this.overloaded) return
    this.slow = clock() - this._t0 > SLOW_MS ? (this.slow ?? 0) + 1 : 0
    if (this.slow >= 3) this.trip()
  }

  draw(t, dt, opts) {
    const art = this.art
    if (!art) return
    const env = { t, amp: opts.amp, mx: opts.mx, my: opts.my, W: art.width, H: art.height, x: 0, y: 0, seed: 0, cx: 0, cy: 0, r: 0, a: 0 }
    const out = [0, 0, 0, 0, 0]
    const [br, bgc, bb] = art.background

    if (this.mode === 'pixels') {
      const w = art.width, h = art.height, d = this.img.data
      for (let i = 0; i < d.length; i += 4) { d[i] = br; d[i + 1] = bgc; d[i + 2] = bb; d[i + 3] = 255 }
      for (let n = 0; n < this.items.length; n++) {
        const it = this.items[n]
        this.guard(n)
        this.evaluate(it, env, out)
        const x = Math.round(out[0]), y = Math.round(out[1])
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const k = (y * w + x) * 4
        d[k] = out[2]; d[k + 1] = out[3]; d[k + 2] = out[4]
      }
      this.ctx.putImageData(this.img, 0, 0)
      return
    }

    // particles
    const S = this.scale, ctx = this.ctx
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(${br},${bgc},${bb},${opts.trails ? 0.22 : 1})`
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    const step = Math.min(3, dt * 60)
    const R = 9, mx = opts.mx, my = opts.my
    const size = Math.max(1.5, S * 0.62)
    const glow = []
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i]
      this.guard(i)
      this.evaluate(it, env, out)
      // Bound targets before storing them in Float32 buffers; repair damaged state.
      const bound = Math.max(art.width, art.height) * 16
      out[0] = Number.isFinite(out[0]) ? Math.max(-bound, Math.min(bound, out[0])) : it.x
      out[1] = Number.isFinite(out[1]) ? Math.max(-bound, Math.min(bound, out[1])) : it.y
      if (![this.px[i], this.py[i], this.vx[i], this.vy[i]].every(Number.isFinite)) {
        this.px[i] = it.x; this.py[i] = it.y; this.vx[i] = this.vy[i] = 0
      }
      // spring toward the formula's target, with damping
      let ax = (out[0] - this.px[i]) * 0.09, ay = (out[1] - this.py[i]) * 0.09
      const ddx = this.px[i] - mx, ddy = this.py[i] - my
      const dd = Math.sqrt(ddx * ddx + ddy * ddy)
      if (dd < R && dd > 0.001) {
        const f = (1 - dd / R) * 1.6
        ax += (ddx / dd) * f; ay += (ddy / dd) * f
      }
      this.vx[i] = (this.vx[i] + ax * step) * Math.pow(0.84, step)
      this.vy[i] = (this.vy[i] + ay * step) * Math.pow(0.84, step)
      this.px[i] += this.vx[i] * step
      this.py[i] += this.vy[i] * step
      const r = out[2] | 0, g = out[3] | 0, b = out[4] | 0
      ctx.fillStyle = `rgb(${r},${g},${b})`
      const sx = this.px[i] * S + S / 2, sy = this.py[i] * S + S / 2
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size)
      if ((i & 3) === 0) glow.push(sx, sy, r, g, b)
    }
    // restrained bloom: a faint additive halo on a quarter of the particles
    ctx.globalCompositeOperation = 'lighter'
    const gr = S * 1.6
    for (let k = 0; k < glow.length; k += 5) {
      ctx.fillStyle = `rgba(${glow[k + 2]},${glow[k + 3]},${glow[k + 4]},${0.06 * opts.glow})`
      ctx.beginPath()
      ctx.arc(glow[k], glow[k + 1], gr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  toPNG() {
    if (this.mode !== 'pixels') return this.canvas.toDataURL('image/png')
    const k = Math.max(1, Math.floor(1920 / this.art.width))
    const c = document.createElement('canvas')
    c.width = this.art.width * k; c.height = this.art.height * k
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.drawImage(this.canvas, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }
}
