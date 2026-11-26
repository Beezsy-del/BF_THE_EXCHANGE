// Conversions between the shapes artwork can take:
//   art  = { width, height, background:[r,g,b], pixels:[{x,y,r,g,b,layer}], layers, animations }
//   grid = { w, h, bg:[r,g,b], data: Int32Array (0xRRGGBB or -1) }   <- what the pixel editor edits

import { hslToRgb } from '../lang/draw.js'

export function emptyGrid(w = 64, h = 64, bg = [14, 16, 30]) {
  return { w, h, bg, data: new Int32Array(w * h).fill(-1) }
}

export function artToGrid(art) {
  const g = emptyGrid(art.width, art.height, art.background)
  for (const p of art.pixels) g.data[p.y * g.w + p.x] = (p.r << 16) | (p.g << 8) | p.b
  return g
}

export function gridToArt(g) {
  const pixels = []
  for (let i = 0; i < g.data.length; i++) {
    const c = g.data[i]
    if (c < 0) continue
    pixels.push({ x: i % g.w, y: Math.floor(i / g.w), r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255, layer: 'main' })
  }
  return { width: g.w, height: g.h, background: g.bg, pixels, layers: ['main'], animations: {} }
}

export const GRADIENTS = {
  neon: [[330, 90, 62], [285, 75, 66], [175, 80, 52], [90, 85, 56]],
  sunset: [[20, 95, 62], [340, 80, 62], [270, 60, 62]],
  gold: [[42, 95, 62], [30, 90, 55], [48, 100, 75]],
  ice: [[195, 90, 70], [215, 80, 62], [260, 70, 72]],
}

function gradientAt(stops, k) {
  const f = Math.min(0.9999, Math.max(0, k)) * (stops.length - 1)
  const i = Math.floor(f), w = f - i
  const [a, b] = [stops[i], stops[i + 1]]
  const dh = ((b[0] - a[0] + 540) % 360) - 180 // shortest way round the hue wheel
  return hslToRgb(a[0] + dh * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w)
}

// Rasterise a word into pixel art (typography → pixels → particles).
export function textToArt(text, { gradient = 'neon', bg = [10, 10, 18], height = 54, weight = 900 } = {}) {
  const word = (text || ' ').slice(0, 14)
  const font = `${weight} ${Math.round(height * 0.74)}px Inter, "Segoe UI", system-ui, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const w = Math.min(240, Math.max(24, Math.ceil(probe.measureText(word).width) + 12))
  const c = document.createElement('canvas')
  c.width = w; c.height = height
  const g = c.getContext('2d')
  g.font = font
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  g.fillStyle = '#fff'
  g.fillText(word, w / 2, height / 2 + 2)
  const data = g.getImageData(0, 0, w, height).data
  const stops = GRADIENTS[gradient] ?? GRADIENTS.neon
  const pixels = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 110) continue
      const [r, gg, b] = gradientAt(stops, x / w + (y / height - 0.5) * 0.15)
      // a little texture so particles sparkle
      const k = 0.88 + ((x * 7 + y * 13) % 5) * 0.03
      pixels.push({ x, y, r: Math.min(255, r * k), g: Math.min(255, gg * k), b: Math.min(255, b * k), layer: 'main' })
    }
  }
  return { width: w, height, background: bg, pixels, layers: ['main'], animations: {} }
}
