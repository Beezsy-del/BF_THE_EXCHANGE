import React, { useEffect, useMemo, useRef, useState } from 'react'
import PixelEditor from './PixelEditor.jsx'
import CodeEditor from './CodeEditor.jsx'
import ArtCanvas from './ArtCanvas.jsx'
import { run } from '../lang/draw.js'
import { REFERENCE, ANIM_HELP, EXAMPLES as LANG_EXAMPLES } from '../lang/examples.js'
import { HELLO, BLOSSOM_CODE, OCEAN, JELLYFISH, BLOOM, SPIRAL } from '../gallery/programs.js'
import { emptyGrid, artToGrid, gridToArt, textToArt, GRADIENTS } from '../art/convert.js'
import { resize, toHex, fromHex } from '../art/paint.js'

const TOOLS = [
  { key: 'pencil', label: 'Pencil', key1: 'B', icon: 'M3 13l1-3 7-7 2 2-7 7zM10 4l2 2' },
  { key: 'eraser', label: 'Eraser', key1: 'E', icon: 'M6 13h7M3 10l5-5 4 4-4 4H6z' },
  { key: 'fill', label: 'Fill', key1: 'G', icon: 'M3 8l5-5 5 5-5 5zM13 11c0 1 .6 2 1 2s1-1 1-2l-1-2z' },
  { key: 'line', label: 'Line', key1: 'L', icon: 'M3 13L13 3' },
  { key: 'rect', label: 'Rectangle', key1: 'U', icon: 'M3 4h10v8H3z' },
  { key: 'ellipse', label: 'Ellipse', key1: 'O', icon: 'M8 3.5c3 0 5 2 5 4.5s-2 4.5-5 4.5S3 10.5 3 8s2-4.5 5-4.5z' },
  { key: 'picker', label: 'Pick colour', key1: 'I', icon: 'M10 3l3 3-6 6H4v-3zM9 4l3 3' },
]

const PALETTE = [
  '#0e0f1a', '#1b1d3a', '#2c2f5e', '#4b4f8c', '#7a7fc4', '#b9bdf0', '#ffffff', '#f3ead7',
  '#3a1f2b', '#6d3446', '#a8406f', '#df6e98', '#ffa8c3', '#ffdde9', '#4a1d06', '#97291f',
  '#d3512a', '#f58c45', '#ffd18b', '#fff3d6', '#0f2a2e', '#1f6b5c', '#3fae8a', '#9ef0b4',
  '#0f2f4e', '#2a6fb0', '#4fb0e6', '#c8f1ff', '#5b3a8c', '#9a7af2', '#7a5230', '#c99a4b',
]
const SIZES = [[32, 32], [48, 48], [64, 64], [96, 64], [128, 72]]

const heart = LANG_EXAMPLES.find((e) => e.key === 'heart').code
const rose = LANG_EXAMPLES.find((e) => e.key === 'rose').code
const CODE_EXAMPLES = [
  { name: 'Hello, square', code: HELLO },
  { name: 'Code blossom', code: BLOSSOM_CODE },
  { name: 'Ocean sunset', code: OCEAN },
  { name: 'Jellyfish', code: JELLYFISH },
  { name: 'Golden bloom', code: BLOOM },
  { name: 'Spectrum spiral', code: SPIRAL },
  { name: 'Heartbeat', code: heart },
  { name: 'Rose curve', code: rose },
]
const TEMPLATES = [
  { name: 'Blank canvas', code: null },
  { name: 'Cherry tree', code: BLOSSOM_CODE },
  { name: 'Jellyfish', code: JELLYFISH },
  { name: 'Ocean sunset', code: OCEAN },
  { name: 'Heart', code: heart },
]

const Icon = ({ d }) => <svg viewBox="0 0 16 16" aria-hidden><path d={d} /></svg>

