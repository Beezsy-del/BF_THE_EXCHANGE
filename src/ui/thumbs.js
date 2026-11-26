// Still previews for gallery cards, rendered once and cached.

import { ArtRenderer } from '../lang/artRenderer.js'
import { run } from '../lang/draw.js'
import { textToArt } from '../art/convert.js'
import { FieldRenderer, EXPLORE_PRESETS } from '../explore/fields.js'
import { compile } from '../engine/expr.js'
import { FIELD_VARS } from '../explore/fields.js'
import { build } from '../scene/blossomNight.js'
import { PixelRenderer } from '../scene/renderer.js'
import { FORMULAS } from '../scene/formulas.js'

const cache = new Map()

function upscale(src, scale) {
  const c = document.createElement('canvas')
  c.width = src.width * scale
  c.height = src.height * scale
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

function artThumb(art, t, mode) {
  const c = document.createElement('canvas')
  const r = new ArtRenderer(c)
  r.setArt(art)
  r.setMode(mode)
  for (let i = 0; i < (mode === 'particles' ? 40 : 1); i++) r.frame(t, 1 / 60, { amp: 1, glow: 1, trails: false, mx: -1000, my: -1000 })
  return mode === 'particles' ? c.toDataURL('image/png') : upscale(c, Math.max(2, Math.round(360 / art.width)))
}

export function thumbFor(exp) {
  if (cache.has(exp.key)) return cache.get(exp.key)
  let url = null
  try {
    const o = exp.open
    if (o.view === 'scene') {
      const c = document.createElement('canvas')
      const r = new PixelRenderer(c)
      r.setScene(build('sakura', 0.6))
      const fx = {}
      for (const f of FORMULAS) fx[f.key] = compile(f.value, f.vars).fn
      r.setFormulas(fx)
      for (let i = 0; i < 160; i++) r.frame(i / 60, 1 / 60)
      url = upscale(c, 2)
    } else if (o.view === 'explore') {
      const p = EXPLORE_PRESETS.find((x) => x.key === o.preset)
      const c = document.createElement('canvas')
      const r = new FieldRenderer(c)
      r.configure({ kind: p.kind, palette: p.palette, map: p.map, bands: p.bands })
      const fn = compile(p.formula, FIELD_VARS).fn
      const frames = p.kind === 'flow' ? 140 : 1
      for (let i = 0; i < frames; i++) r.frame(fn, 2 + i / 60, 1)
      url = c.toDataURL('image/png')
    } else if (o.code) {
      const res = run(o.code)
      if (res.ok) url = artThumb(res.art, 2.5, 'pixels')
    } else if (o.text) {
      url = artThumb(textToArt(o.text, { gradient: o.gradient }), 0, 'pixels')
    }
  } catch { url = null }
  cache.set(exp.key, url)
  return url
}
