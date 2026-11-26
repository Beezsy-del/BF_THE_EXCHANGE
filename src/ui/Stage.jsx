import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { build, W, H } from '../scene/blossomNight.js'
import { PixelRenderer } from '../scene/renderer.js'
import { ease, FormulaBlender, crossfade } from '../engine/smooth.js'
import { useIdleCursor } from './useIdleCursor.js'

// Owns the canvas and the animation loop. Scales the 320x180 art by whole
// numbers so every art pixel stays a crisp square. Parameters glide to their
// slider values, formula edits blend in, and palette changes dissolve.
const Stage = forwardRef(function Stage({ palette, params, fx, playing, resetToken, onTime }, ref) {
  const wrapRef = useRef(null)
  const stackRef = useRef(null)
  const canvasRef = useRef(null)
  const fadeRef = useRef(null)
  const rendererRef = useRef(null)
  const blender = useRef(new FormulaBlender(0.9))
  const live = useRef({ params, playing, t: 0, sm: { ...params }, pace: playing ? 1 : 0 })
  live.current.params = params
  live.current.playing = playing
  useIdleCursor(wrapRef)

  useImperativeHandle(ref, () => ({
    toPNG: () => rendererRef.current?.toPNG(6),
    canvas: () => canvasRef.current,
    fullscreen: () => {
      const el = wrapRef.current
      if (!document.fullscreenElement) el?.requestFullscreen?.()
      else document.exitFullscreen?.()
    },
  }))

  useEffect(() => {
    rendererRef.current = new PixelRenderer(canvasRef.current)
  }, [])

  const firstScene = useRef(true)
  const lastPalette = useRef(palette)
  useEffect(() => {
    // dissolve between palettes (glow tweaks swap instantly, they're subtle)
    if (!firstScene.current && lastPalette.current !== palette) crossfade(canvasRef.current, fadeRef.current, 1400)
    firstScene.current = false
    lastPalette.current = palette
    rendererRef.current.setScene(build(palette, params.glow))
  }, [palette, params.glow])

  useEffect(() => {
    crossfade(canvasRef.current, fadeRef.current, 700)
    live.current.t = 0
    rendererRef.current?.reset()
  }, [resetToken])

  useEffect(() => { rendererRef.current?.setFormulas(blender.current.set(fx)) }, [fx])

  // integer scaling
  useEffect(() => {
    const wrap = wrapRef.current
    const fit = () => {
      const r = wrap.getBoundingClientRect()
      const pad = document.fullscreenElement ? 0 : 24
      const fitRatio = Math.min((r.width - pad) / W, (r.height - pad) / H)
      // whole-number scale keeps pixels perfectly square; below 2x use the exact fit instead
      const s = fitRatio >= 2 ? Math.floor(fitRatio) : Math.max(0.5, fitRatio)
      stackRef.current.style.width = `${W * s}px`
      stackRef.current.style.height = `${H * s}px`
    }
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    document.addEventListener('fullscreenchange', fit)
    fit()
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', fit) }
  }, [])

  useEffect(() => {
    let raf, last = performance.now(), lastReport = 0
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current, sm = L.sm, p = L.params
      // glide toward slider values; play/pause eases in and out instead of freezing
      sm.wind = ease(sm.wind, p.wind, dt, 0.8)
      sm.speed = ease(sm.speed, p.speed, dt, 0.6)
      sm.petals = ease(sm.petals, p.petals, dt, 0.5)
      L.pace = ease(L.pace, L.playing ? 1 : 0, dt, 0.35)
      const step = dt * sm.speed * L.pace
      L.t += step
      blender.current.tick(dt)
      const r = rendererRef.current
      r.setParams({ wind: sm.wind, petals: sm.petals })
      try { r.frame(L.t, step) } catch { /* skip frame */ }
      if (now - lastReport > 100) { onTime(L.t); lastReport = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onTime])

  return (
    <div className="stage" ref={wrapRef}>
      <div className="canvas-stack" ref={stackRef}>
        <canvas ref={canvasRef} aria-label="Blossom Night, an animated pixel-art scene" />
        <canvas ref={fadeRef} className="fade" aria-hidden />
        <div className="vignette" aria-hidden />
      </div>
    </div>
  )
})

export default Stage
