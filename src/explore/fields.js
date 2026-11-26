// Explore: full-screen living art made only from formulas.
//   field   — colour every cell from f(x, y, t)
//   contour — draw the level lines of f, like a topographic map
//   flow    — f gives a direction; thousands of particles leave silky trails

export const FIELD_VARS = ['x', 'y', 't', 'r', 'a', 'amp']
export const FIELD_VAR_LABELS = { x: 'Position X', y: 'Position Y', t: 'Time', r: 'Distance', a: 'Angle', amp: 'Strength' }

export const PALETTES = {
  marble: { name: 'Marble', stops: ['#0f2a2e', '#1f4e52', '#e8dcc2', '#c99a4b', '#123236'] },
  aurora: { name: 'Aurora', stops: ['#050814', '#0b2a3a', '#14a38b', '#9ef0b4', '#efe0ff'] },
  topo: { name: 'Topo', stops: ['#163b45', '#3d8a86', '#9fd3b4', '#f4e6b6'] },
  lagoon: { name: 'Lagoon', stops: ['#061827', '#0f4c6e', '#3fa7c9', '#c8f1ff'] },
  silk: { name: 'Silk', stops: ['#0e6e72', '#21d4c8', '#6a3bd1', '#c13fd8'] },
  ember: { name: 'Ember', stops: ['#5a1408', '#d4541c', '#ffb35c', '#fff1c7'] },
  spectrum: { name: 'Spectrum', stops: ['#f26d6d', '#f2b36d', '#e6e36d', '#6de38f', '#6dc4f2', '#9a7af2', '#f26dd1', '#f26d6d'] },
  dusk: { name: 'Dusk', stops: ['#1b1433', '#4b2a5c', '#c2577a', '#f2a65a', '#ffe3a8'] },
  home: { name: 'Home', stops: ['#0f2127', '#16303a', '#203c3e', '#3b4a40', '#4b4a48'], hidden: true },
}
export const BACKGROUNDS = { flow: '#07070c', contour: '#0b1419' }

export const EXPLORE_PRESETS = [
  {
    key: 'marble', name: 'Liquid marble', kind: 'field', map: 'cycle', palette: 'marble', speed: 0.6,
    formula: 'noise(x * 1.6 + noise(x * 1.2 + t * 0.08, y * 1.2) * 2.2 * amp, y * 1.6 + noise(x * 1.2, y * 1.2 - t * 0.08) * 2.2 * amp) * 1.4',
    blurb: 'Noise folded into noise, like ink in water',
  },
  {
    key: 'silk', name: 'Silk ribbons', kind: 'flow', palette: 'silk', speed: 1,
    formula: 'noise(x * 1.1 + t * 0.04, y * 1.1) * 2.4 * amp',
    blurb: 'Thousands of particles follow a flowing direction',
  },
  {
    key: 'aurora', name: 'Aurora', kind: 'field', map: 'clamp', palette: 'aurora', speed: 0.8,
    formula: 'exp(-abs(y + 0.35 * sin(x * 1.6 + t * 0.35) + 0.3 * noise(x * 2.2, t * 0.25)) * 3.2) * (0.75 + 0.25 * sin(x * 9 + t * 0.6)) * amp',
    blurb: 'Curtains of light ripple across the sky',
  },
  {
    key: 'contours', name: 'Contours', kind: 'contour', palette: 'topo', speed: 0.7, bands: 11,
    formula: 'noise(x * 1.5 + t * 0.05, y * 1.5) + 0.5 * noise(x * 3, y * 3 - t * 0.07) * amp',
    blurb: 'The level lines of a slowly shifting landscape',
  },
  {
    key: 'ripples', name: 'Rain ripples', kind: 'field', map: 'clamp', palette: 'lagoon', speed: 0.8,
    formula: '0.5 + 0.5 * (sin(r * 16 - t * 2) / (1 + r * 3) + sin(sqrt((x - 0.7) ^ 2 + (y + 0.3) ^ 2) * 18 - t * 2.6) / (1 + r * 3)) * amp',
    blurb: 'Rings of water meeting and passing through',
  },
  {
    key: 'spiral', name: 'Spiral bloom', kind: 'field', map: 'cycle', palette: 'spectrum', speed: 0.6,
    formula: 'a / tau * 6 + r * 2.5 * amp - t * 0.25',
    blurb: 'Colour wound around the centre',
  },
  {
    key: 'embers', name: 'Ember drift', kind: 'flow', palette: 'ember', speed: 0.8,
    formula: '-1.57 + 0.9 * noise(x * 1.4, y * 1.4 + t * 0.15) * amp',
    blurb: 'Warm sparks rising through the dark',
  },
]

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now())
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }

export function buildLUT(stops) {
  const cols = stops.map(hex)
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const f = (i / 255) * (cols.length - 1)
    const k = Math.min(cols.length - 2, Math.floor(f)), w = f - k
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = cols[k][c] + (cols[k + 1][c] - cols[k][c]) * w
  }
  return lut
}

