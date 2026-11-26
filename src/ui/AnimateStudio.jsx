import React, { useEffect, useMemo, useRef, useState } from 'react'
import ArtCanvas from './ArtCanvas.jsx'
import Slider from './Slider.jsx'
import Transport from './Transport.jsx'
import FormulaRow from './FormulaRow.jsx'
import WorkflowEditor from '../workflow/WorkflowEditor.jsx'
import { compile } from '../engine/expr.js'
import { MOTIONS, MOTION_PROPS, MOTION_VARS, MOTION_VAR_LABELS, motionByKey } from '../animate/motions.js'
import { evolve } from '../animate/evolve.js'

const neutral = Object.fromEntries(MOTION_PROPS.map((p) => [p.key, p.neutral]))

// compile a set of motion sources into renderer functions (skipping neutral ones)
function toFx(src) {
  const fx = {}
  for (const p of MOTION_PROPS) {
    const s = (src[p.key] ?? p.neutral).trim()
    if (s === p.neutral) continue
    const r = compile(s, MOTION_VARS)
    if (r.ok) fx[p.key] = r.fn
  }
  return fx
}

function EvolveGrid({ art, variants, mode, onPick, onAgain, onClose }) {
  const opts = useMemo(() => ({ amp: 1, speed: 1, glow: 1, trails: false }), [])
  const fxs = useMemo(() => variants.map((v) => toFx(v.sources)), [variants])
  return (
    <div className="evolve">
      <div className="evolve-head">
        <span>Four children of this motion. Pick a favourite, or roll again.</span>
        <button className="ghost small" onClick={onAgain}>Roll again</button>
        <button className="link" onClick={onClose}>Cancel</button>
      </div>
      <div className="evolve-grid">
        {variants.map((v, i) => (
          <button key={v.seed} className="evolve-card" onClick={() => onPick(v)}>
            <ArtCanvas art={art} motionFx={fxs[i]} mode={mode} opts={opts} interactive={false} label={`Variant ${i + 1}`} />
            <span className="evolve-label">Variant {i + 1} · use this</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AnimateStudio({ artwork, motion, setMotion, actionsRef, onEditPixels, onEditCode, setAmbient }) {
  const art = artwork?.art
  const hasOwn = !!art && Object.keys(art.animations ?? {}).length > 0
  const key = motion.key === 'original' && !hasOwn ? 'breeze' : motion.key
  const preset = key === 'original' ? null : motionByKey(key) ?? MOTIONS[0]

  const [opts, setOpts] = useState({ amp: 1, speed: 1, glow: 1, trails: true })
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [editMode, setEditMode] = useState('workflow')
  const [prop, setProp] = useState('dx')
  const [variants, setVariants] = useState(null)
  const canvasRef = useRef(null)

  // formula sources for the selected motion (user edits override the preset)
  const sources = useMemo(() => {
    if (!preset) return null
    return { ...neutral, ...preset.formulas, ...(motion.custom ?? {}) }
  }, [preset, motion.custom])

  const lastGood = useRef({})
  const compiled = useMemo(() => {
    if (!sources) return null
    const out = {}
    for (const p of MOTION_PROPS) {
      const r = compile(sources[p.key], MOTION_VARS)
      if (r.ok) lastGood.current[p.key] = r.fn
      out[p.key] = r
    }
    return out
  }, [sources])

  const motionFx = useMemo(() => {
    if (!compiled) return null
    const fx = {}
    for (const p of MOTION_PROPS) {
      const src = sources[p.key].trim()
      if (src === p.neutral) continue // skip work the renderer doesn't need
      fx[p.key] = lastGood.current[p.key] ?? (() => (p.key === 'bright' ? 1 : 0))
    }
    return fx
  }, [compiled])

  useEffect(() => { setAmbient('calm', opts.amp * 0.5) }, [opts.amp, setAmbient])

  const choose = (m) => setMotion({ key: m.key, mode: m.mode ?? motion.mode })
  const chooseOriginal = () => setMotion({ key: 'original', mode: motion.mode })
  const editFormula = (k, v) => setMotion({ ...motion, key, custom: { ...(motion.custom ?? {}), [k]: v } })
  const mode = motion.mode ?? 'pixels'

  actionsRef.current = {
    png: () => canvasRef.current?.png(),
    fullscreen: () => canvasRef.current?.fullscreen(),
    togglePlay: () => setPlaying((p) => !p),
    reset: () => canvasRef.current?.reset(),
    canvas: () => canvasRef.current?.canvas(),
    smooth: (motion.mode ?? 'pixels') === 'particles',
    name: artwork?.name ?? 'artwork',
  }

  if (!art) return <div className="empty-state">Draw something first, then come back to animate it.</div>

  const propDef = MOTION_PROPS.find((p) => p.key === prop)
  const edited = !!motion.custom && key === motion.key

  return (
    <div className={`studio animate ${drawer ? 'drawer-open' : ''}`}>
      <div className="studio-bar">
        <div className="bar-title">
          <span className="eyebrow-sm">Animating</span>
          <strong>{artwork.name ?? 'Your artwork'}</strong>
        </div>
        <div className="bar-links">
          <button className="ghost small" onClick={onEditPixels}>Edit pixels</button>
          {artwork.origin === 'code' && <button className="ghost small" onClick={onEditCode}>Edit code</button>}
          {artwork.origin === 'text' && <button className="ghost small" onClick={onEditCode}>Change word</button>}
        </div>
        <button className={`ghost panel-toggle ${drawer ? 'on' : ''}`} onClick={() => setDrawer((d) => !d)} aria-expanded={drawer}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M2 3h12v10H2zM9 3v10" /></svg>
          {drawer ? 'Hide motion editor' : 'Edit the motion'}
        </button>
        <div className="seg" role="radiogroup" aria-label="Render as">
          {['pixels', 'particles'].map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMotion({ ...motion, mode: m })}>
              {m === 'pixels' ? 'Pixels' : 'Particles'}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-layout">
        <aside className="motions" aria-label="Ways to animate">
          <h3>Ways to animate</h3>
          {hasOwn && (
            <button className={`motion ${key === 'original' ? 'on' : ''}`} onClick={chooseOriginal}>
              <span className="m-name">Its own motion</span>
              <span className="m-desc">The ANIMATE blocks written in its code</span>
            </button>
          )}
          {MOTIONS.map((m) => (
            <button key={m.key} className={`motion ${key === m.key ? 'on' : ''}`} onClick={() => choose(m)}>
              <span className="m-name">{m.name}{m.mode === 'particles' && <em>particles</em>}</span>
              <span className="m-desc">{m.desc}</span>
            </button>
          ))}
        </aside>

        <main className="stage-wrap">
          <ArtCanvas ref={canvasRef} art={art} motionFx={motionFx} mode={mode} opts={opts} playing={playing} onTime={setTime}
            label={`${artwork.name ?? 'Artwork'}, animated`} />
        </main>

        <aside className="inspector">
          <section>
            <h3>Feel</h3>
            <Slider label="Strength" value={opts.amp} min={0} max={3} step={0.01} onChange={(v) => setOpts((o) => ({ ...o, amp: v }))} hint="amp" />
            <Slider label="Speed" value={opts.speed} min={0.1} max={3} step={0.01} onChange={(v) => setOpts((o) => ({ ...o, speed: v }))} hint="time scale" />
            {mode === 'particles' && (
              <>
                <Slider label="Glow" value={opts.glow} min={0} max={3} step={0.01} onChange={(v) => setOpts((o) => ({ ...o, glow: v }))} hint="bloom" />
                <label className="toggle"><input type="checkbox" checked={opts.trails} onChange={(e) => setOpts((o) => ({ ...o, trails: e.target.checked }))} /> Motion trails</label>
              </>
            )}
          </section>
          {mode === 'particles' && (
            <section className="note">
              <h3>Touch it</h3>
              <p>Move the mouse through the artwork to push pixels aside. Click to scatter them and they find their way home.</p>
            </section>
          )}
        </aside>

      {drawer && (
      <section className="drawer open side">
        <div className="drawer-head">
          <h3>Behind the motion</h3>
          <button className="close" onClick={() => setDrawer(false)} aria-label="Close motion editor">×</button>
        </div>
        <div className="drawer-head second">
          {preset && (
            <>
              <span className="drawer-sub">{preset.name}{edited ? ' · edited' : ''}: every pixel follows these formulas</span>
              <div className="seg small" role="radiogroup" aria-label="Editing mode">
                {[['workflow', 'Blocks'], ['expression', 'Expression']].map(([k, label]) => (
                  <button key={k} role="radio" aria-checked={editMode === k} className={editMode === k ? 'on' : ''}
                    onClick={() => { setEditMode(k); setDrawer(true) }}>{label}</button>
                ))}
              </div>
              <button className="ghost small evolve-btn" onClick={() => setVariants(evolve(sources, MOTION_VARS))} title="Generate four variations">✦ Evolve</button>
              {edited && <button className="link" onClick={() => setMotion({ key, mode })}>Reset to preset</button>}
            </>
          )}
          {!preset && <span className="drawer-sub">This motion is written in the artwork's code, inside its ANIMATE blocks.</span>}
        </div>
        {drawer && preset && (
          <div className="drawer-body">
            {variants ? (
              <EvolveGrid art={art} variants={variants} mode={mode}
                onPick={(v) => { setMotion({ key, mode, custom: v.sources }); setVariants(null) }}
                onAgain={() => setVariants(evolve(sources, MOTION_VARS))}
                onClose={() => setVariants(null)} />
            ) : editMode === 'expression' ? (
              <div className="rows">
                {MOTION_PROPS.map((p) => (
                  <FormulaRow key={p.key} def={{ ...p, vars: MOTION_VARS, help: 'r a = distance & angle from centre · amp = strength' }}
                    value={sources[p.key]} result={compiled[p.key]} onChange={(v) => editFormula(p.key, v)} />
                ))}
              </div>
            ) : (
              <div className="wf-wrap">
                <div className="wf-tabs" role="tablist">
                  {MOTION_PROPS.map((p) => (
                    <button key={p.key} role="tab" aria-selected={prop === p.key} className={prop === p.key ? 'on' : ''} onClick={() => setProp(p.key)}>
                      <span className={`dot ${compiled[p.key].ok ? '' : 'bad'} ${sources[p.key].trim() === p.neutral ? 'idle' : ''}`} />{p.label}
                    </button>
                  ))}
                </div>
                <WorkflowEditor key={`${key}-${prop}`} value={sources[prop]} vars={MOTION_VARS} varLabels={MOTION_VAR_LABELS}
                  outputLabel={propDef.label} onChange={(v) => editFormula(prop, v)}
                  sampleEnv={{ x: art.width * 0.3, y: art.height * 0.3, seed: 0.37, cx: art.width / 2, cy: art.height / 2, r: 12, a: 0.8, mx: -1000, my: -1000, amp: opts.amp, W: art.width, H: art.height, t: time }} />
              </div>
            )}
          </div>
        )}
        {drawer && !preset && (
          <div className="drawer-body note-body">
            <p>Open the code to change it, or pick one of the ways to animate on the left to edit its formulas here as blocks or maths.</p>
            {artwork.origin === 'code' && <button className="primary" onClick={onEditCode}>Open the code</button>}
          </div>
        )}
        <div className="side-feel">
          <Slider label="Strength" value={opts.amp} min={0} max={3} step={0.01} onChange={(v) => setOpts((o) => ({ ...o, amp: v }))} />
          <Slider label="Speed" value={opts.speed} min={0.1} max={3} step={0.01} onChange={(v) => setOpts((o) => ({ ...o, speed: v }))} />
        </div>
      </section>
      )}
      </div>

      <Transport playing={playing} time={time} onToggle={() => setPlaying((p) => !p)} onReset={() => canvasRef.current?.reset()}
        hint={mode === 'particles' ? 'move through the art · click to scatter' : null}
        right={`${art.width} × ${art.height} · ${art.pixels.length.toLocaleString()} pixels`} />
    </div>
  )
}
