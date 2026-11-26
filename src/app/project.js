// Everything MORPH loads from outside the running app — saved browser state
// and opened .morph.json project files — passes through here. Anything that
// isn't exactly the expected shape is dropped, so a damaged or malicious file
// can't crash the app, freeze it, or smuggle in unexpected values.

import { MAX_SOURCE_LENGTH } from '../lang/draw.js'
import { MAX_EXPR_LENGTH } from '../engine/expr.js'
import { GRADIENTS } from '../art/convert.js'
import { MOTIONS } from '../animate/motions.js'
import { EXPLORE_PRESETS, PALETTES } from '../explore/fields.js'

export const PROJECT_FORMAT = 'morph-project'
export const MAX_PROJECT_BYTES = 2 * 1024 * 1024
const VIEWS = ['home', 'draw', 'animate', 'explore', 'gallery']
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null)
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null)

function cleanGrid(g) {
  if (!isObj(g)) return null
  const w = int(g.w, 4, 320), h = int(g.h, 4, 180)
  if (w === null || h === null) return null
  if (!Array.isArray(g.bg) || g.bg.length !== 3 || !g.bg.every((c) => int(c, 0, 255) !== null)) return null
  if (!Array.isArray(g.data) || g.data.length !== w * h) return null
  const data = new Int32Array(w * h)
  for (let i = 0; i < data.length; i++) {
    const v = g.data[i]
    if (int(v, -1, 0xffffff) === null) return null
    data[i] = v
  }
  return { w, h, bg: g.bg.slice(), data }
}

export function cleanArtworkSpec(a) {
  if (!isObj(a)) return null
  const name = str(a.name, 60) ?? 'Artwork'
  if (a.origin === 'code') {
    const code = str(a.code, MAX_SOURCE_LENGTH)
    return code === null ? null : { origin: 'code', code, name }
  }
  if (a.origin === 'text') {
    const text = str(a.text, 14)
    const gradient = typeof a.gradient === 'string' && own(GRADIENTS, a.gradient) ? a.gradient : 'neon'
    return text === null ? null : { origin: 'text', text, gradient, name }
  }
  if (a.origin === 'paint') {
    const grid = cleanGrid(a.grid)
    return grid ? { origin: 'paint', grid, name } : null
  }
  return null
}

function cleanFormulas(f, keys) {
  if (!isObj(f)) return undefined
  const out = {}
  for (const k of keys) {
    const v = str(f[k], MAX_EXPR_LENGTH)
    if (v !== null) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

export function cleanMotion(m) {
  if (!isObj(m)) return null
  const key = m.key === 'original' || MOTIONS.some((x) => x.key === m.key) ? m.key : 'breeze'
  const mode = m.mode === 'particles' ? 'particles' : 'pixels'
  const custom = cleanFormulas(m.custom, ['dx', 'dy', 'hue', 'bright'])
  return custom ? { key, mode, custom } : { key, mode }
}

export function cleanExplore(e) {
  if (!isObj(e)) return null
  const preset = EXPLORE_PRESETS.some((p) => p.key === e.preset) ? e.preset : 'marble'
  const out = { preset }
  if (typeof e.palette === 'string' && own(PALETTES, e.palette) && !PALETTES[e.palette].hidden) out.palette = e.palette
  const formula = str(e.formula, MAX_EXPR_LENGTH)
  if (formula) out.formula = formula
  return out
}

// Saved browser state ({ view, artwork, motion, explore }).
export function cleanSaved(s) {
  if (!isObj(s)) return {}
  return {
    view: VIEWS.includes(s.view) ? s.view : 'home',
    artwork: cleanArtworkSpec(s.artwork),
    motion: cleanMotion(s.motion),
    explore: cleanExplore(s.explore),
  }
}

// A project file the user opens.
export function parseProjectFile(text) {
  if (typeof text !== 'string' || text.length > MAX_PROJECT_BYTES) return { ok: false, error: 'That file is too large to be a MORPH project.' }
  let obj
  try { obj = JSON.parse(text) } catch { return { ok: false, error: 'That file isn’t valid JSON.' } }
  if (!isObj(obj) || obj.format !== PROJECT_FORMAT || obj.version !== 1) return { ok: false, error: 'That isn’t a MORPH project file.' }
  const artwork = cleanArtworkSpec(obj.artwork)
  if (!artwork) return { ok: false, error: 'The project’s artwork is missing or damaged.' }
  return { ok: true, artwork, motion: cleanMotion(obj.motion) ?? { key: 'breeze', mode: 'pixels' }, explore: cleanExplore(obj.explore) }
}

export function serialiseProject(artwork, motion, explore) {
  const { art, ...spec } = artwork
  if (spec.grid) spec.grid = { ...spec.grid, data: Array.from(spec.grid.data) }
  return JSON.stringify({ format: PROJECT_FORMAT, version: 1, artwork: spec, motion, explore }, null, 1)
}