export class FieldRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.kind = null
    this.particles = null
  }

  configure({ kind, palette, map, bands }) {
    this.resetGuard()
    const changed = kind !== this.kind
    this.kind = kind
    this.map = map
    this.bands = bands ?? 10
    this.lut = buildLUT(PALETTES[palette].stops)
    if (kind === 'flow') {
      this.canvas.width = 960; this.canvas.height = 540
      if (changed || !this.particles) this.seedParticles()
      if (changed) { this.ctx.fillStyle = BACKGROUNDS.flow; this.ctx.fillRect(0, 0, 960, 540) }
    } else {
      const [w, h] = kind === 'contour' ? [384, 216] : [256, 144]
      if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = h }
      this.img = this.ctx.createImageData(w, h)
    }
  }

  seedParticles() {
    const n = 1600
    this.particles = Array.from({ length: n }, (_, i) => this.spawn(i, true))
  }

  spawn(i, initial) {
    return {
      x: Math.random() * 960, y: Math.random() * 540,
      life: initial ? Math.random() * 200 : 120 + Math.random() * 180,
      c: (i * 0.618034) % 1,
    }
  }

  // Frame-time guard (same rule as the art renderer): a formula too heavy to
  // draw smoothly is paused, keeping the last picture, instead of freezing the page.
  resetGuard() {
    this.slow = 0
    if (this.overloaded) { this.overloaded = false; this.onOverload?.(false) }
  }

  frame(fn, t, amp) {
    if (this.overloaded) return
    const t0 = clock()
    this._t0 = t0
    this.draw(fn, t, amp)
    if (this.overloaded) return
    this.slow = clock() - t0 > 80 ? (this.slow ?? 0) + 1 : 0
    if (this.slow >= 3) { this.overloaded = true; this.onOverload?.(true) }
  }

  tooSlow() {
    if (clock() - this._t0 <= 250) return false
    this.overloaded = true
    this.onOverload?.(true)
    return true
  }

  draw(fn, t, amp) {
    if (this.kind === 'flow') return this.flow(fn, t, amp)
    const { width: w, height: h } = this.canvas
    const d = this.img.data, lut = this.lut
    const aspect = w / h
    const env = { x: 0, y: 0, t, r: 0, a: 0, amp }
    const contour = this.kind === 'contour'
    const bands = this.bands
    const bg = hex(BACKGROUNDS.contour)
    let i = 0
    for (let py = 0; py < h; py++) {
      if ((py & 7) === 0 && this.tooSlow()) return
      const y = (py / h) * 2 - 1
      for (let px = 0; px < w; px++) {
        const x = ((px / w) * 2 - 1) * aspect
        env.x = x; env.y = y
        env.r = Math.sqrt(x * x + y * y); env.a = Math.atan2(y, x)
        const v = fn(env)
        if (contour) {
          const f = v * bands
          const dist = Math.abs(f - Math.round(f)) // 0 on a line
          const line = Math.max(0, 1 - dist * 7)
          const k = Math.max(0, Math.min(255, ((v + 1) / 2) * 255)) | 0
          const lift = 0.16 + ((Math.round(f) % 5 === 0) ? 0.3 : 0)
          d[i] = bg[0] + (lut[k * 3] - bg[0]) * (line * 0.9 + lift * 0.25)
          d[i + 1] = bg[1] + (lut[k * 3 + 1] - bg[1]) * (line * 0.9 + lift * 0.25)
          d[i + 2] = bg[2] + (lut[k * 3 + 2] - bg[2]) * (line * 0.9 + lift * 0.25)
        } else {
          let k
          if (this.map === 'cycle') { const f = v - Math.floor(v); k = (f < 0.5 ? f * 2 : 2 - f * 2) }
          else k = Math.max(0, Math.min(1, v))
          const j = (k * 255) | 0
          d[i] = lut[j * 3]; d[i + 1] = lut[j * 3 + 1]; d[i + 2] = lut[j * 3 + 2]
        }
        d[i + 3] = 255
        i += 4
      }
    }
    this.ctx.putImageData(this.img, 0, 0)
  }

  flow(fn, t, amp) {
    const ctx = this.ctx, W = 960, H = 540, lut = this.lut
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(7, 7, 12, 0.045)'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = 1.1
    const env = { x: 0, y: 0, t, r: 0, a: 0, amp }
    const aspect = W / H
    // batch strokes by colour bucket to keep canvas state changes low
    const buckets = 12
    const paths = Array.from({ length: buckets }, () => new Path2D())
    for (let i = 0; i < this.particles.length; i++) {
      if ((i & 255) === 0 && this.tooSlow()) return
      const p = this.particles[i]
      const x = ((p.x / W) * 2 - 1) * aspect, y = (p.y / H) * 2 - 1
      env.x = x; env.y = y; env.r = Math.sqrt(x * x + y * y); env.a = Math.atan2(y, x)
      const ang = fn(env)
      const nx = p.x + Math.cos(ang) * 1.6, ny = p.y + Math.sin(ang) * 1.6
      const b = Math.min(buckets - 1, (p.c * buckets) | 0)
      paths[b].moveTo(p.x, p.y)
      paths[b].lineTo(nx, ny)
      p.x = nx; p.y = ny
      if (--p.life < 0 || nx < 0 || ny < 0 || nx > W || ny > H) this.particles[i] = this.spawn(i, false)
    }
    for (let b = 0; b < buckets; b++) {
      const j = (((b + 0.5) / buckets) * 255) | 0
      ctx.strokeStyle = `rgba(${lut[j * 3]},${lut[j * 3 + 1]},${lut[j * 3 + 2]},0.32)`
      ctx.stroke(paths[b])
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
