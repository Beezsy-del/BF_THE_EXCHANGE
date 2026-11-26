// Tools that keep motion calm: values glide to their targets, formulas
// blend into each other, and image changes crossfade instead of cutting.

// Frame-rate independent easing toward a target. `tau` = seconds to cover ~63%.
export const ease = (cur, target, dt, tau = 0.5) => cur + (target - cur) * (1 - Math.exp(-dt / tau))

const smoothstep = (k) => k * k * (3 - 2 * k)

// Blends a set of formula functions into the next set over `duration` seconds.
// Rapid edits (like scrubbing) keep the original base, so closures never pile up.
export class FormulaBlender {
  constructor(duration = 0.9) {
    this.duration = duration
    this.k = 1
    this.base = null
    this.target = null
    this.out = null
  }

  set(next) {
    if (!this.target) {
      this.base = this.target = next
      this.k = 1
    } else {
      if (this.k >= 1) { this.base = this.target; this.k = 0 }
      this.target = next
    }
    const self = this
    this.out = {}
    for (const key of Object.keys(next)) {
      const a = this.base[key], b = next[key]
      this.out[key] = !a || a === b ? b : (env) => {
        const k = self.k
        if (k >= 1) return b(env)
        const w = smoothstep(k)
        return a(env) * (1 - w) + b(env) * w
      }
    }
    return this.out
  }

  tick(dt) {
    if (this.k < 1) this.k = Math.min(1, this.k + dt / this.duration)
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
