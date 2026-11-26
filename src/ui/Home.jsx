import React, { useEffect, useRef } from 'react'
import { FieldRenderer } from '../explore/fields.js'
import { compile } from '../engine/expr.js'
import { FIELD_VARS } from '../explore/fields.js'
import { EXPERIENCES } from '../gallery/experiences.js'
import { ExperienceCard } from './Gallery.jsx'

const STEPS = [
  { tag: 'Step one', tone: 'teal', title: 'Draw', view: 'draw', text: 'Pencil, fill, line, shapes, mirror and a colour palette. Or write it with a tiny drawing language, or type a word.' },
  { tag: 'Step two', tone: 'red', title: 'Animate', view: 'animate', text: 'Pick a way to move: sway, ripple, breathe, dissolve. Every pixel follows the formula, as blocks or as maths.' },
  { tag: 'Step three', tone: 'amber', title: 'Explore', view: 'explore', text: 'Turn pure formulas into full-screen living art: liquid marble, contours, aurora and silk ribbons.' },
]

// A slow, barely-there field behind the hero.
function HeroBackdrop() {
  const ref = useRef(null)
  useEffect(() => {
    const r = new FieldRenderer(ref.current)
    r.configure({ kind: 'field', palette: 'home', map: 'clamp' })
    const fn = compile('0.5 + 0.5 * noise(x * 0.9 + t * 0.03, y * 0.9 - t * 0.02) + 0.25 * x', FIELD_VARS).fn
    let raf, t = 0, last = performance.now(), frame = 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const loop = (now) => {
      t += (now - last) / 1000
      last = now
      if (frame++ % 3 === 0) { try { r.frame(fn, t, 1) } catch { /* skip frame */ } }
      if (!reduce) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="hero-bg" aria-hidden />
}

export default function Home({ onNavigate, onOpen }) {
  return (
    <div className="page home">
      <section className="hero">
        <HeroBackdrop />
        <div className="hero-inner">
          <p className="eyebrow">MORPH · a creative coding studio</p>
          <h1>Every pixel<br />is programmable.</h1>
          <p className="lede">
            Draw pixel art with real tools, or write it as code. Then bring it to life with mathematics.
            Watch a still drawing sway, ripple, dissolve and reassemble, driven by formulas you write or build from blocks.
          </p>
          <div className="cta">
            <button className="primary big" onClick={() => onNavigate('draw')}>Start drawing</button>
            <button className="ghost big" onClick={() => onNavigate('explore')}>Explore patterns</button>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <button key={s.title} className="step" onClick={() => onNavigate(s.view)}>
                <span className={`tag ${s.tone}`}>{s.tag}</span>
                <span className="step-title">{s.title}</span>
                <span className="step-text">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="home-gallery">
        <div className="section-head">
          <h2>What you can make</h2>
          <button className="link" onClick={() => onNavigate('gallery')}>See the whole gallery →</button>
        </div>
        <div className="xgrid">
          {EXPERIENCES.slice(0, 6).map((e) => <ExperienceCard key={e.key} exp={e} onOpen={onOpen} />)}
        </div>
      </section>
    </div>
  )
}
