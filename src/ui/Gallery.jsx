import React, { useEffect, useState } from 'react'
import { EXPERIENCES } from '../gallery/experiences.js'
import { thumbFor } from './thumbs.js'

export function ExperienceCard({ exp, onOpen }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    // render previews after first paint so the page appears instantly
    let active = true
    const id = setTimeout(() => { thumbFor(exp).then(src => { if (active) setSrc(src) }) }, 30)
    return () => { active = false; clearTimeout(id) }
  }, [exp])
  return (
    <button className="xcard" onClick={() => onOpen(exp)}>
      <span className="xthumb">
        {src ? <img src={src} alt="" className={exp.open.view === 'explore' ? 'smooth' : ''} /> : <span className="xthumb-wait" />}
      </span>
      <span className="xbody">
        <span className="xcat">{exp.category}</span>
        <span className="xtitle">{exp.title}</span>
        <span className="xblurb">{exp.blurb}</span>
      </span>
    </button>
  )
}

export default function Gallery({ onOpen }) {
  return (
    <div className="page gallery">
      <div className="page-head">
        <p className="eyebrow">Gallery</p>
        <h1>Living artworks</h1>
        <p className="lede">Each piece was drawn with pixels or code and brought to life with formulas. Open one to see how it works, then make it yours.</p>
      </div>
      <div className="xgrid">
        {EXPERIENCES.map((e) => <ExperienceCard key={e.key} exp={e} onOpen={onOpen} />)}
      </div>
    </div>
  )
}
