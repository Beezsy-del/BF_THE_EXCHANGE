// "Blossom Night": a hand-tuned procedural pixel scene.
// build() runs once per palette or glow change and returns:
//   bg       static RGBA buffer (sky, moon, hills, mountain, fence, gate, ground, trunk)
//   skyMask  where stars may appear
//   stars    twinkling points
//   canopy   blossom pixels grouped by layer (they sway)
//   carpet   fallen petals around the tree's roots
//   spawn    canopy points that falling petals start from

import { PALETTES, hexToRgb } from './palettes.js'

export const W = 320
export const H = 180
export const WATERLINE = 134

// ---------- helpers ----------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// Smooth value noise in [-1, 1].
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

// Pick between palette steps with ordered dithering: v in [0, n-1].
function ditherIndex(v, x, y, n) {
  const c = Math.min(n - 1, Math.max(0, v))
  const i = Math.floor(c)
  return i < n - 1 && c - i > bayer(x, y) ? i + 1 : i
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// ---------- builder ----------

export function build(paletteKey = 'sakura', glow = 0.6) {
  const P = PALETTES[paletteKey] ?? PALETTES.sakura
  const C = (hex) => hexToRgb(hex)
  const bg = new Uint8ClampedArray(W * H * 4)
  for (let i = 3; i < bg.length; i += 4) bg[i] = 255 // fully opaque, water rows included
  const skyMask = new Uint8Array(W * H)
  const R = rng(20261126)

  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    bg[i] = rgb[0]; bg[i + 1] = rgb[1]; bg[i + 2] = rgb[2]; bg[i + 3] = 255
  }
  const add = (x, y, rgb, k) => {
    if (x < 0 || y < 0 || x >= W || y >= H || k <= 0) return
    const i = (y * W + x) * 4
    bg[i] = bg[i] + rgb[0] * k; bg[i + 1] = bg[i + 1] + rgb[1] * k; bg[i + 2] = bg[i + 2] + rgb[2] * k
  }

  // --- sky: dithered gradient, slightly brighter toward the horizon ---
  const sky = P.sky.map(C)
  for (let y = 0; y < WATERLINE; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.pow(y / 112, 1.25) * (sky.length - 1) + noise(x * 0.04, y * 0.12) * 0.25
      put(x, y, sky[ditherIndex(v, x, y, sky.length)])
      skyMask[y * W + x] = 1
    }
  }

  // --- faint drifting cloud bands ---
  const cloud = sky[Math.min(sky.length - 1, 3)]
  for (let y = 40; y < 100; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x * 0.018 + 4, y * 0.16) + noise(x * 0.05, y * 0.3) * 0.4
      if (n > 0.55 && bayer(x, y) < (n - 0.55) * 2.2) put(x, y, cloud)
    }
  }

  // --- moon (crescent, top-left) with dithered halo ---
  const halo = C(P.halo)
  const [mx, my, mr] = [30, 26, 9]
  for (let y = 0; y < 70; y++) {
    for (let x = 0; x < 90; x++) {
      const d = Math.hypot(x - mx, y - my)
      if (d > mr && d < mr + 18) {
        const k = Math.pow(1 - (d - mr) / 18, 2.4)
        if (bayer(x, y) < k * 0.75) put(x, y, halo)
      }
    }
  }
  const moonLit = C(P.moon[0]), moonShade = C(P.moon[1])
  for (let y = my - mr; y <= my + mr; y++) {
    for (let x = mx - mr; x <= mx + mr; x++) {
      const d = Math.hypot(x - mx, y - my)
      const cut = Math.hypot(x - (mx + 5), y - (my - 3))
      if (d <= mr && cut > mr - 1) {
        put(x, y, cut < mr + 1.5 || d > mr - 1 ? moonShade : moonLit)
        skyMask[y * W + x] = 0
      }
    }
  }

  // --- distant mountain (right) with snow cap ---
  const [mDark, mLight, snow, snowLit] = P.mountain.map(C)
  const peakX = 286, peakY = 62
  for (let x = 170; x < W; x++) {
    const slope = x < peakX ? (peakX - x) * 0.42 : (x - peakX) * 0.55
    const top = Math.round(peakY + slope + noise(x * 0.15, 3) * 2)
    for (let y = Math.max(0, top); y < 112; y++) {
      const depth = y - top
      const lit = x < peakX + noise(y * 0.2, x * 0.05) * 6
      let col = lit ? mLight : mDark
      const snowLine = 18 + noise(x * 0.12, 9) * 7
      if (depth < snowLine && y < 96) {
        const fade = depth / snowLine
        if (bayer(x, y) > fade * 1.15 - 0.15) col = lit ? snowLit : snow
      }
      put(x, y, col)
      skyMask[y * W + x] = 0
    }
  }

  // --- far hills: two misty silhouettes ---
  const [hillA, hillB] = P.farHills.map(C)
  for (let x = 0; x < W; x++) {
    const h1 = Math.round(97 + Math.sin(x * 0.021 + 1) * 5 + noise(x * 0.06, 1) * 3)
    const h2 = Math.round(104 + Math.sin(x * 0.034 + 4) * 3 + noise(x * 0.09, 2) * 2)
    for (let y = h1; y < WATERLINE; y++) {
      put(x, y, y === h1 ? hillB : hillA)
      skyMask[y * W + x] = 0
    }
    for (let y = h2; y < WATERLINE; y++) put(x, y, y < h2 + 2 && bayer(x, y) < 0.5 ? hillB : hillA)
  }

  // --- bushes / treeline band ---
  const [bushD, bushM, bushL] = P.bush.map(C)
  for (let x = 0; x < W; x++) {
    let top = 113
    for (let k = 0; k < 3; k++) top -= Math.max(0, noise(x * (0.08 + k * 0.07), k * 10) * (4 - k))
    top = Math.round(top)
    for (let y = top; y < WATERLINE; y++) {
      const edge = y - top
      const speck = noise(x * 0.5, y * 0.5) > 0.55
      put(x, y, edge === 0 && bayer(x, y) < 0.6 ? bushL : speck && edge < 6 ? bushM : bushD)
    }
  }

  // --- fence: posts and two rails ---
  const fence = C(P.fence)
  for (let x = 0; x < W; x++) {
    if (x % 4 === 0) for (let y = 114; y < 125; y++) put(x, y, fence)
    put(x, 116, fence)
    put(x, 121, fence)
  }

  // --- shrine gate with lanterns (right side) ---
  const lanternSpots = []
  const gx = 262
  for (let y = 102; y < 128; y++) {
    for (const px of [gx - 13, gx - 12, gx + 12, gx + 13]) put(px, y, fence)
  }
  for (let x = gx - 18; x <= gx + 18; x++) {
    const curve = Math.round(Math.pow(Math.abs(x - gx) / 18, 2) * -2)
    put(x, 101 + curve, fence); put(x, 102 + curve, fence)
  }
  for (let x = gx - 15; x <= gx + 15; x++) put(x, 106, fence)
  for (let y = 102; y < 106; y++) put(gx, y, fence)
  // steps under the gate
  const [, groundM] = P.ground.map(C)
  for (let s = 0; s < 3; s++) for (let x = gx - 8 + s * 2; x <= gx + 8 - s * 2; x++) put(x, 126 - s * 2, groundM)
  lanternSpots.push([gx - 9, 111], [gx + 9, 111])
  const lanternRgb = C(P.lantern[0]), lanternWarm = C(P.lantern[1])
  for (const [lx, ly] of lanternSpots) {
    for (let y = ly - 14; y < ly + 14; y++) {
      for (let x = lx - 14; x < lx + 14; x++) {
        const d = Math.hypot(x - lx, (y - ly) * 1.2)
        const k = Math.pow(clamp01(1 - d / 14), 2) * 0.22 * (0.5 + glow)
        add(x, y, lanternWarm, k)
      }
    }
    put(lx, ly - 1, fence); put(lx, ly, lanternRgb); put(lx, ly + 1, lanternWarm)
  }

  // --- ground bank under the tree ---
  const [gD, gM, gL] = P.ground.map(C)
  for (let x = 0; x < W; x++) {
    const bank = Math.round(127 + noise(x * 0.05, 7) * 2 + (x > 200 ? (x - 200) * 0.02 : 0))
    for (let y = bank; y < WATERLINE; y++) {
      const grass = y === bank && bayer(x, y) < 0.55
      put(x, y, grass ? gL : hash2(x, y) > 0.86 ? gM : gD)
    }
    // tufts of grass poking above the bank
    if (hash2(x, 99) > 0.8) put(x, bank - 1, gM)
  }
  // a rock on the left
  for (let y = 124; y < WATERLINE; y++) {
    for (let x = 6; x < 26; x++) {
      const d = Math.hypot((x - 15) / 10, (y - 132) / 8)
      if (d < 1) put(x, y, x - 15 + (y - 132) < -6 ? bushL : d > 0.75 ? bushD : bushM)
    }
  }

  // --- tree glow: soft light around the canopy and the petal carpet ---
  const glowRgb = C(P.glow)
  for (let y = 30; y < WATERLINE; y++) {
    for (let x = 30; x < 230; x++) {
      const canopyD = Math.hypot((x - 122) / 72, (y - 70) / 40)
      const carpetD = Math.hypot((x - 132) / 78, (y - 132) / 9)
      const k = Math.max(
        Math.pow(clamp01(1 - canopyD), 2) * 0.16,
        Math.pow(clamp01(1 - carpetD), 1.6) * 0.32,
      ) * glow
      if (k > 0.01) add(x, y, glowRgb, k * (0.85 + bayer(x, y) * 0.3))
    }
  }

  // --- trunk: a curved, tapering bezier, lit from the moon (left) ---
  const trunk = P.trunk.map(C)
  const bez = (t, a, b, c, d) => {
    const u = 1 - t
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
  }
  const drawLimb = (pts, r0, r1, steps) => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const cx = bez(t, pts[0][0], pts[1][0], pts[2][0], pts[3][0])
      const cy = bez(t, pts[0][1], pts[1][1], pts[2][1], pts[3][1])
      const flare = t < 0.12 ? (0.12 - t) * 22 : 0
      const r = r0 + (r1 - r0) * t + flare
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x - cx, dy = y - cy
          if (dx * dx + dy * dy > r * r) continue
          const side = dx / r
          let tone = side < -0.35 ? 3 : side < 0.1 ? 2 : side < 0.6 ? 1 : 0
          if (hash2(x, y * 3) > 0.9) tone = Math.max(0, tone - 1) // bark grain
          put(x, y, trunk[tone])
          skyMask[y * W + x] = 0
        }
      }
    }
  }
  drawLimb([[112, 132], [104, 114], [150, 106], [128, 76]], 4.2, 2.0, 240)
  drawLimb([[126, 113], [118, 110], [108, 108], [96, 101]], 1.8, 1.0, 80)
  drawLimb([[133, 92], [140, 88], [150, 82], [156, 74]], 1.4, 0.9, 60)

  // --- blossom canopy: union of ellipses + noise, dithered tones ---
  const blossom = P.blossom.map(C)
  const makeCanopy = (cx, cy, blobs, layer, swayWeight) => {
    let minX = W, maxX = 0, minY = H, maxY = 0
    for (const [bx, by, rx, ry] of blobs) {
      minX = Math.min(minX, cx + bx - rx - 3); maxX = Math.max(maxX, cx + bx + rx + 3)
      minY = Math.min(minY, cy + by - ry - 3); maxY = Math.max(maxY, cy + by + ry + 3)
    }
    const field = (x, y) => {
      let best = -9, bdx = 0, bdy = 0
      for (const [bx, by, rx, ry] of blobs) {
        const dx = (x - cx - bx) / rx, dy = (y - cy - by) / ry
        const f = 1 - (dx * dx + dy * dy)
        if (f > best) { best = f; bdx = dx; bdy = dy }
      }
      return [best + noise(x * 0.22, y * 0.22) * 0.22 + noise(x * 0.6, y * 0.6) * 0.08, bdx, bdy]
    }
    const pixels = []
    for (let y = Math.floor(minY); y <= maxY; y++) {
      for (let x = Math.floor(minX); x <= maxX; x++) {
        const [f, bdx, bdy] = field(x, y)
        if (f > 0) {
          // light from upper-left; clumps catch highlights; underside in shadow
          const clump = noise(x * 0.16 + 30, y * 0.2)
          let v = 2.1 - bdx * 0.7 - bdy * 1.25 + clump * 0.9 - (y - cy) * 0.03
          const below = field(x, y + 2)[0] <= 0
          const above = field(x, y - 1)[0] <= 0
          if (below) v -= 1.1
          if (above) v += 0.8
          // clustered threshold (not Bayer) so tones form petal clumps, not checkerboards
          const vc = Math.min(blossom.length - 1, Math.max(0, v))
          const vi = Math.floor(vc)
          const thr = 0.5 + noise(x * 0.55 + 7, y * 0.55) * 0.45
          const tone = vi < blossom.length - 1 && vc - vi > thr ? vi + 1 : vi
          pixels.push([x, y, blossom[tone]])
          skyMask[y * W + x] = 0
        } else if (f > -0.16 && R() < 0.22) {
          // stray edge petals keep the silhouette soft
          pixels.push([x, y, blossom[2 + (R() < 0.5 ? 1 : 0)]])
        }
      }
    }
    return { layer, cx, cy, top: minY, bottom: maxY, swayWeight, pixels }
  }

  const canopy = [
    makeCanopy(94, 99, [[0, 0, 15, 6], [-9, 2, 8, 4], [9, 1, 9, 4], [2, -3, 9, 4]], 'low branch', 0.7),
    makeCanopy(118, 66, [
      [-32, 6, 17, 9], [-14, -3, 22, 12], [9, -7, 22, 12], [31, 1, 18, 10],
      [0, 7, 36, 9], [-44, 12, 9, 5], [45, 9, 11, 6], [18, 12, 14, 6], [-22, 13, 12, 5],
    ], 'crown', 1),
  ]

  // --- petal carpet around the roots, spilling onto the water's edge ---
  const carpet = []
  for (let y = 124; y < WATERLINE + 9; y++) {
    for (let x = 40; x < 240; x++) {
      const d = Math.hypot((x - 130) / 82, (y - 132) / 6.5)
      if (d >= 1) continue
      const p = Math.pow(1 - d, 1.4) * 0.6
      if (R() < p) {
        const tone = R() < 0.25 ? 4 : R() < 0.6 ? 3 : 2
        carpet.push([x, y, blossom[tone], R() * 100])
      }
    }
  }

  // --- stars: only where the sky is visible ---
  const stars = []
  const starRgb = C(P.star)
  while (stars.length < 90) {
    const x = Math.floor(R() * W), y = Math.floor(R() * 96)
    if (!skyMask[y * W + x]) continue
    const big = R() < 0.1
    stars.push({ x, y, big, seed: R() * 1000, rgb: starRgb })
  }

  // --- spawn points for falling petals: lower half of each canopy ---
  const spawn = []
  for (const c of canopy) for (const [x, y] of c.pixels) if (y > (c.top + c.bottom) / 2) spawn.push([x, y, c])

  return {
    palette: P, bg, skyMask, stars, canopy, carpet, spawn, lanternSpots,
    blossom, water: P.water.map(C), waterGlint: C(P.waterGlint), lantern: [lanternRgb, lanternWarm],
  }
}
