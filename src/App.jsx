import React, { useCallback, useEffect, useRef, useState } from 'react'
import Home from './ui/Home.jsx'
import DrawStudio from './ui/DrawStudio.jsx'
import AnimateStudio from './ui/AnimateStudio.jsx'
import ExploreStudio from './ui/ExploreStudio.jsx'
import Gallery from './ui/Gallery.jsx'
import SceneWorkspace from './ui/SceneWorkspace.jsx'
import { run } from './lang/draw.js'
import { BLOSSOM_CODE } from './gallery/programs.js'
import { textToArt, artToGrid, gridToArt } from './art/convert.js'
import { Ambient } from './audio/ambient.js'
import { cleanSaved, parseProjectFile, serialiseProject, MAX_PROJECT_BYTES, cleanScene } from './app/project.js'
import { recordCanvas, canRecord } from './app/record.js'
import ErrorBoundary from './ui/ErrorBoundary.jsx'

const NAV = [
  { key: 'home', label: 'Home' },
  { key: 'draw', label: 'Draw' },
  { key: 'animate', label: 'Animate' },
  { key: 'explore', label: 'Explore' },
  { key: 'gallery', label: 'Gallery' },
]
const STORE = 'morph.v2'

// Saved state is validated before use: a damaged entry is ignored, never trusted.
function load() {
  try { return cleanSaved(JSON.parse(localStorage.getItem(STORE))) } catch { return {} }
}

// Rebuild an artwork's pixels from what made it (code, text or a painted grid).
export function makeArtwork(spec) {
  try { return buildArtwork(spec) } catch { return null }
}

function buildArtwork(spec) {
  if (!spec) return null
  if (spec.origin === 'code') {
    const r = run(spec.code)
    return r.ok ? { ...spec, art: r.art } : null
  }
  if (spec.origin === 'text') return { ...spec, art: textToArt(spec.text, { gradient: spec.gradient }) }
  if (spec.origin === 'paint') {
    const grid = { ...spec.grid, data: Int32Array.from(spec.grid.data) }
    return { ...spec, grid, art: gridToArt(grid) }
  }
  return null
}

function serialise(a) {
  if (!a) return null
  const { art, ...rest } = a
  return rest.grid ? { ...rest, grid: { ...rest.grid, data: Array.from(rest.grid.data) } } : rest
}