export default function DrawStudio({ artwork, setArtwork, actionsRef, onAnimate }) {
  const origin = artwork?.origin ?? 'paint'
  const [tab, setTab] = useState(origin === 'text' ? 'type' : origin)

  // each tab keeps its own work
  const [grid, setGrid] = useState(() => (origin === 'paint' && artwork.grid ? artwork.grid : emptyGrid(64, 64)))
  const [code, setCode] = useState(() => (origin === 'code' ? artwork.code : BLOSSOM_CODE))
  const [text, setText] = useState(() => (origin === 'text' ? artwork.text : 'MORPH'))
  const [gradient, setGradient] = useState(() => (origin === 'text' ? artwork.gradient : 'neon'))

  // paint state
  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState(fromHex('#ffa8c3'))
  const [recent, setRecent] = useState([])
  const [brush, setBrush] = useState(1)
  const [mirror, setMirror] = useState(false)
  const [filled, setFilled] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const past = useRef([])
  const future = useRef([])
  const [, bump] = useState(0)

  // code state
  const [codeResult, setCodeResult] = useState(() => run(code))
  const lastCodeArt = useRef(codeResult.ok ? codeResult.art : null)
  const [showRef, setShowRef] = useState(false)

  const pushArt = (t = tab, g = grid) => {
    if (t === 'paint') setArtwork({ origin: 'paint', grid: g, art: gridToArt(g), name: 'My drawing' })
    if (t === 'code' && lastCodeArt.current) setArtwork({ origin: 'code', code, art: lastCodeArt.current, name: 'My program' })
    if (t === 'type') setArtwork({ origin: 'text', text, gradient, art: textToArt(text, { gradient }), name: `“${text}”` })
  }

  const switchTab = (t) => { setTab(t); pushArt(t) }

  // ----- paint -----
  const commitGrid = (data) => {
    const g = { ...grid, data }
    setGrid(g)
    pushArt('paint', g)
    if (!recent.includes(color)) setRecent((r) => [color, ...r].slice(0, 8))
  }
  const begin = () => { past.current.push(grid); if (past.current.length > 80) past.current.shift(); future.current = []; bump((n) => n + 1) }
  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(grid)
    setGrid(prev); pushArt('paint', prev); bump((n) => n + 1)
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(grid)
    setGrid(next); pushArt('paint', next); bump((n) => n + 1)
  }
  const replaceGrid = (g) => { begin(); setGrid(g); pushArt('paint', g) }
  // Image → pixel art. Only raster images (no SVG), at most 10 MB; decoded by
  // the browser into a bitmap, fitted to the canvas, then softly posterised.
  const imageRef = useRef(null)
  const [importMsg, setImportMsg] = useState(null)
  const importImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setImportMsg('Use a PNG, JPEG, WebP or GIF image.'); return }
    if (file.size > 10 * 1024 * 1024) { setImportMsg('That image is over 10 MB.'); return }
    try {
      const bmp = await createImageBitmap(file)
      const { w, h } = grid
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      const k = Math.min(w / bmp.width, h / bmp.height)
      const dw = Math.max(1, Math.round(bmp.width * k)), dh = Math.max(1, Math.round(bmp.height * k))
      g.imageSmoothingQuality = 'high'
      g.drawImage(bmp, Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh)
      bmp.close?.()
      const px = g.getImageData(0, 0, w, h).data
      const data = new Int32Array(w * h).fill(-1)
      const q = (v) => Math.min(255, Math.round(v / 17) * 17) // 16 levels per channel
      for (let i = 0; i < w * h; i++) {
        if (px[i * 4 + 3] < 128) continue
        data[i] = (q(px[i * 4]) << 16) | (q(px[i * 4 + 1]) << 8) | q(px[i * 4 + 2])
      }
      replaceGrid({ ...grid, data })
      setImportMsg(null)
    } catch {
      setImportMsg('That image couldn’t be read.')
    }
  }

  const loadTemplate = (tpl) => {
    if (!tpl.code) return replaceGrid(emptyGrid(grid.w, grid.h, grid.bg))
    const r = run(tpl.code)
    if (r.ok) replaceGrid(artToGrid(r.art))
  }

  useEffect(() => {
    if (tab !== 'paint') return
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = TOOLS.find((x) => x.key1.toLowerCase() === e.key.toLowerCase())
      if (t) setTool(t.key)
      if (e.key.toLowerCase() === 'm') setMirror((m) => !m)
      if (e.key === '[') setBrush((b) => Math.max(1, b - 1))
      if (e.key === ']') setBrush((b) => Math.min(4, b + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ----- code -----
  useEffect(() => {
    if (tab !== 'code') return
    const id = setTimeout(() => {
      const r = run(code)
      setCodeResult(r)
      if (r.ok) {
        lastCodeArt.current = r.art
        setArtwork({ origin: 'code', code, art: r.art, name: 'My program' })
      }
    }, 240)
    return () => clearTimeout(id)
  }, [code, tab])

  // ----- type -----
  const typeArt = useMemo(() => textToArt(text, { gradient }), [text, gradient])
  useEffect(() => {
    if (tab === 'type') setArtwork({ origin: 'text', text, gradient, art: typeArt, name: `“${text}”` })
  }, [typeArt, tab])

  const previewRef = useRef(null)
  actionsRef.current = {
    png: () => {
      if (tab !== 'paint') return previewRef.current?.png()
      const a = gridToArt(grid)
      const k = Math.max(1, Math.floor(1600 / a.width))
      const c = document.createElement('canvas')
      c.width = a.width * k; c.height = a.height * k
      const g = c.getContext('2d')
      g.fillStyle = `rgb(${a.background.join(',')})`
      g.fillRect(0, 0, c.width, c.height)
      for (const p of a.pixels) { g.fillStyle = `rgb(${p.r},${p.g},${p.b})`; g.fillRect(p.x * k, p.y * k, k, k) }
      return c.toDataURL('image/png')
    },
    fullscreen: tab !== 'paint' ? () => previewRef.current?.fullscreen() : undefined,
    name: tab === 'type' ? text : 'drawing',
  }

  const filledCount = useMemo(() => grid.data.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0), [grid])
  const opts = useMemo(() => ({ amp: 1, speed: 1, glow: 1, trails: false }), [])

  return (
    <div className={`studio draw tab-${tab}`}>
      <div className="studio-bar">
        <div className="seg" role="tablist" aria-label="How to draw">
          {[['paint', 'Paint'], ['code', 'Code'], ['type', 'Type']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => switchTab(k)}>{label}</button>
          ))}
        </div>
        <span className="bar-hint">
          {tab === 'paint' && `${grid.w} × ${grid.h} · ${filledCount.toLocaleString()} pixels`}
          {tab === 'code' && (codeResult.ok ? `${codeResult.art.pixels.length.toLocaleString()} pixels drawn by your program` : `Line ${codeResult.line}: ${codeResult.error}`)}
          {tab === 'type' && 'Type a word, pick a gradient, then animate it'}
        </span>
        <button className="primary" onClick={onAnimate}>Animate this →</button>
      </div>

      {tab === 'paint' && (
        <div className="paint-layout">
          <div className="toolrail" role="toolbar" aria-label="Tools">
            {TOOLS.map((t) => (
              <button key={t.key} className={tool === t.key ? 'on' : ''} onClick={() => setTool(t.key)} title={`${t.label} (${t.key1})`} aria-label={t.label} aria-pressed={tool === t.key}>
                <Icon d={t.icon} />
              </button>
            ))}
            <span className="rail-sep" />
            <button className={mirror ? 'on' : ''} onClick={() => setMirror((m) => !m)} title="Mirror (M)" aria-label="Mirror" aria-pressed={mirror}>
              <Icon d="M8 2v12M6 4L2 8l4 4zM10 4l4 4-4 4z" />
            </button>
            <button onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon d="M6 4L3 7l3 3M3 7h6a4 4 0 010 8H7" /></button>
            <button onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Y)" aria-label="Redo"><Icon d="M10 4l3 3-3 3M13 7H7a4 4 0 000 8h2" /></button>
          </div>

          <PixelEditor grid={grid} tool={tool} color={color} brush={brush} mirror={mirror} filled={filled} showGrid={showGrid}
            onBegin={begin} onCommit={commitGrid} onPick={(v) => { setColor(v); setTool('pencil') }} />

          <aside className="inspector">
            <section>
              <h3>Colour</h3>
              <div className="current-colour">
                <label className="swatch-big" style={{ background: toHex(color) }}>
                  <input type="color" value={toHex(color)} onChange={(e) => setColor(fromHex(e.target.value))} aria-label="Custom colour" />
                </label>
                <code>{toHex(color)}</code>
              </div>
              <div className="palette-grid">
                {PALETTE.map((h) => (
                  <button key={h} style={{ background: h }} className={toHex(color) === h ? 'on' : ''} onClick={() => setColor(fromHex(h))} aria-label={h} title={h} />
                ))}
              </div>
              {recent.length > 0 && (
                <div className="recent">
                  {recent.map((c) => <button key={c} style={{ background: toHex(c) }} onClick={() => setColor(c)} aria-label={toHex(c)} />)}
                </div>
              )}
            </section>
            <section>
              <h3>Brush</h3>
              <div className="seg small four">
                {[1, 2, 3, 4].map((b) => <button key={b} className={brush === b ? 'on' : ''} onClick={() => setBrush(b)}>{b}px</button>)}
              </div>
              <label className="toggle"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /> Filled shapes</label>
              <label className="toggle"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Show grid</label>
            </section>
            <section>
              <h3>Canvas</h3>
              <div className="row">
                <select value={`${grid.w}x${grid.h}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); replaceGrid(resize(grid, w, h)) }} aria-label="Canvas size">
                  {SIZES.map(([w, h]) => <option key={`${w}x${h}`} value={`${w}x${h}`}>{w} × {h}</option>)}
                  {!SIZES.some(([w, h]) => w === grid.w && h === grid.h) && <option value={`${grid.w}x${grid.h}`}>{grid.w} × {grid.h}</option>}
                </select>
                <label className="swatch-small" style={{ background: `rgb(${grid.bg.join(',')})` }} title="Background colour">
                  <input type="color" value={toHex((grid.bg[0] << 16) | (grid.bg[1] << 8) | grid.bg[2])}
                    onChange={(e) => { const v = fromHex(e.target.value); const g = { ...grid, bg: [(v >> 16) & 255, (v >> 8) & 255, v & 255] }; setGrid(g); pushArt('paint', g) }} aria-label="Background colour" />
                </label>
              </div>
              <select onChange={(e) => { const t = TEMPLATES[+e.target.value]; e.target.value = ''; if (t) loadTemplate(t) }} defaultValue="" aria-label="Start from">
                <option value="" disabled>Start from…</option>
                {TEMPLATES.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
              </select>
              <button className="ghost wide-btn" onClick={() => imageRef.current?.click()}>Import an image…</button>
              <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={importImage} />
              {importMsg && <p className="inline-msg">{importMsg}</p>}
            </section>
          </aside>
        </div>
      )}

      {tab === 'code' && (
        <div className="code-layout">
          <section className="code-pane">
            <div className="code-head">
              <select onChange={(e) => { const ex = CODE_EXAMPLES[+e.target.value]; e.target.value = ''; if (ex) setCode(ex.code) }} defaultValue="" aria-label="Load an example">
                <option value="" disabled>Load an example…</option>
                {CODE_EXAMPLES.map((ex, i) => <option key={ex.name} value={i}>{ex.name}</option>)}
              </select>
              <button className={`help ${showRef ? 'on' : ''}`} onClick={() => setShowRef((s) => !s)} aria-expanded={showRef}>Commands</button>
            </div>
            {showRef && (
              <div className="reference">
                {REFERENCE.map(([cmd, desc]) => <div key={cmd} className="ref-row"><code>{cmd}</code><span>{desc}</span></div>)}
                <p className="ref-anim">{ANIM_HELP}</p>
              </div>
            )}
            <CodeEditor value={code} onChange={setCode} errorLine={codeResult.ok ? null : codeResult.line} />
            <div className={`code-status ${codeResult.ok ? '' : 'bad'}`}>
              <span className={codeResult.ok ? 'ok-dot' : 'bad-dot'} />
              {codeResult.ok ? 'Running' : `Line ${codeResult.line}: ${codeResult.error}`}
              {!codeResult.ok && <span className="keep">showing last working version</span>}
            </div>
          </section>
          <div className="preview">
            {lastCodeArt.current && <ArtCanvas ref={previewRef} art={lastCodeArt.current} opts={opts} label="Your program's artwork" />}
          </div>
        </div>
      )}

      {tab === 'type' && (
        <div className="type-layout">
          <div className="preview"><ArtCanvas ref={previewRef} art={typeArt} opts={opts} label={`The word ${text}`} /></div>
          <aside className="inspector">
            <section>
              <h3>Word</h3>
              <input className="text-input" value={text} maxLength={14} onChange={(e) => setText(e.target.value)} aria-label="Word to draw" />
            </section>
            <section>
              <h3>Gradient</h3>
              <div className="gradients">
                {Object.keys(GRADIENTS).map((g) => (
                  <button key={g} className={gradient === g ? 'on' : ''} onClick={() => setGradient(g)}
                    style={{ background: `linear-gradient(90deg, ${GRADIENTS[g].map(([h, s, l]) => `hsl(${h} ${s}% ${l}%)`).join(', ')})` }}>
                    <span>{g}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
