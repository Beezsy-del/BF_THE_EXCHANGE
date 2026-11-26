import React, { useEffect, useMemo, useRef, useState } from 'react'
import Slider from './Slider.jsx'
import Transport from './Transport.jsx'
import FormulaRow from './FormulaRow.jsx'
import WorkflowEditor from '../workflow/WorkflowEditor.jsx'
import { compile, PER_PIXEL } from '../engine/expr.js'
import { ease, crossfade } from '../engine/smooth.js'
import { FieldRenderer, EXPLORE_PRESETS, PALETTES, FIELD_VARS, FIELD_VAR_LABELS } from '../explore/fields.js'
import { useIdleCursor } from './useIdleCursor.js'

const MOODS = { ember: 'warm', dusk: 'warm', spectrum: 'warm', aurora: 'cold', lagoon: 'cold', silk: 'cold', marble: 'calm', topo: 'calm' }

export default function ExploreStudio({ state, setState, actionsRef, setAmbient }) {
  const preset = EXPLORE_PRESETS.find((p) => p.key === state.preset) ?? EXPLORE_PRESETS[0]
  const formula = state.formula ?? preset.formula
  const palette = state.palette ?? preset.palette
  const [amp, setAmp] = useState(1)
  const [speed, setSpeed] = useState(preset.speed)
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [editMode, setEditMode] = useState('workflow')
  const [overloaded, setOverloaded] = useState(false)

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const fadeRef = useRef(null)
  const rendererRef = useRef(null)
  const live = useRef({ t: 0, sm: { amp: 1, speed: preset.speed }, pace: 1 })
  live.current.target = { amp, speed }
  live.current.playing = playing
  useIdleCursor(wrapRef)

  const compiled = useMemo(() => compile(formula, FIELD_VARS, PER_PIXEL), [formula])
  const lastGood = useRef(null)
  if (compiled.ok) lastGood.current = compiled.fn
  live.current.fn = lastGood.current

  useEffect(() => {
    rendererRef.current = new FieldRenderer(canvasRef.current)
    rendererRef.current.onOverload = setOverloaded
  }, [])
  // an edited formula gets a fresh chance after being paused
  useEffect(() => { rendererRef.current?.resetGuard() }, [formula])

  const first = useRef(true)
  useEffect(() => {
    if (!first.current) crossfade(canvasRef.current, fadeRef.current, 1200)
    first.current = false
    rendererRef.current.configure({ kind: preset.kind, palette, map: preset.map, bands: preset.bands })
    setSpeed((s) => s)
  }, [preset.key, palette])

  useEffect(() => { setSpeed(preset.speed) }, [preset.key])
  useEffect(() => { setAmbient(MOODS[palette] ?? 'calm', amp * 0.4) }, [palette, amp, setAmbient])

  useEffect(() => {
    let raf, last = performance.now(), lastReport = 0
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current
      L.sm.amp = ease(L.sm.amp, L.target.amp, dt, 0.6)
      L.sm.speed = ease(L.sm.speed, L.target.speed, dt, 0.6)
      L.pace = ease(L.pace, L.playing ? 1 : 0, dt, 0.35)
      L.t += dt * L.sm.speed * L.pace
      if (L.fn && (L.pace > 0.01 || now - lastReport > 500)) {
        try { rendererRef.current.frame(L.fn, L.t, L.sm.amp) } catch { /* skip frame */ }
      }
      if (now - lastReport > 100) { setTime(L.t); lastReport = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  actionsRef.current = {
    png: () => canvasRef.current?.toDataURL('image/png'),
    fullscreen: () => {
      if (!document.fullscreenElement) wrapRef.current?.requestFullscreen?.()
      else document.exitFullscreen?.()
    },
    togglePlay: () => setPlaying((p) => !p),
    reset: () => { crossfade(canvasRef.current, fadeRef.current, 700); live.current.t = 0 },
    canvas: () => canvasRef.current,
    smooth: true,
    name: preset.name,
  }

  const choose = (p) => setState({ preset: p.key })
  const edited = state.formula && state.formula !== preset.formula

  return (
    <div className={`studio explore ${drawer ? 'drawer-open' : ''}`}>
      <div className="explore-layout">
        <aside className="motions" aria-label="Formula artworks">
          <h3>Living formulas</h3>
          {EXPLORE_PRESETS.map((p) => (
            <button key={p.key} className={`motion ${p.key === preset.key ? 'on' : ''}`} onClick={() => choose(p)}>
              <span className="m-name">{p.name}<em>{p.kind}</em></span>
              <span className="m-desc">{p.blurb}</span>
            </button>
          ))}
        </aside>

        <main className="stage-wrap">
          <div className="stage explore-stage" ref={wrapRef}>
            <div className="canvas-stack fill">
              <canvas ref={canvasRef} className="smooth" aria-label={`${preset.name}, a living formula`} />
              <canvas ref={fadeRef} className="fade smooth" aria-hidden />
              {overloaded && <div className="overload" role="status">This formula is too heavy to draw smoothly, so it's paused. Simplify it or pick another living formula.</div>}
            </div>
          </div>
        </main>

        <aside className="inspector">
          <button className="ghost panel-toggle wide" onClick={() => setDrawer(true)}>
            <svg viewBox="0 0 16 16" aria-hidden><path d="M2 3h12v10H2zM9 3v10" /></svg>
            Edit the formula
          </button>
          <section>
            <h3>Palette</h3>
            <div className="field-palettes">
              {Object.entries(PALETTES).filter(([, p]) => !p.hidden).map(([k, p]) => (
                <button key={k} className={palette === k ? 'on' : ''} onClick={() => setState({ ...state, palette: k })} title={p.name}>
                  <span style={{ background: `linear-gradient(90deg, ${p.stops.join(', ')})` }} />
                  {p.name}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>Feel</h3>
            <Slider label="Strength" value={amp} min={0} max={2.5} step={0.01} onChange={setAmp} hint="amp" />
            <Slider label="Speed" value={speed} min={0.05} max={3} step={0.01} onChange={setSpeed} hint="time scale" />
          </section>
        </aside>

      {drawer && (
      <section className="drawer open side">
        <div className="drawer-head">
          <h3>The formula</h3>
          <button className="close" onClick={() => setDrawer(false)} aria-label="Close formula editor">×</button>
        </div>
        <div className="drawer-head second">
          <span className="drawer-sub">
            {preset.kind === 'flow' ? 'Gives the direction each particle travels, in radians' : preset.kind === 'contour' ? 'Lines are drawn where the value crosses a step' : 'The value at each point picks a colour from the palette'}
            {edited ? ' · edited' : ''}
          </span>
          <div className="seg small" role="radiogroup" aria-label="Editing mode">
            {[['workflow', 'Blocks'], ['expression', 'Expression']].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={editMode === k} className={editMode === k ? 'on' : ''} onClick={() => { setEditMode(k); setDrawer(true) }}>{label}</button>
            ))}
          </div>
          {edited && <button className="link" onClick={() => setState({ preset: preset.key, palette: state.palette })}>Reset</button>}
        </div>
        {drawer && (
          <div className="drawer-body">
            {editMode === 'expression' ? (
              <div className="rows single">
                <FormulaRow def={{ label: preset.name, unit: preset.kind, vars: FIELD_VARS, help: 'x y from −1 to 1 · r a distance & angle · noise(x, y) for organic shapes' }}
                  value={formula} result={compiled} onChange={(v) => setState({ ...state, formula: v })} />
              </div>
            ) : (
              <div className="wf-wrap">
                <WorkflowEditor key={preset.key} value={formula} vars={FIELD_VARS} varLabels={FIELD_VAR_LABELS} outputLabel={preset.kind === 'flow' ? 'Direction' : 'Value'}
                  onChange={(v) => setState({ ...state, formula: v })} sampleEnv={{ x: 0.3, y: -0.2, r: 0.36, a: -0.6, amp, t: time }} />
              </div>
            )}
          </div>
        )}
        <div className="side-feel">
          <Slider label="Strength" value={amp} min={0} max={2.5} step={0.01} onChange={setAmp} />
          <Slider label="Speed" value={speed} min={0.05} max={3} step={0.01} onChange={setSpeed} />
        </div>
      </section>
      )}
      </div>

      <Transport playing={playing} time={time} onToggle={() => setPlaying((p) => !p)} onReset={actionsRef.current.reset} right={`${preset.kind} · ${PALETTES[palette].name}`} />
    </div>
  )
}
