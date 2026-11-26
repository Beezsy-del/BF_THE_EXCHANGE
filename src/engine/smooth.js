// Tools that keep motion calm: values glide to their targets, formulas
// blend into each other, and image changes crossfade instead of cutting.

// Frame-rate independent easing toward a target. `tau` = seconds to cover ~63%.
export const ease = (cur, target, dt, tau = 0.5) => cur + (target - cur) * (1 - Math.exp(-dt / tau))

const smoothstep = (k) => k * k * (3 - 2 * k)
const zero = () => 0
const one = () => 1
const neutral = (key) => key === 'bright' ? one : zero

// Flat weighted mixtures preserve the current motion when retargeted. Unlike
// nested blend closures, their evaluation cost stays bounded during scrubbing.
export class FormulaBlender {
  constructor(duration = 0.9) {
    this.duration = duration
    this.k = 1
    this.base = {}
    this.target = null
    this.out = null
  }

  set(next) {
    const w = smoothstep(this.k)
    const keys = new Set([...Object.keys(this.base), ...Object.keys(this.target ?? {}), ...Object.keys(next)])
    const base = {}
    for (const key of keys) {
      const weights = new Map()
      const add = (fn, weight) => { if (fn && weight > 1e-8) weights.set(fn, (weights.get(fn) ?? 0) + weight) }
      if (this.target) {
        for (const [fn, weight] of this.base[key] ?? [[neutral(key), 1]]) add(fn, weight * (1 - w))
        add(this.target[key] ?? neutral(key), w)
      } else add(next[key], 1)
      // Keep the strongest contributions under pathological uninterrupted edits.
      base[key] = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 32)
    }
    this.base = base
    const first = !this.target
    this.target = next
    this.k = first ? 1 : 0
    this.out = {}
    for (const key of keys) {
      this.out[key] = (env) => {
        const mix = smoothstep(this.k)
        const target = (next[key] ?? neutral(key))(env)
        if (mix >= 1) return target
        let value = 0
        for (const [fn, weight] of base[key]) value += fn(env) * weight
        return value * (1 - mix) + target * mix
      }
    }
    return this.out
  }

  tick(dt) {
    if (this.k < 1) this.k = Math.min(1, this.k + Math.max(0, dt) / Math.max(0.001, this.duration))
  }
}

// Fade a snapshot of `canvas` out over the top of it. `overlay` is a canvas
// stacked exactly above; call before the content changes.
export function crossfade(canvas, overlay, ms = 1200) {
  if (!canvas || !overlay || !canvas.width) return
  overlay.width = canvas.width
  overlay.height = canvas.height
  overlay.getContext('2d').drawImage(canvas, 0, 0)
  overlay.style.transition = 'none'
  overlay.style.opacity = '1'
  // next frame: let it dissolve
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.transition = `opacity ${ms}ms cubic-bezier(.4,0,.2,1)`
    overlay.style.opacity = '0'
  }))
}