export default function App() {
  const saved = useRef(load()).current
  const [view, setView] = useState(saved.view ?? 'home')
  const [artwork, setArtwork] = useState(() =>
    (saved.artwork && makeArtwork(saved.artwork)) ?? makeArtwork({ origin: 'code', code: BLOSSOM_CODE, name: 'Code Blossom' }))
  const [motion, setMotion] = useState(saved.motion ?? { key: 'original', mode: 'pixels' })
  const [explore, setExplore] = useState(saved.explore ?? { preset: 'marble' })
  const [scene, setScene] = useState(() => saved.scene ?? cleanScene({}))
  const drawDrafts = useRef(null)
  const openSequence = useRef(0)
  const [sound, setSound] = useState(false)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState(null)
  const [crashKey, setCrashKey] = useState(0)
  const ambient = useRef(null)
  const actionsRef = useRef({})
  const fileRef = useRef(null)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(id)
  }, [notice])

  // ----- project files -----
  const saveProject = () => {
    const current = view === 'draw' ? actionsRef.current.flush?.() : artwork
    if (!current) { setNotice('Fix the code error before saving this artwork.'); return }
    if (view === 'scene' && actionsRef.current.valid === false) { setNotice('Fix the scene formula errors before saving.'); return }
    const url = URL.createObjectURL(new Blob([serialiseProject(current, motion, explore, scene, view)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${(view === 'scene' ? 'Blossom Night' : current.name ?? 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}.morph.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    setNotice('Project saved')
  }
  const openProject = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const request = ++openSequence.current
    if (file.size > MAX_PROJECT_BYTES) { setNotice('That file is too large to be a MORPH project.'); return }
    let text
    try { text = await file.text() } catch { if (request === openSequence.current) setNotice('That file couldn’t be read.'); return }
    if (request !== openSequence.current) return
    const res = parseProjectFile(text)
    if (!res.ok) { setNotice(res.error); return }
    const a = makeArtwork(res.artwork)
    if (!a) { setNotice('The project’s artwork couldn’t be drawn.'); return }
    drawDrafts.current = null
    setArtwork(a)
    setMotion(res.motion)
    if (res.explore) setExplore(res.explore)
    if (res.scene) setScene(res.scene)
    setView(res.view)
    setNotice(`Opened “${a.name}”`)
  }

  // ----- video -----
  const record = () => {
    const src = actionsRef.current.canvas?.()
    if (!src || recording) return
    const ok = recordCanvas(src, { seconds: 6, name: `morph-${(actionsRef.current.name ?? 'art').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, smooth: !!actionsRef.current.smooth, onDone: (result) => { setRecording(false); setNotice(result.ok ? 'Video saved' : result.error ?? 'Recording failed. Please try again.') } })
    if (ok) { setRecording(true); setNotice('Recording 6 seconds…') }
    else setNotice('This browser can’t record video.')
  }

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify({ view, artwork: serialise(artwork), motion, explore, scene })) } catch { /* full or private */ }
    }, 400)
    return () => clearTimeout(id)
  }, [view, artwork, motion, explore, scene])

  const toggleSound = () => {
    ambient.current ??= new Ambient()
    if (sound) ambient.current.stop()
    else ambient.current.start()
    setSound(!sound)
  }
  const setAmbient = useCallback((mood, wind) => {
    ambient.current?.setMood(mood)
    if (wind !== undefined) ambient.current?.setWind(wind)
  }, [])

  // open a gallery experience in the studio that made it
  const openExperience = (exp) => {
    const o = exp.open
    if (o.view === 'explore') { setExplore({ preset: o.preset }); setView('explore'); return }
    if (o.view === 'scene') { setView('scene'); return }
    const spec = o.code
      ? { origin: 'code', code: o.code, name: exp.title }
      : { origin: 'text', text: o.text, gradient: o.gradient, name: exp.title }
    const a = makeArtwork(spec)
    if (a) { drawDrafts.current = null; setArtwork(a) }
    setMotion({ key: o.motion ?? 'original', mode: o.mode ?? 'pixels' })
    setView('animate')
  }

  const editPixels = () => {
    if (!artwork) return
    drawDrafts.current = null
    const grid = artToGrid(artwork.art)
    setArtwork({ origin: 'paint', grid, art: gridToArt(grid), name: artwork.name })
    setView('draw')
  }

  const exportPng = () => {
    const a = actionsRef.current
    const url = a.png?.()
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `morph-${(a.name ?? 'art').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`
    link.click()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, button, a, [role=button], [contenteditable=true]')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const a = actionsRef.current
      if (e.code === 'Space' && a.togglePlay) { e.preventDefault(); a.togglePlay() }
      if (e.key === 'f' && a.fullscreen) a.fullscreen()
      if (e.key === 'r' && a.reset) a.reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (view === 'home' || view === 'gallery') actionsRef.current = {} }, [view])

  const navigate = (next) => {
    if (view === 'draw' && next === 'animate' && !actionsRef.current.flush?.()) {
      setNotice('Fix the code error before animating this artwork.')
      return
    }
    setView(next)
  }
  const studio = view !== 'home'
  const navKey = view === 'scene' ? 'gallery' : view

  return (
    <div className={`app view-${view}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="MORPH home">
          <span className="mark" aria-hidden><i /><i /><i /><i /></span>
          MORPH
        </button>
        <nav className="nav" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.key} className={navKey === n.key ? 'on' : ''} aria-current={navKey === n.key ? 'page' : undefined}
              onClick={() => navigate(n.key)}>{n.label}</button>
          ))}
        </nav>
        <div className="actions">
          <button className={`ghost sound ${sound ? 'on' : ''}`} onClick={toggleSound} aria-pressed={sound} title="Ambient sound">
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M2 6h3l4-3v10l-4-3H2z" />
              {sound && <path className="wave" d="M11 5.5c1 .7 1 4.3 0 5M12.8 4c2 1.6 2 6.4 0 8" />}
            </svg>
            {sound ? 'Sound on' : 'Sound'}
          </button>
          <span className="act-sep" />
          <button className="ghost" onClick={() => fileRef.current?.click()} title="Open a .morph.json project">Open</button>
          <button className="ghost" onClick={saveProject} title="Save your artwork and motion as a project file">Save</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={openProject} />
          {studio && view !== 'gallery' && (
            <>
              <span className="act-sep" />
              <button className="ghost" onClick={() => actionsRef.current.fullscreen?.()} title="Present fullscreen (F)">Present</button>
              {canRecord() && view !== 'draw' && (
                <button className={`ghost rec ${recording ? 'on' : ''}`} onClick={record} disabled={recording} title="Record a 6-second video">
                  <span className="rec-dot" aria-hidden />{recording ? 'Recording…' : 'Record'}
                </button>
              )}
              <button className="primary" onClick={exportPng}>Export PNG</button>
            </>
          )}
        </div>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}

      <ErrorBoundary resetKey={`${view}-${crashKey}`} onHome={() => { setView('home'); setCrashKey((k) => k + 1) }}
        onReset={() => { try { localStorage.removeItem(STORE) } catch { /* ignore */ } location.reload() }}>
      <div className="view" key={view}>
        {view === 'home' && <Home onNavigate={setView} onOpen={openExperience} />}
        {view === 'gallery' && <Gallery onOpen={openExperience} />}
        {view === 'draw' && (
          <DrawStudio artwork={artwork} setArtwork={setArtwork} actionsRef={actionsRef} draftsRef={drawDrafts}
            onAnimate={(current) => { setMotion((m) => ({ ...m, key: current?.art?.animations && Object.keys(current.art.animations).length ? m.key : (m.key === 'original' ? 'breeze' : m.key) })); setView('animate') }} />
        )}
        {view === 'animate' && (
          <AnimateStudio artwork={artwork} motion={motion} setMotion={setMotion} actionsRef={actionsRef}
            onEditPixels={editPixels} onEditCode={() => { if (drawDrafts.current) drawDrafts.current.tab = artwork.origin === 'text' ? 'type' : 'code'; setView('draw') }} setAmbient={setAmbient} />
        )}
        {view === 'explore' && <ExploreStudio state={explore} setState={setExplore} actionsRef={actionsRef} setAmbient={setAmbient} />}
        {view === 'scene' && <SceneWorkspace state={scene} setState={setScene} actionsRef={actionsRef} setAccent={() => {}} setAmbient={setAmbient} onBack={() => setView('gallery')} />}
      </div>
      </ErrorBoundary>
    </div>
  )
}
