import React, { useEffect, useMemo, useRef, useState } from 'react'
import { compile, PER_PIXEL } from '../engine/expr.js'
import { FORMULAS, PRESETS, VAR_LABELS } from '../scene/formulas.js'
import WorkflowEditor from '../workflow/WorkflowEditor.jsx'
import { PALETTES } from '../scene/palettes.js'
import Stage from './Stage.jsx'
import FormulaRow from './FormulaRow.jsx'
import Slider from './Slider.jsx'
import Transport from './Transport.jsx'

const DEFAULT_PARAMS = { wind: 0.5, speed: 0.85, petals: 80, glow: 0.65 }

export default function SceneWorkspace({ actionsRef, setAccent, setAmbient = () => {}, onBack }) {
  const [palette, setPalette] = useState('sakura')
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [sources, setSources] = useState(() => Object.fromEntries(FORMULAS.map((f) => [f.key, f.value])))
  const [playing, setPlaying] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editMode, setEditMode] = useState('workflow')
  const [wfKey, setWfKey] = useState('sway')
  const [resetToken, setResetToken] = useState(0)
  const [time, setTime] = useState(0)
  const stageRef = useRef(null)
  const lastGood = useRef({})

  // Compile each formula once per edit; keep the last valid version on error.
  const compiled = useMemo(() => {
    const out = {}
    for (const f of FORMULAS) {
      const res = compile(sources[f.key], f.vars, PER_PIXEL)
      if (res.ok) lastGood.current[f.key] = res.fn
      out[f.key] = res
    }
    return out
  }, [sources])

  const fx = useMemo(() => {
    const o = {}
    for (const f of FORMULAS) o[f.key] = lastGood.current[f.key] ?? (() => 0)
    return o
  }, [compiled])

  useEffect(() => { setAccent(PALETTES[palette].blossom[3]) }, [palette, setAccent])
  useEffect(() => { setAmbient({ sakura: "calm", ember: "warm", frost: "cold" }[palette], params.wind) }, [palette, params.wind, setAmbient])

  actionsRef.current = {
    png: () => stageRef.current?.toPNG(),
    canvas: () => stageRef.current?.canvas(),
    fullscreen: () => stageRef.current?.fullscreen(),
    togglePlay: () => setPlaying((p) => !p),
    reset: () => setResetToken((n) => n + 1),
    name: `morph-${palette}`,
  }

  const errors = FORMULAS.filter((f) => !compiled[f.key].ok).length

  return (
    <div className={`ws ws-scene ${editorOpen ? 'split' : ''}`}>
      <aside className="panel left">
        {onBack && <button className="back" onClick={onBack}>← Gallery</button>}
        <section>
          <h3>Palette</h3>
          <div className="palettes">
            {Object.entries(PALETTES).map(([key, p]) => (
              <button key={key} className={`palette ${key === palette ? 'on' : ''}`} onClick={() => setPalette(key)}>
                <span className="swatches">
                  {[p.sky[1], p.sky[3], p.blossom[2], p.blossom[3], p.blossom[4]].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Mood</h3>
          <div className="chips">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button key={key} className="chip" onClick={() => setParams((cur) => ({ ...cur, ...p.params }))}>
                {p.name}
              </button>
            ))}
          </div>
        </section>
        <section className="about">
          <h3>How it works</h3>
          <p>The scene is drawn once. Every frame, the formulas below decide how each pixel moves. Edit any of them and the artwork responds instantly.</p>
        </section>
      </aside>

      <main className="stage-wrap">
        <Stage ref={stageRef} palette={palette} params={params} fx={fx} playing={playing} resetToken={resetToken} onTime={setTime} />
      </main>

      <aside className="panel right">
        <button className="ghost panel-toggle wide" onClick={() => setEditorOpen(true)}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M2 3h12v10H2zM9 3v10" /></svg>
          Edit the behaviours
        </button>
        <section>
          <h3>Parameters</h3>
          <Slider label="Wind" value={params.wind} min={0} max={2} step={0.01} onChange={(v) => setParams((p) => ({ ...p, wind: v }))} hint="wind" />
          <Slider label="Speed" value={params.speed} min={0.1} max={3} step={0.01} onChange={(v) => setParams((p) => ({ ...p, speed: v }))} hint="time scale" />
          <Slider label="Petals" value={params.petals} min={0} max={240} step={1} onChange={(v) => setParams((p) => ({ ...p, petals: v }))} hint="count" format={(v) => Math.round(v)} />
          <Slider label="Glow" value={params.glow} min={0} max={1.2} step={0.01} onChange={(v) => setParams((p) => ({ ...p, glow: v }))} hint="bloom" />
        </section>
      </aside>

      <section className={`editor ${editorOpen ? '' : 'closed'} ${editMode === 'workflow' ? 'is-wf' : ''}`}>
        <div className="editor-head">
          <h3>Behaviours</h3>
          <button className="close" onClick={() => setEditorOpen(false)} aria-label="Close behaviours editor">×</button>
          <div className="seg small" role="radiogroup" aria-label="Editing mode">
            {[['workflow', 'Workflow'], ['expression', 'Expression']].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={editMode === k} className={editMode === k ? 'on' : ''}
                onClick={() => { setEditMode(k); setEditorOpen(true) }}>{label}</button>
            ))}
          </div>
          <span className={`status ${errors ? 'bad' : ''}`}>
            {errors ? `${errors} formula${errors > 1 ? 's' : ''} need${errors > 1 ? '' : 's'} attention, showing last valid version` : 'All formulas valid'}
          </span>
          <button className="link" onClick={() => setSources(Object.fromEntries(FORMULAS.map((f) => [f.key, f.value])))}>
            Restore defaults
          </button>
        </div>
        {editMode === 'expression' ? (
          <div className="rows">
            {FORMULAS.map((f) => (
              <FormulaRow key={f.key} def={f} value={sources[f.key]} result={compiled[f.key]}
                onChange={(v) => setSources((s) => ({ ...s, [f.key]: v }))} />
            ))}
          </div>
        ) : (
          <div className="wf-wrap">
            <div className="wf-tabs" role="tablist">
              {FORMULAS.map((f) => (
                <button key={f.key} role="tab" aria-selected={wfKey === f.key} className={wfKey === f.key ? 'on' : ''}
                  onClick={() => setWfKey(f.key)}>
                  <span className={`dot ${compiled[f.key].ok ? '' : 'bad'}`} />{f.label}
                </button>
              ))}
            </div>
            {(() => {
              const f = FORMULAS.find((x) => x.key === wfKey)
              return (
                <>
                  <WorkflowEditor
                    key={f.key}
                    value={sources[f.key]}
                    vars={f.vars}
                    varLabels={VAR_LABELS}
                    outputLabel={f.label}
                    onChange={(v) => setSources((s) => ({ ...s, [f.key]: v }))}
                    sampleEnv={{ x: 120, y: 60, h: 0.8, seed: 37.3, d: 12, wind: params.wind, t: time }}
                  />
                  <div className="wf-expr">
                    <span className="wf-expr-label">The same behaviour, as an expression</span>
                    <FormulaRow def={f} value={sources[f.key]} result={compiled[f.key]}
                      onChange={(v) => setSources((s) => ({ ...s, [f.key]: v }))} />
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </section>

      <Transport playing={playing} time={time} onToggle={() => setPlaying((p) => !p)} onReset={() => setResetToken((n) => n + 1)}
        right="320 × 180 · pixel" />
    </div>
  )
}
