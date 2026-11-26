import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ArtRenderer } from '../lang/artRenderer.js'
import { ease, FormulaBlender, crossfade } from '../engine/smooth.js'
import { useIdleCursor } from './useIdleCursor.js'

// A living canvas for any artwork. Uses the artwork's own ANIMATE blocks, or
// `motionFx` ({dx, dy, hue, bright} functions) when given. Sliders glide,
// motion changes blend, and new artwork dissolves in.
const ArtCanvas = forwardRef(function ArtCanvas(
  { art, motionFx = null, mode = 'pixels', opts, playing = true, onTime, onOverload, interactive = true, label = 'Artwork' }, ref,
) {
  const overloadRef = useRef(onOverload)
  overloadRef.current = onOverload
  const wrapRef = useRef(null)
  const stackRef = useRef(null)
  const canvasRef = useRef(null)
  const fadeRef = useRef(null)
  const rendererRef = useRef(null)
  const blender = useRef(new FormulaBlender(1.0))
  const live = useRef({ t: 0, mx: -1000, my: -1000, sm: { ...opts }, pace: 1, opts, playing })
  live.current.opts = opts
  live.current.playing = playing
  useIdleCursor(wrapRef)

  useImperativeHandle(ref, () => ({
    png: () => rendererRef.current?.toPNG(),
    fullscreen: () => {
      if (!document.fullscreenElement) wrapRef.current?.requestFullscreen?.()
      else document.exitFullscreen?.()
    },
    reset: () => { crossfade(canvasRef.current, fadeRef.current, 700); live.current.t = 0; rendererRef.current?.reset() },
    scatter: () => rendererRef.current?.scatter(6),
    canvas: () => canvasRef.current,
  }))

  const fit = () => {
    const wrap = wrapRef.current, c = stackRef.current, a = rendererRef.current?.art
    if (!wrap || !c || !a) return
    const r = wrap.getBoundingClientRect()
    const pad = document.fullscreenElement ? 0 : 40
    const ratio = Math.min((r.width - pad) / a.width, (r.height - pad) / a.height)
    const s = rendererRef.current.mode === 'pixels' && ratio >= 2 ? Math.floor(ratio) : Math.max(0.5, ratio)
    c.style.width = `${a.width * s}px`
    c.style.height = `${a.height * s}px`
  }

  const withMotion = (a) => {
    if (!motionFx) return a
    const out = blender.current.out ?? motionFx
    const anim = {}
    for (const k of Object.keys(out)) anim[k] = { fn: out[k] }
    return { ...a, animations: { '*': anim } }
  }

  useEffect(() => {
    rendererRef.current = new ArtRenderer(canvasRef.current)
    rendererRef.current.setMode(mode)
    rendererRef.current.onOverload = (v) => overloadRef.current?.(v)
  }, [])

  // new artwork: dissolve (pixels) or let particles fly to their new places
  const prevArt = useRef(null)
  useEffect(() => {
    const r = rendererRef.current
    if (!art || !r) return
    if (prevArt.current && prevArt.current !== art && r.mode === 'pixels') crossfade(canvasRef.current, fadeRef.current, 900)
    prevArt.current = art
    if (motionFx) blender.current.set(motionFx)
    r.setArt(withMotion(art))
    fit()
  }, [art])

  const prevFx = useRef(motionFx)
  useEffect(() => {
    const r = rendererRef.current
    if (!art || !r || prevFx.current === motionFx) return
    if (!motionFx || !prevFx.current) crossfade(canvasRef.current, fadeRef.current, 900)
    prevFx.current = motionFx
    if (motionFx) blender.current.set(motionFx)
    else blender.current = new FormulaBlender(1.0)
    r.setArt(withMotion(art))
  }, [motionFx])

  const firstMode = useRef(true)
  useEffect(() => {
    if (!firstMode.current) crossfade(canvasRef.current, fadeRef.current, 900)
    firstMode.current = false
    rendererRef.current?.setMode(mode)
    fit()
  }, [mode])

  useEffect(() => {
    const ro = new ResizeObserver(fit)
    ro.observe(wrapRef.current)
    document.addEventListener('fullscreenchange', fit)
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', fit) }
  }, [])

  useEffect(() => {
    let raf, last = performance.now(), lastReport = 0
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current, sm = L.sm, o = L.opts
      sm.amp = ease(sm.amp, o.amp, dt, 0.6)
      sm.speed = ease(sm.speed, o.speed, dt, 0.6)
      sm.glow = ease(sm.glow, o.glow, dt, 0.4)
      L.pace = ease(L.pace, L.playing ? 1 : 0, dt, 0.35)
      const step = dt * sm.speed * L.pace
      L.t += step
      blender.current.tick(dt)
      // one bad frame must never stop the loop
      try { rendererRef.current?.frame(L.t, step, { amp: sm.amp, glow: sm.glow, trails: o.trails, mx: L.mx, my: L.my }) } catch { /* skip frame */ }
      if (onTime && now - lastReport > 100) { onTime(L.t); lastReport = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onTime])

  const onPointer = (e) => {
    const a = rendererRef.current?.art
    if (!a || !interactive) return
    const rect = canvasRef.current.getBoundingClientRect()
    live.current.mx = ((e.clientX - rect.left) / rect.width) * a.width
    live.current.my = ((e.clientY - rect.top) / rect.height) * a.height
  }

  return (
    <div className="stage" ref={wrapRef}>
      <div className="canvas-stack" ref={stackRef}>
        <canvas
          ref={canvasRef}
          className={mode === 'pixels' ? 'pixelated' : ''}
          onPointerMove={onPointer}
          onPointerLeave={() => { live.current.mx = -1000; live.current.my = -1000 }}
          onPointerDown={() => interactive && mode === 'particles' && rendererRef.current?.scatter(5)}
          aria-label={label}
        />
        <canvas ref={fadeRef} className="fade pixelated" aria-hidden />
        <div className="vignette" aria-hidden />
      </div>
    </div>
  )
})

export default ArtCanvas
