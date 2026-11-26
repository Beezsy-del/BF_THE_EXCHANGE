// Pixel renderer: composes the static scene with formula-driven motion
// into a 320x180 buffer every frame. The source scene is never mutated,
// so changing a formula can't leave the artwork distorted.

import { W, H, WATERLINE, noise, bayer } from './blossomNight.js'

const mixc = (a, b, k) => a + (b - a) * k

export class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext('2d')
    this.img = this.ctx.createImageData(W, H)
    this.buf = this.img.data
    this.scene = null
    this.fx = null // compiled formulas: { sway, petalX, petalY, twinkle, ripple }
    this.params = { wind: 0.6, petals: 90 }
    this.petals = []
    this.seedCounter = 1
  }

  setScene(scene) {
    this.scene = scene // petals keep flying across palette/glow changes
  }

  setFormulas(fx) { this.fx = fx }
  setParams(p) { this.params = { ...this.params, ...p } }

  reset() { this.petals = [] }

  // ---------- petals ----------

  spawnPetal(t, stagger) {
    const s = this.scene
    const [x, y] = s.spawn[Math.floor(Math.random() * s.spawn.length)]
    const seed = (this.seedCounter++ * 0.6180339887) % 1 * 100
    return {
      x, y, seed, landed: false, life: 0,
      delay: stagger ? Math.random() * 8 : Math.random() * 0.6,
      landY: WATERLINE - 7 + Math.floor(Math.pow(Math.random(), 0.8) * 40),
      fade: 3 + Math.random() * 4,
    }
  }

  updatePetals(t, dt) {
    const want = Math.round(this.params.petals)
    while (this.petals.length < want) this.petals.push(this.spawnPetal(t, true))
    if (this.petals.length > want) this.petals.length = want
    const step = dt * 60
    const env = { x: 0, y: 0, t, seed: 0, wind: this.params.wind }
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i]
      if (p.delay > 0) { p.delay -= dt; continue }
      if (!p.landed) {
        env.x = p.x; env.y = p.y; env.seed = p.seed
        p.x += this.fx.petalX(env) * step
        p.y += Math.max(0.02, this.fx.petalY(env)) * step
        if (p.y >= p.landY) { p.y = p.landY; p.landed = true }
        if (p.x < -4 || p.x > W + 4) this.petals[i] = this.spawnPetal(t, false)
      } else {
        p.life += dt
        if (p.y >= WATERLINE) p.x += this.params.wind * 0.04 * step // drift on the water
        if (p.life > p.fade) this.petals[i] = this.spawnPetal(t, false)
      }
    }
  }

  // ---------- drawing primitives ----------

  set(x, y, rgb) {
    x |= 0; y |= 0
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    this.buf[i] = rgb[0]; this.buf[i + 1] = rgb[1]; this.buf[i + 2] = rgb[2]
  }

  blend(x, y, rgb, k) {
    x |= 0; y |= 0
    if (x < 0 || y < 0 || x >= W || y >= H || k <= 0) return
    const i = (y * W + x) * 4, b = this.buf
    b[i] = mixc(b[i], rgb[0], k); b[i + 1] = mixc(b[i + 1], rgb[1], k); b[i + 2] = mixc(b[i + 2], rgb[2], k)
  }

  drawPetal(p, t) {
    const s = this.scene
    const flutter = Math.sin(t * 6 + p.seed * 3)
    const rgb = s.blossom[flutter > 0 ? 4 : 3]
    let alpha = 1
    if (p.landed) alpha = Math.max(0, 1 - p.life / p.fade) * (p.y >= WATERLINE ? 0.85 : 1)
    this.blend(p.x, p.y, rgb, alpha)
    if (!p.landed && flutter > 0.55) this.blend(p.x + 1, p.y, s.blossom[2], alpha * 0.8)
  }

  // ---------- frame ----------

  frame(t, dt) {
    const s = this.scene, fx = this.fx
    if (!s || !fx) return
    const b = this.buf
    b.set(s.bg)
    const env = { x: 0, y: 0, t, h: 0, seed: 0, wind: this.params.wind, d: 0 }

    // stars
    for (const st of s.stars) {
      env.seed = st.seed; env.x = st.x; env.y = st.y
      const k = Math.min(1, Math.max(0, fx.twinkle(env)))
      this.blend(st.x, st.y, st.rgb, k)
      if (st.big && k > 0.6) {
        const c = (k - 0.6) * 1.6
        this.blend(st.x - 1, st.y, st.rgb, c); this.blend(st.x + 1, st.y, st.rgb, c)
        this.blend(st.x, st.y - 1, st.rgb, c); this.blend(st.x, st.y + 1, st.rgb, c)
      }
    }

    // lantern flicker
    for (const [lx, ly] of s.lanternSpots) {
      const f = 0.5 + 0.5 * Math.sin(t * 2.3 + lx) * Math.sin(t * 3.7 + ly)
      this.set(lx, ly, f > 0.35 ? s.lantern[0] : s.lantern[1])
    }

    // canopy: each row is displaced by the sway formula, rounded to whole pixels
    for (const c of s.canopy) {
      const span = Math.max(1, c.bottom - c.top)
      const offsets = new Map()
      for (const [x, y, rgb] of c.pixels) {
        let dx = offsets.get(y)
        if (dx === undefined) {
          env.x = c.cx; env.y = y
          env.h = c.swayWeight * (0.35 + 0.65 * (c.bottom - y) / span)
          dx = Math.round(fx.sway(env))
          offsets.set(y, dx)
        }
        this.set(x + dx, y, rgb)
      }
    }

    // petals in the air (drawn before the reflection so they mirror in the water)
    this.updatePetals(t, dt)
    for (const p of this.petals) if (p.delay <= 0 && !p.landed && p.y < WATERLINE) this.drawPetal(p, t)

    // water: mirror the scene above the waterline with a rippling offset
    const [wa, wd] = s.water
    const glint = s.waterGlint
    const depthMax = H - WATERLINE
    for (let y = WATERLINE; y < H; y++) {
      const d = y - WATERLINE
      env.d = d; env.y = d
      const dx = Math.round(fx.ripple(env))
      const srcY = WATERLINE - 1 - d
      const deep = d / depthMax
      for (let x = 0; x < W; x++) {
        const sx = Math.min(W - 1, Math.max(0, x + dx))
        const si = (srcY * W + sx) * 4, di = (y * W + x) * 4
        const k = 0.36 + deep * 0.3
        let r = mixc(b[si], mixc(wa[0], wd[0], deep), k) * 0.86
        let g = mixc(b[si + 1], mixc(wa[1], wd[1], deep), k) * 0.86
        let bl = mixc(b[si + 2], mixc(wa[2], wd[2], deep), k) * 0.9
        const n = noise(x * 0.045 - t * 0.35, y * 0.85 + t * 0.15)
        if (n > 0.62 && bayer(x, y) < (n - 0.62) * 3) {
          r = mixc(r, glint[0], 0.55); g = mixc(g, glint[1], 0.55); bl = mixc(bl, glint[2], 0.55)
        }
        b[di] = r; b[di + 1] = g; b[di + 2] = bl
      }
    }

    // fallen-petal carpet shimmers gently
    for (const [x, y, rgb, seed] of s.carpet) {
      const k = y >= WATERLINE ? 0.55 + 0.35 * Math.sin(t * 1.5 + seed) : 0.75 + 0.25 * Math.sin(t * 0.8 + seed)
      this.blend(x, y, rgb, k)
    }

    // petals below the waterline and landed ones sit on top of the water
    for (const p of this.petals) {
      if (p.delay > 0) continue
      if (p.landed || p.y >= WATERLINE) this.drawPetal(p, t)
    }

    this.ctx.putImageData(this.img, 0, 0)
  }

  toPNG(scale = 6) {
    const c = document.createElement('canvas')
    c.width = W * scale
    c.height = H * scale
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.drawImage(this.canvas, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }
}
